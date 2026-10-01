import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { notificationService } from '@/services/notificationService';
interface NotificationState { unreadCount: number | null; refresh: () => Promise<void> }
const Context = createContext<NotificationState | null>(null);
function Session({ accountId, children }: { accountId?: string; children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const alive = useRef(false), sequence = useRef(0);
  const refresh = useCallback(async () => {
    if (!accountId || !alive.current) return;
    const request = ++sequence.current;
    try {
      const data = await notificationService.unreadCount();
      if (alive.current && sequence.current === request) setUnreadCount(data.unreadCount);
    } catch {
      // An unavailable count must not masquerade as an empty inbox.
      if (alive.current && sequence.current === request) setUnreadCount(null);
    }
  }, [accountId]);
  useEffect(() => {
    alive.current = true;
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh(); };
    visibleRefresh();
    const timer = window.setInterval(visibleRefresh, 60_000);
    window.addEventListener('focus', visibleRefresh);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => {
      alive.current = false; sequence.current++;
      window.clearInterval(timer);
      window.removeEventListener('focus', visibleRefresh);
      document.removeEventListener('visibilitychange', visibleRefresh);
    };
  }, [refresh]);
  return <Context.Provider value={{ unreadCount, refresh }}>{children}</Context.Provider>;
}
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  // Remount account-scoped state; a late response from the previous account
  // cannot restore its badge or inbox after logout/switching identities.
  return <Session key={account?.id || 'anonymous'} accountId={account?.id}>{children}</Session>;
}
export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error('NotificationProvider is required');
  return value;
}
