import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nodesApi, type NodeDto } from '../../services/nodesApi';
import { useI18n } from '../../i18n/I18nProvider';
import { TreeNode, type DraftNode } from './TreeNode';
import { InlineNameInput } from './InlineNameInput';
import { ContextMenu, type ContextMenuState } from './ContextMenu';

type SectionKey = 'recent' | 'favorites' | 'trash';

const DRAG_MIME = 'text/node-ids';

export type TreeExplorerProps = {
  onOpenNote: (nodeId: string) => void;
  activeNodeId: string | null;
  /** Called after a node is renamed so open views (e.g. the editor title) can refresh. */
  onRenamed?: (nodeId: string, name: string) => void;
  /** Changing this value forces a full reload of the tree and sections (e.g. after restoring from the editor). */
  refreshToken?: number;
};

/** Trash order: each trashed root first, then its trashed descendants nested below it. */
function orderTrash(items: NodeDto[]): Array<{ node: NodeDto; nested: boolean }> {
  const ids = new Set(items.map((n) => n.id));
  const roots = items.filter((n) => !n.deletedRootId || n.deletedRootId === n.id || !ids.has(n.deletedRootId));
  const out: Array<{ node: NodeDto; nested: boolean }> = [];
  for (const root of roots) {
    out.push({ node: root, nested: false });
    items
      .filter((n) => n.id !== root.id && n.deletedRootId === root.id)
      .sort((a, b) => ((a.path ?? '') + a.name).localeCompare((b.path ?? '') + b.name))
      .forEach((child) => out.push({ node: child, nested: true }));
  }
  return out;
}

