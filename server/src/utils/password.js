import crypto from 'crypto';

export const hashPasswordSha256 = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

export const hashPasswordSha1 = (password) => {
  return crypto.createHash('sha1').update(password).digest('hex');
};

export const isSha256Hash = (value) => {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
};

export const isSha1Hash = (value) => {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
};

export const verifyPassword = (password, storedHash) => {
  if (!storedHash) return false;

  if (isSha256Hash(storedHash)) {
    return hashPasswordSha256(password) === storedHash;
  }

  if (isSha1Hash(storedHash)) {
    return hashPasswordSha1(password) === storedHash;
  }

  return storedHash === password;
};
