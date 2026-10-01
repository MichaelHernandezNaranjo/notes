import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TreeExplorer } from '../features/tree-explorer/TreeExplorer';
import { CollaborativeEditor } from '../features/editor/CollaborativeEditor';
import { ShareDialog } from '../features/sharing/ShareDialog';
import { nodesApi } from '../services/nodesApi';
import { useEffect } from 'react';

export function NotePage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();
  const [noteName, setNoteName] = useState('');
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (nodeId) {
      nodesApi.getById(nodeId).then((node) => setNoteName(node.name));
    }
  }, [nodeId]);

  return (
    <div className="flex h-full min-h-0">
      <aside className="h-full w-72 shrink-0 border-r border-border-subtle">
        <TreeExplorer
          activeNodeId={nodeId ?? null}
          onOpenNote={(id) => navigate(`/notes/${id}`)}
          onRenamed={(id, name) => id === nodeId && setNoteName(name)}
        />
      </aside>
      <main className="h-full min-h-0 min-w-0 flex-1">
        {nodeId ? (
          <CollaborativeEditor key={nodeId} nodeId={nodeId} noteName={noteName} onShare={() => setShareOpen(true)} />
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
