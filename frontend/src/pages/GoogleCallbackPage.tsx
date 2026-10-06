import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { apiErrorCode } from '../services/adminApi';
import { consumeReturnTo } from '../features/auth/returnTo';

/** Handles the redirect back from Google (?code=...) and exchanges it via the backend. */
export function GoogleCallbackPage() {
  const { completeGoogleLogin } = useAuth();
  const navigate = useNavigate();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) {
      navigate('/login', { replace: true });
      return;
    }

    const redirectUri = `${window.location.origin}/auth/google/callback`;
    completeGoogleLogin(code, redirectUri)
      .then(() => navigate(consumeReturnTo() ?? '/', { replace: true }))
      .catch((error) => {
        // Tell the login screen why it failed instead of silently coming back to it.
        const reason = apiErrorCode(error);
        const query = reason === 'account_blocked' ? '?error=blocked' : reason === 'terms_not_accepted' ? '?error=terms' : '?error=failed';
        navigate(`/login${query}`, { replace: true });
      });
  }, [completeGoogleLogin, navigate]);

  return (
    <div className="flex h-full items-center justify-center text-sm text-neutral-600">
      Iniciando sesión...
    </div>
  );
}
