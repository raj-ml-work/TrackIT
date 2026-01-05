import { createHash } from 'crypto';

/**
 * Hash a password using SHA-256
 */
export const hashPassword = async (password: string): Promise<string> => {
  return createHash('sha256').update(password).digest('hex');
};

/**
 * Check if a string is a valid SHA-256 hash
 */
export const isSha256Hash = (str: string): boolean => {
  return /^[a-f0-9]{64}$/i.test(str);
};