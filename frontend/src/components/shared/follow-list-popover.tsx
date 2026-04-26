// frontend/src/components/shared/follow-list-popover.tsx — v3.4 multi-list
//
// Chevron icon next to the heart. Click → popover with one row per list,
// checkbox = membership. Bottom row = "+ 新建 list".
//
// 使用场景：DetailPage（卡片上不放）。Heart 还是默认 list 的快捷 toggle。

import { ChevronDown, ListPlus, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useVolunteerLists } from '@/context/FollowedContext';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export interface FollowListPopoverProps {
  volunteerId: string;
  volunteerName?: string;
  selfVolunteerId?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE = {
  sm: { btn: 'h-6 w-6', icon: 'h-3 w-3' },
  md: { btn: 'h-8 w-8', icon: 'h-3.5 w-3.5' },
  lg: { btn: 'h-10 w-10', icon: 'h-4 w-4' },
};

export const FollowListPopover: React.FC<FollowListPopoverProps> = ({
  volunteerId,
  volunteerName,
  selfVolunteerId,
  size = 'md',
  className,
}) => {
  const { isAuthenticated, account } = useAuth();
  const { lists, membershipOf, setMemberOf, createList } = useVolunteerLists();
  const [open, setOpen] = useState(false);
  const [busyListId, setBusyListId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Same gate as FollowHeart.
  const visible =
    isAuthenticated &&
    !!account?.volunteerId &&
    (account.role === 'a_admin' || account.role === 'b_admin') &&
    volunteerId !== (selfVolunteerId ?? account.volunteerId);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName('');
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!visible) return null;

  const memberOf = membershipOf(volunteerId);

  const onToggle = async (listId: string, currentlyMember: boolean, listName: string) => {
    setBusyListId(listId);
    try {
      await setMemberOf(listId, volunteerId, !currentlyMember);
      toast({
        title: currentlyMember ? `已从「${listName}」移除` : `已加入「${listName}」`,
        description: volunteerName ? `· ${volunteerName}` : undefined,
      });
    } catch {
      toast({ title: '操作失败', description: '请稍后重试', variant: 'destructive' });
    } finally {
      setBusyListId(null);
    }
  };

  const onCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusyListId('__create__');
    try {
      const created = await createList(name);
      if (!created) {
        toast({ title: '创建失败', description: '可能已存在同名 list', variant: 'destructive' });
        return;
      }
      // 立即把当前志愿者加进新 list
      await setMemberOf(created.id, volunteerId, true);
      toast({
        title: `已创建「${name}」并加入`,
        description: volunteerName ? `· ${volunteerName}` : undefined,
      });
      setCreating(false);
      setNewName('');
    } catch {
      toast({ title: '创建失败', description: '请稍后重试', variant: 'destructive' });
    } finally {
      setBusyListId(null);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="加入其它 list"
        aria-expanded={open}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full transition-colors',
          'bg-background/90 text-muted-foreground hover:bg-muted hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          SIZE[size].btn,
        )}
      >
        <ChevronDown className={SIZE[size].icon} />
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 z-50 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md',
            'text-popover-foreground',
          )}
          role="menu"
        >
          <div className="px-2 pb-1 pt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            加入到 list
          </div>
          {lists.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">尚无 list</div>
          )}
          {lists.map((l) => {
            const checked = memberOf.has(l.id);
            const busy = busyListId === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => onToggle(l.id, checked, l.name)}
                disabled={busy}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm',
                  'hover:bg-accent hover:text-accent-foreground',
                  'disabled:opacity-50',
                )}
                role="menuitemcheckbox"
                aria-checked={checked}
              >
                <span className="flex items-center gap-2 truncate">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      checked ? 'bg-primary text-primary-foreground' : 'bg-background',
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{l.name}</span>
                </span>
                {l.isDefault && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">默认</span>
                )}
              </button>
            );
          })}

          <div className="my-1 h-px bg-border" />

          {!creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <ListPlus className="h-4 w-4" />
              新建 list 并加入
            </button>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1.5">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onCreate();
                  else if (e.key === 'Escape') {
                    setCreating(false);
                    setNewName('');
                  }
                }}
                placeholder="list 名称"
                maxLength={32}
                className="h-7 flex-1 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => void onCreate()}
                disabled={busyListId === '__create__' || !newName.trim()}
                className="h-7 rounded bg-primary px-2 text-xs text-primary-foreground disabled:opacity-50"
              >
                创建
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FollowListPopover;
