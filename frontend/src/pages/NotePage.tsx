import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TreeExplorer } from '../features/tree-explorer/TreeExplorer';
import { CollaborativeEditor } from '../features/editor/CollaborativeEditor';
import { ShareDialog } from '../features/sharing/ShareDialog';
import { useI18n } from '../i18n/I18nProvider';
import { apiErrorStatus } from '../services/apiClient';
import { nodesApi, type NodeDto } from '../services/nodesApi';

export function NotePage({ nodeId: openId, active }: { nodeId: string | null; active: boolean }) {
  const nodeId = openId ?? undefined;
  const navigate = useNavigate();
  const { t } = useI18n();
  const [noteName, setNoteName] = useState('');
  const [trashed, setTrashed] = useState(false);
  const [trashPath, setTrashPath] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [treeVersion, setTreeVersion] = useState(0);
  const [access, setAccess] = useState<NodeDto['accessLevel']>(null);
  const [canManage, setCanManage] = useState(false);
  const [noAccess, setNoAccess] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadNode = useCallback(async (id: string) => {
    try {
      const node = await nodesApi.getById(id);
      setNoAccess(false);
      setNoteName(node.name);
      setTrashed(node.isDeleted);
      setAccess(node.accessLevel ?? null);
      setCanManage(!!node.canManage);
      if (node.isDeleted) {
        // The location (ancestor names) comes from the trash listing.
        const trash = await nodesApi.getTrash().catch(() => []);
        setTrashPath(trash.find((n) => n.id === id)?.path ?? null);
      } else {
        setTrashPath(null);
      }
    } catch (error) {
      const status = apiErrorStatus(error);
      // No permission or it no longer exists: show a clear screen instead of a spinner that never ends.
      if (status === 403 || status === 404) setNoAccess(true);
    }
  }, []);

  useEffect(() => {
    setNoAccess(false);
    setNotice(null);
    setAccess(null);
    setCanManage(false);
    if (nodeId) void loadNode(nodeId);
  }, [nodeId, loadNode]);

  /** The owner changed this user's permission while the note is open. */
  const onAccessChanged = useCallback(
    (next: string | null) => {
      if (next === null) {
        setNoAccess(true);
        setTreeVersion((v) => v + 1);
        return;
      }
      setNotice(next === 'Read' ? t('sharing.accessNowRead') : t('sharing.accessNowEdit'));
      if (nodeId) void loadNode(nodeId);
    },
    [nodeId, loadNode, t],
  );

  const restore = useCallback(async () => {
    if (!nodeId) return;
    try {
      await nodesApi.restore(nodeId);
    } catch {
      window.alert(t('tree.restoreConflict'));
      return;
    }
    await loadNode(nodeId);
    setTreeVersion((v) => v + 1);
  }, [nodeId, loadNode, t]);

  return (
    <div className="flex h-full min-h-0">
      {/* Mobile: one screen at a time. The explorer is hidden (not unmounted) while a note is open so its cache and scroll survive. */}
      <aside
        className={`h-full w-full shrink-0 border-r border-border-subtle md:block md:w-64 lg:w-72 ${
          nodeId ? 'hidden' : 'block'
        }`}
      >
        <TreeExplorer
          activeNodeId={nodeId ?? null}
          onOpenNote={(id) => navigate(`/notes/${id}`)}
          onRenamed={(id, name) => id === nodeId && setNoteName(name)}
          refreshToken={treeVersion}
          active={active}
        />
      </aside>
      <main className={`h-full min-h-0 min-w-0 flex-1 md:block ${nodeId ? 'block' : 'hidden'}`}>
        {nodeId && noAccess ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
            <span className="text-4xl" aria-hidden="true">🔒</span>
            <h2 className="text-lg font-semibold text-neutral-900">{t('sharing.noAccessTitle')}</h2>
            <p className="max-w-sm text-sm text-neutral-600">{t('sharing.noAccessText')}</p>
            <button
              type="button"
              onClick={() => navigate('/notes')}
              className="rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue-dark"
            >
              {t('sharing.noAccessBack')}
            </button>
          </div>
        ) : nodeId ? (
          <div className="flex h-full min-h-0 flex-col">
            {notice && (
              <div role="status" className="flex shrink-0 items-center justify-between gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
                <span>{notice}</span>
                <button type="button" onClick={() => setNotice(null)} className="underline">
                  {t('common.close')}
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1">
              <CollaborativeEditor
                key={nodeId}
                nodeId={nodeId}
                noteName={noteName}
                onShare={() => setShareOpen(true)}
                onBack={() => navigate('/notes')}
                trashed={trashed}
                trashPath={trashPath}
                onRestore={restore}
                readOnly={access === 'Read'}
                canManage={canManage}
                onAccessChanged={onAccessChanged}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">{t('sharing.pickNote')}</div>
        )}
      </main>
      {shareOpen && nodeId && !trashed && canManage && (
        <ShareDialog nodeId={nodeId} nodeName={noteName} nodeType="Note" onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
