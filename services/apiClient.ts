import { getAccessToken, refreshAccessToken } from './authClient';

const apiBaseUrl = import.meta.env.VITE_API_URL || '';

export const isApiConfigured = (): boolean => Boolean(apiBaseUrl);

const buildHeaders = (headers?: HeadersInit) => {
  const merged = new Headers(headers || {});
  const token = getAccessToken();
  if (token) {
    merged.set('Authorization', `Bearer ${token}`);
  }
  return merged;
};

export const apiFetch = async (path: string, options: RequestInit = {}): Promise<Response> => {
  if (!apiBaseUrl) {
    throw new Error('VITE_API_URL is not configured.');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: buildHeaders(options.headers),
    credentials: 'include'
  });

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    return response;
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: buildHeaders(options.headers),
    credentials: 'include'
  });
};

export const apiFetchJson = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    let message = 'Request failed.';
    try {
      const data = await response.json();
      message = data?.error || message;
    } catch {
      // Ignore JSON parse errors.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
};
