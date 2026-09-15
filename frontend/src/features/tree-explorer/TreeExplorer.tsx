import { useCallback, useEffect, useMemo, useState } from 'react';
import { nodesApi, type NodeDto } from '../../services/nodesApi';
import { useI18n } from '../../i18n/I18nProvider';
import { TreeNode } from './TreeNode';
import { ContextMenu, type ContextMenuState } from './ContextMenu';

type SectionKey = 'recent' | 'favorites' | 'trash';

export type TreeExplorerProps = {
  onOpenNote: (nodeId: string) => void;
  activeNodeId: string | null;
};

/** VS Code style sidebar: fixed sections (Recent/Favorites/Trash) + nested folder tree with Drag & Drop. */
export function TreeExplorer({ onOpenNote, activeNodeId }: TreeExplorerProps) {
  const { t } = useI18n();
  const [rootNodes, setRootNodes] = useState<NodeDto[]>([]);
  const [childrenByParent, setChildrenByParent] = useState<Record<string, NodeDto[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    recent: true,
    favorites: true,
    trash: false,
  });
  const [sectionData, setSectionData] = useState<Record<SectionKey, NodeDto[]>>({
    recent: [],
    favorites: [],
    trash: [],
  });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const refreshRoot = useCallback(async () => {
    const children = await nodesApi.getChildren(null);
    setRootNodes(children);
  }, []);

  const refreshSections = useCallback(async () => {
    const [recent, favorites, trash] = await Promise.all([
      nodesApi.getRecent(10),
      nodesApi.getFavorites(),
      nodesApi.getTrash(),
    ]);
    setSectionData({ recent, favorites, trash });
  }, []);

  useEffect(() => {
    refreshRoot();
    refreshSections();
  }, [refreshRoot, refreshSections]);

  const loadChildren = useCallback(async (parentId: string) => {
    const children = await nodesApi.getChildren(parentId);
    setChildrenByParent((prev) => ({ ...prev, [parentId]: children }));
  }, []);

  const toggleExpand = useCallback(
    async (nodeId: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
      if (!childrenByParent[nodeId]) {
        await loadChildren(nodeId);
      }
    },
    [childrenByParent, loadChildren],
  );

  const handleCreate = useCallback(
    async (parentId: string | null, type: 'Folder' | 'Note') => {
      const name = type === 'Folder' ? t('tree.newFolder') : t('tree.newNote');
      await nodesApi.create(parentId, type, name);
      if (parentId) await loadChildren(parentId);
      else await refreshRoot();
    },
    [loadChildren, refreshRoot, t],
  );

  const handleDrop = useCallback(
    async (draggedId: string, targetParentId: string | null) => {
      if (draggedId === targetParentId) return;
      await nodesApi.move(draggedId, targetParentId, null);
      await refreshRoot();
      setChildrenByParent({});
      setExpanded(new Set());
    },
    [refreshRoot],
  );

  const handleAction = useCallback(
    async (action: string, node: NodeDto) => {
      switch (action) {
        case 'rename': {
          const name = window.prompt(t('tree.rename'), node.name);
          if (name && name !== node.name) await nodesApi.rename(node.id, name);
          break;
        }
        case 'duplicate':
          await nodesApi.duplicate(node.id);
          break;
        case 'delete':
          await nodesApi.softDelete(node.id);
          break;
        case 'restore':
          await nodesApi.restore(node.id);
          break;
        case 'deletePermanently':
          await nodesApi.hardDelete(node.id);
          break;
        case 'favorite':
          await nodesApi.toggleFavorite(node.id);
          break;
        case 'newNote':
          await handleCreate(node.id, 'Note');
          break;
        case 'newFolder':
          await handleCreate(node.id, 'Folder');
          break;
        default:
          break;
      }
      setContextMenu(null);
      await refreshRoot();
      await refreshSections();
      if (node.parentId) await loadChildren(node.parentId);
    },
    [handleCreate, loadChildren, refreshRoot, refreshSections, t],
  );

  const sections = useMemo(
    () =>
      [
        { key: 'recent' as SectionKey, icon: '🕒', label: t('nav.recent'), items: sectionData.recent },
        { key: 'favorites' as SectionKey, icon: '⭐', label: t('nav.favorites'), items: sectionData.favorites },
        { key: 'trash' as SectionKey, icon: '🗑️', label: t('nav.trash'), items: sectionData.trash },
      ] as const,
    [sectionData, t],
  );

  return (
    <div
      className="flex h-full flex-col overflow-y-auto bg-bg-elevated text-sm text-neutral-200"
      onClick={() => setContextMenu(null)}
    >
      {sections.map((section) => (
        <div key={section.key} className="border-b border-border-subtle">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 font-medium text-neutral-300 hover:bg-white/5"
            onClick={() => setOpenSections((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
          >
            <span>{openSections[section.key] ? '▾' : '▸'}</span>
            <span>{section.icon}</span>
            <span>{section.label}</span>
            <span className="ml-auto text-xs text-neutral-500">{section.items.length}</span>
          </button>
          {openSections[section.key] && (
            <div className="pb-1">
              {section.items.length === 0 && (
                <p className="px-6 py-1 text-xs text-neutral-500">{t('tree.empty')}</p>
              )}
              {section.items.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onOpenNote(node.id)}
                  className={`flex w-full items-center gap-2 px-6 py-1 text-left hover:bg-white/5 ${
                    activeNodeId === node.id ? 'bg-accent-blue/10 text-accent-blue' : ''
                  }`}
                >
                  <span>{node.type === 'Folder' ? '📁' : '📝'}</span>
                  <span className="truncate">{node.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between px-3 py-2 font-medium text-neutral-300">
        <span>{t('nav.explorer')}</span>
        <div className="flex gap-1">
          <button
            type="button"
            title={t('tree.newNote')}
            className="rounded px-1.5 hover:bg-white/10"
            onClick={() => handleCreate(null, 'Note')}
          >
            📝+
          </button>
          <button
            type="button"
            title={t('tree.newFolder')}
            className="rounded px-1.5 hover:bg-white/10"
            onClick={() => handleCreate(null, 'Folder')}
          >
            📁+
          </button>
        </div>
      </div>

      <div
        className="flex-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData('text/node-id');
          if (draggedId) handleDrop(draggedId, null);
        }}
      >
        {rootNodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            isExpanded={expanded.has(node.id)}
            childrenNodes={childrenByParent[node.id] ?? []}
            activeNodeId={activeNodeId}
            onToggleExpand={toggleExpand}
            onOpenNote={onOpenNote}
            onDrop={handleDrop}
            onContextMenu={(e, targetNode) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, node: targetNode });
            }}
            childrenByParent={childrenByParent}
            expanded={expanded}
          />
        ))}
      </div>

      {contextMenu && (
        <ContextMenu state={contextMenu} onAction={handleAction} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}
