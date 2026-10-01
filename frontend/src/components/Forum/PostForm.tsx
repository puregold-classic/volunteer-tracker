import { useEffect, useRef, useState } from 'react';
import { PanelTopOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { RichTextEditor } from './RichTextEditor';
import type { ForumBodyFormat } from '@/services/types';
import { forumError } from '@/services/forumService';
import { useAuth } from '@/context/AuthContext';
import { forumDraftKey, hasDraftContent, readForumDraft, writeForumDraft } from './forumDraft';

export type PostFormData = { title: string; body: string; bodyFormat: ForumBodyFormat; updatedAt?: string };
export type PostFormProps = {
  initialTitle?: string; initialBody?: string; initialFormat?: ForumBodyFormat; circleId: string; management?: boolean; comment?: boolean; submitLabel: string;
  initialUpdatedAt?: string;
  draftScope?: string;
  draftValue?: PostFormData;
  onDraftChange?: (data: PostFormData) => void;
  onPopOut?: (data: PostFormData) => void;
  popOutDisabled?: boolean;
  onActivityChange?: (activity: { busy: boolean; uploading: boolean }) => void;
  onPublished?: () => void;
  save: (data: PostFormData) => Promise<void>; onCancel?: () => void;
};
export function PostForm(props: PostFormProps) {
  const { account } = useAuth();
  const draftKey = account && props.draftScope ? forumDraftKey(account.id, props.draftScope) : undefined;
  return <PostFormContent key={draftKey || `${account?.id}-${props.circleId}`} {...props} draftKey={draftKey} />;
}
function PostFormContent({ initialTitle = '', initialBody = '', initialFormat = 'MARKDOWN', initialUpdatedAt, circleId, management = false, comment = false, submitLabel, save, onCancel, draftKey, draftValue, onDraftChange, onPopOut, popOutDisabled = false, onActivityChange, onPublished }: PostFormProps & { draftKey?: string }) {
  const [restored] = useState(() => readForumDraft(draftKey));
  // Content and its server revision are one snapshot. A newer page fetch must
  // not silently rebase an unfinished edit and bypass a concurrent-edit check.
  const [updatedAt] = useState(() => draftValue ? draftValue.updatedAt : restored.draft ? restored.draft.updatedAt : initialUpdatedAt);
  const [title, setTitle] = useState(draftValue?.title ?? restored.draft?.title ?? initialTitle);
  const [editorSeed, setEditorSeed] = useState({ body: draftValue?.body ?? restored.draft?.body ?? initialBody, format: draftValue?.bodyFormat ?? restored.draft?.bodyFormat ?? initialFormat, revision: 0 });
  const body = useRef(editorSeed.body), currentTitle = useRef(title), bodyFormat = useRef(editorSeed.format);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [bodyValid, setBodyValid] = useState(false), [uploading, setUploading] = useState(false);
  const busyRef = useRef(false), uploadingRef = useRef(false);
  const callbacks = useRef({ onDraftChange, onActivityChange, onPublished });
  callbacks.current = { onDraftChange, onActivityChange, onPublished };
  const currentDraft = (): PostFormData => ({ title: currentTitle.current, body: body.current, bodyFormat: bodyFormat.current, ...(updatedAt !== undefined ? { updatedAt } : {}) });
  const notifyDraft = () => callbacks.current.onDraftChange?.(currentDraft());
  useEffect(() => { callbacks.current.onActivityChange?.({ busy, uploading }); }, [busy, uploading]);
  const [draftError, setDraftError] = useState(restored.error), [draftSaved, setDraftSaved] = useState(!!restored.draft), [discarding, setDiscarding] = useState(false);
  const persist = () => {
    if (!draftKey) return;
    try { setDraftSaved(writeForumDraft(draftKey, currentTitle.current, body.current, bodyFormat.current, updatedAt)); setDraftError(''); }
    catch { setDraftError('草稿未保存：浏览器存储不可用或空间不足，请先保留当前内容。'); }
  };
  const reset = () => {
    currentTitle.current = ''; body.current = ''; bodyFormat.current = 'MARKDOWN';
    setTitle(''); setBodyValid(false); setDraftSaved(false);
    setEditorSeed(seed => ({ body: '', format: 'MARKDOWN', revision: seed.revision + 1 }));
    notifyDraft();
  };
  const clearDraft = () => {
    try { if (draftKey) localStorage.removeItem(draftKey); setDraftError(''); return true; }
    catch { setDraftError('本地草稿未能清除，请检查浏览器存储设置。'); return false; }
  };
  const valid = bodyValid && (comment || (title.trim().length > 0 && [...title.trim()].length <= 100));
  return <form className="space-y-5" onSubmit={(event) => {
    event.preventDefault(); if (busyRef.current || uploadingRef.current || !valid) return;
    busyRef.current = true; setBusy(true); setError('');
    void save({ ...currentDraft(), title: title.trim(), bodyFormat: 'RICH_TEXT' }).then(() => {
      if (draftKey) clearDraft();
      if (draftKey || comment) reset();
      callbacks.current.onPublished?.();
    }).catch((err) => setError(forumError(err))).finally(() => { busyRef.current = false; setBusy(false); });
  }}>
    {onPopOut && <div className="flex justify-end"><Button type="button" size="icon-sm" variant="ghost" aria-label="弹出草稿" title="弹出草稿" disabled={busy || uploading || popOutDisabled} onClick={() => {
      if (busyRef.current || uploadingRef.current || popOutDisabled) return;
      persist(); onPopOut(currentDraft());
    }}><PanelTopOpen className="h-4 w-4" /></Button></div>}
    {!comment && <label className="block space-y-2 text-sm font-medium">标题<Input aria-label="标题" value={title} disabled={busy || uploading} onChange={(event) => { currentTitle.current = event.target.value; setTitle(event.target.value); persist(); notifyDraft(); }} placeholder="用一句话说说你想讨论什么" /><span className={`block text-xs ${[...title.trim()].length > 100 ? 'text-destructive' : 'text-muted-foreground'}`}>{[...title.trim()].length} / 100</span></label>}
    <RichTextEditor key={editorSeed.revision} initialBody={editorSeed.body} initialFormat={editorSeed.format} circleId={circleId} management={management} annotationScope={draftKey} label={comment ? '评论' : '正文'} onChange={(value, valid) => { body.current = value; bodyFormat.current = 'RICH_TEXT'; setBodyValid(valid); persist(); notifyDraft(); }} onUploading={(value) => { uploadingRef.current = value; setUploading(value); }} limit={comment ? 1000 : 5000} disabled={busy} />
    {draftKey && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><div><p role="status">{draftError || (draftSaved ? '草稿已自动保存到当前浏览器' : '输入内容后自动保存草稿，仅当前浏览器可用')}</p><p className="mt-1">未发布图片自上传起保留 30 天，过期需重新上传。</p></div>{hasDraftContent(title, body.current, bodyFormat.current) && <Button type="button" size="sm" variant="ghost" disabled={busy || uploading} onClick={() => setDiscarding(true)}>清空草稿</Button>}</div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end gap-2">{onCancel && <Button type="button" variant="outline" disabled={busy || uploading} onClick={onCancel}>取消</Button>}<Button type="submit" disabled={busy || uploading || !valid}>{busy ? '正在提交…' : submitLabel}</Button></div>
    <Dialog open={discarding} onOpenChange={setDiscarding} title="清空草稿" footer={<><Button type="button" variant="outline" onClick={() => setDiscarding(false)}>保留草稿</Button><Button type="button" onClick={() => { if (clearDraft()) { reset(); setDiscarding(false); } }}>确认清空</Button></>}><p className="text-sm">清空后无法恢复，确定删除当前草稿吗？</p></Dialog>
  </form>;
}
