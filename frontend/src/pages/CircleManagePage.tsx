import { CircleCoverSettings } from '@/components/Forum/CircleCover';
import { CircleFiles } from '@/components/Forum/CircleFiles';
import { PostList } from '@/components/Forum/PostList';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Archive, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { useCircle } from '@/components/Forum/useCircle';
import { CircleForm } from '@/components/Forum/CircleForm';
import { CircleRoles, type CircleAction } from '@/components/Forum/CircleRoles';
import { forumError, forumService } from '@/services/forumService';
import type { ForumCircle } from '@/services/types';

export default function CircleManagePage() {
  const { circle, setCircle, loading, error, refresh } = useCircle(true);
  const [action, setAction] = useState<CircleAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const navigate = useNavigate();
  const saved = (updated: ForumCircle) => {
    setCircle(updated);
    if (!updated.capabilities.canViewManagement) navigate(`/forum/c/${updated.slug}`, { replace: true });
    else if (updated.slug !== circle?.slug) navigate(`/forum/c/${updated.slug}/manage`, { replace: true });
  };
  const ask = (next: CircleAction) => { setActionError(''); setAction(next); };
  return <div className="mx-auto max-w-4xl space-y-6 px-2 py-4 sm:px-4 sm:py-8">
    <Link to="/forum" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />全部圈子</Link>
    {loading ? <p role="status" className="py-10 text-center text-muted-foreground">正在加载圈务资料…</p> : !circle ? <div role="alert" className="space-y-3 rounded-2xl border border-border p-8 text-center"><p>{error}</p><Button variant="outline" onClick={refresh}>重试</Button></div> : <>
      <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-serif text-2xl font-semibold">{circle.name} · 圈子管理</h1><p className="mt-2 text-sm text-muted-foreground">维护圈子资料与圈务成员。</p></div>{circle.status === 'ARCHIVED' ? <Badge variant="outline">已归档</Badge> : <Button asChild variant="outline"><Link to={`/forum/c/${circle.slug}`}>查看圈子</Link></Button>}</header>
      {circle.status === 'ARCHIVED' && <p className="rounded-xl border border-border bg-muted/50 p-4 text-sm">圈子已归档，对普通浏览隐藏。恢复后可以继续交流，之前删除的内容不会自动恢复。</p>}
      {circle.capabilities.canEditCircle && <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="font-serif text-xl font-semibold">基本设置</h2><CircleForm key={circle.id} circle={circle} onSaved={saved} /></section>}
      <CircleCoverSettings key={`cover-${circle.id}-${circle.status}`} circle={circle} onChange={coverId => setCircle({ ...circle, coverId })} />
      <CircleFiles key={`files-${circle.id}-${circle.status}`} circle={circle} management />
      <PostList key={`${circle.id}-${circle.status}`} circle={circle} management />
      <CircleRoles key={`${circle.id}-${circle.capabilities.circleRole}-${circle.status}`} circle={circle} onAction={ask} />
      {(circle.capabilities.canArchiveCircle || circle.capabilities.canRestoreCircle) && <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6"><div><h2 className="font-serif text-lg font-semibold">{circle.status === 'ARCHIVED' ? '恢复圈子' : '归档圈子'}</h2><p className="mt-1 text-sm text-muted-foreground">{circle.status === 'ARCHIVED' ? '让圈子重新出现在论坛中。' : '隐藏圈子并停止互动，保留全部历史内容。'}</p></div><Button variant="outline" onClick={() => ask({ title: circle.status === 'ARCHIVED' ? '恢复圈子' : '归档圈子', description: circle.status === 'ARCHIVED' ? `确认恢复“${circle.name}”？` : `确认归档“${circle.name}”？普通用户将无法访问圈子及其讨论。`, run: () => forumService.archive(circle.id, circle.status !== 'ARCHIVED') })}>{circle.status === 'ARCHIVED' ? <RotateCcw className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}{circle.status === 'ARCHIVED' ? '恢复圈子' : '归档圈子'}</Button></section>}
    </>}
    <Dialog open={!!action} onOpenChange={(open) => { if (!open && !busy) setAction(null); }} title={action?.title} closeOnOutsideClick={false} footer={<><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>取消</Button><Button disabled={busy} onClick={() => {
      if (!action || busy) return;
      setBusy(true); setActionError('');
      void action.run().then((updated) => { saved(updated); setAction(null); }).catch((err) => setActionError(forumError(err))).finally(() => setBusy(false));
    }}>{busy ? '正在处理…' : '确认'}</Button></>}><p className="text-sm leading-6">{action?.description}</p>{actionError && <p role="alert" className="mt-3 text-sm text-destructive">{actionError}</p>}</Dialog>
  </div>;
}
