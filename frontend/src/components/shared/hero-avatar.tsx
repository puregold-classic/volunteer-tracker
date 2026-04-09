// Reusable initial-letter avatar with deterministic tone based on the
// volunteer code. Used by MePage Hero and VolunteerDetailPage Hero so the
// two pages share the same visual identity.

import { cn } from '@/lib/utils';

const AVATAR_TONES = [
  'bg-primary/15 text-primary ring-primary/30',
  'bg-accent/15 text-accent ring-accent/30',
  'bg-chart-3/15 text-chart-3 ring-chart-3/30',
  'bg-chart-4/15 text-chart-4 ring-chart-4/30',
  'bg-chart-5/15 text-chart-5 ring-chart-5/30',
] as const;

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export const HeroAvatar: React.FC<{
  name: string;
  code: string;
  size?: 'lg' | 'md';
}> = ({ name, code, size = 'lg' }) => {
  const tone = AVATAR_TONES[hashCode(code) % AVATAR_TONES.length];
  const initial = name?.charAt(0) || '?';
  const sizeCls = size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-10 w-10 text-base';
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-2xl font-serif font-semibold ring-2',
        sizeCls,
        tone,
      )}
    >
      {initial}
    </div>
  );
};

export default HeroAvatar;
