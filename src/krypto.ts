import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_ALGORITHM = 'sha256';
const IV_LENGTH = 12;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Generates an encryption key from a passphrase and a salt.
 * @param {String} passphrase 
 * @param {Buffer} salt 
 * @returns {Buffer} the secret key
 */
const generateSecretKey = function (passphrase: crypto.BinaryLike, salt: crypto.BinaryLike): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        // Generate a derived key from a passphrase, salt, # of iterations. DO NOT USE THE SYNC version of this
        // function. It is extremely slow.
        crypto.pbkdf2(passphrase, salt, ITERATIONS, KEY_LENGTH, KEY_ALGORITHM, (err, secretKey) => {
            if (!err) {
                resolve(secretKey);

            } else {
                reject(err);

            }

        });

    });
}

/**
 * Encrypts data with a key generated from a passphrase
 * @param {*} text 
 * @param {*} passphrase 
 * @returns 
 */
const encryptAsync = async (text: crypto.BinaryLike, passphrase: crypto.BinaryLike): Promise<Buffer> => {
    // Create a random 32 byte salt
    const salt = crypto.randomBytes(SALT_LENGTH);
    // Generate a derived key from a passphrase, salt, # of iterations
    const secretKey = await generateSecretKey(passphrase, salt);
    // Generate a random initialization vector for our first encryption block
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, secretKey, iv);
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
const decryptAsync = async (cipherData: Buffer, passphrase: crypto.BinaryLike): Promise<String> => {
    // Get some prepended data like salt and iv
    const salt = Buffer.from(cipherData.subarray(0, SALT_LENGTH));
    // Generate the secret key from the salt and passphrase
    const secretKey = await generateSecretKey(passphrase, salt);

    // Get the IV
    const iv = Buffer.from(cipherData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH));
    // Get the rest of the message to decrypt. But first, get the length of the content. This is determined by an
    // 8 bit uint prepended to the content
    const contentLength = Buffer.from(cipherData.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + 4)).readUInt32LE();
    const content = Buffer.from(cipherData.subarray(SALT_LENGTH + IV_LENGTH + 4, SALT_LENGTH + IV_LENGTH + 4 + contentLength));
    // Get the auth tag at the end
    const authTag = Buffer.from(cipherData.subarray(SALT_LENGTH + IV_LENGTH + 4 + contentLength));

    // Create a decipher object for aes 256, the secret key, and the iv.
    const decipher = crypto.createDecipheriv(ALGORITHM, secretKey, iv);
    // Set the auth tag
    decipher.setAuthTag(authTag);
    // Decrypt the data and concat the final block to the output buffer
    const decrpyted = Buffer.concat([decipher.update(content), decipher.final()]);
    return decrpyted.toString();

}

export { encryptAsync, decryptAsync }