// frontend/src/pages/TagsPage.tsx — v3.2
//
// Tag admin page. Three sections:
//   - Groups list (admin can create / edit / delete)
//   - Within a selected group: tags list (a_admin+ CRUD)
//   - Within a selected tag: member list + batch action buttons (gated by
//     group.opMode)
//
// Replaces /projects for session / tag management. /projects stays operational
// for backward compatibility until phase 7 cleanup.

import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Tag as TagIcon, Layers, ListPlus, Trash2, Pencil, Check, X as XIcon,
  ChevronRight, Users, Edit3, Link as LinkIcon, MinusCircle,
} from 'lucide-react';
import tagService, { type BatchPreview } from '@services/tagService';
import serviceItemService from '@services/serviceItemService';
import volunteerService from '@services/volunteerService';
import projectSupportService from '@services/projectSupportService';
import type {
  TagGroup, Tag, ServiceItemsByDepartment, Volunteer, TagSelectionMode,
  TagOpMode, TagOpenness, ProjectSupport,
} from '@services/types';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { FormField, FormInput, FormSelect, FormTextarea } from '@/components/shared/form-fields';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Preset options ──────────────────────────────────────────────────────────

const PRESETS: Array<{
  key: string;
  label: string;
  description: string;
  selectionMode: TagSelectionMode;
  opMode: TagOpMode;
  openness: TagOpenness;
  required: boolean;
}> = [
  {
    key: 'dimension-closed',
    label: '分类维度（固定）',
    description: '岗位 / 项目方 类。值由 admin 预设，值固定。single + tag_only + closed + required',
    selectionMode: 'single',
    opMode: 'tag_only',
    openness: 'closed',
    required: true,
  },
  {
    key: 'session',
    label: 'Session 容器',
    description: '培训批次等。多选 + 可批量录入/改删 + 随时加新 tag。multi + managed + open',
    selectionMode: 'multi',
    opMode: 'managed',
    openness: 'open',
    required: false,
  },
  {
    key: 'free',
    label: '自由标签',
    description: '临时贴一贴。多选 + 只 attach/detach + 随时加新 tag。multi + tag_only + open',
    selectionMode: 'multi',
    opMode: 'tag_only',
    openness: 'open',
    required: false,
  },
];

// ─── Create / Edit group dialog ─────────────────────────────────────────────

