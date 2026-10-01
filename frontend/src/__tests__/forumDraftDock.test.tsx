import { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Link, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DraftablePostForm, ForumDraftDockProvider, type ForumDraftTarget } from '@/components/Forum/ForumDraftDock';
import type { PostFormData, PostFormProps } from '@/components/Forum/PostForm';
import { forumDraftKey, readForumDraft, writeForumDraft } from '@/components/Forum/forumDraft';

const mocks = vi.hoisted(() => ({ account: { id: 'alice' } as { id: string } | null, create: vi.fn(), addComment: vi.fn(), edit: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ account: mocks.account }) }));
vi.mock('@/services/postService', () => ({ postService: { create: mocks.create, addComment: mocks.addComment, edit: mocks.edit } }));
// PostForm's serialization, storage errors and transfer locks are covered in
// forumDraft.test. This small editor exercises session ownership and handoff.
vi.mock('@/components/Forum/PostForm', () => ({ PostForm: (props: PostFormProps) => {
  const key = mocks.account && props.draftScope ? forumDraftKey(mocks.account.id, props.draftScope) : undefined;
  const [data, setData] = useState<PostFormData>(() => props.draftValue || readForumDraft(key).draft || { title: '', body: '', bodyFormat: 'MARKDOWN' });
  const [error, setError] = useState('');
  useEffect(() => { props.onDraftChange?.(data); }, []);
  const change = (body: string) => {
    const next = { ...data, body };
    setData(next); props.onDraftChange?.(next);
    try { if (key) writeForumDraft(key, next.title, next.body, next.bodyFormat); } catch { /* Keep live data. */ }
  };
  return <form onSubmit={event => {
    event.preventDefault();
    void props.save(data).then(() => { if (key) localStorage.removeItem(key); props.onPublished?.(); }).catch(() => setError('发布失败'));
  }}>
    <textarea aria-label="草稿正文" value={data.body} onChange={event => change(event.target.value)} />
    {props.onPopOut && <button type="button" disabled={props.popOutDisabled} onClick={() => props.onPopOut?.(data)}>弹出草稿</button>}
    <button type="submit">发布草稿</button>
    <button type="button" onClick={() => props.onActivityChange?.({ busy: false, uploading: true })}>开始模拟上传</button>
    <button type="button" onClick={() => props.onActivityChange?.({ busy: false, uploading: false })}>完成模拟上传</button>
    {error && <p role="alert">{error}</p>}
  </form>;
} }));

