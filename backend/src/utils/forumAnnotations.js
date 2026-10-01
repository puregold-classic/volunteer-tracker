import { ForumError } from '../services/CircleService.js';
const fail = () => { throw new ForumError(400, '图片标注格式不正确或过于复杂'); };
export function normalizeAnnotations(value = []) {
  if (!Array.isArray(value) || value.length > 40 || JSON.stringify(value).length > 30_000) fail();
  return value.map(mark => {
    if (!mark || !['pen', 'line', 'arrow', 'rect', 'text'].includes(mark.kind) || typeof mark.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(mark.color)) fail();
    if (!Number.isFinite(mark.size) || mark.size < (mark.kind === 'text' ? 12 : 1) || mark.size > (mark.kind === 'text' ? 96 : 24)) fail();
    if (!Array.isArray(mark.points) || (mark.kind === 'text' ? mark.points.length !== 1 : mark.kind === 'pen' ? mark.points.length < 2 || mark.points.length > 300 : mark.points.length !== 2)) fail();
    const points = mark.points.map(p => {
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) fail();
      return { x: Math.round(p.x * 10000) / 10000, y: Math.round(p.y * 10000) / 10000 };
    });
    const result = { kind: mark.kind, color: mark.color, size: mark.size, points };
    if (mark.kind === 'text') {
      if (typeof mark.text !== 'string' || !mark.text.trim() || mark.text.length > 200) fail();
      result.text = mark.text.replace(/\r\n?/g, '\n').trim();
      if (mark.width !== undefined) {
        if (!Number.isFinite(mark.width) || mark.width < 0.04 || mark.width > 1) fail();
        result.width = Math.round(mark.width * 10000) / 10000;
      }
      if (mark.textStyle !== undefined) {
        if (!['plain', 'background', 'outline'].includes(mark.textStyle)) fail();
        result.textStyle = mark.textStyle;
      }
    }
    if (mark.kind === 'rect') { if (mark.filled !== undefined && typeof mark.filled !== 'boolean') fail(); result.filled = mark.filled ?? false; }
    return result;
  });
}
