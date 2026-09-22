import crypto from 'crypto'
import { describe, it, expect } from 'vitest'
import { encryptFilePayloadAsync, decryptFilePayloadAsync } from './krypto'
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

const expectDecryptFailure = async (promise: Promise<string>, expectedMessage?: string) => {
    try {
        await promise
        expect.fail('Expected the promise to reject')
    } catch (err) {
        expect(err).toBeInstanceOf(KryptPadError)
        expect((err as KryptPadError).code).toBe(KryptPadErrorCodes.DECRYPT_ERROR)
        if (expectedMessage !== undefined) {
            expect((err as KryptPadError).message).toBe(expectedMessage)
        }
    }
}

describe('encryptFilePayloadAsync / decryptFilePayloadAsync round-trip', () => {
    it.each([
        ['a typical string', 'the quick brown fox jumps over the lazy dog'],
        ['an empty string', ''],
        ['multi-byte unicode content', '日本語のパスワード 🔒 café']
    ])('round-trips %s', async (_label, text) => {
        const encrypted = await encryptFilePayloadAsync(text, PASSPHRASE)
        const decrypted = await decryptFilePayloadAsync(encrypted, PASSPHRASE)
        expect(decrypted).toBe(text)
    })

    it('produces different ciphertext for the same text and passphrase, but both decrypt to the same plaintext', async () => {
        const text = 'the vault contents'
        const first = await encryptFilePayloadAsync(text, PASSPHRASE)
        const second = await encryptFilePayloadAsync(text, PASSPHRASE)

        expect(first.equals(second)).toBe(false)

        expect(await decryptFilePayloadAsync(first, PASSPHRASE)).toBe(text)
        expect(await decryptFilePayloadAsync(second, PASSPHRASE)).toBe(text)
    })
})

describe('decryptFilePayloadAsync wrong passphrase / tamper detection', () => {
    it('fails with the wrong passphrase', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        await expectDecryptFailure(
            decryptFilePayloadAsync(encrypted, 'not the right passphrase'),
            'Could not open the file. Please check the passphrase and try again.'
        )
    })

    it('fails when a byte in the encrypted content is flipped', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = flipByte(encrypted, contentOffset())
        await expectDecryptFailure(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            'Could not open the file. Please check the passphrase and try again.'
        )
    })

    it('fails when a byte in the auth tag is flipped', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = flipByte(encrypted, encrypted.length - 1)
        await expectDecryptFailure(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            'Could not open the file. Please check the passphrase and try again.'
        )
    })

    it('fails when the scrypt cost in the AAD header is changed to another valid value', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = withUInt32LE(encrypted, OFFSET_SCRYPT_N, 16384)
        await expectDecryptFailure(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            'Could not open the file. Please check the passphrase and try again.'
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
        expect(await decryptFilePayloadAsync(legacy, PASSPHRASE)).toBe('legacy vault')
    })

    it.each([
        ['N below the minimum', 8192, 8, 1],
        ['N above the maximum', 2097152, 8, 1],
        ['N not a power of two', 100000, 8, 1],
        ['r of zero', 32768, 0, 1],
        ['r above the maximum', 32768, 17, 1],
        ['p of zero', 32768, 8, 0],
        ['p above the maximum', 32768, 8, 5],
        ['a memory cost above the limit', 1048576, 16, 1]
    ])('rejects %s before deriving a key', async (_label, N, r, p) => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        let tampered = withUInt32LE(encrypted, OFFSET_SCRYPT_N, N)
        tampered = withUInt32LE(tampered, OFFSET_SCRYPT_R, r)
        tampered = withUInt32LE(tampered, OFFSET_SCRYPT_P, p)
        await expectDecryptFailure(decryptFilePayloadAsync(tampered, PASSPHRASE), 'The file encryption parameters are invalid.')
    })
})

describe('decryptFilePayloadAsync header validation', () => {
    it('fails on a buffer shorter than the minimum valid envelope', async () => {
        const tooShort = Buffer.alloc(HEADER_LENGTH + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH - 1)
        await expectDecryptFailure(
            decryptFilePayloadAsync(tooShort, PASSPHRASE),
            'The file is invalid or corrupted.'
        )
    })

    it('fails on an invalid magic number', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = flipByte(encrypted, OFFSET_MAGIC)
        await expectDecryptFailure(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            'The file format is invalid or unsupported.'
        )
    })

    it('fails on an unsupported file version', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = withUInt8(encrypted, OFFSET_VERSION, 99)
        await expectDecryptFailure(
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
        await expectDecryptFailure(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            'The file encryption parameters are invalid.'
        )
    })

    it('fails when the declared content length does not match the actual buffer size', async () => {
        const encrypted = await encryptFilePayloadAsync('secret content', PASSPHRASE)
        const tampered = withUInt32LE(encrypted, HEADER_LENGTH - 4, 9999)
        await expectDecryptFailure(
            decryptFilePayloadAsync(tampered, PASSPHRASE),
            'The file is truncated or corrupted.'
        )
    })
})
