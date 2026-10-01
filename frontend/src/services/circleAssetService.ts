import { api } from './api';
import type { ApiResponse, CircleFile, CircleFilePage } from './types';
const unwrap = async <T>(request: Promise<unknown>) => {
  const response = await request as ApiResponse<T>;
  if (!response.success || response.data === undefined) throw new Error(response.message || '操作失败');
  return response.data;
};
export const circleAssetService = {
  upload: (circleId: string, file: File, cover = false, signal?: AbortSignal) => unwrap<CircleFile>(api.post(`/forum/circles/${circleId}/${cover ? 'cover' : 'files'}`, file, { timeout: 90_000, signal, headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) } })),
  list: (circleId: string, page: number, management: boolean) => unwrap<CircleFilePage>(api.get(`/forum/circles/${circleId}/files`, { params: { page, ...(management ? { view: 'manage' } : {}) } })),
  load: (id: string, management = false, signal?: AbortSignal) => api.get(`/forum/assets/${encodeURIComponent(id)}`, { responseType: 'blob', signal, timeout: 90_000, params: management ? { view: 'manage' } : {} }) as unknown as Promise<Blob>,
  remove: (id: string) => unwrap<{ id: string }>(api.delete(`/forum/assets/${id}`)),
  restore: (id: string) => unwrap<{ id: string }>(api.post(`/forum/assets/${id}/restore`)),
};
