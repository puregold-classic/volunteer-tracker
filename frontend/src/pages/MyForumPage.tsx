import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, ChevronRight, FolderTree, Layers3, RefreshCw, UserRound, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CircleCover } from '@/components/Forum/CircleCover';
import { ForumDirectoryContent } from '@/components/Forum/ForumDirectoryContent';
import { DirectoryMarks, ForumDirectoryTree } from '@/components/Forum/ForumDirectoryTree';
import { filterDirectory, findDirectoryItem, firstDirectorySelection, matchesDirectoryFilter, type DirectoryFilter, type DirectorySelection } from '@/components/Forum/forumDirectory';
import { useAuth } from '@/context/AuthContext';
import { postService } from '@/services/postService';
import { forumError } from '@/services/forumService';
import type { ForumDirectoryCircle } from '@/services/types';

function CircleSummary({ circle }: { circle: ForumDirectoryCircle }) {
  const href = circle.slug ? `/forum/c/${circle.slug}` : circle.managementSlug ? `/forum/c/${circle.managementSlug}/manage` : null;
  const content = <>
    <div aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary [&>div]:h-8 [&>div]:w-8 [&>div]:rounded-lg">
      {circle.coverId ? <CircleCover id={circle.coverId} name={circle.label} icon /> : <UsersRound className="h-4 w-4" />}
    </div>
    <h2 className="min-w-0 break-words text-base font-semibold [overflow-wrap:anywhere]">{circle.label}</h2>
  </>;
  return <section aria-label="所选圈子" className="overflow-hidden rounded-xl border border-primary/15 bg-primary/5 shadow-sm">
    {href ? <Link to={href} aria-label={`进入圈子：${circle.label}`} className="flex items-center gap-3 p-3 transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-4">{content}</Link> : <div className="flex items-center gap-3 p-3 sm:px-4">{content}</div>}
  </section>;
}
const filters = [
  { value: 'all', label: '全部', icon: Layers3 },
  { value: 'mine', label: '我的参与', icon: UserRound },
  { value: 'saved', label: '关注收藏', icon: Bookmark },
] as const;

