import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Maximize2, Minimize2, Minus, PanelTopOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { postService } from '@/services/postService';
import { PostForm, type PostFormData, type PostFormProps } from './PostForm';
import { forumDraftKey, hasDraftContent, readForumDraft } from './forumDraft';

interface CircleTarget { circleId: string; circleSlug: string; circleName: string }
type EditTarget = CircleTarget & { postId: string; postTitle: string; updatedAt: string; management: boolean };
export type ForumDraftTarget = (CircleTarget & { kind: 'post' })
  | (CircleTarget & { kind: 'comment'; postId: string; postTitle: string })
  | (EditTarget & { kind: 'edit-post' })
  | (EditTarget & { kind: 'edit-comment'; commentId: string });
type WindowMode = 'window' | 'minimized' | 'full';
interface Session { target: ForumDraftTarget; data: PostFormData; nonce: number }
interface ReturnRequest extends Session { scope: string }
interface DockState { session: Session | null; mode: WindowMode; returnRequest: ReturnRequest | null }
interface DockContextValue {
  floatingScope: string | null;
  contentRevision: number;
  returnRequest: ReturnRequest | null;
  popOut: (target: ForumDraftTarget, data: PostFormData) => boolean;
  reveal: () => void;
  acknowledgeReturn: (scope: string, nonce: number) => void;
}
const DockContext = createContext<DockContextValue | null>(null);
const isEditTarget = (target: ForumDraftTarget): target is Extract<ForumDraftTarget, EditTarget> => target.kind === 'edit-post' || target.kind === 'edit-comment';
const scopeFor = (target: ForumDraftTarget) => {
  if (target.kind === 'post') return `post:${target.circleId}`;
  if (target.kind === 'edit-post') return `edit-post:${target.postId}`;
  if (target.kind === 'edit-comment') return `edit-comment:${target.commentId}`;
  return `comment:${target.circleId}:${target.postId}`;
};
const sourceFor = (target: ForumDraftTarget) => {
  if (target.kind === 'post') return `/forum/c/${encodeURIComponent(target.circleSlug)}`;
  const params = new URLSearchParams();
  if (isEditTarget(target) && target.management) params.set('view', 'manage');
  if (target.kind === 'edit-comment') params.set('commentId', target.commentId);
  return `/forum/p/${encodeURIComponent(target.postId)}${params.size ? `?${params}` : ''}`;
};
const windowKey = (accountId: string) => `forum-draft-window:v1:${encodeURIComponent(accountId)}`;
const emptyState = (): DockState => ({ session: null, mode: 'window', returnRequest: null });
let nextNonce = 0;

function validTarget(value: unknown): value is ForumDraftTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as Record<string, unknown>;
  const text = (key: string) => typeof target[key] === 'string' && (target[key] as string).length > 0 && (target[key] as string).length <= 500;
  if (!text('circleId') || !text('circleSlug') || !text('circleName')) return false;
  if (target.kind === 'post') return true;
  if (!text('postId') || !text('postTitle')) return false;
  if (target.kind === 'comment') return true;
  if (!text('updatedAt') || typeof target.management !== 'boolean') return false;
  return target.kind === 'edit-post' || (target.kind === 'edit-comment' && text('commentId'));
}
function restoreWindow(accountId?: string): DockState {
  if (!accountId) return emptyState();
  try {
    const stored = JSON.parse(localStorage.getItem(windowKey(accountId)) || 'null');
    if (stored?.version !== 1 || !validTarget(stored.target)) return emptyState();
    const { draft } = readForumDraft(forumDraftKey(accountId, scopeFor(stored.target)));
    if (!draft || !hasDraftContent(draft.title, draft.body, draft.bodyFormat)) return emptyState();
    return { session: { target: stored.target, data: draft, nonce: ++nextNonce }, mode: ['window', 'minimized', 'full'].includes(stored.mode) ? stored.mode : 'window', returnRequest: null };
  } catch { return emptyState(); }
}

export function useForumDraftDock() {
  const context = useContext(DockContext);
  if (!context) throw new Error('ForumDraftDockProvider is required');
  return context;
}

// A fresh session on account changes prevents another account seeing or editing
// this user's in-memory draft. Browser drafts remain separated by account key.
export function ForumDraftDockProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  return <DraftDockSession key={account?.id || 'anonymous'} accountId={account?.id}>{children}</DraftDockSession>;
}

