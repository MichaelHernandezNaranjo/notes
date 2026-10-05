import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { adminApi, apiErrorCode, type AdminAnnouncement, type AdminUser, type Severity } from '../../services/adminApi';
import { formatDateTime } from '../../utils/format';

const SEVERITIES: Severity[] = ['Info', 'Warning', 'Critical'];
const TONE: Record<Severity, string> = {
  Info: 'bg-blue-100 text-blue-800',
  Warning: 'bg-amber-100 text-amber-800',
  Critical: 'bg-red-100 text-red-800',
};

/** `<input type="datetime-local">` value (local time) -> ISO string in UTC, or null. */
function localToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type Target = { id: string; name: string } | null;

export function AnnouncementsTab({ prefillTarget, onPrefillConsumed }: { prefillTarget: AdminUser | null; onPrefillConsumed: () => void }) {
  const { t, language } = useI18n();
  const [items, setItems] = useState<AdminAnnouncement[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<Severity>('Info');
  const [expires, setExpires] = useState('');
  const [audience, setAudience] = useState<'all' | 'user'>('all');
  const [target, setTarget] = useState<Target>(null);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [toDelete, setToDelete] = useState<AdminAnnouncement | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await adminApi.announcements());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // "Send notice" from the users list pre-fills the recipient.
  useEffect(() => {
    if (prefillTarget) {
      setEditing(null);
      setAudience('user');
      setTarget({ id: prefillTarget.id, name: prefillTarget.displayName });
      onPrefillConsumed();
    }
  }, [prefillTarget, onPrefillConsumed]);

  // Recipient search (debounced).
  useEffect(() => {
    if (audience !== 'user' || target || userQuery.trim().length < 2) {
      setUserResults([]);
      return;
    }
    const timer = setTimeout(() => {
      adminApi
        .users({ search: userQuery, filter: 'active', sort: 'name', page: 1, pageSize: 6 })
        .then((r) => setUserResults(r.items))
        .catch(() => setUserResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [userQuery, audience, target]);

  const reset = () => {
    setEditing(null);
    setTitle('');
    setMessage('');
    setSeverity('Info');
    setExpires('');
    setAudience('all');
    setTarget(null);
    setUserQuery('');
    setError(null);
  };

  const startEdit = (a: AdminAnnouncement) => {
    setEditing(a);
    setTitle(a.title);
    setMessage(a.message);
    setSeverity(a.severity);
    setExpires('');
    setAudience(a.targetUserId ? 'user' : 'all');
    setTarget(a.targetUserId ? { id: a.targetUserId, name: a.targetName ?? '' } : null);
    setError(null);
    setSent(false);
  };

  const canSubmit = title.trim().length > 0 && message.trim().length > 0 && (editing || audience === 'all' || target !== null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const input = { title: title.trim(), message: message.trim(), severity, expiresAt: localToIso(expires), targetUserId: audience === 'user' ? target?.id : null };
      if (editing) await adminApi.updateAnnouncement(editing.id, input);
      else await adminApi.createAnnouncement(input);
      reset();
      setSent(true);
      await load();
    } catch (e) {
      const code = apiErrorCode(e);
      const key = code ? `admin.err.${code}` : '';
      setError(key && t(key) !== key ? t(key) : t('admin.err.generic'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    await adminApi.deleteAnnouncement(toDelete.id).catch(() => undefined);
    if (editing?.id === toDelete.id) reset();
    setToDelete(null);
    await load();
  };

  const input = 'w-full rounded border border-border-subtle bg-bg-base px-2 py-1.5 text-sm';

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form
        className="space-y-3 rounded-lg border border-border-subtle bg-bg-base p-4 lg:col-span-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void submit();
        }}
      >
        <h3 className="text-sm font-semibold text-neutral-900">{editing ? t('admin.editNotice') : t('admin.newNotice')}</h3>

        {!editing && (
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-neutral-600">{t('admin.audience')}</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" name="aud" checked={audience === 'all'} onChange={() => { setAudience('all'); setTarget(null); }} className="accent-accent-blue" />
                {t('admin.everyone')}
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="aud" checked={audience === 'user'} onChange={() => setAudience('user')} className="accent-accent-blue" />
                {t('admin.oneUser')}
              </label>
            </div>
            {audience === 'user' &&
              (target ? (
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{target.name}</span>
                  <button type="button" className="text-xs underline" onClick={() => setTarget(null)}>
                    {t('admin.change')}
                  </button>
                </p>
              ) : (
                <div className="relative mt-2">
                  <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder={t('admin.searchUsers')} aria-label={t('admin.searchUsers')} className={input} />
                  {userResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-border-subtle bg-bg-base shadow-lg">
                      {userResults.map((u) => (
                        <li key={u.id}>
                          <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5" onClick={() => { setTarget({ id: u.id, name: u.displayName }); setUserQuery(''); }}>
                            {u.displayName} <span className="text-xs text-neutral-500">{u.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
          </fieldset>
        )}
        {editing && <p className="text-xs text-neutral-500">{t('admin.audience')}: {editing.targetName ?? t('admin.everyone')}</p>}

        <div>
          <label className="text-xs font-medium text-neutral-600" htmlFor="n-title">{t('admin.noticeTitle')}</label>
          <input id="n-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className={input} />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-600" htmlFor="n-msg">{t('admin.noticeMessage')}</label>
          <textarea id="n-msg" value={message} maxLength={2000} rows={4} onChange={(e) => setMessage(e.target.value)} className={input} />
          <p className="text-right text-[11px] text-neutral-400">{message.length}/2000</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-neutral-600" htmlFor="n-sev">{t('admin.severity')}</label>
            <select id="n-sev" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className={input}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{t(`admin.severities.${s}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600" htmlFor="n-exp">{t('admin.expires')}</label>
            <input id="n-exp" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} className={input} />
          </div>
        </div>
        {editing && <p className="text-xs text-amber-700">{t('admin.editShowsAgain')}</p>}

        {error && <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {sent && !error && <p role="status" className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{t('admin.noticeSent')}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={!canSubmit || busy} className="touch-target rounded-md bg-accent-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-blue-dark disabled:opacity-50">
            {busy ? t('common.loading') : editing ? t('common.save') : t('admin.send')}
          </button>
          {(editing || title || message) && (
            <button type="button" onClick={() => { reset(); setSent(false); }} className="touch-target rounded-md border border-border-subtle px-4 py-1.5 text-sm hover:bg-black/5">
              {t('common.cancel')}
            </button>
          )}
        </div>
      </form>

      <div className="lg:col-span-3">
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">{t('admin.sentNotices')}</h3>
        {loadError && <p role="alert" className="text-sm text-red-700">{t('admin.loadError')}</p>}
        {items && items.length === 0 && <p className="rounded border border-border-subtle bg-bg-base p-4 text-sm text-neutral-500">{t('admin.noNotices')}</p>}
        <ul className="space-y-3">
          {items?.map((a) => {
            const expired = a.expiresAt !== null && new Date(/[zZ]$/.test(a.expiresAt) ? a.expiresAt : `${a.expiresAt}Z`) < new Date();
            return (
              <li key={a.id} className={`rounded-lg border border-border-subtle bg-bg-base p-3 ${expired ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[a.severity]}`}>{t(`admin.severities.${a.severity}`)}</span>
                  <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] text-neutral-700">{a.targetName ?? t('admin.everyone')}</span>
                  {expired && <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] text-neutral-700">{t('admin.expired')}</span>}
                </div>
                <p className="mt-1 font-medium text-neutral-900">{a.title}</p>
                <p className="whitespace-pre-line break-words text-sm text-neutral-700">{a.message}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatDateTime(a.createdAt, language)}
                  {a.expiresAt && ` · ${t('admin.expires')}: ${formatDateTime(a.expiresAt, language)}`} · {a.dismissedCount} {t('admin.dismissedBy')}
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => startEdit(a)} className="touch-target rounded border border-border-subtle px-2 py-1 text-xs hover:bg-black/5">{t('admin.edit')}</button>
                  <button type="button" onClick={() => setToDelete(a)} className="touch-target rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50">{t('tree.delete')}</button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {toDelete && (
        <Modal
          title={t('admin.deleteNotice')}
          onClose={() => setToDelete(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setToDelete(null)} className="touch-target rounded-md border border-border-subtle px-4 py-1.5 text-sm hover:bg-black/5">{t('common.cancel')}</button>
              <button type="button" data-autofocus onClick={() => void remove()} className="touch-target rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700">{t('tree.delete')}</button>
            </div>
          }
        >
          <p className="text-sm text-neutral-700">{t('admin.deleteNoticeExplain')}</p>
          <p className="mt-2 text-sm font-medium text-neutral-900">{toDelete.title}</p>
        </Modal>
      )}
    </div>
  );
}