/** VS Code style sidebar: fixed sections (Recent/Favorites/Trash) + nested folder tree with multi-selection and Drag & Drop. */
export function TreeExplorer({ onOpenNote, activeNodeId, onRenamed, refreshToken = 0 }: TreeExplorerProps) {
  const { t } = useI18n();
  const [rootNodes, setRootNodes] = useState<NodeDto[]>([]);
  const [childrenByParent, setChildrenByParent] = useState<Record<string, NodeDto[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
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
  const [draft, setDraft] = useState<DraftNode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  /** Reloads root, every expanded folder and the side sections (used after restore). */
  const fullRefresh = useCallback(async () => {
    await Promise.all([refreshRoot(), refreshSections(), ...[...expandedRef.current].map((id) => loadChildren(id))]);
  }, [refreshRoot, refreshSections, loadChildren]);

  const firstRefresh = useRef(true);
  useEffect(() => {
    if (firstRefresh.current) {
      firstRefresh.current = false;
      return;
    }
    void fullRefresh();
  }, [refreshToken, fullRefresh]);

  /** Reloads the children lists of the given parents (null = root). */
  const reloadParents = useCallback(
    async (parentIds: Iterable<string | null>) => {
      const unique = new Set(parentIds);
      await Promise.all(
        [...unique].map((id) => (id === null ? refreshRoot() : loadChildren(id))),
      );
    },
    [loadChildren, refreshRoot],
  );

  // ---------- Derived lookups ----------
  const nodeById = useMemo(() => {
    const map = new Map<string, NodeDto>();
    rootNodes.forEach((n) => map.set(n.id, n));
    Object.values(childrenByParent).forEach((list) => list.forEach((n) => map.set(n.id, n)));
    return map;
  }, [rootNodes, childrenByParent]);

  /** Node ids in the order they are rendered (needed for Shift+click ranges and arrow keys). */
  const visibleIds = useMemo(() => {
    const out: string[] = [];
    const walk = (nodes: NodeDto[]) => {
      for (const n of nodes) {
        out.push(n.id);
        if (n.type === 'Folder' && expanded.has(n.id)) walk(childrenByParent[n.id] ?? []);
      }
    };
    walk(rootNodes);
    return out;
  }, [rootNodes, childrenByParent, expanded]);

  const expandNode = useCallback(
    async (nodeId: string) => {
      setExpanded((prev) => new Set(prev).add(nodeId));
      await loadChildren(nodeId);
    },
    [loadChildren],
  );

  const toggleExpand = useCallback(
    async (nodeId: string) => {
      const isOpen = expanded.has(nodeId);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (isOpen) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
      if (!isOpen && !childrenByParent[nodeId]) await loadChildren(nodeId);
    },
    [expanded, childrenByParent, loadChildren],
  );

  // ---------- Selection ----------
  const handleSelect = useCallback(
    (e: React.MouseEvent, node: NodeDto) => {
      setContextMenu(null);

      if (e.ctrlKey || e.metaKey) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          return next;
        });
        setAnchorId(node.id);
        return;
      }

      if (e.shiftKey && anchorId) {
        const from = visibleIds.indexOf(anchorId);
        const to = visibleIds.indexOf(node.id);
        if (from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from];
          setSelectedIds(new Set(visibleIds.slice(start, end + 1)));
          return;
        }
      }

      setSelectedIds(new Set([node.id]));
      setAnchorId(node.id);
      if (node.type === 'Folder') void toggleExpand(node.id);
      else onOpenNote(node.id);
    },
    [anchorId, visibleIds, toggleExpand, onOpenNote],
  );

  // ---------- Creation ----------
  /** Folder selected -> inside it; note selected -> its parent folder; nothing -> root. */
  const createTargetId = useMemo<string | null>(() => {
    if (!anchorId || !selectedIds.has(anchorId)) return null;
    const node = nodeById.get(anchorId);
    if (!node) return null;
    return node.type === 'Folder' ? node.id : node.parentId;
  }, [anchorId, selectedIds, nodeById]);

  /** Lower-cased names of the live children of a folder (null = root), for duplicate detection. */
  const siblingNames = useCallback(
    (parentId: string | null): Set<string> => {
      const list = parentId === null ? rootNodes : (childrenByParent[parentId] ?? []);
      return new Set(list.map((n) => n.name.trim().toLowerCase()));
    },
    [rootNodes, childrenByParent],
  );

  /** Turns an API error into a user-facing message (409 = duplicate name). */
  const describeError = useCallback(
    (e: unknown, fallbackKey: string): Error => {
      const message = e instanceof Error ? e.message : '';
      if (message.includes('API error 409')) return new Error(t(fallbackKey));
      if (message.includes('API error 400')) return new Error(t('tree.nameEmpty'));
      return e instanceof Error ? e : new Error(t(fallbackKey));
    },
    [t],
  );

  /** Opens the inline "new item" row in the target folder (expanded) or at the root. */
  const startCreate = useCallback(
    async (parentId: string | null, type: 'Folder' | 'Note') => {
      setEditingId(null);
      if (parentId && !expanded.has(parentId)) await expandNode(parentId);
      setDraft({ parentId, type });
    },
    [expanded, expandNode],
  );

  const submitDraft = useCallback(
    async (name: string) => {
      if (!draft) return;
      try {
        const created = await nodesApi.create(draft.parentId, draft.type, name);
        setDraft(null);
        if (draft.parentId) await loadChildren(draft.parentId);
        else await refreshRoot();
        setSelectedIds(new Set([created.id]));
        setAnchorId(created.id);
        if (created.type === 'Note') onOpenNote(created.id);
        void refreshSections();
      } catch (e) {
        throw describeError(e, 'tree.nameExists');
      }
    },
    [draft, loadChildren, refreshRoot, refreshSections, onOpenNote, describeError],
  );

  const submitRename = useCallback(
    async (node: NodeDto, name: string) => {
      try {
        await nodesApi.rename(node.id, name);
        setEditingId(null);
        await reloadParents([node.parentId]);
        void refreshSections();
        onRenamed?.(node.id, name);
      } catch (e) {
        throw describeError(e, 'tree.nameExists');
      }
    },
    [reloadParents, refreshSections, onRenamed, describeError],
  );

  const cancelEdit = useCallback(() => {
    setDraft(null);
    setEditingId(null);
  }, []);

  const startRename = useCallback((node: NodeDto) => {
    setDraft(null);
    setSelectedIds(new Set([node.id]));
    setAnchorId(node.id);
    setEditingId(node.id);
  }, []);

  // ---------- Drag & Drop ----------
  const handleDragStartNode = useCallback(
    (e: React.DragEvent, node: NodeDto) => {
      const ids = selectedIds.has(node.id) ? [...selectedIds] : [node.id];
      e.dataTransfer.setData(DRAG_MIME, JSON.stringify(ids));
      e.dataTransfer.effectAllowed = 'move';
    },
    [selectedIds],
  );

  const handleDrop = useCallback(
    async (ids: string[], targetParentId: string | null) => {
      // Never move a node into itself or into one of its own descendants.
      const isBlocked = (id: string) => {
        let cursor: string | null = targetParentId;
        while (cursor) {
          if (cursor === id) return true;
          cursor = nodeById.get(cursor)?.parentId ?? null;
        }
        return false;
      };
      const movable = ids.filter((id) => !isBlocked(id) && nodeById.get(id)?.parentId !== targetParentId);
      if (movable.length === 0) return;

      const oldParents = movable.map((id) => nodeById.get(id)?.parentId ?? null);
      const results = await Promise.allSettled(movable.map((id) => nodesApi.move(id, targetParentId, null)));
      if (results.some((r) => r.status === 'rejected')) window.alert(t('tree.moveConflict'));

      if (targetParentId) setExpanded((prev) => new Set(prev).add(targetParentId));
      await reloadParents([...oldParents, targetParentId]);
    },
    [nodeById, reloadParents, t],
  );

  const readDraggedIds = (e: React.DragEvent): string[] => {
    try {
      const parsed = JSON.parse(e.dataTransfer.getData(DRAG_MIME) || '[]');
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  };

  // ---------- Actions ----------
  const deleteSelection = useCallback(
    async (nodes: NodeDto[]) => {
      if (nodes.length > 1 && !window.confirm(t('tree.confirmDeleteMany').replace('{count}', String(nodes.length)))) {
        return;
      }
      await Promise.all(nodes.map((n) => nodesApi.softDelete(n.id)));
      setSelectedIds(new Set());
      setAnchorId(null);
      await reloadParents(nodes.map((n) => n.parentId));
      await refreshSections();
    },
    [reloadParents, refreshSections, t],
  );

  const handleAction = useCallback(
    async (action: string, node: NodeDto) => {
      const targets =
        selectedIds.has(node.id) && selectedIds.size > 1
          ? [...selectedIds].map((id) => nodeById.get(id)).filter((n): n is NodeDto => !!n)
          : [node];

      setContextMenu(null);

      switch (action) {
        case 'rename':
          startRename(node);
          return;
        case 'duplicate':
          await nodesApi.duplicate(node.id);
          break;
        case 'delete':
          await deleteSelection(targets);
          return;
        case 'restore': {
          const results = await Promise.allSettled(targets.map((n) => nodesApi.restore(n.id)));
          if (results.some((r) => r.status === 'rejected')) window.alert(t('tree.restoreConflict'));
          // Restoring may also bring back trashed ancestors, so reload everything visible.
          await fullRefresh();
          return;
        }
        case 'deletePermanently':
          await Promise.all(targets.map((n) => nodesApi.hardDelete(n.id)));
          break;
        case 'favorite':
          await Promise.all(targets.map((n) => nodesApi.toggleFavorite(n.id)));
          break;
        case 'newNote':
          await startCreate(node.id, 'Note');
          return;
        case 'newFolder':
          await startCreate(node.id, 'Folder');
          return;
        default:
          break;
      }
      await reloadParents(targets.map((n) => n.parentId));
      await refreshSections();
    },
    [selectedIds, nodeById, deleteSelection, startCreate, startRename, reloadParents, refreshSections, fullRefresh, t],
  );

  // ---------- Keyboard ----------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (visibleIds.length === 0) return;
      const current = anchorId && visibleIds.includes(anchorId) ? anchorId : null;
      const index = current ? visibleIds.indexOf(current) : -1;

      const selectOnly = (id: string) => {
        setSelectedIds(new Set([id]));
        setAnchorId(id);
      };

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(visibleIds));
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectOnly(visibleIds[Math.min(index + 1, visibleIds.length - 1)]);
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectOnly(visibleIds[Math.max(index - 1, 0)]);
          break;
        case 'ArrowRight':
          if (current && nodeById.get(current)?.type === 'Folder' && !expanded.has(current)) {
            e.preventDefault();
            void toggleExpand(current);
          }
          break;
        case 'ArrowLeft':
          if (current && expanded.has(current)) {
            e.preventDefault();
            void toggleExpand(current);
          }
          break;
        case 'Enter': {
          const node = current ? nodeById.get(current) : undefined;
          if (node) {
            e.preventDefault();
            if (node.type === 'Folder') void toggleExpand(node.id);
            else onOpenNote(node.id);
          }
          break;
        }
        case 'Delete': {
          const nodes = [...selectedIds].map((id) => nodeById.get(id)).filter((n): n is NodeDto => !!n);
          if (nodes.length > 0) {
            e.preventDefault();
            void deleteSelection(nodes);
          }
          break;
        }
        case 'F2': {
          const node = current ? nodeById.get(current) : undefined;
          if (node) {
            e.preventDefault();
            startRename(node);
          }
          break;
        }
        default:
          break;
      }
    },
    [visibleIds, anchorId, nodeById, expanded, selectedIds, toggleExpand, onOpenNote, deleteSelection, startRename],
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
      className="flex h-full flex-col overflow-y-auto bg-bg-elevated text-sm text-neutral-800 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => setContextMenu(null)}
    >
      {sections.map((section) => (
        <div key={section.key} className="border-b border-border-subtle">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 font-medium text-neutral-700 hover:bg-black/5"
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
              {(section.key === 'trash' ? orderTrash(section.items) : section.items.map((n) => ({ node: n, nested: false }))).map(
                ({ node, nested }) => (
                  <button
                    key={node.id}
                    type="button"
                    title={section.key === 'trash' && node.path ? `${node.path} / ${node.name}` : node.name}
                    // Folders are not notes: they must never open the editor from these lists.
                    onClick={() => node.type === 'Note' && onOpenNote(node.id)}
                    onContextMenu={(e) => {
                      if (section.key !== 'trash') return;
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, node, count: 1 });
                    }}
                    style={{ paddingLeft: nested ? 40 : 24 }}
                    className={`flex w-full items-center gap-2 py-1 pr-3 text-left hover:bg-black/5 ${
                      activeNodeId === node.id ? 'bg-accent-blue/10 text-accent-blue' : ''
                    }`}
                  >
                    <span>{node.type === 'Folder' ? '📁' : '📝'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{node.name}</span>
                      {section.key === 'trash' && (
                        <span className="block truncate text-xs text-neutral-500">
                          {node.path ? node.path : t('tree.rootLocation')}
                        </span>
                      )}
                    </span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between px-3 py-2 font-medium text-neutral-700">
        <span>
          {t('nav.explorer')}
          {selectedIds.size > 1 && (
            <span className="ml-2 text-xs font-normal text-neutral-500">({selectedIds.size})</span>
          )}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            title={t('tree.newNote')}
            className="rounded px-1.5 hover:bg-black/10"
            onClick={(e) => {
              e.stopPropagation();
              void startCreate(createTargetId, 'Note');
            }}
          >
            📝+
          </button>
          <button
            type="button"
            title={t('tree.newFolder')}
            className="rounded px-1.5 hover:bg-black/10"
            onClick={(e) => {
              e.stopPropagation();
              void startCreate(createTargetId, 'Folder');
            }}
          >
            📁+
          </button>
        </div>
      </div>

      <div
        role="tree"
        aria-multiselectable="true"
        className="flex-1"
        onClick={() => {
          setSelectedIds(new Set());
          setAnchorId(null);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const ids = readDraggedIds(e);
          if (ids.length > 0) void handleDrop(ids, null);
        }}
      >
        {draft && draft.parentId === null && (
          <div style={{ paddingLeft: 12 }} className="flex items-center gap-1.5 py-1 pr-2">
            <span className="w-3" />
            <span>{draft.type === 'Folder' ? '📁' : '📝'}</span>
            <InlineNameInput takenNames={siblingNames(null)} onSubmit={submitDraft} onCancel={cancelEdit} />
          </div>
        )}
        {rootNodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            isExpanded={expanded.has(node.id)}
            childrenNodes={childrenByParent[node.id] ?? []}
            activeNodeId={activeNodeId}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onDragStartNode={handleDragStartNode}
            onDropOnFolder={(e, targetId) => {
              const ids = readDraggedIds(e);
              if (ids.length > 0) void handleDrop(ids, targetId);
            }}
            onContextMenu={(e, targetNode) => {
              e.preventDefault();
              e.stopPropagation();
              if (!selectedIds.has(targetNode.id)) {
                setSelectedIds(new Set([targetNode.id]));
                setAnchorId(targetNode.id);
              }
              const count = selectedIds.has(targetNode.id) ? selectedIds.size : 1;
              setContextMenu({ x: e.clientX, y: e.clientY, node: targetNode, count });
            }}
            childrenByParent={childrenByParent}
            expanded={expanded}
            editingId={editingId}
            draft={draft}
            siblingNames={siblingNames}
            onStartRename={startRename}
            onSubmitRename={submitRename}
            onSubmitDraft={submitDraft}
            onCancelEdit={cancelEdit}
          />
        ))}
      </div>

      {contextMenu && (
        <ContextMenu state={contextMenu} onAction={handleAction} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}
