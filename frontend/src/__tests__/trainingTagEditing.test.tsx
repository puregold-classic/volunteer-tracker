import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const api = vi.hoisted(() => ({ grouped: vi.fn(), bound: vi.fn(), updateRecord: vi.fn(), updateTraining: vi.fn(), detail: vi.fn(), replace: vi.fn() }));
vi.mock('@/services/serviceItemService', () => ({ default: { listGrouped: api.grouped } }));
vi.mock('@/services/tagService', () => ({ default: { getGroupsBoundTo: api.bound, replaceRecordTags: api.replace } }));
vi.mock('@/services/projectSupportService', () => ({ default: { update: api.updateRecord } }));
vi.mock('@/services/trainingService', () => ({ trainingService: { update: api.updateTraining, detail: api.detail }, trainingError: (e: Error) => e.message }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
import { EditRecordDialog } from '@/components/shared/edit-record-dialog';
import { LinkTagsDialog } from '@/components/shared/link-tags-dialog';
import { TrainingForm } from '@/components/Training/TrainingForm';
import type { ProjectSupport, TagGroup } from '@/services/types';
import type { TrainingSession } from '@/services/trainingService';

const record = { id: 'r1', supportId: 'PS-PG-0001-001', serviceItemId: 'old', serviceDate: '2026-09-01', duration: 2, description: '原有服务记录描述', tags: [{ attachmentId: 'a1', tagId: 't1', name: '原岗位', groupId: 'g1', group: { id: 'g1', name: '旧分类', selectionMode: 'single', opMode: 'tag_only' } }], serviceItem: { name: '原服务' } } as ProjectSupport;
const group = { id: 'g2', name: '新岗位', selectionMode: 'single', required: true, tags: [{ id: 't2', name: '新岗位标签' }] } as TagGroup;
const training = { id: 's1', name: '培训测试', serviceItemId: 'training', serviceItem: { name: '受训' }, serviceDate: '2026-09-01', duration: 2, description: '原有培训内容描述', version: 1, activeCount: 1 } as TrainingSession;
beforeEach(() => {
  vi.resetAllMocks();
  api.grouped.mockResolvedValue({ success: true, data: [{ department: { id: 'd1', name: '笔译' }, items: [{ id: 'old', name: '原服务', category: 'PROJECT_SUPPORT' }, { id: 'new', name: '新服务', category: 'PROJECT_MGMT' }, { id: 'training', name: '受训', category: 'TRAINING_ATTENDANCE' }] }] });
  api.bound.mockImplementation(async (item: string) => ({ success: true, data: item === 'new' ? [group] : [] }));
  api.updateRecord.mockResolvedValue({ success: true });
  api.replace.mockResolvedValue({ success: true });
});
afterEach(cleanup);

describe('explicit editing and conflict recovery', () => {
  it('requires explicitly removing incompatible tags and selecting required replacements before atomic save', async () => {
    render(<EditRecordDialog record={record} onOpenChange={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByRole('option', { name: '项目管理 · 新服务' });
    fireEvent.change(screen.getByLabelText('服务项'), { target: { value: 'new' } });
    await screen.findByText('新岗位标签');
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '解除上述关联并保留其他标签' }));
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '新岗位标签' }));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(api.updateRecord).toHaveBeenCalledWith(record.supportId, expect.objectContaining({ serviceItemId: 'new', tagIds: ['t2'] })));
  });
  it('allows explicitly removing historical tags that no longer appear in bound groups', async () => {
    render(<LinkTagsDialog open support={record} onOpenChange={vi.fn()} />);
    await screen.findByText('历史标签需检查');
    fireEvent.click(screen.getByRole('button', { name: '解除关联' }));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(api.replace).toHaveBeenCalledWith('r1', []));
  });
  it('refreshes the affected roster count after a version conflict while retaining typed changes', async () => {
    api.updateTraining.mockRejectedValue(new Error('场次已更新'));
    api.detail.mockResolvedValue({ ...training, version: 3, activeCount: 4, duration: 3 });
    render(<TrainingForm session={training} close={vi.fn()} saved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('时长 / 小时'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: '预览修改' }));
    fireEvent.click(screen.getByRole('button', { name: '确认同步保存' }));
    fireEvent.click(await screen.findByRole('button', { name: '刷新版本并保留填写' }));
    await screen.findByDisplayValue('5');
    fireEvent.click(screen.getByRole('button', { name: '预览修改' }));
    expect(screen.getByText('将同步更新 4 人的有效考勤')).toBeVisible();
    expect(screen.getByText('3 → 5 小时')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '确认同步保存' }));
    await waitFor(() => expect(api.updateTraining).toHaveBeenLastCalledWith('s1', expect.objectContaining({ version: 3, duration: 5 })));
  });
});
