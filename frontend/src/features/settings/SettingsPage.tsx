import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/I18nProvider';
import type { Language } from '../../i18n/translations';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useI18n();

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-4 sm:p-8">
      <h2 className="mb-6 text-xl font-semibold text-neutral-900">{t('settings.title')}</h2>

      <section className="mb-6 rounded-lg border border-border-subtle bg-bg-elevated p-4 sm:mb-8">
        <h3 className="mb-3 text-sm font-medium text-neutral-700">{t('settings.profile')}</h3>
        <div className="flex items-center gap-3">
          {user?.avatarUrl && <img src={user.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full" />}
          <div className="min-w-0">
            <p className="truncate text-sm text-neutral-900">{user?.displayName}</p>
            <p className="truncate text-xs text-neutral-500">{user?.email}</p>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-border-subtle bg-bg-elevated p-4 sm:mb-8">
        <h3 className="mb-3 text-sm font-medium text-neutral-700">{t('settings.language')}</h3>
        <select
          className="touch-target w-full rounded border border-border-subtle bg-bg-base px-2 py-1 text-sm sm:w-auto"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </section>

      <button
        type="button"
        onClick={logout}
        className="touch-target w-full rounded border border-red-500/40 px-4 py-2 text-sm text-red-600 hover:bg-red-500/10 sm:w-auto"
      >
        {t('auth.logout')}
      </button>
    </div>
  );
}
