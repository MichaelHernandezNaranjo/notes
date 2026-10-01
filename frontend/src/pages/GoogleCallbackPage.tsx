import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

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
      .then(() => navigate('/', { replace: true }))
      .catch(() => navigate('/login', { replace: true }));
  }, [completeGoogleLogin, navigate]);

  return (
    <div className="flex h-full items-center justify-center text-sm text-neutral-600">
      Iniciando sesión...
    </div>
  );
}
