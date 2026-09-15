import { apiJson } from './apiClient';

export type GroupDto = { id: string; name: string; description: string | null; createdBy: string; createdAt: string; role?: string };
export type GroupMemberDto = {
  groupId: string;
  userId: string;
  role: string;
  joinedAt: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export const groupsApi = {
  list: () => apiJson<GroupDto[]>('/api/groups'),
  create: (name: string, description: string | null) =>
    apiJson<GroupDto>('/api/groups', { method: 'POST', body: JSON.stringify({ name, description }) }),
  getMembers: (groupId: string) => apiJson<GroupMemberDto[]>(`/api/groups/${groupId}/members`),
  addMember: (groupId: string, userId: string, role: string) =>
    apiJson<void>(`/api/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ userId, role }) }),
  removeMember: (groupId: string, userId: string) =>
    apiJson<void>(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  delete: (groupId: string) => apiJson<void>(`/api/groups/${groupId}`, { method: 'DELETE' }),
};
