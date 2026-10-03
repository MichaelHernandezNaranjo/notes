import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { AboutModal } from '../components/AboutModal';
import { useAuth } from '../features/auth/AuthContext';
import { ExplorerProvider } from '../features/tree-explorer/ExplorerProvider';
import { useI18n } from '../i18n/I18nProvider';

// The Groups module is intentionally hidden for now (route and menu entry removed; code and API are kept).
const navItems = [
  { to: '/notes', labelKey: 'nav.explorer', icon: '🗂️' },
  { to: '/settings', labelKey: 'nav.settings', icon: '⚙️' },
];

const railItem =
  'flex h-10 w-10 items-center justify-center rounded text-base hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent-blue';

/** App shell with an always-collapsed icon rail; labels are exposed as tooltips and aria-labels. */
export function AppLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen bg-bg-base text-neutral-900">
      <nav className="flex w-14 shrink-0 flex-col border-r border-border-subtle bg-bg-elevated">
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
        <div className="min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </ExplorerProvider>

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
  );
}
