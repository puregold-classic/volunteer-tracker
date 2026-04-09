// chunk 6 phase C.5: rewritten as a horizontal row card optimized for
// single-column rail display. No more name truncation. Avatars hidden in
// compact mode (placeholder UN avatars from v1 are noise without real images).

import React from 'react';
import { ChevronRight, MapPin, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
    <button
      type="button"
      onClick={() => onClick?.(volunteer.id)}
      className={cn(
        'group relative w-full rounded-xl border border-border bg-card text-left transition-all duration-150',
        'hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        compact ? 'p-3 sm:p-3.5' : 'p-4 sm:p-5',
      )}
    >
      {/* Left status accent bar */}
      <span
        className={cn(
          'absolute inset-y-2 left-0 w-0.5 rounded-r-full',
          isActive ? 'bg-primary/70' : 'bg-muted-foreground/30',
        )}
      />

      <div className="flex items-start justify-between gap-3 pl-2">
        {/* Main info */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Name + code + status badge */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="font-serif text-base font-semibold text-foreground leading-tight">
              {volunteer.chineseName}
            </h3>
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {volunteer.volunteerCode}
            </span>
            <Badge variant={isActive ? 'success' : 'outline'} className="text-[10px] py-0.5">
              {volunteer.status}
            </Badge>
          </div>

          {/* English name (only when not compact) */}
          {!compact && volunteer.englishName && (
            <p className="text-xs text-muted-foreground italic">{volunteer.englishName}</p>
          )}

          {/* Region + department */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {volunteer.region}
              {volunteer.province ? ` · ${volunteer.province}` : ''}
            </span>
            {volunteer.department && (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {volunteer.department.name}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </button>
  );
};

export default VolunteerCard;
