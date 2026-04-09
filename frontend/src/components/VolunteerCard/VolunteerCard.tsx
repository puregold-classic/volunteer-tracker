// chunk 6 phase C.6: adds gradient initial avatar (first chinese char with
// deterministic warm-palette color from volunteerCode hash). v1's UN
// placeholder noise is gone; real photos can be wired in later by reading
// volunteer.avatar (when it's a real URL not the ui-avatars default).

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

// Warm palette derived from chart-1..5 + primary/accent. Each entry is a
// pre-baked Tailwind utility pair so we don't compute styles per render.
const AVATAR_TONES = [
  'bg-primary/15 text-primary ring-primary/30',           // ochre
  'bg-accent/15 text-accent ring-accent/30',              // teal
  'bg-chart-3/15 text-chart-3 ring-chart-3/30',           // moss
  'bg-chart-4/15 text-chart-4 ring-chart-4/30',           // terracotta
  'bg-chart-5/15 text-chart-5 ring-chart-5/30',           // plum
] as const;

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getInitial(name?: string, fallback?: string): string {
  const source = (name || fallback || '').trim();
  return source ? source.charAt(0) : '?';
}

const AVATAR_DEFAULT_PREFIX = 'https://ui-avatars.com/api/';

const VolunteerCard: React.FC<VolunteerCardProps> = ({ volunteer, onClick, compact = false }) => {
  const isActive = volunteer.status === '在职';
  const initial = getInitial(volunteer.chineseName, volunteer.volunteerCode);
  const tone = AVATAR_TONES[hashCode(volunteer.volunteerCode || volunteer.id) % AVATAR_TONES.length];

  // Show real photo only if it's NOT the v1 ui-avatars placeholder
  const hasRealPhoto = volunteer.avatar && !volunteer.avatar.startsWith(AVATAR_DEFAULT_PREFIX);

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

      <div className="flex items-start gap-3 pl-2">
        {/* Avatar */}
        {hasRealPhoto ? (
          <img
            src={volunteer.avatar}
            alt={volunteer.chineseName}
            className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-border"
          />
        ) : (
          <div
            aria-hidden="true"
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-serif text-base font-semibold ring-1',
              tone,
            )}
          >
            {initial}
          </div>
        )}

        {/* Main info */}
        <div className="min-w-0 flex-1 space-y-1">
          {/* Name + code + status */}
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
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
        <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </button>
  );
};

export default VolunteerCard;
