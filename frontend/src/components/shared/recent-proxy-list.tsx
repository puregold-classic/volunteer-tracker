// frontend/src/components/shared/recent-proxy-list.tsx — v3.4.1
//
// Sidebar list inside SubmitFormDialog (proxyConsole mode): the admin's most
// recent proxy submissions, with edit / withdraw actions.  Helps admins:
// - avoid duplicate proxy submissions ("did I already file this?")
// - quickly fix mis-typed hours / date / description
// - withdraw mis-clicks before the volunteer notices

import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { Pencil, Undo2, Loader2 } from 'lucide-react';
import projectSupportService from '@services/projectSupportService';
import type { ProjectSupport } from '@services/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatLocalDate } from '@/lib/date-utils';

const STATUS_BADGE: Record<string, { text: string; cls: string }> = {
  ACTIVE: {
    text: '已生效',
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
  },
  PENDING_CONFIRMATION: {
    text: '待确认',
    cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  },
};

export interface RecentProxyListHandle {
  refresh: () => void;
}

export interface RecentProxyListProps {
  ownerVolunteerId: string;
  onEdit: (support: ProjectSupport) => void;
  /** Optionally highlight the currently-edited row */
  editingId?: string | null;
}

export const RecentProxyList = forwardRef<RecentProxyListHandle, RecentProxyListProps>(
  function RecentProxyList({ ownerVolunteerId, onEdit, editingId }, ref) {
    const [items, setItems] = useState<ProjectSupport[]>([]);
    const [loading, setLoading] = useState(false);
    const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

    const refresh = useCallback(async () => {
      if (!ownerVolunteerId) return;
      setLoading(true);
      try {
        const res = await projectSupportService.list({
          submittedById: ownerVolunteerId,
          limit: 20,
        });
        if (res?.success && res.data?.records) {
          // Keep only proxy submissions (where submitter ≠ volunteer) with a
          // live status. DELETED / REJECTED rows are noise once reviewed.
          const live = res.data.records.filter(
            (r) =>
              r.isProxy &&
              (r.status === 'ACTIVE' || r.status === 'PENDING_CONFIRMATION'),
          );
          setItems(live.slice(0, 10));
        }
      } finally {
        setLoading(false);
      }
    }, [ownerVolunteerId]);

    useImperativeHandle(ref, () => ({ refresh }), [refresh]);

    useEffect(() => { void refresh(); }, [refresh]);

    const onWithdraw = async (s: ProjectSupport) => {
      if (!window.confirm(
        `撤回为「${s.volunteer?.chineseName}」提交的这条记录？\n${s.serviceItem?.departmentName ?? ''}/${s.serviceItem?.name ?? ''} · ${formatLocalDate(s.serviceDate)} · ${s.duration}h`,
      )) return;
      setWithdrawingId(s.id);
      try {
        const r = await projectSupportService.remove(s.supportId);
        if (r?.success) {
          toast({ title: '已撤回' });
          await refresh();
        } else {
          toast({ title: '撤回失败', description: (r as any)?.error || '未知错误', variant: 'destructive' });
        }
      } finally {
        setWithdrawingId(null);
      }
    };

    return (
      <aside className="flex h-full min-h-0 flex-col">
        <header className="flex items-center justify-between gap-2 pb-2">
          <h3 className="font-serif text-sm font-semibold text-foreground">我近期为他人提交</h3>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </header>

        {!loading && items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
            还没有为他人提交过记录
          </p>
        ) : (
          <ul className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {items.map((s) => {
              const badge = STATUS_BADGE[s.status as keyof typeof STATUS_BADGE];
              const isEditing = editingId === s.id;
              return (
                <li
                  key={s.id}
                  className={cn(
                    'rounded-md border p-2 text-xs transition-colors',
                    isEditing
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-foreground">
                          {s.volunteer?.chineseName ?? '?'}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {s.volunteer?.volunteerCode ?? ''}
                        </span>
                        {badge && (
                          <span className={cn('rounded px-1 py-0.5 text-[10px] font-medium', badge.cls)}>
                            {badge.text}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {s.serviceItem?.departmentName} / {s.serviceItem?.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
                        <span>{formatLocalDate(s.serviceDate)}</span>
                        <span>·</span>
                        <span>{s.duration}h</span>
                      </div>
                      {s.description && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80 italic">
                          “{s.description}”
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEdit(s)}
                        aria-label="编辑"
                        title="编辑（时长/日期/描述）"
                        disabled={isEditing}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void onWithdraw(s)}
                        aria-label="撤回"
                        title="撤回"
                        disabled={withdrawingId === s.id}
                        className="text-rose-600"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    );
  },
);

export default RecentProxyList;
