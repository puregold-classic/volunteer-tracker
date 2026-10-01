import { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PostForm } from '@/components/Forum/PostForm';
import { forumDraftKey, readForumDraft, writeForumDraft } from '@/components/Forum/forumDraft';
import type { ForumBodyFormat } from '@/services/types';

const auth = vi.hoisted(() => ({ account: { id: 'alice' } as { id: string } | null }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
// The editor's formatting and rendering have dedicated tests. Exercise form
// lifecycle here with its serialized rich document, including image references.
vi.mock('@/components/Forum/RichTextEditor', () => ({ RichTextEditor: ({ initialBody, initialFormat, label, onChange, onUploading, disabled }: { initialBody: string; initialFormat: ForumBodyFormat; label: string; onChange: (value: string, valid: boolean) => void; onUploading: (uploading: boolean) => void; disabled: boolean }) => {
  const [value, setValue] = useState(initialFormat === 'RICH_TEXT' ? initialBody : '');
  useEffect(() => { onChange(value, !!value); }, []);
  return <><textarea aria-label={label} value={value} disabled={disabled} onChange={event => { setValue(event.target.value); onChange(event.target.value, !!event.target.value); }} /><button type="button" onClick={() => onUploading(true)}>模拟开始上传</button><button type="button" onClick={() => onUploading(false)}>模拟上传完成</button></>;
} }));
const rich = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '未完成的分享', marks: [{ type: 'bold' }] }] }, { type: 'forumImage', attrs: { imageId: 'image-draft-123', width: 75, annotations: [] } }] });
const key = forumDraftKey('alice', 'post:circle-one');
const props = { circleId: 'circle-one', draftScope: 'post:circle-one', submitLabel: '发布帖子' };
beforeEach(() => { localStorage.clear(); auth.account = { id: 'alice' }; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('restores title, formatting and uploaded image references after closing and reopening', () => {
  const save = vi.fn();
  const first = render(<PostForm {...props} save={save} />);
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: '草稿标题' } });
  fireEvent.change(screen.getByLabelText('正文'), { target: { value: rich } });
  first.unmount();
  render(<PostForm {...props} save={save} />);
  expect(screen.getByLabelText('标题')).toHaveValue('草稿标题');
  expect(screen.getByLabelText('正文')).toHaveValue(rich);
  expect(save).not.toHaveBeenCalled();
});
it('isolates drafts by account, circle and post, including account switches', () => {
  writeForumDraft(key, 'Alice的草稿', rich, 'RICH_TEXT');
  const { rerender } = render(<PostForm {...props} save={vi.fn()} />);
  auth.account = { id: 'bob' };
  rerender(<PostForm {...props} save={vi.fn()} />);
  expect(screen.getByLabelText('标题')).toHaveValue('');
  expect(readForumDraft(key).draft?.title).toBe('Alice的草稿');
  auth.account = { id: 'alice' };
  rerender(<PostForm {...props} circleId="circle-two" draftScope="post:circle-two" save={vi.fn()} />);
  expect(screen.getByLabelText('标题')).toHaveValue('');
  writeForumDraft(forumDraftKey('alice', 'comment:circle-one:post-one'), '', rich, 'RICH_TEXT');
  rerender(<PostForm {...props} comment draftScope="comment:circle-one:post-two" save={vi.fn()} />);
  expect(screen.getByLabelText('评论')).toHaveValue('');
});
it('keeps drafts when publication fails and clears only the published draft after success', async () => {
  writeForumDraft(key, '稍后发布', rich, 'RICH_TEXT');
  const other = forumDraftKey('alice', 'post:circle-two');
  writeForumDraft(other, '保留其他草稿', rich, 'RICH_TEXT');
  const save = vi.fn().mockRejectedValueOnce(new Error('网络失败')).mockResolvedValueOnce(undefined);
  render(<PostForm {...props} save={save} />);
  fireEvent.click(screen.getByRole('button', { name: '发布帖子' }));
  await screen.findByRole('alert');
  expect(readForumDraft(key).draft?.body).toBe(rich);
  fireEvent.click(screen.getByRole('button', { name: '发布帖子' }));
  await waitFor(() => expect(screen.getByLabelText('正文')).toHaveValue(''));
  expect(localStorage.getItem(key)).toBeNull();
  expect(readForumDraft(other).draft?.title).toBe('保留其他草稿');
});
it('persists replies without a title and clears the reply editor after publishing', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const scope = 'comment:circle-one:post-one';
  const { unmount } = render(<PostForm {...props} comment draftScope={scope} submitLabel="发表评论" save={save} />);
  fireEvent.change(screen.getByLabelText('评论'), { target: { value: rich } });
  unmount();
  render(<PostForm {...props} comment draftScope={scope} submitLabel="发表评论" save={save} />);
  expect(screen.getByLabelText('评论')).toHaveValue(rich);
  fireEvent.click(screen.getByRole('button', { name: '发表评论' }));
  await waitFor(() => expect(screen.getByLabelText('评论')).toHaveValue(''));
  expect(localStorage.getItem(forumDraftKey('alice', scope))).toBeNull();
});
it('reports storage failures while retaining the editable content', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
  render(<PostForm {...props} save={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('正文'), { target: { value: rich } });
  expect(screen.getByLabelText('正文')).toHaveValue(rich);
  expect(screen.getByRole('status')).toHaveTextContent('草稿未保存');
});
it('requires confirmation before discarding a draft', () => {
  writeForumDraft(key, '需要确认', rich, 'RICH_TEXT');
  render(<PostForm {...props} save={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '清空草稿' }));
  expect(readForumDraft(key).draft).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '确认清空' }));
  expect(localStorage.getItem(key)).toBeNull();
  expect(screen.getByLabelText('标题')).toHaveValue('');
});
it('editing published content never overwrites an unfinished new post', () => {
  writeForumDraft(key, '保留新帖草稿', rich, 'RICH_TEXT');
  render(<PostForm circleId="circle-one" initialTitle="已发布帖子" initialBody={rich} initialFormat="RICH_TEXT" submitLabel="保存修改" save={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: '修改已发布帖子' } });
  expect(readForumDraft(key).draft?.title).toBe('保留新帖草稿');
});

