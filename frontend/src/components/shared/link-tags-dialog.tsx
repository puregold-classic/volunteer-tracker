// v3.2 — post-hoc tag edit dialog for an existing ProjectSupport.
// Replaces the old LinkProjectDialog (Project concept dropped in v3.3).
//
// Shows tag groups bound to the PS's serviceItem. Each group renders its
// tags as pills; the server saves the whole selection atomically.

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
  const [loadError, setLoadError] = useState('');
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
    let live = true;
    setLoading(true);
    setLoadError('');
    setSelectedTagIds(initialSelection);
    tagService.getGroupsBoundTo(support.serviceItemId)
      .then((res) => {
        if (!res.success || !res.data) throw new Error(res.error || '标签加载失败');
        if (live) setBoundGroups(res.data);
      })
      .catch(() => { if (live) setLoadError('标签加载失败，请关闭后重新打开。'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
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
    (g) => g.required && !g.tags.some((t) => (selectedTagIds[g.id] ?? []).includes(t.id)),
  );
  const historical = (support?.tags || []).filter((t) => !boundGroups.some((g) => g.tags.some((tag) => tag.id === t.tagId)));

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
      const result = await tagService.replaceRecordTags(support.id, Object.values(selectedTagIds).flat());
      if (!result.success) throw new Error(result.error || '保存失败');
      toast({ title: '标签已更新' });
      onChanged?.();
      onOpenChange(false);
    } catch (error) {
      toast({ title: '保存失败', description: error instanceof Error ? error.message : (error as { error?: string })?.error || '请重试', variant: 'destructive' });
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
        {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : boundGroups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            当前服务项没有适用的标签组
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
                  <p className="text-xs text-muted-foreground">（该组暂无标签）</p>
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
        {!loading && historical.length > 0 && <div className="space-y-2 rounded-xl bg-primary/5 p-3"><p className="text-sm font-medium">历史标签需检查</p><p className="text-xs leading-5 text-muted-foreground">以下标签已停用或不再适用，保留原有关联；可明确解除。</p>{historical.map((tag) => <div key={tag.tagId} className="flex items-center justify-between gap-2 text-xs"><span>{tag.name}</span><button type="button" className="text-primary underline" onClick={() => setSelectedTagIds((previous) => { const next = { ...previous }; const groupId = tag.group?.id; if (!groupId) return previous; const ids = next[groupId] || []; next[groupId] = ids.includes(tag.tagId) ? ids.filter((id) => id !== tag.tagId) : [...ids, tag.tagId]; return next; })}>{Object.values(selectedTagIds).flat().includes(tag.tagId) ? '解除关联' : '撤销解除'}</button></div>)}</div>}
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
        <Button type="button" onClick={handleSubmit} disabled={submitting || loading || !!loadError || missingRequiredGroups.length > 0}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          保存
        </Button>
      </div>
    </Dialog>
  );
};

export default LinkTagsDialog;
