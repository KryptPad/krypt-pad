import crypto from 'crypto'
import { open } from 'fs/promises'
import { KryptPadErrorCodes, KryptPadError } from '../common/error-utils'
import { withAtomicFile } from './fs-utils'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const SALT_LENGTH = 32
const KEY_LENGTH = 32
// 'KPF2' identifies the binary envelope family (the second Krypt Pad file
// format). FILE_VERSION is the layout revision within that family, so the next
// incompatible change bumps FILE_VERSION, not the magic.
//
// Version 2 has the same layout as version 1. It marks a profile that
// references attachments, so older app versions, which would drop those
// references on their next save, refuse the file instead.
const FILE_MAGIC = Buffer.from('KPF2')
const FILE_VERSION = 1
const FILE_VERSION_WITH_ATTACHMENTS = 2
const AUTH_TAG_LENGTH = 16
const FILE_HEADER_LENGTH = 28
// Cost used for newly derived keys (OWASP scrypt baseline). Older files keep
// working because the cost they were written with is read from their header.
const FILE_SCRYPT_N = 131072
const FILE_SCRYPT_R = 8
const FILE_SCRYPT_P = 1

// Bounds on the scrypt cost read from a file header. The header is only
// authenticated after the key is derived, so a crafted file must not be able
// to demand unbounded memory or CPU before the passphrase is checked.
const MIN_SCRYPT_N = 16384
const MAX_SCRYPT_N = 1048576
const MAX_SCRYPT_R = 16
const MAX_SCRYPT_P = 4
const MAX_SCRYPT_MEMORY = 512 * 1024 * 1024

const WRONG_PASSPHRASE_MESSAGE = 'Could not open the file. Please check the passphrase and try again.'

interface ScryptParams {
    N: number
    r: number
    p: number
}

/**
 * A derived file key together with the salt and cost it was derived with.
 * Holding this instead of the passphrase lets every save skip scrypt, and the
 * key buffer can be wiped with destroyFileKey, which a JS string cannot.
 */
interface FileKey {
    key: Buffer
    salt: Buffer
    params: ScryptParams
}

/**
 * Converts Node BinaryLike values to a Buffer.
 */
const toBuffer = (value: crypto.BinaryLike): Buffer => {
    if (typeof value === 'string') {
        return Buffer.from(value)
    }

    if (ArrayBuffer.isView(value)) {
        return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
    }

    return Buffer.from(value)
}

/**
 * Normalizes a string passphrase to Unicode NFC, so the same visible
 * characters produce the same key whichever way the keyboard or OS composed
 * them. Binary passphrases are used as-is.
 */
const normalizePassphrase = (passphrase: crypto.BinaryLike): crypto.BinaryLike => {
    return typeof passphrase === 'string' ? passphrase.normalize('NFC') : passphrase
}

/**
 * Runs scrypt with the given salt and cost.
 * @param {crypto.BinaryLike} passphrase used exactly as given
 * @param {Buffer} salt
 * @param {ScryptParams} params the scrypt cost parameters
 * @returns {Promise<Buffer>} the secret key
 */
const scryptAsync = function (passphrase: crypto.BinaryLike, salt: Buffer, params: ScryptParams): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.scrypt(
            passphrase,
            salt,
            KEY_LENGTH,
            {
                N: params.N,
                r: params.r,
                p: params.p,
                // Exactly what OpenSSL needs, plus headroom
                maxmem: 128 * params.r * (params.N + params.p + 2) + 1024 * 1024
            },
            (err, secretKey) => {
                if (!err) {
                    resolve(secretKey as Buffer)
                } else {
                    reject(err)
                }
            }
        )
    })
}

/**
 * Derives a new file key from a passphrase, with a fresh random salt and the
 * current default cost. Use this when the user sets a new passphrase.
 * @param {crypto.BinaryLike} passphrase
 * @returns {Promise<FileKey>}
 */
