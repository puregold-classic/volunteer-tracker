import { createElement, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';
import { imageLayout } from './imageAnnotations';
import { PrivateImage } from './PrivateImage';
export const safeForumLink = (href: string) => { try { return ['http:', 'https:', 'mailto:'].includes(new URL(href).protocol); } catch { return false; } };
export function richText(node: JSONContent): string {
  return node.type === 'mention' ? `@${node.attrs?.label || '已注销'}` : node.type === 'text' ? node.text || '' : node.type === 'hardBreak' ? '\n' : (node.content || []).map(richText).join(['paragraph', 'heading'].includes(node.type || '') ? '' : '\n');
}
export function richImageCount(node: JSONContent): number { return (node.type === 'forumImage' ? 1 : 0) + (node.content || []).reduce((n, child) => n + richImageCount(child), 0); }
export function RichContent({ body, management = false }: { body: string; management?: boolean }) {
  let doc: JSONContent; try { doc = JSON.parse(body); if (doc.type !== 'doc') throw new Error(); } catch { return <p className="text-sm text-muted-foreground">内容暂不可用</p>; }
  const render = (node: JSONContent, key: string, depth = 0): ReactNode => {
    if (depth > 14) return null;
    if (node.type === 'text') {
      let content: ReactNode = node.text;
      for (const mark of node.marks || []) {
        const tags: Record<string, string> = { bold: 'strong', italic: 'em', underline: 'u', strike: 's' };
        if (tags[mark.type]) content = createElement(tags[mark.type], null, content);
        if (mark.type === 'link' && typeof mark.attrs?.href === 'string' && safeForumLink(mark.attrs.href)) content = <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer">{content}</a>;
      }
      return <span key={key}>{content}</span>;
    }
    if (node.type === 'mention') return <span key={key} className="rounded bg-primary/10 px-1 text-primary">@{node.attrs?.label || '已注销'}</span>;
    if (node.type === 'forumImage') return <figure key={key} className="my-4 max-w-full" style={imageLayout(node.attrs?.width, node.attrs?.align)}><PrivateImage imageId={String(node.attrs?.imageId || '')} alt={node.attrs?.alt} management={management} annotations={node.attrs?.annotations || []} /></figure>;
    if (node.type === 'hardBreak') return <br key={key} />;
    const children = node.content?.map((child, i) => render(child, `${key}-${i}`, depth + 1));
    if (node.type === 'doc') return <div key={key} className="forum-rich">{children}</div>;
    const tags: Record<string, string> = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li', heading: `h${[1, 2, 3].includes(node.attrs?.level) ? node.attrs?.level : 3}` };
    if (!tags[node.type || '']) return null;
    const textAlign = ['left', 'center', 'right', 'justify'].includes(node.attrs?.textAlign) ? node.attrs?.textAlign : undefined;
    return createElement(tags[node.type!], { key, style: { textAlign }, ...(node.type === 'orderedList' ? { start: node.attrs?.start || 1 } : {}) }, children);
  };
  return render(doc, 'doc');
}
