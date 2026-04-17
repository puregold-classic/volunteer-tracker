// frontend/src/components/shared/records-dialog.tsx — v3 wave 3
//
// Paginated drill-down dialog showing a filtered list of ProjectSupport
// records. Originally lived inside ReviewPage; extracted so MePage's
// "我的关注" section can reuse it without duplicating pagination state.
//
// Usage:
//   const records = useRecordsDialog();
//   // later:
//   records.open('王技术', { volunteerId: '...' });
//   // render:
//   <records.node />

import { useCallback, useState } from 'react';
import projectSupportService from '@services/projectSupportService';
import type { ProjectSupport } from '@services/types';
import { Dialog } from '@/components/ui/dialog';
import { SupportRecordCard } from '@/components/shared/support-record-card';

const PAGE_SIZE = 10;

export interface UseRecordsDialog {
  open: (title: string, filters: Record<string, string>) => Promise<void>;
  node: React.FC;
}

export function useRecordsDialog(): UseRecordsDialog {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [records, setRecords] = useState<ProjectSupport[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});

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

  const RecordsDialog: React.FC = () => (
    <Dialog
      open={isOpen}
      onOpenChange={setIsOpen}
      title={title}
      description="项目支援记录"
      className="sm:max-w-xl"
    >
      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>
      ) : records.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">暂无记录</p>
      ) : (
        <>
          <div className="max-h-[28rem] overflow-y-auto space-y-2.5 pr-1">
            {records.map((r) => (
              <SupportRecordCard key={r.id} support={r} showDelete={false} showId={false} />
            ))}
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
  );

  return { open, node: RecordsDialog };
}
