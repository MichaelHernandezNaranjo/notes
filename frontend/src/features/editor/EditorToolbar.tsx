import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { PresenceAvatars } from './PresenceAvatars';
import type { PresenceUser } from './YjsSignalRProvider';

export type EditorToolbarProps = {
  title: string;
  saveState: 'saved' | 'saving';
  presence: PresenceUser[];
  onShare: () => void;
  onBack?: () => void;
  shareDisabled?: boolean;
  /** False for non-owners: the Share button is not shown. */
  canShare?: boolean;
  /** Shows the "Read-only" badge. */
  readOnly?: boolean;
  onExportPdf: () => void;
  onExportPng: () => void;
  onExportJpg: () => void;
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ShareIcon = () => (
  <Icon>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </Icon>
);

const DownloadIcon = () => (
  <Icon>
    <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
  </Icon>
);

const ChevronIcon = () => (
  <Icon>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue';

export function EditorToolbar({
  title,
  saveState,
  presence,
  onShare,
  onBack,
  shareDisabled = false,
  canShare = true,
  readOnly = false,
  onExportPdf,
  onExportPng,
  onExportJpg,
}: EditorToolbarProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const runExport = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  const saving = saveState === 'saving';

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-bg-elevated px-2 sm:gap-3 sm:px-4 md:px-4">
      <div className="flex min-w-0 items-center gap-1 sm:gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('common.back')}
            title={t('common.back')}
            className={`touch-target -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-neutral-700 hover:bg-black/5 md:hidden ${focusRing}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <h2 className="truncate text-base font-medium text-neutral-900">{title}</h2>
        {readOnly && (
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{t('sharing.readOnlyBadge')}</span>
        )}
        <span
          className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-600"
          role="status"
          aria-live="polite"
        >
          <span
            className={`h-2 w-2 rounded-full ${saving ? 'animate-pulse bg-amber-500' : 'bg-accent-emerald'}`}
          />
          <span className="hidden sm:inline">{saving ? t('editor.saving') : t('editor.saved')}</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden sm:block">
          <PresenceAvatars users={presence} />
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t('editor.export')}
            title={t('editor.export')}
            onClick={() => setMenuOpen((open) => !open)}
            className={`flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-base px-2.5 py-1.5 text-sm text-neutral-800 transition hover:bg-black/5 ${focusRing}`}
          >
            <DownloadIcon />
            <span className="hidden md:inline">{t('editor.export')}</span>
            <ChevronIcon />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-1 min-w-[180px] rounded-md border border-border-subtle bg-bg-base py-1 shadow-lg"
            >
              {[
                { label: t('editor.exportPdf'), action: onExportPdf },
                { label: t('editor.exportPng'), action: onExportPng },
                { label: t('editor.exportJpg'), action: onExportJpg },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => runExport(item.action)}
                  className="block w-full px-3 py-1.5 text-left text-sm text-neutral-800 hover:bg-black/5 focus-visible:bg-black/5 focus-visible:outline-none"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {canShare && (
          <button
            type="button"
            aria-label={t('editor.share')}
            title={t('editor.share')}
            onClick={onShare}
            disabled={shareDisabled}
            className={`flex items-center gap-1.5 rounded-md bg-accent-blue px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-blue-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent-blue ${focusRing}`}
          >
            <ShareIcon />
            <span className="hidden md:inline">{t('editor.share')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
