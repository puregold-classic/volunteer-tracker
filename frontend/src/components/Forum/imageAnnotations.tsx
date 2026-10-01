import type { CSSProperties } from 'react';
export type Point = { x: number; y: number };
export type Annotation = {
  kind: 'pen' | 'line' | 'arrow' | 'rect' | 'text';
  color: string;
  size: number;
  points: Point[];
  filled?: boolean;
  text?: string;
  /** Text box width relative to the image width, including its padding. */
  width?: number;
  textStyle?: 'plain' | 'background' | 'outline';
};
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
export const imageLayout = (width: unknown, align: unknown): CSSProperties => ({ width: `${typeof width === 'number' && Number.isFinite(width) ? clamp(width, 10, 100) : 100}%`, marginLeft: align === 'center' || align === 'right' ? 'auto' : 0, marginRight: align === 'center' ? 'auto' : 0 });
const svgHeight = (height: number) => Number.isFinite(height) && height > 0 ? height : 1000;
const textSize = (mark: Annotation) => Number.isFinite(mark.size) ? clamp(mark.size, 12, 96) : 24;
const textPadding = (mark: Annotation) => mark.textStyle === 'background' ? Math.max(4, textSize(mark) * 0.22) : mark.textStyle === 'outline' ? Math.max(2, textSize(mark) * 0.08) : 0;
// Fixed advances make text boxes deterministic before fonts load and on restored drafts.
// textLength below uses the same advances, so rendered text stays inside its measured box.
const textAdvance = (text: string, size: number) => Array.from(text).reduce((width, char) => {
  if (/\p{Mark}|[\u200d\ufe0e\ufe0f]/u.test(char)) return width;
  if (char === ' ') return width + size * 0.33;
  if (/[ilI.,'`:;!|]/.test(char)) return width + size * 0.3;
  if (/[MW@#%&]/.test(char)) return width + size * 0.9;
  return width + size * (char.codePointAt(0)! > 0xff ? 1 : 0.62);
}, 0);
export function textLayout(mark: Annotation, _height = 1000): { lines: string[]; width: number; height: number } {
  const size = textSize(mark), padding = textPadding(mark);
  const paragraphs = (mark.text ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const naturalWidth = Math.max(size, ...paragraphs.map(line => textAdvance(line, size))) + padding * 2;
  // Even the narrowest box must fit one full-width glyph and both padding edges.
  const minimumWidth = Math.max(40, size + padding * 2);
  const width = typeof mark.width === 'number' && Number.isFinite(mark.width) ? clamp(mark.width * 1000, minimumWidth, 1000) : clamp(naturalWidth, minimumWidth, 1000);
  const contentWidth = Math.max(1, width - padding * 2);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    let line = '';
    for (const char of Array.from(paragraph)) {
      if (line && textAdvance(line + char, size) > contentWidth) {
        const space = line.lastIndexOf(' ');
        // Keep words together when possible, while still wrapping long words and CJK.
        if (space > 0 && char !== ' ') {
          lines.push(line.slice(0, space));
          line = line.slice(space + 1);
          if (line && textAdvance(line + char, size) > contentWidth) { lines.push(line); line = ''; }
        } else { lines.push(line.trimEnd()); line = ''; }
      }
      if (char !== ' ' || line) line += char;
    }
    lines.push(line);
  }
  return { lines, width, height: lines.length * size * 1.3 + padding * 2 };
}
export function bounds(mark: Annotation, height = 1000) {
  const xs = mark.points.map(p => p.x), ys = mark.points.map(p => p.y);
  if (!xs.length) return { x: 0, y: 0, right: 0, bottom: 0 };
  if (mark.kind === 'text') {
    const layout = textLayout(mark, height), { x, y } = mark.points[0];
    return { x, y, right: x + layout.width / 1000, bottom: y + layout.height / svgHeight(height) };
  }
  return { x: Math.min(...xs), y: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}
export function moveAnnotation(mark: Annotation, dx: number, dy: number, height = 1000): Annotation {
  const b = bounds(mark, height);
  // When a text box exceeds the image height, keep its top edge reachable.
  dx = clamp(b.x + dx, 0, Math.max(0, 1 - (b.right - b.x))) - b.x;
  dy = clamp(b.y + dy, 0, Math.max(0, 1 - (b.bottom - b.y))) - b.y;
  return { ...mark, ...(mark.kind === 'text' && mark.width !== undefined ? { width: textLayout(mark, height).width / 1000 } : {}), points: mark.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
}
export function resizeAnnotation(mark: Annotation, end: Point, height = 1000): Annotation {
  const b = bounds(mark, height);
  if (mark.kind === 'text') {
    const resized = { ...mark, width: clamp(end.x - b.x, 0.04, Math.max(0.04, 1 - b.x)) };
    return moveAnnotation(resized, 0, 0, height);
  }
  const width = Math.max(0.001, b.right - b.x), boxHeight = Math.max(0.001, b.bottom - b.y);
  const right = clamp(end.x, b.x + 0.001, 1), bottom = clamp(end.y, b.y + 0.001, 1);
  return { ...mark, points: mark.points.map(p => ({ x: clamp(b.x + (p.x - b.x) / width * (right - b.x)), y: clamp(b.y + (p.y - b.y) / boxHeight * (bottom - b.y)) })) };
}
export function AnnotationShape({ mark, height }: { mark: Annotation; height: number }) {
  const points = mark.points.map(p => ({ x: p.x * 1000, y: p.y * height }));
  const a = points[0], b = points[points.length - 1];
  if (!a || !b) return null;
  const color = /^#[0-9a-f]{6}$/i.test(mark.color) ? mark.color : '#e5484d';
  const stroke = { stroke: color, strokeWidth: mark.size, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (mark.kind === 'text') {
    const layout = textLayout(mark, height), size = textSize(mark), padding = textPadding(mark), x = a.x + padding, y = a.y + padding;
    const outline = mark.textStyle === 'outline';
    return <g>
      {mark.textStyle === 'background' && <rect x={a.x} y={a.y} width={layout.width} height={layout.height} rx={Math.min(8, padding)} fill="#ffffff" fillOpacity={0.9} />}
      <text x={x} y={y} fill={color} fontSize={size} fontFamily="sans-serif" dominantBaseline="hanging" stroke={outline ? '#ffffff' : undefined} strokeWidth={outline ? Math.max(2, size * 0.1) : undefined} strokeLinejoin="round" paintOrder="stroke fill" style={{ whiteSpace: 'pre' }}>
        {layout.lines.map((line, i) => <tspan key={i} x={x} y={y + i * size * 1.3} textLength={line ? Math.max(1, Math.min(layout.width - padding * 2, textAdvance(line, size))) : undefined} lengthAdjust="spacingAndGlyphs">{line || '\u200b'}</tspan>)}
      </text>
    </g>;
  }
  if (mark.kind === 'rect') return <rect {...stroke} x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} rx={Math.min(16, Math.abs(b.x - a.x) / 4, Math.abs(b.y - a.y) / 4)} fill={mark.filled ? color : 'none'} />;
  if (mark.kind === 'pen') return <polyline {...stroke} points={points.map(p => `${p.x},${p.y}`).join(' ')} />;
  const angle = Math.atan2(b.y - a.y, b.x - a.x), head = Math.max(14, mark.size * 3);
  return <><line {...stroke} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />{mark.kind === 'arrow' && <path {...stroke} d={`M ${b.x - head * Math.cos(angle - Math.PI / 6)} ${b.y - head * Math.sin(angle - Math.PI / 6)} L ${b.x} ${b.y} L ${b.x - head * Math.cos(angle + Math.PI / 6)} ${b.y - head * Math.sin(angle + Math.PI / 6)}`} />}</>;
}
export function AnnotationLayer({ marks, height }: { marks: Annotation[]; height: number }) {
  return <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 1000 ${height}`}>{marks.map((mark, i) => <AnnotationShape key={i} mark={mark} height={height} />)}</svg>;
}
