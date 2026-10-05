import { useI18n } from '../../i18n/I18nProvider';
import type { Severity } from '../../services/adminApi';
import { usePresence } from './PresenceProvider';

const STYLES: Record<Severity, { box: string; button: string; icon: string }> = {
  Info: { box: 'border-blue-200 bg-blue-50 text-blue-900', button: 'hover:bg-blue-100', icon: 'ℹ️' },
  Warning: { box: 'border-amber-300 bg-amber-50 text-amber-900', button: 'hover:bg-amber-100', icon: '⚠️' },
  Critical: { box: 'border-red-300 bg-red-50 text-red-900', button: 'hover:bg-red-100', icon: '🚨' },
};

const ORDER: Record<Severity, number> = { Critical: 0, Warning: 1, Info: 2 };
const MAX_VISIBLE = 3;

/** Announcements from the administrators, shown on top of the app until the user dismisses them. */
export function AnnouncementBanner() {
  const { t } = useI18n();
  const { announcements, dismiss } = usePresence();
  if (announcements.length === 0) return null;

  const sorted = [...announcements].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const visible = sorted.slice(0, MAX_VISIBLE);
  const hidden = sorted.length - visible.length;

  return (
    <div className="shrink-0" role="region" aria-label={t('announcements.region')}>
      {visible.map((a) => {
        const s = STYLES[a.severity] ?? STYLES.Info;
        return (
          <div
            key={a.id}
            role={a.severity === 'Info' ? 'status' : 'alert'}
            className={`flex items-start gap-3 border-b px-3 py-2 text-sm sm:px-4 ${s.box}`}
          >
            <span aria-hidden="true" className="mt-0.5">
              {s.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{a.title}</p>
              <p className="whitespace-pre-line break-words">{a.message}</p>
            </div>
            <button
              type="button"
              onClick={() => void dismiss(a.id)}
              className={`touch-target shrink-0 rounded px-2 py-1 text-xs font-medium underline ${s.button}`}
            >
              {t('announcements.dismiss')}
            </button>
          </div>
        );
      })}
      {hidden > 0 && (
        <p className="border-b border-border-subtle bg-bg-elevated px-4 py-1 text-xs text-neutral-600">
          {t('announcements.more').replace('{count}', String(hidden))}
        </p>
      )}
    </div>
  );
}
