const crypto = require('crypto')

const algorithm = 'aes-256-gcm'
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

  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

  return {
    salt,
    iv,
    content: encrypted
  }
};

/**
 * Decrypts data with a salt, passphrase, and iv.
 * @param {*} hash 
 * @param {*} salt 
 * @param {*} passphrase 
 * @returns 
 */
const decrypt = (hash, passphrase) => {
  // Generate a derived key from a passphrase, salt, # of iterations
  const secretKey = crypto.pbkdf2Sync(passphrase, hash.salt, 100000, KEY_LENGTH, 'sha256');
  // Create a decipher object for aes 256, the secret key, and the iv.
  const decipher = crypto.createDecipheriv(algorithm, secretKey, hash.iv);
  // Decrypt the data and concat the final block to the output buffer
  const decrpyted = Buffer.concat([decipher.update(hash.content), decipher.final()]);
  return decrpyted.toString();
}



export { encrypt, decrypt }