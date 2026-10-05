import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { adminApi, type AdminOverview } from '../../services/adminApi';
import { formatBytes } from '../../utils/format';
import { BarChart, StatCard, UsageBar, usageTone } from './ui';

const REFRESH_MS = 20_000;

export function OverviewTab() {
  const { t, language } = useI18n();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await adminApi.overview());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800" role="alert">
        {t('admin.loadError')}{' '}
        <button type="button" className="underline" onClick={() => void load()}>
          {t('editor.retry')}
        </button>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-neutral-500">{t('common.loading')}</p>;

  const s = data.stats;
  const totalStored = s.textBytes + s.imageBytes;
  const dbTone = data.databaseBytes === null ? 'good' : usageTone(data.databaseBytes, data.databaseLimitBytes);
  const dayLabels = data.activity.map((d) => new Date(d.day).toLocaleDateString(language, { day: 'numeric', month: 'short' }));

  return (
    <div className="space-y-6">
      <section aria-label={t('admin.users')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('admin.totalUsers')} value={s.totalUsers} hint={`+${s.newUsers7d} ${t('admin.last7d')}`} />
        <StatCard label={t('admin.onlineNow')} value={data.online} tone={data.online > 0 ? 'good' : 'neutral'} />
        <StatCard label={t('admin.active7d')} value={s.active7d} hint={`${s.active30d} ${t('admin.last30d')}`} />
        <StatCard label={t('admin.blocked')} value={s.blockedUsers} tone={s.blockedUsers > 0 ? 'warn' : 'neutral'} hint={`${s.superAdmins} ${t('admin.admins')}`} />
      </section>

      <section aria-label={t('admin.content')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('admin.notes')} value={s.notes} hint={`${s.folders} ${t('admin.folders')}`} />
        <StatCard label={t('admin.trash')} value={s.trashedItems} />
        <StatCard label={t('admin.images')} value={s.images} hint={formatBytes(s.imageBytes)} />
        <StatCard label={t('admin.overQuota')} value={s.overQuotaUsers} tone={s.overQuotaUsers > 0 ? 'bad' : 'neutral'} hint={`${t('admin.defaultQuota')}: ${formatBytes(s.defaultQuotaBytes, 0)}`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label={t('admin.capacity')}>
        <div className="rounded-lg border border-border-subtle bg-bg-base p-4">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">{t('admin.capacity')}</h3>
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-600">{t('admin.database')}</p>
              {data.databaseBytes === null ? (
                <p className="text-xs text-neutral-500">{t('admin.notAvailable')}</p>
              ) : (
                <>
                  <UsageBar used={data.databaseBytes} quota={data.databaseLimitBytes} unlimitedLabel={t('storage.unlimited')} />
                  {dbTone !== 'good' && <p className="mt-1 text-xs text-amber-700">{t('admin.databaseWarning')}</p>}
                </>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-600">{t('admin.disk')}</p>
              {data.diskTotalBytes === null || data.diskFreeBytes === null ? (
                <p className="text-xs text-neutral-500">{t('admin.notAvailable')}</p>
              ) : (
                <UsageBar used={data.diskTotalBytes - data.diskFreeBytes} quota={data.diskTotalBytes} unlimitedLabel={t('storage.unlimited')} />
              )}
            </div>
            <p className="text-xs text-neutral-600">
              {t('admin.storedByUsers')}: <strong>{formatBytes(totalStored)}</strong> ({formatBytes(s.textBytes)} {t('admin.text')} · {formatBytes(s.imageBytes)} {t('admin.images').toLowerCase()})
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle bg-bg-base p-4">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">{t('admin.topUsers')}</h3>
          {data.topUsers.length === 0 ? (
            <p className="text-xs text-neutral-500">{t('tree.empty')}</p>
          ) : (
            <ol className="space-y-3">
              {data.topUsers.map((u) => (
                <li key={u.id}>
                  <p className="truncate text-sm text-neutral-900">
                    {u.displayName} <span className="text-xs text-neutral-500">{u.email}</span>
                  </p>
                  <UsageBar used={u.usedBytes} quota={u.quotaBytes} unlimitedLabel={t('storage.unlimited')} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3" aria-label={t('admin.activity')}>
        <div className="rounded-lg border border-border-subtle bg-bg-base p-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">{t('admin.signups')}</h3>
          <BarChart values={data.activity.map((d) => d.signups)} labels={dayLabels} color="#10b981" ariaLabel={t('admin.signups')} />
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-base p-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">{t('admin.actions')}</h3>
          <BarChart values={data.activity.map((d) => d.actions)} labels={dayLabels} color="#3b82f6" ariaLabel={t('admin.actions')} />
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-base p-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">{t('admin.activeUsers')}</h3>
          <BarChart values={data.activity.map((d) => d.activeUsers)} labels={dayLabels} color="#8b5cf6" ariaLabel={t('admin.activeUsers')} />
        </div>
      </section>
      <p className="text-xs text-neutral-500">{t('admin.privacyNote')}</p>
    </div>
  );
}
