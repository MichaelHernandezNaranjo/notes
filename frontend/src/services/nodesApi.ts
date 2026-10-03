import { apiJson } from './apiClient';

export type NodeType = 'Folder' | 'Note';

export type NodeDto = {
  id: string;
  parentId: string | null;
  ownerId: string;
  type: NodeType;
  name: string;
  contentJson: string | null;
  sortOrder: number;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  /** Ancestor names (root first); only set for trash listings. */
  path?: string | null;
  /** Highest trashed ancestor (or itself); only set for trash listings. */
  deletedRootId?: string | null;
};

export type NodeSearchResult = {
  id: string;
  parentId: string | null;
  name: string;
  type: NodeType;
  /** Ancestor names, root first (empty for top-level items). */
  path: string;
  /** Ancestor ids, root first (same order as `path`). */
  pathIds: string[];
};

export const nodesApi = {
  getTree: () => apiJson<NodeDto[]>('/api/nodes/tree'),
  getChildren: (parentId: string | null) =>
    apiJson<NodeDto[]>(`/api/nodes/children${parentId ? `?parentId=${parentId}` : ''}`),
  getRecent: (top = 10) => apiJson<NodeDto[]>(`/api/nodes/recent?top=${top}`),
  getFavorites: () => apiJson<NodeDto[]>('/api/nodes/favorites'),
  getShared: () => apiJson<NodeDto[]>('/api/nodes/shared'),
  search: (q: string, signal?: AbortSignal, limit = 50) =>
    apiJson<NodeSearchResult[]>(`/api/nodes/search?q=${encodeURIComponent(q)}&limit=${limit}`, { signal }),
  getTrash: () => apiJson<NodeDto[]>('/api/nodes/trash'),
  getById: (id: string) => apiJson<NodeDto>(`/api/nodes/${id}`),
  create: (parentId: string | null, type: NodeType, name: string) =>
    apiJson<NodeDto>('/api/nodes', { method: 'POST', body: JSON.stringify({ parentId, type, name }) }),
  rename: (id: string, name: string) =>
    apiJson<NodeDto>(`/api/nodes/${id}/rename`, { method: 'PUT', body: JSON.stringify({ name }) }),
  move: (id: string, newParentId: string | null, newSortOrder: number | null) =>
    apiJson<NodeDto>(`/api/nodes/${id}/move`, {
      method: 'PUT',
      body: JSON.stringify({ newParentId, newSortOrder }),
    }),
  duplicate: (id: string) => apiJson<NodeDto>(`/api/nodes/${id}/duplicate`, { method: 'POST' }),
  softDelete: (id: string) => apiJson<void>(`/api/nodes/${id}`, { method: 'DELETE' }),
  restore: (id: string) => apiJson<void>(`/api/nodes/${id}/restore`, { method: 'POST' }),
  hardDelete: (id: string) => apiJson<void>(`/api/nodes/${id}/permanent`, { method: 'DELETE' }),
  toggleFavorite: (id: string) => apiJson<boolean>(`/api/nodes/${id}/favorite`, { method: 'POST' }),
};
