import { useEffect, useId, useMemo, useState } from 'react';
import { Check, ClipboardList, Loader2, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormInput, FormSelect, FormTextarea } from '@/components/shared/form-fields';
import { trainingService, trainingError, type TrainingPerson, type TrainingPreview, type TrainingSession } from '@/services/trainingService';

const stateLabels: Record<string, string> = { new: '可新增', existing: '已在名单', duplicate: '本次重复', unmatched: '未匹配', ambiguous: '重名待选择', removed: '曾移除' };
export function TrainingEntry({ session, changed, restore }: { session: TrainingSession; changed: () => void; restore: (p: TrainingPerson) => void }) {
  const tabId = useId();
  const [mode, setMode] = useState<'paste' | 'search'>('paste');
  const [text, setText] = useState(''), [choices, setChoices] = useState<Record<number, string>>({});
  const [preview, setPreview] = useState<TrainingPreview | null>(null), [validating, setValidating] = useState(false);
  const [query, setQuery] = useState(''), [search, setSearch] = useState<TrainingPerson[]>([]), [searching, setSearching] = useState(false);
  const [manual, setManual] = useState<TrainingPerson[]>([]), [excluded, setExcluded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [recheck, setRecheck] = useState(0);
  useEffect(() => {
    let live = true; setPreview(null); setValidating(!!text.trim());
    if (!text.trim()) { setValidating(false); return; }
    const timer = setTimeout(() => { trainingService.validate(session.id, text, choices).then((r) => { if (live) { setPreview(r); setError(''); } }).catch((e) => live && setError(trainingError(e))).finally(() => live && setValidating(false)); }, 350);
    return () => { live = false; clearTimeout(timer); };
  }, [text, choices, session.id, session.version, recheck]);
  useEffect(() => {
    let live = true; setSearch([]); setSearching(!!query.trim());
    if (!query.trim()) return;
    const timer = setTimeout(() => { trainingService.search(session.id, query).then((r) => live && setSearch(r)).catch((e) => live && setError(trainingError(e))).finally(() => live && setSearching(false)); }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [query, session.id, session.version]);
  const pending = useMemo(() => {
    const map = new Map(manual.map((p) => [p.id, p]));
    for (const row of preview?.rows || []) if (row.state === 'new' && row.volunteer) map.set(row.volunteer.id, row.volunteer);
    return [...map.values()].filter((p) => !excluded.includes(p.id));
  }, [manual, preview, excluded]);
  const submit = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await trainingService.add(session.id, preview?.version ?? session.version, pending.map((p) => p.id));
      const done = new Set([...result.created, ...result.skipped]);
      setManual((v) => v.filter((p) => !done.has(p.id)));
      setText((preview?.rows || []).filter((r) => !r.volunteer || !done.has(r.volunteer.id)).map((r) => r.input).join('\n'));
      setChoices({}); setExcluded([]); setPreview(null);
      setNotice(`已新增 ${result.created.length} 人，已有 ${result.skipped.length} 人跳过${result.removed.length ? `，${result.removed.length} 人曾移除，请明确恢复` : ''}。`);
      changed();
    } catch (e) { setError(trainingError(e)); changed(); } finally { setBusy(false); }
  };
  return <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
    <div className="border-b border-border/70 px-5 py-4"><div className="flex items-center gap-2"><ClipboardList size={18} className="text-primary" /><h2 className="font-serif text-xl font-semibold">添加参加人员</h2></div><p className="mt-2 text-xs leading-5 text-muted-foreground">选择一种录入方式，核对后加入当前名单。</p></div>
    <div className="flex-1 space-y-4 p-5">
      <div role="tablist" aria-label="人员录入方式" className="flex rounded-xl bg-muted/60 p-1">
        {(['paste', 'search'] as const).map((key) => <button key={key} type="button" role="tab" id={`${tabId}-${key}-tab`} aria-selected={mode === key} aria-controls={`${tabId}-${key}-panel`} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs transition ${mode === key ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setMode(key)}>{key === 'paste' ? <ClipboardList size={14} /> : <Search size={14} />}{key === 'paste' ? '粘贴名单' : '搜索添加'}</button>)}
      </div>
      <div role="tabpanel" id={`${tabId}-paste-panel`} aria-labelledby={`${tabId}-paste-tab`} hidden={mode !== 'paste'} className="space-y-3">
      <label className="block space-y-2"><span className="text-sm font-medium">粘贴姓名名单</span><FormTextarea aria-label="粘贴姓名名单" rows={5} value={text} disabled={busy} onChange={(e) => { setText(e.target.value); setChoices({}); setExcluded([]); setPreview(null); setNotice(''); }} placeholder={'一行一个姓名，例如：\n张三\n李四'} className="resize-y bg-background/50 leading-7" /><span className="block text-xs leading-5 text-muted-foreground">Excel 单列姓名可直接粘贴 · 每次最多 500 条 · 原名单始终保留</span></label>
      {validating && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={15} className="animate-spin" />正在校验名单…</p>}
      {preview && <div className="max-h-44 overflow-y-auto rounded-xl border border-border"><div className="sticky top-0 flex items-center justify-between bg-muted px-3 py-2 text-xs font-medium"><span>校验结果</span><span>{preview.rows.length} 条输入</span></div>{preview.rows.map((r) => <div key={r.index} className="border-t border-border/60 px-3 py-2.5 text-sm"><div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate">{r.input}</span><span className={`shrink-0 text-xs ${r.state === 'new' ? 'text-accent' : ['unmatched', 'ambiguous'].includes(r.state) ? 'text-primary' : 'text-muted-foreground'}`}>{stateLabels[r.state]}</span></div>{r.volunteer && <p className="mt-1 text-xs text-muted-foreground">{r.volunteer.chineseName} · {r.volunteer.volunteerCode} · {r.volunteer.departmentName}</p>}{r.reason && <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>}{r.candidates && <FormSelect aria-label={`选择 ${r.input}`} className="mt-2" value={choices[r.index] || ''} onChange={(e) => setChoices((v) => ({ ...v, [r.index]: e.target.value }))}><option value="">请选择具体人员</option>{r.candidates.map((p) => <option key={p.id} value={p.id}>{p.chineseName} · {p.volunteerCode} · {p.departmentName}</option>)}</FormSelect>}{r.state === 'removed' && r.volunteer && <button className="mt-2 text-xs font-medium text-primary hover:underline" onClick={() => restore(r.volunteer!)}>恢复原考勤</button>}</div>)}</div>}
      </div>
      <div role="tabpanel" id={`${tabId}-search-panel`} aria-labelledby={`${tabId}-search-tab`} hidden={mode !== 'search'} className="min-h-[210px] space-y-3">
      <div className="space-y-2"><label className="block text-sm font-medium" htmlFor={`${tabId}-search-input`}>查找参加人员</label><div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-muted-foreground" /><FormInput id={`${tabId}-search-input`} aria-label="搜索参加人员" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索姓名或志愿者编号" className="pl-9" /></div>{searching ? <p className="text-xs text-muted-foreground">正在查找…</p> : query && !search.length ? <p className="text-xs text-muted-foreground">未找到可录入人员</p> : null}{search.length > 0 && <div className="max-h-64 overflow-y-auto rounded-xl border border-border">{search.map((p) => { const selected = pending.some((x) => x.id === p.id); return <div key={p.id} className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{p.chineseName}</p><p className="truncate text-xs text-muted-foreground">{p.volunteerCode} · {p.departmentName}</p></div><Button size="sm" variant="ghost" disabled={selected || p.state === 'existing' || busy} onClick={() => { if (p.state === 'removed') restore(p); else { setManual((v) => [...v.filter((x) => x.id !== p.id), p]); setExcluded((v) => v.filter((id) => id !== p.id)); } }}>{selected ? '待加入' : p.state === 'existing' ? '已添加' : p.state === 'removed' ? '恢复' : <><Plus size={14} />添加</>}</Button></div>; })}</div>}</div>
        {!query && <div className="py-8 text-center"><Search size={25} strokeWidth={1.3} className="mx-auto mb-3 text-muted-foreground/40" /><p className="text-xs leading-6 text-muted-foreground">输入姓名或编号查找伙伴，<br />选中后会加入下方待确认名单。</p></div>}
      </div>
    </div>
    <div className="space-y-3 border-t border-border/70 bg-accent/[0.025] p-5">
      <div className="space-y-2"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">待加入名单 <span className="ml-1 text-accent">{pending.length}</span></h3>{pending.length > 0 && <button onClick={() => { setExcluded(pending.map((p) => p.id)); setManual([]); }} className="text-xs text-muted-foreground hover:text-foreground">清空选择</button>}</div>{pending.length ? <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto">{pending.map((p) => <span key={p.id} className="inline-flex items-center gap-1.5 rounded-lg border border-accent/15 bg-card px-2 py-1 text-xs" title={`${p.volunteerCode} · ${p.departmentName}`}>{p.chineseName}<button aria-label={`移除待加入 ${p.chineseName}`} disabled={busy} onClick={() => setExcluded((v) => [...v, p.id])}><X size={13} /></button></span>)}</div> : <p className="text-xs leading-5 text-muted-foreground">粘贴与搜索选中的人员会合并到这里。</p>}</div>
      {notice && <p role="status" className="flex items-start gap-2 text-sm text-accent"><Check size={17} className="mt-0.5 shrink-0" />{notice}</p>}
      {error && <div role="alert" className="text-sm text-destructive"><p>{error}</p><button onClick={() => { setRecheck((n) => n + 1); changed(); }} className="mt-2 text-xs underline">保留输入并重新校验</button></div>}
      <Button className="w-full" disabled={busy || validating || !pending.length || pending.length > 500} onClick={() => void submit()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}加入已匹配的 {pending.length} 人</Button>
    </div>
  </section>;
}
