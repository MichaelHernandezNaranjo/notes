import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from './AuthContext';

/** Button that kicks off the Google OAuth 2.0 Authorization Code Flow. */
export function GoogleLoginButton({
  blocked = false,
  onBlocked,
  onBeforeLogin,
}: {
  /** When true the button looks disabled and, instead of signing in, calls `onBlocked` (so we can explain why). */
  blocked?: boolean;
  onBlocked?: () => void;
  /** Runs right before redirecting to Google (e.g. to record the accepted terms version). */
  onBeforeLogin?: () => void;
}) {
  const { loginWithGoogle } = useAuth();
  const { t } = useI18n();

  return (
    <button
      type="button"
      aria-disabled={blocked}
      onClick={() => {
        if (blocked) {
          onBlocked?.();
          return;
        }
        onBeforeLogin?.();
        loginWithGoogle();
      }}
      className={`flex w-full items-center justify-center gap-3 rounded-lg border border-border-subtle bg-bg-base px-5 py-3 text-sm font-medium text-neutral-900 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue ${
        blocked
          ? 'cursor-not-allowed opacity-50'
          : 'hover:border-accent-blue hover:shadow-[0_0_0_1px_var(--color-accent-blue)]'
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
        />
      </svg>
      {t('auth.loginWithGoogle')}
    </button>
  );
}