export default function MyForumPage() {
  const { account } = useAuth();
  const [params, setParams] = useSearchParams();
  const [mobileTree, setMobileTree] = useState(true);
  const requestedFilter = params.get('filter');
  const filter: DirectoryFilter = requestedFilter === 'mine' || requestedFilter === 'saved' || requestedFilter === 'all' ? requestedFilter : params.get('tab') === 'favorites' ? 'saved' : ['posts', 'comments'].includes(params.get('tab') || '') ? 'mine' : 'all';
  const query = useQuery({ queryKey: ['forum-directory', account?.id], queryFn: postService.directory, enabled: !!account, retry: false });
  const circles = useMemo(() => filterDirectory(query.data?.circles || [], filter), [query.data, filter]);
  const requestedType = params.get('type'), requestedId = params.get('selected');
  const selection: DirectorySelection | null = requestedId && (requestedType === 'circle' || requestedType === 'post') ? { type: requestedType, id: requestedId } : null;
  const selected = findDirectoryItem(circles, selection);
  const refresh = () => { void query.refetch(); };
  const selectItem = (item: DirectorySelection, commentId?: string) => {
    const next = new URLSearchParams({ filter, type: item.type, selected: item.id });
    const found = findDirectoryItem(circles, item);
    const targetComment = commentId || (found?.type === 'post' && !matchesDirectoryFilter(found.post, filter) ? found.post.comments.find(comment => !comment.unavailableReason)?.id : undefined);
    if (targetComment) next.set('commentId', targetComment);
    setParams(next); setMobileTree(false);
  };
  useEffect(() => {
    if (!query.data || selected) return;
    const tab = params.get('tab');
    const preferred = tab === 'comments' || params.get('kind') === 'comments' ? 'comment' : tab === 'posts' || tab === 'favorites' ? 'post' : tab === 'circles' ? 'circle' : undefined;
    const first = firstDirectorySelection(circles, filter, preferred);
    if (!first) return;
    const next = new URLSearchParams({ filter, type: first.type, selected: first.id });
    if (preferred === 'comment' || (first.type === 'post' && !matchesDirectoryFilter(findDirectoryItem(circles, first)!.node, filter))) {
      const item = findDirectoryItem(circles, first);
      const comment = item?.type === 'post' ? item.post.comments.find(comment => !comment.unavailableReason) : null;
      if (comment) next.set('commentId', comment.id);
    }
    setParams(next, { replace: true });
  }, [query.data, circles, filter, selected, params, setParams]);
  return <div className="mx-auto max-w-7xl space-y-5 px-2 py-4 sm:px-4 sm:py-7">
    <Link to="/me" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft aria-hidden="true" className="h-4 w-4" />返回个人中心</Link>
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-serif text-2xl font-semibold sm:text-3xl">我的论坛</h1><p className="mt-2 text-sm text-muted-foreground">从圈子和帖子，找回自己的交流与收藏。</p></div><nav aria-label="论坛关系筛选" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">{filters.map(({ value, label, icon: Icon }) => <Button key={value} size="sm" variant={filter === value ? 'secondary' : 'ghost'} aria-pressed={filter === value} onClick={() => { const next = new URLSearchParams(params); next.set('filter', value); next.delete('tab'); next.delete('kind'); next.delete('cursor'); next.delete('commentId'); setParams(next); }}><Icon aria-hidden="true" className="h-4 w-4" />{label}</Button>)}</nav></header>
    {query.isPending ? <p role="status" className="py-12 text-center text-muted-foreground">正在加载我的论坛…</p> : query.isError && !query.data ? <div role="alert" className="space-y-3 rounded-2xl border border-border p-6"><p>{forumError(query.error)}</p><Button variant="outline" onClick={refresh}>重试</Button></div> : <>
      {query.isError && <p role="alert" className="text-sm text-destructive">目录更新失败，当前保留上次内容。<Button size="sm" variant="ghost" onClick={refresh}>重试</Button></p>}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-7">
        <aside className="min-w-0 overflow-hidden rounded-2xl border border-border bg-muted/20 lg:sticky lg:top-24" aria-label="论坛目录">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><FolderTree aria-hidden="true" className="h-4 w-4" />目录</h2><div className="flex gap-1"><Button size="icon-sm" variant="ghost" aria-label="刷新目录" disabled={query.isFetching} onClick={refresh}><RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} /></Button><Button size="sm" variant="ghost" className="lg:hidden" aria-expanded={mobileTree} aria-controls="forum-directory" onClick={() => setMobileTree(value => !value)}>{mobileTree ? '收起' : '展开'}</Button></div></div>
          <div id="forum-directory" className={`${mobileTree ? 'block' : 'hidden'} max-h-[45vh] overflow-y-auto p-2 lg:block lg:max-h-[calc(100dvh-14rem)]`}>
            {circles.length ? <ForumDirectoryTree circles={circles} selected={selected ? { type: selected.type, id: selected.node.id } : null} onSelect={selectItem} /> : <p className="px-3 py-8 text-center text-sm leading-6 text-muted-foreground">{filter === 'saved' ? '还没有关注或收藏的内容' : filter === 'mine' ? '还没有管理的圈子或发布的内容' : '还没有相关内容'}</p>}
          </div>
          <div className="border-t border-border px-4 py-3 text-xs leading-6 text-muted-foreground">仅显示相关圈子与帖子；无标记的父级仅用于定位。</div>
        </aside>
        <section aria-label="当前条目" className="min-w-0 space-y-5">
          {!selected ? <div className="rounded-2xl border border-dashed border-border px-5 py-16 text-center"><FolderTree aria-hidden="true" className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">{circles.length ? '从目录选择一个圈子或帖子' : '关注圈子、发布内容或收藏讨论后，会出现在这里。'}</p><Button variant="outline" asChild className="mt-5"><Link to="/forum">去论坛看看</Link></Button></div> : selected.type === 'circle' ? <>
            <CircleSummary circle={selected.circle} />
            {selected.circle.posts.length ? <div className="space-y-5"><h2 className="text-sm font-semibold text-muted-foreground">相关帖子</h2>{selected.circle.posts.map(post => <ForumDirectoryContent key={`${account?.id}-circle-${post.id}`} post={post} />)}</div> : <p className="rounded-xl border border-dashed border-border p-6 text-sm leading-7 text-muted-foreground">此圈子下还没有符合当前筛选的帖子或评论。点击上方圈子卡片，可以浏览圈内讨论。</p>}
          </> : <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><button type="button" className="inline-flex min-w-0 items-center gap-1 hover:text-primary" onClick={() => selectItem({ type: 'circle', id: selected.circle.id })}><UsersRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{selected.circle.label}</span><ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /></button><DirectoryMarks node={selected.post} kind="post" /></div>
            <ForumDirectoryContent key={`${account?.id}-post-${selected.post.id}`} post={selected.post} selected />
          </>}
        </section>
      </div>
    </>}
  </div>;
}
