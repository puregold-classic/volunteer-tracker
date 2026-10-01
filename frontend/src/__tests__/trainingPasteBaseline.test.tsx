// The legacy paste tests now exercise the new training entry component.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const api = vi.hoisted(() => ({ validate: vi.fn(), search: vi.fn(), add: vi.fn() }));
vi.mock('@/services/trainingService', () => ({ trainingService: api, trainingError: (e: Error) => e.message }));
import { TrainingEntry } from '@/components/Training/TrainingEntry';
import type { TrainingSession } from '@/services/trainingService';
const person = { id: 'v1', volunteerCode: 'PG-0001', chineseName: '张三', departmentName: '笔译' };
const session: TrainingSession = { id: 's1', name: '笔译培训', serviceItemId: 'item', serviceItem: { id: 'item', name: '受训', departmentId: 'BY', category: 'TRAINING_ATTENDANCE', displayOrder: 1, isActive: true }, serviceDate: '2026-09-01', duration: 2, description: '翻译培训内容', version: 1, activeCount: 0, removedCount: 0, canEdit: true, scoped: false, total: 0, members: [] };
beforeEach(() => { vi.resetAllMocks(); api.validate.mockResolvedValue({ version: 1, rows: [{ index: 0, input: '张三', state: 'new', volunteer: person }, { index: 1, input: '未知', state: 'unmatched', reason: '未找到' }] }); api.search.mockResolvedValue([{ ...person, state: 'new' }]); api.add.mockResolvedValue({ created: ['v1'], skipped: [], removed: [], version: 2 }); });
afterEach(cleanup);
const open = () => render(<TrainingEntry session={session} changed={vi.fn()} restore={vi.fn()} />);
describe('training paste and shared draft', () => {
  it('passes a plain-name Excel column to server validation and retains unmatched input after saving', async () => {
    open();
    fireEvent.change(screen.getByLabelText('粘贴姓名名单'), { target: { value: '张三\r\n未知' } });
    await waitFor(() => expect(api.validate).toHaveBeenCalledWith('s1', '张三\n未知', {}));
    fireEvent.click(await screen.findByRole('button', { name: '加入已匹配的 1 人' }));
    await waitFor(() => expect(api.add).toHaveBeenCalledWith('s1', 1, ['v1']));
    await waitFor(() => expect(screen.getByLabelText('粘贴姓名名单')).toHaveValue('未知'));
  });
  it('deduplicates search selection and pasted results in the shared pending list', async () => {
    open();
    fireEvent.click(screen.getByRole('tab', { name: '搜索添加' }));
    fireEvent.change(screen.getByLabelText('搜索参加人员'), { target: { value: '张三' } });
    fireEvent.click(await screen.findByRole('button', { name: '添加' }));
    fireEvent.click(screen.getByRole('tab', { name: '粘贴名单' }));
    fireEvent.change(screen.getByLabelText('粘贴姓名名单'), { target: { value: '张三' } });
    await screen.findByText('可新增');
    expect(screen.getByRole('button', { name: '加入已匹配的 1 人' })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: '移除待加入 张三' })).toHaveLength(1);
  });
  it('invalidates previous preview immediately when pasted text changes', async () => {
    open();
    fireEvent.change(screen.getByLabelText('粘贴姓名名单'), { target: { value: '张三' } });
    await screen.findByText('可新增');
    api.validate.mockImplementation(() => new Promise(() => {}));
    fireEvent.change(screen.getByLabelText('粘贴姓名名单'), { target: { value: '李四' } });
    expect(screen.queryByText('可新增')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '加入已匹配的 0 人' })).toBeDisabled();
  });
  it('keeps names and pending selection when a version conflict rejects saving', async () => {
    api.add.mockRejectedValue(new Error('场次或名单已更新'));
    open();
    fireEvent.change(screen.getByLabelText('粘贴姓名名单'), { target: { value: '张三' } });
    await screen.findByText('可新增');
    fireEvent.click(screen.getByRole('button', { name: '加入已匹配的 1 人' }));
    expect(await screen.findByText('场次或名单已更新')).toBeVisible();
    expect(screen.getByLabelText('粘贴姓名名单')).toHaveValue('张三');
    expect(screen.getByRole('button', { name: '加入已匹配的 1 人' })).toBeEnabled();
  });
});
