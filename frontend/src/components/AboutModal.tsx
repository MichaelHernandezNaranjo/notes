import { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { CONTACT_EMAIL } from '../legal/legalTexts';
import { LegalModal } from './LegalModal';
import { Modal } from './Modal';
import type { LegalKind } from '../legal/legalTexts';

declare const __APP_VERSION__: string;

const FEATURES: Array<{ icon: string; key: string }> = [
  { icon: '👥', key: 'realtime' },
  { icon: '🗂️', key: 'organize' },
  { icon: '🔐', key: 'sharing' },
  { icon: '🖼️', key: 'images' },
  { icon: '🗑️', key: 'trash' },
  { icon: '📤', key: 'export' },
];

const STACK = ['React', 'TypeScript', 'TailwindCSS', 'BlockNote', 'Yjs', '.NET 10', 'SignalR', 'SQL Server'];

/** "About" dialog: what the product does, how it is built, version, contact and legal links. */
export function AboutModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [legal, setLegal] = useState<LegalKind | null>(null);

  if (legal) return <LegalModal kind={legal} onClose={() => setLegal(null)} />;

  return (
    <Modal title={t('about.title')} onClose={onClose} size="lg">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-accent-emerald via-accent-blue to-accent-purple shadow-sm" />
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-neutral-900">Notes</h3>
          <p className="text-sm text-neutral-600">{t('about.tagline')}</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full border border-border-subtle bg-bg-elevated px-2.5 py-0.5 text-xs font-medium text-neutral-700">
          v{__APP_VERSION__}
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-neutral-700">{t('about.description')}</p>

      <h4 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t('about.features')}</h4>
      <ul className="grid gap-2 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <li key={f.key} className="flex gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3">
            <span className="text-lg" aria-hidden="true">
              {f.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-900">{t(`about.f.${f.key}.title`)}</p>
              <p className="text-xs leading-relaxed text-neutral-600">{t(`about.f.${f.key}.text`)}</p>
            </div>
          </li>
        ))}
      </ul>

      <h4 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t('about.stack')}</h4>
      <ul className="flex flex-wrap gap-1.5">
        {STACK.map((s) => (
          <li key={s} className="rounded-md border border-border-subtle bg-bg-elevated px-2 py-0.5 text-xs text-neutral-700">
            {s}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4 text-xs text-neutral-600">
        <div>
          <p>© {new Date().getFullYear()} d4nthi. {t('about.rights')}</p>
          <p>
            {t('about.contact')}:{' '}
            <a className="text-accent-blue underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={() => setLegal('terms')} className="text-accent-blue underline">
            {t('legal.terms')}
          </button>
          <button type="button" onClick={() => setLegal('privacy')} className="text-accent-blue underline">
            {t('legal.privacy')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
