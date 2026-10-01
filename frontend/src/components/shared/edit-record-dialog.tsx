import { useEffect, useState } from 'react';
import projectSupportService from '@services/projectSupportService';
import serviceItemService from '@services/serviceItemService';
import tagService from '@services/tagService';
import type { ProjectSupport, ServiceItemsByDepartment, TagGroup } from '@services/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormInput, FormSelect, FormTextarea } from '@/components/shared/form-fields';
import { toast } from '@/hooks/use-toast';
import { trainingError } from '@/services/trainingService';
import { CATEGORY_LABEL } from '@/lib/ledger-colors';

export interface EditRecordDialogProps { record: ProjectSupport | null; onOpenChange: (open: boolean) => void; onSaved: () => void }
export const EditRecordDialog: React.FC<EditRecordDialogProps> = ({ record, onOpenChange, onSaved }) => {
  const [serviceDate, setServiceDate] = useState(''), [serviceItemId, setServiceItemId] = useState(''), [duration, setDuration] = useState(''), [description, setDescription] = useState('');
  const [items, setItems] = useState<ServiceItemsByDepartment[]>([]), [groups, setGroups] = useState<TagGroup[]>([]), [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [loadingTags, setLoadingTags] = useState(false);
  useEffect(() => { if (!record) return; setServiceDate(record.serviceDate.slice(0, 10)); setServiceItemId(record.serviceItemId); setDuration(String(record.duration)); setDescription(record.description); setTags(record.tags.map((t) => t.tagId)); setError(''); let live = true; serviceItemService.listGrouped().then((r) => live && setItems(r.data || [])).catch((e) => live && setError(trainingError(e))); return () => { live = false; }; }, [record]);
  useEffect(() => { if (!serviceItemId || !record) return; let live = true; setLoadingTags(true); tagService.getGroupsBoundTo(serviceItemId).then((r) => { if (live) setGroups(r.data || []); }).catch((e) => live && setError(trainingError(e))).finally(() => live && setLoadingTags(false)); return () => { live = false; }; }, [serviceItemId, record]);
  const changedItem = !!record && serviceItemId !== record.serviceItemId;
  const changedTags = !!record && JSON.stringify([...tags].sort()) !== JSON.stringify(record.tags.map((t) => t.tagId).sort());
  const available = new Set(groups.flatMap((g) => g.tags.map((t) => t.id)));
  const conflicts = changedItem ? tags.filter((id) => !available.has(id)) : [];
  const missing = (changedItem || changedTags) ? groups.filter((g) => g.required && !g.tags.some((t) => tags.includes(t.id))) : [];
  const save = async () => {
    if (!record || conflicts.length || missing.length) return;
    const dur = Number(duration);
    if (!Number.isFinite(dur) || dur <= 0 || dur % 0.5) { setError('时长须为大于 0 的 0.5 小时倍数'); return; }
    if (description.trim().length < 5 || description.trim().length > 1000) { setError('描述须为 5–1000 字'); return; }
    setSaving(true); setError('');
    try {
      const result = await projectSupportService.update(record.supportId, { serviceDate, duration: dur, description: description.trim(), ...(changedItem ? { serviceItemId } : {}), ...(changedItem || changedTags ? { tagIds: tags } : {}) });
      if (!result.success) throw new Error(result.error || result.message || '保存失败');
      toast({ title: '服务记录已更新' }); onOpenChange(false); onSaved();
    } catch (e) { setError(trainingError(e)); } finally { setSaving(false); }
  };
  return <Dialog open={!!record} onOpenChange={onOpenChange} title="编辑服务记录" description="更新服务信息，标签与记录一起保存。" closeOnOutsideClick={false} footer={<><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button><Button onClick={() => void save()} disabled={saving || loadingTags || !!conflicts.length || !!missing.length}>{saving ? '保存中…' : '保存'}</Button></>}>
    <div className="space-y-4"><label className="block space-y-2 text-sm font-medium">服务项<FormSelect value={serviceItemId} onChange={(e) => setServiceItemId(e.target.value)}>{!items.some((g) => g.items.some((i) => i.id === serviceItemId)) && <option value={serviceItemId}>{record?.serviceItem?.name}（历史服务项）</option>}{items.map((g) => <optgroup key={g.department.id} label={g.department.name}>{g.items.filter((i) => i.category !== 'TRAINING_ATTENDANCE').map((i) => <option key={i.id} value={i.id}>{CATEGORY_LABEL[i.category]} · {i.name}</option>)}</optgroup>)}</FormSelect></label>
      <div className="grid grid-cols-2 gap-4"><label className="block space-y-2 text-sm font-medium">服务日期<FormInput type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} /></label><label className="block space-y-2 text-sm font-medium">时长（小时）<FormInput type="number" min="0.5" step="0.5" value={duration} onChange={(e) => setDuration(e.target.value)} /></label></div>
      <label className="block space-y-2 text-sm font-medium">描述<FormTextarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {groups.map((g) => <fieldset key={g.id} className="space-y-2"><legend className="text-sm font-medium">{g.name}<span className="ml-2 text-xs font-normal text-muted-foreground">{g.selectionMode === 'single' ? '单选' : '多选'} · {g.required ? '必填' : '选填'}</span></legend><div className="flex flex-wrap gap-2">{g.tags.map((t) => <button type="button" key={t.id} className={`rounded-lg border px-3 py-1.5 text-xs ${tags.includes(t.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`} onClick={() => setTags((ids) => ids.includes(t.id) ? ids.filter((id) => id !== t.id) : [...(g.selectionMode === 'single' ? ids.filter((id) => !g.tags.some((tag) => tag.id === id)) : ids), t.id])}>{t.name}</button>)}</div></fieldset>)}
      {!!conflicts.length && <div className="rounded-xl bg-primary/8 p-3 text-sm"><p>以下原有标签不适用于新服务项，请明确解除后再保存：</p><p className="mt-2 text-xs">{conflicts.map((id) => record?.tags.find((t) => t.tagId === id)?.name || id).join('、')}</p><button className="mt-3 text-xs text-primary underline" onClick={() => setTags((ids) => ids.filter((id) => !conflicts.includes(id)))}>解除上述关联并保留其他标签</button></div>}
      {!!missing.length && <p className="text-xs text-primary">请选择必填标签：{missing.map((g) => g.name).join('、')}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  </Dialog>;
};
export default EditRecordDialog;
