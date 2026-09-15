import { useI18n } from '../../i18n/I18nProvider';
import type { NodeDto } from '../../services/nodesApi';

export type ContextMenuState = { x: number; y: number; node: NodeDto };

type ContextMenuProps = {
  state: ContextMenuState;
  onAction: (action: string, node: NodeDto) => void;
  onClose: () => void;
};

/** Native right-click context menu for tree items (create, rename, duplicate, move, delete). */
export function ContextMenu({ state, onAction, onClose }: ContextMenuProps) {
  const { t } = useI18n();
  const { node } = state;
  const isTrashed = node.isDeleted;

  const items: Array<{ action: string; label: string }> = isTrashed
    ? [
        { action: 'restore', label: t('tree.restore') },
        { action: 'deletePermanently', label: t('tree.deletePermanently') },
      ]
    : [
        ...(node.type === 'Folder'
          ? [
              { action: 'newNote', label: t('tree.newNote') },
              { action: 'newFolder', label: t('tree.newFolder') },
            ]
          : []),
        { action: 'rename', label: t('tree.rename') },
        { action: 'duplicate', label: t('tree.duplicate') },
        { action: 'favorite', label: node.isFavorite ? '★ / ☆' : '☆ / ★' },
        { action: 'delete', label: t('tree.delete') },
      ];

  return (
    <div
      className="fixed z-50 min-w-[180px] rounded-md border border-border-subtle bg-bg-elevated py-1 shadow-xl"
      style={{ left: state.x, top: state.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.action}
          type="button"
          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-white/10"
          onClick={() => {
            onAction(item.action, node);
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
