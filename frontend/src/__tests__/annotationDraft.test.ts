import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { annotationDraftKey, clearAnnotationDraft, readAnnotationDraft, writeAnnotationDraft } from '@/components/Forum/annotationDraft';
import type { Annotation } from '@/components/Forum/imageAnnotations';

const arrow: Annotation = { kind: 'arrow', color: '#e33b35', size: 5, points: [{ x: 0.1, y: 0.2 }, { x: 0.6, y: 0.7 }] };
const text: Annotation = { kind: 'text', color: '#112233', size: 36, points: [{ x: 0.1, y: 0.2 }], text: '第一行\n第二行' };
const base = '[]';
let serial = 0;
let key: string;
beforeEach(() => { localStorage.clear(); key = annotationDraftKey('alice', `post:circle-${++serial}`, 'image-one'); });
afterEach(() => vi.restoreAllMocks());

describe('temporary image annotation drafts', () => {
  it('isolates accounts, editor scopes and images without separator collisions', () => {
    const keys = [annotationDraftKey('alice', 'post:one', 'image-one'), annotationDraftKey('bob', 'post:one', 'image-one'), annotationDraftKey('alice', 'comment:one', 'image-one'), annotationDraftKey('alice', 'post:one', 'image-two'), annotationDraftKey('alice:post', 'one', 'image-one')];
    expect(new Set(keys).size).toBe(keys.length);
    writeAnnotationDraft(keys[0], base, [arrow]);
    expect(readAnnotationDraft(keys[0], base).draft?.marks).toEqual([arrow]);
    for (const other of keys.slice(1)) expect(readAnnotationDraft(other, base).draft).toBeNull();
  });
  it('restores unfinished marks while leaving the original annotations unchanged', () => {
    const original = JSON.stringify([arrow]);
    writeAnnotationDraft(key, original, [arrow, text], 1);
    const result = readAnnotationDraft(key, original);
    expect(result.error).toBe('');
    expect(result.draft).toMatchObject({ version: 1, base: original, marks: [arrow, text], editing: 1 });
    expect(Number.isFinite(Date.parse(result.draft!.savedAt))).toBe(true);
    expect(JSON.parse(original)).toEqual([arrow]);
    result.draft!.marks[0].color = '#000000';
    expect(readAnnotationDraft(key, original).draft?.marks[0].color).toBe(arrow.color);
  });
  it('does not restore marks after the underlying annotations have changed', () => {
    writeAnnotationDraft(key, base, [arrow]);
    expect(readAnnotationDraft(key, JSON.stringify([text]))).toEqual({ draft: null, error: '' });
    expect(readAnnotationDraft(key, base).draft?.marks).toEqual([arrow]);
  });
  it('preserves a blank text box being edited and multiline text style', () => {
    const blank = { ...text, text: '' };
    const styled = { ...text, width: 0.45, textStyle: 'background' as const };
    writeAnnotationDraft(key, base, [styled, blank], 1);
    expect(readAnnotationDraft(key, base).draft).toMatchObject({ marks: [styled, blank], editing: 1 });
  });
  it('keeps an intentionally empty mark list, so deleted marks do not reappear', () => {
    const original = JSON.stringify([arrow]);
    writeAnnotationDraft(key, original, [], null);
    expect(readAnnotationDraft(key, original).draft?.marks).toEqual([]);
  });
  it('rejects invalid geometry, editing targets and text properties before overwriting work', () => {
    writeAnnotationDraft(key, base, [arrow]);
    for (const patch of [{ color: 'red' }, { size: 0 }, { points: [{ x: -1, y: 0 }, { x: 0.5, y: 0.5 }] }, { kind: 'script' }, { width: 2 }, { textStyle: 'unknown' }]) {
      expect(() => writeAnnotationDraft(key, base, [{ ...arrow, ...patch } as Annotation])).toThrow();
    }
    expect(() => writeAnnotationDraft(key, base, [arrow], 0)).toThrow();
    expect(() => writeAnnotationDraft(key, base, [text], 1)).toThrow();
    expect(() => writeAnnotationDraft(key, base, [{ ...text, text: 'a'.repeat(201) }])).toThrow();
    expect(readAnnotationDraft(key, base).draft?.marks).toEqual([arrow]);
  });
  it('limits draft mark counts and the UTF-8 byte size, not just character count', () => {
    expect(() => writeAnnotationDraft(key, base, Array(41).fill(arrow))).toThrow();
    const large = Array(40).fill({ ...text, text: '字'.repeat(200), width: 0.123456789, textStyle: 'background', points: [{ x: 0.12345678901234567, y: 0.12345678901234567 }] });
    expect(JSON.stringify(large).length).toBeLessThan(30_000);
    expect(new TextEncoder().encode(JSON.stringify(large)).length).toBeGreaterThan(30_000);
    expect(() => writeAnnotationDraft(key, base, large)).toThrow();
    expect(localStorage.getItem(key)).toBeNull();
  });
  it('rejects corrupt or invalid stored drafts without raising a render error', () => {
    for (const value of ['{oops', JSON.stringify({ version: 2, base, marks: [], savedAt: new Date().toISOString() }), JSON.stringify({ version: 1, base, marks: [arrow], savedAt: 'invalid' }), JSON.stringify({ version: 1, base: 'not json', marks: [], savedAt: new Date().toISOString() })]) {
      localStorage.setItem(key, value);
      expect(readAnnotationDraft(key, base).draft).toBeNull();
      expect(readAnnotationDraft(key, base).error).toContain('无法读取');
    }
  });
  it('retains the latest failed write in memory for closing and reopening in this page', () => {
    writeAnnotationDraft(key, base, [arrow]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    const latest = [{ ...arrow, color: '#ffffff' }];
    expect(() => writeAnnotationDraft(key, base, latest)).toThrow();
    latest[0].color = '#000000';
    const result = readAnnotationDraft(key, base);
    expect(result.draft?.marks[0].color).toBe('#ffffff');
    expect(result.error).toContain('当前页面仍保留');
    expect(readAnnotationDraft(key, JSON.stringify([text])).draft).toBeNull();
  });
  it('recovers normal persistence after a storage failure', () => {
    const failed = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable'); });
    expect(() => writeAnnotationDraft(key, base, [arrow])).toThrow();
    failed.mockRestore();
    writeAnnotationDraft(key, base, [text], 0);
    expect(readAnnotationDraft(key, base)).toMatchObject({ error: '', draft: { marks: [text], editing: 0 } });
    expect(JSON.parse(localStorage.getItem(key)!).marks).toEqual([text]);
  });
  it('returns an in-memory copy if storage becomes unreadable', () => {
    writeAnnotationDraft(key, base, [arrow]);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readAnnotationDraft(key, base)).toMatchObject({ draft: { marks: [arrow] } });
    expect(readAnnotationDraft(key, base).error).toContain('无法读取');
  });
  it('clears only the applied image and suppresses old progress even if removal fails', () => {
    const other = annotationDraftKey('alice', 'other-post', 'image-two');
    writeAnnotationDraft(key, base, [arrow]);
    writeAnnotationDraft(other, base, [text]);
    const failed = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => clearAnnotationDraft(key)).toThrow();
    expect(readAnnotationDraft(key, base).draft).toBeNull();
    expect(readAnnotationDraft(other, base).draft?.marks).toEqual([text]);
    failed.mockRestore();
    clearAnnotationDraft(key);
    expect(readAnnotationDraft(key, base)).toEqual({ draft: null, error: '' });
  });
  it('does not use persistent storage without an editor scope', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem');
    expect(readAnnotationDraft(undefined, base)).toEqual({ draft: null, error: '' });
    clearAnnotationDraft();
    expect(get).not.toHaveBeenCalled();
  });
});
