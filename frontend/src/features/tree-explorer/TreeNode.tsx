import type { NodeDto } from '../../services/nodesApi';

type TreeNodeProps = {
  node: NodeDto;
  depth: number;
  isExpanded: boolean;
  childrenNodes: NodeDto[];
  activeNodeId: string | null;
  onToggleExpand: (nodeId: string) => void;
  onOpenNote: (nodeId: string) => void;
  onDrop: (draggedId: string, targetParentId: string | null) => void;
  onContextMenu: (e: React.MouseEvent, node: NodeDto) => void;
  childrenByParent: Record<string, NodeDto[]>;
  expanded: Set<string>;
};

/** Recursive tree row supporting native HTML5 Drag & Drop and a right-click context menu. */
export function TreeNode({
  node,
  depth,
  isExpanded,
  childrenNodes,
  activeNodeId,
  onToggleExpand,
  onOpenNote,
  onDrop,
  onContextMenu,
  childrenByParent,
  expanded,
}: TreeNodeProps) {
  const isFolder = node.type === 'Folder';

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/node-id', node.id)}
        onDragOver={(e) => {
          if (isFolder) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!isFolder) return;
          e.preventDefault();
          e.stopPropagation();
          const draggedId = e.dataTransfer.getData('text/node-id');
          if (draggedId) onDrop(draggedId, node.id);
        }}
        onContextMenu={(e) => onContextMenu(e, node)}
        onClick={() => (isFolder ? onToggleExpand(node.id) : onOpenNote(node.id))}
        style={{ paddingLeft: 12 + depth * 16 }}
        className={`flex cursor-pointer items-center gap-1.5 py-1 pr-2 hover:bg-white/5 ${
          activeNodeId === node.id ? 'bg-accent-blue/10 text-accent-blue' : ''
        }`}
      >
        {isFolder ? <span className="w-3 text-xs">{isExpanded ? '▾' : '▸'}</span> : <span className="w-3" />}
        <span>{isFolder ? '📁' : '📝'}</span>
        <span className="truncate">{node.name}</span>
        {node.isFavorite && <span className="ml-auto text-accent-emerald">★</span>}
      </div>

      {isFolder && isExpanded && (
        <div>
          {childrenNodes.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isExpanded={expanded.has(child.id)}
              childrenNodes={childrenByParent[child.id] ?? []}
              activeNodeId={activeNodeId}
              onToggleExpand={onToggleExpand}
              onOpenNote={onOpenNote}
              onDrop={onDrop}
              onContextMenu={onContextMenu}
              childrenByParent={childrenByParent}
              expanded={expanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
