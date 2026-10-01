import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, Upload, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { circleAssetService } from '@/services/circleAssetService';
import { forumError } from '@/services/forumService';
import type { CircleFile, ForumCircle } from '@/services/types';
import { useForumResource } from './useForumResource';
import { forumDate, ForumPagination } from './ForumCommon';
const accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.7z,.rar,.png,.jpg,.jpeg,.webp,.gif';
export const fileSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
export function CircleFiles({ circle, management = false }: { circle: ForumCircle; management?: boolean }) {
  const [page, setPage] = useState(1), [busy, setBusy] = useState(''), [error, setError] = useState(''), [removing, setRemoving] = useState<CircleFile | null>(null);
  const input = useRef<HTMLInputElement>(null), request = useRef<AbortController | null>(null);
  const load = useCallback(() => circleAssetService.list(circle.id, page, management), [circle.id, page, management]);
  const { data, loading, error: loadError, refresh } = useForumResource(load);
  useEffect(() => () => request.current?.abort(), []);
  const canManage = management && circle.capabilities.canManageAssets;
  const upload = async (file?: File) => {
    if (!file || busy) return;
    if (!file.size || file.size > 20 * 1024 * 1024) { setError('文件不能为空且不能超过 20 MB'); return; }
    if (!accept.split(',').includes(`.${file.name.split('.').pop()?.toLowerCase()}`)) { setError('请选择文档、表格、演示文稿、文本、压缩包或图片'); return; }
    const controller = new AbortController(); request.current = controller; setBusy('upload'); setError('');
    try { await circleAssetService.upload(circle.id, file, false, controller.signal); if (!controller.signal.aborted) { setPage(1); refresh(); } }
    catch (err) { if (!controller.signal.aborted) setError(forumError(err)); }
    finally { if (!controller.signal.aborted) setBusy(''); }
  };
  const download = async (file: CircleFile) => {
    const controller = new AbortController(); request.current = controller; setBusy(file.id); setError('');
    try {
      const blob = await circleAssetService.load(file.id, management, controller.signal); if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
      // Give the browser time to start the download before releasing the blob.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { if (!controller.signal.aborted) setError(forumError(err)); }
    finally { if (!controller.signal.aborted) setBusy(''); }
  };
  const change = async (file: CircleFile, restore = false) => {
    setBusy(file.id); setError('');
    try { await (restore ? circleAssetService.restore(file.id) : circleAssetService.remove(file.id)); setRemoving(null); refresh(); }
    catch (err) { setError(forumError(err)); }
    finally { setBusy(''); }
  };
  return <section aria-label="圈文件" className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-xl font-semibold">圈文件{data ? <span className="ml-2 text-sm text-muted-foreground">{data.total}</span> : null}</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">共享文档、表格、演示文稿、文本、压缩包和图片，单文件不超过 20 MB。</p></div>{canManage && <Button variant="outline" disabled={!!busy} onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />{busy === 'upload' ? '正在上传…' : '上传圈文件'}</Button>}<input ref={input} type="file" accept={accept} aria-label="选择圈文件" className="hidden" disabled={!canManage || !!busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} /></div>
    {loadError ? <div role="alert"><p>{loadError}</p><Button onClick={refresh} variant="outline">重试</Button></div> : loading ? <p role="status" className="py-5 text-sm text-muted-foreground">正在加载圈文件…</p> : <>
      {data?.data.length ? <ul className="divide-y divide-border">{data.data.map(file => <li key={file.id} className="flex flex-wrap items-center gap-3 py-4"><FileText className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1 basis-40"><p className="break-words text-sm font-medium">{file.name}{file.deletedAt && <span className="ml-2 text-xs font-normal text-muted-foreground">已移除</span>}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{fileSize(file.size)} · {file.uploader.name} · {forumDate(file.createdAt)}</p></div><div className="flex gap-1"><Button variant="ghost" size="sm" disabled={!!busy} aria-label={`下载 ${file.name}`} onClick={() => void download(file)}><Download className="mr-1 h-4 w-4" />{busy === file.id ? '处理中…' : '下载'}</Button>{canManage && (file.deletedAt ? <Button variant="ghost" size="sm" disabled={!!busy} aria-label={`恢复 ${file.name}`} onClick={() => void change(file, true)}><RotateCcw className="mr-1 h-4 w-4" />恢复</Button> : <Button variant="ghost" size="sm" disabled={!!busy} aria-label={`移除 ${file.name}`} onClick={() => { setError(''); setRemoving(file); }}><Trash2 className="mr-1 h-4 w-4" />移除</Button>)}</div></li>)}</ul> : <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">还没有圈文件</p>}
      <ForumPagination page={page} totalPages={data?.totalPages || 0} onPage={setPage} />
    </>}
    {error && !removing && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={!!removing} onOpenChange={open => { if (!open && !busy) setRemoving(null); }} title="移除圈文件" footer={<><Button variant="outline" disabled={!!busy} onClick={() => setRemoving(null)}>取消</Button><Button disabled={!!busy} onClick={() => removing && void change(removing)}>确认移除</Button></>}><p className="break-words text-sm leading-7">移除“{removing?.name}”后，普通成员无法查看或下载，圈务人员可在管理页恢复。</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</Dialog>
  </section>;
}
