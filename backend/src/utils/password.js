import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const SHA1_HEX_PATTERN = /^[a-f0-9]{40}$/i;

export const hashPasswordSha256 = (password) =>
  crypto.createHash('sha256').update(String(password)).digest('hex');

export const hashPasswordSha1 = (password) =>
  crypto.createHash('sha1').update(String(password)).digest('hex');

export const isSha256Hash = (value) =>
  typeof value === 'string' && SHA256_HEX_PATTERN.test(value);

export const isSha1Hash = (value) =>
  typeof value === 'string' && SHA1_HEX_PATTERN.test(value);

export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (password, storedHash) => {
  if (!storedHash) return false;
  if (isSha256Hash(storedHash)) {
    return hashPasswordSha256(password) === storedHash.toLowerCase();
  }
  if (isSha1Hash(storedHash)) {
    return hashPasswordSha1(password) === storedHash.toLowerCase();
  }
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(password, storedHash);
  }
  return storedHash === password;
};
