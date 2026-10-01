import { api } from './api';
import type { ApiResponse, ForumAccount, ForumCircle } from './types';
const unwrap = async <T>(request: Promise<unknown>): Promise<T> => {
  const response = await request as ApiResponse<T>;
  if (!response.success || response.data === undefined) throw new Error(response.message || '请求失败');
  return response.data;
};
const root = '/forum/circles';
export const forumService = {
  list: (view: 'active' | 'manage' = 'active') => unwrap<{ circles: ForumCircle[]; canCreateCircle: boolean }>(api.get(root, { params: { view } })),
  get: (slug: string, management = false) => unwrap<ForumCircle>(api.get(`${root}/${encodeURIComponent(slug)}`, { params: management ? { view: 'manage' } : {} })),
  create: (data: { name: string; slug: string; description: string; ownerIds: string[] }) => unwrap<ForumCircle>(api.post(root, data)),
  update: (id: string, data: { name: string; description: string; slug?: string }) => unwrap<ForumCircle>(api.patch(`${root}/${id}`, data)),
  archive: (id: string, archived: boolean) => unwrap<ForumCircle>(archived ? api.post(`${root}/${id}/archive`) : api.delete(`${root}/${id}/archive`)),
  setRole: (id: string, accountId: string, role: 'OWNER' | 'STEWARD', remove = false) => {
    const url = `${root}/${id}/${role === 'OWNER' ? 'owners' : 'stewards'}/${accountId}`;
    return unwrap<ForumCircle>(remove ? api.delete(url) : api.put(url));
  },
  transfer: (id: string, fromAccountId: string, toAccountId: string) => unwrap<ForumCircle>(api.post(`${root}/${id}/transfer`, { fromAccountId, toAccountId })),
  mentions: (circleId: string, search: string, signal?: AbortSignal) => unwrap<ForumAccount[]>(api.get(`${root}/${circleId}/mentions`, { params: { search }, signal })),
  candidates: (search: string, circleId?: string) => unwrap<ForumAccount[]>(api.get(circleId ? `${root}/${circleId}/candidates` : '/forum/accounts', { params: { search } })),
};
export const forumError = (error: unknown) => error instanceof Error ? error.message : (error as { message?: string })?.message || '操作失败，请稍后重试';