it('moves the latest title and rich image content directly to the floating draft despite storage failure', () => {
  writeForumDraft(key, '存储中的旧标题', rich, 'RICH_TEXT');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
  const seed = { title: '浮窗传入的标题', body: rich.replace('未完成的分享', '传入的图文'), bodyFormat: 'RICH_TEXT' as const };
  const onDraftChange = vi.fn(), onPopOut = vi.fn();
  render(<PostForm {...props} draftValue={seed} onDraftChange={onDraftChange} onPopOut={onPopOut} save={vi.fn()} />);
  expect(screen.getByLabelText('标题')).toHaveValue(seed.title);
  expect(screen.getByLabelText('正文')).toHaveValue(seed.body);
  expect(onDraftChange).toHaveBeenLastCalledWith(seed);
  const updatedBody = rich.replace('未完成的分享', '最新修改');
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: '刚修改的标题' } });
  fireEvent.change(screen.getByLabelText('正文'), { target: { value: updatedBody } });
  fireEvent.click(screen.getByRole('button', { name: '弹出草稿' }));
  const expected = { title: '刚修改的标题', body: updatedBody, bodyFormat: 'RICH_TEXT' };
  expect(onPopOut).toHaveBeenCalledExactlyOnceWith(expected);
  expect(onDraftChange).toHaveBeenLastCalledWith(expected);
  expect(screen.getByRole('status')).toHaveTextContent('草稿未保存');
});
it('locks draft transfer and publication while images upload or publication is pending', async () => {
  let resolveSave!: () => void;
  const save = vi.fn(() => new Promise<void>(resolve => { resolveSave = resolve; }));
  const onPopOut = vi.fn(), onActivityChange = vi.fn();
  render(<PostForm {...props} draftValue={{ title: '草稿', body: rich, bodyFormat: 'RICH_TEXT' }} save={save} onPopOut={onPopOut} onActivityChange={onActivityChange} />);
  expect(onActivityChange).toHaveBeenLastCalledWith({ busy: false, uploading: false });
  fireEvent.click(screen.getByRole('button', { name: '模拟开始上传' }));
  expect(onActivityChange).toHaveBeenLastCalledWith({ busy: false, uploading: true });
  expect(screen.getByRole('button', { name: '弹出草稿' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '发布帖子' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '弹出草稿' }));
  fireEvent.click(screen.getByRole('button', { name: '发布帖子' }));
  expect(onPopOut).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '模拟上传完成' }));
  expect(screen.getByRole('button', { name: '弹出草稿' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '发布帖子' }));
  expect(onActivityChange).toHaveBeenLastCalledWith({ busy: true, uploading: false });
  expect(screen.getByRole('button', { name: '弹出草稿' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '弹出草稿' }));
  expect(onPopOut).not.toHaveBeenCalled();
  await act(async () => resolveSave());
  expect(onActivityChange).toHaveBeenLastCalledWith({ busy: false, uploading: false });
});
it('honors a occupied-window lock and does not add a pop-out button to ordinary published-content editing', () => {
  const onPopOut = vi.fn();
  const { rerender } = render(<PostForm {...props} save={vi.fn()} onPopOut={onPopOut} popOutDisabled />);
  expect(screen.getByRole('button', { name: '弹出草稿' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '弹出草稿' }));
  expect(onPopOut).not.toHaveBeenCalled();
  rerender(<PostForm circleId="circle-one" initialTitle="已发布帖子" initialBody={rich} initialFormat="RICH_TEXT" submitLabel="保存修改" save={vi.fn()} />);
  expect(screen.queryByRole('button', { name: '弹出草稿' })).not.toBeInTheDocument();
});
it('notifies publication only after success, draft removal and the empty-draft handoff', async () => {
  const onDraftChange = vi.fn();
  const onPublished = vi.fn(() => {
    expect(localStorage.getItem(key)).toBeNull();
    expect(onDraftChange).toHaveBeenLastCalledWith({ title: '', body: '', bodyFormat: 'MARKDOWN' });
  });
  const save = vi.fn().mockRejectedValueOnce(new Error('网络失败')).mockResolvedValueOnce(undefined);
  render(<PostForm {...props} draftValue={{ title: '草稿', body: rich, bodyFormat: 'RICH_TEXT' }} save={save} onDraftChange={onDraftChange} onPublished={onPublished} />);
  fireEvent.click(screen.getByRole('button', { name: '发布帖子' }));
  await screen.findByRole('alert');
  expect(onPublished).not.toHaveBeenCalled();
  expect(onDraftChange).toHaveBeenLastCalledWith({ title: '草稿', body: rich, bodyFormat: 'RICH_TEXT' });
  fireEvent.click(screen.getByRole('button', { name: '发布帖子' }));
  await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText('标题')).toHaveValue('');
  expect(screen.getByLabelText('正文')).toHaveValue('');
});

