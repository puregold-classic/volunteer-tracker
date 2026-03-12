import React from 'react';
import { ArrowUpRight, Clock3, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Volunteer } from '@services/types';
import { cn } from '@/lib/utils';

export interface VolunteerCardProps {
  volunteer: Volunteer;
  onClick?: (id: string) => void;
  compact?: boolean;
}

const VolunteerCard: React.FC<VolunteerCardProps> = ({ volunteer, onClick, compact = false }) => {
  const handleClick = () => {
    onClick?.(volunteer.id);
  };

  const statusVariant = volunteer.status === '在职' ? 'success' : 'outline';

  return (
    <Card
      variant="interactive"
      className={cn(
        'group cursor-pointer overflow-hidden p-5 focus-within:ring-2 focus-within:ring-sky-300',
        compact ? 'min-h-[224px]' : 'min-h-[276px]'
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={volunteer.avatar}
            alt={volunteer.chineseName}
            className={cn('rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700', compact ? 'h-14 w-14' : 'h-16 w-16')}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={cn('truncate font-semibold text-slate-900 dark:text-slate-50', compact ? 'text-lg' : 'text-xl')}>
                {volunteer.chineseName}
              </h3>
              <Badge variant={statusVariant}>{volunteer.status}</Badge>
            </div>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{volunteer.englishName || '—'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{volunteer.region || '未设置地区'}</span>
              <Badge variant="outline">{volunteer.id}</Badge>
            </div>
          </div>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 text-slate-300 transition group-hover:text-sky-500 dark:text-slate-600" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {volunteer.services.length > 0 ? (
          volunteer.services.map((service, index) => (
            <Badge key={`${volunteer.id}-${service}-${index}`} variant="info">{service}</Badge>
          ))
        ) : (
          <Badge variant="outline">暂无方向</Badge>
        )}
      </div>

      <div className={cn('mt-5 grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2')}>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">非项目时长</p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{volunteer.nonProjectHours}h</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">服务次数</p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{volunteer.nonProjectCount}次</p>
        </div>
      </div>

      {!compact && (
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
          <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" />点击查看完整档案与服务记录</span>
          <span className="font-medium text-sky-600 dark:text-sky-300">查看详情</span>
        </div>
      )}
    </Card>
  );
};

export default VolunteerCard;
