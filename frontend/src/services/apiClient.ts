export type UserDto = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  preferredLanguage: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
};

const ACCESS_TOKEN_KEY = 'notesapp.accessToken';
const REFRESH_TOKEN_KEY = 'notesapp.refreshToken';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    return null;
  }

  const data: AuthResponse = await response.json();
  storeTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

/**
 * Fetch wrapper that attaches the JWT access token and transparently
 * refreshes it (using the rotating refresh token) on a single 401 retry.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = getAccessToken();
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const newToken = await refreshPromise;

    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(input, { ...init, headers });
    }
  }

  return response;
}

export async function apiJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(input, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`API error ${response.status}: ${text}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
