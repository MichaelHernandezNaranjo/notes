import { apiJson } from './apiClient';

export type NodePermissionDto = {
  id: string;
  nodeId: string;
  granteeType: 'User' | 'Group' | 'PublicLink';
  granteeId: string | null;
  accessLevel: 'Read' | 'Edit';
  shareToken: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  userDisplayName: string | null;
  userEmail: string | null;
  groupName: string | null;
};

export const permissionsApi = {
  list: (nodeId: string) => apiJson<NodePermissionDto[]>(`/api/nodes/${nodeId}/permissions`),
  grant: (nodeId: string, granteeType: string, granteeId: string | null, accessLevel: string, expiresAt: string | null) =>
    apiJson<NodePermissionDto>(`/api/nodes/${nodeId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ granteeType, granteeId, accessLevel, expiresAt }),
    }),
  createShareLink: (nodeId: string, accessLevel: string, expiresAt: string | null) =>
    apiJson<NodePermissionDto>(`/api/nodes/${nodeId}/permissions/link`, {
      method: 'POST',
      body: JSON.stringify({ accessLevel, expiresAt }),
    }),
  revoke: (nodeId: string, permissionId: string) =>
    apiJson<void>(`/api/nodes/${nodeId}/permissions/${permissionId}`, { method: 'DELETE' }),
};
