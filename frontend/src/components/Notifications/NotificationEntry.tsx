import { NavLink } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useNotifications } from './NotificationProvider';
export function NotificationEntry() {
  const { unreadCount } = useNotifications();
  const label = unreadCount === null ? '消息中心' : unreadCount > 0 ? `消息中心，${unreadCount} 条未读` : '消息中心，无未读消息';
  return <NavLink to="/messages" aria-label={label} title={label} className={({ isActive }) => `relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
    <Mail className="h-5 w-5" aria-hidden="true" />
    {unreadCount !== null && unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground">{unreadCount > 99 ? '99+' : unreadCount}</span>}
  </NavLink>;
}