const deriveFileKeyAsync = async (passphrase: crypto.BinaryLike): Promise<FileKey> => {
    const salt = crypto.randomBytes(SALT_LENGTH)
    const params: ScryptParams = { N: FILE_SCRYPT_N, r: FILE_SCRYPT_R, p: FILE_SCRYPT_P }
    const key = await scryptAsync(normalizePassphrase(passphrase), salt, params)

    return { key, salt, params }
}

/**
 * Wipes the key material. The FileKey must not be used afterwards.
 * @param {FileKey | null | undefined} fileKey
 */
const destroyFileKey = (fileKey: FileKey | null | undefined): void => {
    fileKey?.key.fill(0)
}

/**
 * Whether a FileKey uses the current default cost.
 */
const usesCurrentParams = ({ params }: FileKey): boolean => {
    return params.N === FILE_SCRYPT_N && params.r === FILE_SCRYPT_R && params.p === FILE_SCRYPT_P
}

/**
 * Creates the authenticated file header for whole-file encryption.
 * @param {number} contentLength
 * @param {ScryptParams} params the scrypt cost the key was derived with
 * @param {number} version the file format version
 * @returns {Buffer}
 */
const createFileHeader = function (contentLength: number, params: ScryptParams, version: number): Buffer {
    const header = Buffer.allocUnsafe(FILE_HEADER_LENGTH)
    FILE_MAGIC.copy(header, 0)
    header.writeUInt8(version, 4)
    header.writeUInt8(SALT_LENGTH, 5)
    header.writeUInt8(IV_LENGTH, 6)
    header.writeUInt8(AUTH_TAG_LENGTH, 7)
    header.writeUInt32LE(params.N, 8)
    header.writeUInt32LE(params.r, 12)
    header.writeUInt32LE(params.p, 16)
    header.writeUInt32LE(KEY_LENGTH, 20)
    header.writeUInt32LE(contentLength, 24)

    return header
}

/**
 * Validates and parses the whole-file encryption header. Every failure here
 * means the file itself is unusable, so it is reported as INVALID_FILE rather
 * than as a passphrase problem.
 * @param {Buffer} cipherData
 * @returns parsed header info
 */
const parseFileHeader = function (cipherData: Buffer) {
    if (cipherData.length < FILE_HEADER_LENGTH + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
        throw new KryptPadError('The file is invalid or corrupted.', KryptPadErrorCodes.INVALID_FILE)
    }

    const magic = cipherData.subarray(0, 4)
    if (!magic.equals(FILE_MAGIC)) {
        throw new KryptPadError('The file format is invalid or unsupported.', KryptPadErrorCodes.INVALID_FILE)
    }

    const version = cipherData.readUInt8(4)
    if (version !== FILE_VERSION && version !== FILE_VERSION_WITH_ATTACHMENTS) {
        throw new KryptPadError('The file format version is unsupported.', KryptPadErrorCodes.INVALID_FILE)
    }

    const saltLength = cipherData.readUInt8(5)
    const ivLength = cipherData.readUInt8(6)
    const authTagLength = cipherData.readUInt8(7)
    const scryptParams: ScryptParams = {
        N: cipherData.readUInt32LE(8),
        r: cipherData.readUInt32LE(12),
        p: cipherData.readUInt32LE(16)
    }
    const keyLength = cipherData.readUInt32LE(20)
    const contentLength = cipherData.readUInt32LE(24)

    if (saltLength !== SALT_LENGTH || ivLength !== IV_LENGTH || authTagLength !== AUTH_TAG_LENGTH || keyLength !== KEY_LENGTH) {
        throw new KryptPadError('The file encryption parameters are invalid.', KryptPadErrorCodes.INVALID_FILE)
    }

    if (!isValidScryptParams(scryptParams)) {
        throw new KryptPadError('The file encryption parameters are invalid.', KryptPadErrorCodes.INVALID_FILE)
    }

    const expectedLength = FILE_HEADER_LENGTH + saltLength + ivLength + contentLength + authTagLength
    if (cipherData.length !== expectedLength) {
        throw new KryptPadError('The file is truncated or corrupted.', KryptPadErrorCodes.INVALID_FILE)
    }

    return {
        headerLength: FILE_HEADER_LENGTH,
        saltLength,
        ivLength,
        authTagLength,
        contentLength,
        scryptParams
    }
}

