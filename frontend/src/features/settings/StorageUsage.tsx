import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { accountApi, type StorageUsage as Usage } from '../../services/adminApi';
import { UsageBar, usageTone } from '../admin/ui';

/** Shows how much space the user is using and warns at 80 % and 100 % of their limit. */
export function StorageUsage() {
  const { t } = useI18n();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    accountApi
      .storage()
      .then((u) => !cancelled && setUsage(u))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-xs text-red-700">{t('storage.loadError')}</p>;
  if (!usage) return <p className="text-xs text-neutral-500">{t('common.loading')}</p>;

  const tone = usageTone(usage.usedBytes, usage.quotaBytes);
  return (
    <div>
      <UsageBar used={usage.usedBytes} quota={usage.quotaBytes} unlimitedLabel={t('storage.unlimited')} />
      {tone === 'bad' && (
        <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          {t('storage.full')}
        </p>
      )}
      {tone === 'warn' && (
        <p role="status" className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {t('storage.almostFull')}
        </p>
      )}
      <p className="mt-2 text-xs text-neutral-500">{t('storage.note')}</p>
    </div>
  );
}
