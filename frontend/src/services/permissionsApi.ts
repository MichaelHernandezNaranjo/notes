import { apiJson, apiUrl } from './apiClient';

export type AccessLevel = 'Read' | 'Edit';

export type PersonAccess = {
  id: string;
  granteeType: 'User' | 'Group';
  accessLevel: AccessLevel;
  createdAt: string;
  expiresAt: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  /** True when the access comes from a parent folder (managed on that folder). */
  inherited: boolean;
  sourceNodeId: string;
  sourceNodeName: string | null;
};

export type Invitation = { id: string; email: string; accessLevel: AccessLevel; createdAt: string; expiresAt: string };
export type ShareLink = { token: string; createdAt: string; expiresAt: string | null; viewCount: number };
export type Sharing = { people: PersonAccess[]; invitations: Invitation[]; link: ShareLink | null };

const json = (body: unknown) => JSON.stringify(body);

export const sharingApi = {
  get: (nodeId: string) => apiJson<Sharing>(`/api/nodes/${nodeId}/sharing`),
  share: (nodeId: string, email: string, accessLevel: AccessLevel) =>
    apiJson<{ kind: 'Permission' | 'Invitation'; id: string; email: string }>(`/api/nodes/${nodeId}/sharing/people`, {
      method: 'POST',
      body: json({ email, accessLevel }),
    }),
  update: (nodeId: string, permissionId: string, accessLevel: AccessLevel, expiresAt: string | null = null) =>
    apiJson<void>(`/api/nodes/${nodeId}/sharing/people/${permissionId}`, { method: 'PUT', body: json({ accessLevel, expiresAt }) }),
  revoke: (nodeId: string, permissionId: string) =>
    apiJson<void>(`/api/nodes/${nodeId}/sharing/people/${permissionId}`, { method: 'DELETE' }),
  revokeInvitation: (nodeId: string, invitationId: string) =>
    apiJson<void>(`/api/nodes/${nodeId}/sharing/invitations/${invitationId}`, { method: 'DELETE' }),
  enableLink: (nodeId: string, expiresAt: string | null, regenerate = false) =>
    apiJson<ShareLink>(`/api/nodes/${nodeId}/sharing/link`, { method: 'PUT', body: json({ expiresAt, regenerate }) }),
  disableLink: (nodeId: string) => apiJson<void>(`/api/nodes/${nodeId}/sharing/link`, { method: 'DELETE' }),
};

export type PublicTreeNode = { id: string; parentId: string | null; type: 'Folder' | 'Note'; name: string };
export type PublicShare = { nodeId: string; name: string; type: 'Folder' | 'Note'; expiresAt: string | null; tree: PublicTreeNode[] };
export type PublicNode = { id: string; type: 'Folder' | 'Note'; name: string; state: string | null };

/** Anonymous API: plain fetch, never sends credentials. */
async function publicJson<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path), { credentials: 'omit' });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return (await response.json()) as T;
}

export const publicApi = {
  get: (token: string) => publicJson<PublicShare>(`/api/public/${token}`),
  node: (token: string, nodeId: string) => publicJson<PublicNode>(`/api/public/${token}/nodes/${nodeId}`),
  fileUrl: (token: string, fileId: string) => apiUrl(`/api/public/${token}/files/${fileId}`),
};

