import { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormInput, FormSelect, FormTextarea } from '@/components/shared/form-fields';
import serviceItemService from '@/services/serviceItemService';
import tagService from '@/services/tagService';
import type { ServiceCategory, ServiceItemsByDepartment, TagGroup } from '@/services/types';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '@/lib/ledger-colors';
import { trainingError } from '@/services/trainingService';

export function TagGroupForm({ group, close, saved }: { group?: TagGroup; close: () => void; saved: () => void }) {
  const [name, setName] = useState(group?.name || ''), [description, setDescription] = useState(group?.description || '');
  const [selection, setSelection] = useState<'single' | 'multi'>(group?.selectionMode || 'single'), [required, setRequired] = useState(group?.required || false), [open, setOpen] = useState(group?.openness === 'open');
  const [mode, setMode] = useState(group?.applicability || 'specified'), [selected, setSelected] = useState<string[]>(group?.boundServiceItemIds || []);
  const [items, setItems] = useState<ServiceItemsByDepartment[]>([]), [category, setCategory] = useState<ServiceCategory>('PROJECT_MGMT'), [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { let live = true; serviceItemService.listGrouped().then((r) => live && setItems(r.data || [])).catch((e) => live && setError(trainingError(e))); return () => { live = false; }; }, []);
  const labels = useMemo(() => new Map(items.flatMap((g) => g.items.filter((i) => i.category !== 'TRAINING_ATTENDANCE').map((i) => [i.id, `${g.department.name} · ${i.name}`]))), [items]);
  const toggle = (id: string) => setSelected((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  return <Dialog open onOpenChange={(v) => { if (!v && !busy) close(); }} title={group ? '编辑标签组' : '新建标签组'} description="设置分类规则，以及在哪些服务记录中使用。" closeOnOutsideClick={false} className="sm:max-w-2xl">
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setBusy(true); setError(''); const payload = { name, description, selectionMode: selection, required, openness: open ? 'open' as const : 'closed' as const, applicability: mode, boundServiceItemIds: selected }; void (group ? tagService.updateGroup(group.id, payload) : tagService.createGroup(payload)).then((r) => { if (!r.success) throw new Error(r.error || '保存失败'); saved(); }).catch((e) => setError(trainingError(e))).finally(() => setBusy(false)); }}>
      <label className="block space-y-2 text-sm font-medium">标签组名称<FormInput required maxLength={80} placeholder="例如：笔译岗位" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="block space-y-2 text-sm font-medium">说明<FormTextarea rows={2} maxLength={500} placeholder="帮助伙伴理解这组标签的用途" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-4"><label className="space-y-2 text-sm font-medium">选择方式<FormSelect value={selection} onChange={(e) => setSelection(e.target.value as 'single' | 'multi')}><option value="single">单选</option><option value="multi">多选</option></FormSelect></label><label className="space-y-2 text-sm font-medium">填写要求<FormSelect value={required ? 'required' : 'optional'} onChange={(e) => setRequired(e.target.value === 'required')}><option value="optional">选填</option><option value="required">必填</option></FormSelect></label></div>
      <label className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={open} onChange={(e) => setOpen(e.target.checked)} />允许志愿者新增标签</label>
      <section className="space-y-3 border-t border-border pt-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">适用服务项</h3><span className="text-xs text-muted-foreground">已选 {selected.length} 项</span></div><FormSelect aria-label="适用范围" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="specified">指定服务项</option><option value="all">所有志愿服务项</option>{group?.applicability === 'legacy' && <option value="legacy">保留历史配置（提交表单不显示）</option>}</FormSelect>
        {mode === 'all' ? <p className="rounded-xl bg-accent/5 p-3 text-xs leading-6 text-muted-foreground">适用于项目管理、组织培训和项目支援的全部志愿服务项。受训考勤由培训场次管理。</p> : mode === 'legacy' ? <p className="text-xs leading-6 text-primary">旧配置保持原有手工关联方式，不会突然出现在所有提交表单。选择明确范围后可启用表单选择。</p> : <>
          <div className="flex flex-wrap gap-2">{CATEGORY_ORDER.filter((c) => c !== 'TRAINING_ATTENDANCE').map((c) => <button type="button" key={c} onClick={() => setCategory(c)} className={`rounded-full border px-3 py-1.5 text-xs ${category === c ? 'border-primary bg-primary/8 text-primary' : 'border-border text-muted-foreground'}`}>{CATEGORY_LABEL[c]}</button>)}</div>
          <div className="relative"><Search size={15} className="absolute left-3 top-3.5 text-muted-foreground" /><FormInput aria-label="查找适用服务项" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索服务项或部门（跨类别）" className="pl-9" /></div>
          <div className="max-h-56 space-y-4 overflow-y-auto rounded-xl border border-border p-3">{items.map((g) => { const visible = g.items.filter((i) => i.category !== 'TRAINING_ATTENDANCE' && (search ? `${g.department.name}${i.name}`.includes(search) : i.category === category)); return visible.length > 0 && <div key={g.department.id}><p className="mb-2 text-xs font-semibold text-muted-foreground">{g.department.name}</p><div className="grid gap-1 sm:grid-cols-2">{visible.map((i) => <label key={i.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm ${selected.includes(i.id) ? 'bg-primary/7 text-primary' : 'hover:bg-muted'}`}><input type="checkbox" className="h-4 w-4 accent-primary" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} />{i.name}</label>)}</div></div>; })}</div>
          {selected.length > 0 && <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">{selected.map((id) => <span key={id} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${labels.has(id) ? 'border-border' : 'border-destructive/30 text-destructive'}`}>{labels.get(id) || `已失效：${id}`}<button type="button" aria-label={`取消 ${labels.get(id) || id}`} onClick={() => toggle(id)}><X size={12} /></button></span>)}</div>}
        </>}
      </section>
      {group && <p className="text-xs leading-6 text-muted-foreground">配置变更保留历史关联；不再符合规则的记录会标记“需检查”。</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-border pt-4"><Button type="button" variant="outline" disabled={busy} onClick={close}>取消</Button><Button type="submit" disabled={busy || (mode === 'specified' && !selected.length)}><Check size={16} className="mr-2" />{busy ? '保存中…' : '保存标签组'}</Button></div>
    </form>
  </Dialog>;
}
