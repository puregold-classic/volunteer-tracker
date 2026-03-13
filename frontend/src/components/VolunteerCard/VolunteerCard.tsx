import React from 'react';
import { Clock3, MapPin } from 'lucide-react';
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
  const primaryTag = volunteer.services[0] || '暂无方向';

  return (
    <Card
      variant="interactive"
      className={cn(
        'group cursor-pointer overflow-hidden',
        compact ? 'min-h-[184px] p-4' : 'min-h-[236px] p-5'
      )}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Avatar - left */}
        <img
          src={volunteer.avatar}
          alt={volunteer.chineseName}
          className={cn('rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700', compact ? 'h-11 w-11' : 'h-14 w-14')}
        />
        
        {/* Name + Status - right */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className={cn('truncate font-bold text-slate-900 dark:text-slate-50', compact ? 'text-base' : 'text-lg')}>
              {volunteer.chineseName}
            </h3>
            <Badge variant={statusVariant}>{volunteer.status}</Badge>
          </div>
          
          {/* Region + Service - smaller/lighter */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{volunteer.region || '未设置地区'}</span>
            <Badge variant="outline" className="text-xs">{primaryTag}</Badge>
          </div>
          
          {!compact && <p className="mt-1 truncate text-xs text-slate-400">{volunteer.englishName || '—'}</p>}
        </div>
      </div>

      {!compact && (
        <>
          {/* Stats - two columns */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-400">最近活跃</p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-slate-50"><Clock3 className="mr-1 inline h-3.5 w-3.5 text-sky-500" />{volunteer.nonProjectHours}h</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-400">服务次数</p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-slate-50">{volunteer.nonProjectCount}次</p>
            </div>
          </div>

          {/* Service tags */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {volunteer.services.slice(0, 3).map((service, index) => (
              <Badge key={`${volunteer.id}-${service}-${index}`} variant="info" className="text-xs">{service}</Badge>
            ))}
            {volunteer.services.length === 0 && <Badge variant="outline" className="text-xs">暂无标签</Badge>}
          </div>
        </>
      )}
    </Card>
  );
};

export default VolunteerCard;
