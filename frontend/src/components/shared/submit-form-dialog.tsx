// Reusable "submit project support" dialog. Shared between:
//   • MePage — self-submit (no targetVolunteer prop) with optional
//     "为他人提交" checkbox that asks for a volunteer code.
//   • VolunteerDetailPage — locked proxy mode (targetVolunteer set);
//     dialog title becomes "为 XX 提交项目支援", checkbox is hidden,
//     volunteerId is auto-supplied.
//
// v3 service-item picker:
// - Top: 三大板块 tabs (项目管理 / 项目培训 / 项目支持).
// - Inside each tab: items grouped by Department, rendered as pill buttons.
// - TRAINING_ATTENDANCE items are filtered out here (backend also blocks them).
// - The currently-selected item shows a breadcrumb above the tabs so you
//   know what's picked even after scrolling or tab-switching.
//
// Submission goes through projectSupportService.create. Backend decides
// PENDING_CONFIRMATION vs ACTIVE based on operator role (v3: a_admin /
// b_admin proxy auto-confirms) and submittedById vs volunteerId.

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import volunteerService from '@services/volunteerService';
import projectSupportService from '@services/projectSupportService';
import tagService from '@services/tagService';
import type { ServiceCategory, ServiceItemsByDepartment, TagGroup } from '@services/types';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const submitSchema = z
  .object({
    serviceItemId: z.string().min(1, '请选择服务项'),
    serviceDate: z.string().min(1, '请选择服务日期'),
    duration: z.string().min(1, '请填时长').refine((s) => {
      const n = parseFloat(s);
      return !Number.isNaN(n) && n > 0 && (n * 2) % 1 === 0;
    }, '时长必须是大于 0 的 0.5 倍数'),
    description: z.string().trim().min(5, '描述至少 5 个字').max(1000, '描述不超过 1000 字'),
    forAnother: z.boolean().optional(),
    targetVolunteerCode: z.string().optional(),
  })
  .refine(
    (d) => !d.forAnother || (d.targetVolunteerCode && d.targetVolunteerCode.trim().length > 0),
    { message: '代提交需要填写对方 volunteer code', path: ['targetVolunteerCode'] },
  );

type SubmitFormData = z.infer<typeof submitSchema>;

const CATEGORY_TABS: { value: ServiceCategory; label: string }[] = [
  { value: 'PROJECT_MGMT', label: '项目管理' },
  { value: 'PROJECT_TRAINING', label: '项目培训' },
  { value: 'PROJECT_SUPPORT', label: '项目支持' },
];

// Shape used internally: group departments under category; each dept keeps
// only items belonging to that category. Items with category=TRAINING_ATTENDANCE
// are always filtered out of the individual-submission picker.
type CategoryGroup = {
  category: ServiceCategory;
  departments: Array<{
    id: string;
    name: string;
    items: Array<{ id: string; name: string }>;
  }>;
};

function buildCategoryGroups(groupedItems: ServiceItemsByDepartment[]): CategoryGroup[] {
  const byCategory = new Map<ServiceCategory, Map<string, CategoryGroup['departments'][number]>>();
  for (const g of groupedItems) {
    for (const item of g.items) {
      if (item.category === 'TRAINING_ATTENDANCE') continue;
      let deptMap = byCategory.get(item.category);
      if (!deptMap) {
        deptMap = new Map();
        byCategory.set(item.category, deptMap);
      }
      let entry = deptMap.get(g.department.id);
      if (!entry) {
        entry = { id: g.department.id, name: g.department.name, items: [] };
        deptMap.set(g.department.id, entry);
      }
      entry.items.push({ id: item.id, name: item.name });
    }
  }
  return CATEGORY_TABS.map((c) => ({
    category: c.value,
    departments: Array.from(byCategory.get(c.value)?.values() ?? []),
  }));
}