function DraftDockSession({ accountId, children }: { accountId?: string; children: ReactNode }) {
  const [state, setState] = useState<DockState>(() => restoreWindow(accountId));
  const [activity, setActivity] = useState({ busy: false, uploading: false });
  const [contentRevision, setContentRevision] = useState(0);
  const latest = useRef<PostFormData | null>(state.session?.data || null);
  const publishedPath = useRef<string | null>(null);
  const mounted = useRef(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!accountId) return;
    try {
      if (state.session) localStorage.setItem(windowKey(accountId), JSON.stringify({ version: 1, target: state.session.target, mode: state.mode }));
      else localStorage.removeItem(windowKey(accountId));
    } catch { /* The form reports storage failures while retaining its live data. */ }
  }, [accountId, state.session, state.mode]);
  const popOut = useCallback((target: ForumDraftTarget, data: PostFormData) => {
    if (!accountId || state.session) return false;
    latest.current = data;
    setActivity({ busy: false, uploading: false });
    setState({ session: { target, data, nonce: ++nextNonce }, mode: 'window', returnRequest: null });
    return true;
  }, [accountId, state.session]);
  const reveal = useCallback(() => setState(previous => ({ ...previous, mode: 'window' })), []);
  const acknowledgeReturn = useCallback((scope: string, nonce: number) => {
    setState(previous => previous.returnRequest?.scope === scope && previous.returnRequest.nonce === nonce ? emptyState() : previous);
  }, []);
  const draftChanged = useCallback((data: PostFormData) => {
    latest.current = data;
    // Keep a pending handoff current if its original page is still loading.
    setState(previous => previous.returnRequest ? { ...previous, returnRequest: { ...previous.returnRequest, data } } : previous);
  }, []);
  const returnToSource = () => {
    if (!state.session || activity.busy || activity.uploading) return;
    const target = state.session.target;
    const request = { target, data: latest.current || state.session.data, scope: scopeFor(target), nonce: ++nextNonce };
    // Keep the window alive until the original form accepts the handoff. If a
    // circle/post is no longer available, the unsent draft remains editable here.
    setState(previous => ({ ...previous, returnRequest: request }));
    navigate(sourceFor(target));
  };
  const session = state.session;
  const scope = session ? scopeFor(session.target) : null;
  const caption = session ? session.target.kind === 'post' ? `发帖 · ${session.target.circleName}`
    : `${session.target.kind === 'edit-post' ? '编辑帖子' : session.target.kind === 'edit-comment' ? '编辑评论' : '回复'} · ${session.target.postTitle}` : '';
  const locked = activity.busy || activity.uploading;
  const minimized = state.mode === 'minimized';
  const panelPosition = `right-[max(1rem,env(safe-area-inset-right))] ${import.meta.env.DEV ? 'bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.5rem)]' : 'bottom-[max(1rem,env(safe-area-inset-bottom))]'} ${state.mode === 'full' ? 'w-[min(56rem,calc(100vw-2rem))]' : minimized ? 'w-[min(22rem,calc(100vw-2rem))]' : 'max-h-[min(72dvh,44rem)] w-[min(34rem,calc(100vw-2rem))]'}`;
  const expandedHeight = `calc(100dvh - max(1rem, env(safe-area-inset-top)) - max(1rem, env(safe-area-inset-bottom))${import.meta.env.DEV ? ' - 3.5rem' : ''})`;
  return <DockContext.Provider value={{ floatingScope: scope, contentRevision, returnRequest: locked ? null : state.returnRequest, popOut, reveal, acknowledgeReturn }}>
    {children}
    {session && accountId && createPortal(<section role="region" aria-label="草稿浮窗" style={state.mode === 'full' ? { maxHeight: expandedHeight } : undefined} className={`fixed z-[60] flex min-w-0 flex-col overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-2xl ${panelPosition}`}>
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border bg-primary/5 px-3">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold" title={caption}>{caption}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button type="button" size="icon-sm" variant="ghost" aria-label={minimized ? '展开草稿浮窗' : '收起草稿'} title={minimized ? '展开草稿浮窗' : '收起草稿'} onClick={() => setState(previous => ({ ...previous, mode: minimized ? 'window' : 'minimized' }))}>{minimized ? <PanelTopOpen aria-hidden="true" className="h-4 w-4" /> : <Minus aria-hidden="true" className="h-4 w-4" />}</Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label={state.mode === 'full' ? '还原草稿窗口' : '最大化草稿'} title={state.mode === 'full' ? '还原草稿窗口' : '最大化草稿'} onClick={() => setState(previous => ({ ...previous, mode: previous.mode === 'full' ? 'window' : 'full' }))}>{state.mode === 'full' ? <Minimize2 aria-hidden="true" className="h-4 w-4" /> : <Maximize2 aria-hidden="true" className="h-4 w-4" />}</Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="收回原位置" title={locked ? '请等待上传或提交完成' : '收回原位置'} disabled={locked} onClick={returnToSource}><X aria-hidden="true" className="h-4 w-4" /></Button>
        </div>
      </header>
      <div hidden={minimized} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="w-full p-3 sm:p-4 [&_.forum-rich-editor]:min-h-28 [&_.forum-rich-editor]:px-3 [&_.forum-rich-editor]:py-3 [&_form]:space-y-3">
          <PostForm key={`${scope}-${session.nonce}`} draftScope={scope!} draftValue={session.data} circleId={session.target.circleId} management={isEditTarget(session.target) && session.target.management} initialUpdatedAt={isEditTarget(session.target) ? session.target.updatedAt : undefined} comment={session.target.kind === 'comment' || session.target.kind === 'edit-comment'} submitLabel={isEditTarget(session.target) ? '保存修改' : session.target.kind === 'post' ? '发布帖子' : '发表评论'} onDraftChange={draftChanged} onActivityChange={setActivity} save={async data => {
            const target = session.target;
            if (target.kind === 'post') {
              const post = await postService.create(target.circleSlug, data);
              if (mounted.current) publishedPath.current = `/forum/p/${post.id}`;
            } else if (isEditTarget(target)) {
              const comment = target.kind === 'edit-comment';
              await postService.edit(comment ? target.commentId : target.postId, {
                body: data.body, bodyFormat: data.bodyFormat, ...(!comment ? { title: data.title } : {}),
                updatedAt: data.updatedAt || target.updatedAt,
              }, comment);
              if (mounted.current) publishedPath.current = sourceFor(target);
            } else {
              const comment = await postService.addComment(target.postId, data.body, data.bodyFormat);
              if (mounted.current) publishedPath.current = `/forum/p/${target.postId}?commentId=${comment.id}`;
            }
          }} onPublished={() => {
            if (!mounted.current) return;
            const path = publishedPath.current;
            publishedPath.current = null;
            setState(emptyState());
            setContentRevision(previous => previous + 1);
            void queryClient.invalidateQueries({ queryKey: ['forum-directory'] });
            if (path) navigate(path);
          }} />
        </div>
      </div>
    </section>, document.body)}
  </DockContext.Provider>;
}

