import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TreeExplorer } from '../features/tree-explorer/TreeExplorer';
import { CollaborativeEditor } from '../features/editor/CollaborativeEditor';
import { ShareDialog } from '../features/sharing/ShareDialog';
import { nodesApi } from '../services/nodesApi';
import { useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';

export function NotePage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [noteName, setNoteName] = useState('');
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (nodeId) {
      nodesApi.getById(nodeId).then((node) => setNoteName(node.name));
    }
  }, [nodeId]);

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 border-r border-border-subtle">
        <TreeExplorer activeNodeId={nodeId ?? null} onOpenNote={(id) => navigate(`/notes/${id}`)} />
      </aside>
      <main className="flex-1">
        {nodeId ? (
          <div className="flex h-full flex-col">
            <div className="flex justify-end border-b border-border-subtle px-4 py-1">
              <button
                type="button"
                className="rounded border border-border-subtle px-3 py-1 text-xs hover:border-accent-purple"
                onClick={() => setShareOpen(true)}
              >
                {t('editor.share')}
              </button>
            </div>
            <div className="flex-1">
              <CollaborativeEditor nodeId={nodeId} noteName={noteName} />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            Selecciona o crea una nota para comenzar
          </div>
        )}
      </main>
      {shareOpen && nodeId && <ShareDialog nodeId={nodeId} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
