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
  const isActive = volunteer.status === '在职';

  return (
    <Card
      variant="interactive"
      className="group relative cursor-pointer overflow-hidden pl-4"
      onClick={() => onClick?.(volunteer.id)}
    >
      {/* Left accent bar */}
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1 rounded-l-3xl',
          isActive ? 'bg-emerald-400' : 'bg-neutral-200 dark:bg-neutral-700'
        )}
      />

      <div className={compact ? 'p-4' : 'p-5'}>
        {/* Top row: avatar + name block + status */}
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
                <span className="shrink-0 text-xs text-neutral-400">{volunteer.id}</span>
              </div>
              <Badge variant={isActive ? 'success' : 'outline'} className="shrink-0">
                {volunteer.status}
              </Badge>
            </div>

            {/* Region + primary service + compact stats */}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {volunteer.region || '未设置'}
              </span>
              {volunteer.services[0] && (
                <Badge variant="outline" className="text-xs">{volunteer.services[0]}</Badge>
              )}
              {compact && (
                <span className="ml-auto shrink-0 tabular-nums">
                  {volunteer.nonProjectHours}h · {volunteer.nonProjectCount}次
                </span>
              )}
            </div>

            {!compact && (
              <p className="mt-1 truncate text-xs text-neutral-400">{volunteer.englishName || '—'}</p>
            )}
          </div>
        </div>

        {/* Full mode: stats + service tags */}
        {!compact && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900">
                <p className="text-xs text-neutral-400">非项目时长</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                  <Clock3 className="h-3.5 w-3.5 text-teal-500" />
                  {volunteer.nonProjectHours}h
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900">
                <p className="text-xs text-neutral-400">服务次数</p>
                <p className="mt-0.5 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                  {volunteer.nonProjectCount} 次
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {volunteer.services.slice(0, 4).map((service, i) => (
                <Badge key={`${volunteer.id}-${service}-${i}`} variant="info" className="text-xs">
                  {service}
                </Badge>
              ))}
              {volunteer.services.length === 0 && (
                <Badge variant="outline" className="text-xs">暂无标签</Badge>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default VolunteerCard;