const circle = { circleId: 'circle-one', circleSlug: 'first-circle', circleName: '第一个圈子' };
const postTarget: ForumDraftTarget = { ...circle, kind: 'post' };
const commentTarget: ForumDraftTarget = { ...circle, kind: 'comment', postId: 'source-post', postTitle: '原帖标题' };
const secondTarget: ForumDraftTarget = { circleId: 'circle-two', circleSlug: 'second-circle', circleName: '第二个圈子', kind: 'post' };
const windowKey = (account: string) => `forum-draft-window:v1:${account}`;
const postKey = forumDraftKey('alice', 'post:circle-one');
function Source({ target }: { target: ForumDraftTarget }) {
  return <section aria-label={`原位置 ${target.circleId}`}><DraftablePostForm target={target} circleId={target.circleId} comment={target.kind === 'comment'} submitLabel="发布" save={vi.fn().mockResolvedValue(undefined)} /></section>;
}
function Content({ sources = [] }: { sources?: ForumDraftTarget[] }) {
  const location = useLocation();
  return <><output aria-label="当前位置">{location.pathname}{location.search}</output><Link to="/forum/p/reference">参考其他帖子</Link>{sources.map(target => <Source key={`${target.kind}-${target.circleId}`} target={target} />)}</>;
}
function Harness({ sources = [] }: { sources?: ForumDraftTarget[] }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}><MemoryRouter initialEntries={['/forum/c/first-circle']}><ForumDraftDockProvider><Content sources={sources} /></ForumDraftDockProvider></MemoryRouter></QueryClientProvider>;
}
const floating = () => within(screen.getByRole('region', { name: '草稿浮窗' }));
function detach(sourceLabel = '原位置 circle-one', body = '尚未发布的草稿') {
  const source = within(screen.getByRole('region', { name: sourceLabel }));
  fireEvent.change(source.getByLabelText('草稿正文'), { target: { value: body } });
  fireEvent.click(source.getByRole('button', { name: '弹出草稿' }));
}
beforeEach(() => {
  localStorage.clear(); mocks.account = { id: 'alice' }; mocks.create.mockReset(); mocks.addComment.mockReset(); mocks.edit.mockReset();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('keeps one live draft while reading other posts and blocks detaching a second draft', () => {
  render(<Harness sources={[postTarget, secondTarget]} />);
  detach();
  fireEvent.click(screen.getByRole('link', { name: '参考其他帖子' }));
  expect(screen.getByLabelText('当前位置')).toHaveTextContent('/forum/p/reference');
  expect(floating().getByLabelText('草稿正文')).toHaveValue('尚未发布的草稿');
  expect(within(screen.getByRole('region', { name: '原位置 circle-two' })).getByRole('button', { name: '弹出草稿' })).toBeDisabled();
  fireEvent.click(floating().getByRole('button', { name: '收起草稿' }));
  fireEvent.click(floating().getByRole('button', { name: '展开草稿浮窗' }));
  expect(floating().getByLabelText('草稿正文')).toHaveValue('尚未发布的草稿');
});
it('retains the latest in-memory edits until the source loads, even if browser storage fails', async () => {
  const view = render(<Harness sources={[commentTarget]} />);
  detach();
  view.rerender(<Harness />);
  fireEvent.click(screen.getByRole('link', { name: '参考其他帖子' }));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage unavailable'); });
  fireEvent.change(floating().getByLabelText('草稿正文'), { target: { value: '关闭前在浮窗编辑' } });
  fireEvent.click(floating().getByRole('button', { name: '收回原位置' }));
  expect(screen.getByLabelText('当前位置')).toHaveTextContent('/forum/p/source-post');
  expect(screen.getByRole('region', { name: '草稿浮窗' })).toBeInTheDocument();
  fireEvent.change(floating().getByLabelText('草稿正文'), { target: { value: '等待原帖加载时继续编辑' } });
  view.rerender(<Harness sources={[commentTarget]} />);
  expect(screen.queryByRole('region', { name: '草稿浮窗' })).not.toBeInTheDocument();
  expect(screen.getAllByLabelText('草稿正文')).toHaveLength(1);
  expect(screen.getByLabelText('草稿正文')).toHaveValue('等待原帖加载时继续编辑');
  await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
});
it('isolates accounts and restores the original user’s floating draft after switching back', () => {
  const view = render(<Harness sources={[postTarget]} />);
  detach('原位置 circle-one', 'Alice 的私有草稿');
  mocks.account = { id: 'bob' };
  view.rerender(<Harness sources={[postTarget]} />);
  expect(screen.queryByRole('region', { name: '草稿浮窗' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('草稿正文')).toHaveValue('');
  expect(readForumDraft(postKey).draft?.body).toBe('Alice 的私有草稿');
  mocks.account = { id: 'alice' };
  view.rerender(<Harness sources={[postTarget]} />);
  expect(floating().getByLabelText('草稿正文')).toHaveValue('Alice 的私有草稿');
});
it('restores a minimized window after refresh but ignores metadata without a saved draft', () => {
  const view = render(<Harness sources={[postTarget]} />);
  detach();
  fireEvent.click(floating().getByRole('button', { name: '收起草稿' }));
  view.unmount();
  const refreshed = render(<Harness />);
  expect(floating().getByRole('button', { name: '展开草稿浮窗' })).toBeInTheDocument();
  fireEvent.click(floating().getByRole('button', { name: '展开草稿浮窗' }));
  expect(floating().getByLabelText('草稿正文')).toHaveValue('尚未发布的草稿');
  refreshed.unmount();
  localStorage.removeItem(postKey);
  render(<Harness />);
  expect(screen.queryByRole('region', { name: '草稿浮窗' })).not.toBeInTheDocument();
  expect(localStorage.getItem(windowKey('alice'))).toBeNull();
});
it('publishes a floating reply to its original post and keeps the draft open after an API failure', async () => {
  mocks.addComment.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'new-comment' });
  render(<Harness sources={[commentTarget]} />);
  detach('原位置 circle-one', '给原帖的评论');
  fireEvent.click(screen.getByRole('link', { name: '参考其他帖子' }));
  fireEvent.click(floating().getByRole('button', { name: '发布草稿' }));
  await floating().findByRole('alert');
  expect(mocks.addComment).toHaveBeenLastCalledWith('source-post', '给原帖的评论', 'MARKDOWN');
  expect(floating().getByLabelText('草稿正文')).toHaveValue('给原帖的评论');
  fireEvent.click(floating().getByRole('button', { name: '发布草稿' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: '草稿浮窗' })).not.toBeInTheDocument());
  expect(screen.getByLabelText('当前位置')).toHaveTextContent('/forum/p/source-post?commentId=new-comment');
});
it('does not navigate the new account when a previous account’s publication finishes', async () => {
  let resolve!: (post: { id: string }) => void;
  mocks.create.mockImplementation(() => new Promise<{ id: string }>(done => { resolve = done; }));
  const view = render(<Harness sources={[postTarget]} />);
  detach();
  fireEvent.click(floating().getByRole('button', { name: '发布草稿' }));
  fireEvent.click(screen.getByRole('link', { name: '参考其他帖子' }));
  mocks.account = { id: 'bob' };
  view.rerender(<Harness />);
  await act(async () => resolve({ id: 'alice-post' }));
  expect(screen.getByLabelText('当前位置')).toHaveTextContent('/forum/p/reference');
  expect(screen.queryByRole('region', { name: '草稿浮窗' })).not.toBeInTheDocument();
});

it('does not resurrect a previously returned draft after detaching again and publishing', async () => {
  mocks.addComment.mockResolvedValue({ id: 'new-comment' });
  render(<Harness sources={[commentTarget]} />);
  detach('原位置 circle-one', '第一次草稿');
  fireEvent.click(floating().getByRole('button', { name: '收回原位置' }));
  expect(screen.getByLabelText('草稿正文')).toHaveValue('第一次草稿');
  detach('原位置 circle-one', '修改后的最终评论');
  fireEvent.click(floating().getByRole('button', { name: '发布草稿' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: '草稿浮窗' })).not.toBeInTheDocument());
  expect(mocks.addComment).toHaveBeenLastCalledWith('source-post', '修改后的最终评论', 'MARKDOWN');
  expect(screen.getByLabelText('草稿正文')).toHaveValue('');
  expect(readForumDraft(forumDraftKey('alice', 'comment:circle-one:source-post')).draft).toBeNull();
});

