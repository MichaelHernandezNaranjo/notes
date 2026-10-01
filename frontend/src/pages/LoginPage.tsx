import { useI18n } from '../i18n/I18nProvider';
import { GoogleLoginButton } from '../features/auth/GoogleLoginButton';

export function LoginPage() {
  const { t } = useI18n();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-bg-base px-4">
      <div className="flex flex-col items-center gap-2">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-accent-emerald via-accent-blue to-accent-purple" />
        <h1 className="text-2xl font-semibold text-neutral-900">{t('app.name')}</h1>
        <p className="text-sm text-neutral-600">Notas y archivos colaborativos en tiempo real</p>
      </div>
      <GoogleLoginButton />
    </div>
  );
}