function GroupFormDialog({
  open, onOpenChange, serviceItemsFlat, existingGroup, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  serviceItemsFlat: Array<{ id: string; label: string }>;
  existingGroup: TagGroup | null;
  onSaved: () => void;
}) {
  const isEdit = !!existingGroup;
  const [presetKey, setPresetKey] = useState<string>('dimension-closed');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [boundServiceItemIds, setBoundServiceItemIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<TagSelectionMode>('single');
  const [opMode, setOpMode] = useState<TagOpMode>('tag_only');
  const [openness, setOpenness] = useState<TagOpenness>('closed');
  const [required, setRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      if (existingGroup) {
        setName(existingGroup.name);
        setDescription(existingGroup.description ?? '');
        setBoundServiceItemIds(existingGroup.boundServiceItemIds);
        setSelectionMode(existingGroup.selectionMode);
        setOpMode(existingGroup.opMode);
        setOpenness(existingGroup.openness);
        setRequired(existingGroup.required);
        setPresetKey('custom');
      } else {
        setName('');
        setDescription('');
        setBoundServiceItemIds([]);
        setPresetKey('dimension-closed');
        applyPreset('dimension-closed');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingGroup]);

  const applyPreset = (key: string) => {
    setPresetKey(key);
    const p = PRESETS.find((pr) => pr.key === key);
    if (!p) return;
    setSelectionMode(p.selectionMode);
    setOpMode(p.opMode);
    setOpenness(p.openness);
    setRequired(p.required);
  };

  const toggleBound = (id: string) => {
    setBoundServiceItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    setError('');
    if (name.trim().length < 1) { setError('name 必填'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        boundServiceItemIds,
        selectionMode,
        opMode,
        openness,
        required,
      };
      const res = isEdit
        ? await tagService.updateGroup(existingGroup!.id, payload)
        : await tagService.createGroup(payload);
      if (res?.success) {
        toast({ title: isEdit ? '已更新标签组' : '已创建标签组' });
        onSaved();
        onOpenChange(false);
      } else {
        setError((res as { error?: string })?.error || '失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? '编辑标签组' : '新建标签组'}
      description="3 轴配置：selectionMode / opMode / openness。用 preset 快速填入，再按需微调"
    >
      <div className="space-y-4">
        {!isEdit && (
          <FormField label="预设">
            <div className="space-y-2">
              {PRESETS.map((p) => (
                <label
                  key={p.key}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-lg border p-2.5',
                    presetKey === p.key ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <input
                    type="radio"
                    checked={presetKey === p.key}
                    onChange={() => applyPreset(p.key)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="text-[11px] text-muted-foreground">{p.description}</div>
                  </div>
                </label>
              ))}
              <label className={cn(
                'flex cursor-pointer items-start gap-2 rounded-lg border p-2.5',
                presetKey === 'custom' ? 'border-primary bg-primary/5' : 'border-border',
              )}>
                <input
                  type="radio"
                  checked={presetKey === 'custom'}
                  onChange={() => setPresetKey('custom')}
                  className="mt-0.5"
                />
                <span className="text-sm font-medium">自定义（手动选每个轴）</span>
              </label>
            </div>
          </FormField>
        )}

        <FormField label="标签组名" required>
          <FormInput value={name} onChange={(e) => setName(e.target.value)} placeholder="如：项目方 / 笔译岗位 / 会话" />
        </FormField>

        <FormField label="描述">
          <FormTextarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="selection">
            <FormSelect value={selectionMode} onChange={(e) => setSelectionMode(e.target.value as TagSelectionMode)}>
              <option value="single">single 单选</option>
              <option value="multi">multi 多选</option>
            </FormSelect>
          </FormField>
          <FormField label="opMode">
            <FormSelect value={opMode} onChange={(e) => setOpMode(e.target.value as TagOpMode)}>
              <option value="tag_only">tag_only 纯标签</option>
              <option value="managed">managed 可批量改删</option>
            </FormSelect>
          </FormField>
          <FormField label="openness">
            <FormSelect value={openness} onChange={(e) => setOpenness(e.target.value as TagOpenness)}>
              <option value="closed">closed 固定</option>
              <option value="open">open 可扩充</option>
            </FormSelect>
          </FormField>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          提交时必选（当 serviceItem 触发此组时）
        </label>

        <FormField
          label={`录入触发 service items (${boundServiceItemIds.length} 个)`}
          hint="选中时，用户提交这些 serviceItem 的 PS 会弹出本组 tag picker"
        >
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
            {serviceItemsFlat.map((si) => (
              <label key={si.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={boundServiceItemIds.includes(si.id)}
                  onChange={() => toggleBound(si.id)}
                />
                {si.label}
              </label>
            ))}
          </div>
        </FormField>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? '保存中…' : isEdit ? '保存' : '创建'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ─── Batch create dialog (managed groups only) ─────────────────────────────

function BatchCreateDialog({
  open, onOpenChange, tag, allVolunteers, attendanceServiceItems, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tag: Tag | null;
  allVolunteers: Volunteer[];
  attendanceServiceItems: Array<{ id: string; name: string; departmentId: string; departmentName: string }>;
  onDone: () => void;
}) {
  const [serviceItemId, setServiceItemId] = useState('');
  const [namesText, setNamesText] = useState('');
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState('2');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof tagService.batchCreate>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setNamesText('');
      setResult(null);
      setError('');
      setDescription('');
      if (!serviceItemId && attendanceServiceItems.length > 0) {
        setServiceItemId(attendanceServiceItems[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Build lookup for preview matching
  const volunteersIndex = useMemo(() => {
    const byCode = new Map<string, Volunteer>();
    const byCn = new Map<string, Volunteer[]>();
    for (const v of allVolunteers) {
      if (v.status !== '在职') continue;
      byCode.set(v.volunteerCode.toLowerCase(), v);
      const cn = v.chineseName?.toLowerCase();
      if (cn) {
        if (!byCn.has(cn)) byCn.set(cn, []);
        byCn.get(cn)!.push(v);
      }
    }
    return { byCode, byCn };
  }, [allVolunteers]);

  const splitNames = (text: string) =>
    text.split(/[\n,，、;；\t]/).map((s) => s.trim()).filter(Boolean);

  const preview = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ input: string; status: 'match' | 'dupe' | 'miss'; name?: string; code?: string }> = [];
    for (const name of splitNames(namesText)) {
      const key = name.toLowerCase();
      if (seen.has(key)) { items.push({ input: name, status: 'dupe' }); continue; }
      seen.add(key);
      const byCode = volunteersIndex.byCode.get(key);
      if (byCode) { items.push({ input: name, status: 'match', name: byCode.chineseName, code: byCode.volunteerCode }); continue; }
      const byCn = volunteersIndex.byCn.get(key);
      if (byCn?.length === 1) {
        items.push({ input: name, status: 'match', name: byCn[0].chineseName, code: byCn[0].volunteerCode });
        continue;
      }
      items.push({ input: name, status: 'miss' });
    }
    return items;
  }, [namesText, volunteersIndex]);

  const submit = async () => {
    if (!tag) return;
    setError('');
    const names = splitNames(namesText);
    if (names.length === 0) { setError('请粘贴至少 1 个姓名'); return; }
    if (!serviceItemId) { setError('请选择 serviceItem'); return; }
    const dur = parseFloat(duration);
    if (!dur || dur <= 0 || (dur * 2) % 1 !== 0) { setError('时长必须是大于 0 的 0.5 倍数'); return; }
    setSubmitting(true);
    try {
      const res = await tagService.batchCreate(tag.id, {
        names, serviceItemId, serviceDate, duration: dur,
        description: description.trim() || undefined,
      });
      if (res?.success && res.data) {
        setResult(res);
        toast({
          title: '批量录入完成',
          description: `创建 ${res.data.created.length} 条 / 已存在 ${res.data.alreadyRecorded.length} / 未匹配 ${res.data.unmatched.length}`,
        });
        onDone();
      } else {
        setError((res as { error?: string })?.error || '失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`批量录入 · ${tag?.name ?? ''}`}
      description="一次创建多条支援记录并自动挂本 tag"
    >
      <div className="space-y-3">
        <FormField label="受训服务项" required>
          <FormSelect value={serviceItemId} onChange={(e) => setServiceItemId(e.target.value)}>
            <option value="">— 选择 —</option>
            {attendanceServiceItems.map((it) => (
              <option key={it.id} value={it.id}>{it.departmentName} / {it.name}</option>
            ))}
          </FormSelect>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="日期" required>
            <FormInput type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
          </FormField>
          <FormField label="时长（小时）" required>
            <FormInput type="number" step="0.5" min="0.5" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </FormField>
        </div>
        <FormField
          label={`参训人姓名列表 (${preview.length} 人)`}
          required
          hint="一行一个。Excel 单列粘贴直接可用。"
        >
          <FormTextarea rows={5} value={namesText} onChange={(e) => setNamesText(e.target.value)} className="font-mono" />
        </FormField>
        {preview.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-md border border-border p-2 text-[11px] space-y-0.5">
            {preview.map((p, i) => (
              <div key={`${p.input}-${i}`} className={cn(
                'flex items-center gap-2',
                p.status === 'match' && 'text-emerald-700',
                p.status === 'miss' && 'text-rose-700',
                p.status === 'dupe' && 'text-muted-foreground line-through',
              )}>
                {p.status === 'match' && <Check className="h-3 w-3" />}
                {p.status === 'miss' && <XIcon className="h-3 w-3" />}
                {p.status === 'dupe' && <span className="w-3 text-center">◦</span>}
                <span className="truncate font-mono">{p.input}</span>
                {p.name && <span className="ml-auto text-muted-foreground">→ {p.name} ({p.code})</span>}
              </div>
            ))}
          </div>
        )}
        <FormField label="描述（留空用：参加 标签名）">
          <FormInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`参加 ${tag?.name ?? ''}`} />
        </FormField>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && result.data && (
          <div className="rounded-lg border border-border bg-muted/30 p-2 text-xs space-y-1">
            <div>✓ 创建 {result.data.created.length} · 已存在 {result.data.alreadyRecorded.length} · 未匹配 {result.data.unmatched.length} · 多重 {result.data.ambiguous.length}</div>
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>关闭</Button>
          <Button type="button" className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? '录入中…' : <><ListPlus className="mr-1.5 h-4 w-4" />录入</>}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ─── Batch update dialog (managed groups only) ────────────────────────────

function BatchUpdateDialog({
  open, onOpenChange, tag, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tag: Tag | null;
  onDone: () => void;
}) {
  const [duration, setDuration] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDuration('');
      setServiceDate('');
      setDescription('');
      setPreview(null);
    }
  }, [open]);

  const buildPatch = () => {
    const patch: { duration?: number; serviceDate?: string; description?: string } = {};
    if (duration) {
      const d = parseFloat(duration);
      if (d > 0 && (d * 2) % 1 === 0) patch.duration = d;
    }
    if (serviceDate) patch.serviceDate = serviceDate;
    if (description.trim()) patch.description = description.trim();
    return patch;
  };

  const doPreview = async () => {
    if (!tag) return;
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      toast({ title: '至少填一项要改的字段', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await tagService.batchUpdate(tag.id, { patch, scope: 'all', dryRun: true });
      if (res?.success && res.data?.preview) setPreview(res.data.preview);
      else toast({ title: '预览失败', description: (res as { error?: string })?.error, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const doApply = async () => {
    if (!tag || !preview) return;
    const patch = buildPatch();
    if (!window.confirm(`确认应用？将影响 ${preview.scopeCount} 条 PS，此操作写入审计日志。`)) return;
    setBusy(true);
    try {
      const res = await tagService.batchUpdate(tag.id, { patch, scope: 'all', dryRun: false });
      if (res?.success) {
        toast({ title: '批量修改完成', description: `更新 ${res.data?.updatedCount ?? 0} 条` });
        onDone();
        onOpenChange(false);
      } else {
        toast({ title: '应用失败', description: (res as { error?: string })?.error, variant: 'destructive' });
      }
    } finally { setBusy(false); }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`批量修改 · ${tag?.name ?? ''}`}
      description="对 tag 下所有 PS 应用同一 patch；必须先预览再应用"
    >
      <div className="space-y-3 px-6 py-4">
        <FormField label="新时长（小时，0.5 倍数）">
          <FormInput value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="留空则不改" />
        </FormField>
        <FormField label="新日期">
          <FormInput type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
        </FormField>
        <FormField label="新描述">
          <FormTextarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="留空则不改" />
        </FormField>
        {preview && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs space-y-1.5">
            <p className="font-medium text-foreground">预览</p>
            <p>影响条数：<span className="font-mono tabular-nums">{preview.scopeCount}</span></p>
            {preview.currentDurationRange && (
              <p>原时长范围：{preview.currentDurationRange.min}h – {preview.currentDurationRange.max}h（{preview.currentDurationRange.distinct} 种）</p>
            )}
            {preview.willUpdate && (
              <p>将更新为：
                {preview.willUpdate.duration !== undefined && <span className="ml-1">时长 <b>{preview.willUpdate.duration}h</b></span>}
                {preview.willUpdate.serviceDate !== undefined && <span className="ml-1">日期 <b>{new Date(preview.willUpdate.serviceDate).toISOString().slice(0, 10)}</b></span>}
                {preview.willUpdate.description !== undefined && <span className="ml-1">描述 <b>"{preview.willUpdate.description}"</b></span>}
              </p>
            )}
            {preview.sample && preview.sample.length > 0 && (
              <p className="text-muted-foreground">样本：{preview.sample.slice(0, 5).map((s) => s.volunteer).join('、')}{preview.sample.length > 5 ? '…' : ''}</p>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
        <Button type="button" variant="outline" onClick={doPreview} disabled={busy}>预览</Button>
        <Button type="button" onClick={doApply} disabled={busy || !preview}>应用</Button>
      </div>
    </Dialog>
  );
}

// ─── Manual attach dialog (attach one volunteer's PS to a tag) ────────────

function ManualAttachDialog({
  open, onOpenChange, tag, tagGroup, allVolunteers, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tag: Tag | null;
  tagGroup: TagGroup | null;
  allVolunteers: Volunteer[];
  onDone: () => void;
}) {
  const [volunteerQuery, setVolunteerQuery] = useState('');
  const [pickedVolunteer, setPickedVolunteer] = useState<Volunteer | null>(null);
  const [supports, setSupports] = useState<ProjectSupport[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setVolunteerQuery('');
      setPickedVolunteer(null);
      setSupports([]);
      setPicked(new Set());
    }
  }, [open]);

  // Once volunteer picked, fetch their ACTIVE PS records
  useEffect(() => {
    if (!pickedVolunteer) { setSupports([]); return; }
    setLoading(true);
    void projectSupportService
      .list({ volunteerId: pickedVolunteer.id, status: 'ACTIVE', limit: 100 })
      .then((r) => {
        if (r?.success && r.data?.records) {
          let rows = r.data.records;
          // Filter by bound service items if the group limits them
          if (tagGroup?.boundServiceItemIds && tagGroup.boundServiceItemIds.length > 0) {
            const boundSet = new Set(tagGroup.boundServiceItemIds);
            rows = rows.filter((s) => boundSet.has(s.serviceItemId));
          }
          setSupports(rows);
        }
      })
      .finally(() => setLoading(false));
  }, [pickedVolunteer, tagGroup]);

  const volunteerMatches = useMemo(() => {
    const q = volunteerQuery.trim().toLowerCase();
    if (q.length < 1) return [] as Volunteer[];
    return allVolunteers
      .filter((v) =>
        v.chineseName?.toLowerCase().includes(q) ||
        v.englishName?.toLowerCase().includes(q) ||
        v.volunteerCode?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [volunteerQuery, allVolunteers]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const doAttach = async () => {
    if (!tag || picked.size === 0) return;
    setBusy(true);
    try {
      const supportIds = Array.from(picked);
      // batchAttach takes support IDs (cuid not supportId). Our supports list
      // carries the full row; `id` is the cuid we want.
      const res = await tagService.batchAttach(tag.id, supportIds);
      if (res?.success && res.data) {
        const { attached, alreadyAttached, rejectedByBinding } = res.data;
        toast({
          title: '挂接完成',
          description: `新挂 ${attached.length} / 已在 ${alreadyAttached.length} / 被拒 ${rejectedByBinding.length}`,
        });
        onDone();
        onOpenChange(false);
      } else {
        toast({ title: '挂接失败', description: (res as { error?: string })?.error, variant: 'destructive' });
      }
    } finally { setBusy(false); }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`挂接 PS · ${tag?.name ?? ''}`}
      description="按志愿者查找已有 ACTIVE PS 并打上标签"
    >
      <div className="space-y-3 px-6 py-4">
        {!pickedVolunteer ? (
          <div className="space-y-2">
            <FormField label="志愿者（姓名 / code）">
              <FormInput
                autoFocus
                value={volunteerQuery}
                onChange={(e) => setVolunteerQuery(e.target.value)}
                placeholder="张三 / PG-0001"
              />
            </FormField>
            {volunteerMatches.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {volunteerMatches.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setPickedVolunteer(v)}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-muted/50"
                    >
                      <span className="font-medium">{v.chineseName}</span>
                      <span className="ml-2 font-mono text-muted-foreground">{v.volunteerCode}</span>
                      <span className="ml-2 text-muted-foreground">· {v.department?.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
              <div>
                <span className="font-medium">{pickedVolunteer.chineseName}</span>
                <span className="ml-2 font-mono text-muted-foreground">{pickedVolunteer.volunteerCode}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setPickedVolunteer(null)}>换人</Button>
            </div>
            {loading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">加载中…</p>
            ) : supports.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                该志愿者没有符合条件的 ACTIVE PS
                {tagGroup?.boundServiceItemIds && tagGroup.boundServiceItemIds.length > 0 && '（按组的 boundServiceItemIds 已过滤）'}
              </p>
            ) : (
              <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {supports.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <input
                      type="checkbox"
                      checked={picked.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {s.serviceItem?.departmentName} / {s.serviceItem?.name}
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(s.serviceDate).toISOString().slice(0, 10)} · {s.duration}h · {s.description.slice(0, 40)}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[9px]">{s.supportId}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
        <Button type="button" onClick={doAttach} disabled={busy || picked.size === 0}>
          挂接 {picked.size > 0 ? `(${picked.size})` : ''}
        </Button>
      </div>
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function TagsPage() {
  const { account } = useAuth();
  const canAdmin = account && account.role === 'admin';
  const canWriteTags = account && ['admin', 'a_admin'].includes(account.role);

  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [tagSupports, setTagSupports] = useState<Awaited<ReturnType<typeof tagService.listTagSupports>> | null>(null);

  // Dialogs
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TagGroup | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [addingTagInGroupId, setAddingTagInGroupId] = useState<string | null>(null);
  const [batchCreateOpen, setBatchCreateOpen] = useState(false);
  const [batchCreateTag, setBatchCreateTag] = useState<Tag | null>(null);
  const [batchUpdateOpen, setBatchUpdateOpen] = useState(false);
  const [manualAttachOpen, setManualAttachOpen] = useState(false);

  // Supporting data
  const [serviceItems, setServiceItems] = useState<ServiceItemsByDepartment[]>([]);
  const [allVolunteers, setAllVolunteers] = useState<Volunteer[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await tagService.listGroups();
      if (res?.success && res.data) setGroups(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void refresh();
    void serviceItemService.listGrouped().then((r) => {
      if (r?.success && r.data) setServiceItems(r.data);
    });
    void volunteerService.getAllVolunteers({ limit: 500, status: '在职' }).then((r) => {
      if (r?.success && r.data) setAllVolunteers(r.data);
    });
  }, []);

  useEffect(() => {
    if (!activeTagId) { setTagSupports(null); return; }
    void tagService.listTagSupports(activeTagId).then((r) => setTagSupports(r));
  }, [activeTagId]);

  const activeGroup = useMemo(() => groups.find((g) => g.id === activeGroupId) ?? null, [groups, activeGroupId]);
  const activeTag = useMemo(() =>
    activeGroup?.tags.find((t) => t.id === activeTagId) ?? null,
    [activeGroup, activeTagId],
  );

  const serviceItemsFlat = useMemo(() =>
    serviceItems.flatMap((g) =>
      g.items.map((it) => ({ id: it.id, label: `${g.department.name} / ${it.name}` })),
    ),
    [serviceItems],
  );

  const attendanceServiceItems = useMemo(() =>
    serviceItems.flatMap((g) =>
      g.items
        .filter((it) => it.category === 'TRAINING_ATTENDANCE')
        .map((it) => ({ id: it.id, name: it.name, departmentId: g.department.id, departmentName: g.department.name })),
    ),
    [serviceItems],
  );

  // Handlers
  const handleAddTag = async (groupId: string) => {
    if (!newTagName.trim()) return;
    const res = await tagService.createTag({ groupId, name: newTagName.trim() });
    if (res?.success) {
      toast({ title: '已添加 tag' });
      setNewTagName('');
      setAddingTagInGroupId(null);
      await refresh();
    } else {
      toast({ title: '添加失败', description: (res as { error?: string })?.error, variant: 'destructive' });
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    if (!window.confirm(`删除 tag "${tag.name}"？关联的 PS 会自动解除标签（PS 本身保留）。`)) return;
    const res = await tagService.deleteTag(tag.id);
    if (res?.success) {
      toast({ title: '已删除' });
      if (activeTagId === tag.id) setActiveTagId(null);
      await refresh();
    } else {
      toast({ title: '删除失败', description: (res as { error?: string })?.error, variant: 'destructive' });
    }
  };

  const handleDeleteGroup = async (g: TagGroup) => {
    const attached = g.tags.length;
    if (!window.confirm(`删除标签组 "${g.name}"（含 ${attached} 个 tag）？所有关联会被解除。`)) return;
    const res = await tagService.deleteGroup(g.id, true);
    if (res?.success) {
      toast({ title: '已删除标签组' });
      if (activeGroupId === g.id) setActiveGroupId(null);
      await refresh();
    } else {
      toast({ title: '删除失败', description: (res as { error?: string })?.error, variant: 'destructive' });
    }
  };

  const handleDetachMember = async (tagId: string, supportId: string, volunteerName: string) => {
    if (!window.confirm(`从本 tag 解除挂接 ${volunteerName} 的这条 PS？PS 本身保留。`)) return;
    const res = await tagService.detach(tagId, supportId);
    if (res?.success) {
      toast({ title: '已解除挂接' });
      void tagService.listTagSupports(tagId).then((r) => setTagSupports(r));
    } else {
      toast({ title: '解除失败', description: (res as { error?: string })?.error, variant: 'destructive' });
    }
  };

  const handleBatchDelete = async (tag: Tag, scope: 'all') => {
    if (!window.confirm(`确定把 "${tag.name}" 下所有 PS 软删除？`)) return;
    const res = await tagService.batchDelete(tag.id, { scope });
    if (res?.success) {
      toast({ title: '批量删除完成', description: `影响 ${res.data?.deletedCount ?? 0} 条` });
      await refresh();
      void tagService.listTagSupports(tag.id).then((r) => setTagSupports(r));
    } else {
      toast({ title: '删除失败', description: (res as { error?: string })?.error, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <Card variant="elevated" className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">标签管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              标签组 + 标签 + 批量操作。managed 组支持批量录入 / 改时长 / 删除，tag_only 组仅 attach/detach。
            </p>
          </div>
          {canAdmin && (
            <Button onClick={() => { setEditingGroup(null); setGroupFormOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" />新建标签组
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        {/* ─── Groups + tags list ─── */}
        <Card variant="elevated" className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">标签组 ({groups.length})</h2>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
          ) : groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              还没有标签组{canAdmin ? '，点击上方"新建标签组"开始' : '，请 admin 创建'}
            </p>
          ) : (
            <ul className="space-y-2">
              {groups.map((g) => {
                const expanded = activeGroupId === g.id;
                return (
                  <li key={g.id} className="rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => { setActiveGroupId(expanded ? null : g.id); setActiveTagId(null); }}
                      className={cn(
                        'flex w-full items-center gap-2 p-2.5 text-left transition-colors',
                        expanded ? 'bg-primary/5' : 'hover:bg-muted/50',
                      )}
                    >
                      <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-sm">{g.name}</span>
                          <Badge variant="outline" className="text-[9px] py-0">{g.selectionMode}</Badge>
                          <Badge
                            variant={g.opMode === 'managed' ? 'success' : 'outline'}
                            className="text-[9px] py-0"
                          >
                            {g.opMode}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] py-0">{g.openness}</Badge>
                          {g.required && <Badge variant="info" className="text-[9px] py-0">必填</Badge>}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {g.tags.length} 个 tag · 触发 {g.boundServiceItemIds.length} 个 service item
                        </div>
                      </div>
                      <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-90')} />
                    </button>
                    {expanded && (
                      <div className="border-t border-border p-2 space-y-1">
                        {g.description && (
                          <p className="mb-2 text-[11px] text-muted-foreground">{g.description}</p>
                        )}
                        {g.tags.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setActiveTagId(activeTagId === t.id ? null : t.id); }}
                            className={cn(
                              'flex w-full items-center gap-2 rounded px-2 py-1 text-xs transition-colors',
                              activeTagId === t.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                            )}
                          >
                            <TagIcon className="h-3 w-3" />
                            <span className="flex-1 truncate text-left">{t.name}</span>
                            {canWriteTags && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); void handleDeleteTag(t); }}
                                className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
                                aria-label="删除"
                              >
                                <Trash2 className="h-3 w-3" />
                              </span>
                            )}
                          </button>
                        ))}
                        {canWriteTags && (g.openness === 'open' || canAdmin) && (
                          <div className="pt-1">
                            {addingTagInGroupId === g.id ? (
                              <div className="flex gap-1">
                                <FormInput
                                  value={newTagName}
                                  onChange={(e) => setNewTagName(e.target.value)}
                                  placeholder="新 tag 名"
                                  autoFocus
                                  className="h-7 text-xs"
                                />
                                <Button size="sm" onClick={() => handleAddTag(g.id)}>✓</Button>
                                <Button size="sm" variant="outline" onClick={() => { setAddingTagInGroupId(null); setNewTagName(''); }}>×</Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setAddingTagInGroupId(g.id); setNewTagName(''); }}
                                className="text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                + 加 tag
                              </button>
                            )}
                          </div>
                        )}
                        {canAdmin && (
                          <div className="mt-2 flex gap-2 border-t border-border pt-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEditingGroup(g); setGroupFormOpen(true); }}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />编辑组
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void handleDeleteGroup(g); }}
                              className="inline-flex items-center gap-1 text-[11px] text-destructive hover:underline"
                            >
                              <Trash2 className="h-3 w-3" />删组
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* ─── Active tag detail: members + batch actions ─── */}
        <Card variant="elevated" className="p-4">
          {!activeTag || !activeGroup ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              从左边选择一个 tag 查看成员
            </p>
          ) : (
            <>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <TagIcon className="h-4 w-4" />{activeTag.name}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    组：{activeGroup.name} · {activeGroup.opMode === 'managed' ? '可批量改删' : '纯标签'}
                  </p>
                </div>
                {canWriteTags && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setBatchCreateTag(activeTag); setManualAttachOpen(true); }}
                    >
                      <LinkIcon className="mr-1 h-3.5 w-3.5" />
                      挂接 PS
                    </Button>
                    {activeGroup.opMode === 'managed' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setBatchCreateTag(activeTag); setBatchCreateOpen(true); }}
                        >
                          <ListPlus className="mr-1 h-3.5 w-3.5" />
                          粘名单建 PS
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setBatchCreateTag(activeTag); setBatchUpdateOpen(true); }}
                        >
                          <Edit3 className="mr-1 h-3.5 w-3.5" />
                          批量改
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleBatchDelete(activeTag, 'all')}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          全部软删
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border">
                {!tagSupports ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">加载中…</p>
                ) : !tagSupports.success || !tagSupports.data || tagSupports.data.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">尚无成员</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {tagSupports.data.map((m) => (
                      <li key={m.support.id} className="flex items-center gap-3 p-2.5 text-xs">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium">{m.support.volunteer?.chineseName}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{m.support.volunteer?.volunteerCode}</span>
                          </div>
                          <div className="text-muted-foreground">
                            {m.support.serviceItem?.departmentName} / {m.support.serviceItem?.name} · {m.support.duration}h · {new Date(m.support.serviceDate).toISOString().slice(0, 10)}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[9px]">{m.support.supportId}</Badge>
                        {canWriteTags && (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => void handleDetachMember(
                              activeTag.id,
                              m.support.id,
                              m.support.volunteer?.chineseName ?? '该志愿者',
                            )}
                            aria-label="解除挂接"
                            title="从本 tag 解除挂接（PS 保留）"
                          >
                            <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      <GroupFormDialog
        open={groupFormOpen}
        onOpenChange={setGroupFormOpen}
        serviceItemsFlat={serviceItemsFlat}
        existingGroup={editingGroup}
        onSaved={() => void refresh()}
      />

      <BatchCreateDialog
        open={batchCreateOpen}
        onOpenChange={setBatchCreateOpen}
        tag={batchCreateTag}
        allVolunteers={allVolunteers}
        attendanceServiceItems={attendanceServiceItems}
        onDone={() => { void refresh(); if (batchCreateTag) void tagService.listTagSupports(batchCreateTag.id).then((r) => setTagSupports(r)); }}
      />

      <BatchUpdateDialog
        open={batchUpdateOpen}
        onOpenChange={setBatchUpdateOpen}
        tag={batchCreateTag}
        onDone={() => { if (batchCreateTag) void tagService.listTagSupports(batchCreateTag.id).then((r) => setTagSupports(r)); }}
      />

      <ManualAttachDialog
        open={manualAttachOpen}
        onOpenChange={setManualAttachOpen}
        tag={batchCreateTag}
        tagGroup={activeGroup}
        allVolunteers={allVolunteers}
        onDone={() => { if (batchCreateTag) void tagService.listTagSupports(batchCreateTag.id).then((r) => setTagSupports(r)); }}
      />
    </div>
  );
}
