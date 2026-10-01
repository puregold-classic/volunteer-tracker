import { useEffect, useState } from 'react';
import { CalendarDays, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormInput, FormSelect, FormTextarea } from '@/components/shared/form-fields';
import { Dialog } from '@/components/ui/dialog';
import serviceItemService from '@/services/serviceItemService';
import { trainingService, trainingError, type TrainingSession, type TrainingInput } from '@/services/trainingService';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function TrainingForm({ session, close, saved }: { session?: TrainingSession; close: () => void; saved: (s: TrainingSession) => void }) {
  const [form, setForm] = useState<TrainingInput>(session ? { name: session.name, serviceItemId: session.serviceItemId, serviceDate: session.serviceDate, duration: session.duration, description: session.description, version: session.version } : { name: '', serviceItemId: '', serviceDate: today(), duration: 2, description: '' });
  const [baseline, setBaseline] = useState(session);
  const [items, setItems] = useState<Array<{ id: string; label: string }>>([]);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [confirming, setConfirming] = useState(false);
  useEffect(() => { let live = true; serviceItemService.listGrouped().then((r) => { if (live) setItems((r.data || []).flatMap((g) => g.items.filter((i) => i.category === 'TRAINING_ATTENDANCE').map((i) => ({ id: i.id, label: `${g.department.name} · ${i.name}` })))); }).catch((e) => live && setError(trainingError(e))); return () => { live = false; }; }, []);
  const field = (key: keyof TrainingInput, value: string | number) => setForm((v) => ({ ...v, [key]: value }));
  const save = async () => { setBusy(true); setError(''); try { saved(session ? await trainingService.update(session.id, form) : await trainingService.create(form)); } catch (e) { setError(trainingError(e)); } finally { setBusy(false); } };
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) close(); }} title={session ? '编辑培训信息' : '建立一场培训'} description={session ? '整场信息统一维护，参加记录同步更新。' : '先记录培训信息，参加名单可以稍后补充。'} closeOnOutsideClick={false}>
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (session && !confirming) setConfirming(true); else void save(); }}>
      {!confirming ? <>
        <label className="block space-y-2 text-sm font-medium">培训名称<FormInput required maxLength={120} value={form.name} onChange={(e) => field('name', e.target.value)} placeholder="例如：九月笔译基础培训" autoFocus /></label>
        <label className="block space-y-2 text-sm font-medium">受训类型<FormSelect required value={form.serviceItemId} onChange={(e) => field('serviceItemId', e.target.value)}><option value="">选择受训服务项</option>{!items.some((i) => i.id === form.serviceItemId) && session && <option value={session.serviceItemId} disabled>{session.serviceItem.name}（已停用）</option>}{items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</FormSelect></label>
        <div className="grid grid-cols-2 gap-4"><label className="block space-y-2 text-sm font-medium"><span className="flex items-center gap-2"><CalendarDays size={15} />培训日期</span><FormInput type="date" required value={form.serviceDate} onChange={(e) => field('serviceDate', e.target.value)} /></label><label className="block space-y-2 text-sm font-medium"><span className="flex items-center gap-2"><Clock3 size={15} />时长 / 小时</span><FormInput type="number" required min="0.5" step="0.5" value={form.duration} onChange={(e) => field('duration', Number(e.target.value))} /></label></div>
        <label className="block space-y-2 text-sm font-medium">培训内容<FormTextarea required minLength={5} maxLength={1000} rows={4} value={form.description} onChange={(e) => field('description', e.target.value)} placeholder="简要记录这次培训的主题与内容…" /></label>
      </> : <div className="space-y-4 rounded-2xl bg-muted/50 p-5"><p className="font-medium">将同步更新 {baseline?.activeCount || 0} 人的有效考勤</p><dl className="grid grid-cols-[5rem_1fr] gap-3 text-sm"><dt className="text-muted-foreground">名称</dt><dd>{form.name}</dd><dt className="text-muted-foreground">日期</dt><dd>{baseline?.serviceDate} → {form.serviceDate}</dd><dt className="text-muted-foreground">时长</dt><dd>{baseline?.duration} → {form.duration} 小时</dd><dt className="text-muted-foreground">类型</dt><dd>{items.find((i) => i.id === form.serviceItemId)?.label}</dd><dt className="text-muted-foreground">内容</dt><dd className="whitespace-pre-wrap break-words">{form.description}</dd></dl><p className="text-xs leading-5 text-muted-foreground">已移除人员保留历史；恢复时将使用最新培训信息。</p></div>}
      {error && <div role="alert" className="space-y-2 rounded-xl bg-destructive/5 p-3 text-sm text-destructive"><p>{error}</p>{session && <button type="button" className="underline" onClick={() => { void trainingService.detail(session.id).then((latest) => { setBaseline(latest); setForm((v) => ({ ...v, version: latest.version })); setConfirming(false); setError('已读取最新版本，你的填写已保留。请核对后重新保存。'); }).catch((e) => setError(trainingError(e))); }}>刷新版本并保留填写</button>}</div>}
      <div className="flex justify-end gap-3 border-t border-border pt-5"><Button type="button" variant="outline" disabled={busy} onClick={() => confirming ? setConfirming(false) : close()}>{confirming ? '返回修改' : '取消'}</Button><Button type="submit" disabled={busy}>{busy ? '正在保存…' : session ? confirming ? '确认同步保存' : '预览修改' : '创建培训'}</Button></div>
    </form>
  </Dialog>;
}
