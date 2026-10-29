import crypto from 'crypto'
import { KryptPadErrorCodes, KryptPadError } from '../common/error-utils'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const SALT_LENGTH = 32
const KEY_LENGTH = 32
// 'KPF2' identifies the binary envelope family (the second Krypt Pad file
// format). FILE_VERSION is the layout revision within that family, so the next
// incompatible change bumps FILE_VERSION, not the magic.
const FILE_MAGIC = Buffer.from('KPF2')
const FILE_VERSION = 1
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
 * @returns {Buffer}
 */
const createFileHeader = function (contentLength: number, params: ScryptParams): Buffer {
    const header = Buffer.allocUnsafe(FILE_HEADER_LENGTH)
    FILE_MAGIC.copy(header, 0)
    header.writeUInt8(FILE_VERSION, 4)
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
    if (version !== FILE_VERSION) {
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
 * @returns {Buffer} encrypted file payload
 */
const encryptFilePayload = (text: crypto.BinaryLike, fileKey: FileKey): Buffer => {
    const iv = crypto.randomBytes(IV_LENGTH)
    const plainText = toBuffer(text)
    const header = createFileHeader(plainText.length, fileKey.params)
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

export { deriveFileKeyAsync, destroyFileKey, encryptFilePayload, decryptFilePayloadAsync }
export type { FileKey }