it('restores an edit’s title, rich images and original server revision without touching a new-post draft', async () => {
  const scope = 'edit-post:circle-one:published-post';
  const editKey = forumDraftKey('alice', scope);
  const originalRevision = '2026-09-30T13:00:00.000Z';
  const newerRevision = '2026-09-30T14:00:00.000Z';
  const editedBody = rich.replace('未完成的分享', '正在编辑已经发布的内容');
  const editingProps = { ...props, draftScope: scope, initialTitle: '原帖子', initialBody: rich, initialFormat: 'RICH_TEXT' as const, initialUpdatedAt: originalRevision, submitLabel: '保存修改' };
  writeForumDraft(key, '另一个新帖草稿', rich, 'RICH_TEXT');
  const save = vi.fn().mockRejectedValueOnce(new Error('内容已被其他人修改')).mockResolvedValueOnce(undefined);
  const original = render(<PostForm {...editingProps} save={save} />);
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: '  编辑中的标题  ' } });
  fireEvent.change(screen.getByLabelText('正文'), { target: { value: editedBody } });
  expect(readForumDraft(editKey).draft).toMatchObject({ title: '  编辑中的标题  ', body: editedBody, updatedAt: originalRevision });
  original.unmount();
  render(<PostForm {...editingProps} initialTitle="服务器上的新标题" initialUpdatedAt={newerRevision} save={save} />);
  expect(screen.getByLabelText('标题')).toHaveValue('  编辑中的标题  ');
  expect(screen.getByLabelText('正文')).toHaveValue(editedBody);
  fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
  await screen.findByRole('alert');
  expect(save).toHaveBeenLastCalledWith({ title: '编辑中的标题', body: editedBody, bodyFormat: 'RICH_TEXT', updatedAt: originalRevision });
  expect(readForumDraft(editKey).draft?.updatedAt).toBe(originalRevision);
  expect(readForumDraft(editKey).draft?.body).toBe(editedBody);
  expect(readForumDraft(key).draft?.title).toBe('另一个新帖草稿');
  fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
  await waitFor(() => expect(screen.getByLabelText('正文')).toHaveValue(''));
  expect(localStorage.getItem(editKey)).toBeNull();
  expect(readForumDraft(key).draft?.title).toBe('另一个新帖草稿');
});
it.each([undefined, '2026-09-30T15:00:00.000Z'])('keeps the transferred content and its exact revision together (%s)', updatedAt => {
  const oldRevision = '2026-09-30T13:00:00.000Z';
  const initialUpdatedAt = '2026-09-30T14:00:00.000Z';
  writeForumDraft(key, '存储中的旧内容', rich, 'RICH_TEXT', oldRevision);
  const draftValue = { title: '刚刚交接的内容', body: rich.replace('未完成的分享', '浮窗交接'), bodyFormat: 'RICH_TEXT' as const, ...(updatedAt !== undefined ? { updatedAt } : {}) };
  const onPopOut = vi.fn(), onDraftChange = vi.fn();
  const { rerender } = render(<PostForm {...props} initialUpdatedAt={initialUpdatedAt} draftValue={draftValue} save={vi.fn()} onPopOut={onPopOut} onDraftChange={onDraftChange} />);
  expect(onDraftChange).toHaveBeenLastCalledWith(draftValue);
  rerender(<PostForm {...props} initialUpdatedAt="2026-09-30T16:00:00.000Z" draftValue={draftValue} save={vi.fn()} onPopOut={onPopOut} onDraftChange={onDraftChange} />);
  fireEvent.click(screen.getByRole('button', { name: '弹出草稿' }));
  expect(onPopOut).toHaveBeenLastCalledWith(draftValue);
  expect(readForumDraft(key).draft?.updatedAt).toBe(updatedAt);
  if (updatedAt === undefined) expect(onPopOut.mock.calls[0][0]).not.toHaveProperty('updatedAt');
});
it('rejects invalid saved edit revisions while continuing to read older drafts without a revision', () => {
  writeForumDraft(key, '兼容旧草稿', rich, 'RICH_TEXT');
  const original = JSON.parse(localStorage.getItem(key)!);
  expect(readForumDraft(key).draft?.title).toBe('兼容旧草稿');
  for (const updatedAt of ['', 42, null, 'not-a-date']) {
    localStorage.setItem(key, JSON.stringify({ ...original, updatedAt }));
    expect(readForumDraft(key).draft).toBeNull();
    expect(readForumDraft(key).error).toContain('无法读取本地草稿');
  }
  expect(() => writeForumDraft(key, '无效版本', rich, 'RICH_TEXT', 'not-a-date')).toThrow('Invalid draft revision');
});
