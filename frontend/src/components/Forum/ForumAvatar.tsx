import { useState } from 'react';
import { ShieldCheck, UserRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { volunteerService } from '@/services/volunteerService';
import type { ForumAuthorIdentity } from '@/services/types';
export function ForumAvatar({ author, size = 'default' }: { author: ForumAuthorIdentity; size?: 'default' | 'sm' }) {
  const [failed, setFailed] = useState<string | null>(null);
  const source = !author.isDeleted && !author.isSystemAdmin && author.avatar && !author.avatar.startsWith('https://ui-avatars.com/api/') && /^(https?:\/\/|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(author.avatar) ? author.avatar : null;
  const style = `flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-medium text-primary ring-1 ring-border ${size === 'sm' ? 'h-6 w-6 text-xs' : 'h-9 w-9 text-sm'}`;
  return source && failed !== source ? <img src={source} alt={`${author.name}的头像`} loading="lazy" referrerPolicy="no-referrer" className={`${style} object-cover`} onError={() => setFailed(source)} /> : <span role="img" aria-label={`${author.isDeleted ? '已注销' : author.name}的默认头像`} className={style}>{author.isDeleted ? <UserRound aria-hidden="true" className="h-4 w-4 text-muted-foreground" /> : author.isSystemAdmin ? <ShieldCheck aria-hidden="true" className="h-4 w-4" /> : [...author.name][0] || <UserRound aria-hidden="true" className="h-4 w-4" />}</span>;
}

export function CurrentForumAvatar() {
  const { account } = useAuth();
  const volunteerId = account?.role !== 'admin' ? account?.volunteerId : null;
  const { data } = useQuery({
    queryKey: ['forum-self-avatar', account?.id, volunteerId],
    queryFn: () => volunteerService.getVolunteerById(volunteerId!),
    enabled: !!volunteerId,
    staleTime: 60_000,
    retry: false,
  });
  if (!account) return null;
  const volunteer = data?.success ? data.data : null;
  return <ForumAvatar author={{ accountId: account.id, name: volunteer?.chineseName || account.name, avatar: volunteer?.avatar || null, volunteerId: volunteerId || null, isSystemAdmin: account.role === 'admin' }} />;
}
