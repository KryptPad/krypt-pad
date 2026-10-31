import crypto from 'crypto'
import os from 'os'
import path from 'path'
import { mkdtemp, rm, writeFile, readFile, stat, open } from 'fs/promises'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
    deriveFileKeyAsync,
    destroyFileKey,
    encryptFilePayload,
    decryptFilePayloadAsync,
    decryptFilePayloadWithKey,
    createAttachmentKey,
    encryptAttachmentFileAsync,
    decryptAttachmentFileAsync,
    MAX_ATTACHMENT_SIZE
} from './krypto'
import { KryptPadError, KryptPadErrorCodes } from '../common/error-utils'

/**
 * Fixed binary envelope layout produced by krypto.ts:
 * [ header (28 bytes) | salt (32 bytes) | iv (12 bytes) | content (N bytes) | authTag (16 bytes) ]
 * Header layout: magic(4) version(1) saltLength(1) ivLength(1) authTagLength(1) N(4) r(4) p(4) keyLength(4) contentLength(4)
 */
const HEADER_LENGTH = 28
const SALT_LENGTH = 32
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

const OFFSET_MAGIC = 0
const OFFSET_VERSION = 4
const OFFSET_SALT_LENGTH = 5
const OFFSET_IV_LENGTH = 6
const OFFSET_AUTH_TAG_LENGTH = 7
const OFFSET_SCRYPT_N = 8
const OFFSET_SCRYPT_R = 12
const OFFSET_SCRYPT_P = 16
const OFFSET_KEY_LENGTH = 20

const PASSPHRASE = 'correct horse battery staple'
const WRONG_PASSPHRASE_MESSAGE = 'Could not open the file. Please check the passphrase and try again.'

/**
 * Encrypts with a freshly derived key, the way a new file is written.
 */
const encryptFilePayloadAsync = async (text: string, passphrase: string): Promise<Buffer> => {
    return encryptFilePayload(text, await deriveFileKeyAsync(passphrase))
}

/**
 * Decrypts and returns only the plaintext.
 */
const decryptText = async (cipherData: Buffer, passphrase: string): Promise<string> => {
    return (await decryptFilePayloadAsync(cipherData, passphrase)).data
}

const flipByte = (buffer: Buffer, offset: number): Buffer => {
    const copy = Buffer.from(buffer)
    copy[offset] = copy[offset] ^ 0xff
    return copy
}

const withUInt8 = (buffer: Buffer, offset: number, value: number): Buffer => {
    const copy = Buffer.from(buffer)
    copy.writeUInt8(value, offset)
    return copy
}

const withUInt32LE = (buffer: Buffer, offset: number, value: number): Buffer => {
    const copy = Buffer.from(buffer)
    copy.writeUInt32LE(value, offset)
    return copy
}

const contentOffset = () => HEADER_LENGTH + SALT_LENGTH + IV_LENGTH

const expectFailure = async (promise: Promise<unknown>, expectedCode: KryptPadErrorCodes, expectedMessage?: string) => {
    let rejected = false
    try {
        await promise
    } catch (err) {
        rejected = true
        expect(err).toBeInstanceOf(KryptPadError)
        expect((err as KryptPadError).code).toBe(expectedCode)
        if (expectedMessage !== undefined) {
            expect((err as KryptPadError).message).toBe(expectedMessage)
        }
    }
    if (!rejected) {
        expect.fail('Expected the promise to reject')
    }
}

/** A wrong passphrase or altered content: the user may retry. */
const expectDecryptFailure = (promise: Promise<unknown>, expectedMessage?: string) =>
    expectFailure(promise, KryptPadErrorCodes.DECRYPT_ERROR, expectedMessage)

/** An unusable file: retrying with another passphrase can't help. */
const expectInvalidFile = (promise: Promise<unknown>, expectedMessage?: string) =>
    expectFailure(promise, KryptPadErrorCodes.INVALID_FILE, expectedMessage)

describe('encryptFilePayloadAsync / decryptFilePayloadAsync round-trip', () => {
    it.each([
        ['a typical string', 'the quick brown fox jumps over the lazy dog'],
        ['an empty string', ''],
        ['multi-byte unicode content', '日本語のパスワード 🔒 café']
    ])('round-trips %s', async (_label, text) => {
        const encrypted = await encryptFilePayloadAsync(text, PASSPHRASE)
        const decrypted = await decryptText(encrypted, PASSPHRASE)
        expect(decrypted).toBe(text)
    })

    it('produces different ciphertext for the same text and passphrase, but both decrypt to the same plaintext', async () => {
        const text = 'the vault contents'
        const first = await encryptFilePayloadAsync(text, PASSPHRASE)
        const second = await encryptFilePayloadAsync(text, PASSPHRASE)

        expect(first.equals(second)).toBe(false)

        expect(await decryptText(first, PASSPHRASE)).toBe(text)
        expect(await decryptText(second, PASSPHRASE)).toBe(text)
    })
})