it('waits for an upload started during source loading before handing the draft back', () => {
  const view = render(<Harness sources={[commentTarget]} />);
  detach();
  view.rerender(<Harness />);
  fireEvent.click(floating().getByRole('button', { name: '收回原位置' }));
  fireEvent.click(floating().getByRole('button', { name: '开始模拟上传' }));
  view.rerender(<Harness sources={[commentTarget]} />);
  expect(screen.getByRole('region', { name: '草稿浮窗' })).toBeInTheDocument();
  fireEvent.change(floating().getByLabelText('草稿正文'), { target: { value: '上传完成后的图片内容' } });
  fireEvent.click(floating().getByRole('button', { name: '完成模拟上传' }));
  expect(screen.queryByRole('region', { name: '草稿浮窗' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('草稿正文')).toHaveValue('上传完成后的图片内容');
});


it('saves a restored edit to its original post and keeps the draft revision after conflicts', async () => {
  const target: ForumDraftTarget = { ...circle, kind: 'edit-post', postId: 'edited-post', postTitle: '原帖', updatedAt: '2026-09-30T10:00:00.000Z', management: false };
  const editKey = forumDraftKey('alice', 'edit-post:edited-post');
  writeForumDraft(editKey, '编辑中的标题', '本地修改', 'MARKDOWN', '2026-09-30T09:00:00.000Z');
  localStorage.setItem(windowKey('alice'), JSON.stringify({ version: 1, target, mode: 'window' }));
  writeForumDraft(postKey, '另一个未发布的新帖', '保留', 'MARKDOWN');
  mocks.edit.mockRejectedValueOnce(new Error('内容已被修改')).mockResolvedValueOnce({ id: target.postId });
  render(<Harness />);
  fireEvent.click(screen.getByRole('link', { name: '参考其他帖子' }));
  fireEvent.click(floating().getByRole('button', { name: '发布草稿' }));
  await floating().findByRole('alert');
  expect(mocks.edit).toHaveBeenLastCalledWith('edited-post', { title: '编辑中的标题', body: '本地修改', bodyFormat: 'MARKDOWN', updatedAt: '2026-09-30T09:00:00.000Z' }, false);
  expect(readForumDraft(editKey).draft?.updatedAt).toBe('2026-09-30T09:00:00.000Z');
  expect(floating().getByLabelText('草稿正文')).toHaveValue('本地修改');
  fireEvent.click(floating().getByRole('button', { name: '发布草稿' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: '草稿浮窗' })).not.toBeInTheDocument());
  expect(screen.getByLabelText('当前位置')).toHaveTextContent('/forum/p/edited-post');
  expect(localStorage.getItem(editKey)).toBeNull();
  expect(readForumDraft(postKey).draft?.title).toBe('另一个未发布的新帖');
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.addComment).not.toHaveBeenCalled();
});
it('returns a comment edit to its management view and saves the original comment without a post title', async () => {
  const target: ForumDraftTarget = { ...circle, kind: 'edit-comment', postId: 'source-post', postTitle: '原帖', commentId: 'original-comment', updatedAt: '2026-09-30T09:00:00.000Z', management: true };
  const editKey = forumDraftKey('alice', 'edit-comment:original-comment');
  writeForumDraft(editKey, '', '修改评论', 'MARKDOWN', target.updatedAt);
  localStorage.setItem(windowKey('alice'), JSON.stringify({ version: 1, target, mode: 'window' }));
  mocks.edit.mockResolvedValue({ id: target.commentId });
  render(<Harness />);
  fireEvent.click(floating().getByRole('button', { name: '收回原位置' }));
  expect(screen.getByLabelText('当前位置')).toHaveTextContent('/forum/p/source-post?view=manage&commentId=original-comment');
  // Keep the live form when the source is not mounted, including its original target.
  fireEvent.click(floating().getByRole('button', { name: '发布草稿' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: '草稿浮窗' })).not.toBeInTheDocument());
  expect(mocks.edit).toHaveBeenCalledWith('original-comment', { body: '修改评论', bodyFormat: 'MARKDOWN', updatedAt: target.updatedAt }, true);
});
