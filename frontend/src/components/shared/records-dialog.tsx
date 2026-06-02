// frontend/src/components/shared/records-dialog.tsx — v3 wave 3
//
// Paginated drill-down dialog showing a filtered list of ProjectSupport
// records. Originally lived inside ReviewPage; extracted so MePage's
// "我的关注" section can reuse it without duplicating pagination state.
//
// Ownership-aware: pass `currentVolunteerId` and records owned by that
// volunteer get inline edit / delete controls (ACTIVE, non-attendance only —
// the card + backend enforce the rest). Records owned by anyone else (admin
// browsing the ledger, or watching another volunteer) stay read-only.
//
// Usage:
//   const records = useRecordsDialog({ currentVolunteerId: account?.volunteerId });
//   // later:
//   records.open('王技术', { volunteerId: '...' });
//   // render:
//   <records.node />

import { useCallback, useState } from 'react';
import projectSupportService from '@services/projectSupportService';
import type { ProjectSupport } from '@services/types';
import { Dialog } from '@/components/ui/dialog';
import { SupportRecordCard } from '@/components/shared/support-record-card';
import { EditRecordDialog } from '@/components/shared/edit-record-dialog';
import { toast } from '@/hooks/use-toast';

const PAGE_SIZE = 10;

export interface UseRecordsDialogOptions {
  /** When a record's volunteerId matches this, show edit / delete controls. */
  currentVolunteerId?: string | null;
}

export interface UseRecordsDialog {
  open: (title: string, filters: Record<string, string>) => Promise<void>;
  node: React.FC;
}

export function useRecordsDialog(options: UseRecordsDialogOptions = {}): UseRecordsDialog {
  const { currentVolunteerId } = options;
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [records, setRecords] = useState<ProjectSupport[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProjectSupport | null>(null);

  const fetchPage = useCallback(async (f: Record<string, string>, p: number) => {
    setLoading(true);
    try {
      const res = await projectSupportService.list({
        ...f,
        status: 'ACTIVE',
        limit: PAGE_SIZE,
        page: p,
      });
      if (res?.success && res.data) {
        setRecords(res.data.records);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const open = useCallback(async (t: string, f: Record<string, string>) => {
    setTitle(t);
    setFilters(f);
    setPage(1);
    setTotalPages(1);
    setRecords([]);
    setIsOpen(true);
    await fetchPage(f, 1);
  }, [fetchPage]);

  const goToPage = useCallback(async (p: number) => {
    setPage(p);
    await fetchPage(filters, p);
  }, [fetchPage, filters]);

  const refetch = useCallback(() => fetchPage(filters, page), [fetchPage, filters, page]);

  const handleDelete = useCallback(async (supportId: string) => {
    if (!window.confirm('删除这条记录？')) return;
    setBusy(true);
    try {
      const res = await projectSupportService.remove(supportId);
      if (res?.success) {
        toast({ title: '已删除' });
        await refetch();
      } else {
        toast({ title: '删除失败', description: res?.message || '未知错误', variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  }, [refetch]);

  const isOwn = (r: ProjectSupport) =>
    !!currentVolunteerId && r.volunteerId === currentVolunteerId;

  const RecordsDialog: React.FC = () => (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title={title}
        description="项目服务记录"
        className="sm:max-w-xl"
      >
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>
        ) : records.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">暂无记录</p>
        ) : (
          <>
            <div className="max-h-[28rem] overflow-y-auto space-y-2.5 pr-1">
              {records.map((r) => {
                const own = isOwn(r);
                return (
                  <SupportRecordCard
                    key={r.id}
                    support={r}
                    showId={false}
                    showEdit={own}
                    showDelete={own}
                    onEdit={own ? setEditingRecord : undefined}
                    onDelete={own ? handleDelete : undefined}
                    busy={busy}
                  />
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                  className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-foreground disabled:opacity-40 disabled:pointer-events-none hover:bg-muted"
                >
                  上一页
                </button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  第 {page}/{totalPages} 页
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                  className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-foreground disabled:opacity-40 disabled:pointer-events-none hover:bg-muted"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </Dialog>

      <EditRecordDialog
        record={editingRecord}
        onOpenChange={(o) => { if (!o) setEditingRecord(null); }}
        onSaved={() => { setEditingRecord(null); void refetch(); }}
      />
    </>
  );

  return { open, node: RecordsDialog };
}