describe('decryptFilePayloadAsync wrong passphrase / tamper detection', () => {
    it('fails with the wrong passphrase', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        await expectDecryptFailure(
            decryptFilePayloadAsync(encrypted, 'not the right passphrase'),
            WRONG_PASSPHRASE_MESSAGE
        )
    })

    it('fails when a byte in the encrypted content is flipped', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = flipByte(encrypted, contentOffset())
        await expectDecryptFailure(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            WRONG_PASSPHRASE_MESSAGE
        )
    })

    it('fails when a byte in the auth tag is flipped', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = flipByte(encrypted, encrypted.length - 1)
        await expectDecryptFailure(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            WRONG_PASSPHRASE_MESSAGE
        )
    })

    it('fails when the scrypt cost in the AAD header is changed to another valid value', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = withUInt32LE(encrypted, OFFSET_SCRYPT_N, 16384)
        await expectDecryptFailure(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            WRONG_PASSPHRASE_MESSAGE
        )
    })
})

/**
 * Builds a version 1 envelope by hand with the given scrypt cost, the way an
 * earlier build of the app would have written it.
 */
const buildEnvelope = (text: string, passphrase: string, N: number, r: number, p: number): Buffer => {
    const plainText = Buffer.from(text)
    const header = Buffer.alloc(HEADER_LENGTH)
    Buffer.from('KPF2').copy(header, 0)
    header.writeUInt8(1, OFFSET_VERSION)
    header.writeUInt8(SALT_LENGTH, OFFSET_SALT_LENGTH)
    header.writeUInt8(IV_LENGTH, OFFSET_IV_LENGTH)
    header.writeUInt8(AUTH_TAG_LENGTH, OFFSET_AUTH_TAG_LENGTH)
    header.writeUInt32LE(N, OFFSET_SCRYPT_N)
    header.writeUInt32LE(r, OFFSET_SCRYPT_R)
    header.writeUInt32LE(p, OFFSET_SCRYPT_P)
    header.writeUInt32LE(32, OFFSET_KEY_LENGTH)
    header.writeUInt32LE(plainText.length, HEADER_LENGTH - 4)

    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)
    const key = crypto.scryptSync(passphrase, salt, 32, { N, r, p, maxmem: 256 * 1024 * 1024 })
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(header)
    const content = Buffer.concat([cipher.update(plainText), cipher.final()])

    return Buffer.concat([header, salt, iv, content, cipher.getAuthTag()])
}

describe('decryptFilePayloadAsync scrypt cost from the header', () => {
    it('writes new files with the current default cost', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        expect(encrypted.readUInt32LE(OFFSET_SCRYPT_N)).toBe(131072)
        expect(encrypted.readUInt32LE(OFFSET_SCRYPT_R)).toBe(8)
        expect(encrypted.readUInt32LE(OFFSET_SCRYPT_P)).toBe(1)
    })

    it('opens files written with the earlier default cost (N=32768)', async () => {
        const legacy = buildEnvelope('legacy vault', PASSPHRASE, 32768, 8, 1)
        expect(await decryptText(legacy, PASSPHRASE)).toBe('legacy vault')
    })

    it.each([
        ['N below the minimum', 8192, 8, 1],
        ['N above the maximum', 2097152, 8, 1],
        ['N not a power of two', 100000, 8, 1],
        ['r of zero', 32768, 0, 1],
        ['r above the maximum', 32768, 17, 1],
        ['p of zero', 32768, 8, 0],
        ['p above the maximum', 32768, 8, 5],
        ['a memory cost above the limit', 1048576, 16, 1],
        ['a 1 GiB memory cost', 1048576, 8, 1]
    ])('rejects %s before deriving a key', async (_label, N, r, p) => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        let tampered = withUInt32LE(encrypted, OFFSET_SCRYPT_N, N)
        tampered = withUInt32LE(tampered, OFFSET_SCRYPT_R, r)
        tampered = withUInt32LE(tampered, OFFSET_SCRYPT_P, p)
        await expectInvalidFile(decryptFilePayloadAsync(tampered, PASSPHRASE), 'The file encryption parameters are invalid.')
    })
})

