const crypto = require('crypto')
const fs = require('fs')

const algorithm = 'aes-256-ctr'
//const secretKey = 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3'

/**
 * Encrypts data with a key generated from a passphrase
 * @param {*} text 
 * @param {*} passphrase 
 * @returns 
 */
const encrypt = (text, passphrase) => {
    //crypto.pbkdf2Sync();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  
    return {
      iv: iv.toString('hex'),
      content: encrypted.toString('hex')
    }
  }



export { encrypt }