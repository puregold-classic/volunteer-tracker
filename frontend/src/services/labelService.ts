import { api } from './api';
import type { ApiResponse, ProjectSupport, Tag, TagGroup } from './types';
export interface LabelDetail { tag: Tag; group: TagGroup; trainingSession?: { id: string; name: string }; records: Array<ProjectSupport & { needsReview: boolean }>; total: number; people: number; scoped: boolean }
async function unwrap<T>(request: Promise<ApiResponse<T>>) { const r = await request; if (!r.success || r.data == null) throw new Error(r.error || r.message || '操作未完成'); return r.data; }
export const labelService = {
  detail: (id: string, params: Record<string, unknown>) => unwrap<LabelDetail>(api.get(`/tags/${id}`, { params })),
  candidates: (id: string, params: Record<string, unknown>) => unwrap<{ records: ProjectSupport[]; total: number }>(api.get(`/tags/${id}/candidates`, { params })),
  record: (code: string) => unwrap<ProjectSupport>(api.get(`/tags/records/${code}`)),
  setTagActive: (id: string, isActive: boolean) => unwrap<Tag>(api.patch(`/tags/${id}`, { isActive })),
};