/**
 * Checks that scrypt parameters read from a file are within safe bounds.
 * @param {ScryptParams} params
 * @returns {boolean}
 */
const isValidScryptParams = function ({ N, r, p }: ScryptParams): boolean {
    // N must be a power of two
    const isPowerOfTwo = N > 0 && (N & (N - 1)) === 0

    return (
        isPowerOfTwo &&
        N >= MIN_SCRYPT_N &&
        N <= MAX_SCRYPT_N &&
        r >= 1 &&
        r <= MAX_SCRYPT_R &&
        p >= 1 &&
        p <= MAX_SCRYPT_P &&
        128 * N * r <= MAX_SCRYPT_MEMORY
    )
}

/**
 * Encrypts the full file payload into a versioned binary envelope with an
 * already-derived key. A fresh random IV is used for every call, so reusing
 * one key across many saves is safe. No key derivation happens here.
 * @param {crypto.BinaryLike} text
 * @param {FileKey} fileKey
 * @param {boolean} hasAttachments whether the profile references attachments
 * @returns {Buffer} encrypted file payload
 */
const encryptFilePayload = (text: crypto.BinaryLike, fileKey: FileKey, hasAttachments = false): Buffer => {
    const iv = crypto.randomBytes(IV_LENGTH)
    const plainText = toBuffer(text)
    const version = hasAttachments ? FILE_VERSION_WITH_ATTACHMENTS : FILE_VERSION
    const header = createFileHeader(plainText.length, fileKey.params, version)
    const cipher = crypto.createCipheriv(ALGORITHM, fileKey.key, iv)

    cipher.setAAD(header)

    const content = Buffer.concat([cipher.update(plainText), cipher.final()])

    return Buffer.concat([header, fileKey.salt, iv, content, cipher.getAuthTag()])
}

/**
 * Attempts GCM decryption with one candidate passphrase.
 * @returns the plaintext and the key, or null if authentication failed
 */
const tryDecrypt = async (
    cipherData: Buffer,
    passphrase: crypto.BinaryLike,
    layout: ReturnType<typeof parseFileHeader>
): Promise<{ plainText: Buffer; fileKey: FileKey } | null> => {
    const { headerLength, saltLength, ivLength, authTagLength, contentLength, scryptParams } = layout
    const saltOffset = headerLength
    const ivOffset = saltOffset + saltLength
    const contentOffset = ivOffset + ivLength
    const authTagOffset = contentOffset + contentLength

    const header = cipherData.subarray(0, headerLength)
    const salt = Buffer.from(cipherData.subarray(saltOffset, ivOffset))
    const iv = cipherData.subarray(ivOffset, contentOffset)
    const content = cipherData.subarray(contentOffset, authTagOffset)
    const authTag = cipherData.subarray(authTagOffset, authTagOffset + authTagLength)

    const key = await scryptAsync(passphrase, salt, scryptParams)

    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
        decipher.setAAD(header)
        decipher.setAuthTag(authTag)

        const plainText = Buffer.concat([decipher.update(content), decipher.final()])
        return { plainText, fileKey: { key, salt, params: scryptParams } }
    } catch {
        key.fill(0)
        return null
    }
}

/**
 * Decrypts the full file payload from a versioned binary envelope.
 *
 * The passphrase is tried NFC-normalized first. Files written before
 * normalization was added may have used a differently composed passphrase, so
 * the passphrase exactly as typed is tried as a fallback.
 *
 * The returned fileKey is ready for saving this profile. When the file was
 * written with an older cost or an unnormalized passphrase, a fresh key is
 * derived with the current cost and the normalized passphrase, so the next
 * save upgrades the file.
 * @param {Buffer} cipherData
 * @param {crypto.BinaryLike} passphrase
 * @returns {Promise<{ data: string, fileKey: FileKey }>}
 */
