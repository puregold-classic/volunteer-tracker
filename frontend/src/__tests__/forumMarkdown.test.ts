import { describe, it, expect } from 'vitest';
import { renderForumMarkdown } from '@/components/Forum/Markdown';

const render = (source: string) => { const element = document.createElement('div'); element.innerHTML = renderForumMarkdown(source); return element; };
describe('forum Markdown', () => {
  it('renders useful Markdown and Unicode emoji', () => {
    const element = render('# 标题\n\n**加粗** 😊\n\n> 引用\n\n- 列表\n\n```js\nconst a = 1;\n```');
    expect(element.querySelector('h1')?.textContent).toBe('标题');
    expect(element.querySelector('strong')?.textContent).toBe('加粗');
    expect(element.querySelector('code')?.textContent).toContain('const a = 1');
    expect(element.textContent).toContain('😊');
  });
  it.each([
    '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<svg onload=alert(1)>',
    '<iframe src="https://evil.test"></iframe>', '![image](https://evil.test/tracker.png)',
    '![image](data:image/png;base64,AAAA)',
  ])('does not create executable HTML or images: %s', (source) => {
    const element = render(source);
    expect(element.querySelector('script,img,svg,iframe,object,style')).toBeNull();
    expect(element.querySelector('[onerror],[onload],[style]')).toBeNull();
  });
  it.each(['javascript:alert%281%29', 'data:text/html,hello', 'vbscript:msgbox%281%29', 'file:///etc/passwd', 'javascript&#58;alert%281%29'])('rejects unsafe link protocols: %s', (href) => {
    expect(render(`[点击](${href})`).querySelector('a')).toBeNull();
  });
  it('retains safe links with protective rel attributes', () => {
    const link = render('[文档](https://example.com/doc)').querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/doc');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('target')).toBe('_blank');
  });
});
