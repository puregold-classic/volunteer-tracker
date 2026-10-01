import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnnotationLayer, bounds, imageLayout, moveAnnotation, resizeAnnotation, textLayout, type Annotation } from '@/components/Forum/imageAnnotations';
afterEach(cleanup);
const mark: Annotation = { kind: 'rect', color: '#ff0000', size: 4, points: [{ x: 0.2, y: 0.3 }, { x: 0.5, y: 0.6 }], filled: false };
describe('image layout and annotations', () => {
  it('keeps movement and resizing within the image and preserves relative geometry', () => {
    expect(moveAnnotation(mark, 1, -1).points).toEqual([{ x: 0.7, y: 0 }, { x: 1, y: 0.3 }]);
    const resized = resizeAnnotation(mark, { x: 0.8, y: 0.9 });
    expect(resized.points[0]).toEqual(mark.points[0]); expect(resized.points[1].x).toBeCloseTo(0.8); expect(resized.points[1].y).toBeCloseTo(0.9);
    expect(mark.points[1]).toEqual({ x: 0.5, y: 0.6 });
    expect(imageLayout(47.5, 'center')).toMatchObject({ width: '47.5%', marginLeft: 'auto', marginRight: 'auto' });
    expect(imageLayout(Infinity, 'right').width).toBe('100%');
  });
  it('renders solid/outline shapes and text safely at the image aspect ratio', () => {
    const { container } = render(<AnnotationLayer height={500} marks={[mark, { ...mark, filled: true }, { kind: 'text', color: '#00ff00', size: 32, points: [{ x: 0.1, y: 0.2 }], text: '<script>hello</script>' }]} />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 1000 500');
    expect(container.querySelectorAll('rect')[0].getAttribute('fill')).toBe('none');
    expect(container.querySelectorAll('rect')[1].getAttribute('fill')).toBe('#ff0000');
    expect(container.querySelector('text')?.getAttribute('y')).toBe('100');
    expect(container.querySelector('script')).toBeNull(); expect(container.textContent).toContain('<script>hello</script>');
  });
});


describe('editable annotation text boxes', () => {
  const text: Annotation = { kind: 'text', color: '#e33b35', size: 24, points: [{ x: 0.2, y: 0.3 }], text: '第一行说明\n第二行说明', width: 0.25, textStyle: 'background' };
  it('preserves explicit newlines and wraps Chinese text and long words without losing text', () => {
    expect(textLayout(text, 500).lines).toEqual(['第一行说明', '第二行说明']);
    const narrow = textLayout({ ...text, text: '中文说明ABCDEFGHIJKLMNOPQRSTUVWXYZ', width: 0.08 });
    expect(narrow.lines.length).toBeGreaterThan(2);
    expect(narrow.lines.join('')).toBe('中文说明ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(narrow.width).toBe(80);
    expect(textLayout({ ...text, text: 'first\r\n\r\nlast' }).lines).toEqual(['first', '', 'last']);
    expect(textLayout({ ...text, text: 'hello world', width: 0.12 }).lines).toEqual(['hello', 'world']);
  });
  it('uses all lines when positioning text and respects the actual image aspect ratio', () => {
    const layout = textLayout(text, 500), b = bounds(text, 500);
    expect(b.right - b.x).toBeCloseTo(layout.width / 1000);
    expect(b.bottom - b.y).toBeCloseTo(layout.height / 500);
    const moved = moveAnnotation(text, 10, 10, 500), movedBounds = bounds(moved, 500);
    expect(movedBounds.right).toBeCloseTo(1);
    expect(movedBounds.bottom).toBeCloseTo(1);
    expect(moved.text).toBe(text.text); expect(moved.width).toBe(text.width);
    expect(text.points).toEqual([{ x: 0.2, y: 0.3 }]);
    const tall = moveAnnotation({ ...text, text: '文'.repeat(100), width: 0.04 }, 0, 10, 100);
    expect(tall.points[0].y).toBe(0);
    expect(tall.text).toHaveLength(100);
  });
  it('changes text box width without scaling characters and moves wrapped text back inside the image', () => {
    const resized = resizeAnnotation({ ...text, points: [{ x: 0.9, y: 0.95 }] }, { x: 2, y: 0.5 }, 500);
    expect(resized.width).toBeCloseTo(0.1);
    expect(resized.size).toBe(24);
    expect(resized.text).toBe(text.text);
    expect(bounds(resized, 500).right).toBeCloseTo(1);
    expect(bounds(resized, 500).bottom).toBeCloseTo(1);
    expect(resizeAnnotation(text, { x: -1, y: -1 }).width).toBe(0.04);
  });
  it('keeps a narrow box readable at the largest font size and stores its actual width', () => {
    const large: Annotation = { ...text, text: '说明', size: 96, width: 0.04, points: [{ x: 0.98, y: 0.9 }] };
    const layout = textLayout(large, 500);
    expect(layout.width).toBeCloseTo(138.24);
    expect(layout.lines).toEqual(['说', '明']);
    const resized = resizeAnnotation(large, { x: 1, y: 1 }, 500);
    expect(resized.width).toBeCloseTo(layout.width / 1000);
    expect(resized.width).toBe(textLayout(resized, 500).width / 1000);
    expect(bounds(resized, 500).right).toBeCloseTo(1);
    expect(bounds(resized, 500).bottom).toBeCloseTo(1);
    const { container } = render(<AnnotationLayer height={500} marks={[resized]} />);
    for (const span of container.querySelectorAll('tspan')) expect(Number(span.getAttribute('textLength'))).toBeCloseTo(96);
    const legacy = { ...large }; delete legacy.width;
    expect(moveAnnotation(legacy, 0, 0, 500)).not.toHaveProperty('width');
  });
  it('renders background and outlined multiline text with safe colors and no HTML', () => {
    const { container } = render(<AnnotationLayer height={500} marks={[text, { ...text, textStyle: 'outline' }, { ...text, textStyle: 'plain', color: 'url(https://example.test/pixel)', text: '<script>x</script>', width: 1 }]} />);
    const nodes = container.querySelectorAll('text');
    expect(container.querySelectorAll('rect')).toHaveLength(1);
    expect(container.querySelector('rect')?.getAttribute('fill')).toBe('#ffffff');
    expect(nodes[0].querySelectorAll('tspan')).toHaveLength(2);
    expect(nodes[1].getAttribute('stroke')).toBe('#ffffff');
    expect(nodes[1].getAttribute('paint-order')).toBe('stroke fill');
    expect(nodes[2].getAttribute('fill')).toMatch(/^#[a-f0-9]{6}$/);
    expect(container.querySelector('script')).toBeNull();
    expect(nodes[2].textContent).toBe('<script>x</script>');
  });
  it('keeps legacy single-line plain annotations readable without adding new fields', () => {
    const legacy = { ...text }; delete legacy.width; delete legacy.textStyle;
    legacy.text = '旧文字';
    const { container } = render(<AnnotationLayer height={600} marks={[legacy]} />);
    expect(container.querySelector('rect')).toBeNull();
    expect(container.querySelector('text')?.getAttribute('x')).toBe('200');
    expect(container.querySelector('text')?.getAttribute('y')).toBe('180');
    expect(container.textContent).toBe('旧文字');
    expect(legacy.width).toBeUndefined();
  });
});