const decryptFilePayloadAsync = async (cipherData: Buffer, passphrase: crypto.BinaryLike): Promise<{ data: string; fileKey: FileKey }> => {
    const layout = parseFileHeader(cipherData)

    const normalized = normalizePassphrase(passphrase)
    let usedNormalized = true
    let result = await tryDecrypt(cipherData, normalized, layout)

    if (!result && typeof passphrase === 'string' && passphrase !== normalized) {
        usedNormalized = false
        result = await tryDecrypt(cipherData, passphrase, layout)
    }

    if (!result) {
        throw new KryptPadError(WRONG_PASSPHRASE_MESSAGE, KryptPadErrorCodes.DECRYPT_ERROR)
    }

    const { plainText, fileKey } = result
    try {
        const data = plainText.toString()

        if (usedNormalized && usesCurrentParams(fileKey)) {
            return { data, fileKey }
        }

        destroyFileKey(fileKey)
        return { data, fileKey: await deriveFileKeyAsync(passphrase) }
    } finally {
        plainText.fill(0)
    }
}

/**
 * Decrypts the full file payload with the key the session already holds,
 * without asking for the passphrase. Used to reload a vault another device
 * saved. If that device wrote it with a different salt or cost (for example
 * after changing the passphrase), the session key can't open it and this
 * throws DECRYPT_ERROR, so the caller can ask for the passphrase instead.
 * @param {Buffer} cipherData
 * @param {FileKey} fileKey
 * @returns {string} the decrypted data
 */
const decryptFilePayloadWithKey = (cipherData: Buffer, fileKey: FileKey): string => {
    const { headerLength, saltLength, ivLength, authTagLength, contentLength, scryptParams } = parseFileHeader(cipherData)
    const saltOffset = headerLength
    const ivOffset = saltOffset + saltLength
    const contentOffset = ivOffset + ivLength
    const authTagOffset = contentOffset + contentLength

    const sameKey =
        cipherData.subarray(saltOffset, ivOffset).equals(fileKey.salt) &&
        scryptParams.N === fileKey.params.N &&
        scryptParams.r === fileKey.params.r &&
        scryptParams.p === fileKey.params.p
    if (!sameKey) {
        throw new KryptPadError(WRONG_PASSPHRASE_MESSAGE, KryptPadErrorCodes.DECRYPT_ERROR)
    }

    let plainText: Buffer
    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, fileKey.key, cipherData.subarray(ivOffset, contentOffset))
        decipher.setAAD(cipherData.subarray(0, headerLength))
        decipher.setAuthTag(cipherData.subarray(authTagOffset, authTagOffset + authTagLength))
        plainText = Buffer.concat([decipher.update(cipherData.subarray(contentOffset, authTagOffset)), decipher.final()])
    } catch {
        throw new KryptPadError(WRONG_PASSPHRASE_MESSAGE, KryptPadErrorCodes.DECRYPT_ERROR)
    }

    try {
        return plainText.toString()
    } finally {
        plainText.fill(0)
    }
}

// Attachment envelope ('KPB1'). Attachments are encrypted in fixed-size
// chunks so large files are streamed instead of held in memory:
// [ header (20 bytes) | chunk 0 | chunk 1 | ... | final chunk ]
// Header layout: magic(4) version(1) reserved(3) chunkSize(4) noncePrefix(8)
// Each chunk is AES-256-GCM ciphertext followed by its 16-byte tag. The nonce
// is noncePrefix ‖ uint32 chunk index, and the AAD binds the header, the
// attachment id, the chunk index and whether it is the final chunk, so chunks
// can't be reordered, dropped, truncated or swapped between attachments.
// The final chunk always holds fewer than chunkSize plaintext bytes (possibly
// none), which is how a reader finds the end.
const ATTACHMENT_MAGIC = Buffer.from('KPB1')
const ATTACHMENT_VERSION = 1
const ATTACHMENT_HEADER_LENGTH = 20
const ATTACHMENT_NONCE_PREFIX_LENGTH = 8
const ATTACHMENT_CHUNK_SIZE = 64 * 1024
const MIN_ATTACHMENT_CHUNK_SIZE = 1024
const MAX_ATTACHMENT_CHUNK_SIZE = 1024 * 1024
const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024

/**
 * Generates a new random key for one attachment.
 * @returns {Buffer}
 */
