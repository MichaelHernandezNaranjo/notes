import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { nodesApi, type NodeDto } from '../../services/nodesApi';

type MoveDialogProps = {
  /** Items being moved; they (and their descendants) cannot be chosen as destination. */
  nodes: NodeDto[];
  onMove: (targetParentId: string | null) => Promise<void> | void;
  onClose: () => void;
};

type FolderRowProps = {
  folder: NodeDto;
  depth: number;
  excluded: Set<string>;
  chosen: string | null | undefined;
  onChoose: (id: string) => void;
};

/** One folder of the picker; its children are loaded lazily when it is expanded. */
function FolderRow({ folder, depth, excluded, chosen, onChoose }: FolderRowProps) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<NodeDto[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next && children === null) {
      setLoading(true);
      try {
        setChildren((await nodesApi.getChildren(folder.id)).filter((n) => n.type === 'Folder'));
      } catch {
        setChildren([]);
      } finally {
        setLoading(false);
      }
    }
  }, [open, children, folder.id]);

  return (
    <li role="none">
      <div
        role="treeitem"
        aria-selected={chosen === folder.id}
        aria-expanded={open}
        style={{ paddingLeft: 8 + depth * 16 }}
        className={`flex min-h-11 items-center gap-1 rounded-md pr-2 ${chosen === folder.id ? 'bg-accent-blue/15' : 'hover:bg-black/5'}`}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={open ? '−' : '+'}
          className="flex h-9 w-7 shrink-0 items-center justify-center text-xs text-neutral-600"
        >
          {loading ? '…' : open ? '▾' : '▸'}
        </button>
        <button
          type="button"
          onClick={() => onChoose(folder.id)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left text-sm text-neutral-900"
        >
          <span aria-hidden="true">📁</span>
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {open && children && (
        <ul role="group">
          {children
            .filter((c) => !excluded.has(c.id))
            .map((c) => (
              <FolderRow key={c.id} folder={c} depth={depth + 1} excluded={excluded} chosen={chosen} onChoose={onChoose} />
            ))}
        </ul>
      )}
    </li>
  );
}

/** "Move to…" dialog: pick the destination folder (or the root) without drag & drop, so it works on touch screens. */
export function MoveDialog({ nodes, onMove, onClose }: MoveDialogProps) {
  const { t } = useI18n();
  const [roots, setRoots] = useState<NodeDto[] | null>(null);
  const [error, setError] = useState(false);
  // undefined = nothing chosen yet, null = root.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const excluded = new Set(nodes.map((n) => n.id));

  useEffect(() => {
    let cancelled = false;
    nodesApi
      .getChildren(null)
      .then((list) => !cancelled && setRoots(list.filter((n) => n.type === 'Folder')))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Modal
      title={`${t('tree.moveTo')} (${nodes.length === 1 ? nodes[0].name : nodes.length})`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="touch-target rounded-md border border-border-subtle px-4 py-1.5 text-sm hover:bg-black/5">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            data-autofocus
            disabled={chosen === undefined || busy}
            onClick={async () => {
              if (chosen === undefined) return;
              setBusy(true);
              try {
                await onMove(chosen);
              } finally {
                setBusy(false);
              }
            }}
            className="touch-target rounded-md bg-accent-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-blue-dark disabled:opacity-50"
          >
            {t('tree.moveHere')}
          </button>
        </div>
      }
    >
      <ul role="tree" aria-label={t('tree.moveTo')} className="space-y-0.5">
        <li role="none">
          <button
            type="button"
            role="treeitem"
            aria-selected={chosen === null}
            onClick={() => setChosen(null)}
            className={`flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-neutral-900 ${chosen === null ? 'bg-accent-blue/15' : 'hover:bg-black/5'}`}
          >
            <span aria-hidden="true">🏠</span>
            {t('tree.rootLocation')}
          </button>
        </li>
        {error && <li className="px-3 py-2 text-xs text-red-700">{t('search.error')}</li>}
        {roots === null && !error && <li className="px-3 py-2 text-xs text-neutral-500">{t('common.loading')}</li>}
        {roots
          ?.filter((f) => !excluded.has(f.id))
          .map((f) => (
            <FolderRow key={f.id} folder={f} depth={0} excluded={excluded} chosen={chosen} onChoose={setChosen} />
          ))}
      </ul>
    </Modal>
  );
}
