const rawBaseUrl =
  (import.meta && import.meta.env && import.meta.env.VITE_API_URL) ||
  (typeof process !== 'undefined' ? process.env.VITE_API_URL : '') ||
  '';

const baseUrl = rawBaseUrl.replace(/\/$/, '');

export const isApiConfigured = (): boolean => Boolean(baseUrl);

const buildUrl = (path: string): string => {
  if (!path.startsWith('/')) {
    return `${baseUrl}/${path}`;
  }
  return `${baseUrl}${path}`;
};

export const request = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  if (!baseUrl) {
    throw new Error('API base URL is not configured');
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildUrl(path), {
    credentials: 'include',
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = isJson && payload?.error ? payload.error : 'Request failed';
    throw new Error(message);
  }

  return payload as T;
};