const createAttachmentKey = (): Buffer => {
    return crypto.randomBytes(KEY_LENGTH)
}

/**
 * Builds the authenticated data for one attachment chunk.
 */
const attachmentChunkAAD = (header: Buffer, attachmentId: string, index: number, final: boolean): Buffer => {
    const suffix = Buffer.allocUnsafe(5)
    suffix.writeUInt32BE(index, 0)
    suffix.writeUInt8(final ? 1 : 0, 4)

    return Buffer.concat([header, Buffer.from(attachmentId), suffix])
}

/**
 * Builds the nonce for one attachment chunk.
 */
const attachmentChunkNonce = (noncePrefix: Buffer, index: number): Buffer => {
    const nonce = Buffer.allocUnsafe(IV_LENGTH)
    noncePrefix.copy(nonce, 0)
    nonce.writeUInt32BE(index, ATTACHMENT_NONCE_PREFIX_LENGTH)

    return nonce
}

const assertAttachmentKey = (key: Buffer) => {
    if (key.length !== KEY_LENGTH) {
        throw new KryptPadError('The attachment key is invalid.', KryptPadErrorCodes.INVALID_FILE)
    }
}

/**
 * Encrypts a file into an attachment envelope at destPath. The destination is
 * written atomically, so a failure never leaves a partial attachment behind.
 * @param {string} srcPath the plaintext file to read
 * @param {string} destPath where to write the encrypted attachment
 * @param {string} attachmentId the attachment's id, bound into every chunk
 * @param {Buffer} key the attachment's key
 * @returns {Promise<number>} the plaintext size in bytes
 */
const encryptAttachmentFileAsync = async (srcPath: string, destPath: string, attachmentId: string, key: Buffer): Promise<number> => {
    assertAttachmentKey(key)

    const source = await open(srcPath, 'r')
    try {
        if ((await source.stat()).size > MAX_ATTACHMENT_SIZE) {
            throw new KryptPadError('The file is too large to attach.', KryptPadErrorCodes.ATTACHMENT_TOO_LARGE)
        }

        const header = Buffer.alloc(ATTACHMENT_HEADER_LENGTH)
        ATTACHMENT_MAGIC.copy(header, 0)
        header.writeUInt8(ATTACHMENT_VERSION, 4)
        header.writeUInt32LE(ATTACHMENT_CHUNK_SIZE, 8)
        const noncePrefix = crypto.randomBytes(ATTACHMENT_NONCE_PREFIX_LENGTH)
        noncePrefix.copy(header, 12)

        let totalSize = 0
        await withAtomicFile(destPath, async (dest) => {
            await dest.write(header)

            const chunk = Buffer.alloc(ATTACHMENT_CHUNK_SIZE)
            try {
                for (let index = 0; ; index++) {
                    // Fill the chunk completely unless the file ends first
                    let length = 0
                    while (length < ATTACHMENT_CHUNK_SIZE) {
                        const { bytesRead } = await source.read(chunk, length, ATTACHMENT_CHUNK_SIZE - length, null)
                        if (bytesRead === 0) {
                            break
                        }
                        length += bytesRead
                    }

                    totalSize += length
                    if (totalSize > MAX_ATTACHMENT_SIZE) {
                        // The file grew while it was being read
                        throw new KryptPadError('The file is too large to attach.', KryptPadErrorCodes.ATTACHMENT_TOO_LARGE)
                    }

                    const final = length < ATTACHMENT_CHUNK_SIZE
                    const cipher = crypto.createCipheriv(ALGORITHM, key, attachmentChunkNonce(noncePrefix, index))
                    cipher.setAAD(attachmentChunkAAD(header, attachmentId, index, final))
                    await dest.write(Buffer.concat([cipher.update(chunk.subarray(0, length)), cipher.final(), cipher.getAuthTag()]))

                    if (final) {
                        break
                    }
                }
            } finally {
                chunk.fill(0)
            }
        })

        return totalSize
    } finally {
        await source.close()
    }
}

