import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Bookmark, ChevronDown, ChevronRight, FileText, UserRound, UsersRound } from 'lucide-react';
import type { ForumDirectoryCircle, ForumDirectoryIdentity } from '@/services/types';
import type { DirectorySelection } from './forumDirectory';

export function DirectoryMarks({ node, kind }: { node: Pick<ForumDirectoryIdentity, 'mine' | 'saved'>; kind: 'circle' | 'post' | 'comment' }) {
  const ownLabel = kind === 'circle' ? '我管理的圈子' : kind === 'post' ? '我发布的帖子' : '我的评论';
  const savedLabel = kind === 'circle' ? '关注的圈子' : kind === 'post' ? '收藏的帖子' : '收藏的评论';
  return <span className="inline-flex shrink-0 items-center gap-1.5">{node.mine && <span role="img" aria-label={ownLabel} title={ownLabel} className="text-primary"><UserRound aria-hidden="true" className="h-3.5 w-3.5" /></span>}{node.saved && <span role="img" aria-label={savedLabel} title={savedLabel} className="text-amber-600 dark:text-amber-400"><Bookmark aria-hidden="true" className="h-3.5 w-3.5" /></span>}</span>;
}
export function ForumDirectoryTree({ circles, selected, onSelect }: { circles: ForumDirectoryCircle[]; selected: DirectorySelection | null; onSelect: (selection: DirectorySelection) => void }) {
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const tree = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (selected?.type !== 'post') return;
    const parent = circles.find(circle => circle.posts.some(post => post.id === selected.id));
    if (parent) setClosed(previous => { if (!previous.has(parent.id)) return previous; const next = new Set(previous); next.delete(parent.id); return next; });
  }, [selected?.type, selected?.id, circles]);
  const toggle = (id: string) => setClosed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const keyDown = (event: KeyboardEvent<HTMLLIElement>, item: DirectorySelection, hasChildren = false) => {
    event.stopPropagation();
    const element = event.currentTarget;
    const items = Array.from(tree.current?.querySelectorAll<HTMLLIElement>('[role="treeitem"]') || []);
    const index = items.indexOf(element);
    let target: HTMLLIElement | undefined;
    switch (event.key) {
      case 'ArrowDown': target = items[index + 1]; break;
      case 'ArrowUp': target = items[index - 1]; break;
      case 'Home': target = items[0]; break;
      case 'End': target = items[items.length - 1]; break;
      case 'ArrowRight':
        if (item.type === 'circle' && hasChildren) { if (closed.has(item.id)) toggle(item.id); else target = items[index + 1]; }
        break;
      case 'ArrowLeft':
        if (item.type === 'circle' && hasChildren && !closed.has(item.id)) toggle(item.id);
        else target = element.parentElement?.closest<HTMLLIElement>('[role="treeitem"]') || undefined;
        break;
      case 'Enter': case ' ': onSelect(item); break;
      default: return;
    }
    event.preventDefault(); target?.focus();
  };
  const isSelected = (type: DirectorySelection['type'], id: string) => selected?.type === type && selected.id === id;
  const rowClass = (active: boolean, kind: 'circle' | 'post') => `flex min-w-0 items-center gap-2 rounded-lg border-l-2 px-2 text-sm transition-colors ${kind === 'circle' ? 'py-2.5 font-semibold' : 'py-2 font-normal'} ${active ? 'border-primary bg-primary/10 text-primary' : kind === 'circle' ? 'border-transparent bg-muted/35 text-foreground hover:bg-muted/60' : 'border-transparent text-foreground/75 hover:bg-muted/60'}`;
  return <ul ref={tree} role="tree" aria-label="我的论坛目录" className="space-y-2">
    {circles.map((circle, index) => <li key={circle.id} role="treeitem" aria-label={circle.label} aria-level={1} aria-selected={isSelected('circle', circle.id)} aria-expanded={circle.posts.length ? !closed.has(circle.id) : undefined} tabIndex={isSelected('circle', circle.id) || (closed.has(circle.id) && selected?.type === 'post' && circle.posts.some(post => post.id === selected.id)) || (!selected && index === 0) ? 0 : -1} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50" onKeyDown={event => keyDown(event, { type: 'circle', id: circle.id }, circle.posts.length > 0)}>
      <div className={`${rowClass(isSelected('circle', circle.id), 'circle')} cursor-pointer`} onClick={() => onSelect({ type: 'circle', id: circle.id })}>
        {circle.posts.length ? <button type="button" tabIndex={-1} aria-label={`${closed.has(circle.id) ? '展开' : '收起'}${circle.label}`} className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-muted" onClick={event => { event.stopPropagation(); toggle(circle.id); }}>{closed.has(circle.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button> : <span className="w-5 shrink-0" />}
        <UsersRound aria-hidden="true" className="h-4 w-4 shrink-0 text-current" /><span className="min-w-0 flex-1 truncate" title={circle.label}>{circle.label}</span><DirectoryMarks node={circle} kind="circle" />
      </div>
      {!!circle.posts.length && !closed.has(circle.id) && <ul role="group" className="ml-11 mt-1 pl-4">
        {circle.posts.map(post => <li key={post.id} role="treeitem" aria-label={post.label} aria-level={2} aria-selected={isSelected('post', post.id)} tabIndex={isSelected('post', post.id) ? 0 : -1} className={`${rowClass(isSelected('post', post.id), 'post')} relative cursor-pointer outline-none before:pointer-events-none before:absolute before:-left-4 before:top-1/2 before:w-4 before:border-t before:border-border after:pointer-events-none after:absolute after:inset-y-0 after:-left-4 after:border-l after:border-border last:after:bottom-1/2 focus-visible:ring-2 focus-visible:ring-primary/50`} onClick={event => { event.stopPropagation(); onSelect({ type: 'post', id: post.id }); }} onKeyDown={event => keyDown(event, { type: 'post', id: post.id })}>
          <FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate" title={post.label}>{post.label}</span><DirectoryMarks node={post} kind="post" />
        </li>)}
      </ul>}
    </li>)}
  </ul>;
}
