import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { apiErrorStatus } from '../../services/apiClient';
import { apiErrorCode } from '../../services/adminApi';
import { sharingApi, type AccessLevel, type Sharing } from '../../services/permissionsApi';

type ShareDialogProps = {
  nodeId: string;
  nodeName: string;
  nodeType: 'Folder' | 'Note';
  onClose: () => void;
};

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue';
const field = `rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-sm ${focusRing}`;

function expiryFromChoice(choice: string): string | null {
  const days = Number(choice);
  return days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  return (
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700">
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Share a note or folder: people by e-mail (with changeable permission) and one public read-only link. */
export function ShareDialog({ nodeId, nodeName, nodeType, onClose }: ShareDialogProps) {
  const { t, language } = useI18n();
  const [sharing, setSharing] = useState<Sharing | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [email, setEmail] = useState('');
  const [level, setLevel] = useState<AccessLevel>('Edit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setSharing(await sharingApi.get(nodeId));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [nodeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const date = (iso: string) => new Date(iso).toLocaleDateString(language, { year: 'numeric', month: 'short', day: 'numeric' });

  /** Runs an action with a busy flag and translated error messages. */
  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
      await refresh();
    } catch (e) {
      const code = apiErrorCode(e);
      const status = apiErrorStatus(e);
      setError(
        code === 'invalid_email'
          ? t('sharing.errInvalidEmail')
          : code === 'cannot_share_owner'
            ? t('sharing.errOwner')
            : status === 403
              ? t('sharing.errForbidden')
              : t('sharing.errGeneric'),
      );
    } finally {
      setBusy(false);
    }
  };

  const invite = (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    void run(async () => {
      const result = await sharingApi.share(nodeId, address, level);
      setEmail('');
      setNotice((result.kind === 'Invitation' ? t('sharing.invitedOk') : t('sharing.sharedOk')).replace('{email}', result.email));
    });
  };

  const linkUrl = sharing?.link ? `${window.location.origin}/s/${sharing.link.token}` : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(linkUrl);
    } catch {
      linkInput.current?.select();
      document.execCommand('copy');
    }
    setError(null);
    setNotice(t('sharing.linkCopied'));
  };

  const levelLabel = (l: AccessLevel) => (l === 'Read' ? t('sharing.levelRead') : t('sharing.levelEdit'));
  const people = sharing ? [...sharing.people].sort((a, b) => Number(a.inherited) - Number(b.inherited)) : [];

  return (
    <Modal
      title={t('sharing.titleFor').replace('{name}', nodeName || t('editor.untitled'))}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex justify-end">
          <button type="button" className={`touch-target rounded-md bg-accent-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-blue-dark ${focusRing}`} onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      }
    >
      {loadError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span>{t('sharing.loadError')}</span>
          <button type="button" className="underline" onClick={() => void refresh()}>
            {t('editor.retry')}
          </button>
        </div>
      ) : !sharing ? (
        <p className="py-6 text-center text-sm text-neutral-500" role="status">
          {t('common.loading')}
        </p>
      ) : (
        <div className="space-y-6">
          {(error || notice) && (
            <div aria-live="polite" className="text-sm">
              {error && (
                <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-red-800">
                  {error}
                </p>
              )}
              {!error && notice && <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-emerald-800">{notice}</p>}
            </div>
          )}

          {/* ---------- People ---------- */}
          <section aria-labelledby="share-people">
            <h3 id="share-people" className="text-sm font-semibold text-neutral-900">
              {t('sharing.peopleTitle')}
            </h3>
            <p className="mt-0.5 text-xs text-neutral-600">{t('sharing.peopleHint')}</p>

            <form onSubmit={invite} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                data-autofocus
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('sharing.emailPlaceholder')}
                aria-label={t('sharing.emailLabel')}
                autoComplete="off"
                className={`touch-target min-w-0 flex-1 ${field}`}
              />
              <select aria-label={t('sharing.levelRead') + ' / ' + t('sharing.levelEdit')} value={level} onChange={(e) => setLevel(e.target.value as AccessLevel)} className={`touch-target ${field}`}>
                <option value="Edit">{t('sharing.levelEdit')}</option>
                <option value="Read">{t('sharing.levelRead')}</option>
              </select>
              <button type="submit" disabled={busy || !email.trim()} className={`touch-target rounded-md bg-accent-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-blue-dark disabled:opacity-50 ${focusRing}`}>
                {t('sharing.invite')}
              </button>
            </form>

            <ul className="mt-3 divide-y divide-border-subtle rounded-md border border-border-subtle">
              {people.map((p) => {
                const name = p.displayName ?? p.email ?? '—';
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <Avatar name={name} url={p.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{name}</p>
                      <p className="truncate text-xs text-neutral-600">
                        {p.inherited ? t('sharing.inheritedFrom').replace('{name}', p.sourceNodeName ?? '') : p.email}
                      </p>
                    </div>
                    {p.inherited ? (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700" title={t('sharing.inheritedHint')}>
                        {levelLabel(p.accessLevel)}
                      </span>
                    ) : (
                      <>
                        <select
                          aria-label={`${name}: ${t('sharing.levelRead')} / ${t('sharing.levelEdit')}`}
                          value={p.accessLevel}
                          disabled={busy}
                          onChange={(e) => void run(() => sharingApi.update(nodeId, p.id, e.target.value as AccessLevel, p.expiresAt))}
                          className={`touch-target ${field}`}
                        >
                          <option value="Edit">{t('sharing.levelEdit')}</option>
                          <option value="Read">{t('sharing.levelRead')}</option>
                        </select>
                        <button
                          type="button"
                          disabled={busy}
                          className={`touch-target rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 ${focusRing}`}
                          onClick={() => window.confirm(t('sharing.removeConfirm').replace('{name}', name)) && void run(() => sharingApi.revoke(nodeId, p.id))}
                        >
                          {t('sharing.removeAccess')}
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
              {sharing.invitations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <Avatar name={i.email} url={null} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{i.email}</p>
                    <p className="truncate text-xs text-neutral-600">
                      <span className="mr-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-800">{t('sharing.pending')}</span>
                      {t('sharing.pendingHint').replace('{date}', date(i.expiresAt))}
                    </p>
                  </div>
                  <select
                    aria-label={`${i.email}: ${t('sharing.levelRead')} / ${t('sharing.levelEdit')}`}
                    value={i.accessLevel}
                    disabled={busy}
                    onChange={(e) => void run(async () => void (await sharingApi.share(nodeId, i.email, e.target.value as AccessLevel)))}
                    className={`touch-target ${field}`}
                  >
                    <option value="Edit">{t('sharing.levelEdit')}</option>
                    <option value="Read">{t('sharing.levelRead')}</option>
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    className={`touch-target rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 ${focusRing}`}
                    onClick={() => void run(() => sharingApi.revokeInvitation(nodeId, i.id))}
                  >
                    {t('sharing.removeAccess')}
                  </button>
                </li>
              ))}
              {people.length === 0 && sharing.invitations.length === 0 && (
                <li className="px-3 py-3 text-sm text-neutral-500">{t('sharing.noPeople')}</li>
              )}
            </ul>
          </section>

          {/* ---------- Public link ---------- */}
          <section aria-labelledby="share-link" className="rounded-md border border-border-subtle p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id="share-link" className="text-sm font-semibold text-neutral-900">
                  🔗 {t('sharing.linkTitle')}
                </h3>
                <p className="mt-0.5 text-xs text-neutral-600">
                  {t('sharing.linkHint')} {nodeType === 'Folder' && t('sharing.linkFolderHint')}
                </p>
              </div>
              {sharing.link ? (
                <button
                  type="button"
                  disabled={busy}
                  className={`touch-target shrink-0 rounded-md border border-border-subtle px-3 py-1.5 text-xs hover:bg-black/5 ${focusRing}`}
                  onClick={() => window.confirm(t('sharing.linkDisableConfirm')) && void run(() => sharingApi.disableLink(nodeId))}
                >
                  {t('sharing.linkDisable')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className={`touch-target shrink-0 rounded-md bg-accent-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-blue-dark ${focusRing}`}
                  onClick={() => void run(async () => void (await sharingApi.enableLink(nodeId, null)))}
                >
                  {t('sharing.linkEnable')}
                </button>
              )}
            </div>

            {sharing.link && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    ref={linkInput}
                    readOnly
                    value={linkUrl}
                    aria-label={t('sharing.linkTitle')}
                    onFocus={(e) => e.currentTarget.select()}
                    className={`touch-target min-w-0 flex-1 bg-neutral-50 ${field}`}
                  />
                  <button type="button" className={`touch-target rounded-md bg-accent-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-blue-dark ${focusRing}`} onClick={() => void copyLink()}>
                    {t('sharing.linkCopy')}
                  </button>
                  <a href={linkUrl} target="_blank" rel="noopener noreferrer" className={`touch-target flex items-center justify-center rounded-md border border-border-subtle px-3 py-1.5 text-sm hover:bg-black/5 ${focusRing}`}>
                    {t('sharing.linkOpen')}
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-600">
                  <span>{sharing.link.expiresAt ? t('sharing.linkExpires').replace('{date}', date(sharing.link.expiresAt)) : t('sharing.linkNoExpiry')}</span>
                  <span>{t('sharing.linkViews').replace('{count}', String(sharing.link.viewCount))}</span>
                  <label className="flex items-center gap-1.5">
                    {t('sharing.linkExpiry')}
                    <select
                      value="keep"
                      disabled={busy}
                      onChange={(e) => e.target.value !== 'keep' && void run(async () => void (await sharingApi.enableLink(nodeId, expiryFromChoice(e.target.value))))}
                      className={`${field} py-1 text-xs`}
                    >
                      <option value="keep">…</option>
                      <option value="0">{t('sharing.expNever')}</option>
                      <option value="1">{t('sharing.exp1')}</option>
                      <option value="7">{t('sharing.exp7')}</option>
                      <option value="30">{t('sharing.exp30')}</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    className={`underline ${focusRing}`}
                    onClick={() => window.confirm(t('sharing.linkRegenerateConfirm')) && void run(async () => void (await sharingApi.enableLink(nodeId, sharing.link?.expiresAt ?? null, true)))}
                  >
                    {t('sharing.linkRegenerate')}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
