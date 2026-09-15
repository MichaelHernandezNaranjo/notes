import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { permissionsApi, type NodePermissionDto } from '../../services/permissionsApi';

type ShareDialogProps = {
  nodeId: string;
  onClose: () => void;
};

/** Modal for sharing a note/folder via public link or with specific users/groups, with granular access levels. */
export function ShareDialog({ nodeId, onClose }: ShareDialogProps) {
  const { t } = useI18n();
  const [permissions, setPermissions] = useState<NodePermissionDto[]>([]);
  const [accessLevel, setAccessLevel] = useState<'Read' | 'Edit'>('Read');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPermissions(await permissionsApi.list(nodeId));
  }, [nodeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleGenerateLink = async () => {
    const permission = await permissionsApi.createShareLink(nodeId, accessLevel, null);
    setGeneratedLink(`${window.location.origin}/share/${permission.shareToken}`);
    await refresh();
  };

  const handleRevoke = async (permissionId: string) => {
    await permissionsApi.revoke(nodeId, permissionId);
    await refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border-subtle bg-bg-elevated p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-medium text-white">{t('sharing.title')}</h3>

        <div className="mb-4 flex items-center gap-2">
          <select
            className="rounded border border-border-subtle bg-bg-base px-2 py-1 text-sm"
            value={accessLevel}
            onChange={(e) => setAccessLevel(e.target.value as 'Read' | 'Edit')}
          >
            <option value="Read">{t('sharing.accessRead')}</option>
            <option value="Edit">{t('sharing.accessEdit')}</option>
          </select>
          <button
            type="button"
            className="rounded bg-accent-blue px-3 py-1 text-sm text-white hover:bg-accent-blue-dark"
            onClick={handleGenerateLink}
          >
            {t('sharing.generateLink')}
          </button>
        </div>

        {generatedLink && (
          <div className="mb-4 rounded border border-border-subtle bg-bg-base p-2 text-xs break-all text-accent-emerald">
            {generatedLink}
          </div>
        )}

        <div className="space-y-2">
          {permissions.map((permission) => (
            <div
              key={permission.id}
              className="flex items-center justify-between rounded border border-border-subtle px-3 py-2 text-sm"
            >
              <span>
                {permission.granteeType === 'PublicLink'
                  ? t('sharing.publicLink')
                  : permission.userDisplayName ?? permission.groupName ?? permission.granteeType}
                {' · '}
                {permission.accessLevel === 'Read' ? t('sharing.accessRead') : t('sharing.accessEdit')}
              </span>
              <button
                type="button"
                className="text-xs text-red-400 hover:text-red-300"
                onClick={() => handleRevoke(permission.id)}
              >
                {t('sharing.revoke')}
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="mt-4 w-full rounded border border-border-subtle py-1.5 text-sm hover:bg-white/5"
          onClick={onClose}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
