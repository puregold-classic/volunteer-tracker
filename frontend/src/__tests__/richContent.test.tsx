import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RichContent, richText, richImageCount } from '@/components/Forum/RichContent';
vi.mock('@/components/Forum/PrivateImage', () => ({ PrivateImage: ({ imageId }: { imageId: string }) => <span data-testid="private-image">{imageId}</span> }));
afterEach(cleanup);
const body = (content: unknown[]) => JSON.stringify({ type: 'doc', content });
describe('rich document rendering', () => {
  it('renders the three heading levels and visible marks without source syntax', () => {
    const nodes = [1, 2, 3].map((level) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text: `标题${level}`, marks: [{ type: 'underline' }, { type: 'bold' }] }] }));
    const { container } = render(<RichContent body={body(nodes)} />);
    for (const level of [1, 2, 3]) expect(screen.getByRole('heading', { level, name: `标题${level}` })).toBeVisible();
    expect(container.querySelectorAll('u')).toHaveLength(3); expect(container.textContent).not.toContain('"type"');
  });
  it('uses private image identifiers and counts text separately from images', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '😊文字' }] }, { type: 'forumImage', attrs: { imageId: 'private-123' } }] };
    render(<RichContent body={JSON.stringify(doc)} />);
    expect(screen.getByTestId('private-image')).toHaveTextContent('private-123');
    expect(richText(doc).trim()).toBe('😊文字'); expect(richImageCount(doc)).toBe(1);
  });
  it('escapes text and rejects unsafe links and arbitrary HTML/image nodes even if storage is malformed', () => {
    const { container } = render(<RichContent body={body([{ type: 'paragraph', content: [{ type: 'text', text: '<img onerror=alert(1)>', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }, { type: 'image', attrs: { src: 'https://evil.test/pixel' } }, { type: 'script', text: 'bad' }])} />);
    expect(container.querySelector('a,img,script')).toBeNull(); expect(container.textContent).toContain('<img onerror=alert(1)>');
  });
  it('does not expose malformed document JSON', () => {
    render(<RichContent body="{broken" />); expect(screen.getByText('内容暂不可用')).toBeVisible();
  });
});
