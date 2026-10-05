import { useState, type ReactNode } from 'react';
import { Modal } from '../../components/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { apiErrorCode, adminApi, type AdminUser } from '../../services/adminApi';
import { formatBytes } from '../../utils/format';

const MB = 1024 * 1024;

function useErrorText() {
  const { t } = useI18n();
  return (error: unknown): string => {
    const code = apiErrorCode(error);
    const key = code ? `admin.err.${code}` : '';
    const text = key ? t(key) : key;
    return text && text !== key ? text : t('admin.err.generic');
  };
}

type DialogShellProps = {
  title: string;
  onClose: () => void;
  confirmLabel: string;
  confirmTone?: 'primary' | 'danger';
  busy: boolean;
  error: string | null;
  disabled?: boolean;
  onConfirm: () => void;
  children: ReactNode;
};

function DialogShell({ title, onClose, confirmLabel, confirmTone = 'primary', busy, error, disabled, onConfirm, children }: DialogShellProps) {
  const { t } = useI18n();
  const color = confirmTone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-accent-blue hover:bg-accent-blue-dark';
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="touch-target rounded-md border border-border-subtle px-4 py-1.5 text-sm hover:bg-black/5">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            data-autofocus
            disabled={busy || disabled}
            onClick={onConfirm}
            className={`touch-target rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${color}`}
          >
            {busy ? t('common.loading') : confirmLabel}
          </button>
        </div>
      }
    >
      {children}
      {error && (
        <p role="alert" className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </Modal>
  );
}

function who(user: AdminUser) {
  return (
    <p className="mb-3 text-sm text-neutral-700">
      <strong>{user.displayName}</strong> <span className="text-neutral-500">{user.email}</span>
    </p>
  );
}

/** Change a user's storage limit: back to the default, or a custom number of MB. */
export function QuotaDialog({ user, defaultQuotaBytes, onClose, onDone }: { user: AdminUser; defaultQuotaBytes: number; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [mode, setMode] = useState<'default' | 'custom'>(user.storageQuotaBytes === null ? 'default' : 'custom');
  const [mb, setMb] = useState(String(Math.round((user.storageQuotaBytes ?? defaultQuotaBytes) / MB)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(mb);
  const valid = mode === 'default' || (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1024 * 1024);
  const newQuota = mode === 'default' ? defaultQuotaBytes : Math.round(parsed * MB);
  const belowUse = valid && user.usedBytes > newQuota;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.setQuota(user.id, mode === 'default' ? null : Math.round(parsed * MB));
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <DialogShell title={t('admin.changeLimit')} onClose={onClose} confirmLabel={t('common.save')} busy={busy} error={error} disabled={!valid} onConfirm={() => void save()}>
      {who(user)}
      <p className="mb-3 text-sm text-neutral-600">
        {t('admin.inUse')}: <strong>{formatBytes(user.usedBytes)}</strong>
      </p>
      <fieldset className="space-y-2">
        <legend className="sr-only">{t('admin.changeLimit')}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="quota-mode" checked={mode === 'default'} onChange={() => setMode('default')} className="accent-accent-blue" />
          {t('admin.useDefault')} ({formatBytes(defaultQuotaBytes, 0)})
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="quota-mode" checked={mode === 'custom'} onChange={() => setMode('custom')} className="accent-accent-blue" />
          {t('admin.customLimit')}
        </label>
        <div className="flex items-center gap-2 pl-6">
          <input
            type="number"
            min={0}
            step={50}
            inputMode="numeric"
            value={mb}
            disabled={mode !== 'custom'}
            onChange={(e) => setMb(e.target.value)}
            aria-label="MB"
            className="w-32 rounded border border-border-subtle bg-bg-base px-2 py-1 text-sm disabled:opacity-50"
          />
          <span className="text-sm text-neutral-600">MB</span>
          {mode === 'custom' && (
            <span className="ml-auto flex gap-1">
              {[100, 500, 1024].map((add) => (
                <button key={add} type="button" onClick={() => setMb(String(Math.max(0, Math.round((Number(mb) || 0) + add))))} className="rounded border border-border-subtle px-2 py-0.5 text-xs hover:bg-black/5">
                  +{add >= 1024 ? '1 GB' : `${add} MB`}
                </button>
              ))}
            </span>
          )}
        </div>
      </fieldset>
      {user.isSuperAdmin && <p className="mt-3 text-xs text-neutral-500">{t('admin.adminUnlimitedNote')}</p>}
      {belowUse && <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">{t('admin.belowUseWarning')}</p>}
    </DialogShell>
  );
}

/** Block (with an internal reason) or unblock an account. */
export function BlockDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const blocking = user.isActive;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (blocking) await adminApi.block(user.id, reason);
      else await adminApi.unblock(user.id);
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={blocking ? t('admin.blockUser') : t('admin.unblockUser')}
      onClose={onClose}
      confirmLabel={blocking ? t('admin.block') : t('admin.unblock')}
      confirmTone={blocking ? 'danger' : 'primary'}
      busy={busy}
      error={error}
      onConfirm={() => void run()}
    >
      {who(user)}
      {blocking ? (
        <>
          <p className="mb-3 text-sm text-neutral-700">{t('admin.blockExplain')}</p>
          <label className="block text-sm font-medium text-neutral-800" htmlFor="block-reason">
            {t('admin.blockReason')}
          </label>
          <textarea
            id="block-reason"
            value={reason}
            maxLength={500}
            rows={3}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded border border-border-subtle bg-bg-base px-2 py-1.5 text-sm"
          />
          <p className="mt-1 text-xs text-neutral-500">{t('admin.blockReasonHint')}</p>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-700">{t('admin.unblockExplain')}</p>
          {user.blockReason && (
            <p className="mt-2 text-xs text-neutral-500">
              {t('admin.blockReason')}: {user.blockReason}
            </p>
          )}
        </>
      )}
    </DialogShell>
  );
}

/** Grant or revoke the super admin role. */
export function AdminRoleDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const granting = !user.isSuperAdmin;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.setAdmin(user.id, granting);
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={granting ? t('admin.makeAdmin') : t('admin.removeAdmin')}
      onClose={onClose}
      confirmLabel={granting ? t('admin.makeAdmin') : t('admin.removeAdmin')}
      confirmTone={granting ? 'primary' : 'danger'}
      busy={busy}
      error={error}
      onConfirm={() => void run()}
    >
      {who(user)}
      <p className="text-sm text-neutral-700">{granting ? t('admin.makeAdminExplain') : t('admin.removeAdminExplain')}</p>
    </DialogShell>
  );
}
