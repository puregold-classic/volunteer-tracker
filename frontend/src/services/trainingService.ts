import { api } from './api';
import type { ApiResponse, ServiceItem } from './types';

export interface TrainingPerson { id: string; volunteerCode: string; chineseName: string; englishName?: string; departmentName: string; state?: string }
export interface TrainingSession {
  id: string; name: string; serviceItemId: string; serviceItem: ServiceItem;
  serviceDate: string; duration: number; description: string; version: number;
  activeCount: number; removedCount: number; canEdit: boolean; scoped: boolean;
  total: number; members: Array<{ id: string; volunteer: TrainingPerson; removedAt: string | null; support: { supportId: string } }>;
}
export interface TrainingInput { name: string; serviceItemId: string; serviceDate: string; duration: number; description: string; version?: number }
export interface TrainingPreview { version: number; rows: Array<{ index: number; input: string; state: string; reason?: string; volunteer?: TrainingPerson; candidates?: TrainingPerson[] }> }
async function unwrap<T>(promise: Promise<ApiResponse<T>>) {
  const result = await promise;
  if (!result.success || result.data == null) throw new Error(result.error || result.message || '操作未完成，请重试');
  return result.data;
}
export const trainingService = {
  list: (params: Record<string, unknown>) => unwrap<{ items: TrainingSession[]; total: number; scoped: boolean }>(api.get('/training', { params })),
  detail: (id: string, params: Record<string, unknown> = {}) => unwrap<TrainingSession>(api.get(`/training/${id}`, { params })),
  create: (data: TrainingInput) => unwrap<TrainingSession>(api.post('/training', data)),
  update: (id: string, data: TrainingInput) => unwrap<TrainingSession>(api.patch(`/training/${id}`, data)),
  validate: (id: string, text: string, choices: Record<number, string>) => unwrap<TrainingPreview>(api.post(`/training/${id}/validate`, { text, choices })),
  search: (id: string, search: string) => unwrap<TrainingPerson[]>(api.get(`/training/${id}/search`, { params: { search } })),
  add: (id: string, version: number, volunteerIds: string[]) => unwrap<{ created: string[]; skipped: string[]; removed: string[]; version: number }>(api.post(`/training/${id}/members`, { version, volunteerIds })),
  remove: (id: string, personId: string, version: number, restore = false) => unwrap<unknown>(api.post(`/training/${id}/members/${personId}/${restore ? 'restore' : 'remove'}`, { version })),
};
export const trainingError = (e: unknown) => e instanceof Error ? e.message : (e as { error?: string; message?: string })?.error || (e as { message?: string })?.message || '暂时无法完成操作，请重试';
