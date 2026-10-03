import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiJson, clearTokens, getAccessToken, storeTokens, type AuthResponse, type UserDto } from '../../services/apiClient';
import { clearAcceptedTerms, getAcceptedTermsVersion } from './termsAcceptance';

type AuthContextValue = {
  user: UserDto | null;
  isLoading: boolean;
  loginWithGoogle: () => void;
  completeGoogleLogin: (code: string, redirectUri: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const USER_STORAGE_KEY = 'notesapp.user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as UserDto) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_STORAGE_KEY);
  }, [user]);

  // Verifies the session on load if we already have an access token.
  useEffect(() => {
    if (getAccessToken() && !user) {
      apiJson<UserDto>('/api/users/me').then(setUser).catch(() => clearTokens());
    }
  }, [user]);

  /** Redirects the browser to Google's OAuth 2.0 consent screen (Authorization Code Flow). */
  const loginWithGoogle = useCallback(() => {
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }, []);

  /** Called by the /auth/google/callback page once Google redirects back with a `code`. */
  const completeGoogleLogin = useCallback(async (code: string, redirectUri: string) => {
    setIsLoading(true);
    try {
      const result = await apiJson<AuthResponse>('/api/auth/google/callback', {
        method: 'POST',
        // The server rejects the login unless the current Terms version was explicitly accepted.
        body: JSON.stringify({ code, redirectUri, termsVersion: getAcceptedTermsVersion() }),
      });
      clearAcceptedTerms();
      storeTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('notesapp.refreshToken');
    if (refreshToken) {
      await apiJson('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
    }
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, loginWithGoogle, completeGoogleLogin, logout }),
    [user, isLoading, loginWithGoogle, completeGoogleLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
