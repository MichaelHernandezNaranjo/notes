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

/** Base URL of the API. Empty in dev (Vite proxy); e.g. https://api.d4nthi.com in production. */
export const API_BASE_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

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

/** Seconds until the JWT expires (negative if already expired); null if it cannot be decoded. */
function secondsToExpiry(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return typeof exp === 'number' ? exp - Date.now() / 1000 : null;
  } catch {
    return null;
  }
}

/** Refresh slightly before expiry so requests and the SignalR connection never carry a stale token. */
const REFRESH_MARGIN_SECONDS = 60;

function isFresh(token: string | null): boolean {
  const left = secondsToExpiry(token);
  return left !== null && left > REFRESH_MARGIN_SECONDS;
}

/** Runs `fn` while holding a cross-tab lock when supported, so tabs don't burn the rotating refresh token concurrently. */
async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('notesapp.refresh', fn);
  }
  return fn();
}

/**
 * Exchanges the refresh token for a new pair. Only an explicit rejection (4xx) ends the session;
 * network errors or 5xx keep the tokens so the next call can retry.
 * `force` skips the "another tab already refreshed" shortcut (used after the server returned 401).
 */
async function refreshAccessToken(force: boolean, staleToken: string | null): Promise<string | null> {
  return withRefreshLock(async () => {
    // Another tab may have refreshed while we waited for the lock.
    const current = getAccessToken();
    if (current && (force ? current !== staleToken && isFresh(current) : isFresh(current))) return current;

    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    let response: Response;
    try {
      response = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      return null; // offline / transient: keep the session
    }

    if (response.status >= 500) return null; // transient server error: keep the session
    if (!response.ok) {
      clearTokens(); // refresh token rejected: the session is really over
      return null;
    }

    const data: AuthResponse = await response.json();
    storeTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  });
}

function refreshOnce(force: boolean, staleToken: string | null): Promise<string | null> {
  refreshPromise ??= refreshAccessToken(force, staleToken).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/**
 * Returns an access token that is valid for at least a minute, refreshing it first if needed.
 * Used by fetch and by the SignalR `accessTokenFactory` (which re-runs on every reconnect).
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  if (isFresh(token)) return token;
  if (!getRefreshToken()) return token;
  return (await refreshOnce(false, token)) ?? getAccessToken();
}

function redirectToLoginIfSessionEnded(): void {
  if (!getRefreshToken() && window.location.pathname !== '/login') {
    clearTokens();
    window.location.assign('/login');
  }
}

/**
 * Fetch wrapper that attaches a valid JWT (refreshing it proactively when close to expiry)
 * and, if the server still answers 401, forces a refresh and retries once.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const sentToken = await getValidAccessToken();
  const headers = new Headers(init.headers);
  if (sentToken) headers.set('Authorization', `Bearer ${sentToken}`);
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = apiUrl(input);
  let response = await fetch(url, { ...init, headers });

  if (response.status === 401) {
    const newToken = await refreshOnce(true, sentToken);
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, { ...init, headers });
    } else {
      redirectToLoginIfSessionEnded();
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