describe('decryptFilePayloadAsync header validation', () => {
    it('fails on a buffer shorter than the minimum valid envelope', async () => {
        const tooShort = Buffer.alloc(HEADER_LENGTH + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH - 1)
        await expectInvalidFile(
            decryptFilePayloadAsync(tooShort, PASSPHRASE),
            'The file is invalid or corrupted.'
        )
    })

    it('fails on an invalid magic number', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = flipByte(encrypted, OFFSET_MAGIC)
        await expectInvalidFile(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            'The file format is invalid or unsupported.'
        )
    })

    it('fails on an unsupported file version', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = withUInt8(encrypted, OFFSET_VERSION, 99)
        await expectInvalidFile(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            'The file format version is unsupported.'
        )
    })

    it.each([
        ['saltLength', OFFSET_SALT_LENGTH, 8, (buf: Buffer, v: number) => withUInt8(buf, OFFSET_SALT_LENGTH, v)],
        ['ivLength', OFFSET_IV_LENGTH, 8, (buf: Buffer, v: number) => withUInt8(buf, OFFSET_IV_LENGTH, v)],
        ['authTagLength', OFFSET_AUTH_TAG_LENGTH, 8, (buf: Buffer, v: number) => withUInt8(buf, OFFSET_AUTH_TAG_LENGTH, v)],
        ['keyLength', OFFSET_KEY_LENGTH, 8, (buf: Buffer, v: number) => withUInt32LE(buf, OFFSET_KEY_LENGTH, v)]
    ])('fails when the declared %s does not match the actual encryption parameters', async (_name, _offset, wrongValue, mutate) => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = mutate(encrypted, wrongValue)
        await expectInvalidFile(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            'The file encryption parameters are invalid.'
        )
    })

    it('fails when the declared content length does not match the actual buffer size', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = withUInt32LE(encrypted, HEADER_LENGTH - 4, 9999)
        await expectInvalidFile(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            'The file is truncated or corrupted.'
        )
    })
})

describe('session file key', () => {
    it('reuses one derived key across saves with a fresh IV each time', async () => {
        const fileKey = await deriveFileKeyAsync(PASSPHRASE)
        const first = encryptFilePayload('save one', fileKey)
        const second = encryptFilePayload('save two', fileKey)

        const salt = (buf: Buffer) => buf.subarray(HEADER_LENGTH, HEADER_LENGTH + SALT_LENGTH)
        const iv = (buf: Buffer) => buf.subarray(HEADER_LENGTH + SALT_LENGTH, contentOffset())

        expect(salt(first).equals(salt(second))).toBe(true)
        expect(iv(first).equals(iv(second))).toBe(false)
        expect(await decryptText(first, PASSPHRASE)).toBe('save one')
        expect(await decryptText(second, PASSPHRASE)).toBe('save two')
    })

    it('returns a key from decrypt that keeps writing the same file', async () => {
        const encrypted = await encryptFilePayloadAsync('original', PASSPHRASE)
        const { data, fileKey } = await decryptFilePayloadAsync(encrypted, PASSPHRASE)
        expect(data).toBe('original')

        // A current-format file keeps its salt, so no extra derivation was needed
        expect(fileKey.salt.equals(encrypted.subarray(HEADER_LENGTH, HEADER_LENGTH + SALT_LENGTH))).toBe(true)

        const resaved = encryptFilePayload('edited', fileKey)
        expect(await decryptText(resaved, PASSPHRASE)).toBe('edited')
    })

    it('wipes the key when destroyed', async () => {
        const fileKey = await deriveFileKeyAsync(PASSPHRASE)
        destroyFileKey(fileKey)
        expect(fileKey.key.equals(Buffer.alloc(fileKey.key.length))).toBe(true)
    })

    it('upgrades a file written with the earlier default cost on the next save', async () => {
        const legacy = buildEnvelope('legacy vault', PASSPHRASE, 32768, 8, 1)
        const { fileKey } = await decryptFilePayloadAsync(legacy, PASSPHRASE)
        expect(fileKey.params).toEqual({ N: 131072, r: 8, p: 1 })

        const resaved = encryptFilePayload('legacy vault', fileKey)
        expect(resaved.readUInt32LE(OFFSET_SCRYPT_N)).toBe(131072)
        expect(await decryptText(resaved, PASSPHRASE)).toBe('legacy vault')
    })
})

