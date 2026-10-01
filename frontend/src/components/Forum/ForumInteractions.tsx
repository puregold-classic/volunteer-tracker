import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, Bookmark, Pin, Sparkles, BellPlus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { postService } from '@/services/postService';
import { forumError } from '@/services/forumService';
import type { ForumPost } from '@/services/types';

export function PostHeading({ post, href, compact = false }: { post: Pick<ForumPost, 'title' | 'isPinned' | 'isFeatured'>; href?: string; compact?: boolean }) {
  const pinned = post.isPinned && <span className="mr-2 inline-flex translate-y-[-1px] items-center gap-1 rounded-md bg-primary/10 px-1.5 py-1 align-middle font-sans text-xs font-medium text-primary"><Pin className="h-3 w-3" />置顶</span>;
  return <div className="flex items-start justify-between gap-3 sm:gap-5">
    {href || compact ? <h3 className="min-w-0 break-words text-base font-semibold leading-6 sm:text-lg [overflow-wrap:anywhere]"><>{pinned}{href ? <Link className="transition-colors hover:text-primary" to={href}>{post.title}</Link> : post.title}</></h3> : <h1 className="min-w-0 break-words text-xl font-semibold leading-snug sm:text-2xl [overflow-wrap:anywhere]">{pinned}{post.title}</h1>}
    {post.isFeatured && <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2 py-1 text-xs font-medium text-primary"><Sparkles className="h-3 w-3" />精华</span>}
  </div>;
}
export function PostInteractions({ post, management = false, onUpdate }: { post: ForumPost; management?: boolean; onUpdate: (patch: Partial<ForumPost>) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!post.capabilities.canInteract) return null;
  const act = (kind: 'like' | 'favorite' | 'pin' | 'feature', selected: boolean) => {
    if (busy) return;
    setBusy(true); setError('');
    const request = kind === 'like' || kind === 'favorite' ? postService.engage(post.id, kind, selected) : postService.mark(post.id, kind, selected);
    void request.then(onUpdate).catch((err) => setError(forumError(err))).finally(() => setBusy(false));
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      {!management && <><Button variant={post.isLiked ? 'secondary' : 'outline'} aria-label={post.isLiked ? '取消点赞' : '点赞'} aria-pressed={post.isLiked} disabled={busy} onClick={() => act('like', !post.isLiked)}><ThumbsUp className="h-4 w-4" />{post.isLiked ? '已赞' : '点赞'} {post.likeCount}</Button>
      <Button variant={post.isFavorited ? 'secondary' : 'outline'} aria-label={post.isFavorited ? '取消收藏' : '收藏帖子'} aria-pressed={post.isFavorited} disabled={busy} onClick={() => act('favorite', !post.isFavorited)}><Bookmark className="h-4 w-4" />{post.isFavorited ? '已收藏' : '收藏'}</Button></>}
      {management && post.capabilities.canPin && <Button variant="outline" size="sm" disabled={busy} onClick={() => act('pin', !post.isPinned)}><Pin className="h-3.5 w-3.5" />{post.isPinned ? '取消置顶' : '置顶帖子'}</Button>}
      {management && post.capabilities.canFeature && <Button variant="outline" size="sm" disabled={busy} onClick={() => act('feature', !post.isFeatured)}><Sparkles className="h-3.5 w-3.5" />{post.isFeatured ? '取消精华' : '设为精华'}</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
export function FollowCircle({ id, following, onChange }: { id: string; following: boolean; onChange: (following: boolean) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <div className="space-y-2"><Button variant={following ? 'secondary' : 'outline'} size="sm" aria-label={following ? '取消关注圈子' : '关注圈子'} aria-pressed={following} disabled={busy} onClick={() => {
    if (busy) return;
    setBusy(true); setError('');
    void postService.follow(id, !following).then((data) => onChange(data.isFollowing)).catch((err) => setError(forumError(err))).finally(() => setBusy(false));
  }}>{following ? <Check className="mr-1 h-4 w-4" /> : <BellPlus className="mr-1 h-4 w-4" />}{following ? '已关注' : '关注圈子'}</Button>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div>;
}
