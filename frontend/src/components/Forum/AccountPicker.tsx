import { useEffect, useState } from 'react';
import { Search, Check, X } from 'lucide-react';
import { FormInput } from '@/components/shared/form-fields';
import { forumService, forumError } from '@/services/forumService';
import type { ForumAccount } from '@/services/types';

export function AccountPicker({ value, onChange, circleId, multiple = false, disabled = false }: {
  value: ForumAccount[]; onChange: (accounts: ForumAccount[]) => void; circleId?: string; multiple?: boolean; disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ForumAccount[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      void forumService.candidates(search, circleId).then((data) => { if (!cancelled) setRows(data); })
        .catch((err) => { if (!cancelled) { setError(forumError(err)); setRows([]); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, circleId]);
  return <div className="space-y-2">
    <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><FormInput aria-label="查找账号" placeholder="按姓名或志愿者编号查找" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} disabled={disabled} /></div>
    {!!value.length && <div className="flex flex-wrap gap-2">{value.map((a) => <button key={a.accountId} type="button" disabled={disabled} onClick={() => onChange(value.filter((v) => v.accountId !== a.accountId))} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary" aria-label={`取消选择${a.name}`}>{a.name}<X className="h-3 w-3" /></button>)}</div>}
    <div className="max-h-48 overflow-y-auto rounded-xl border border-border" aria-label="账号搜索结果" aria-busy={loading}>
      {loading ? <p className="p-3 text-sm text-muted-foreground">正在查找…</p> : error ? <p className="p-3 text-sm text-destructive" role="alert">{error}</p> : !rows.length ? <p className="p-3 text-sm text-muted-foreground">没有找到有效账号，试试其他姓名或编号。</p> : rows.map((a) => {
        const selected = value.some((v) => v.accountId === a.accountId);
        return <button key={a.accountId} type="button" disabled={disabled} aria-pressed={selected} onClick={() => onChange(selected ? value.filter((v) => v.accountId !== a.accountId) : multiple ? [...value, a] : [a])} className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-muted disabled:opacity-50">
          <span>{a.name}<span className="ml-2 text-xs text-muted-foreground">{a.isSystemAdmin ? '系统管理员' : a.volunteerCode || a.accountId.slice(-6)}</span></span>{selected && <Check className="h-4 w-4 text-primary" />}
        </button>;
      })}
    </div>
  </div>;
}