describe('passphrase Unicode normalization', () => {
    // The same visible passphrase, as one code point per accented letter (NFC)
    // and as a base letter plus a combining accent (NFD)
    const COMPOSED = 'caf\u00e9 cr\u00e8me'
    const DECOMPOSED = 'cafe\u0301 cre\u0300me'

    it('treats composed and decomposed forms of a passphrase as the same', async () => {
        expect(COMPOSED).not.toBe(DECOMPOSED)

        const fromDecomposed = await encryptFilePayloadAsync('vault', DECOMPOSED)
        expect(await decryptText(fromDecomposed, COMPOSED)).toBe('vault')

        const fromComposed = await encryptFilePayloadAsync('vault', COMPOSED)
        expect(await decryptText(fromComposed, DECOMPOSED)).toBe('vault')
    })

    it('still opens a file written with an unnormalized passphrase, and normalizes it on the next save', async () => {
        // Written by an earlier build that used the passphrase bytes as typed
        const legacy = buildEnvelope('old vault', DECOMPOSED, 131072, 8, 1)

        // The exact passphrase still opens it
        const { data, fileKey } = await decryptFilePayloadAsync(legacy, DECOMPOSED)
        expect(data).toBe('old vault')

        // ...and the next save can be opened with either form
        const resaved = encryptFilePayload(data, fileKey)
        expect(await decryptText(resaved, COMPOSED)).toBe('old vault')
        expect(await decryptText(resaved, DECOMPOSED)).toBe('old vault')
    })

    it('fails cleanly when neither form matches', async () => {
        const encrypted = await encryptFilePayloadAsync('vault', COMPOSED)
        await expectDecryptFailure(decryptFilePayloadAsync(encrypted, 'cafe\u0301 wrong'), WRONG_PASSPHRASE_MESSAGE)
    })
})

describe('file versions', () => {
    it('writes version 1 normally and version 2 when the profile has attachments, and reads both', async () => {
        const fileKey = await deriveFileKeyAsync(PASSPHRASE)

        const plain = encryptFilePayload('vault', fileKey)
        const withAttachments = encryptFilePayload('vault', fileKey, true)

        expect(plain.readUInt8(OFFSET_VERSION)).toBe(1)
        expect(withAttachments.readUInt8(OFFSET_VERSION)).toBe(2)
        expect(await decryptText(plain, PASSPHRASE)).toBe('vault')
        expect(await decryptText(withAttachments, PASSPHRASE)).toBe('vault')
    })
})

describe('decryptFilePayloadWithKey', () => {
    it('decrypts a file saved with the same key', async () => {
        const fileKey = await deriveFileKeyAsync(PASSPHRASE)
        const encrypted = encryptFilePayload('from another device', fileKey)

        expect(decryptFilePayloadWithKey(encrypted, fileKey)).toBe('from another device')
    })

    it('fails with DECRYPT_ERROR when the file was re-keyed', async () => {
        const sessionKey = await deriveFileKeyAsync(PASSPHRASE)
        const rekeyed = encryptFilePayload('vault', await deriveFileKeyAsync(PASSPHRASE))

        expect(() => decryptFilePayloadWithKey(rekeyed, sessionKey)).toThrow(expect.objectContaining({ code: KryptPadErrorCodes.DECRYPT_ERROR }))
    })

    it('fails with DECRYPT_ERROR when the content was altered', async () => {
        const fileKey = await deriveFileKeyAsync(PASSPHRASE)
        const encrypted = encryptFilePayload('vault', fileKey)
        encrypted[encrypted.length - 20] ^= 0xff

        expect(() => decryptFilePayloadWithKey(encrypted, fileKey)).toThrow(expect.objectContaining({ code: KryptPadErrorCodes.DECRYPT_ERROR }))
    })
})

