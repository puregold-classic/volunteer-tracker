// chunk 6 phase C.7: keep-previous-data pattern. Refilter no longer flashes
// the skeleton — old data stays visible while new data loads, with a subtle
// opacity dim to indicate "stale". Only the very first fetch shows skeleton.
//
// This is what react-query gives you for free, but rolling it by hand is
// 10 lines and avoids dragging more dependency in. We'll migrate to react-query
// in a later phase if multiple pages need the same pattern.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import VolunteerCard from '@components/VolunteerCard';
import { Volunteer } from '@services/types';
import { volunteerService } from '@services/volunteerService';
import type { VolunteersParams } from '@services/types';
import { Skeleton } from '@components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/shared/states';
import { cn } from '@/lib/utils';

export interface VolunteerListProps {
  compact?: boolean;
  onVolunteerClick?: (id: string) => void;
  onVolunteerSelect?: (volunteer: Volunteer) => void;
  /** v1 prop kept for compat — no-op now */
  showStats?: boolean;
  /** v1 prop kept for compat — no-op now */
  showPagination?: boolean;
  filterParams?: VolunteersParams;
  emptyMessage?: string;
}

const VolunteerList: React.FC<VolunteerListProps> = ({
  compact = false,
  onVolunteerClick,
  onVolunteerSelect,
  filterParams,
  emptyMessage,
}) => {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  // hasLoadedOnce: gates the skeleton — only show on the very first fetch.
  // Subsequent fetches dim the existing list slightly via `refetching`.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterKey = useMemo(() => JSON.stringify(filterParams ?? {}), [filterParams]);
  // Track the latest filterKey so an out-of-order response doesn't overwrite
  // newer data
  const latestKeyRef = useRef(filterKey);

  useEffect(() => {
    latestKeyRef.current = filterKey;
    let cancelled = false;
    const requestKey = filterKey;

    const isInitial = !hasLoadedOnce;
    if (isInitial) {
      // First fetch — full skeleton
    } else {
      setRefetching(true);
    }
    setError(null);

    (async () => {
      try {
        const response = await volunteerService.getAllVolunteers(filterParams);
        if (cancelled || latestKeyRef.current !== requestKey) return;
        if (response.success && response.data) {
          setVolunteers(response.data);
        } else {
          setVolunteers([]);
        }
      } catch (err: any) {
        if (cancelled || latestKeyRef.current !== requestKey) return;
        setError(err?.message || '获取志愿者数据失败');
      } finally {
        if (cancelled || latestKeyRef.current !== requestKey) return;
        setHasLoadedOnce(true);
        setRefetching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const handleVolunteerClick = (id: string) => {
    if (onVolunteerClick) onVolunteerClick(id);
    else window.open(`/volunteers/${id}`, '_blank');
  };

  // Initial-only skeleton (full)
  if (!hasLoadedOnce) {
    return (
      <div className="space-y-2.5" aria-busy="true" aria-live="polite">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="志愿者列表加载失败"
        description={error}
        actionLabel="重新加载"
        onAction={() => {
          // Force refetch by toggling state
          setHasLoadedOnce(false);
        }}
      />
    );
  }

  if (volunteers.length === 0) {
    return (
      <EmptyState
        title="暂无匹配结果"
        description={emptyMessage || '当前筛选条件下没有志愿者，可尝试放宽地区、部门或关键词。'}
      />
    );
  }

  return (
    <div
      className={cn(
        'space-y-2.5 transition-opacity duration-200',
        refetching && 'opacity-60 pointer-events-none',
      )}
    >
      {volunteers.map((volunteer) => (
        <div key={volunteer.id} onClick={() => onVolunteerSelect?.(volunteer)}>
          <VolunteerCard volunteer={volunteer} compact={compact} onClick={handleVolunteerClick} />
        </div>
      ))}
    </div>
  );
};

export default VolunteerList;
