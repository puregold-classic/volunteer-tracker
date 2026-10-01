import type { Annotation } from './imageAnnotations';

export interface AnnotationDraft {
  version: 1;
  base: string;
  marks: Annotation[];
  editing?: number | null;
  savedAt: string;
}
const storageError = '标注进度未能保存到浏览器，当前页面仍保留，请勿刷新。';
// Retain unsaved work when storage is unavailable, including closing and reopening
// the annotator during this page session. Successful reads still prefer storage.
const memory = new Map<string, { draft: AnnotationDraft | null; pending: boolean }>();
const bytes = (value: string) => new TextEncoder().encode(value).length;
const clone = (draft: AnnotationDraft): AnnotationDraft => JSON.parse(JSON.stringify(draft));
export const annotationDraftKey = (accountId: string, scope: string, imageId: string) =>
  `forum-annotation-draft:v1:${encodeURIComponent(accountId)}:${encodeURIComponent(scope)}:${encodeURIComponent(imageId)}`;

function validMarks(value: unknown): value is Annotation[] {
  if (!Array.isArray(value) || value.length > 40 || bytes(JSON.stringify(value)) > 30_000) return false;
  return value.every(mark => {
    if (!mark || !['pen', 'line', 'arrow', 'rect', 'text'].includes(mark.kind) || typeof mark.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(mark.color)) return false;
    if (!Number.isFinite(mark.size) || mark.size < (mark.kind === 'text' ? 12 : 1) || mark.size > (mark.kind === 'text' ? 96 : 24)) return false;
    if (!Array.isArray(mark.points) || (mark.kind === 'text' ? mark.points.length !== 1 : mark.kind === 'pen' ? mark.points.length < 2 || mark.points.length > 300 : mark.points.length !== 2)) return false;
    if (!mark.points.every((point: { x: number; y: number } | null) => point && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)) return false;
    if (mark.filled !== undefined && typeof mark.filled !== 'boolean') return false;
    // Empty text is an unfinished text box, which belongs in a local draft even
    // though the final submitted document requires nonempty annotation text.
    if (mark.kind === 'text' && (typeof mark.text !== 'string' || mark.text.length > 200)) return false;
    if (mark.width !== undefined && (!Number.isFinite(mark.width) || mark.width < 0.04 || mark.width > 1)) return false;
    if (mark.textStyle !== undefined && !['plain', 'background', 'outline'].includes(mark.textStyle)) return false;
    return true;
  });
}
function validDraft(value: unknown): value is AnnotationDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as AnnotationDraft;
  if (draft.version !== 1 || typeof draft.base !== 'string' || bytes(draft.base) > 30_000 || !validMarks(draft.marks) || typeof draft.savedAt !== 'string' || !Number.isFinite(Date.parse(draft.savedAt))) return false;
  try { if (!validMarks(JSON.parse(draft.base))) return false; } catch { return false; }
  if (draft.editing !== undefined && draft.editing !== null && (!Number.isInteger(draft.editing) || draft.editing < 0 || draft.editing >= draft.marks.length || draft.marks[draft.editing].kind !== 'text')) return false;
  return true;
}
function matching(draft: AnnotationDraft | null | undefined, base: string) {
  return draft?.base === base ? clone(draft) : null;
}
export function readAnnotationDraft(key: string | undefined, base: string): { draft: AnnotationDraft | null; error: string } {
  if (!key) return { draft: null, error: '' };
  const cached = memory.get(key);
  if (cached?.pending) return { draft: matching(cached.draft, base), error: storageError };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) { memory.delete(key); return { draft: null, error: '' }; }
    const draft: unknown = JSON.parse(raw);
    if (!validDraft(draft)) throw new Error('Invalid annotation draft');
    memory.set(key, { draft: clone(draft), pending: false });
    return { draft: matching(draft, base), error: '' };
  } catch { return { draft: matching(cached?.draft, base), error: '无法读取本地标注进度，请检查浏览器存储设置。' }; }
}
export function writeAnnotationDraft(key: string, base: string, marks: Annotation[], editing?: number | null): void {
  const draft: AnnotationDraft = { version: 1, base, marks, savedAt: new Date().toISOString(), ...(editing !== undefined ? { editing } : {}) };
  if (!validDraft(draft)) throw new Error('标注较多或格式不正确，请删减后再保存。');
  const snapshot = clone(draft);
  memory.set(key, { draft: snapshot, pending: true });
  localStorage.setItem(key, JSON.stringify(snapshot));
  memory.set(key, { draft: snapshot, pending: false });
}
export function clearAnnotationDraft(key?: string): void {
  if (!key) return;
  memory.set(key, { draft: null, pending: true });
  localStorage.removeItem(key);
  memory.delete(key);
}
