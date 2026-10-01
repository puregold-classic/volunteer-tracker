import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, GraduationCap, Pencil, Plus, RefreshCw, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormInput } from '@/components/shared/form-fields';
import { TrainingForm } from '@/components/Training/TrainingForm';
import { TrainingEntry } from '@/components/Training/TrainingEntry';
import { trainingService, trainingError, type TrainingPerson, type TrainingSession } from '@/services/trainingService';

function Pager({ page, total, size, change }: { page: number; total: number; size: number; change: (n: number) => void }) {
  if (total <= size) return null;
  return <div className="flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground"><Button variant="ghost" size="icon-sm" disabled={page === 1} aria-label="上一页" onClick={() => change(page - 1)}><ChevronLeft size={16} /></Button><span>{page} / {Math.ceil(total / size)} 页 · 共 {total} 项</span><Button variant="ghost" size="icon-sm" disabled={page * size >= total} aria-label="下一页" onClick={() => change(page + 1)}><ChevronRight size={16} /></Button></div>;
}
export default function TrainingPage() {
  const { id } = useParams(); const navigate = useNavigate();
  const [sessions, setSessions] = useState<TrainingSession[]>([]), [total, setTotal] = useState(0), [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [page, setPage] = useState(1);
  const [session, setSession] = useState<TrainingSession | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [rosterSearch, setRosterSearch] = useState(''), [rosterPage, setRosterPage] = useState(1), [removed, setRemoved] = useState(false);
  const [revision, setRevision] = useState(0), [form, setForm] = useState<'create' | 'edit' | null>(null);
  const [action, setAction] = useState<{ person: TrainingPerson; restore: boolean } | null>(null), [busy, setBusy] = useState(false), [actionError, setActionError] = useState('');
  const refresh = () => { setLoading(true); setRevision((v) => v + 1); };
  useEffect(() => { let live = true; setListLoading(true); const timer = setTimeout(() => { trainingService.list({ search, from, to, page, limit: 20 }).then((r) => { if (live) { setSessions(r.items); setTotal(r.total); } }).catch((e) => live && setError(trainingError(e))).finally(() => live && setListLoading(false)); }, 200); return () => { live = false; clearTimeout(timer); }; }, [search, from, to, page, revision]);
  useEffect(() => { setRosterSearch(''); setRosterPage(1); setRemoved(false); setSession(null); }, [id]);
  useEffect(() => { let live = true; if (!id) return; setLoading(true); setError(''); const timer = setTimeout(() => { trainingService.detail(id, { search: rosterSearch, page: rosterPage, limit: 30, removed: String(removed) }).then((s) => live && setSession(s)).catch((e) => live && setError(trainingError(e))).finally(() => live && setLoading(false)); }, 100); return () => { live = false; clearTimeout(timer); }; }, [id, revision, rosterSearch, rosterPage, removed]);
  const ask = (person: TrainingPerson, restore: boolean) => { setAction({ person, restore }); setActionError(''); };
  return <div className="mx-auto max-w-[1280px] space-y-5 px-2 py-3 sm:px-4 sm:py-6">
    <header className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card px-6 py-6 sm:px-7">
      <div aria-hidden className="pointer-events-none absolute -right-4 -top-12 rotate-[-15deg] text-primary/[0.055]"><GraduationCap size={220} strokeWidth={0.8} /></div>
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div><p className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.15em] text-primary"><span className="h-px w-6 bg-primary/60" />一起学习，共同成长</p><h1 className="font-serif text-3xl font-semibold tracking-tight">培训考勤</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">记录每一次学习，也照顾好每一位参加的伙伴。</p></div>
        <Button onClick={() => setForm('create')} className="shadow-sm"><Plus size={17} className="mr-1.5" />新建培训</Button>
      </div>
    </header>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm"><span>{error}</span><Button variant="ghost" size="sm" onClick={refresh}><RefreshCw size={14} className="mr-2" />重试</Button></div>}
    <div className="grid items-start gap-5 lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className={`${id ? 'hidden lg:block' : ''} rounded-3xl border border-border bg-card p-4 shadow-sm`}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-lg font-semibold">培训场次</h2><span className="rounded-full bg-muted px-2.5 py-0.5 text-xs tabular-nums text-muted-foreground">{total}</span></div>
        <div className="relative"><Search size={15} className="absolute left-3 top-3.5 text-muted-foreground" /><FormInput aria-label="查找培训场次" placeholder="查找培训…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" /></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><label className="min-w-0 text-[11px] text-muted-foreground">开始日期<FormInput type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="mt-1 min-w-0 px-2 text-xs" /></label><label className="min-w-0 text-[11px] text-muted-foreground">结束日期<FormInput type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="mt-1 min-w-0 px-2 text-xs" /></label></div>
        <div className="mt-5 max-h-[65vh] space-y-2 overflow-y-auto">{listLoading && !sessions.length ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">正在读取场次…</p> : !sessions.length ? <div className="py-8 text-center"><BookOpen size={30} strokeWidth={1.2} className="mx-auto mb-3 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">{search || from || to ? '没有符合条件的培训' : '还没有培训场次'}</p></div> : sessions.map((s) => <Link to={`/training/${s.id}`} key={s.id} className={`group block rounded-2xl border p-3.5 transition-colors ${id === s.id ? 'border-primary/25 bg-primary/7 shadow-sm' : 'border-transparent hover:border-border hover:bg-muted/40'}`}><div className="flex items-start justify-between gap-2"><h3 className={`line-clamp-2 text-sm font-semibold leading-6 ${id === s.id ? 'text-primary' : ''}`}>{s.name}</h3>{id === s.id && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}</div><p className="mt-1 truncate text-xs text-muted-foreground">{s.serviceItem.name}</p><div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>{s.serviceDate}</span><span className="inline-flex items-center gap-1"><Users size={12} />{s.activeCount} 人</span></div></Link>)}</div>
        <Pager page={page} total={total} size={20} change={setPage} />
      </aside>

      {!id ? <section className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-primary/20 bg-card/60 px-6 text-center"><div className="mb-5 grid h-20 w-20 place-items-center rounded-[1.75rem] bg-primary/8 text-primary"><GraduationCap size={38} strokeWidth={1.2} /></div><h2 className="font-serif text-2xl font-semibold">从一场培训开始</h2><p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">选择已有场次继续补录，或创建一场新培训。<br />培训信息与参加名单可以分别保存。</p><Button className="mt-6" variant="outline" onClick={() => setForm('create')}><Plus size={16} className="mr-2" />建立培训场次</Button></section> : !session ? <div role="status" className="py-16 text-center text-sm text-muted-foreground">{loading ? '正在打开培训…' : '请选择有效场次'}</div> : <div className="min-w-0 space-y-4">
        <Link to="/training" className="inline-flex items-center gap-2 text-sm text-muted-foreground lg:hidden"><ArrowLeft size={15} />全部场次</Link>
        <section aria-label="培训信息" className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="h-1 bg-gradient-to-r from-primary/60 via-primary/15 to-transparent" />
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="mb-1.5 text-[11px] font-medium tracking-widest text-primary">正在维护的培训</p><h2 className="break-words font-serif text-2xl font-semibold leading-snug">{session.name}</h2></div>
              {session.canEdit && <Button size="sm" variant="outline" className="shrink-0" aria-label="编辑培训信息" disabled={loading} onClick={() => { void trainingService.detail(session.id, { search: rosterSearch, page: rosterPage, removed: String(removed) }).then((latest) => { setSession(latest); setForm('edit'); }).catch((e) => setError(trainingError(e))); }}><Pencil size={14} className="mr-1.5" />编辑</Button>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="rounded-md bg-primary/7 px-2 py-1 font-medium text-primary">{session.serviceItem.name}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{session.serviceDate}</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 size={14} />每人 {session.duration} 小时</span>
              <span className="inline-flex items-center gap-1.5"><Users size={14} />{session.activeCount} 人{session.scoped ? '（本部门）' : '参加'}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words border-t border-border/60 pt-3 text-sm leading-6 text-muted-foreground">{session.description}</p>
            {!session.canEdit && <p className="mt-2 text-xs leading-5 text-muted-foreground">整场信息由可管理全部参加人员的录入员或系统管理员维护。</p>}
          </div>
        </section>
        <div className="grid gap-4 md:grid-cols-2">
          <TrainingEntry key={session.id} session={session} changed={refresh} restore={(p) => ask(p, true)} />
          <aside className="flex min-w-0 flex-col rounded-3xl border border-border bg-card shadow-sm"><div className="border-b border-border/70 p-5"><div className="flex items-center justify-between"><h2 className="font-serif text-xl font-semibold">参加名单</h2><span className="grid h-8 min-w-8 place-items-center rounded-full bg-accent/10 px-2 text-sm font-semibold text-accent">{session.activeCount}</span></div><p className="mt-2 text-xs text-muted-foreground">{session.scoped ? '仅展示本部门人员及人数' : '每位伙伴，一份有效考勤'}</p><div className="mt-4 flex rounded-xl bg-muted/60 p-1"><button className={`flex-1 rounded-lg py-2 text-xs transition ${!removed ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground'}`} onClick={() => { setLoading(true); setRemoved(false); setRosterPage(1); }}>当前名单</button><button className={`flex-1 rounded-lg py-2 text-xs transition ${removed ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground'}`} onClick={() => { setLoading(true); setRemoved(true); setRosterPage(1); }}>已移除 {session.removedCount || 0}</button></div><FormInput aria-label="查找当前名单" value={rosterSearch} onChange={(e) => { setLoading(true); setRosterSearch(e.target.value); setRosterPage(1); }} placeholder="查找名单中的人员" className="mt-3 h-9 text-xs" /></div><div className="max-h-[480px] flex-1 overflow-y-auto px-4 py-2">{loading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">正在更新名单…</p> : !session.members.length ? <div className="py-12 text-center"><Users size={28} strokeWidth={1.3} className="mx-auto mb-3 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">{rosterSearch ? '没有匹配的人员' : removed ? '暂无移除记录' : '名单等待第一位伙伴'}</p>{!removed && !rosterSearch && <p className="mt-2 text-xs text-muted-foreground">从录入区添加参加人员</p>}</div> : session.members.map((m) => <div key={m.id} className="flex items-center gap-3 border-b border-border/60 py-3.5 last:border-0"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-medium text-primary">{m.volunteer.chineseName.slice(-2)}</div><div className="min-w-0 flex-1"><Link className="text-sm font-medium hover:text-primary hover:underline" to={`/volunteers/${m.volunteer.id}`}>{m.volunteer.chineseName}</Link><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{m.volunteer.volunteerCode} · {m.volunteer.departmentName}</p></div><button className={`shrink-0 text-xs ${removed ? 'text-primary' : 'text-muted-foreground hover:text-destructive'}`} disabled={loading} onClick={() => ask(m.volunteer, removed)}>{removed ? '恢复' : '移除'}</button></div>)}</div><div className="px-4 pb-3"><Pager page={rosterPage} total={session.total} size={30} change={(next) => { setLoading(true); setRosterPage(next); }} /></div><div className="mt-auto flex items-center gap-2 rounded-b-3xl border-t border-border bg-muted/20 px-5 py-3 text-[11px] text-muted-foreground"><Check size={13} className="text-accent" />考勤自动同步至个人记录</div></aside>
        </div>
      </div>}
    </div>
    {form && <TrainingForm session={form === 'edit' ? session || undefined : undefined} close={() => setForm(null)} saved={(s) => { setForm(null); navigate(`/training/${s.id}`); refresh(); }} />}
    <Dialog open={!!action} onOpenChange={(open) => { if (!open && !busy) setAction(null); }} title={action?.restore ? '恢复参加记录' : '移除参加人员'} closeOnOutsideClick={false} footer={<><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>取消</Button><Button disabled={busy} onClick={() => { if (!action || !session) return; setBusy(true); void trainingService.remove(session.id, action.person.id, session.version, action.restore).then(() => { setAction(null); refresh(); }).catch((e) => { setActionError(trainingError(e)); refresh(); }).finally(() => setBusy(false)); }}>{busy ? '处理中…' : action?.restore ? '确认恢复' : '确认移除'}</Button></>}><p className="text-sm leading-7">{action?.restore ? `恢复 ${action.person.chineseName} 的原考勤，使用当前场次日期、类型和 ${session?.duration} 小时时长。` : `移除 ${action?.person.chineseName} 后，本场考勤将不再计入有效统计，历史记录会保留。`}</p>{actionError && <p role="alert" className="mt-3 text-sm text-destructive">{actionError}</p>}</Dialog>
  </div>;
}
