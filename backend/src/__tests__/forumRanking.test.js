import { describe, it, expect } from 'vitest';
import { HOT_CONFIG, hotScore, compareHot } from '../utils/forumRanking.js';
const now = new Date('2026-09-19T12:00:00Z');
const ago = (hours) => new Date(now.getTime() - hours * 3_600_000);
const post = (age = 0) => ({ id: 'p', createdAt: ago(age), isPinned: false, pinnedAt: null, isFeatured: false });
const stats = { allLikes: 0, recentLikes: 0, recentCommenters: 0, firstRecentAt: null };
describe('forum hot ranking', () => {
  it('has a positive baseline and naturally decays with age', () => {
    expect(hotScore(post(), stats, now)).toBeCloseTo(1 / 12 ** 1.2, 12);
    expect(hotScore(post(100), stats, now)).toBeLessThan(hotScore(post(1), stats, now));
  });
  it('compresses lifetime likes logarithmically', () => {
    expect(hotScore(post(24), { ...stats, allLikes: 9 }, now)).toBeCloseTo((1 + Math.log(10)) / 36 ** 1.2, 12);
    expect(hotScore(post(24), { ...stats, allLikes: 99 }, now) / hotScore(post(24), { ...stats, allLikes: 9 }, now)).toBeLessThan(2);
  });
  it('allows a very old post with recent outside participation to return', () => {
    const old = hotScore(post(24 * 365), { ...stats, recentCommenters: 3, firstRecentAt: ago(1) }, now);
    expect(old).toBeGreaterThan(hotScore(post(), stats, now));
  });
  it('uses the earliest recent interaction and two points per different commenter', () => {
    const recent = { ...stats, recentLikes: 2, recentCommenters: 3, firstRecentAt: ago(48) };
    expect(hotScore(post(240), recent, now)).toBeCloseTo(1 / 252 ** 1.2 + 8 / 60 ** 1.2, 12);
    expect(hotScore(post(240), recent, now)).toBeLessThan(hotScore(post(240), { ...recent, firstRecentAt: ago(1) }, now));
  });
  it('doubles featured scores and clamps future timestamps', () => {
    expect(hotScore({ ...post(10), isFeatured: true }, stats, now)).toBe(hotScore(post(10), stats, now) * 2);
    expect(hotScore(post(-1), stats, now)).toBe(hotScore(post(), stats, now));
    expect(hotScore(post(), { ...stats, recentLikes: 1, firstRecentAt: ago(-1) }, now)).toBeCloseTo(2 / 12 ** 1.2);
    expect(HOT_CONFIG.windowDays).toBe(7);
  });
  it('prioritizes pins by pin time then ID regardless of score, with stable normal ties', () => {
    const rows = [{ ...post(), id: 'a', score: 99 }, { ...post(), id: 'b', score: 99 },
      { ...post(), id: 'x', isPinned: true, pinnedAt: ago(1), score: 0 },
      { ...post(), id: 'y', isPinned: true, pinnedAt: ago(1), score: 0 },
      { ...post(), id: 'z', isPinned: true, pinnedAt: ago(5), score: 1000 }];
    expect(rows.sort(compareHot).map((p) => p.id)).toEqual(['y', 'x', 'z', 'b', 'a']);
  });
});
