import React from 'react';
import { MapPin } from 'lucide-react';
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
  const isActive = volunteer.status === '在职';

  return (
    <Card
      variant="interactive"
      className="group relative cursor-pointer overflow-hidden pl-4"
      onClick={() => onClick?.(volunteer.id)}
    >
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1 rounded-l-3xl',
          isActive ? 'bg-emerald-400' : 'bg-neutral-200 dark:bg-neutral-700'
        )}
      />

      <div className={compact ? 'p-4' : 'p-5'}>
        <div className="flex items-start gap-3">
          <img
            src={volunteer.avatar}
            alt={volunteer.chineseName}
            className={cn(
              'shrink-0 rounded-2xl object-cover ring-1 ring-neutral-200 dark:ring-neutral-700',
              compact ? 'h-10 w-10' : 'h-12 w-12'
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-1.5">
                <h3 className={cn(
                  'truncate font-semibold text-neutral-900 dark:text-neutral-50',
                  compact ? 'text-sm' : 'text-base'
                )}>
                  {volunteer.chineseName}
                </h3>
                <span className="shrink-0 text-xs text-neutral-400">{volunteer.volunteerCode}</span>
              </div>
              <Badge variant={isActive ? 'success' : 'outline'} className="shrink-0">
                {volunteer.status}
              </Badge>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {volunteer.region || '未设置'}
              </span>
              {volunteer.department && (
                <Badge variant="outline" className="text-xs">{volunteer.department.name}</Badge>
              )}
            </div>

            {!compact && (
              <p className="mt-1 truncate text-xs text-neutral-400">{volunteer.englishName || '—'}</p>
            )}
          </div>
        </div>

        {!compact && (
          <div className="mt-4 rounded-2xl bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500 dark:bg-neutral-900">
            服务时长统计已迁移到「项目支援台账」（chunk 6 重做后会回到这里）
          </div>
        )}
      </div>
    </Card>
  );
};

export default VolunteerCard;
