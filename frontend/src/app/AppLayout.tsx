import { NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';

const navItems = [
  { to: '/notes', labelKey: 'nav.explorer', icon: '🗂️' },
  { to: '/groups', labelKey: 'nav.groups', icon: '👥' },
  { to: '/settings', labelKey: 'nav.settings', icon: '⚙️' },
  { to: '/about', labelKey: 'nav.about', icon: 'ℹ️' },
];

export function AppLayout() {
  const { t } = useI18n();
  const { sidebarCollapsed, toggleSidebar } = useTheme();

  return (
    <div className="flex h-screen w-screen bg-bg-base text-neutral-900">
      <nav
        className={`flex flex-col border-r border-border-subtle bg-bg-elevated transition-all ${
          sidebarCollapsed ? 'w-14' : 'w-56'
        }`}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex items-center gap-2 px-3 py-4 text-left text-sm font-semibold text-neutral-900 hover:bg-black/5"
        >
          <span className="h-6 w-6 shrink-0 rounded bg-gradient-to-br from-accent-emerald via-accent-blue to-accent-purple" />
          {!sidebarCollapsed && <span>{t('app.name')}</span>}
        </button>
        <div className="flex flex-1 flex-col gap-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-black/5 ${
                  isActive ? 'bg-accent-blue/10 text-accent-blue' : 'text-neutral-700'
                }`
              }
            >
              <span>{item.icon}</span>
              {!sidebarCollapsed && <span>{t(item.labelKey)}</span>}
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
