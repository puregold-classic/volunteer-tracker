import { normalizeAnnotations } from './forumAnnotations.js';
import { ForumError } from '../services/CircleService.js';
const fail = (message = '正文格式不正确') => { throw new ForumError(400, message); };
const blocks = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'forumImage']);
export const imageIds = (doc) => {
  const ids = [];
  const walk = (node) => { if (node.type === 'forumImage') ids.push(node.attrs.imageId); node.content?.forEach(walk); };
  walk(doc); return [...new Set(ids)];
};
export const documentText = (node) => node.type === 'mention' ? `@${node.attrs.label}` : node.type === 'text' ? node.text : node.type === 'hardBreak' ? '\n'
  : (node.content || []).map(documentText).join(['paragraph', 'heading'].includes(node.type) ? '' : '\n');
export function normalizeForumBody(body, bodyFormat = 'MARKDOWN', limit = 5000) {
  if (typeof body !== 'string' || !['MARKDOWN', 'RICH_TEXT'].includes(bodyFormat)) fail();
  if (bodyFormat === 'MARKDOWN') {
    if (!body.trim() || [...body.trim()].length > limit) fail(`正文不能为空，且最多 ${limit} 字`);
    return { body: body.trim(), bodyFormat, imageIds: [] };
  }
  if (body.length > 80_000) fail('排版过于复杂，请精简内容');
  let doc; try { doc = JSON.parse(body); } catch { fail(); }
  let count = 0, images = 0;
  const visit = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || Array.isArray(node) || ++count > 2500 || depth > 12) fail();
    const type = node.type, result = { type };
    if (type === 'text') {
      if (typeof node.text !== 'string' || !node.text.length) fail();
      result.text = node.text;
    } else if (type === 'mention') {
      if (typeof node.attrs?.accountId !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(node.attrs.accountId) || typeof node.attrs?.label !== 'string' || !node.attrs.label.trim() || [...node.attrs.label].length > 100) fail('提及账号格式不正确');
      result.attrs = { accountId: node.attrs.accountId, label: node.attrs.label.trim() };
    } else if (type === 'forumImage') {
      images++;
      if (typeof node.attrs?.imageId !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(node.attrs.imageId)) fail('图片引用不正确');
      const width = node.attrs?.width ?? 100;
      if (!Number.isFinite(width) || width < 10 || width > 100) fail();
      const align = node.attrs.align ?? 'left';
      if (!['left', 'center', 'right'].includes(align)) fail();
      result.attrs = { imageId: node.attrs.imageId, width: Math.round(width * 10) / 10, align, annotations: normalizeAnnotations(node.attrs.annotations), alt: typeof node.attrs.alt === 'string' ? node.attrs.alt.slice(0, 200) : '' };
    } else if (!['doc', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'hardBreak'].includes(type)) fail('包含不支持的排版');
    if (type === 'paragraph' || type === 'heading') {
      const textAlign = node.attrs?.textAlign || 'left';
      if (!['left', 'center', 'right', 'justify'].includes(textAlign)) fail();
      result.attrs = { textAlign };
      if (type === 'heading') { if (![1, 2, 3].includes(node.attrs?.level)) fail(); result.attrs.level = node.attrs.level; }
    }
    if (type === 'orderedList') {
      const start = node.attrs?.start ?? 1;
      if (!Number.isInteger(start) || start < 1 || start > 9999) fail();
      result.attrs = { start };
    }
    if (node.marks !== undefined) {
      if (!['text', 'hardBreak'].includes(type) || !Array.isArray(node.marks) || node.marks.length > 5) fail();
      result.marks = node.marks.map((mark) => {
        if (!['bold', 'italic', 'underline', 'strike', 'link'].includes(mark?.type)) fail();
        if (mark.type !== 'link') return { type: mark.type };
        let url; try { url = new URL(mark.attrs?.href); } catch { fail('链接地址不正确'); }
        if (!['http:', 'https:', 'mailto:'].includes(url.protocol) || url.href.length > 2048) fail('链接地址不正确');
        return { type: 'link', attrs: { href: url.href, target: '_blank', rel: 'noopener noreferrer' } };
      });
    }
    if (!['text', 'hardBreak', 'forumImage', 'mention'].includes(type)) {
      if (node.content !== undefined && !Array.isArray(node.content)) fail();
      const children = node.content || [];
      const allowed = type === 'doc' || type === 'listItem' ? blocks : ['bulletList', 'orderedList'].includes(type) ? new Set(['listItem']) : new Set(['text', 'hardBreak', 'mention']);
      if (children.some((child) => !allowed.has(child?.type))) fail();
      if (type === 'listItem' && children[0]?.type !== 'paragraph') fail();
      if (['doc', 'bulletList', 'orderedList'].includes(type) && !children.length) fail();
      result.content = children.map((child) => visit(child, depth + 1));
    } else if (node.content !== undefined) fail();
    return result;
  };
  if (doc?.type !== 'doc') fail();
  const normalized = visit(doc), text = documentText(normalized).trim(), ids = imageIds(normalized);
  if (!text && !ids.length) fail('请填写内容或插入图片');
  if ([...text].length > limit) fail(`正文最多 ${limit} 字`);
  if (images > 20) fail('最多插入 20 张图片');
  if (mentionIds(JSON.stringify(normalized), bodyFormat).length > 10) fail('每条内容最多提及 10 人');
  return { body: JSON.stringify(normalized), bodyFormat, imageIds: ids };
}
export function forumSummary(body, format) {
  if (format === 'RICH_TEXT') {
    try { const doc = JSON.parse(body); return [...documentText(doc).replace(/\s+/g, ' ').trim()].slice(0, 180).join('') || (imageIds(doc).length ? '[图片]' : ''); } catch { return ''; }
  }
  return [...body.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').replace(/[`#*_>~|]/g, '').replace(/\s+/g, ' ').trim()].slice(0, 180).join('');
}

export function mentionIds(body, format) {
  if (format !== 'RICH_TEXT') return [];
  const ids = new Set();
  const walk = node => { if (node.type === 'mention') ids.add(node.attrs.accountId); node.content?.forEach(walk); };
  try { walk(JSON.parse(body)); } catch { return []; }
  return [...ids];
}
