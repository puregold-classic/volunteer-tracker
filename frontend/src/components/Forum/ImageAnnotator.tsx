import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { MousePointer2, Pencil, ArrowUpRight, Minus, RectangleHorizontal, Type, Undo2, Redo2, Trash2, Hand, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { forumImageService } from '@/services/forumImageService';
import { AnnotationShape, bounds, clamp, moveAnnotation, resizeAnnotation, type Annotation, type Point } from './imageAnnotations';
import { annotationDraftKey, clearAnnotationDraft, readAnnotationDraft, writeAnnotationDraft } from './annotationDraft';
import { constrainView, fitImage, zoomImage, type ImageViewport, type Viewport } from './annotationViewport';

type Tool = Annotation['kind'] | 'select' | 'pan';
type Gesture = { start: Point; before: Annotation[]; current: Annotation[]; target: number; mode: 'draw' | 'move' | 'resize' };
type NavigationGesture = { mode: 'pan'; point: Point; view: ImageViewport } | { mode: 'pinch'; midpoint: Point; distance: number; view: ImageViewport };
const tools = [['select', '选择与移动', MousePointer2], ['pan', '拖动画布', Hand], ['pen', '画笔', Pencil], ['arrow', '箭头', ArrowUpRight], ['line', '直线', Minus], ['rect', '圆角方框', RectangleHorizontal], ['text', '文字', Type]] as const;

export function ImageAnnotator({ imageId, management, initial, draftScope, onApply, onClose }: {
  imageId: string; management: boolean; initial: Annotation[]; draftScope?: string;
  onApply: (marks: Annotation[]) => void; onClose: () => void;
}) {
  const { account } = useAuth();
  const base = useRef(JSON.stringify(initial)).current;
  const storageKey = account && draftScope ? annotationDraftKey(account.id, draftScope, imageId) : undefined;
  const [restored] = useState(() => readAnnotationDraft(storageKey, base));
  const [url, setUrl] = useState(''), [error, setError] = useState('');
  const [imageSize, setImageSize] = useState<Viewport | null>(null);
  const [history, setHistory] = useState<Annotation[][]>([restored.draft?.marks || initial]);
  const [index, setIndex] = useState(0), [draft, setDraft] = useState<Annotation[] | null>(null);
  const [editing, setEditing] = useState<number | null>(restored.draft?.editing ?? null);
  const [tool, setTool] = useState<Tool>('arrow'), [selected, setSelected] = useState<number | null>(restored.draft?.editing ?? null);
  const [color, setColor] = useState('#e33b35'), [size, setSize] = useState(5), [fontSize, setFontSize] = useState(36);
  const [filled, setFilled] = useState(false), [textStyle, setTextStyle] = useState<NonNullable<Annotation['textStyle']>>('plain');
  const [storageError, setStorageError] = useState(restored.error), [saved, setSaved] = useState(!!restored.draft);
  const [viewport, setViewport] = useState<Viewport>({ width: 1, height: 1 });
  const [view, setView] = useState<ImageViewport>({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view); viewRef.current = view;
  const canvas = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), textInput = useRef<HTMLTextAreaElement>(null);
  const gesture = useRef<Gesture | null>(null), navigation = useRef<NavigationGesture | null>(null);
  const pointers = useRef(new Map<number, Point>()), spaceHeld = useRef(false), initialized = useRef(false);
  const lastPointerMark = useRef<number | null>(null);
  const editingRef = useRef(editing); editingRef.current = editing;
  const marks = draft || history[index], marksRef = useRef(marks); marksRef.current = marks;
  const chosen = selected === null ? undefined : marks[selected];
  const height = imageSize ? imageSize.height / imageSize.width * 1000 : 1000;
  const persist = (next: Annotation[], active: number | null = editingRef.current) => {
    if (!storageKey) return;
    try { writeAnnotationDraft(storageKey, base, next, active); setStorageError(''); setSaved(true); }
    catch { setStorageError('标注未保存到浏览器，请保留当前页面并应用标注。'); }
  };
  const commit = (next: Annotation[]) => {
    if (JSON.stringify(next).length > 30_000) { setError('标注较多，请删减后再绘制'); setDraft(null); return; }
    marksRef.current = next;
    setHistory(old => [...old.slice(0, index + 1), next].slice(-50)); setIndex(Math.min(index + 1, 49));
    setDraft(null); setError(''); persist(next, null);
  };
  const finishText = () => {
    if (editingRef.current === null) return marksRef.current;
    const edited = editingRef.current;
    const keepSelection = !!marksRef.current[edited]?.text?.trim();
    const next = marksRef.current.filter(mark => mark.kind !== 'text' || !!mark.text?.trim());
    editingRef.current = null; setEditing(null); setSelected(keepSelection ? edited : null); commit(next); return next;
  };
  const choose = (i: number) => {
    const mark = marksRef.current[i]; if (!mark) return;
    setSelected(i); setColor(mark.color);
    if (mark.kind === 'text') { setFontSize(mark.size); setTextStyle(mark.textStyle || 'plain'); } else setSize(mark.size);
    setFilled(!!mark.filled);
  };
  const changeChosen = (patch: Partial<Annotation>) => {
    if (selected !== null) commit(marksRef.current.map((mark, i) => i === selected ? moveAnnotation({ ...mark, ...patch }, 0, 0, height) : mark));
  };
  const updateView = (next: ImageViewport) => { viewRef.current = next; setView(next); };
  const zoomTo = (scale: number, anchor = { x: viewport.width / 2, y: viewport.height / 2 }) => {
    if (imageSize) updateView(zoomImage(viewRef.current, scale, anchor, imageSize, viewport));
  };
  const readableTextView = (mark: Annotation, current: ImageViewport) => {
    if (!imageSize) return current;
    const anchor = { x: current.x + mark.points[0].x * imageSize.width * current.scale, y: current.y + mark.points[0].y * imageSize.height * current.scale };
    const next = zoomImage(current, Math.max(current.scale, 16 * 1000 / (mark.size * imageSize.width)), anchor, imageSize, viewport);
    const box = bounds(mark, height), factor = imageSize.width * next.scale;
    const left = clamp(next.x + box.x * factor, 16, Math.max(16, viewport.width - (box.right - box.x) * factor - 16));
    const top = clamp(next.y + box.y * height / 1000 * factor, 16, Math.max(16, viewport.height - (box.bottom - box.y) * height / 1000 * factor - 16));
    return constrainView({ ...next, x: left - box.x * factor, y: top - box.y * height / 1000 * factor }, imageSize, viewport);
  };
  const beginText = (i: number) => {
    choose(i); setTool('select'); editingRef.current = i; setEditing(i);
    const mark = marksRef.current[i];
    if (mark) updateView(readableTextView(mark, viewRef.current));
    persist(marksRef.current, i);
  };
  useEffect(() => {
    let localUrl = ''; const controller = new AbortController();
    void forumImageService.load(imageId, management, controller.signal).then(blob => {
      if (controller.signal.aborted) return; localUrl = URL.createObjectURL(blob); setUrl(localUrl);
    }).catch(() => { if (!controller.signal.aborted) setError('图片加载失败，请关闭后重试'); });
    return () => { controller.abort(); if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [imageId, management]);
  useLayoutEffect(() => {
    if (!canvas.current) return;
    const measure = () => {
      const element = canvas.current!;
      setViewport({ width: element.clientWidth, height: element.clientHeight });
    };
    measure(); const observer = new ResizeObserver(measure); observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!imageSize || viewport.width <= 1) return;
    const next = initialized.current ? constrainView(viewRef.current, imageSize, viewport) : fitImage(imageSize, viewport);
    const activeText = editingRef.current === null ? null : marksRef.current[editingRef.current];
    updateView(activeText ? readableTextView(activeText, next) : next);
    initialized.current = true;
  }, [imageSize, viewport]);
  useEffect(() => {
    if (editing !== null && imageSize) textInput.current?.focus({ preventScroll: true });
  }, [editing, !!imageSize]);
  useEffect(() => {
    const element = canvas.current;
    if (!element || !imageSize) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest('[data-text-editor]')) return;
      event.preventDefault();
      if (gesture.current || pointers.current.size) return;
      const rect = element.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.height : 1);
      zoomTo(viewRef.current.scale * Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.002), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [imageSize, viewport]);
  const localPoint = (event: { clientX: number; clientY: number }): Point => {
    const box = canvas.current!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const imagePoint = (event: { clientX: number; clientY: number }): Point => {
    const box = svg.current!.getBoundingClientRect();
    return { x: Math.round(clamp((event.clientX - box.left) / box.width) * 10000) / 10000, y: Math.round(clamp((event.clientY - box.top) / box.height) * 10000) / 10000 };
  };
  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageSize || (event.target as Element).closest('[data-text-editor]') || ![0, 1].includes(event.button)) return;
    const hit = (event.target as Element).closest('[data-mark]')?.getAttribute('data-mark');
    lastPointerMark.current = hit == null ? null : Number(hit);
    event.preventDefault(); canvas.current?.focus({ preventScroll: true });
    const local = localPoint(event);
    pointers.current.set(event.pointerId, local);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size >= 2) {
      // A second finger starts navigation and rolls back the tentative stroke.
      gesture.current = null; setDraft(null); finishText();
      const [a, b] = [...pointers.current.values()];
      navigation.current = { mode: 'pinch', midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), view: viewRef.current };
      return;
    }
    const before = finishText();
    if (tool === 'pan' || event.button === 1 || spaceHeld.current || !(event.target as Element).closest('svg')) {
      navigation.current = { mode: 'pan', point: local, view: viewRef.current }; return;
    }
    const p = imagePoint(event);
    const target = (event.target as Element).closest('[data-mark]')?.getAttribute('data-mark');
    if (tool === 'select' || (tool === 'text' && target !== null && target !== undefined)) {
      if (target === undefined || target === null) { setSelected(null); return; }
      const i = Number(target); choose(i);
      if (tool === 'text' && before[i]?.kind === 'text') { beginText(i); return; }
      gesture.current = { start: p, before, current: before, target: i, mode: (event.target as Element).hasAttribute('data-resize') ? 'resize' : 'move' };
    } else {
      if (before.length >= 40) { setError('每张图片最多添加 40 个标注'); return; }
      const mark: Annotation = { kind: tool, color, size: tool === 'text' ? fontSize : size, points: tool === 'text' ? [p] : [p, p], ...(tool === 'rect' ? { filled } : {}), ...(tool === 'text' ? { text: '', width: 0.32, textStyle } : {}) };
      // Keep new text inside the image, including clicks near an edge.
      const placed = tool === 'text' ? moveAnnotation(mark, 0, 0, height) : mark;
      const next = [...before, placed]; marksRef.current = next; setSelected(before.length);
      if (tool === 'text') { setDraft(next); beginText(before.length); return; }
      gesture.current = { start: p, before, current: next, target: before.length, mode: 'draw' }; setDraft(next);
    }
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !imageSize) return;
    const local = localPoint(event); pointers.current.set(event.pointerId, local);
    const nav = navigation.current;
    if (nav) {
      if (nav.mode === 'pan') updateView(constrainView({ ...nav.view, x: nav.view.x + local.x - nav.point.x, y: nav.view.y + local.y - nav.point.y }, imageSize, viewport));
      else if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const zoomed = zoomImage(nav.view, nav.view.scale * Math.hypot(b.x - a.x, b.y - a.y) / nav.distance, nav.midpoint, imageSize, viewport);
        updateView(constrainView({ ...zoomed, x: zoomed.x + midpoint.x - nav.midpoint.x, y: zoomed.y + midpoint.y - nav.midpoint.y }, imageSize, viewport));
      }
      return;
    }
    const g = gesture.current; if (!g) return; const p = imagePoint(event);
    if (g.mode === 'move') g.current = g.before.map((mark, i) => i === g.target ? moveAnnotation(mark, p.x - g.start.x, p.y - g.start.y, height) : mark);
    else if (g.mode === 'resize') g.current = g.before.map((mark, i) => i === g.target ? resizeAnnotation(mark, p, height) : mark);
    else {
      const mark = g.current[g.target]; const points = mark.kind === 'pen' ? (mark.points.length < 300 ? [...mark.points, p] : [...mark.points.slice(0, -1), p]) : [g.start, p];
      g.current = [...g.before, { ...mark, points }];
    }
    setDraft(g.current);
  };
  const finish = (event: ReactPointerEvent<HTMLDivElement>, cancel = false) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (navigation.current) {
      if (pointers.current.size === 1) navigation.current = { mode: 'pan', point: [...pointers.current.values()][0], view: viewRef.current };
      else if (!pointers.current.size) navigation.current = null;
    } else {
      const g = gesture.current; gesture.current = null;
      if (g) {
        if (cancel) { setDraft(null); setSelected(null); }
        else if (JSON.stringify(g.current) !== JSON.stringify(g.before)) commit(g.current);
        else setDraft(null);
      }
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const close = () => { persist(marksRef.current, editingRef.current); onClose(); };
  const apply = () => {
    const next = finishText();
    try { clearAnnotationDraft(storageKey); } catch { setStorageError('临时标注未能清除，请检查浏览器存储设置。'); }
    onApply(next);
  };
  const undo = (nextIndex: number) => {
    finishText(); setDraft(null); setSelected(null); setIndex(nextIndex); marksRef.current = history[nextIndex]; persist(history[nextIndex], null);
  };
  const activeKind = chosen?.kind || tool;
  const effectiveSize = chosen?.size || (activeKind === 'text' ? fontSize : size);
  const textMark = editing === null ? null : marks[editing];
  const textBox = textMark ? bounds(textMark, height) : null;
  return createPortal(<Dialog open onOpenChange={open => { if (!open) close(); }} title="标注图片" description="滚轮或双指缩放，手掌工具拖动画布；文字可在图上直接编辑。" closeOnOutsideClick={false} className="sm:max-w-5xl" footer={<><Button type="button" variant="outline" onClick={close}>返回编辑</Button><Button type="button" disabled={!imageSize || (!!draft && editing === null)} onClick={apply}>应用标注</Button></>}>
    <div className="space-y-3">
      <div role="toolbar" aria-label="图片标注工具" className="flex flex-wrap gap-0 rounded-xl sm:gap-1 border border-border bg-muted/30 p-1.5">
        {tools.map(([value, label, Icon]) => <Button key={value} type="button" size="sm" aria-label={label} title={label} variant={tool === value ? 'secondary' : 'ghost'} aria-pressed={tool === value} onClick={() => { finishText(); setTool(value); setSelected(null); setError(''); }} className="px-2"><Icon className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">{label}</span></Button>)}
        <Button type="button" size="icon-sm" variant="ghost" aria-label="撤销标注" title="撤销标注" disabled={index === 0 || editing !== null} onClick={() => undo(index - 1)}><Undo2 className="h-4 w-4" /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="重做标注" title="重做标注" disabled={index === history.length - 1 || editing !== null} onClick={() => undo(index + 1)}><Redo2 className="h-4 w-4" /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="删除所选标注" title="删除所选标注" disabled={selected === null || editing !== null} onClick={() => { commit(marks.filter((_, i) => i !== selected)); setSelected(null); }}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">颜色<input aria-label="标注颜色" type="color" value={chosen?.color || color} onChange={event => { setColor(event.target.value); changeChosen({ color: event.target.value }); }} className="h-8 w-9 cursor-pointer rounded border border-border bg-transparent" /></label>
        <label className="flex items-center gap-2">{activeKind === 'text' ? '字号' : '粗细'}<input aria-label={activeKind === 'text' ? '标注字号' : '标注粗细'} type="range" min={activeKind === 'text' ? 12 : 1} max={activeKind === 'text' ? 96 : 24} value={effectiveSize} onChange={event => { const value = Number(event.target.value); if (activeKind === 'text') setFontSize(value); else setSize(value); changeChosen({ size: value }); }} className="w-20 accent-primary sm:w-28" /><span className="w-6 tabular-nums">{effectiveSize}</span></label>
        {activeKind === 'rect' && <label className="flex items-center gap-2">填充<select aria-label="方框填充" value={(chosen?.filled ?? filled) ? 'solid' : 'outline'} onChange={event => { setFilled(event.target.value === 'solid'); changeChosen({ filled: event.target.value === 'solid' }); }} className="rounded border border-border bg-background p-1"><option value="outline">空心</option><option value="solid">实心</option></select></label>}
        {activeKind === 'text' && <label className="flex items-center gap-2">文字样式<select aria-label="文字样式" value={chosen?.textStyle ?? textStyle} onChange={event => { const value = event.target.value as Annotation['textStyle']; setTextStyle(value!); changeChosen({ textStyle: value }); }} className="rounded border border-border bg-background p-1"><option value="plain">无底色</option><option value="background">浅色底</option><option value="outline">描边</option></select></label>}
        {chosen?.kind === 'text' && editing === null && <Button type="button" variant="outline" size="sm" onClick={() => beginText(selected!)}>编辑文字</Button>}
      </div>
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Button type="button" size="icon-sm" variant="ghost" aria-label="缩小画布" disabled={!imageSize} onClick={() => zoomTo(view.scale / 1.25)}><ZoomOut className="h-4 w-4" /></Button>
        <output aria-label="画布缩放比例" className="w-12 text-center tabular-nums">{Math.round(view.scale * 100)}%</output>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="放大画布" disabled={!imageSize} onClick={() => zoomTo(view.scale * 1.25)}><ZoomIn className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="sm" disabled={!imageSize} onClick={() => { if (imageSize) updateView(fitImage(imageSize, viewport)); }}>适应窗口</Button>
        <Button type="button" variant="ghost" size="sm" disabled={!imageSize} onClick={() => zoomTo(1)}>原始大小</Button>
      </div>
      <div ref={canvas} aria-label="图片标注视口" tabIndex={0} className={`relative h-[min(48dvh,28rem)] min-h-44 overflow-hidden rounded-xl border border-border bg-muted/40 touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary ${tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`} onPointerDown={start} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)} onDoubleClick={event => {
        if ((event.target as Element).closest('[data-text-editor]')) return;
        const target = (event.target as Element).closest('[data-mark]')?.getAttribute('data-mark');
        const hit = target == null ? lastPointerMark.current : Number(target);
        if (hit !== null && marksRef.current[hit]?.kind === 'text') beginText(hit);
      }} onKeyDown={event => {
        if ((event.target as Element).closest('[data-text-editor]')) return;
        if (event.code === 'Space') { event.preventDefault(); spaceHeld.current = true; }
        if ((event.key === 'Delete' || event.key === 'Backspace') && selected !== null) { event.preventDefault(); commit(marks.filter((_, i) => i !== selected)); setSelected(null); }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey && index < history.length - 1) undo(index + 1); else if (!event.shiftKey && index > 0) undo(index - 1); }
      }} onKeyUp={event => { if (event.code === 'Space') spaceHeld.current = false; }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) spaceHeld.current = false; }}>
        {!imageSize && !error && <p role="status" className="p-8 text-center text-muted-foreground">正在加载图片…</p>}
        {url && <div className="absolute left-0 top-0 origin-top-left select-none" style={imageSize ? { width: imageSize.width, height: imageSize.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` } : undefined}>
          <img src={url} alt="待标注图片" draggable={false} className="block h-full w-full" onLoad={event => { const image = event.currentTarget; setImageSize({ width: image.naturalWidth, height: image.naturalHeight }); }} onError={() => setError('图片加载失败，请关闭后重试')} />
          {imageSize && <svg ref={svg} role="application" aria-label="图片标注画布" viewBox={`0 0 1000 ${height}`} className="absolute inset-0 h-full w-full overflow-visible">
            {marks.map((mark, i) => <g key={i} data-mark={i} pointerEvents={tool === 'select' || tool === 'text' ? 'bounding-box' : 'none'} opacity={i === editing ? 0 : 1}><AnnotationShape mark={mark} height={height} /></g>)}
            {chosen && editing === null && (() => { const b = bounds(chosen, height), handle = 12 * 1000 / (imageSize.width * view.scale); return <g data-mark={selected}>
              <rect pointerEvents="none" x={b.x * 1000} y={b.y * height} width={Math.max(1, (b.right - b.x) * 1000)} height={Math.max(1, (b.bottom - b.y) * height)} fill="none" stroke="#2684ff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeDasharray="6 4" />
              {tool === 'select' && <rect data-resize="true" aria-label={chosen.kind === 'text' ? '调整文字框宽度' : '调整标注大小'} x={b.right * 1000 - handle / 2} y={b.bottom * height - handle / 2} width={handle} height={handle} fill="white" stroke="#2684ff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="cursor-nwse-resize" />}
            </g>; })()}
          </svg>}
          {textMark && textBox && imageSize && <textarea ref={textInput} data-text-editor aria-label="标注文字" value={textMark.text || ''} maxLength={200} placeholder="输入文字，可换行" className="absolute resize-none rounded-sm border border-primary bg-transparent text-left leading-[1.3] outline-none" style={{ left: `${textBox.x * 100}%`, top: `${textBox.y * 100}%`, width: `${(textBox.right - textBox.x) * 100}%`, height: Math.max(textMark.size * 2.7, (textBox.bottom - textBox.y) * height) * imageSize.width / 1000, color: textMark.color, fontFamily: 'sans-serif', lineHeight: 1.3, fontSize: textMark.size * imageSize.width / 1000, padding: 6 * imageSize.width / 1000 }} onChange={event => {
            const next = marksRef.current.map((mark, i) => i === editingRef.current ? moveAnnotation({ ...mark, text: event.target.value }, 0, 0, height) : mark);
            marksRef.current = next; setDraft(next); persist(next, editingRef.current);
          }} onBlur={() => finishText()} onKeyDown={event => {
            if (event.key === 'Escape' || ((event.ctrlKey || event.metaKey) && event.key === 'Enter')) { event.preventDefault(); event.stopPropagation(); finishText(); canvas.current?.focus({ preventScroll: true }); }
          }} />}
        </div>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p role="status" className={`text-xs ${storageError ? 'text-destructive' : 'text-muted-foreground'}`}>{storageError || (storageKey ? saved ? '标注进度已自动保存，应用后更新正文。' : '标注进度自动保存到当前浏览器，原图保留。' : '应用后保存到正文；此图片暂不单独保存标注进度。')}</p>
    </div>
  </Dialog>, document.body);
}
