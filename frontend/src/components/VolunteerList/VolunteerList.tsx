// chunk 6 phase C.5: simplified to a single-column list optimized for the
// home rail. The v1 stat cards (totalHours / active count / etc) are gone —
// stats live in the parent's SummaryPanel. Loading states use compact skeletons.

import React, { useEffect, useMemo, useState } from 'react';
import VolunteerCard from '@components/VolunteerCard';
import { Volunteer } from '@services/types';
import { volunteerService } from '@services/volunteerService';
import type { VolunteersParams } from '@services/types';
import { Skeleton } from '@components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/shared/states';

export interface VolunteerListProps {
  compact?: boolean;
  onVolunteerClick?: (id: string) => void;
  onVolunteerSelect?: (volunteer: Volunteer) => void;
  /** v1 prop kept for compat — no-op now (stats moved to SummaryPanel) */
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = useMemo(() => JSON.stringify(filterParams ?? {}), [filterParams]);

  useEffect(() => {
    void fetchVolunteers(filterParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const fetchVolunteers = async (params?: VolunteersParams) => {
    try {
      setLoading(true);
      setError(null);
      const response = await volunteerService.getAllVolunteers(params);
      if (response.success && response.data) {
        setVolunteers(response.data || []);
      } else {
        setVolunteers([]);
      }
    } catch (err: any) {
      setError(err.message || '获取志愿者数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleVolunteerClick = (id: string) => {
    if (onVolunteerClick) onVolunteerClick(id);
    else window.open(`/volunteers/${id}`, '_blank');
  };

  if (loading) {
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
        onAction={() => void fetchVolunteers(filterParams)}
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
    <div className="space-y-2.5">
      {volunteers.map((volunteer) => (
        <div key={volunteer.id} onClick={() => onVolunteerSelect?.(volunteer)}>
          <VolunteerCard volunteer={volunteer} compact={compact} onClick={handleVolunteerClick} />
        </div>
      ))}
    </div>
  );
};

export default VolunteerList;
