// Link a ProjectSupport to a Project (or unlink it). Shared dialog used
// from SupportRecordCard. Loads the first page of projects once, filters
// client-side by the search input — project list is low-volume so this
// is simpler than a server-side search.

import { useEffect, useMemo, useState } from 'react';
import { Check, Link2Off, Loader2, Search, X } from 'lucide-react';
import projectService from '@services/projectService';
import projectSupportService from '@services/projectSupportService';
import type { Project, ProjectSupport } from '@services/types';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormInput } from '@/components/shared/form-fields';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatLocalDate } from '@/lib/date-utils';

export interface LinkProjectDialogProps {
  open: boolean;
  support: ProjectSupport | null;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}

export const LinkProjectDialog: React.FC<LinkProjectDialogProps> = ({
  open,
  support,
  onOpenChange,
  onChanged,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setLoading(true);
    void projectService.list({ limit: 100 }).then((res) => {
      if (res?.success && res.data) setProjects(res.data);
      setLoading(false);
    });
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.trim().toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.projectCode.toLowerCase().includes(q) ||
        p.department?.name.toLowerCase().includes(q),
    );
  }, [projects, search]);

  const applyLink = async (projectId: string | null) => {
    if (!support) return;
    setBusyId(projectId ?? '__UNLINK__');
    try {
      const res = await projectSupportService.update(support.supportId, { projectId });
      if (res?.success) {
        toast({ title: projectId ? '已关联项目' : '已取消关联' });
        onChanged();
        onOpenChange(false);
      } else {
        toast({
          title: projectId ? '关联失败' : '取消关联失败',
          description: (res as { error?: string })?.error || '未知错误',
          variant: 'destructive',
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="关联项目"
      description={support ? `为 ${support.supportId} 选择一个项目标签` : ''}
    >
      {support?.project && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <span className="text-muted-foreground">当前关联：</span>
          <span className="font-medium">{support.project.name}</span>
          <span className="font-mono text-muted-foreground">{support.project.projectCode}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={busyId !== null}
            onClick={() => void applyLink(null)}
          >
            {busyId === '__UNLINK__' ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Link2Off className="mr-1 h-3 w-3" />
            )}
            取消关联
          </Button>
        </div>
      )}

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <FormInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索项目名 / 代码 / 部门"
          className="pl-10 pr-10"
        />
        {search && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch('')}
            aria-label="清空"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">加载项目中…</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {projects.length === 0 ? '暂无项目' : '没有匹配的项目'}
          </p>
        ) : (
          <ul>
            {filtered.map((p) => {
              const isCurrent = support?.projectId === p.id;
              return (
                <li key={p.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void applyLink(isCurrent ? null : p.id)}
                    className={cn(
                      'flex w-full items-center gap-3 p-2.5 text-left transition-colors',
                      isCurrent ? 'bg-primary/5' : 'hover:bg-muted/50',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{p.name}</span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {p.projectCode}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{p.department?.name}</span>
                        <span>·</span>
                        <span>{formatLocalDate(p.sessionDate)}</span>
                        {p.sessionDuration != null && <span>· {p.sessionDuration}h</span>}
                      </div>
                    </div>
                    {busyId === p.id ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : isCurrent ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
};

export default LinkProjectDialog;
