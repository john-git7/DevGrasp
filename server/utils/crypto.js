const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const secret = process.env.API_SECRET || process.env.JWT_SECRET || 'fallback_secret';
// Ensure secret is 32 bytes for aes-256-cbc
const key = crypto.createHash('sha256').update(secret).digest();

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
}

function decrypt(text) {
  if (!text || !text.iv || !text.encryptedData) return null;
  let iv = Buffer.from(text.iv, 'hex');
  let encryptedText = Buffer.from(text.encryptedData, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

module.exports = { encrypt, decrypt };
