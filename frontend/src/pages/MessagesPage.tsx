import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, CheckCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ForumPagination, forumDate } from '@/components/Forum/ForumCommon';
import { useForumResource } from '@/components/Forum/useForumResource';
import { useNotifications } from '@/components/Notifications/NotificationProvider';
import { notificationService, type NotificationItem } from '@/services/notificationService';
import { forumError } from '@/services/forumService';
export default function MessagesPage() {
  const [params, setParams] = useSearchParams(), navigate = useNavigate();
  const filter = params.get('filter') === 'unread' ? 'unread' : 'all';
  const requested = Number(params.get('page') || 1), page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  const load = useCallback(() => notificationService.list(filter, page), [filter, page]);
  const { data, loading, error, refresh } = useForumResource(load);
  const { refresh: refreshBadge } = useNotifications();
  const [busy, setBusy] = useState<string | null>(null), [actionError, setActionError] = useState(''), [notice, setNotice] = useState('');
  useEffect(() => { if (data) void refreshBadge(); }, [data, refreshBadge]);
  const reload = () => { refresh(); void refreshBadge(); };
  const act = async (item: NotificationItem | null, open = false) => {
    if (busy || !data) return;
    setBusy(item?.id || 'all'); setActionError(''); setNotice('');
    try {
      if (item) {
        const current = await notificationService.markRead(item.id);
        if (open && current.href) { void refreshBadge(); navigate(current.href); return; }
        if (open) setNotice(current.unavailableReason || '目标已不可用');
      } else {
        await notificationService.readAll(data.viewedAt);
        setNotice('已将本次查看前收到的消息标记为已读。');
      }
      if (filter === 'unread' && page > 1) setParams({ filter, page: '1' });
      else refresh();
    } catch (err) { setActionError(forumError(err)); refresh(); }
    finally { setBusy(null); void refreshBadge(); }
  };
  return <div className="mx-auto max-w-4xl space-y-6 px-2 py-4 sm:px-4 sm:py-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-medium tracking-widest text-primary">每一次回应 · 都有回响</p><h1 className="font-serif text-3xl font-semibold">消息中心</h1><p className="mt-2 text-sm text-muted-foreground">查看回复、@ 提及和圈务消息。</p></div><Button variant="outline" disabled={loading || !!busy || !data?.unreadCount} onClick={() => void act(null)}><CheckCheck className="h-4 w-4" />全部已读</Button></header>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"><nav className="flex gap-2" aria-label="消息筛选">{(['all', 'unread'] as const).map((value) => <Button key={value} variant={filter === value ? 'secondary' : 'ghost'} aria-pressed={filter === value} disabled={!!busy} onClick={() => { setNotice(''); setActionError(''); setParams({ filter: value }); }}>{value === 'all' ? '全部消息' : '未读消息'}</Button>)}</nav><Button variant="ghost" size="sm" disabled={loading || !!busy} onClick={reload}><RefreshCw className="h-3.5 w-3.5" />刷新消息</Button></div>
    {actionError && <p role="alert" className="rounded-xl border border-destructive/20 p-4 text-sm text-destructive">{actionError}</p>}
    {notice && <p role="status" className="rounded-xl bg-muted/50 p-4 text-sm">{notice}</p>}
    {loading ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">正在加载消息…</p> : error ? <div role="alert" className="space-y-4 py-10 text-center"><p>{error}</p><Button variant="outline" onClick={reload}>重试</Button></div> : data?.data.length ? <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">{data.data.map((item) => <article key={item.id} className={`space-y-3 p-5 sm:p-6 ${!item.readAt ? 'bg-primary/[0.03]' : ''}`}>
      <div className="flex items-start gap-3"><span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-transparent' : 'bg-primary'}`} aria-hidden="true" /><div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2"><h2 className="break-words text-sm leading-6 [overflow-wrap:anywhere]"><span className="font-semibold">{item.actor.name}</span><span className="text-muted-foreground"> {item.summary}</span></h2><span className="shrink-0 text-xs text-muted-foreground">{item.readAt ? '已读' : '未读'}</span></div>{item.contextTitle && <p className="break-words font-serif text-lg leading-7 [overflow-wrap:anywhere]">{item.contextTitle}</p>}{item.unavailableReason && <p className="text-sm text-muted-foreground">{item.unavailableReason}</p>}<time className="block text-xs text-muted-foreground" dateTime={item.createdAt}>{forumDate(item.createdAt)}</time><div className="flex flex-wrap gap-2 pt-1"><Button variant="outline" size="sm" disabled={!!busy} onClick={() => void act(item, true)}>{item.href ? '查看详情' : '查看状态'}</Button>{!item.readAt && <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void act(item)}>标为已读</Button>}</div></div></div>
    </article>)}</div> : <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center"><Mail className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><h2 className="font-serif text-xl">{filter === 'unread' ? '没有未读消息' : '暂时没有消息'}</h2><p className="mt-2 text-sm text-muted-foreground">{filter === 'unread' ? '新的回应会出现在这里。' : '收到回复、提及或圈务通知后，可以在这里查看。'}</p></div>}
    {!loading && !error && <ForumPagination page={page} totalPages={data?.totalPages || 0} onPage={(next) => setParams({ filter, page: String(next) })} />}
  </div>;
}
