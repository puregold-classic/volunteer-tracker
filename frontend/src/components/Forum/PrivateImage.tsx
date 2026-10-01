import { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { forumImageService } from '@/services/forumImageService';
import { AnnotationLayer, type Annotation } from './imageAnnotations';
import { Dialog } from '@/components/ui/dialog';
export function PrivateImage({ imageId, alt = '图片', management = false, editing = false, annotations = [] }: { imageId: string; alt?: string; management?: boolean; editing?: boolean; annotations?: Annotation[] }) {
  const { account } = useAuth();
  const [state, setState] = useState<{ key: string; url?: string; error?: boolean }>({ key: '' });
  const [ratio, setRatio] = useState(0);
  const [open, setOpen] = useState(false);
  const key = `${account?.id}-${imageId}-${management}`;
  useEffect(() => {
    const controller = new AbortController(); let url: string | undefined;
    setState({ key }); setOpen(false); setRatio(0);
    void forumImageService.load(imageId, management, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob); setState({ key, url });
    }).catch(() => { if (!controller.signal.aborted) setState({ key, error: true }); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [key, imageId, management]);
  if (state.key !== key || !state.url) return <div className="my-3 flex min-h-24 items-center justify-center gap-2 rounded-xl bg-muted/40 text-sm text-muted-foreground">{state.error && state.key === key ? <><ImageOff className="h-4 w-4" />图片暂不可用</> : <><Loader2 className="h-4 w-4 animate-spin" />正在加载图片…</>}</div>;
  const picture = (zoom = false) => <div className="relative mx-auto w-full" style={zoom && ratio ? { maxWidth: `min(100%, ${75 * ratio}vh)` } : undefined}>
    <img src={state.url} alt={alt || '图片'} draggable={false} onLoad={e => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} className="block h-auto w-full rounded-xl" />
    {ratio > 0 && annotations.length > 0 && <AnnotationLayer marks={annotations} height={1000 / ratio} />}
  </div>;
  if (editing) return picture();
  return <><button type="button" aria-label="放大图片" className="block w-full cursor-zoom-in" onClick={() => setOpen(true)}>{picture()}</button><Dialog open={open} onOpenChange={setOpen} title="查看图片" className="sm:max-w-4xl">{picture(true)}</Dialog></>;
}
