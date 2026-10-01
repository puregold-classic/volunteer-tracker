import { api } from './api';
import type { ApiResponse, ForumDirectory, ForumBodyFormat, ForumPost, ForumComment, ForumPageResult, ForumCommentPage, MyForumContent, MyForumCircle, ForumPostListResult, ForumSort } from './types';

const unwrap = async <T>(request: Promise<unknown>): Promise<T> => {
  const response = await request as ApiResponse<T>;
  if (!response.success || response.data === undefined) throw new Error(response.message || '请求失败');
  return response.data;
};
const page = async <T>(request: Promise<unknown>): Promise<T> => {
  const response = await request as { success: boolean; message?: string } & T;
  if (!response.success) throw new Error(response.message || '请求失败');
  return response;
};
export const postService = {
  directory: () => unwrap<ForumDirectory>(api.get('/forum/me/directory')),
  list: (slug: string, currentPage = 1, manage = false, sort: ForumSort = 'hot', featured = false) => page<ForumPostListResult>(api.get(`/forum/circles/${encodeURIComponent(slug)}/posts`, { params: { page: currentPage, sort, featured: String(featured), ...(manage ? { view: 'manage' } : {}) } })),
  get: (id: string, manage = false) => unwrap<ForumPost>(api.get(`/forum/posts/${id}`, { params: manage ? { view: 'manage' } : {} })),
  create: (slug: string, data: { title: string; body: string; bodyFormat?: ForumBodyFormat }) => unwrap<ForumPost>(api.post(`/forum/circles/${encodeURIComponent(slug)}/posts`, data)),
  edit: (id: string, data: { title?: string; body: string; bodyFormat?: ForumBodyFormat; updatedAt: string }, comment = false) => unwrap<{ id: string }>(api.patch(`/forum/${comment ? 'comments' : 'posts'}/${id}`, data)),
  setDeleted: (id: string, deleted: boolean, comment = false) => {
    const url = `/forum/${comment ? 'comments' : 'posts'}/${id}`;
    return unwrap<{ id: string }>(deleted ? api.delete(url) : api.post(`${url}/restore`));
  },
  comments: (id: string, params: { view?: 'manage'; cursor?: string; commentId?: string } = {}) => page<ForumCommentPage>(api.get(`/forum/posts/${id}/comments`, { params })),
  addComment: (id: string, body: string, bodyFormat: ForumBodyFormat = 'MARKDOWN') => unwrap<ForumComment>(api.post(`/forum/posts/${id}/comments`, { body, bodyFormat })),
  mine: (tab: 'posts' | 'comments' | 'favorites' | 'comment-favorites', currentPage: number) => page<ForumPageResult<MyForumContent>>(api.get(`/forum/me/${tab}`, { params: { page: currentPage } })),
  circles: (currentPage: number) => page<ForumPageResult<MyForumCircle>>(api.get('/forum/me/circles', { params: { page: currentPage } })),
  engage: (id: string, kind: 'like' | 'favorite', selected: boolean) => unwrap<Partial<ForumPost>>(selected ? api.put(`/forum/posts/${id}/${kind}`) : api.delete(`/forum/posts/${id}/${kind}`)),
  mark: (id: string, kind: 'pin' | 'feature', selected: boolean) => unwrap<Partial<ForumPost>>(selected ? api.put(`/forum/posts/${id}/${kind}`) : api.delete(`/forum/posts/${id}/${kind}`)),
  commentEngage: (id: string, kind: 'pin' | 'favorite', selected: boolean) => unwrap<Partial<ForumComment>>(selected ? api.put(`/forum/comments/${id}/${kind}`) : api.delete(`/forum/comments/${id}/${kind}`)),
  follow: (id: string, selected: boolean) => unwrap<{ isFollowing: boolean }>(selected ? api.put(`/forum/circles/${id}/follow`) : api.delete(`/forum/circles/${id}/follow`)),

};
