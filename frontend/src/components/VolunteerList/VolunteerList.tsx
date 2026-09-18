// chunk 6 phase C.7: keep-previous-data pattern. Refilter no longer flashes
// the skeleton — old data stays visible while new data loads, with a subtle
// opacity dim to indicate "stale". Only the very first fetch shows skeleton.
//
// This is what react-query gives you for free, but rolling it by hand is
// 10 lines and avoids dragging more dependency in. We'll migrate to react-query
// in a later phase if multiple pages need the same pattern.
//
// Paging: the list used to fetch page 1 only and drop the `total` the API
// returns, so a 95-volunteer DB rendered 20 cards while the homepage StatStrip
// (which calls /stats, unpaginated) said 95. Now the list appends pages as the
// sentinel scrolls into view and shows 已显示 N / 共 M so the two numbers agree.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VolunteerCard from '@components/VolunteerCard';
import { Volunteer } from '@services/types';
import { volunteerService } from '@services/volunteerService';
import type { VolunteersParams } from '@services/types';
import { Skeleton } from '@components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/shared/states';
import { cn } from '@/lib/utils';

const DEFAULT_PAGE_SIZE = 20;

export interface VolunteerListProps {
  compact?: boolean;
  onVolunteerClick?: (id: string) => void;
  onVolunteerSelect?: (volunteer: Volunteer) => void;
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // hasLoadedOnce: gates the skeleton — only show on the very first fetch.
  // Subsequent fetches dim the existing list slightly via `refetching`.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageSize = filterParams?.limit ?? DEFAULT_PAGE_SIZE;
  const filterKey = useMemo(() => JSON.stringify(filterParams ?? {}), [filterParams]);
  // Track the latest filterKey so an out-of-order response doesn't overwrite
  // newer data
  const latestKeyRef = useRef(filterKey);
  // Separate from the `loadingMore` state: the observer can fire again before
  // React has re-rendered with the new state, which would double-fetch a page.
  const loadingMoreRef = useRef(false);

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
        const response = await volunteerService.getAllVolunteers({
          ...filterParams,
          page: 1,
          limit: pageSize,
        });
        if (cancelled || latestKeyRef.current !== requestKey) return;
        if (response.success && response.data) {
          setVolunteers(response.data);
          setTotal(response.total ?? response.data.length);
        } else {
          setVolunteers([]);
          setTotal(0);
        }
        setPage(1);
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

  const hasMore = hasLoadedOnce && volunteers.length < total;

  const loadMore = useCallback(async () => {
    // `refetching` means page 1 of a *new* filter is still in flight — appending
    // page 2 now would splice the new filter's rows onto the old list.
    if (loadingMoreRef.current || refetching || !hasMore) return;

    const requestKey = latestKeyRef.current;
    const nextPage = page + 1;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const response = await volunteerService.getAllVolunteers({
        ...filterParams,
        page: nextPage,
        limit: pageSize,
      });
      if (latestKeyRef.current !== requestKey) return;
      if (response.success && response.data) {
        const rows = response.data;
        setVolunteers((prev) => {
          // A volunteer created between two page fetches shifts the createdAt
          // window, which can repeat an id across pages. Drop repeats rather
          // than render duplicate keys.
          const seen = new Set(prev.map((v) => v.id));
          return [...prev, ...rows.filter((v) => !seen.has(v.id))];
        });
        if (typeof response.total === 'number') setTotal(response.total);
        setPage(nextPage);
      }
    } catch {
      // Keep what's already rendered — the sentinel retries on the next scroll.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [filterParams, hasMore, page, pageSize, refetching]);

  // Observer callbacks capture loadMore, which changes every page. Keep the
  // latest in a ref so the observer doesn't need re-subscribing per page.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    // root: null — the sentinel sits inside the page's overflow-y-auto card, and
    // ancestor clipping already keeps it out of view until the user scrolls down.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMoreRef.current();
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

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

      {hasMore && <div ref={sentinelRef} aria-hidden className="h-px w-full" />}

      <p className="py-2 text-center text-xs text-muted-foreground" aria-live="polite">
        {loadingMore
          ? '加载中…'
          : hasMore
            ? `已显示 ${volunteers.length} / 共 ${total} 人`
            : `共 ${total} 人`}
      </p>
    </div>
  );
};

export default VolunteerList;
