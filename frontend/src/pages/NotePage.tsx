import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TreeExplorer } from '../features/tree-explorer/TreeExplorer';
import { CollaborativeEditor } from '../features/editor/CollaborativeEditor';
import { ShareDialog } from '../features/sharing/ShareDialog';
import { useI18n } from '../i18n/I18nProvider';
import { nodesApi } from '../services/nodesApi';

export function NotePage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [noteName, setNoteName] = useState('');
  const [trashed, setTrashed] = useState(false);
  const [trashPath, setTrashPath] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [treeVersion, setTreeVersion] = useState(0);

  const loadNode = useCallback(async (id: string) => {
    const node = await nodesApi.getById(id);
    setNoteName(node.name);
    setTrashed(node.isDeleted);
    if (node.isDeleted) {
      // The location (ancestor names) comes from the trash listing.
      const trash = await nodesApi.getTrash().catch(() => []);
      setTrashPath(trash.find((n) => n.id === id)?.path ?? null);
    } else {
      setTrashPath(null);
    }
  }, []);

  useEffect(() => {
    if (nodeId) void loadNode(nodeId).catch(() => undefined);
  }, [nodeId, loadNode]);

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
      <aside className="h-full w-72 shrink-0 border-r border-border-subtle">
        <TreeExplorer
          activeNodeId={nodeId ?? null}
          onOpenNote={(id) => navigate(`/notes/${id}`)}
          onRenamed={(id, name) => id === nodeId && setNoteName(name)}
          refreshToken={treeVersion}
        />
      </aside>
      <main className="h-full min-h-0 min-w-0 flex-1">
        {nodeId ? (
          <CollaborativeEditor
            key={nodeId}
            nodeId={nodeId}
            noteName={noteName}
            onShare={() => setShareOpen(true)}
            trashed={trashed}
            trashPath={trashPath}
            onRestore={restore}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            Selecciona o crea una nota para comenzar
          </div>
        )}
      </main>
      {shareOpen && nodeId && !trashed && <ShareDialog nodeId={nodeId} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
