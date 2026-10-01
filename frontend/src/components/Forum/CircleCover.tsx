import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, UsersRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { circleAssetService } from '@/services/circleAssetService';
import { forumError } from '@/services/forumService';
import type { ForumCircle } from '@/services/types';
export function CircleCover({ id, name, management = false, card = false, icon = false }: { id: string; name: string; management?: boolean; card?: boolean; icon?: boolean }) {
  const { account } = useAuth();
  const key = `${account?.id}-${id}-${management}`;
  const [state, setState] = useState<{ key: string; url?: string; error?: boolean }>({ key: '' });
  useEffect(() => {
    const controller = new AbortController(); let url = '';
    setState({ key });
    void circleAssetService.load(id, management, controller.signal).then(blob => {
      if (controller.signal.aborted) return; url = URL.createObjectURL(blob); setState({ key, url });
    }).catch(() => { if (!controller.signal.aborted) setState({ key, error: true }); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [id, key, management]);
  return <div className={`flex items-center justify-center overflow-hidden bg-primary/10 ${icon ? 'h-10 w-10 shrink-0 rounded-xl' : `w-full ${card ? 'aspect-[16/7]' : 'aspect-[3/1] sm:aspect-[4/1]'}`}`}>
    {state.key === key && state.url ? <img src={state.url} alt={`${name}的封面`} className="h-full w-full object-cover" /> : icon ? <UsersRound aria-hidden="true" className="h-5 w-5 text-primary" /> : <span className="text-xs text-muted-foreground">{state.error && state.key === key ? '封面暂不可用' : '正在加载封面…'}</span>}
  </div>;
}
export function CircleCoverSettings({ circle, onChange }: { circle: ForumCircle; onChange: (id: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null), controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => () => controller.current?.abort(), []);
  const upload = async (file?: File) => {
    if (!file || busy) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('请选择 10 MB 以内的 PNG、JPEG、WebP 或 GIF 图片'); return; }
    const request = new AbortController(); controller.current = request; setBusy(true); setError('');
    try { const result = await circleAssetService.upload(circle.id, file, true, request.signal); if (!request.signal.aborted) onChange(result.id); }
    catch (err) { if (!request.signal.aborted) setError(forumError(err)); }
    finally { if (!request.signal.aborted) setBusy(false); }
  };
  return <section aria-label="圈子封面设置" className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div><h2 className="font-serif text-xl font-semibold">圈子封面</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">建议使用横向图片，重要内容放在中央。支持 PNG、JPEG、WebP、GIF，每张不超过 10 MB。</p></div>
    {circle.coverId ? <div className="overflow-hidden rounded-xl"><CircleCover id={circle.coverId} name={circle.name} management /></div> : <div className="flex h-28 items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">还没有设置封面</div>}
    {circle.capabilities.canManageAssets && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />{busy ? '正在处理…' : circle.coverId ? '更换封面' : '上传封面'}</Button>{circle.coverId && <Button variant="ghost" disabled={busy} onClick={() => { setBusy(true); setError(''); void circleAssetService.remove(circle.coverId!).then(() => onChange(null)).catch(err => setError(forumError(err))).finally(() => setBusy(false)); }}>移除封面</Button>}<input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="选择圈子封面" className="hidden" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} /></div>}
    {busy && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />正在保存封面…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
