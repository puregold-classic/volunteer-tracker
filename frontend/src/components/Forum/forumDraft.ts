import type { ForumBodyFormat } from '@/services/types';
import { richImageCount, richText } from './RichContent';

export interface ForumDraft {
  version: 1;
  title: string;
  body: string;
  bodyFormat: ForumBodyFormat;
  savedAt: string;
  updatedAt?: string;
}
export const forumDraftKey = (accountId: string, scope: string) => `forum-draft:v1:${encodeURIComponent(accountId)}:${encodeURIComponent(scope)}`;
export function readForumDraft(key?: string): { draft: ForumDraft | null; error: string } {
  if (!key) return { draft: null, error: '' };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { draft: null, error: '' };
    const draft = JSON.parse(raw);
    if (draft.version !== 1 || typeof draft.title !== 'string' || typeof draft.body !== 'string' || !['MARKDOWN', 'RICH_TEXT'].includes(draft.bodyFormat) || typeof draft.savedAt !== 'string') throw new Error();
    if (draft.updatedAt !== undefined && (typeof draft.updatedAt !== 'string' || !draft.updatedAt.trim() || !Number.isFinite(Date.parse(draft.updatedAt)))) throw new Error();
    if (draft.bodyFormat === 'RICH_TEXT' && JSON.parse(draft.body).type !== 'doc') throw new Error();
    return { draft, error: '' };
  } catch { return { draft: null, error: '无法读取本地草稿，请检查浏览器存储设置。' }; }
}
export function hasDraftContent(title: string, body: string, format: ForumBodyFormat) {
  if (title.trim()) return true;
  if (format === 'MARKDOWN') return !!body.trim();
  try { const doc = JSON.parse(body); return !!richText(doc).trim() || richImageCount(doc) > 0; }
  catch { return !!body.trim(); }
}
export function writeForumDraft(key: string, title: string, body: string, bodyFormat: ForumBodyFormat, updatedAt?: string) {
  if (updatedAt !== undefined && (typeof updatedAt !== 'string' || !updatedAt.trim() || !Number.isFinite(Date.parse(updatedAt)))) throw new Error('Invalid draft revision');
  if (!hasDraftContent(title, body, bodyFormat)) { localStorage.removeItem(key); return false; }
  localStorage.setItem(key, JSON.stringify({ version: 1, title, body, bodyFormat, savedAt: new Date().toISOString(), ...(updatedAt !== undefined ? { updatedAt } : {}) } satisfies ForumDraft));
  return true;
}
