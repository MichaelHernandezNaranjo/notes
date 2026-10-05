import { useState } from 'react';
import { LegalModal } from '../components/LegalModal';
import { GoogleLoginButton } from '../features/auth/GoogleLoginButton';
import { useI18n } from '../i18n/I18nProvider';
import { TERMS_VERSION, type LegalKind } from '../legal/legalTexts';
import { acceptTerms } from '../features/auth/termsAcceptance';

const POINTS = ['point1', 'point2', 'point3'] as const;

function LogoMark({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-accent-emerald via-accent-blue to-accent-purple shadow-sm ${className}`}
      aria-hidden="true"
    >
      <svg width="55%" height="55%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
    </div>
  );
}

export function LoginPage() {
  const { t, language, setLanguage } = useI18n();
  const [accepted, setAccepted] = useState(false);
  const [showError, setShowError] = useState(false);
  const [legal, setLegal] = useState<LegalKind | null>(null);

  /** Plain click keeps the user on the login (modal); ctrl/middle click or a crawler follows the real /terms|/privacy URL. */
  const openLegal = (e: React.MouseEvent, kind: LegalKind) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setLegal(kind);
  };

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Brand panel (large screens only) */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-accent-emerald via-accent-blue to-accent-purple p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-10 w-10 bg-white/20 from-transparent via-transparent to-transparent" />
          <span className="text-lg font-semibold tracking-tight">Notes</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">{t('login.brandTitle')}</h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-white/90">
                <svg className="mt-0.5 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {t(`login.${p}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/70">© {new Date().getFullYear()} d4nthi</p>
      </aside>

      {/* Sign-in panel */}
      <main className="relative flex flex-col items-center justify-center bg-bg-base px-6 py-12">
        <button
          type="button"
          onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
          className="absolute right-4 top-4 rounded-md border border-border-subtle px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent-blue"
          aria-label={language === 'es' ? 'Switch to English' : 'Cambiar a español'}
        >
          {language === 'es' ? 'EN' : 'ES'}
        </button>

        <div className="w-full max-w-sm">
          <LogoMark className="mb-6 h-14 w-14 lg:hidden" />
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{t('app.name')}</h1>
          <p className="mt-1 text-sm text-neutral-600">{t('login.subtitle')}</p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-700">{t('login.about')}</p>

          <div className="mt-8 rounded-2xl border border-border-subtle bg-bg-elevated p-6 shadow-sm">
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-neutral-700">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => {
                  setAccepted(e.target.checked);
                  if (e.target.checked) setShowError(false);
                }}
                aria-describedby="terms-error"
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-accent-blue"
              />
              <span>
                {t('login.accept')}{' '}
                <a href="/terms" onClick={(e) => openLegal(e, 'terms')} className="text-accent-blue underline">
                  {t('legal.terms')}
                </a>{' '}
                {t('login.and')}{' '}
                <a href="/privacy" onClick={(e) => openLegal(e, 'privacy')} className="text-accent-blue underline">
                  {t('legal.privacy')}
                </a>
                .
              </span>
            </label>

            <p id="terms-error" role="alert" className={`mt-2 min-h-4 text-xs text-red-600 ${showError ? '' : 'invisible'}`}>
              {t('login.required')}
            </p>

            <div className="mt-3">
              {/* Blocked until the terms are ticked; the accepted version is stored so the server can record it. */}
              <GoogleLoginButton
                blocked={!accepted}
                onBlocked={() => setShowError(true)}
                onBeforeLogin={() => acceptTerms(TERMS_VERSION)}
              />
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-neutral-500">{t('login.secure')}</p>
          <p className="mt-3 text-center text-xs text-neutral-500">
            <a href="/terms" className="underline hover:text-neutral-700">
              {t('legal.terms')}
            </a>
            {' · '}
            <a href="/privacy" className="underline hover:text-neutral-700">
              {t('legal.privacy')}
            </a>
          </p>
        </div>
      </main>

      {legal && <LegalModal kind={legal} onClose={() => setLegal(null)} />}
    </div>
  );
}
