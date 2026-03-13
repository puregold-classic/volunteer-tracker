import React from 'react';
import { ArrowRight, Clock3, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  const primaryTag = volunteer.services[0] || '暂无方向';

  return (
    <Card
      variant="interactive"
      className={cn(
        'group overflow-hidden',
        compact ? 'min-h-[184px] p-4' : 'min-h-[236px] p-5'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={cn('truncate font-semibold text-slate-900 dark:text-slate-50', compact ? 'text-base' : 'text-xl')}>
              {volunteer.chineseName}
            </h3>
            <Badge variant={statusVariant}>{volunteer.status}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{volunteer.region || '未设置地区'}</span>
            <Badge variant="outline">{primaryTag}</Badge>
            {!compact && <Badge variant="outline">{volunteer.id}</Badge>}
          </div>
          {!compact && <p className="mt-2 truncate text-sm text-slate-500 dark:text-slate-400">{volunteer.englishName || '—'}</p>}
        </div>
        <img
          src={volunteer.avatar}
          alt={volunteer.chineseName}
          className={cn('rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700', compact ? 'h-11 w-11' : 'h-14 w-14')}
        />
      </div>

      {!compact && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">最近活跃</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-50"><Clock3 className="h-4 w-4 text-sky-500" />{volunteer.nonProjectHours}h</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">服务次数</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{volunteer.nonProjectCount}次</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {volunteer.services.slice(0, 3).map((service, index) => (
              <Badge key={`${volunteer.id}-${service}-${index}`} variant="info">{service}</Badge>
            ))}
            {volunteer.services.length === 0 && <Badge variant="outline">暂无标签</Badge>}
          </div>
        </>
      )}

      <div className={cn(compact ? 'mt-4' : 'mt-4')}>
        <Button type="button" className="w-full justify-between" onClick={handleClick}>
          查看详情
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};

export default VolunteerCard;
