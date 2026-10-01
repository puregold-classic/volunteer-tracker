import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider, useNotifications } from '@/components/Notifications/NotificationProvider';
import { NotificationEntry } from '@/components/Notifications/NotificationEntry';
const state = vi.hoisted(() => ({ account: { id: 'first' } as { id: string } | null, count: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ account: state.account }) }));
vi.mock('@/services/notificationService', () => ({ notificationService: { unreadCount: state.count } }));
function Probe() { const { unreadCount } = useNotifications(); return <output aria-label="未读数">{unreadCount === null ? 'unknown' : unreadCount}</output>; }
const app = () => <NotificationProvider><Probe /></NotificationProvider>;
const settle = async () => { await act(async () => { await Promise.resolve(); }); };
beforeEach(() => { vi.useFakeTimers(); state.account = { id: 'first' }; state.count.mockReset().mockResolvedValue({ unreadCount: 2 }); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
describe('notification polling and identity', () => {
  it('polls only visible pages and refreshes on visibility/focus, stopping after unmount', async () => {
    const view = render(app()); await settle(); expect(state.count).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(60_000); }); expect(state.count).toHaveBeenCalledTimes(2);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => { vi.advanceTimersByTime(120_000); fireEvent.focus(window); }); expect(state.count).toHaveBeenCalledTimes(2);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange')); await settle(); expect(state.count).toHaveBeenCalledTimes(3);
    fireEvent.focus(window); await settle(); expect(state.count).toHaveBeenCalledTimes(4);
    view.unmount(); await act(async () => { vi.advanceTimersByTime(60_000); fireEvent.focus(window); }); expect(state.count).toHaveBeenCalledTimes(4);
  });
  it('clears old identity immediately and ignores its late response, including logout', async () => {
    let resolveOld!: (value: { unreadCount: number }) => void;
    state.count.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValue({ unreadCount: 7 });
    const view = render(app()); await settle();
    state.account = { id: 'second' }; view.rerender(app()); await settle(); expect(screen.getByLabelText('未读数')).toHaveTextContent('7');
    await act(async () => { resolveOld({ unreadCount: 88 }); }); expect(screen.getByLabelText('未读数')).toHaveTextContent('7');
    state.account = null; view.rerender(app()); await settle(); expect(screen.getByLabelText('未读数')).toHaveTextContent('unknown');
    expect(state.count).toHaveBeenCalledTimes(2);
  });
  it('does not show a failed request as zero and recovers on focus', async () => {
    state.count.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ unreadCount: 3 });
    render(app()); await settle(); expect(screen.getByLabelText('未读数')).toHaveTextContent('unknown');
    fireEvent.focus(window); await settle(); expect(screen.getByLabelText('未读数')).toHaveTextContent('3');
  });
  it('caps the visible badge while preserving the accessible unread count', async () => {
    state.count.mockResolvedValue({ unreadCount: 125 });
    render(<MemoryRouter><NotificationProvider><NotificationEntry /></NotificationProvider></MemoryRouter>); await settle();
    expect(screen.getByRole('link', { name: '消息中心，125 条未读' })).toHaveAttribute('href', '/messages');
    expect(screen.getByText('99+')).toBeVisible();
  });
});
