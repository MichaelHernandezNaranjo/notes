import type { NodeDto } from '../../services/nodesApi';
import { InlineNameInput } from './InlineNameInput';

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
  onDropOnFolder: (e: React.DragEvent, targetId: string) => void;
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
    onDropOnFolder,
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
  const isSelected = selectedIds.has(node.id);
  const isActive = activeNodeId === node.id;
  const isEditing = editingId === node.id;

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
          if (isFolder) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!isFolder) return;
          e.preventDefault();
          e.stopPropagation();
          onDropOnFolder(e, node.id);
        }}
        onContextMenu={(e) => onContextMenu(e, node)}
        onClick={(e) => {
          e.stopPropagation();
          if (!isEditing) onSelect(e, node);
        }}
        style={{ paddingLeft: 12 + depth * 16 }}
        className={`flex cursor-pointer select-none items-center gap-1.5 py-1 pr-2 ${
          isSelected
            ? 'bg-accent-blue/15 text-neutral-900'
            : isActive
              ? 'bg-accent-blue/10 text-accent-blue'
              : 'hover:bg-black/5'
        }`}
      >
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
        {node.isFavorite && !isEditing && <span className="ml-auto text-accent-emerald">★</span>}
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
