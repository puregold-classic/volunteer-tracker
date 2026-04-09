// Reusable "submit project support" dialog. Shared between:
//   • MePage — self-submit (no targetVolunteer prop) with optional
//     "为他人提交" checkbox that asks for a volunteer code.
//   • VolunteerDetailPage — locked proxy mode (targetVolunteer set);
//     dialog title becomes "为 XX 提交项目支援", checkbox is hidden,
//     volunteerId is auto-supplied.
//
// Submission goes through projectSupportService.create. Backend decides
// PENDING_CONFIRMATION vs ACTIVE based on whether submittedById ===
// volunteerId. Admin role gets the same flow — backend allows admin to
// create on behalf of any volunteer.

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import volunteerService from '@services/volunteerService';
import projectSupportService from '@services/projectSupportService';
import type { ServiceItemsByDepartment } from '@services/types';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

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
  const {
    register,
    handleSubmit,
    watch,
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
    }
  }, [open, reset, today]);

  const onSubmit = async (data: SubmitFormData) => {
    let targetVolunteerId: string | undefined;

    if (isLockedProxy) {
      // Locked proxy: target supplied by parent
      targetVolunteerId = targetVolunteer.id;
    } else if (data.forAnother && data.targetVolunteerCode) {
      // Free-form proxy: look up by volunteer code
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
      const isProxy = result.data.isProxy;
      const targetName = targetVolunteer?.chineseName || data.targetVolunteerCode;
      toast({
        title: '提交成功',
        description: isProxy ? `已代为提交，等待 ${targetName} 确认` : '记录已生效',
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
    ? '提交后将进入待确认状态，等待对方确认'
    : '记录你完成的支援工作，提交后立即生效';

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="ms-service-item" className="text-sm font-medium text-foreground">
            服务项 <span className="text-destructive">*</span>
          </label>
          <select
            id="ms-service-item"
            {...register('serviceItemId')}
            className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">— 选择服务项 —</option>
            {groupedItems.map((g) => (
              <optgroup key={g.department.id} label={g.department.name}>
                {g.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {errors.serviceItemId && (
            <p className="text-xs text-destructive">{errors.serviceItemId.message}</p>
          )}
        </div>

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
              为他人提交（对方需要确认）
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
