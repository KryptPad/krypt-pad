import crypto from 'crypto'
import { KryptPadErrorCodes, KryptPadError } from '../common/error-utils'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const SALT_LENGTH = 32
const KEY_LENGTH = 32
const FILE_MAGIC = Buffer.from('KPF2')
const FILE_VERSION = 1
const AUTH_TAG_LENGTH = 16
const FILE_HEADER_LENGTH = 28
const FILE_SCRYPT_N = 32768
const FILE_SCRYPT_R = 8
const FILE_SCRYPT_P = 1
const FILE_SCRYPT_MAXMEM = 64 * 1024 * 1024

/**
 * Generates a secret key for whole-file encryption.
 * @param {crypto.BinaryLike} passphrase
 * @param {Buffer} salt
 * @returns {Promise<Buffer>} the secret key
 */
const generateFileSecretKey = function (passphrase: crypto.BinaryLike, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.scrypt(
            passphrase,
            salt,
            KEY_LENGTH,
            {
                N: FILE_SCRYPT_N,
                r: FILE_SCRYPT_R,
                p: FILE_SCRYPT_P,
                maxmem: FILE_SCRYPT_MAXMEM
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
 * Creates the authenticated file header for whole-file encryption.
 * @param {number} contentLength
 * @returns {Buffer}
 */
const createFileHeader = function (contentLength: number): Buffer {
    const header = Buffer.allocUnsafe(FILE_HEADER_LENGTH)
    FILE_MAGIC.copy(header, 0)
    header.writeUInt8(FILE_VERSION, 4)
    header.writeUInt8(SALT_LENGTH, 5)
    header.writeUInt8(IV_LENGTH, 6)
    header.writeUInt8(AUTH_TAG_LENGTH, 7)
    header.writeUInt32LE(FILE_SCRYPT_N, 8)
    header.writeUInt32LE(FILE_SCRYPT_R, 12)
    header.writeUInt32LE(FILE_SCRYPT_P, 16)
    header.writeUInt32LE(KEY_LENGTH, 20)
    header.writeUInt32LE(contentLength, 24)

    return header
}

/**
 * Validates and parses the whole-file encryption header.
 * @param {Buffer} cipherData
 * @returns parsed header info
 */
const parseFileHeader = function (cipherData: Buffer) {
    if (cipherData.length < FILE_HEADER_LENGTH + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
        throw new KryptPadError('The file is invalid or corrupted.', KryptPadErrorCodes.DECRYPT_ERROR)
    }

    const magic = cipherData.subarray(0, 4)
    if (!magic.equals(FILE_MAGIC)) {
        throw new KryptPadError('The file format is invalid or unsupported.', KryptPadErrorCodes.DECRYPT_ERROR)
    }

    const version = cipherData.readUInt8(4)
    if (version !== FILE_VERSION) {
        throw new KryptPadError('The file format version is unsupported.', KryptPadErrorCodes.DECRYPT_ERROR)
    }

    const saltLength = cipherData.readUInt8(5)
    const ivLength = cipherData.readUInt8(6)
    const authTagLength = cipherData.readUInt8(7)
    const keyLength = cipherData.readUInt32LE(20)
    const contentLength = cipherData.readUInt32LE(24)

    if (saltLength !== SALT_LENGTH || ivLength !== IV_LENGTH || authTagLength !== AUTH_TAG_LENGTH || keyLength !== KEY_LENGTH) {
        throw new KryptPadError('The file encryption parameters are invalid.', KryptPadErrorCodes.DECRYPT_ERROR)
    }

    const expectedLength = FILE_HEADER_LENGTH + saltLength + ivLength + contentLength + authTagLength
    if (cipherData.length !== expectedLength) {
        throw new KryptPadError('The file is truncated or corrupted.', KryptPadErrorCodes.DECRYPT_ERROR)
    }

    return {
        headerLength: FILE_HEADER_LENGTH,
        saltLength,
        ivLength,
        authTagLength,
        contentLength
    }
}

/**
 * Encrypts the full file payload into a versioned binary envelope.
 * @param {crypto.BinaryLike} text
 * @param {crypto.BinaryLike} passphrase
 * @returns {Promise<Buffer>} encrypted file payload
 */
const encryptFilePayloadAsync = async (text: crypto.BinaryLike, passphrase: crypto.BinaryLike): Promise<Buffer> => {
    const salt = crypto.randomBytes(SALT_LENGTH)
    const secretKey = await generateFileSecretKey(passphrase, salt)
    const iv = crypto.randomBytes(IV_LENGTH)
    const plainText = typeof text === 'string' ? Buffer.from(text) : Buffer.from(text.buffer, text.byteOffset, text.byteLength)
    const header = createFileHeader(plainText.length)
    const cipher = crypto.createCipheriv(ALGORITHM, secretKey, iv)

    cipher.setAAD(header)

    const content = Buffer.concat([cipher.update(plainText), cipher.final()])

    const encrypted = Buffer.concat([header, salt, iv, content, cipher.getAuthTag()])
    secretKey.fill(0)

    return encrypted
}

/**
 * Decrypts the full file payload from a versioned binary envelope.
 * @param {Buffer} cipherData
 * @param {crypto.BinaryLike} passphrase
 * @returns {Promise<string>} decrypted file payload
 */
const decryptFilePayloadAsync = async (cipherData: Buffer, passphrase: crypto.BinaryLike): Promise<string> => {
    const { headerLength, saltLength, ivLength, authTagLength, contentLength } = parseFileHeader(cipherData)
    const saltOffset = headerLength
    const ivOffset = saltOffset + saltLength
    const contentOffset = ivOffset + ivLength
    const authTagOffset = contentOffset + contentLength

    const header = Buffer.from(cipherData.subarray(0, headerLength))
    const salt = Buffer.from(cipherData.subarray(saltOffset, ivOffset))
    const secretKey = await generateFileSecretKey(passphrase, salt)
    const iv = Buffer.from(cipherData.subarray(ivOffset, contentOffset))
    const content = Buffer.from(cipherData.subarray(contentOffset, authTagOffset))
    const authTag = Buffer.from(cipherData.subarray(authTagOffset, authTagOffset + authTagLength))

    const decipher = crypto.createDecipheriv(ALGORITHM, secretKey, iv)
    decipher.setAAD(header)
    decipher.setAuthTag(authTag)

    try {
        const decrypted = Buffer.concat([decipher.update(content), decipher.final()])
        secretKey.fill(0)
        return decrypted.toString()
    } catch (ex) {
        secretKey.fill(0)
        throw new KryptPadError('Could not open the file. Please check the passphrase and try again.', KryptPadErrorCodes.DECRYPT_ERROR)
    }
}

export { encryptFilePayloadAsync, decryptFilePayloadAsync }