/**
 * Decrypts an attachment envelope to destPath. The destination is written
 * atomically, so if any chunk fails to authenticate nothing is left there.
 * @param {string} srcPath the encrypted attachment
 * @param {string} destPath where to write the plaintext
 * @param {string} attachmentId the attachment's id
 * @param {Buffer} key the attachment's key
 */
const decryptAttachmentFileAsync = async (srcPath: string, destPath: string, attachmentId: string, key: Buffer): Promise<void> => {
    assertAttachmentKey(key)

    let source
    try {
        source = await open(srcPath, 'r')
    } catch (ex) {
        if ((ex as NodeJS.ErrnoException)?.code === 'ENOENT') {
            throw new KryptPadError(
                'This attachment is not on this device yet. If the vault is synced, wait for syncing to finish and try again.',
                KryptPadErrorCodes.ATTACHMENT_MISSING
            )
        }
        throw ex
    }

    try {
        const invalid = () => new KryptPadError('The attachment is invalid or corrupted.', KryptPadErrorCodes.INVALID_FILE)

        const header = Buffer.alloc(ATTACHMENT_HEADER_LENGTH)
        const { bytesRead } = await source.read(header, 0, ATTACHMENT_HEADER_LENGTH, 0)
        if (bytesRead !== ATTACHMENT_HEADER_LENGTH || !header.subarray(0, 4).equals(ATTACHMENT_MAGIC)) {
            throw invalid()
        }
        if (header.readUInt8(4) !== ATTACHMENT_VERSION) {
            throw new KryptPadError('The attachment format version is unsupported.', KryptPadErrorCodes.INVALID_FILE)
        }

        const chunkSize = header.readUInt32LE(8)
        if (chunkSize < MIN_ATTACHMENT_CHUNK_SIZE || chunkSize > MAX_ATTACHMENT_CHUNK_SIZE) {
            throw invalid()
        }
        const noncePrefix = header.subarray(12, 12 + ATTACHMENT_NONCE_PREFIX_LENGTH)

        // Every chunk but the last is a full chunk plus its tag. The last
        // holds fewer than chunkSize bytes, so the body length alone tells
        // how many chunks there are and how long the last one is.
        const bodyLength = (await source.stat()).size - ATTACHMENT_HEADER_LENGTH
        const fullChunkLength = chunkSize + AUTH_TAG_LENGTH
        const finalChunkLength = bodyLength % fullChunkLength
        if (bodyLength < AUTH_TAG_LENGTH || finalChunkLength < AUTH_TAG_LENGTH) {
            throw invalid()
        }
        const chunkCount = Math.floor(bodyLength / fullChunkLength) + 1

        await withAtomicFile(destPath, async (dest) => {
            const chunk = Buffer.alloc(fullChunkLength)
            let position = ATTACHMENT_HEADER_LENGTH

            for (let index = 0; index < chunkCount; index++) {
                const final = index === chunkCount - 1
                const length = final ? finalChunkLength : fullChunkLength
                const { bytesRead } = await source.read(chunk, 0, length, position)
                if (bytesRead !== length) {
                    throw invalid()
                }
                position += length

                const decipher = crypto.createDecipheriv(ALGORITHM, key, attachmentChunkNonce(noncePrefix, index))
                decipher.setAAD(attachmentChunkAAD(header, attachmentId, index, final))
                decipher.setAuthTag(chunk.subarray(length - AUTH_TAG_LENGTH, length))

                let plainText: Buffer
                try {
                    plainText = Buffer.concat([decipher.update(chunk.subarray(0, length - AUTH_TAG_LENGTH)), decipher.final()])
                } catch {
                    throw invalid()
                }

                try {
                    await dest.write(plainText)
                } finally {
                    plainText.fill(0)
                }
            }
        })
    } finally {
        await source.close()
    }
}

export {
    deriveFileKeyAsync,
    destroyFileKey,
    encryptFilePayload,
    decryptFilePayloadAsync,
    decryptFilePayloadWithKey,
    createAttachmentKey,
    encryptAttachmentFileAsync,
    decryptAttachmentFileAsync,
    MAX_ATTACHMENT_SIZE
}
export type { FileKey }
