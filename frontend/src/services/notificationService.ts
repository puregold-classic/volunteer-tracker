import { api } from './api';
import type { ApiResponse, ForumPageResult } from './types';
export interface NotificationItem {
  id: string; type: string; actor: { name: string; isDeleted: boolean }; summary: string;
  contextTitle: string | null; createdAt: string; readAt: string | null;
  href: string | null; unavailableReason: string | null;
}
export interface NotificationPage extends ForumPageResult<NotificationItem> {
  unreadCount: number; viewedAt: string; filter: 'all' | 'unread';
}
const unwrap = async <T>(request: Promise<unknown>): Promise<T> => {
  const response = await request as ApiResponse<T>;
  if (!response.success || response.data === undefined) throw new Error(response.message || '请求失败');
  return response.data;
};
export const notificationService = {
  list: async (filter: 'all' | 'unread', page: number) => {
    const response = await api.get('/notifications', { params: { filter, page } }) as unknown as NotificationPage & { success: boolean; message?: string };
    if (!response.success) throw new Error(response.message || '消息加载失败');
    return response;
  },
  unreadCount: () => unwrap<{ unreadCount: number }>(api.get('/notifications/unread-count')),
  markRead: (id: string) => unwrap<NotificationItem>(api.patch(`/notifications/${encodeURIComponent(id)}/read`)),
  readAll: (viewedAt: string) => unwrap<{ updatedCount: number }>(api.post('/notifications/read-all', { viewedAt })),
};
