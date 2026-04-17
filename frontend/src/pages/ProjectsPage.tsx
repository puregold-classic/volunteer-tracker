// frontend/src/pages/ProjectsPage.tsx — v3 wave 2 step 2
//
// 项目级录入 page. MVP scope: TRAINING_ATTENDANCE only.
//
// Layout:
//   ┌─────────────────────────────────────────────────┐
//   │ Header + "新建项目" (admin/a_admin)              │
//   │ Filter row: 部门 / 日期范围 / 搜索                │
//   │ Project list (card per project)                  │
//   │   ↓ click → detail dialog                        │
//   └─────────────────────────────────────────────────┘
// Dialog:
//   - Project info (name, date, duration, attributes)
//   - Batch attendance entry section (textarea + submit)
//   - Result panel (matched / unmatched / already-recorded / ambiguous)

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { CalendarDays, ChevronRight, ListPlus, Loader2, Plus, Search, Users, X } from 'lucide-react';
import projectService, {
  type BatchAttendanceResult,
} from '@services/projectService';
import serviceItemService from '@services/serviceItemService';
import volunteerService from '@services/volunteerService';
import type { Project, ServiceItemsByDepartment, ServiceCategory, Volunteer } from '@services/types';
import { Check, AlertTriangle, X as XIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FormField, FormInput, FormSelect, FormTextarea } from '@/components/shared/form-fields';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const DEPARTMENTS: { id: string; name: string }[] = [
  { id: 'BY_PROJECT', name: '笔译项目部' },
  { id: 'KY_PROJECT', name: '口译项目部' },
  { id: 'XZT', name: 'XZT' },
  { id: 'BY_TRAINING', name: '笔译培训部' },
  { id: 'KY_TRAINING', name: '口译培训部' },
  { id: 'DOCS', name: '文档部' },
  { id: 'PROMO', name: '推广部' },
  { id: 'TECH', name: '技术部' },
  { id: 'CARE', name: '人文部' },
  { id: 'MGMT', name: '管理部' },
  { id: 'READING_CLUB', name: '共读会' },
  { id: 'VIDEO', name: '视频部' },
];

// Departments that actually have a TRAINING_ATTENDANCE service item. MVP
// only lets admins build attendance projects here — other departments
// don't have a "受训" item in seed so the form would error out.
const TRAINING_DEPT_IDS = new Set(['BY_TRAINING', 'KY_TRAINING', 'READING_CLUB', 'TECH', 'CARE']);

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  PROJECT_MGMT: '项目管理',
  PROJECT_TRAINING: '项目培训',
  PROJECT_SUPPORT: '项目支持',
  TRAINING_ATTENDANCE: '受训考勤',
};

const formatDate = (d: string): string => {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return d;
  }
};

const attributeEntries = (attrs: Record<string, unknown>) =>
  Object.entries(attrs || {}).filter(([, v]) => v != null && v !== '');

// ─── Create-project dialog ─────────────────────────────────────────────────

