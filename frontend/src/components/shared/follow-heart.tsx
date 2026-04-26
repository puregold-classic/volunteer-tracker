// frontend/src/components/shared/follow-heart.tsx — v3 wave 3
//
// Heart toggle for the default "我的关注" list. Lives outside the
// main VolunteerCard <button> element (as an absolutely-positioned
// sibling) so we don't nest interactive elements.

import { Heart } from 'lucide-react';
import { useFollowed } from '@/context/FollowedContext';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export interface FollowHeartProps {
  volunteerId: string;
  volunteerName?: string;
  /** If the logged-in user is this volunteer, hide the heart (can't follow self). */
  selfVolunteerId?: string | null;
  /** Visual size. Default medium. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<'sm' | 'md' | 'lg', { btn: string; icon: string }> = {
  sm: { btn: 'h-6 w-6', icon: 'h-3.5 w-3.5' },
  md: { btn: 'h-8 w-8', icon: 'h-4 w-4' },
  lg: { btn: 'h-10 w-10', icon: 'h-5 w-5' },
};

export const FollowHeart: React.FC<FollowHeartProps> = ({
  volunteerId,
  volunteerName,
  selfVolunteerId,
  size = 'md',
  className,
}) => {
  const { isAuthenticated, account } = useAuth();
  const { followedSet, toggle } = useFollowed();

  // v3.4: list 系统仅对 a_admin / b_admin 开放. user / 纯 admin 看不到心心.
  if (!isAuthenticated) return null;
  if (!account?.volunteerId) return null;
  if (account.role !== 'a_admin' && account.role !== 'b_admin') return null;
  const selfId = selfVolunteerId ?? account.volunteerId;
  if (volunteerId === selfId) return null;

  const isFollowed = followedSet.has(volunteerId);

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const nowFollowed = await toggle(volunteerId);
      toast({
        title: nowFollowed ? '已加入「我的关注」' : '已取消关注',
        description: volunteerName ? `· ${volunteerName}` : undefined,
      });
    } catch {
      toast({
        title: '操作失败',
        description: '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isFollowed ? '取消关注' : '加入我的关注'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        SIZE[size].btn,
        isFollowed
          ? 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
          : 'bg-background/90 text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <Heart
        className={cn(SIZE[size].icon, 'transition-transform', isFollowed && 'fill-current')}
      />
    </button>
  );
};

export default FollowHeart;
