import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../auth/AuthContext';
import type { NodeDto } from '../../services/nodesApi';

export type ContextMenuState = { x: number; y: number; node: NodeDto; count: number };

type ContextMenuProps = {
  state: ContextMenuState;
  onAction: (action: string, node: NodeDto) => void;
  onClose: () => void;
};

/**
 * Context menu for tree items. On desktop it opens at the pointer (clamped so it never leaves the
 * window); on narrow screens it becomes a bottom sheet with large touch targets.
 */
export function ContextMenu({ state, onAction, onClose }: ContextMenuProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { node } = state;
  const canManage = node.canManage === true || node.ownerId === user?.id;
  const isTrashed = node.isDeleted;
  const isMulti = state.count > 1;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: state.x, top: state.y });
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const onChange = () => setMobile(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Keep the floating menu inside the viewport.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || mobile) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(state.x, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(state.y, window.innerHeight - height - 8)),
    });
  }, [state.x, state.y, mobile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items: Array<{ action: string; label: string }> = isTrashed
    ? [
        { action: 'restore', label: t('tree.restore') },
        { action: 'deletePermanently', label: t('tree.deletePermanently') },
      ]
    : isMulti
      ? [
          { action: 'move', label: `${t('tree.moveTo')} (${state.count})` },
          { action: 'favorite', label: node.isFavorite ? '★ / ☆' : '☆ / ★' },
          { action: 'delete', label: `${t('tree.delete')} (${state.count})` },
        ]
      : [
          ...(node.type === 'Folder'
            ? [
                { action: 'newNote', label: t('tree.newNote') },
                { action: 'newFolder', label: t('tree.newFolder') },
              ]
            : []),
          ...(canManage ? [{ action: 'share', label: t('sharing.menuShare') }] : []),
          { action: 'rename', label: t('tree.rename') },
          { action: 'move', label: t('tree.moveTo') },
          ...(node.accessLevel === 'Read' ? [] : [{ action: 'duplicate', label: t('tree.duplicate') }]),
          { action: 'favorite', label: node.isFavorite ? '★ / ☆' : '☆ / ★' },
          { action: 'delete', label: t('tree.delete') },
        ];

  const buttons = items.map((item) => (
    <button
      key={item.action}
      type="button"
      className={`block w-full text-left hover:bg-black/10 ${
        mobile ? 'min-h-12 px-5 py-3 text-base' : 'px-3 py-1.5 text-sm'
      }`}
      onClick={() => {
        onAction(item.action, node);
        onClose();
      }}
    >
      {item.label}
    </button>
  ));

  if (mobile) {
    return createPortal(
      <div className="fixed inset-0 z-[90] flex items-end bg-black/40" onClick={onClose}>
        <div
          ref={ref}
          role="menu"
          aria-label={node.name}
          className="max-h-[80dvh] w-full overflow-y-auto rounded-t-2xl border-t border-border-subtle bg-bg-base pb-[env(safe-area-inset-bottom)] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-neutral-300" aria-hidden="true" />
          <p className="truncate px-5 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-neutral-500">{node.name}</p>
          {buttons}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[180px] rounded-md border border-border-subtle bg-bg-elevated py-1 shadow-xl"
      style={{ left: pos.left, top: pos.top }}
      onClick={(e) => e.stopPropagation()}
    >
      {buttons}
    </div>
  );
}
