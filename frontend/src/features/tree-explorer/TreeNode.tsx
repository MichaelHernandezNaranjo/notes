import { useState } from 'react';
import type { NodeDto } from '../../services/nodesApi';
import { useI18n } from '../../i18n/I18nProvider';
import { InlineNameInput } from './InlineNameInput';

export type DropPosition = 'before' | 'after' | 'inside';

export type DraftNode = { parentId: string | null; type: 'Folder' | 'Note' };

type TreeNodeProps = {
  node: NodeDto;
  depth: number;
  isExpanded: boolean;
  childrenNodes: NodeDto[];
  activeNodeId: string | null;
  selectedIds: Set<string>;
  onSelect: (e: React.MouseEvent, node: NodeDto) => void;
  onDragStartNode: (e: React.DragEvent, node: NodeDto) => void;
  onDropAt: (e: React.DragEvent, target: NodeDto, position: DropPosition) => void;
  /** False in read-only areas (shared with me): rows only accept drops into folders. */
  reorderable: boolean;
  onContextMenu: (e: React.MouseEvent, node: NodeDto) => void;
  childrenByParent: Record<string, NodeDto[]>;
  expanded: Set<string>;
  editingId: string | null;
  draft: DraftNode | null;
  siblingNames: (parentId: string | null) => Set<string>;
  onStartRename: (node: NodeDto) => void;
  onSubmitRename: (node: NodeDto, name: string) => Promise<void>;
  onSubmitDraft: (name: string) => Promise<void>;
  onCancelEdit: () => void;
};

/** Recursive tree row: multi-selection, inline rename/create, native HTML5 Drag & Drop and a right-click context menu. */
export function TreeNode(props: TreeNodeProps) {
  const {
    node,
    depth,
    isExpanded,
    childrenNodes,
    activeNodeId,
    selectedIds,
    onSelect,
    onDragStartNode,
    onDropAt,
    reorderable,
    onContextMenu,
    childrenByParent,
    expanded,
    editingId,
    draft,
    siblingNames,
    onStartRename,
    onSubmitRename,
    onSubmitDraft,
    onCancelEdit,
  } = props;
  const isFolder = node.type === 'Folder';
  const { t } = useI18n();
  const isSelected = selectedIds.has(node.id);
  const isActive = activeNodeId === node.id;
  const isEditing = editingId === node.id;
  const [dropPos, setDropPos] = useState<DropPosition | null>(null);

  /** Top/bottom edge of a row = place before/after it; the middle of a folder = drop inside it. */
  const positionFor = (e: React.DragEvent<HTMLElement>): DropPosition | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / Math.max(rect.height, 1);
    if (!reorderable) return isFolder ? 'inside' : null;
    if (isFolder) return ratio < 0.25 ? 'before' : ratio > 0.75 && !isExpanded ? 'after' : 'inside';
    return ratio < 0.5 ? 'before' : 'after';
  };

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={isFolder ? isExpanded : undefined}
        data-node-id={node.id}
        tabIndex={-1}
        draggable={!isEditing}
        onDragStart={(e) => onDragStartNode(e, node)}
        onDragOver={(e) => {
          const pos = positionFor(e);
          if (!pos) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (pos !== dropPos) setDropPos(pos);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropPos(null);
        }}
        onDrop={(e) => {
          const pos = positionFor(e);
          setDropPos(null);
          if (!pos) return;
          e.preventDefault();
          e.stopPropagation();
          onDropAt(e, node, pos);
        }}
        onDragEnd={() => setDropPos(null)}
        onContextMenu={(e) => onContextMenu(e, node)}
        onClick={(e) => {
          e.stopPropagation();
          if (!isEditing) onSelect(e, node);
        }}
        style={{ paddingLeft: 12 + depth * 16 }}
        className={`relative flex cursor-pointer select-none items-center gap-1.5 py-1 pr-2 pointer-coarse:min-h-11 ${
          dropPos === 'inside' ? 'bg-accent-blue/20 ring-1 ring-inset ring-accent-blue' : ''
        } ${
          isSelected
            ? 'bg-accent-blue/15 text-neutral-900'
            : isActive
              ? 'bg-accent-blue/10 text-accent-blue'
              : 'hover:bg-black/5'
        }`}
      >
        {(dropPos === 'before' || dropPos === 'after') && (
          <span
            aria-hidden="true"
            style={{ left: 12 + depth * 16 }}
            className={`pointer-events-none absolute right-1 h-0.5 rounded bg-accent-blue ${dropPos === 'before' ? 'top-0' : 'bottom-0'}`}
          />
        )}
        {isFolder ? <span className="w-3 text-xs">{isExpanded ? '▾' : '▸'}</span> : <span className="w-3" />}
        <span>{isFolder ? '📁' : '📝'}</span>
        {isEditing ? (
          <InlineNameInput
            initialValue={node.name}
            takenNames={siblingNames(node.parentId)}
            onSubmit={(name) => onSubmitRename(node, name)}
            onCancel={onCancelEdit}
          />
        ) : (
          <span
            className="truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartRename(node);
            }}
          >
            {node.name}
          </span>
        )}
        {node.accessLevel && node.accessLevel !== 'Owner' && !isEditing && (
          <span
            className="ml-1 shrink-0 rounded-full bg-neutral-200 px-1.5 text-[10px] font-medium text-neutral-700"
            title={node.accessLevel === 'Read' ? t('sharing.levelReadHint') : t('sharing.levelEditHint')}
          >
            {node.accessLevel === 'Read' ? t('sharing.levelRead') : t('sharing.levelEdit')}
          </span>
        )}
        {node.isFavorite && !isEditing && <span className="ml-auto text-accent-emerald">★</span>}
        {/* Touch screens have no right-click: expose the same menu through a visible "more" button. */}
        {!isEditing && (
          <button
            type="button"
            aria-label={`${node.name}: menu`}
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onContextMenu({ ...e, clientX: rect.left, clientY: rect.bottom, preventDefault: () => undefined, stopPropagation: () => undefined } as unknown as React.MouseEvent, node);
            }}
            className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg leading-none text-neutral-600 hover:bg-black/10 pointer-coarse:flex ${node.isFavorite ? '' : 'ml-auto'}`}
          >
            ⋯
          </button>
        )}
      </div>

      {isFolder && isExpanded && (
        <div role="group">
          {draft && draft.parentId === node.id && (
            <div style={{ paddingLeft: 12 + (depth + 1) * 16 }} className="flex items-center gap-1.5 py-1 pr-2">
              <span className="w-3" />
              <span>{draft.type === 'Folder' ? '📁' : '📝'}</span>
              <InlineNameInput takenNames={siblingNames(node.id)} onSubmit={onSubmitDraft} onCancel={onCancelEdit} />
            </div>
          )}
          {childrenNodes.map((child) => (
            <TreeNode
              key={child.id}
              {...props}
              node={child}
              depth={depth + 1}
              isExpanded={expanded.has(child.id)}
              childrenNodes={childrenByParent[child.id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
