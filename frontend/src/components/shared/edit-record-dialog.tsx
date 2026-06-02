// Small dialog for a volunteer (or admin) to edit an existing ProjectSupport
// record's date / duration / description. The service item is locked — to
// change it, delete and re-submit (matches the proxy-console edit semantics).
//
// Backend enforces owner/admin + month-lock + the TRAINING_ATTENDANCE block;
// this dialog is only opened for records the caller may edit (see callers).

import { useEffect, useState } from 'react';
import projectSupportService from '@services/projectSupportService';
import type { ProjectSupport } from '@services/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormField, FormInput, FormTextarea } from '@/components/shared/form-fields';
import { toast } from '@/hooks/use-toast';

export interface EditRecordDialogProps {
  /** The record being edited; null closes the dialog. */
  record: ProjectSupport | null;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful update so the caller can refresh its data. */
  onSaved: () => void;
}

export const EditRecordDialog: React.FC<EditRecordDialogProps> = ({
  record,
  onOpenChange,
  onSaved,
}) => {
  const [serviceDate, setServiceDate] = useState('');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-fill whenever a new record is opened.
  useEffect(() => {
    if (!record) return;
    setServiceDate(
      typeof record.serviceDate === 'string'
        ? record.serviceDate.split('T')[0]
        : new Date(record.serviceDate).toISOString().split('T')[0],
    );
    setDuration(String(record.duration));
    setDescription(record.description);
    setError('');
  }, [record]);

  const handleSave = async () => {
    if (!record) return;
    const dur = parseFloat(duration);
    if (!Number.isFinite(dur) || dur <= 0 || dur % 0.5 !== 0) {
      setError('时长必须是大于 0 的 0.5 的倍数');
      return;
    }
    if (description.trim().length < 5 || description.trim().length > 1000) {
      setError('描述必须是 5-1000 字符');
      return;
    }
    setSaving(true);
    try {
      const res = await projectSupportService.update(record.supportId, {
        serviceDate,
        duration: dur,
        description: description.trim(),
      });
      if (res?.success) {
        toast({ title: '已更新' });
        onOpenChange(false);
        onSaved();
      } else {
        const msg = res?.message || '更新失败';
        setError(msg);
        toast({ title: '更新失败', description: msg, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!record}
      onOpenChange={onOpenChange}
      title="编辑项目服务记录"
      description="只能改 时长 / 日期 / 描述，要换服务项请删除后重新提交"
      className="sm:max-w-md"
      closeOnOutsideClick={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Locked service item (read-only context) */}
        <div className="rounded-md border border-primary/40 bg-primary/5 p-2 text-xs">
          📌 {record?.serviceItem?.departmentName} / {record?.serviceItem?.name}
          <span className="ml-1 text-muted-foreground">（服务项锁定）</span>
        </div>

        <FormField label="服务日期" required>
          <FormInput
            type="date"
            value={serviceDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setServiceDate(e.target.value)}
          />
        </FormField>

        <FormField label="时长（小时）" required hint="0.5 的倍数">
          <FormInput
            type="number"
            min="0.5"
            step="0.5"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </FormField>

        <FormField label="描述" required error={error || undefined}>
          <FormTextarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>
      </div>
    </Dialog>
  );
};

export default EditRecordDialog;
