/**
 * Password hashing utilities using Web Crypto.
 * Note: This is client-side hashing for the custom auth flow.
 */
const getSubtleCrypto = (): SubtleCrypto => {
  if (typeof globalThis === 'undefined') {
    throw new Error('Password hashing is unavailable in this environment.');
  }

  if (!globalThis.isSecureContext) {
    throw new Error(
      'Password hashing requires a secure context (HTTPS or http://localhost).'
    );
  }

  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new Error(
      'Web Crypto is unavailable in this browser. Please use a modern browser over HTTPS.'
    );
  }

  return cryptoObj.subtle;
};

export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await getSubtleCrypto().digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const hashPasswordSHA1 = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await getSubtleCrypto().digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const isSha256Hash = (value: string | null | undefined): boolean => {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
};

export const isSha1Hash = (value: string | null | undefined): boolean => {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
};
