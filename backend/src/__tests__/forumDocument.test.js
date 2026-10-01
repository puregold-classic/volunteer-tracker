import { describe, it, expect } from 'vitest';
import { normalizeForumBody, forumSummary } from '../utils/forumDocument.js';
import { normalizeAnnotations } from '../utils/forumAnnotations.js';
import { compressForumImage } from '../services/ForumImageService.js';
import sharp from 'sharp';
const doc = (content) => JSON.stringify({ type: 'doc', content });
const p = (text, marks) => ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] });
const image = { type: 'forumImage', attrs: { imageId: 'image_12345' } };
describe('forum rich document boundary', () => {
  it('accepts headings, lists and marks, counts Unicode text independently of formatting', () => {
    const body = doc([{ type: 'heading', attrs: { level: 3, textAlign: 'center', onclick: 'bad' }, content: [{ type: 'text', text: '标题' }] }, { type: 'orderedList', attrs: { start: 2 }, content: [{ type: 'listItem', content: [p('😊', [{ type: 'bold' }, { type: 'underline' }])] }] }]);
    const normalized = normalizeForumBody(body, 'RICH_TEXT');
    expect(normalized.body).not.toContain('onclick');
    expect(forumSummary(normalized.body, normalized.bodyFormat)).toBe('标题 😊');
    expect(() => normalizeForumBody(doc([p('😊'.repeat(1000), [{ type: 'bold' }])]), 'RICH_TEXT', 1000)).not.toThrow();
    expect(() => normalizeForumBody(doc([p('😊'.repeat(1001))]), 'RICH_TEXT', 1000)).toThrow(/1000/);
  });
  it('accepts image-only content and rejects too many occurrences, even with repeated IDs', () => {
    expect(normalizeForumBody(doc([image]), 'RICH_TEXT').imageIds).toEqual(['image_12345']);
    expect(forumSummary(doc([image]), 'RICH_TEXT')).toBe('[图片]');
    for (const limit of [1000, 5000]) {
      expect(() => normalizeForumBody(doc(Array(20).fill(image)), 'RICH_TEXT', limit)).not.toThrow();
      expect(() => normalizeForumBody(doc(Array(21).fill(image)), 'RICH_TEXT', limit)).toThrow(/20/);
    }
    expect(() => normalizeForumBody(doc([{ ...image, attrs: { imageId: 123456789 } }]), 'RICH_TEXT')).toThrow();
    expect(() => normalizeForumBody(doc([{ type: 'paragraph' }]), 'RICH_TEXT')).toThrow(/内容/);
  });
  it.each(['javascript:alert(1)', 'data:text/html,bad', 'file:///etc/passwd', '//evil.test/image'])('rejects unsafe link %s', (href) => {
    expect(() => normalizeForumBody(doc([p('点击', [{ type: 'link', attrs: { href } }])]), 'RICH_TEXT')).toThrow(/链接/);
  });
  it('normalizes safe links and rejects raw HTML nodes, remote images, bad nesting and unknown formats', () => {
    expect(normalizeForumBody(doc([p('点击', [{ type: 'link', attrs: { href: 'https://example.com', onclick: 'bad' } }])]), 'RICH_TEXT').body).toContain('noopener noreferrer');
    for (const node of [{ type: 'script', text: 'bad' }, { type: 'image', attrs: { src: 'https://evil.test/pixel' } }, { type: 'blockquote', content: [p('引用')] }, { type: 'heading', attrs: { level: 4 } }, { type: 'paragraph', content: [p('嵌套')] }]) expect(() => normalizeForumBody(doc([node]), 'RICH_TEXT')).toThrow();
    expect(() => normalizeForumBody('bad', 'HTML')).toThrow();
    expect(() => normalizeForumBody('{', 'RICH_TEXT')).toThrow();
  });
  it('preserves continuous image sizes, alignment and editable annotations', () => {
    const annotation = { kind: 'arrow', color: '#e33b35', size: 5, points: [{ x: 0.1, y: 0.2 }, { x: 0.7, y: 0.8 }], onclick: 'bad' };
    const value = normalizeForumBody(doc([{ ...image, attrs: { ...image.attrs, width: 47.5, align: 'center', annotations: [annotation] } }]), 'RICH_TEXT');
    const attrs = JSON.parse(value.body).content[0].attrs;
    expect(attrs).toMatchObject({ width: 47.5, align: 'center', annotations: [{ kind: 'arrow', color: '#e33b35' }] });
    expect(value.body).not.toContain('onclick');
  });
  it('rejects malformed or unbounded annotation payloads and invalid image layout', () => {
    const annotation = { kind: 'rect', color: '#e33b35', size: 5, points: [{ x: 0.1, y: 0.2 }, { x: 0.7, y: 0.8 }] };
    for (const patch of [{ kind: 'script' }, { color: 'url(https://evil.test)' }, { size: 1000 }, { points: [{ x: -1, y: 0 }] }, { filled: 'yes' }, { kind: 'text', points: [{ x: 0, y: 0 }], size: 36, text: '' }]) {
      expect(() => normalizeForumBody(doc([{ ...image, attrs: { ...image.attrs, annotations: [{ ...annotation, ...patch }] } }]), 'RICH_TEXT')).toThrow();
    }
    for (const attrs of [{ width: 101 }, { width: '50' }, { align: 'absolute' }, { annotations: Array(41).fill(annotation) }]) expect(() => normalizeForumBody(doc([{ ...image, attrs: { ...image.attrs, ...attrs } }]), 'RICH_TEXT')).toThrow();
  });
  it('preserves legacy Markdown and distinguishes a plain JSON-looking post from a rich document', () => {
    expect(normalizeForumBody(' **旧内容** ')).toMatchObject({ body: '**旧内容**', bodyFormat: 'MARKDOWN' });
    expect(normalizeForumBody(doc([p('JSON示例')])).bodyFormat).toBe('MARKDOWN');
    expect(forumSummary('## 老帖子\n**正文**')).toBe('老帖子 正文');
  });
});
describe('private image conversion', () => {
  it('decodes, resizes and reencodes pixels without retaining EXIF', async () => {
    const input = await sharp({ create: { width: 2400, height: 30, channels: 3, background: '#b97325' } }).jpeg().withMetadata({ exif: { IFD0: { Artist: 'private-person' } } }).toBuffer();
    const result = await compressForumImage(input), metadata = await sharp(result.data).metadata();
    expect(result.width).toBe(1920); expect(result.mimeType).toBe('image/webp');
    expect(metadata.format).toBe('webp'); expect(metadata.exif).toBeUndefined();
    expect(result.data.includes(Buffer.from('private-person'))).toBe(false);
  });
  it('rejects SVG, forged bytes and oversized input', async () => {
    for (const input of [Buffer.from('<svg/>'), Buffer.from([255, 216, 255, 0]), Buffer.alloc(10 * 1024 * 1024 + 1)]) await expect(compressForumImage(input)).rejects.toMatchObject({ status: 400 });
  });
});

