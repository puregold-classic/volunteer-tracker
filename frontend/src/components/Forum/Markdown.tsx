import { useMemo } from 'react';
import { RichContent } from './RichContent';
import type { ForumBodyFormat } from '@/services/types';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({ html: false, breaks: true, linkify: false }).disable('image');
md.validateLink = (link) => {
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(link, 'https://forum.invalid/').protocol); }
  catch { return false; }
};
md.renderer.rules.link_open = (tokens, index, options, _env, renderer) => {
  tokens[index].attrSet('rel', 'noopener noreferrer');
  tokens[index].attrSet('target', '_blank');
  return renderer.renderToken(tokens, index, options);
};
export const renderForumMarkdown = (body: string) => DOMPurify.sanitize(md.render(body), {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 's', 'a', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  ALLOWED_ATTR: ['href', 'title', 'rel', 'target', 'start'],
  ALLOW_DATA_ATTR: false,
});
export function Markdown({ body, bodyFormat = 'MARKDOWN', management = false }: { body: string; bodyFormat?: ForumBodyFormat; management?: boolean }) {
  const html = useMemo(() => bodyFormat === 'MARKDOWN' ? renderForumMarkdown(body) : '', [body, bodyFormat]);
  if (bodyFormat === 'RICH_TEXT') return <RichContent body={body} management={management} />;
  return <div className="forum-markdown min-w-0 break-words text-sm leading-7 [overflow-wrap:anywhere] [&_p]:my-3 [&_a]:text-primary [&_a]:underline [&_h1]:my-4 [&_h1]:text-2xl [&_h2]:my-4 [&_h2]:text-xl [&_h3]:my-3 [&_h3]:text-lg [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-xs [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2" dangerouslySetInnerHTML={{ __html: html }} />;
}
