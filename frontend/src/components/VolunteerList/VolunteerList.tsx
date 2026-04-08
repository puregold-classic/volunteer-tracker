import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCcw, Users } from 'lucide-react';
import VolunteerCard from '@components/VolunteerCard';
import { Volunteer } from '@services/types';
import { volunteerService } from '@services/volunteerService';
import { VolunteersParams } from '@services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/shared/states';
import { SectionHeader } from '@/components/shared/section-header';
import { StatCard } from '@/components/shared/stat-card';

export interface VolunteerListProps {
  compact?: boolean;
  onVolunteerClick?: (id: string) => void;
  onVolunteerSelect?: (volunteer: Volunteer) => void;
  showStats?: boolean;
  showPagination?: boolean;
  filterParams?: VolunteersParams;
  emptyMessage?: string;
}

const VolunteerList: React.FC<VolunteerListProps> = ({
  compact = false,
  onVolunteerClick,
  onVolunteerSelect,
  showStats = true,
  showPagination = true,
  filterParams,
  emptyMessage,
}) => {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, active: 0, totalHours: 0 });

  const filterKey = useMemo(() => JSON.stringify(filterParams ?? {}), [filterParams]);

  useEffect(() => {
    void fetchVolunteers(filterParams);
    if (showStats || showPagination) {
      void fetchStats();
    }
  }, [filterKey, showStats, showPagination]);

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

  const fetchStats = async () => {
    try {
      const response = await volunteerService.getStats();
      if (response.success && response.data?.summary) {
        const { summary } = response.data;
        setStats({ total: summary.totalVolunteers, active: summary.totalActive, totalHours: summary.totalHours });
      }
    } catch {
      // keep silent for low-risk UI refresh
    }
  };

  const handleVolunteerClick = (id: string) => {
    if (onVolunteerClick) onVolunteerClick(id);
    else window.open(`/volunteers/${id}`, '_blank');
  };

  if (loading) {
    const skeletonCount = compact ? 4 : 6;
    return (
      <div className="space-y-5" aria-busy="true" aria-live="polite">
        {showStats && (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} variant="glass" className="p-5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-4 h-9 w-24" />
                <Skeleton className="mt-3 h-3 w-28" />
              </Card>
            ))}
          </div>
        )}
        <div className={`grid gap-4 ${compact ? 'md:grid-cols-2 xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <Card key={index} className="p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="志愿者列表加载失败" description={error} actionLabel="重新加载" onAction={() => void fetchVolunteers(filterParams)} />;
  }

  if (volunteers.length === 0) {
    return <EmptyState title="暂无匹配结果" description={emptyMessage || '当前筛选条件下没有志愿者数据，可尝试放宽地区、方向或关键词。'} />;
  }

  return (
    <div className="space-y-5">
      {showStats && (
        <>
          <SectionHeader
            eyebrow="directory"
            title="志愿者列表"
            description="保持现有数据查询逻辑不变，仅升级列表信息密度与交互反馈。"
            actions={<Button variant="outline" size="sm" onClick={() => void fetchVolunteers(filterParams)}><RefreshCcw className="h-4 w-4" />刷新列表</Button>}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="总志愿者" value={stats.total} hint="当前系统内可见人数" icon={<Users className="h-5 w-5" />} />
            <StatCard label="在职人数" value={stats.active} hint="可立即参与服务" icon={<BarChart3 className="h-5 w-5" />} />
            <StatCard label="累计服务小时" value={stats.totalHours} hint="非项目服务总时长" icon={<BarChart3 className="h-5 w-5" />} />
          </div>
        </>
      )}

      <div className={`grid gap-4 ${compact ? 'md:grid-cols-2 xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
        {volunteers.map((volunteer) => (
          <div key={volunteer.id} onClick={() => onVolunteerSelect?.(volunteer)}>
            <VolunteerCard volunteer={volunteer} compact={compact} onClick={handleVolunteerClick} />
          </div>
        ))}
      </div>

      {showPagination && (
        <Card className="flex flex-col gap-2 px-5 py-4 text-sm text-neutral-500 dark:text-neutral-400 md:flex-row md:items-center md:justify-between">
          <span>当前展示 {volunteers.length} 位志愿者</span>
          <span>全量统计 {stats.total} 位志愿者</span>
        </Card>
      )}
    </div>
  );
};

export default VolunteerList;