describe('attachments', () => {
    const ATTACHMENT_ID = '11111111-2222-4333-8444-555555555555'
    const OTHER_ID = '99999999-2222-4333-8444-555555555555'
    const ATTACHMENT_HEADER = 20
    const CHUNK = 64 * 1024
    const FULL_CHUNK = CHUNK + AUTH_TAG_LENGTH

    let directory: string
    let key: Buffer

    beforeEach(async () => {
        directory = await mkdtemp(path.join(os.tmpdir(), 'krypt-pad-attachments-'))
        key = createAttachmentKey()
    })

    afterEach(async () => {
        await rm(directory, { recursive: true, force: true })
    })

    const file = (name: string) => path.join(directory, name)

    /**
     * Encrypts the given bytes and returns the encrypted file's path
     */
    const encryptBytes = async (data: Buffer, id = ATTACHMENT_ID): Promise<string> => {
        await writeFile(file('plain'), data)
        const size = await encryptAttachmentFileAsync(file('plain'), file('enc.kpb'), id, key)
        expect(size).toBe(data.length)
        return file('enc.kpb')
    }

    const expectInvalid = async (promise: Promise<unknown>) => {
        await expect(promise).rejects.toMatchObject({ code: KryptPadErrorCodes.INVALID_FILE })
        // Nothing is left at the destination
        await expect(readFile(file('out'))).rejects.toMatchObject({ code: 'ENOENT' })
    }

    it.each([0, 1, CHUNK - 1, CHUNK, CHUNK + 1, 3 * CHUNK + 123])('round-trips %i bytes', async (length) => {
        const data = crypto.randomBytes(length)
        const encrypted = await encryptBytes(data)

        // One final chunk always follows the full chunks
        expect((await stat(encrypted)).size).toBe(ATTACHMENT_HEADER + Math.floor(length / CHUNK) * FULL_CHUNK + (length % CHUNK) + AUTH_TAG_LENGTH)

        await decryptAttachmentFileAsync(encrypted, file('out'), ATTACHMENT_ID, key)
        expect((await readFile(file('out'))).equals(data)).toBe(true)
    })

    it('does not contain the plaintext', async () => {
        const data = Buffer.from('a very secret scanned document '.repeat(100))
        const encrypted = await readFile(await encryptBytes(data))

        expect(encrypted.includes(Buffer.from('very secret'))).toBe(false)
    })

    it('fails with the wrong key', async () => {
        const encrypted = await encryptBytes(crypto.randomBytes(100))
        await expectInvalid(decryptAttachmentFileAsync(encrypted, file('out'), ATTACHMENT_ID, createAttachmentKey()))
    })

    it('fails when the file belongs to a different attachment', async () => {
        const encrypted = await encryptBytes(crypto.randomBytes(100))
        await expectInvalid(decryptAttachmentFileAsync(encrypted, file('out'), OTHER_ID, key))
    })

    it('fails when a chunk was altered', async () => {
        const encrypted = await encryptBytes(crypto.randomBytes(2 * CHUNK + 10))
        const data = await readFile(encrypted)
        data[ATTACHMENT_HEADER + FULL_CHUNK + 5] ^= 0x01
        await writeFile(encrypted, data)

        await expectInvalid(decryptAttachmentFileAsync(encrypted, file('out'), ATTACHMENT_ID, key))
    })

    it('fails when chunks were reordered', async () => {
        const encrypted = await encryptBytes(crypto.randomBytes(2 * CHUNK + 10))
        const data = await readFile(encrypted)
        const first = data.subarray(ATTACHMENT_HEADER, ATTACHMENT_HEADER + FULL_CHUNK)
        const second = data.subarray(ATTACHMENT_HEADER + FULL_CHUNK, ATTACHMENT_HEADER + 2 * FULL_CHUNK)
        await writeFile(
            encrypted,
            Buffer.concat([data.subarray(0, ATTACHMENT_HEADER), second, first, data.subarray(ATTACHMENT_HEADER + 2 * FULL_CHUNK)])
        )

        await expectInvalid(decryptAttachmentFileAsync(encrypted, file('out'), ATTACHMENT_ID, key))
    })

    it('fails when the final chunk was cut off', async () => {
        const encrypted = await encryptBytes(crypto.randomBytes(2 * CHUNK + 10))
        const data = await readFile(encrypted)
        // Drop the final chunk, leaving only whole full chunks
        await writeFile(encrypted, data.subarray(0, ATTACHMENT_HEADER + 2 * FULL_CHUNK))

        await expectInvalid(decryptAttachmentFileAsync(encrypted, file('out'), ATTACHMENT_ID, key))
    })

    it('fails when a full chunk is cut short and passed off as the final one', async () => {
        const encrypted = await encryptBytes(crypto.randomBytes(2 * CHUNK + 10))
        const data = await readFile(encrypted)
        await writeFile(encrypted, data.subarray(0, ATTACHMENT_HEADER + FULL_CHUNK + 100))

        await expectInvalid(decryptAttachmentFileAsync(encrypted, file('out'), ATTACHMENT_ID, key))
    })

    it('reports an attachment that is not on this device', async () => {
        await expect(decryptAttachmentFileAsync(file('missing.kpb'), file('out'), ATTACHMENT_ID, key)).rejects.toMatchObject({
            code: KryptPadErrorCodes.ATTACHMENT_MISSING
        })
    })

    it('refuses files over the size limit without writing anything', async () => {
        const handle = await open(file('huge'), 'w')
        await handle.truncate(MAX_ATTACHMENT_SIZE + 1)
        await handle.close()

        await expect(encryptAttachmentFileAsync(file('huge'), file('enc.kpb'), ATTACHMENT_ID, key)).rejects.toMatchObject({
            code: KryptPadErrorCodes.ATTACHMENT_TOO_LARGE
        })
        await expect(stat(file('enc.kpb'))).rejects.toMatchObject({ code: 'ENOENT' })
    })
})
