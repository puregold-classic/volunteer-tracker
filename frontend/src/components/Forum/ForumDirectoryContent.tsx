import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ForumDirectoryComment, ForumDirectoryPost } from '@/services/types';
import { DirectoryMarks } from './ForumDirectoryTree';
import { ForumAuthor } from './ForumCommon';
import { Markdown } from './Markdown';

type ThreadProps = {
  post: ForumDirectoryPost;
  selected?: boolean;
};

function RelatedComment({ comment, post, located }: {
  comment: ForumDirectoryComment;
  post: ForumDirectoryPost;
  located: boolean;
}) {
  return <article id={`comment-${comment.id}`} className={`min-w-0 scroll-mt-24 space-y-2 rounded-xl border border-border/70 bg-card/60 p-4 sm:p-5 ${located ? 'bg-primary/5 ring-1 ring-inset ring-primary/25' : ''}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      {comment.author ? <ForumAuthor author={comment.author} date={comment.createdAt} /> : <span className="text-xs text-muted-foreground">评论暂不可见</span>}
      <div className="flex items-center gap-2"><DirectoryMarks node={comment} kind="comment" />{comment.isPinned && <span className="inline-flex items-center gap-1 text-xs text-primary"><Pin aria-hidden="true" className="h-3 w-3" />帖主置顶</span>}{!comment.unavailableReason && <Button size="icon-sm" variant="ghost" asChild><Link to={`/forum/p/${post.id}?commentId=${comment.id}`} aria-label="查看原文" title="查看原文"><ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link></Button>}</div>
    </div>
    <div className="min-w-0 sm:pl-12">
      {comment.unavailableReason ? <p className="text-sm leading-7 text-muted-foreground">{comment.unavailableReason}</p> : <Markdown body={comment.body ?? comment.excerpt ?? ''} bodyFormat={comment.bodyFormat ?? 'MARKDOWN'} />}
    </div>
  </article>;
}

export function ForumDirectoryContent({ post, selected = false }: ThreadProps) {
  const [params] = useSearchParams();
  const commentId = selected ? params.get('commentId') : null;
  const hasLocatedComment = post.comments.some(comment => comment.id === commentId);
  useEffect(() => {
    if (commentId && hasLocatedComment) document.getElementById(`comment-${commentId}`)?.scrollIntoView({ block: 'center' });
  }, [commentId, hasLocatedComment]);
  const heading = <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-xs text-muted-foreground">帖子</p><h3 className="break-words text-base font-semibold [overflow-wrap:anywhere]">{post.label}</h3></div><div className="flex shrink-0 items-center gap-2"><DirectoryMarks node={post} kind="post" />{!post.unavailableReason && <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />}</div></div>;
  return <section aria-label={`帖子及相关评论：${post.label}`} className="min-w-0 space-y-3">
    <section aria-label={`帖子摘要：${post.label}`} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {post.unavailableReason ? <div className="p-4 sm:p-5">{heading}<p className="mt-3 text-sm text-muted-foreground">{post.unavailableReason}，历史关系仍保留。</p></div> : <Link to={`/forum/p/${post.id}`} aria-label={`打开帖子：${post.label}`} className="block p-4 transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-5">
        {heading}<p className="mt-3 line-clamp-3 break-words text-sm leading-7 text-foreground/80 [overflow-wrap:anywhere]">{post.excerpt || '此帖包含图片，进入帖子查看完整内容。'}</p>
      </Link>}
    </section>
    {post.comments.map(comment => <RelatedComment key={comment.id} comment={comment} post={post} located={comment.id === commentId} />)}
  </section>;
}
