import { ForumAvatar } from './ForumAvatar';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ForumAuthorIdentity } from '@/services/types';

export const forumDate = (value: string) => new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export function ForumAuthor({ author, date, editKind, compact = false }: { author: ForumAuthorIdentity; date: string; editKind?: string | null; compact?: boolean }) {
  return <div className={`flex min-w-0 items-center ${compact ? 'gap-2' : 'gap-3'}`}><ForumAvatar author={author} size={compact ? 'sm' : 'default'} /><div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]"><span className="font-medium text-foreground">{author.name}</span>{author.isSystemAdmin && <span>系统管理员</span>}<time dateTime={date}>{forumDate(date)}</time>{editKind && <span>{editKind === 'ADMIN' ? '由系统管理员编辑' : '已编辑'}</span>}</div></div>;
}
export function ForumPagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1 && page === 1) return null;
  return <nav aria-label="分页" className="flex items-center justify-center gap-4 py-3"><Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</Button><span className="text-sm text-muted-foreground">{page} / {Math.max(1, totalPages)}</span><Button variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>下一页</Button></nav>;
}
export function ForumWorkspaceEntry() {
  return <Link to="/me/forum" aria-label="打开我的论坛" className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderTree aria-hidden="true" className="h-5 w-5" /></span><div><h2 className="font-serif font-semibold">我的论坛</h2><p className="mt-1 text-xs text-muted-foreground">从目录查看我的参与和关注收藏</p></div></div><ArrowUpRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" /></Link>;
}
