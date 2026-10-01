import { useEffect, useState } from 'react';
import { UsersRound, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import authService from '@/services/authService';

const openKey = 'dev-account-switch-open';
const endpoint = `${(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')}/v1/dev/accounts`;
interface Choice { id: string; name: string; role: string; email: string; volunteerCode: string | null; circles: string[] }
const roleLabels: Record<string, string> = { admin: '系统管理员', a_admin: '部长', b_admin: '录入员', user: '普通账号' };
async function request<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(endpoint + path, {
    method: body ? 'POST' : 'GET', signal, cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || result.error || '切换失败，请重试');
  return result.data;
}
export default function AccountSwitcher() {
  const { account } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(() => sessionStorage.getItem(openKey) === 'true');
  const [choices, setChoices] = useState<Choice[]>([]), [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void request<{ enabled: boolean }>('/enabled', undefined, controller.signal).then((data) => setEnabled(data.enabled)).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!enabled || !open) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = window.setTimeout(() => {
      void request<Choice[]>(`?search=${encodeURIComponent(search)}`, undefined, controller.signal)
        .then((rows) => { if (!controller.signal.aborted) setChoices(rows); })
        .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '请求失败，请重试'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [enabled, open, search, version]);
  if (!enabled) return null;
  const toggle = () => { sessionStorage.setItem(openKey, String(!open)); setOpen(!open); };
  return <aside className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 max-w-[calc(100vw-2rem)]" aria-label="开发账户切换">
    {open && <section className="mb-3 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-amber-500/40 bg-card shadow-xl" aria-label="账户切换面板">
      <header className="flex items-center justify-between gap-2 border-b border-border p-4"><div><h2 className="text-sm font-semibold">开发账户切换</h2><p className="mt-1 text-xs text-muted-foreground">仅本地开发 · 当前：{account?.name || '未登录'}</p></div><Button size="icon" variant="ghost" aria-label="收起账户切换" onClick={toggle}><X className="h-4 w-4" /></Button></header>
      <div className="space-y-3 p-4">
        {error && <p role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
        <div className="flex gap-2"><Input aria-label="搜索切换账号" placeholder="姓名、邮箱或志愿者 ID" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} disabled={busy} /><Button variant="outline" size="icon" aria-label="刷新账号列表" disabled={busy} onClick={() => setVersion((v) => v + 1)}><RefreshCw className="h-4 w-4" /></Button></div>
        <div className="max-h-[45dvh] space-y-2 overflow-y-auto" aria-label="可切换账号">
          {loading ? <p role="status" className="py-5 text-center text-xs text-muted-foreground">正在查找账号…</p> : !choices.length ? <p className="py-5 text-center text-xs text-muted-foreground">没有匹配的有效账号</p> : choices.map((choice) => <button type="button" key={choice.id} disabled={busy || account?.id === choice.id} aria-label={`切换到 ${choice.name} ${choice.role}`} className={`w-full rounded-xl border p-3 text-left transition hover:border-primary disabled:cursor-default disabled:opacity-60 ${account?.id === choice.id ? 'border-primary bg-primary/5' : 'border-border bg-background'}`} onClick={() => {
            setBusy(true); setError('');
            void request<{ token: string }>('/switch', { accountId: choice.id }).then(({ token }) => {
              authService.setToken(token);
              // Full navigation drops query caches, pending requests and form state.
              window.location.replace(window.location.pathname === '/login' ? '/forum' : window.location.href);
            }).catch((err) => { setError(err instanceof Error ? err.message : '切换失败，请重试'); setBusy(false); });
          }}><div className="flex items-start justify-between gap-2"><span className="break-words text-sm font-medium">{choice.name}</span><span className="shrink-0 text-[10px] text-muted-foreground">{account?.id === choice.id ? '当前' : roleLabels[choice.role] || choice.role}</span></div><p className="mt-1 break-all text-xs text-muted-foreground">{choice.volunteerCode ? `${choice.volunteerCode} · ` : ''}{choice.email}</p>{choice.circles.length > 0 && <p className="mt-1 break-words text-[11px] leading-5 text-muted-foreground">{choice.circles.join(' / ')}</p>}</button>)}
        </div>
        <p className="border-t border-border pt-2 text-[10px] text-muted-foreground">最多显示 50 个 · 直接切换，无需密码 · 切换会刷新页面</p>
      </div>
    </section>}
    <div className="flex justify-end"><Button className="gap-2 rounded-full border border-amber-500/40 bg-card text-foreground shadow-lg hover:bg-muted" aria-label="开发账号切换" aria-expanded={open} onClick={toggle}><UsersRound className="h-4 w-4" /><span className="text-xs">DEV · 切换账号</span></Button></div>
  </aside>;
}
