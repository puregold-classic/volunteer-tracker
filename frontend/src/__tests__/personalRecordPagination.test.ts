import { beforeEach, describe, expect, it, vi } from 'vitest';
const get = vi.hoisted(() => vi.fn());
vi.mock('@/services/api', () => ({ api: { get } }));
import projectSupportService from '@/services/projectSupportService';
beforeEach(() => get.mockReset());
describe('complete personal records', () => {
  it('collects all pages and includes pending and removed attendance history', async () => {
    const firstPage = Array.from({ length: 100 }, (_, n) => ({ id: String(n), status: 'ACTIVE', duration: 2 }));
    get.mockResolvedValueOnce({ success: true, data: { records: firstPage, pagination: { hasNext: true } } });
    get.mockResolvedValueOnce({ success: true, data: { records: [{ id: '100', status: 'DELETED', duration: 2 }], pagination: { hasNext: false } } });
    const records = await projectSupportService.listPersonalRecords({ volunteerId: 'v1' });
    expect(records).toHaveLength(101);
    expect(records.filter((r) => r.status === 'ACTIVE').reduce((total, r) => total + r.duration, 0)).toBe(200);
    expect(get).toHaveBeenLastCalledWith('/project-supports', { params: { volunteerId: 'v1', status: ['ACTIVE', 'PENDING_CONFIRMATION', 'REJECTED_BY_OWNER', 'DELETED'], page: 2, limit: 100 } });
  });
  it('does not return a misleading partial total when a later page fails', async () => {
    get.mockResolvedValueOnce({ success: true, data: { records: [{ id: 'first' }], pagination: { hasNext: true } } });
    get.mockRejectedValueOnce(new Error('网络异常'));
    await expect(projectSupportService.listPersonalRecords({ volunteerId: 'v1' })).rejects.toThrow('网络异常');
  });
});
