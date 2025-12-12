/**
 * Password hashing utilities using Web Crypto (SHA-256).
 * Note: This is client-side hashing for the custom auth flow.
 */
export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const isSha256Hash = (value: string | null | undefined): boolean => {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
};
