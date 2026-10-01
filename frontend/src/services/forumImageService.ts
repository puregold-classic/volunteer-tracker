import { api } from './api';
import type { ApiResponse } from './types';
export const forumImageService = {
  upload: async (circleId: string, file: File) => {
    const response = await api.post(`/forum/circles/${circleId}/images`, file, { headers: { 'Content-Type': file.type || 'application/octet-stream' }, timeout: 60_000 }) as unknown as ApiResponse<{ id: string; width: number; height: number }>;
    if (!response.success || !response.data) throw new Error(response.message || '图片上传失败');
    return response.data;
  },
  load: (id: string, management = false, signal?: AbortSignal) => api.get(`/forum/images/${encodeURIComponent(id)}`, { responseType: 'blob', signal, params: management ? { view: 'manage' } : {} }) as unknown as Promise<Blob>,
};
