import { createContext, useContext, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from 'react';
import type { NodeDto } from '../../services/nodesApi';

export type SectionKey = 'recent' | 'favorites' | 'shared' | 'trash';

/** After this long, coming back to the explorer silently revalidates the cached data. */
export const EXPLORER_STALE_MS = 30_000;

export type ExplorerStore = {
  rootNodes: NodeDto[];
  setRootNodes: Dispatch<SetStateAction<NodeDto[]>>;
  childrenByParent: Record<string, NodeDto[]>;
  setChildrenByParent: Dispatch<SetStateAction<Record<string, NodeDto[]>>>;
  expanded: Set<string>;
  setExpanded: Dispatch<SetStateAction<Set<string>>>;
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  anchorId: string | null;
  setAnchorId: Dispatch<SetStateAction<string | null>>;
  openSections: Record<SectionKey, boolean>;
  setOpenSections: Dispatch<SetStateAction<Record<SectionKey, boolean>>>;
  sectionData: Record<SectionKey, NodeDto[]>;
  setSectionData: Dispatch<SetStateAction<Record<SectionKey, NodeDto[]>>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  /** Timestamp of the last successful load (0 = never loaded). */
  loadedAt: MutableRefObject<number>;
  /** Scroll position of the explorer panel, restored when it is shown again. */
  scrollTop: MutableRefObject<number>;
};

const ExplorerContext = createContext<ExplorerStore | undefined>(undefined);

/**
 * Holds the explorer's data and UI state above the router outlet, so navigating to Settings (or any
 * other module) and back does not throw the folder tree away. Mount it with `key={user.id}` so a
 * different user never sees another user's cached tree.
 */
export function ExplorerProvider({ children }: { children: ReactNode }) {
  const [rootNodes, setRootNodes] = useState<NodeDto[]>([]);
  const [childrenByParent, setChildrenByParent] = useState<Record<string, NodeDto[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    recent: true,
    favorites: true,
    shared: true,
    trash: false,
  });
  const [sectionData, setSectionData] = useState<Record<SectionKey, NodeDto[]>>({
    recent: [],
    favorites: [],
    shared: [],
    trash: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const loadedAt = useRef(0);
  const scrollTop = useRef(0);

  const value = useMemo<ExplorerStore>(
    () => ({
      rootNodes,
      setRootNodes,
      childrenByParent,
      setChildrenByParent,
      expanded,
      setExpanded,
      selectedIds,
      setSelectedIds,
      anchorId,
      setAnchorId,
      openSections,
      setOpenSections,
      sectionData,
      setSectionData,
      searchQuery,
      setSearchQuery,
      loadedAt,
      scrollTop,
    }),
    [rootNodes, childrenByParent, expanded, selectedIds, anchorId, openSections, sectionData, searchQuery],
  );

  return <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>;
}

export function useExplorerStore(): ExplorerStore {
  const ctx = useContext(ExplorerContext);
  if (!ctx) throw new Error('useExplorerStore must be used within an ExplorerProvider');
  return ctx;
}
