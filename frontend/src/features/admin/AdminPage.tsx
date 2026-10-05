import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { adminApi, type AdminUser } from '../../services/adminApi';
import { AnnouncementsTab } from './AnnouncementsTab';
import { OverviewTab } from './OverviewTab';
import { UsersTab } from './UsersTab';

type Tab = 'overview' | 'users' | 'announcements';
const TABS: Tab[] = ['overview', 'users', 'announcements'];
const DEFAULT_QUOTA = 250 * 1024 * 1024;

/** Super admin panel: metrics, users (limits, blocking, roles) and announcements. Shows metadata only, never note content. */
export function AdminPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('overview');
  const [defaultQuota, setDefaultQuota] = useState(DEFAULT_QUOTA);
  const [noticeTarget, setNoticeTarget] = useState<AdminUser | null>(null);

  useEffect(() => {
    adminApi
      .overview()
      .then((o) => setDefaultQuota(o.stats.defaultQuotaBytes))
      .catch(() => undefined);
  }, []);

  const consumePrefill = useCallback(() => setNoticeTarget(null), []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-4 sm:p-8">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">{t('admin.title')}</h1>
        <p className="mb-5 text-sm text-neutral-600">{t('admin.subtitle')}</p>

        <div role="tablist" aria-label={t('admin.title')} className="mb-6 flex gap-1 overflow-x-auto border-b border-border-subtle">
          {TABS.map((id) => (
            <button
              key={id}
              role="tab"
              type="button"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              className={`touch-target -mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${
                tab === id ? 'border-accent-blue text-accent-blue' : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {t(`admin.tabs.${id}`)}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'overview' && <OverviewTab />}
          {tab === 'users' && (
            <UsersTab
              defaultQuotaBytes={defaultQuota}
              onSendNotice={(u) => {
                setNoticeTarget(u);
                setTab('announcements');
              }}
            />
          )}
          {tab === 'announcements' && <AnnouncementsTab prefillTarget={noticeTarget} onPrefillConsumed={consumePrefill} />}
        </div>
      </div>
    </div>
  );
}