function findItemCategory(
  groups: CategoryGroup[],
  itemId: string,
): { category: ServiceCategory; deptName: string; itemName: string } | null {
  for (const g of groups) {
    for (const d of g.departments) {
      const match = d.items.find((i) => i.id === itemId);
      if (match) return { category: g.category, deptName: d.name, itemName: match.name };
    }
  }
  return null;
}

export interface SubmitFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupedItems: ServiceItemsByDepartment[];
  onSubmitted: () => void;
  /**
   * Lock the dialog into proxy mode for a specific volunteer.
   * When set: title becomes "为 XX 提交项目支援", checkbox is hidden,
   * volunteerId is forced. Used from VolunteerDetailPage.
   */
  targetVolunteer?: { id: string; chineseName: string };
}

export const SubmitFormDialog: React.FC<SubmitFormDialogProps> = ({
  open,
  onOpenChange,
  groupedItems,
  onSubmitted,
  targetVolunteer,
}) => {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isLockedProxy = !!targetVolunteer;
  const categoryGroups = useMemo(() => buildCategoryGroups(groupedItems), [groupedItems]);

  const firstNonEmptyCategory =
    categoryGroups.find((g) => g.departments.length > 0)?.category ?? 'PROJECT_MGMT';
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>(firstNonEmptyCategory);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubmitFormData>({
    resolver: zodResolver(submitSchema),
    defaultValues: {
      serviceItemId: '',
      serviceDate: today,
      duration: '1',
      description: '',
      forAnother: false,
      targetVolunteerCode: '',
    },
  });

  const forAnother = watch('forAnother');
  const selectedItemId = watch('serviceItemId');
  const selectedInfo = useMemo(
    () => (selectedItemId ? findItemCategory(categoryGroups, selectedItemId) : null),
    [selectedItemId, categoryGroups],
  );

  // v3.2: tag group picker state — when user picks a serviceItem, fetch
  // any TagGroups bound to that item and show inline pickers. Selected tag
  // ids per group id (array for both single + multi; single enforced by UI).
  const [boundGroups, setBoundGroups] = useState<TagGroup[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Record<string, string[]>>({});
  const [boundGroupsLoading, setBoundGroupsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      reset({
        serviceItemId: '',
        serviceDate: today,
        duration: '1',
        description: '',
        forAnother: false,
        targetVolunteerCode: '',
      });
      setActiveCategory(firstNonEmptyCategory);
      setBoundGroups([]);
      setSelectedTagIds({});
    }
  }, [open, reset, today, firstNonEmptyCategory]);

  // When serviceItem changes, fetch bound tag groups
  useEffect(() => {
    if (!selectedItemId) {
      setBoundGroups([]);
      setSelectedTagIds({});
      return;
    }
    setBoundGroupsLoading(true);
    tagService.getGroupsBoundTo(selectedItemId)
      .then((res) => {
        if (res?.success && res.data) {
          setBoundGroups(res.data);
          // Reset selections when service item changes
          setSelectedTagIds({});
        }
      })
      .finally(() => setBoundGroupsLoading(false));
  }, [selectedItemId]);

  const toggleTagInGroup = (group: TagGroup, tagId: string) => {
    setSelectedTagIds((prev) => {
      const current = prev[group.id] ?? [];
      if (group.selectionMode === 'single') {
        // Radio: replace
        return { ...prev, [group.id]: current[0] === tagId ? [] : [tagId] };
      }
      // Checkbox: toggle
      return {
        ...prev,
        [group.id]: current.includes(tagId)
          ? current.filter((x) => x !== tagId)
          : [...current, tagId],
      };
    });
  };

  const missingRequiredGroups = boundGroups.filter(
    (g) => g.required && (selectedTagIds[g.id] ?? []).length === 0,
  );

  // When user picks an item from another tab via selectedInfo, follow them
  // there so the active-tab highlight matches the picked item.
  useEffect(() => {
    if (selectedInfo && selectedInfo.category !== activeCategory) {
      setActiveCategory(selectedInfo.category);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInfo?.category]);

  const onSubmit = async (data: SubmitFormData) => {
    // Block submit if any required bound group isn't filled
    if (missingRequiredGroups.length > 0) {
      setError('root', { message: `必填标签未选：${missingRequiredGroups.map((g) => g.name).join('、')}` });
      return;
    }

    let targetVolunteerId: string | undefined;

    if (isLockedProxy) {
      targetVolunteerId = targetVolunteer.id;
    } else if (data.forAnother && data.targetVolunteerCode) {
      const lookup = await volunteerService.getVolunteerById(data.targetVolunteerCode.trim());
      if (!lookup?.success || !lookup.data) {
        setError('targetVolunteerCode', { message: `未找到 volunteer: ${data.targetVolunteerCode}` });
        return;
      }
      targetVolunteerId = lookup.data.id;
    }

    const result = await projectSupportService.create({
      volunteerId: targetVolunteerId,
      serviceItemId: data.serviceItemId,
      serviceDate: data.serviceDate,
      duration: parseFloat(data.duration),
      description: data.description,
    });

    if (result?.success && result.data) {
      // Attach any selected tags. Failures logged but don't fail the submit —
      // the PS is already saved; user can manually fix tag state after.
      const createdId = result.data.id;
      const attachPromises: Promise<unknown>[] = [];
      for (const group of boundGroups) {
        const tagIds = selectedTagIds[group.id] ?? [];
        for (const tagId of tagIds) {
          attachPromises.push(tagService.attach(tagId, createdId));
        }
      }
      if (attachPromises.length > 0) {
        const results = await Promise.allSettled(attachPromises);
        const failures = results.filter((r) => r.status === 'rejected').length;
        if (failures > 0) {
          toast({ title: '标签附加部分失败', description: `${failures} 个 tag 未成功挂上，可到记录卡片手动补`, variant: 'destructive' });
        }
      }

      const isProxy = result.data.isProxy;
      const pending = result.data.status === 'PENDING_CONFIRMATION';
      const targetName = targetVolunteer?.chineseName || data.targetVolunteerCode;
      toast({
        title: '提交成功',
        description: isProxy && pending
          ? `已代为提交，等待 ${targetName} 确认`
          : isProxy
            ? `已为 ${targetName} 录入（已直接生效）`
            : '记录已生效',
      });
      onSubmitted();
      onOpenChange(false);
    } else {
      const errMsg = (result as any)?.error || '提交失败';
      toast({ title: '提交失败', description: errMsg, variant: 'destructive' });
      setError('root', { message: errMsg });
    }
  };

  const title = isLockedProxy
    ? `为 ${targetVolunteer.chineseName} 提交项目支援`
    : '提交项目支援';
  const description = isLockedProxy
    ? '选择类别 → 服务项，填写时长与描述即可录入'
    : '选择类别 → 服务项，填写时长与描述即可录入';

  const activeGroup = categoryGroups.find((g) => g.category === activeCategory);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* ─── Service item picker: category tabs + dept-grouped pills ─── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-foreground">
              服务项 <span className="text-destructive">*</span>
            </label>
            {selectedInfo && (
              <span className="truncate text-xs text-muted-foreground">
                已选：
                <span className="font-medium text-foreground">{selectedInfo.deptName}</span>
                <span className="mx-1">·</span>
                <span className="font-medium text-primary">{selectedInfo.itemName}</span>
              </span>
            )}
          </div>

          {/* Category tabs */}
          <div
            role="tablist"
            className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/50 p-1"
          >
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeCategory === tab.value;
              const group = categoryGroups.find((g) => g.category === tab.value);
              const itemCount = group?.departments.reduce((acc, d) => acc + d.items.length, 0) ?? 0;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveCategory(tab.value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      'ml-1.5 text-[10px] tabular-nums',
                      isActive ? 'text-muted-foreground' : 'opacity-60',
                    )}
                  >
                    ({itemCount})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Department-grouped pills */}
          <input type="hidden" {...register('serviceItemId')} />
          <div className="max-h-52 overflow-y-auto rounded-lg border border-border bg-background p-2.5">
            {!activeGroup || activeGroup.departments.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                该类别下暂无服务项
              </p>
            ) : (
              <div className="space-y-2.5">
                {activeGroup.departments.map((dept) => (
                  <div key={dept.id}>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {dept.name}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dept.items.map((item) => {
                        const isActive = selectedItemId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              setValue('serviceItemId', item.id, {
                                shouldValidate: true,
                                shouldDirty: true,
                              })
                            }
                            className={cn(
                              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isActive
                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5',
                            )}
                          >
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {errors.serviceItemId && (
            <p className="text-xs text-destructive">{errors.serviceItemId.message}</p>
          )}
        </div>

        {/* v3.2 bound tag groups — shown inline when service item triggers them */}
        {selectedItemId && (boundGroups.length > 0 || boundGroupsLoading) && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-medium text-muted-foreground">
              根据所选 service item 附加的标签
              {boundGroupsLoading && <span className="ml-2 text-muted-foreground">加载中…</span>}
            </p>
            {boundGroups.map((g) => {
              const selected = selectedTagIds[g.id] ?? [];
              return (
                <div key={g.id} className="space-y-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-foreground">{g.name}</span>
                    {g.required && <span className="text-xs text-destructive">*必选</span>}
                    <span className="text-[10px] text-muted-foreground">
                      ({g.selectionMode === 'single' ? '单选' : '多选'})
                    </span>
                  </div>
                  {g.tags.length === 0 ? (
                    <p className="text-xs text-muted-foreground">（该组暂无 tag，去 /tags 添加）</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {g.tags.map((t) => {
                        const isOn = selected.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTagInGroup(g, t.id)}
                            className={cn(
                              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isOn
                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5',
                            )}
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {missingRequiredGroups.length > 0 && (
              <p className="text-xs text-destructive">
                必选未填：{missingRequiredGroups.map((g) => g.name).join('、')}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="ms-date" className="text-sm font-medium text-foreground">
              服务日期 <span className="text-destructive">*</span>
            </label>
            <input
              id="ms-date"
              type="date"
              max={today}
              {...register('serviceDate')}
              className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.serviceDate && (
              <p className="text-xs text-destructive">{errors.serviceDate.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ms-duration" className="text-sm font-medium text-foreground">
              时长（小时） <span className="text-destructive">*</span>
            </label>
            <input
              id="ms-duration"
              type="number"
              step="0.5"
              min="0.5"
              {...register('duration')}
              className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.duration && (
              <p className="text-xs text-destructive">{errors.duration.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ms-desc" className="text-sm font-medium text-foreground">
            描述 <span className="text-destructive">*</span>
          </label>
          <textarea
            id="ms-desc"
            rows={3}
            placeholder="简述你做了什么（5-1000 字符）"
            {...register('description')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        {/* Proxy submission toggle — hidden in locked-proxy mode */}
        {!isLockedProxy && (
          <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/40 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                {...register('forAnother')}
                className="h-4 w-4 rounded border-border text-primary"
              />
              为他人提交
            </label>
            {forAnother && (
              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="对方的 volunteer code，如 PG-0003"
                  {...register('targetVolunteerCode')}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {errors.targetVolunteerCode && (
                  <p className="text-xs text-destructive">{errors.targetVolunteerCode.message}</p>
                )}
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  普通志愿者代提交需要对方 confirm；管理员（a_admin / b_admin）代提交直接生效。
                </p>
              </div>
            )}
          </div>
        )}

        {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting} size="lg">
            {isSubmitting ? '提交中…' : '提交'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

export default SubmitFormDialog;
