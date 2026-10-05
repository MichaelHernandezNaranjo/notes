import { apiJson } from './apiClient';

export type StorageUsage = { usedBytes: number; /** null = unlimited */ quotaBytes: number | null };

export type AdminOverview = {
  stats: {
    totalUsers: number;
    blockedUsers: number;
    superAdmins: number;
    active7d: number;
    active30d: number;
    newUsers7d: number;
    notes: number;
    folders: number;
    trashedItems: number;
    images: number;
    textBytes: number;
    imageBytes: number;
    overQuotaUsers: number;
    defaultQuotaBytes: number;
  };
  online: number;
  databaseBytes: number | null;
  databaseLimitBytes: number;
  diskTotalBytes: number | null;
  diskFreeBytes: number | null;
  topUsers: Array<{ id: string; displayName: string; email: string; usedBytes: number; quotaBytes: number | null }>;
  activity: Array<{ day: string; signups: number; actions: number; activeUsers: number }>;
};

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  isActive: boolean;
  blockedAt: string | null;
  blockReason: string | null;
  isSuperAdmin: boolean;
  storageQuotaBytes: number | null;
  effectiveQuotaBytes: number | null;
  usedBytes: number;
  noteCount: number;
  isOnline: boolean;
  isRoot: boolean;
  isSelf: boolean;
};

export type AdminUsersPage = { items: AdminUser[]; total: number; page: number; pageSize: number };

export type Severity = 'Info' | 'Warning' | 'Critical';

export type Announcement = {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  createdAt: string;
  expiresAt: string | null;
};

export type AdminAnnouncement = Announcement & { targetUserId: string | null; targetName: string | null; dismissedCount: number };

export type AnnouncementInput = {
  title: string;
  message: string;
  severity: Severity;
  targetUserId?: string | null;
  expiresAt?: string | null;
};

export type UserFilter = 'all' | 'active' | 'blocked' | 'admins' | 'over' | 'online';
export type UserSort = 'lastLogin' | 'name' | 'created' | 'usage';

const json = (body: unknown) => JSON.stringify(body);

export const adminApi = {
  overview: () => apiJson<AdminOverview>('/api/admin/overview'),
  users: (params: { search?: string; filter: UserFilter; sort: UserSort; page: number; pageSize: number }) => {
    const q = new URLSearchParams({ filter: params.filter, sort: params.sort, page: String(params.page), pageSize: String(params.pageSize) });
    if (params.search?.trim()) q.set('search', params.search.trim());
    return apiJson<AdminUsersPage>(`/api/admin/users?${q.toString()}`);
  },
  block: (id: string, reason: string) => apiJson<void>(`/api/admin/users/${id}/block`, { method: 'POST', body: json({ reason }) }),
  unblock: (id: string) => apiJson<void>(`/api/admin/users/${id}/unblock`, { method: 'POST' }),
  setQuota: (id: string, quotaBytes: number | null) =>
    apiJson<void>(`/api/admin/users/${id}/quota`, { method: 'PUT', body: json({ quotaBytes }) }),
  setAdmin: (id: string, isSuperAdmin: boolean) =>
    apiJson<void>(`/api/admin/users/${id}/admin`, { method: 'PUT', body: json({ isSuperAdmin }) }),
  announcements: () => apiJson<AdminAnnouncement[]>('/api/admin/announcements'),
  createAnnouncement: (input: AnnouncementInput) =>
    apiJson<AdminAnnouncement>('/api/admin/announcements', { method: 'POST', body: json(input) }),
  updateAnnouncement: (id: string, input: AnnouncementInput) =>
    apiJson<AdminAnnouncement>(`/api/admin/announcements/${id}`, { method: 'PUT', body: json(input) }),
  deleteAnnouncement: (id: string) => apiJson<void>(`/api/admin/announcements/${id}`, { method: 'DELETE' }),
};

export const accountApi = {
  storage: () => apiJson<StorageUsage>('/api/users/me/storage'),
  pendingAnnouncements: () => apiJson<Announcement[]>('/api/announcements'),
  dismissAnnouncement: (id: string) => apiJson<void>(`/api/announcements/${id}/dismiss`, { method: 'POST' }),
};

/** Reads the machine code of a failed API call (`API error 409: {"code":"..."}`), if any. */
export function apiErrorCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : '';
  const match = message.match(/"code"\s*:\s*"([^"]+)"/);
  return match ? match[1] : null;
}
