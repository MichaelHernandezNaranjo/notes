import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AboutModal } from '../components/AboutModal';
import { useAuth } from '../features/auth/AuthContext';
import { AnnouncementBanner } from '../features/presence/AnnouncementBanner';
import { PresenceProvider } from '../features/presence/PresenceProvider';
import { ExplorerProvider } from '../features/tree-explorer/ExplorerProvider';
import { useI18n } from '../i18n/I18nProvider';

const baseItems = [
  { to: '/notes', labelKey: 'nav.explorer', icon: '🗂️' },
  { to: '/settings', labelKey: 'nav.settings', icon: '⚙️' },
];
// The Groups module is intentionally hidden for now (route and menu entry removed; code and API are kept).
const adminItem = { to: '/admin', labelKey: 'nav.admin', icon: '🛡️' };

const railItem =
  'flex h-10 w-10 items-center justify-center rounded text-base hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent-blue';

/**
 * App shell. Desktop (md+): always-collapsed icon rail on the left.
 * Mobile: a bottom tab bar (hidden while a note is open to give the editor the full height).
 * It also keeps the presence connection open and shows administrator announcements.
 */
export function AppLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [aboutOpen, setAboutOpen] = useState(false);
  const { pathname } = useLocation();
  const inEditor = /^\/notes\/[^/]+/.test(pathname);
  const navItems = user?.isSuperAdmin ? [...baseItems, adminItem] : baseItems;

  return (
    <PresenceProvider key={user?.id ?? 'anonymous'}>
      <div className="flex h-dvh w-screen flex-col bg-bg-base text-neutral-900 md:flex-row">
        {/* Desktop rail */}
        <nav className="hidden w-14 shrink-0 flex-col border-r border-border-subtle bg-bg-elevated md:flex">
          <div
            className="flex items-center justify-center py-4"
            title={t('app.name')}
            role="img"
            aria-label={t('app.name')}
          >
            <span className="h-6 w-6 shrink-0 rounded bg-gradient-to-br from-accent-emerald via-accent-blue to-accent-purple" />
          </div>
          <div className="flex flex-1 flex-col items-center gap-1 px-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={t(item.labelKey)}
                aria-label={t(item.labelKey)}
                className={({ isActive }) =>
                  `${railItem} ${isActive ? 'bg-accent-blue/10 text-accent-blue' : 'text-neutral-700'}`
                }
              >
                <span aria-hidden="true">{item.icon}</span>
              </NavLink>
            ))}
          </div>
          <div className="flex flex-col items-center px-2 pb-3">
            <button
              type="button"
              title={t('nav.about')}
              aria-label={t('nav.about')}
              aria-haspopup="dialog"
              onClick={() => setAboutOpen(true)}
              className={`${railItem} text-neutral-700`}
            >
              <span aria-hidden="true">ℹ️</span>
            </button>
          </div>
        </nav>

        {/* Keyed by user: the cached explorer state survives module changes but never leaks to another account. */}
        <ExplorerProvider key={user?.id ?? 'anonymous'}>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <AnnouncementBanner />
            <div className="min-h-0 flex-1 overflow-hidden">
              <Outlet />
            </div>
          </div>
        </ExplorerProvider>

        {/* Mobile bottom tab bar */}
        {!inEditor && (
          <nav
            aria-label={t('app.name')}
            className="flex shrink-0 items-stretch justify-around border-t border-border-subtle bg-bg-elevated pb-[env(safe-area-inset-bottom)] md:hidden"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                    isActive ? 'text-accent-blue' : 'text-neutral-600'
                  }`
                }
              >
                <span className="text-lg" aria-hidden="true">
                  {item.icon}
                </span>
                {t(item.labelKey)}
              </NavLink>
            ))}
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setAboutOpen(true)}
              className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-neutral-600"
            >
              <span className="text-lg" aria-hidden="true">
                ℹ️
              </span>
              {t('nav.about')}
            </button>
          </nav>
        )}

        {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      </div>
    </PresenceProvider>
  );
}
