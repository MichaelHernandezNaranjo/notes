import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
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
    <Modal
      title={t('sharing.title')}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="touch-target w-full rounded-md border border-border-subtle py-1.5 text-sm hover:bg-black/5"
          onClick={onClose}
        >
          {t('common.cancel')}
        </button>
      }
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          className="touch-target rounded border border-border-subtle bg-bg-base px-2 py-1 text-sm"
          value={accessLevel}
          onChange={(e) => setAccessLevel(e.target.value as 'Read' | 'Edit')}
        >
          <option value="Read">{t('sharing.accessRead')}</option>
          <option value="Edit">{t('sharing.accessEdit')}</option>
        </select>
        <button
          type="button"
          data-autofocus
          className="touch-target rounded bg-accent-blue px-3 py-1 text-sm text-white hover:bg-accent-blue-dark"
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
            className="flex items-center justify-between gap-3 rounded border border-border-subtle px-3 py-2 text-sm"
          >
            <span className="min-w-0 break-words">
              {permission.granteeType === 'PublicLink'
                ? t('sharing.publicLink')
                : (permission.userDisplayName ?? permission.groupName ?? permission.granteeType)}
              {' · '}
              {permission.accessLevel === 'Read' ? t('sharing.accessRead') : t('sharing.accessEdit')}
            </span>
            <button
              type="button"
              className="touch-target shrink-0 px-2 text-xs text-red-600 hover:text-red-500"
              onClick={() => handleRevoke(permission.id)}
            >
              {t('sharing.revoke')}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