it('bounds and sanitizes account mentions and includes names in summaries', () => {
  const mention = { type: 'mention', attrs: { accountId: 'account_123', label: '张三', onclick: 'bad' } };
  const value = normalizeForumBody(doc([{ type: 'paragraph', content: [mention] }]), 'RICH_TEXT');
  expect(forumSummary(value.body, value.bodyFormat)).toBe('@张三');
  expect(value.body).not.toContain('onclick');
  expect(() => normalizeForumBody(doc([{ type: 'paragraph', content: Array.from({ length: 11 }, (_, i) => ({ ...mention, attrs: { accountId: `account_${i}`, label: '张三' } })) }]), 'RICH_TEXT')).toThrow(/10/);
  expect(() => normalizeForumBody(doc([{ type: 'paragraph', content: [{ ...mention, attrs: { accountId: '../../invalid', label: '张三' } }] }]), 'RICH_TEXT')).toThrow(/提及/);
});


describe('annotation text box validation', () => {
  const text = { kind: 'text', color: '#e33b35', size: 24, points: [{ x: 0.1, y: 0.2 }], text: '第一行\r\n第二行' };
  it('preserves text width, style and multiline content through forum document normalization', () => {
    for (const textStyle of ['plain', 'background', 'outline']) {
      const body = doc([{ ...image, attrs: { ...image.attrs, annotations: [{ ...text, width: 0.345678, textStyle, onclick: 'bad' }] } }]);
      const value = JSON.parse(normalizeForumBody(body, 'RICH_TEXT').body).content[0].attrs.annotations[0];
      expect(value).toEqual({ ...text, text: '第一行\n第二行', width: 0.3457, textStyle });
    }
  });
  it('preserves legacy marks without requiring text box fields', () => {
    const [normalized] = normalizeAnnotations([text]);
    expect(normalized).toEqual({ ...text, text: '第一行\n第二行' });
    expect(normalized).not.toHaveProperty('width');
    expect(normalized).not.toHaveProperty('textStyle');
  });
  it.each([0, 0.0399, 1.01, -1, NaN, Infinity, '0.4', null])('rejects invalid text width %s', (width) => {
    expect(() => normalizeAnnotations([{ ...text, width }])).toThrow(/标注/);
  });
  it.each(['url(https://example.test/image)', '#fff', 'red', null, 'rgba(0,0,0,1)'])('rejects unsafe or unsupported text color %s', (color) => {
    expect(() => normalizeAnnotations([{ ...text, color }])).toThrow(/标注/);
  });
  it('accepts boundary widths but rejects unknown styles', () => {
    expect(normalizeAnnotations([{ ...text, width: 0.04 }, { ...text, width: 1 }])).toHaveLength(2);
    for (const textStyle of ['solid', 'url(example.test)', {}, null]) expect(() => normalizeAnnotations([{ ...text, textStyle }])).toThrow(/标注/);
  });
});
