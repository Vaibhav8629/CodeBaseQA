const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '';

export const API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, '');

export function apiUrl(path) {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not configured.');
  }

  return `${API_BASE_URL}/${String(path).replace(/^\/+/, '')}`;
}
