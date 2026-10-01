import { useEffect, useRef, useState } from 'react';
import { Node, mergeAttributes, type Editor, type JSONContent } from '@tiptap/core';
import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link2, ImagePlus, Smile, Undo2, Redo2, RemoveFormatting, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { renderForumMarkdown } from './Markdown';
import { ForumMention, useForumMentions } from './ForumMention';
import { ForumImageCursor } from './forumImageCursor';
import { ForumImageView } from './ForumImageView';
import { ImageAnnotator } from './ImageAnnotator';
import { richText, richImageCount, safeForumLink } from './RichContent';
import { forumImageService } from '@/services/forumImageService';
import { forumError } from '@/services/forumService';
import type { ForumBodyFormat } from '@/services/types';
const ForumImage = Node.create({
  name: 'forumImage', group: 'block', atom: true, draggable: true,
  addOptions: () => ({ management: false }),
  addAttributes: () => ({ imageId: { default: null, parseHTML: (el) => el.getAttribute('data-forum-image-id') }, alt: { default: '' }, width: { default: 100, parseHTML: (el) => Number(el.getAttribute('data-width')) || 100 }, align: { default: 'left' }, annotations: { default: [], rendered: false } }),
  parseHTML: () => [{ tag: 'figure[data-forum-image-id]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['figure', mergeAttributes(HTMLAttributes, { 'data-forum-image-id': node.attrs.imageId, 'data-width': node.attrs.width })],
  addNodeView: () => ReactNodeViewRenderer(ForumImageView),
});
const initialContent = (body: string, format: ForumBodyFormat) => {
  if (format === 'RICH_TEXT') { try { return JSON.parse(body) as JSONContent; } catch { return ''; } }
  return renderForumMarkdown(body);
};
export function RichTextEditor({ initialBody, initialFormat, circleId, management = false, annotationScope, label, limit, disabled, onChange, onUploading }: {
  initialBody: string; initialFormat: ForumBodyFormat; circleId: string; management?: boolean; annotationScope?: string;
  label: string; limit: number; disabled: boolean; onChange: (body: string, valid: boolean) => void; onUploading: (uploading: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false), [error, setError] = useState(''), [emoji, setEmoji] = useState(false), [linkOpen, setLinkOpen] = useState(false), [href, setHref] = useState('');
  const [annotating, setAnnotating] = useState<{ position: number; imageId: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null), lock = useRef(false);
  const maxImages = 20;
  const publish = (instance: Editor) => {
    const doc = instance.getJSON(), text = richText(doc).trim(), images = richImageCount(doc);
    onChange(JSON.stringify(doc), (!!text || images > 0) && [...text].length <= limit && images <= maxImages);
  };
  const insertImages = async (instance: Editor, files: File[], position?: number) => {
    if (lock.current || disabled || !files.length) return;
    if (richImageCount(instance.getJSON()) + files.length > maxImages) { setError(`最多插入 ${maxImages} 张图片`); return; }
    if (files.some((file) => !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024)) { setError('请选择 10 MB 以内的 PNG、JPEG、WebP 或 GIF 图片'); return; }
    const insertAt = position ?? instance.state.selection.from;
    lock.current = true; setUploading(true); onUploading(true); setError(''); instance.setEditable(false);
    try {
      const images = [];
      for (const file of files) images.push(await forumImageService.upload(circleId, file));
      if (!instance.isDestroyed) instance.chain().focus().insertContentAt(insertAt, images.map((image) => ({ type: 'forumImage', attrs: { imageId: image.id, alt: '', width: 100 } }))).run();
    } catch (err) { if (!instance.isDestroyed) setError(forumError(err)); }
    finally { lock.current = false; if (!instance.isDestroyed) { setUploading(false); onUploading(false); instance.setEditable(!disabled); } }
  };
  const editor: Editor | null = useEditor({
    extensions: [ForumMention, ForumImageCursor, StarterKit.configure({ heading: { levels: [1, 2, 3] }, blockquote: false, code: false, codeBlock: false, horizontalRule: false,
      link: { openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: (url) => safeForumLink(url) } }), TextAlign.configure({ types: ['heading', 'paragraph'] }), ForumImage.configure({ management })],
    content: initialContent(initialBody, initialFormat), editable: !disabled, immediatelyRender: true, shouldRerenderOnTransaction: true,
    enableInputRules: false, enablePasteRules: false,
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': label, 'aria-multiline': 'true', class: `forum-rich forum-rich-editor min-w-0 px-5 py-4 outline-none sm:px-6 ${label === '评论' ? 'min-h-40' : 'min-h-72'}` },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.length) return false;
        event.preventDefault(); if (editor) void insertImages(editor, files); return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files || []);
        if (moved || !files.length) return false;
        event.preventDefault(); const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        if (editor) void insertImages(editor, files, position); return true;
      },
    },
    onCreate: ({ editor: instance }) => publish(instance), onUpdate: ({ editor: instance }) => publish(instance),
  });
  useEffect(() => { editor?.setEditable(!disabled && !uploading); }, [editor, disabled, uploading]);
  const mentions = useForumMentions(editor, circleId, disabled || uploading);
  if (!editor) return <p className="text-sm text-muted-foreground">正在准备编辑器…</p>;
  const alignImageOrText = (align: string) => editor.isActive('forumImage') ? editor.chain().focus().updateAttributes('forumImage', { align }).run() : editor.chain().focus().setTextAlign(align).run();
  const isAligned = (align: string) => editor.isActive('forumImage') ? editor.getAttributes('forumImage').align === align : editor.isActive({ textAlign: align });
  // An image can be copied within a document. Reusing its id must not restore
  // another occurrence's unfinished marks, and positions change as text is edited.
  let annotationOccurrences = 0;
  if (annotating) editor.state.doc.descendants(node => { if (node.type.name === 'forumImage' && node.attrs.imageId === annotating.imageId) annotationOccurrences += 1; });
  const annotationDraftScope = annotationOccurrences === 1 ? annotationScope : undefined;
  const doc = editor.getJSON(), count = [...richText(doc).trim()].length, images = richImageCount(doc), unavailable = disabled || uploading;
  const tool = (name: string, icon: React.ReactNode, run: () => void, active = false, cannot = false) => <Button type="button" size="icon-sm" variant={active ? 'secondary' : 'ghost'} aria-label={name} title={name} aria-pressed={active} disabled={unavailable || cannot} onMouseDown={(e) => e.preventDefault()} onClick={run}>{icon}</Button>;
  return <div className="min-w-0 space-y-2" onKeyDownCapture={mentions.onKeyDownCapture}>
    <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{label}</span><span className={`text-xs tabular-nums ${count > limit ? 'text-destructive' : 'text-muted-foreground'}`}>{count} / {limit}{images > 0 && ` · ${images} 张图片`}</span></div>
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
      <div role="toolbar" aria-label={`${label}排版工具`} className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/35 p-2">
        <select aria-label="段落样式" disabled={unavailable} className="h-8 max-w-28 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-primary/30" value={[1, 2, 3].find((level) => editor.isActive('heading', { level })) || 'paragraph'} onChange={(e) => { const value = e.target.value; if (value === 'paragraph') editor.chain().focus().setParagraph().run(); else editor.chain().focus().setHeading({ level: Number(value) as 1 | 2 | 3 }).run(); }}><option value="paragraph">正文</option><option value="1">标题 1</option><option value="2">标题 2</option><option value="3">标题 3</option></select>
        <span className="mx-1 h-5 border-l border-border" />
        {tool('加粗', <Bold className="h-4 w-4" />, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {tool('斜体', <Italic className="h-4 w-4" />, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        {tool('下划线', <Underline className="h-4 w-4" />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
        {tool('清除格式', <RemoveFormatting className="h-4 w-4" />, () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
        <span className="mx-1 h-5 border-l border-border" />
        {tool('无序列表', <List className="h-4 w-4" />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {tool('有序列表', <ListOrdered className="h-4 w-4" />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        {tool('左对齐', <AlignLeft className="h-4 w-4" />, () => alignImageOrText('left'), isAligned('left'))}
        {tool('居中', <AlignCenter className="h-4 w-4" />, () => alignImageOrText('center'), isAligned('center'))}
        {tool('右对齐', <AlignRight className="h-4 w-4" />, () => alignImageOrText('right'), isAligned('right'))}
        <span className="mx-1 h-5 border-l border-border" />
        {tool('链接', <Link2 className="h-4 w-4" />, () => { setHref(editor.getAttributes('link').href || ''); setLinkOpen(!linkOpen); }, editor.isActive('link'))}
        {tool('插入图片', <ImagePlus className="h-4 w-4" />, () => fileInput.current?.click(), false, images >= maxImages)}
        {tool('表情', <Smile className="h-4 w-4" />, () => setEmoji(!emoji), emoji)}
        <span className="inline-flex gap-1">
          {tool('撤销', <Undo2 className="h-4 w-4" />, () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
          {tool('重做', <Redo2 className="h-4 w-4" />, () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
        </span>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" aria-label="选择图片" disabled={unavailable} onChange={(e) => { void insertImages(editor, Array.from(e.target.files || [])); e.target.value = ''; }} />
      </div>
      {linkOpen && <div className="flex flex-wrap items-center gap-2 border-b border-border p-3"><Input aria-label="链接地址" value={href} disabled={unavailable} onChange={(e) => setHref(e.target.value)} placeholder="https://…" className="min-w-0 flex-1" /><Button type="button" size="sm" disabled={unavailable} onClick={() => { const url = href.trim(); if (!safeForumLink(url)) { setError('请输入以 https://、http:// 或 mailto: 开头的链接'); return; } editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run(); setLinkOpen(false); setError(''); }}>应用链接</Button><Button type="button" size="sm" variant="ghost" disabled={unavailable} onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); }}>移除链接</Button></div>}
      {emoji && <div aria-label="常用表情" className="flex flex-wrap gap-1 border-b border-border p-2">{['😊', '👍', '❤️', '🎉', '🙏', '🌱', '✨', '🤝', '💡', '👏', '💪', '☕'].map((e) => <button type="button" key={e} disabled={unavailable} aria-label={`插入 ${e}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { editor.chain().focus().insertContent(e).run(); setEmoji(false); }} className="rounded-lg p-2 text-xl hover:bg-muted">{e}</button>)}</div>}
      {editor.isActive('forumImage') && <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground"><span>右下角缩放 · Enter 换行</span><Button type="button" size="sm" variant="ghost" disabled={unavailable} onClick={() => setAnnotating({ position: editor.state.selection.from, imageId: editor.getAttributes('forumImage').imageId })}>标注图片</Button><Button type="button" size="sm" variant="ghost" disabled={unavailable} onClick={() => editor.chain().focus().deleteSelection().run()}>移除图片</Button></div>}
      <EditorContent editor={editor} className="max-h-[32dvh] overflow-y-auto overscroll-contain sm:max-h-[40dvh]" />
      {mentions.panel}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/15 px-4 py-2 text-xs text-muted-foreground"><span>{uploading ? <span role="status" className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />正在上传图片…</span> : '输入 @ 提及用户，也可粘贴或拖入图片'}</span><span>每张 ≤ 10 MB · 最多 {maxImages} 张</span></div>
    </div>
    {annotating && <ImageAnnotator imageId={annotating.imageId} management={management} draftScope={annotationDraftScope} initial={editor.state.doc.nodeAt(annotating.position)?.attrs.annotations || []} onClose={() => setAnnotating(null)} onApply={(annotations) => {
      const node = editor.state.doc.nodeAt(annotating.position);
      if (node?.type.name === 'forumImage' && node.attrs.imageId === annotating.imageId) editor.chain().focus().setNodeSelection(annotating.position).updateAttributes('forumImage', { annotations }).run();
      setAnnotating(null);
    }} />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
