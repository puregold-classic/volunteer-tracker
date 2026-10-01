import { useRef, useState, type MouseEvent } from 'react';
import { NodeViewWrapper, useEditorState, type NodeViewProps } from '@tiptap/react';
import { GapCursor } from '@tiptap/pm/gapcursor';
import { placeImageCaret } from './forumImageCursor';
import { PrivateImage } from './PrivateImage';
import { clamp, imageLayout } from './imageAnnotations';
export function ForumImageView({ node, selected, extension, editor, updateAttributes, getPos }: NodeViewProps) {
  const { caret, position } = useEditorState({ editor, selector: ({ editor }) => ({ caret: editor.state.selection instanceof GapCursor ? editor.state.selection.from : null, position: getPos() }) });
  const [preview, setPreview] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; width: number; height: number; container: number; value: number } | null>(null);
  return <NodeViewWrapper className={`relative my-4 max-w-full rounded-xl ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}`} style={imageLayout(preview ?? node.attrs.width, node.attrs.align)} contentEditable={false} data-drag-handle onClick={(e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button') || !editor.isEditable) return;
    const position = getPos(); if (typeof position === 'number') editor.chain().focus().setNodeSelection(position).run();
  }}>
    <PrivateImage imageId={node.attrs.imageId} alt={node.attrs.alt} management={extension.options.management} editing annotations={node.attrs.annotations || []} />
    {(['before', 'after'] as const).map(side => {
      const target = typeof position === 'number' ? position + (side === 'after' ? node.nodeSize : 0) : undefined;
      const active = target !== undefined && caret === target;
      return <button key={side} type="button" tabIndex={-1} aria-label={side === 'before' ? '将光标放到图片前' : '将光标放到图片后'} title={side === 'before' ? '图片前：Enter 插入空行' : '图片后：Enter 进入下一行'} aria-pressed={active} className={`forum-image-caret absolute top-0 bottom-2 z-10 flex w-4 cursor-text items-center justify-center rounded-sm hover:bg-primary/10 ${side === 'before' ? '-left-4' : '-right-4'}`} onMouseDown={e => e.preventDefault()} onClick={e => {
        e.stopPropagation(); const current = getPos();
        if (typeof current === 'number') placeImageCaret(editor, current + (side === 'after' ? node.nodeSize : 0));
      }}><span className={`h-6 border-l-2 ${active ? 'border-primary' : 'border-transparent'}`} /></button>;
    })}
    {selected && <button type="button" aria-label="从右下角等比例缩放图片" title="拖动缩放；方向键微调" className="absolute -right-2 -bottom-2 z-20 h-5 w-5 touch-none cursor-nwse-resize rounded border-2 border-primary bg-card shadow" onDragStart={e => e.preventDefault()} onPointerDown={e => {
      e.preventDefault(); e.stopPropagation();
      if (!editor.isEditable) return;
      const box = e.currentTarget.parentElement!.getBoundingClientRect();
      drag.current = { x: e.clientX, y: e.clientY, width: box.width, height: box.height, container: box.width / (node.attrs.width / 100), value: node.attrs.width };
      e.currentTarget.setPointerCapture(e.pointerId);
    }} onPointerMove={e => {
      const g = drag.current; if (!g) return; e.preventDefault(); e.stopPropagation();
      const dx = e.clientX - g.x, dy = (e.clientY - g.y) * g.width / g.height;
      const change = Math.abs(dx) >= Math.abs(dy) ? dx * (node.attrs.align === 'center' ? 2 : 1) : dy;
      g.value = Math.round(clamp((g.width + change) / g.container * 100, 10, 100) * 10) / 10;
      setPreview(g.value);
    }} onPointerUp={e => { e.preventDefault(); e.stopPropagation(); if (drag.current) updateAttributes({ width: drag.current.value }); drag.current = null; setPreview(null); }} onPointerCancel={() => { drag.current = null; setPreview(null); }} onLostPointerCapture={() => { drag.current = null; setPreview(null); }} onKeyDown={e => {
      if (editor.isEditable && ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); updateAttributes({ width: clamp(node.attrs.width + (['ArrowRight', 'ArrowUp'].includes(e.key) ? 1 : -1), 10, 100) }); }
    }} />}
  </NodeViewWrapper>;
}
