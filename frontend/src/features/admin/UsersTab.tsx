import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { adminApi, type AdminUser, type AdminUsersPage, type UserFilter, type UserSort } from '../../services/adminApi';
import { formatDateTime, timeAgo } from '../../utils/format';
import { AdminRoleDialog, BlockDialog, QuotaDialog } from './UserDialogs';
import { UsageBar } from './ui';

const PAGE_SIZE = 20;
const REFRESH_MS = 15_000;
const FILTERS: UserFilter[] = ['all', 'online', 'active', 'blocked', 'admins', 'over'];
const SORTS: UserSort[] = ['lastLogin', 'created', 'name', 'usage'];

type Dialog = { kind: 'quota' | 'block' | 'role'; user: AdminUser } | null;

function Badge({ children, tone }: { children: React.ReactNode; tone: 'blue' | 'red' | 'green' | 'purple' | 'gray' }) {
  const cls = {
    blue: 'bg-blue-100 text-blue-800',
    red: 'bg-red-100 text-red-800',
    green: 'bg-emerald-100 text-emerald-800',
    purple: 'bg-purple-100 text-purple-800',
    gray: 'bg-neutral-200 text-neutral-700',
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

function Avatar({ user }: { user: AdminUser }) {
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-700" aria-hidden="true">
      {user.displayName.charAt(0).toUpperCase()}
    </span>
  );
}

export function UsersTab({ defaultQuotaBytes, onSendNotice }: { defaultQuotaBytes: number; onSendNotice: (user: AdminUser) => void }) {
  const { t, language } = useI18n();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [sort, setSort] = useState<UserSort>('lastLogin');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUsersPage | null>(null);
  const [error, setError] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const result = await adminApi.users({ search: debounced, filter, sort, page, pageSize: PAGE_SIZE });
      if (id === requestId.current) {
        setData(result);
        setError(false);
      }
    } catch {
      if (id === requestId.current) setError(true);
    }
  }, [debounced, filter, sort, page]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const closeAndReload = () => {
    setDialog(null);
    void load();
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const actions = (u: AdminUser) => (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => setDialog({ kind: 'quota', user: u })} className="touch-target rounded border border-border-subtle px-2 py-1 text-xs hover:bg-black/5">
        {t('admin.limit')}
      </button>
      <button type="button" onClick={() => onSendNotice(u)} className="touch-target rounded border border-border-subtle px-2 py-1 text-xs hover:bg-black/5">
        {t('admin.sendNotice')}
      </button>
      <button
        type="button"
        disabled={u.isSelf || u.isRoot || !u.isActive}
        title={u.isSelf ? t('admin.err.cannot_change_self') : u.isRoot ? t('admin.err.root_admin') : undefined}
        onClick={() => setDialog({ kind: 'role', user: u })}
        className="touch-target rounded border border-border-subtle px-2 py-1 text-xs hover:bg-black/5 disabled:opacity-40"
      >
        {u.isSuperAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin')}
      </button>
      <button
        type="button"
        disabled={u.isActive && (u.isSelf || u.isRoot)}
        title={u.isSelf ? t('admin.err.cannot_block_self') : u.isRoot ? t('admin.err.cannot_block_root') : undefined}
        onClick={() => setDialog({ kind: 'block', user: u })}
        className={`touch-target rounded border px-2 py-1 text-xs disabled:opacity-40 ${u.isActive ? 'border-red-300 text-red-700 hover:bg-red-50' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}
      >
        {u.isActive ? t('admin.block') : t('admin.unblock')}
      </button>
    </div>
  );

  const badges = (u: AdminUser) => (
    <span className="flex flex-wrap gap-1">
      {u.isOnline && <Badge tone="green">{t('admin.online')}</Badge>}
      {u.isSuperAdmin && <Badge tone="purple">{u.isRoot ? t('admin.rootAdmin') : t('admin.admin')}</Badge>}
      {!u.isActive && <Badge tone="red">{t('admin.blockedBadge')}</Badge>}
      {u.effectiveQuotaBytes !== null && u.usedBytes > u.effectiveQuotaBytes && <Badge tone="red">{t('admin.overLimit')}</Badge>}
      {u.isSelf && <Badge tone="gray">{t('admin.you')}</Badge>}
    </span>
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.searchUsers')}
          aria-label={t('admin.searchUsers')}
          className="w-full rounded-md border border-border-subtle bg-bg-base px-3 py-1.5 text-sm sm:max-w-xs"
        />
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as UserFilter);
            setPage(1);
          }}
          aria-label={t('admin.filter')}
          className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-sm"
        >
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {t(`admin.filters.${f}`)}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as UserSort);
            setPage(1);
          }}
          aria-label={t('admin.sortBy')}
          className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`admin.sorts.${s}`)}
            </option>
          ))}
        </select>
        {data && (
          <span className="text-xs text-neutral-500 sm:ml-auto">
            {data.total} {t('admin.usersCount')}
          </span>
        )}
      </div>

      {error && !data && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {t('admin.loadError')}{' '}
          <button type="button" className="underline" onClick={() => void load()}>
            {t('editor.retry')}
          </button>
        </p>
      )}
      {!data && !error && <p className="text-sm text-neutral-500">{t('common.loading')}</p>}
      {data && data.items.length === 0 && <p className="rounded border border-border-subtle bg-bg-base p-4 text-sm text-neutral-500">{t('admin.noUsers')}</p>}

      {data && data.items.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border border-border-subtle bg-bg-base md:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-border-subtle bg-bg-elevated text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('admin.user')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin.lastAccess')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin.registered')}</th>
                  <th className="w-48 px-3 py-2 font-medium">{t('admin.space')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin.actionsCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.items.map((u) => (
                  <tr key={u.id} className={u.isActive ? '' : 'bg-red-50/40'}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-900">{u.displayName}</p>
                          <p className="truncate text-xs text-neutral-500">{u.email}</p>
                          <div className="mt-0.5">{badges(u)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-700" title={formatDateTime(u.lastLoginAt, language)}>
                      <span className="block">{u.isOnline ? t('admin.online') : timeAgo(u.lastSeenAt ?? u.lastLoginAt, language)}</span>
                      <span className="text-neutral-500">
                        {t('admin.lastLogin')}: {timeAgo(u.lastLoginAt, language)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-700">{formatDateTime(u.createdAt, language)}</td>
                    <td className="px-3 py-2">
                      <UsageBar used={u.usedBytes} quota={u.effectiveQuotaBytes} unlimitedLabel={t('storage.unlimited')} />
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        {u.noteCount} {t('admin.notes').toLowerCase()}
                        {u.storageQuotaBytes !== null && ` · ${t('admin.customLimitShort')}`}
                      </p>
                    </td>
                    <td className="px-3 py-2">{actions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {data.items.map((u) => (
              <li key={u.id} className={`rounded-lg border border-border-subtle p-3 ${u.isActive ? 'bg-bg-base' : 'bg-red-50/60'}`}>
                <div className="flex items-start gap-3">
                  <Avatar user={u} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">{u.displayName}</p>
                    <p className="truncate text-xs text-neutral-500">{u.email}</p>
                    <div className="mt-1">{badges(u)}</div>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-700">
                  <div>
                    <dt className="text-neutral-500">{t('admin.lastAccess')}</dt>
                    <dd>{u.isOnline ? t('admin.online') : timeAgo(u.lastSeenAt ?? u.lastLoginAt, language)}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">{t('admin.registered')}</dt>
                    <dd>{formatDateTime(u.createdAt, language)}</dd>
                  </div>
                </dl>
                <UsageBar className="mt-3" used={u.usedBytes} quota={u.effectiveQuotaBytes} unlimitedLabel={t('storage.unlimited')} />
                <div className="mt-3">{actions(u)}</div>
              </li>
            ))}
          </ul>

          <nav className="mt-4 flex items-center justify-between text-sm" aria-label={t('admin.pagination')}>
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="touch-target rounded border border-border-subtle px-3 py-1 hover:bg-black/5 disabled:opacity-40">
              ‹ {t('admin.prev')}
            </button>
            <span className="text-xs text-neutral-600">
              {page} / {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="touch-target rounded border border-border-subtle px-3 py-1 hover:bg-black/5 disabled:opacity-40">
              {t('admin.next')} ›
            </button>
          </nav>
        </>
      )}

      {dialog?.kind === 'quota' && <QuotaDialog user={dialog.user} defaultQuotaBytes={defaultQuotaBytes} onClose={() => setDialog(null)} onDone={closeAndReload} />}
      {dialog?.kind === 'block' && <BlockDialog user={dialog.user} onClose={() => setDialog(null)} onDone={closeAndReload} />}
      {dialog?.kind === 'role' && <AdminRoleDialog user={dialog.user} onClose={() => setDialog(null)} onDone={closeAndReload} />}
    </div>
  );
}
