import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, MessageCircle, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CircleCover } from '@/components/Forum/CircleCover';
import { CircleForm } from '@/components/Forum/CircleForm';
import { forumService, forumError } from '@/services/forumService';
import { useAuth } from '@/context/AuthContext';
import type { ForumCircle } from '@/services/types';

export default function ForumPage() {
  const { account } = useAuth();
  const [rows, setRows] = useState<ForumCircle[]>([]);
  const [archived, setArchived] = useState<ForumCircle[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setRows([]); setArchived([]); setCanCreate(false);
    void Promise.all([forumService.list(), forumService.list('manage')]).then(([result, managed]) => { if (!cancelled) { setRows(result.circles); setArchived(managed.circles.filter((circle) => circle.status === 'ARCHIVED')); setCanCreate(result.canCreateCircle); } })
      .catch((err) => { if (!cancelled) setError(forumError(err)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [version, account?.id]);
  return <div className="mx-auto max-w-5xl space-y-6 px-2 py-4 sm:px-4 sm:py-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="font-serif text-3xl font-semibold">论坛</h1><p className="mt-2 text-sm text-muted-foreground">让知识和经验更有温度</p></div>
      {canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" />新建圈子</Button>}
    </div>
    {loading ? <p className="py-12 text-center text-sm text-muted-foreground" role="status">正在加载圈子…</p> : error ? <div role="alert" className="space-y-3 py-8 text-center"><p className="text-destructive">{error}</p><Button variant="outline" onClick={() => setVersion((v) => v + 1)}>重试</Button></div> : !rows.length ? <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center"><Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h2 className="font-serif text-lg">还没有开放的圈子</h2><p className="mt-2 text-sm text-muted-foreground">圈子开放后，会出现在这里。</p></div> : <div className="grid gap-4 sm:grid-cols-2">{rows.map((circle) => <article key={circle.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
      {circle.coverId && <div className="-mx-5 -mt-5 mb-5 overflow-hidden rounded-t-2xl sm:-mx-6 sm:-mt-6"><CircleCover id={circle.coverId} name={circle.name} card /></div>}
      <div className="mb-4 flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></div><div className="flex flex-wrap gap-1">{circle.status === 'ARCHIVED' && <Badge variant="outline">已归档</Badge>}{circle.capabilities.canViewManagement && circle.needsOwner && <Badge variant="outline">待指派圈主</Badge>}</div></div>
      <h2 className="font-serif text-xl font-semibold"><Link to={`/forum/c/${circle.slug}`} className="hover:text-primary">{circle.name}</Link></h2>
      <p className="mt-2 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{circle.description || '在这里与同伴交流。'}</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4"><span className="text-xs text-muted-foreground">{circle.postCount} 篇讨论</span><div className="flex gap-2">{circle.status === 'ACTIVE' && <Button size="sm" variant="outline" asChild><Link to={`/forum/c/${circle.slug}`}>进入圈子<ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link></Button>}</div></div>
    </article>)}</div>}
    {!loading && !error && archived.length > 0 && <details className="rounded-2xl border border-border bg-muted/20 p-5">
      <summary className="cursor-pointer text-sm text-muted-foreground">已归档圈子（{archived.length}）</summary>
      <ul className="mt-4 divide-y divide-border">{archived.map((circle) => <li key={circle.id} className="flex items-center justify-between gap-4 py-3"><span className="min-w-0 break-words font-medium">{circle.name}</span><Button asChild variant="outline" size="sm" className="shrink-0"><Link to={`/forum/c/${circle.slug}/manage`} aria-label={`管理归档圈子 ${circle.name}`}>圈子管理</Link></Button></li>)}</ul>
    </details>}
    <Dialog open={createOpen} onOpenChange={setCreateOpen} title="新建圈子" closeOnOutsideClick={false}>{createOpen && <CircleForm onSaved={(circle) => { setCreateOpen(false); navigate(`/forum/c/${circle.slug}/manage`); }} />}</Dialog>
  </div>;
}
