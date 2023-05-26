const crypto = require('crypto');

const algorithm = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Encrypts data with a key generated from a passphrase
 * @param {*} text 
 * @param {*} passphrase 
 * @returns 
 */
const encrypt = (text, passphrase) => {
    // Create a random 32 byte salt
    const salt = crypto.randomBytes(SALT_LENGTH);
    // Generate a derived key from a passphrase, salt, # of iterations
    const secretKey = crypto.pbkdf2Sync(passphrase, salt, 100000, KEY_LENGTH, 'sha256');
    // Generate a random initialization vector for our first encryption block
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    // Encrypt the data
    const content = Buffer.concat([cipher.update(text), cipher.final()]);
    // Determine the length of the encrypted data and store it with the cipher text so we know where the
    // auth tag starts.
    const contentLength = Buffer.allocUnsafe(4);
    contentLength.writeUInt32LE(content.length);

    // Write to the buffer
    const encrypted = Buffer.concat([salt, iv, contentLength, content, cipher.getAuthTag()]);

    return encrypted;
};

/**
 * Decrypts data with a salt, passphrase, and iv.
 * @param {*} cipherData 
 * @param {*} passphrase 
 * @returns 
 */
const decrypt = (cipherData, passphrase) => {
    // Get some prepended data like salt and iv
    const salt = cipherData.subarray(0, SALT_LENGTH);
    const iv = cipherData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    // Get the rest of the message to decrypt. But first, get the length of the content. This is determined by an
    // 8 bit uint prepended to the content
    const contentLength = cipherData.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + 4).readUInt32LE();
    const content = cipherData.subarray(SALT_LENGTH + IV_LENGTH + 4, SALT_LENGTH + IV_LENGTH + 4 + contentLength);
    // Get the auth tag at the end
    const authTag = cipherData.subarray(SALT_LENGTH + IV_LENGTH + 4 + contentLength);

    // Generate a derived key from a passphrase, salt, # of iterations
    const secretKey = crypto.pbkdf2Sync(passphrase, salt, 100000, KEY_LENGTH, 'sha256');
    // Create a decipher object for aes 256, the secret key, and the iv.
    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    // Set the auth tag
    decipher.setAuthTag(authTag);
    // Decrypt the data and concat the final block to the output buffer
    const decrpyted = Buffer.concat([decipher.update(content), decipher.final()]);
    return decrpyted.toString();
}



export { encrypt, decrypt }