function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (p: Project) => void;
}) {
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('BY_TRAINING');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessionDuration, setSessionDuration] = useState('2');
  const [attributesJson, setAttributesJson] = useState('{}');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setDepartmentId('BY_TRAINING');
      setSessionDate(new Date().toISOString().slice(0, 10));
      setSessionDuration('2');
      setAttributesJson('{}');
      setError('');
    }
  }, [open]);

  const submit = async () => {
    setError('');
    if (name.trim().length < 2) {
      setError('项目名称至少 2 个字符');
      return;
    }
    const duration = parseFloat(sessionDuration);
    if (!duration || duration <= 0 || (duration * 2) % 1 !== 0) {
      setError('session 时长必须是大于 0 的 0.5 倍数');
      return;
    }
    let attributes: Record<string, unknown> = {};
    try {
      attributes = attributesJson.trim() ? JSON.parse(attributesJson) : {};
      if (typeof attributes !== 'object' || Array.isArray(attributes)) {
        throw new Error('attributes 必须是对象');
      }
    } catch {
      setError('attributes 必须是合法 JSON 对象，例如 {"level":"初翻"}');
      return;
    }

    setSubmitting(true);
    try {
      const res = await projectService.create({
        name: name.trim(),
        category: 'TRAINING_ATTENDANCE',
        departmentId,
        sessionDate,
        sessionDuration: duration,
        attributes,
      });
      if (res?.success && res.data) {
        toast({ title: '项目已创建', description: `${res.data.projectCode} · ${res.data.name}` });
        onCreated(res.data);
        onOpenChange(false);
      } else {
        setError((res as { error?: string })?.error || '创建失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="新建受训考勤项目"
      description="MVP 阶段只支持 受训考勤（TRAINING_ATTENDANCE）大类"
    >
      <div className="space-y-4">
        <FormField label="项目名称" required>
          <FormInput
            placeholder="2026-04 笔译培训 第 12 期"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="主办部门" required>
            <FormSelect value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              {DEPARTMENTS.filter((d) => TRAINING_DEPT_IDS.has(d.id)).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="日期" required>
            <FormInput
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </FormField>
        </div>
        <FormField
          label="Session 时长（小时）"
          required
          hint="批量录入时所有参训人共享该时长；创建后不可修改"
        >
          <FormInput
            type="number"
            step="0.5"
            min="0.5"
            value={sessionDuration}
            onChange={(e) => setSessionDuration(e.target.value)}
          />
        </FormField>
        <FormField
          label="标签 attributes (JSON)"
          hint='XZT 笔记类型、培训级别等。示例：{"language":"中","level":"初翻"}'
        >
          <FormTextarea
            rows={3}
            value={attributesJson}
            onChange={(e) => setAttributesJson(e.target.value)}
            className="font-mono text-xs"
          />
        </FormField>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button type="button" className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? '创建中…' : '创建项目'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ─── Batch attendance + result panel (inside detail dialog) ────────────────

// Splitter: newline / comma (en+cn) / 顿号 / 分号 / tab. Excel单列 copy-paste
// ends up tab-separated per-row with newlines between rows, so this handles
// "Excel 一列粘过来" natively without special parsing.
const NAME_SPLITTER = /[\n,，、;；\t]/;

interface PreviewEntry {
  input: string;
  status: 'matched' | 'ambiguous' | 'unmatched' | 'duplicate';
  match?: Pick<Volunteer, 'id' | 'volunteerCode' | 'chineseName'>;
  candidates?: Array<Pick<Volunteer, 'id' | 'volunteerCode' | 'chineseName'>>;
}

function buildPreview(
  namesText: string,
  volunteersIndex: { byCode: Map<string, Volunteer>; byCn: Map<string, Volunteer[]>; byEn: Map<string, Volunteer[]> },
): PreviewEntry[] {
  const seenVolunteerIds = new Set<string>();
  const seenInputs = new Set<string>();
  const entries: PreviewEntry[] = [];
  for (const raw of namesText.split(NAME_SPLITTER)) {
    const input = raw.trim();
    if (!input) continue;
    const key = input.toLowerCase();
    if (seenInputs.has(key)) {
      entries.push({ input, status: 'duplicate' });
      continue;
    }
    seenInputs.add(key);

    const byCode = volunteersIndex.byCode.get(key);
    if (byCode) {
      if (seenVolunteerIds.has(byCode.id)) {
        entries.push({ input, status: 'duplicate', match: byCode });
      } else {
        seenVolunteerIds.add(byCode.id);
        entries.push({ input, status: 'matched', match: byCode });
      }
      continue;
    }
    const cn = volunteersIndex.byCn.get(key);
    if (cn?.length === 1) {
      const v = cn[0];
      if (seenVolunteerIds.has(v.id)) entries.push({ input, status: 'duplicate', match: v });
      else { seenVolunteerIds.add(v.id); entries.push({ input, status: 'matched', match: v }); }
      continue;
    }
    if (cn && cn.length > 1) {
      entries.push({ input, status: 'ambiguous', candidates: cn });
      continue;
    }
    const en = volunteersIndex.byEn.get(key);
    if (en?.length === 1) {
      const v = en[0];
      if (seenVolunteerIds.has(v.id)) entries.push({ input, status: 'duplicate', match: v });
      else { seenVolunteerIds.add(v.id); entries.push({ input, status: 'matched', match: v }); }
      continue;
    }
    if (en && en.length > 1) {
      entries.push({ input, status: 'ambiguous', candidates: en });
      continue;
    }
    entries.push({ input, status: 'unmatched' });
  }
  return entries;
}

function BatchAttendanceForm({
  project,
  groupedItems,
  allVolunteers,
  onDone,
}: {
  project: Project;
  groupedItems: ServiceItemsByDepartment[];
  allVolunteers: Volunteer[];
  onDone: () => void;
}) {
  // Attendance items that belong to the project's department
  const attendanceItems = useMemo(() => {
    const group = groupedItems.find((g) => g.department.id === project.departmentId);
    return group?.items.filter((i) => i.category === 'TRAINING_ATTENDANCE') ?? [];
  }, [groupedItems, project.departmentId]);

  const [serviceItemId, setServiceItemId] = useState(() => attendanceItems[0]?.id ?? '');
  const [namesText, setNamesText] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BatchAttendanceResult | null>(null);
  const [error, setError] = useState('');

  // Build the matching index once per volunteer list change. Name collisions
  // across chineseName / englishName are tracked as multi-value lists so the
  // preview can tell the user "same Chinese name matches 2 people, please
  // disambiguate with volunteerCode".
  const volunteersIndex = useMemo(() => {
    const byCode = new Map<string, Volunteer>();
    const byCn = new Map<string, Volunteer[]>();
    const byEn = new Map<string, Volunteer[]>();
    for (const v of allVolunteers) {
      if (v.status !== '在职') continue;
      byCode.set(v.volunteerCode.toLowerCase(), v);
      const cn = v.chineseName?.toLowerCase();
      if (cn) {
        if (!byCn.has(cn)) byCn.set(cn, []);
        byCn.get(cn)!.push(v);
      }
      const en = v.englishName?.toLowerCase();
      if (en) {
        if (!byEn.has(en)) byEn.set(en, []);
        byEn.get(en)!.push(v);
      }
    }
    return { byCode, byCn, byEn };
  }, [allVolunteers]);

  const preview = useMemo(
    () => buildPreview(namesText, volunteersIndex),
    [namesText, volunteersIndex],
  );
  const previewCounts = useMemo(() => {
    const c = { matched: 0, ambiguous: 0, unmatched: 0, duplicate: 0 };
    for (const p of preview) c[p.status] += 1;
    return c;
  }, [preview]);

  useEffect(() => {
    if (attendanceItems.length > 0 && !serviceItemId) {
      setServiceItemId(attendanceItems[0].id);
    }
  }, [attendanceItems, serviceItemId]);

  const nameCount = preview.length;

  const submit = async () => {
    setError('');
    setResult(null);
    if (!serviceItemId) {
      setError('请选择 受训 服务项');
      return;
    }
    const names = namesText
      .split(/[\n,，、;；\t]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) {
      setError('请粘贴至少 1 个姓名');
      return;
    }

    setSubmitting(true);
    try {
      const res = await projectService.batchAttendance(project.id, {
        serviceItemId,
        names,
        description: description.trim() || undefined,
      });
      if (res?.success && res.data) {
        setResult(res.data);
        if (res.data.created.length > 0) {
          toast({
            title: '录入完成',
            description: `创建 ${res.data.created.length} 条 / 已存在 ${res.data.alreadyRecorded.length} / 未匹配 ${res.data.unmatched.length} / 多重匹配 ${res.data.ambiguous.length}`,
          });
          onDone();
        } else {
          toast({ title: '未创建任何记录', description: '查看下方结果面板定位原因' });
        }
      } else {
        setError((res as { error?: string })?.error || '录入失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <FormField label="受训服务项" required hint="系统只列出本项目所在部门的受训 item">
        {attendanceItems.length === 0 ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            本部门尚未配置 受训 service item，请先去 seed / admin 配置
          </p>
        ) : (
          <FormSelect value={serviceItemId} onChange={(e) => setServiceItemId(e.target.value)}>
            {attendanceItems.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </FormSelect>
        )}
      </FormField>

      <FormField
        label={`参训人姓名列表 (${nameCount} 人)`}
        required
        hint="一行一个，或逗号/顿号/分号/Tab 分隔。可填中文名、英文名或 PG-XXXX。Excel 单列复制粘贴直接可用。"
      >
        <FormTextarea
          rows={6}
          placeholder={'王技术\n李口译\nPG-0003\n...'}
          value={namesText}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNamesText(e.target.value)}
          className="font-mono"
        />
      </FormField>

      {preview.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-medium text-muted-foreground">核对预览</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700">
              <Check className="h-3 w-3" />
              匹配 {previewCounts.matched}
            </span>
            {previewCounts.ambiguous > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                多重 {previewCounts.ambiguous}
              </span>
            )}
            {previewCounts.unmatched > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-rose-700">
                <XIcon className="h-3 w-3" />
                未匹配 {previewCounts.unmatched}
              </span>
            )}
            {previewCounts.duplicate > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">
                重复 {previewCounts.duplicate}（忽略）
              </span>
            )}
          </div>
          <ul className="max-h-40 overflow-y-auto space-y-0.5 text-[11px]">
            {preview.map((p, i) => (
              <li
                key={`${p.input}-${i}`}
                className={cn(
                  'flex items-center gap-2 rounded px-1.5 py-0.5',
                  p.status === 'matched' && 'text-emerald-700',
                  p.status === 'ambiguous' && 'text-amber-700',
                  p.status === 'unmatched' && 'text-rose-700',
                  p.status === 'duplicate' && 'text-muted-foreground line-through',
                )}
              >
                {p.status === 'matched' && <Check className="h-3 w-3 shrink-0" />}
                {p.status === 'ambiguous' && <AlertTriangle className="h-3 w-3 shrink-0" />}
                {p.status === 'unmatched' && <XIcon className="h-3 w-3 shrink-0" />}
                {p.status === 'duplicate' && <span className="w-3 text-center text-[10px]">◦</span>}
                <span className="truncate font-mono">{p.input}</span>
                {p.match && p.status === 'matched' && (
                  <span className="ml-auto truncate font-normal text-muted-foreground">
                    → {p.match.chineseName} ({p.match.volunteerCode})
                  </span>
                )}
                {p.status === 'ambiguous' && p.candidates && (
                  <span className="ml-auto truncate font-normal text-muted-foreground">
                    候选：{p.candidates.map((v) => v.volunteerCode).join(' / ')}
                  </span>
                )}
                {p.status === 'duplicate' && p.match && (
                  <span className="ml-auto truncate font-normal">
                    ← 已在上面匹配 {p.match.chineseName}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <FormField
        label="描述（可选）"
        hint={`留空则自动使用「参加 ${project.name}」`}
      >
        <FormInput
          placeholder={`参加 ${project.name}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        className="w-full"
        disabled={submitting || !serviceItemId || nameCount === 0}
        onClick={submit}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            正在录入…
          </>
        ) : (
          <>
            <ListPlus className="mr-1.5 h-4 w-4" />
            核验并批量录入 ({nameCount} 人)
          </>
        )}
      </Button>

      {result && <BatchResultPanel result={result} />}
    </div>
  );
}

function BatchResultPanel({ result }: { result: BatchAttendanceResult }) {
  const sections: {
    label: string;
    tone: 'ok' | 'info' | 'warn' | 'err';
    count: number;
    children: React.ReactNode;
  }[] = [
    {
      label: '已创建',
      tone: 'ok',
      count: result.created.length,
      children: result.created.length === 0 ? null : (
        <ul className="space-y-0.5">
          {result.created.map((m) => (
            <li key={m.supportId || m.volunteer.id} className="flex items-center gap-2 text-xs">
              <span className="truncate text-muted-foreground">{m.input}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              <span className="truncate font-medium text-foreground">{m.volunteer.chineseName}</span>
              <span className="text-muted-foreground">({m.volunteer.volunteerCode})</span>
              {m.supportId && (
                <span className="ml-auto truncate text-muted-foreground/80">{m.supportId}</span>
              )}
            </li>
          ))}
        </ul>
      ),
    },
    {
      label: '已存在（未重复）',
      tone: 'info',
      count: result.alreadyRecorded.length,
      children: result.alreadyRecorded.length === 0 ? null : (
        <ul className="space-y-0.5">
          {result.alreadyRecorded.map((m) => (
            <li key={m.volunteer.id} className="text-xs">
              <span className="text-muted-foreground">{m.input}</span>
              <ChevronRight className="inline h-3 w-3 text-muted-foreground/60" />
              <span className="font-medium">{m.volunteer.chineseName}</span>
              <span className="ml-1 text-muted-foreground">({m.volunteer.volunteerCode})</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      label: '多重匹配（请改填 PG-XXXX）',
      tone: 'warn',
      count: result.ambiguous.length,
      children: result.ambiguous.length === 0 ? null : (
        <ul className="space-y-1">
          {result.ambiguous.map((m) => (
            <li key={m.input} className="text-xs">
              <div className="font-medium">{m.input}</div>
              <div className="ml-3 text-muted-foreground">
                候选：{m.candidates.map((v) => `${v.chineseName} (${v.volunteerCode})`).join('、')}
              </div>
            </li>
          ))}
        </ul>
      ),
    },
    {
      label: '未匹配',
      tone: 'err',
      count: result.unmatched.length,
      children: result.unmatched.length === 0 ? null : (
        <ul className="space-y-0.5">
          {result.unmatched.map((n) => (
            <li key={n} className="text-xs text-muted-foreground">{n}</li>
          ))}
        </ul>
      ),
    },
  ];

  const toneClass: Record<typeof sections[number]['tone'], string> = {
    ok: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    info: 'border-blue-300 bg-blue-50 text-blue-900',
    warn: 'border-amber-300 bg-amber-50 text-amber-900',
    err: 'border-rose-300 bg-rose-50 text-rose-900',
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-sm font-medium">
        批量录入结果：共 {result.total} 个输入
      </div>
      {sections.map(
        (s) =>
          s.count > 0 && (
            <div key={s.label} className={cn('rounded-md border px-3 py-2', toneClass[s.tone])}>
              <div className="mb-1 flex items-center gap-2 text-xs font-medium">
                <span>{s.label}</span>
                <span className="tabular-nums">({s.count})</span>
              </div>
              {s.children}
            </div>
          ),
      )}
    </div>
  );
}

// ─── Project detail dialog ─────────────────────────────────────────────────

function ProjectDetailDialog({
  project,
  groupedItems,
  allVolunteers,
  onClose,
  onChanged,
  canEnterAttendance,
}: {
  project: Project | null;
  groupedItems: ServiceItemsByDepartment[];
  allVolunteers: Volunteer[];
  onClose: () => void;
  onChanged: () => void;
  canEnterAttendance: boolean;
}) {
  return (
    <Dialog
      open={!!project}
      onOpenChange={(v) => !v && onClose()}
      title={project?.name || ''}
      description={project ? `${project.projectCode} · ${project.department?.name ?? ''}` : ''}
    >
      {project && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatDate(project.sessionDate)}
            </Badge>
            {project.sessionDuration != null && (
              <Badge variant="outline">{project.sessionDuration} h / 场</Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {project.supportCount} 人已录入
            </Badge>
            <Badge>{CATEGORY_LABEL[project.category]}</Badge>
          </div>

          {attributeEntries(project.attributes).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attributeEntries(project.attributes).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px]"
                >
                  <span className="text-muted-foreground">{k}</span>
                  <span className="mx-1 text-muted-foreground/60">·</span>
                  <span className="font-medium">{String(v)}</span>
                </span>
              ))}
            </div>
          )}

          {canEnterAttendance ? (
            <>
              <div className="my-2 border-t border-border" />
              <div className="text-sm font-medium text-foreground">批量考勤录入</div>
              <BatchAttendanceForm
                project={project}
                groupedItems={groupedItems}
                allVolunteers={allVolunteers}
                onDone={onChanged}
              />
            </>
          ) : (
            <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              你的角色不能录入考勤。请联系 a_admin / b_admin。
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { account } = useAuth();
  const canCreate = account && ['admin', 'a_admin'].includes(account.role);
  const canEnterAttendance = account && ['admin', 'a_admin', 'b_admin'].includes(account.role);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [active, setActive] = useState<Project | null>(null);
  const [groupedItems, setGroupedItems] = useState<ServiceItemsByDepartment[]>([]);
  const [allVolunteers, setAllVolunteers] = useState<Volunteer[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await projectService.list({
        departmentId: departmentId || undefined,
        search: search || undefined,
        limit: 100,
      });
      if (res?.success && res.data) setProjects(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    void serviceItemService.listGrouped().then((r) => {
      if (r?.success && r.data) setGroupedItems(r.data);
    });
    // Load active volunteer roster once for client-side batch-entry preview.
    // Page 1 at limit 500 covers the current sandbox; future growth can switch
    // to server-side match or paginate.
    void volunteerService.getAllVolunteers({ limit: 500, status: '在职' }).then((r) => {
      if (r?.success && r.data) setAllVolunteers(r.data);
    });
  }, []);

  return (
    <div className="space-y-4">
      <Card variant="elevated" className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-foreground">项目级录入</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              受训考勤批量录入入口。创建项目后粘贴参训人名单，一键核验并记账。
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              新建项目
            </Button>
          )}
        </div>
      </Card>

      <Card variant="elevated" className="p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[14rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <FormInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索项目名 / 代码 (PROJ-...)"
              className="pl-10 pr-10"
            />
            {search && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="min-w-[12rem]">
            <FormSelect value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">全部部门</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </FormSelect>
          </div>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">加载项目中…</p>
        ) : projects.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            暂无项目{canCreate ? '。点击右上「新建项目」开始。' : ''}
          </p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setActive(p)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{p.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {p.projectCode}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(p.sessionDate)}
                      </span>
                      <span>{p.department?.name}</span>
                      {p.sessionDuration != null && <span>{p.sessionDuration} h / 场</span>}
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {p.supportCount} 人
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void refresh()}
      />

      <ProjectDetailDialog
        project={active}
        groupedItems={groupedItems}
        allVolunteers={allVolunteers}
        onClose={() => setActive(null)}
        onChanged={() => void refresh()}
        canEnterAttendance={!!canEnterAttendance}
      />
    </div>
  );
}
