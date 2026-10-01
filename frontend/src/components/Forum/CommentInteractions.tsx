import { useState } from 'react';
import { Bookmark, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { postService } from '@/services/postService';
import { forumError } from '@/services/forumService';
import type { ForumComment } from '@/services/types';

export function CommentInteractions({ comment, onChanged }: { comment: ForumComment; onChanged: (reorder: boolean) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!comment.capabilities.canInteract) return null;
  const act = (kind: 'pin' | 'favorite', selected: boolean) => {
    if (busy) return;
    setBusy(true); setError('');
    void postService.commentEngage(comment.id, kind, selected).then(() => onChanged(kind === 'pin'))
      .catch(err => setError(forumError(err))).finally(() => setBusy(false));
  };
  return <div>
    <div className="flex flex-wrap gap-1">
      <Button size="sm" variant={comment.isFavorited ? 'secondary' : 'ghost'} aria-label={comment.isFavorited ? '取消收藏评论' : '收藏评论'} aria-pressed={comment.isFavorited} disabled={busy} onClick={() => act('favorite', !comment.isFavorited)}><Bookmark className="h-3.5 w-3.5" />{comment.isFavorited ? '已收藏' : '收藏'}</Button>
      {comment.capabilities.canPin && <Button size="sm" variant="ghost" aria-label={comment.isPinned ? '取消置顶评论' : '置顶评论'} aria-pressed={comment.isPinned} disabled={busy} onClick={() => act('pin', !comment.isPinned)}><Pin className="h-3.5 w-3.5" />{comment.isPinned ? '取消置顶' : '置顶'}</Button>}
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
  </div>;
}
