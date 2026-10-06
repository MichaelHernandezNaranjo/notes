import { BrandLogo } from '../components/BrandLogo';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { CONTACT_EMAIL, getLegalDocument, type LegalKind } from '../legal/legalTexts';

/**
 * Public, crawlable page for the Terms or the Privacy Policy (`/terms`, `/privacy`).
 * No sign-in required: Google's OAuth verification and users must be able to open these URLs directly.
 */
export function LegalPage({ kind }: { kind: LegalKind }) {
  const { language, setLanguage, t } = useI18n();
  const doc = getLegalDocument(kind, language);

  useEffect(() => {
    const previous = document.title;
    document.title = `${doc.title} · Notes`;
    return () => {
      document.title = previous;
    };
  }, [doc.title]);

  const other: LegalKind = kind === 'terms' ? 'privacy' : 'terms';

  return (
    <div className="min-h-dvh bg-bg-elevated">
      <header className="border-b border-border-subtle bg-bg-base">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/login" className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <BrandLogo className="h-7 w-7" />
            Notes
          </Link>
          <button
            type="button"
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="rounded-md border border-border-subtle px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-black/5"
            aria-label={language === 'es' ? 'Switch to English' : 'Cambiar a español'}
          >
            {language === 'es' ? 'EN' : 'ES'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <article className="rounded-xl border border-border-subtle bg-bg-base p-5 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{doc.title}</h1>
          <p className="mt-1 text-xs text-neutral-500">{doc.updated}</p>
          <p className="mt-4 text-sm leading-relaxed text-neutral-700">{doc.intro}</p>

          <div className="mt-6 space-y-6">
            {doc.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="mb-1.5 text-base font-semibold text-neutral-900">{section.heading}</h2>
                <div className="space-y-2 text-sm leading-relaxed text-neutral-700">
                  {section.paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>

        <nav className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link to={`/${other}`} className="text-accent-blue underline">
            {t(`legal.${other}`)}
          </Link>
          <Link to="/login" className="text-accent-blue underline">
            {t('legal.backToApp')}
          </Link>
        </nav>
        <p className="mt-4 text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} d4nthi ·{' '}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </main>
    </div>
  );
}