type DraftablePostFormProps = PostFormProps & { target: ForumDraftTarget; onDetached?: () => void };
export function DraftablePostForm({ target, onDetached, ...props }: DraftablePostFormProps) {
  const dock = useForumDraftDock();
  const scope = scopeFor(target);
  const host = useRef<HTMLDivElement>(null);
  const returned = useRef<ReturnRequest | null>(null);
  const pending = dock.returnRequest?.scope === scope ? dock.returnRequest : null;
  if (pending) returned.current = pending;
  const seed = returned.current?.scope === scope ? returned.current : null;
  useEffect(() => {
    if (!pending) return;
    dock.acknowledgeReturn(scope, pending.nonce);
  }, [pending?.nonce, scope, dock.acknowledgeReturn]);
  useEffect(() => {
    if (!seed) return;
    const frame = requestAnimationFrame(() => {
      host.current?.scrollIntoView({ block: 'center' });
      const editor = host.current?.querySelector<HTMLElement>('[contenteditable="true"]');
      const field = editor || host.current?.querySelector<HTMLElement>('input:not([type="file"]):not([type="hidden"]), textarea');
      field?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [seed?.nonce]);
  const floating = dock.floatingScope === scope && !pending;
  return <div ref={host}>
    {floating ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-primary/25 bg-primary/5 p-4"><p className="text-sm text-muted-foreground">这份草稿正在浮窗中编辑</p><Button type="button" size="sm" variant="outline" onClick={dock.reveal}>展开草稿浮窗</Button></div> : <PostForm key={`${scope}-${seed?.nonce || 'inline'}`} {...props} draftScope={scope} draftValue={seed?.data || props.draftValue} popOutDisabled={!!dock.floatingScope} onPopOut={data => { if (dock.popOut(target, data)) { returned.current = null; onDetached?.(); } }} />}
  </div>;
}
