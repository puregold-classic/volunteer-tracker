import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, SquarePen, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { DraftablePostForm, useForumDraftDock } from './ForumDraftDock';
import { PostHeading } from './ForumInteractions';
import { ForumAuthor, ForumPagination, forumDate } from './ForumCommon';
import { useForumResource } from './useForumResource';
import { postService } from '@/services/postService';
import type { ForumCircle, ForumSort } from '@/services/types';

const sortLabels: Record<ForumSort, string> = { hot: '热门', activity: '最新回复', new: '最新发布' };
export function PostList({ circle, management = false }: { circle: ForumCircle; management?: boolean }) {
  const { floatingScope, returnRequest } = useForumDraftDock();
  const draftScope = `post:${circle.id}`;
  const [page, setPage] = useState(1), [creating, setCreating] = useState(false);
  const [editorActivity, setEditorActivity] = useState({ busy: false, uploading: false });
  const publishedPath = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [sort, setSort] = useState<ForumSort>(management ? 'new' : 'hot'), [featured, setFeatured] = useState(false);
  const seen = useRef(new Map<number, string[]>());
  const listRef = useRef<HTMLElement>(null);
  const [composeRight, setComposeRight] = useState(16);
  useLayoutEffect(() => {
    if (management || !listRef.current) return;
    const updatePosition = () => {
      if (listRef.current) setComposeRight(Math.max(16, document.documentElement.clientWidth - listRef.current.getBoundingClientRect().right));
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(listRef.current);
    observer.observe(document.documentElement);
    window.addEventListener('resize', updatePosition);
    return () => { observer.disconnect(); window.removeEventListener('resize', updatePosition); };
  }, [management]);
  const navigate = useNavigate();
  useEffect(() => {
    if (!management && returnRequest?.scope === draftScope) setCreating(true);
  }, [management, returnRequest, draftScope]);
  const load = useCallback(() => postService.list(circle.slug, page, management, sort, featured), [circle.slug, page, management, sort, featured]);
  const { data, loading, error, refresh } = useForumResource(load);
  const current = data?.currentPage === page && data.sort === sort && data.featuredOnly === featured ? data : null;
  useEffect(() => { if (current) seen.current.set(page, current.data.map((post) => post.id)); }, [current, page]);
  const earlier = new Set([...seen.current.entries()].filter(([p]) => p < page).flatMap(([, ids]) => ids));
  const posts = current?.data.filter((post) => sort !== 'hot' || !earlier.has(post.id)) || [];
  const reset = () => { seen.current.clear(); setPage(1); };
  const canCreate = !management && circle.status === 'ACTIVE' && !loading && !error && !!current;
  return <section ref={listRef} className={management ? 'space-y-4' : 'space-y-4 pb-[calc(9rem+env(safe-area-inset-bottom))]'} aria-label={management ? '内容管理' : '圈内讨论'}>
    {management && <div><h2 className="font-serif text-xl font-semibold">内容管理</h2><p className="mt-1 text-xs text-muted-foreground">查看全部帖子，进入讨论管理评论。</p></div>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="帖子排序" className="flex flex-wrap gap-1">{(Object.keys(sortLabels) as ForumSort[]).map((s) => <Button key={s} size="sm" variant={sort === s ? 'secondary' : 'ghost'} aria-pressed={sort === s} onClick={() => { reset(); setSort(s); }}>{sortLabels[s]}</Button>)}</nav>
      <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={featured} onChange={(event) => { reset(); setFeatured(event.target.checked); }} className="accent-primary" />只看精华</label><Button size="sm" variant="outline" onClick={() => { reset(); refresh(); }}>刷新帖子</Button></div>
    </div>
    {sort === 'hot' && <details className="text-xs leading-6 text-muted-foreground"><summary className="cursor-pointer">热门如何排序？</summary><p className="mt-2">综合历史点赞和近七天的点赞、不同评论人数，随时间降低权重。精华权重加倍，置顶始终优先。同一人反复评论只算一个参与者，楼主自回不增加近期热度；老帖有新互动也能回到前面。</p><p>排序会随互动变化，翻页时会隐藏前页已见的重复帖子，可随时刷新。</p></details>}
    {loading ? <p role="status" className="py-8 text-center text-muted-foreground">正在加载讨论…</p> : error ? <div role="alert" className="space-y-3 rounded-xl border border-border p-6"><p>{error}</p><Button onClick={refresh} variant="outline">重试</Button></div> : current && <>
      {posts.length ? <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">{posts.map((post) => <article key={post.id}><Link to={`/forum/p/${post.id}${management ? '?view=manage' : ''}`} aria-label={post.title} className="block space-y-2.5 p-4 transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-6 sm:py-5">
        <PostHeading post={post} compact />
        {post.status === 'DELETED' && <span className="inline-block rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">已删除</span>}
        <p className="line-clamp-3 break-words text-sm leading-7 text-foreground/85 [overflow-wrap:anywhere]">{post.excerpt}</p>
        <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3 pt-1">
          <div className="space-y-1"><ForumAuthor compact author={post.author} date={post.createdAt} editKind={post.lastEditKind} />{sort === 'activity' && <p className="text-xs text-muted-foreground">最后活动：{forumDate(post.lastActivityAt)}</p>}</div>
          <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums text-muted-foreground"><span className="inline-flex items-center gap-1.5"><ThumbsUp className="h-3.5 w-3.5" />{post.likeCount} 赞</span><span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />{post.commentCount} 条评论</span></div>
        </div>
      </Link></article>)}</div> : <div className="rounded-2xl border border-dashed border-border p-10 text-center"><p className="font-serif text-lg">{current.data.length ? '本页内容已在前页出现' : featured ? '还没有精华帖子' : '还没有讨论'}</p><p className="mt-2 text-sm text-muted-foreground">{current.data.length ? '热门排序发生了变化，可以继续翻页或刷新查看。' : featured ? '可以取消筛选，看看全部讨论。' : '从一声问候、一个问题或一次分享开始吧。'}</p></div>}
      <ForumPagination page={page} totalPages={current.totalPages} onPage={setPage} />
    </>}
    {canCreate && !creating && floatingScope !== draftScope && <Button type="button" size="icon" aria-label="发帖" title="发帖" style={{ right: `max(${composeRight}px, env(safe-area-inset-right))` }} className={`fixed z-30 h-14 w-14 rounded-full shadow-lg shadow-primary/25 hover:-translate-y-0.5 ${import.meta.env.DEV ? 'bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.5rem)]' : 'bottom-[max(1.25rem,env(safe-area-inset-bottom))]'}`} onClick={() => setCreating(true)}><SquarePen aria-hidden="true" className="h-6 w-6" /></Button>}
    <Dialog open={creating} onOpenChange={(open) => { if (!editorActivity.busy && !editorActivity.uploading) setCreating(open); }} title={`在${circle.name}发帖`} className="sm:max-w-3xl" closeOnOutsideClick={false}>
      {creating && <DraftablePostForm onActivityChange={setEditorActivity} draftScope={draftScope} circleId={circle.id} target={{ kind: 'post', circleId: circle.id, circleSlug: circle.slug, circleName: circle.name }} onDetached={() => setCreating(false)} submitLabel="发布帖子" onCancel={() => { if (!editorActivity.busy && !editorActivity.uploading) setCreating(false); }} save={async (input) => {
        const post = await postService.create(circle.slug, input);
        if (mounted.current) publishedPath.current = `/forum/p/${post.id}`;
      }} onPublished={() => {
        if (!mounted.current) return;
        const path = publishedPath.current;
        publishedPath.current = null;
        setEditorActivity({ busy: false, uploading: false });
        setCreating(false);
        if (path) navigate(path);
      }} />}
    </Dialog>
  </section>;
}
