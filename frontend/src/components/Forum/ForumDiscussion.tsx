import { PostHeading, PostInteractions } from '@/components/Forum/ForumInteractions';
import { useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, Pin, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/Forum/Markdown';
import { DraftablePostForm, useForumDraftDock } from '@/components/Forum/ForumDraftDock';
import { CommentInteractions } from '@/components/Forum/CommentInteractions';
import { ContentActions } from '@/components/Forum/ContentActions';
import { ForumAuthor } from '@/components/Forum/ForumCommon';
import { CurrentForumAvatar } from '@/components/Forum/ForumAvatar';
import { useForumResource } from '@/components/Forum/useForumResource';
import { postService } from '@/services/postService';
import { useAuth } from '@/context/AuthContext';
import type { ForumPost } from '@/services/types';

type ForumDiscussionProps = {
  id: string;
  management?: boolean;
  embedded?: boolean;
  onContentChanged?: () => void;
};

function Comments({ post, management, embedded, refreshPost, onContentChanged }: {
  post: ForumPost;
  management: boolean;
  embedded: boolean;
  refreshPost: () => void;
  onContentChanged?: () => void;
}) {
  const { account } = useAuth();
  const { contentRevision } = useForumDraftDock();
  const [params, setParams] = useSearchParams();
  const cursor = params.get('cursor') || undefined, commentId = params.get('commentId') || undefined;
  const load = useCallback(() => postService.comments(post.id, { ...(management ? { view: 'manage' as const } : {}), cursor, commentId }), [post.id, management, cursor, commentId, contentRevision]);
  const { data, loading, error, refresh } = useForumResource(load);
  const locate = (changes: { cursor?: string; commentId?: string }) => setParams((previous) => {
    const next = embedded ? new URLSearchParams(previous) : new URLSearchParams(management ? { view: 'manage' } : {});
    next.delete('cursor');
    next.delete('commentId');
    if (changes.cursor) next.set('cursor', changes.cursor);
    if (changes.commentId) next.set('commentId', changes.commentId);
    return next;
  });
  useEffect(() => { if (data?.locatedCommentId) document.getElementById(`comment-${data.locatedCommentId}`)?.scrollIntoView({ block: 'center' }); }, [data]);
  return <section className="space-y-4 border-t border-border pt-6 sm:pt-8" aria-label="评论区">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base font-semibold">评论 <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{data?.total ?? post.commentCount}</span></h2>{(cursor || commentId) && <Button variant="outline" size="sm" onClick={() => locate({})}>从头查看评论</Button>}</div>
    {loading ? <p role="status" className="py-6 text-center text-muted-foreground">正在加载评论…</p> : error ? <div role="alert" className="space-y-3 rounded-xl border border-border p-5"><p>{error}</p><Button variant="outline" onClick={refresh}>重试</Button></div> : <>
      {!!data?.data.length && <div className="divide-y divide-border/70">{data.data.map((comment) => <article id={`comment-${comment.id}`} key={comment.id} className={`scroll-mt-24 space-y-2 rounded-lg px-3 py-4 sm:px-5 ${comment.id === commentId ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ForumAuthor author={comment.author} date={comment.createdAt} editKind={comment.lastEditKind} />
          <div className="flex items-center gap-2 text-primary">
            {embedded && comment.author.accountId === account?.id && <span role="img" aria-label="我的评论" title="我的评论"><UserRound aria-hidden="true" className="h-3.5 w-3.5" /></span>}
            {embedded && comment.isFavorited && <span role="img" aria-label="收藏的评论" title="收藏的评论"><Bookmark aria-hidden="true" className="h-3.5 w-3.5" /></span>}
            {comment.isPinned && <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary"><Pin aria-hidden="true" className="h-3 w-3" />帖主置顶</span>}
          </div>
        </div>
        {comment.status === 'DELETED' && <p className="text-xs text-destructive">此评论已删除，仅管理视图可见</p>}
        <div className="min-w-0 space-y-2 pl-12">
          <Markdown body={comment.body} bodyFormat={comment.bodyFormat} management={management} />
          <div className="flex flex-wrap items-start justify-between gap-1"><CommentInteractions comment={comment} onChanged={(reorder) => { if (reorder) locate({}); refresh(); onContentChanged?.(); }} /><ContentActions content={comment} post={post} management={management} onChanged={() => { locate({}); refresh(); refreshPost(); onContentChanged?.(); }} /></div>
        </div>
      </article>)}</div>}
      {!data?.data.length && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">还没有评论，来分享你的想法吧。</p>}
      {data?.nextCursor && <div className="text-center"><Button variant="outline" onClick={() => locate({ cursor: data.nextCursor! })}>后续评论</Button></div>}
    </>}
    {!management && post.capabilities.canInteract && <section id="forum-reply" aria-labelledby="reply-heading" className="rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:p-5"><div className="mb-4 flex items-center gap-3"><CurrentForumAvatar /><div><h3 id="reply-heading" className="text-sm font-semibold">参与讨论</h3><p className="mt-0.5 text-xs text-muted-foreground">我的回复 · 分享你的想法</p></div></div><DraftablePostForm draftScope={`comment:${post.circle.id}:${post.id}`} circleId={post.circle.id} target={{ kind: 'comment', circleId: post.circle.id, circleSlug: post.circle.slug, circleName: post.circle.name, postId: post.id, postTitle: post.title || '帖子讨论' }} comment submitLabel="发表评论" save={async ({ body, bodyFormat }) => { const comment = await postService.addComment(post.id, body, bodyFormat); locate({ commentId: comment.id }); refresh(); refreshPost(); onContentChanged?.(); }} /></section>}
  </section>;
}
function DiscussionContent({ id, management = false, embedded = false, onContentChanged }: ForumDiscussionProps) {
  const navigate = useNavigate();
  const { contentRevision } = useForumDraftDock();
  const load = useCallback(() => postService.get(id, management), [id, management, contentRevision]);
  const { data, loading, error, refresh, update } = useForumResource(load);
  const previousPost = useRef<ForumPost | null>(null);
  useEffect(() => { if (data) previousPost.current = data; }, [data]);
  // Keep the discussion mounted during a refresh so the reply editor keeps its draft and uploads.
  const post = data || (loading ? previousPost.current : null);
  const updatePost = (patch: Partial<ForumPost>) => {
    update(patch);
    if ('isFavorited' in patch || 'isPinned' in patch || 'isFeatured' in patch) onContentChanged?.();
  };
  const contentChanged = () => { refresh(); onContentChanged?.(); };
  return <div className={embedded ? 'min-w-0 space-y-6' : 'mx-auto max-w-4xl space-y-6 px-2 py-4 sm:px-4 sm:py-8'}>
    {!embedded && <Link className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary" to={post ? `/forum/c/${post.circle.slug}${management ? '/manage' : ''}` : '/forum'}><ArrowLeft className="h-4 w-4" />{post ? post.circle.name : '返回论坛'}</Link>}
    {loading && !post ? <p role="status" className="py-10 text-center text-muted-foreground">正在加载讨论…</p> : error || !post ? <div role="alert" className="space-y-4 rounded-2xl border border-border p-8 text-center"><p>{error || '内容不存在'}</p><Button variant="outline" onClick={refresh}>重试</Button></div> : <>
      {management && <section aria-label="帖子管理" className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-primary" />内容管理{post.circle.status === 'ARCHIVED' && <span className="font-normal text-muted-foreground">· 已归档，只读</span>}</div>{post.capabilities.canRead && <Button asChild variant="outline" size="sm"><Link to={`/forum/p/${id}`}>普通阅读视图</Link></Button>}</div>
        <div className="flex flex-wrap items-center gap-3"><PostInteractions post={post} management onUpdate={updatePost} /><ContentActions content={post} management onChanged={contentChanged} /></div>
      </section>}
      <article className={`overflow-hidden rounded-2xl border border-border bg-card ${embedded ? 'shadow-sm' : ''}`}>
        <header className="space-y-3 px-5 pb-0 pt-4 sm:px-8 sm:pt-5">
          <PostHeading post={post} href={embedded ? `/forum/p/${id}${management ? '?view=manage' : ''}` : undefined} />
          <ForumAuthor compact author={post.author} date={post.createdAt} editKind={post.lastEditKind} />
          {post.status === 'DELETED' && <p className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">此帖已删除，仅管理视图可见。恢复帖子不会恢复已删除的评论。</p>}
        </header>
        <div className="px-5 pb-6 pt-7 sm:px-8 sm:pb-8 sm:pt-9 [&>.forum-markdown]:text-base [&>.forum-rich]:text-base!"><Markdown body={post.body || ''} bodyFormat={post.bodyFormat} management={management} /></div>
        {!management && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-5 py-3 sm:px-8">
          <PostInteractions post={post} onUpdate={updatePost} />
          <ContentActions content={post} onChanged={(deleted) => { onContentChanged?.(); if (deleted && !embedded) navigate(`/forum/c/${post.circle.slug}`); else refresh(); }} />
        </footer>}
      </article>
      <Comments post={post} management={management} embedded={embedded} refreshPost={refresh} onContentChanged={onContentChanged} />
    </>}
  </div>;
}
export function ForumDiscussion(props: ForumDiscussionProps) {
  const { account } = useAuth();
  return <DiscussionContent key={`${account?.id}-${props.id}-${!!props.management}`} {...props} />;
}
