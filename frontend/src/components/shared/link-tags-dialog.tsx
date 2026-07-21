// v3.2 — post-hoc tag edit dialog for an existing ProjectSupport.
// Replaces the old LinkProjectDialog (Project concept dropped in v3.3).
//
// Shows tag groups bound to the PS's serviceItem. Each group renders its
// tags as pills; user toggles them and the dialog computes the diff on
// submit (attaches newly-selected tags, detaches unselected ones).

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import tagService from '@services/tagService';
import type { ProjectSupport, TagGroup } from '@services/types';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  support: ProjectSupport | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export const LinkTagsDialog: React.FC<Props> = ({ open, support, onOpenChange, onChanged }) => {
  const [boundGroups, setBoundGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Tracks current selection per group, initialized from support.tags on open.
  const [selectedTagIds, setSelectedTagIds] = useState<Record<string, string[]>>({});

  // Initial selection snapshot — used to compute attach/detach diffs on submit.
  const initialSelection = useMemo(() => {
    if (!support) return {} as Record<string, string[]>;
    const acc: Record<string, string[]> = {};
    for (const t of support.tags ?? []) {
      if (!t.group) continue;
      if (!acc[t.group.id]) acc[t.group.id] = [];
      acc[t.group.id].push(t.tagId);
    }
    return acc;
  }, [support]);

  useEffect(() => {
    if (!open || !support) return;
    setLoading(true);
    setSelectedTagIds(initialSelection);
    tagService.getGroupsBoundTo(support.serviceItemId)
      .then((res) => {
        if (res?.success && res.data) setBoundGroups(res.data);
      })
      .finally(() => setLoading(false));
  }, [open, support, initialSelection]);

  const toggleTagInGroup = (group: TagGroup, tagId: string) => {
    setSelectedTagIds((prev) => {
      const current = prev[group.id] ?? [];
      if (group.selectionMode === 'single') {
        return { ...prev, [group.id]: current[0] === tagId ? [] : [tagId] };
      }
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

  const handleSubmit = async () => {
    if (!support) return;
    if (missingRequiredGroups.length > 0) {
      toast({
        title: '必选标签未填',
        description: missingRequiredGroups.map((g) => g.name).join('、'),
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      // Compute diff per group: current vs initial → lists to attach/detach.
      const toAttach: string[] = [];
      const toDetach: string[] = [];
      for (const g of boundGroups) {
        const now = new Set(selectedTagIds[g.id] ?? []);
        const before = new Set(initialSelection[g.id] ?? []);
        for (const id of now) if (!before.has(id)) toAttach.push(id);
        for (const id of before) if (!now.has(id)) toDetach.push(id);
      }
      if (toAttach.length === 0 && toDetach.length === 0) {
        onOpenChange(false);
        return;
      }
      const results = await Promise.allSettled([
        ...toAttach.map((tagId) => tagService.attach(tagId, support.supportId)),
        ...toDetach.map((tagId) => tagService.detach(tagId, support.supportId)),
      ]);
      const failed = results.filter((r) => r.status === 'rejected' || !(r.status === 'fulfilled' && (r.value as { success?: boolean })?.success)).length;
      if (failed > 0) {
        toast({
          title: `部分操作失败 (${failed}/${results.length})`,
          description: '请刷新后重试',
          variant: 'destructive',
        });
      } else {
        toast({ title: '标签已更新' });
      }
      onChanged?.();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!support) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      closeOnOutsideClick={false}
      title="修改标签"
      description={`${support.serviceItem?.departmentName ?? ''} / ${support.serviceItem?.name ?? ''} · ${support.duration}h`}
    >
      <div className="flex flex-col gap-3 px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : boundGroups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            当前 service item 没有绑定任何标签组
          </p>
        ) : (
          boundGroups.map((g) => {
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
                  <p className="text-xs text-muted-foreground">（该组暂无 tag）</p>
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
          })
        )}
        {missingRequiredGroups.length > 0 && (
          <p className="text-xs text-destructive">
            必选未填：{missingRequiredGroups.map((g) => g.name).join('、')}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          取消
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={submitting || loading}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          保存
        </Button>
      </div>
    </Dialog>
  );
};

export default LinkTagsDialog;
