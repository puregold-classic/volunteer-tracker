// Regression coverage for the parseLocalDate / formatLocalDate helpers.
//
// The bug these helpers fix: `new Date('2026-04-01')` is parsed as UTC
// midnight, then in any negative-offset timezone (e.g. America/New_York)
// the local representation rolls back to 2026-03-31. That made every
// April-1-dated record bucket into March on US East users' screens.
//
// The invariants below are TZ-agnostic — parseLocalDate constructs the
// Date via the (year, month, day) overload, which always anchors at
// local midnight regardless of system TZ.

import { describe, it, expect } from 'vitest';
import { parseLocalDate, formatLocalDate, rangeToBounds } from '../lib/date-utils';

describe('parseLocalDate', () => {
  it('parses YYYY-MM-DD as local-midnight Date', () => {
    const d = parseLocalDate('2026-04-01')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // April (0-indexed)
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('parses an ISO datetime string by stripping the time portion', () => {
    // Even though the string is UTC midnight (which would normally roll
    // back a day in negative-offset zones), parseLocalDate slices the
    // YYYY-MM-DD prefix and constructs local-midnight on that day.
    const d = parseLocalDate('2026-04-01T00:00:00.000Z')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(1);
  });

  it('handles December → January boundary without month shift', () => {
    const d = parseLocalDate('2025-12-31')!;
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });

  it('returns the same Date instance when given a Date', () => {
    const input = new Date(2026, 0, 15);
    const d = parseLocalDate(input);
    expect(d).toBe(input);
  });

  it('returns null for null/undefined/empty inputs', () => {
    expect(parseLocalDate(null)).toBeNull();
    expect(parseLocalDate(undefined)).toBeNull();
    expect(parseLocalDate('')).toBeNull();
  });

  it('returns null for a fully unparseable string', () => {
    // Strings that don't match the YYYY-MM-DD prefix fall through to
    // `new Date(value)`. Garbage produces NaN → we coerce that to null.
    // Note: '2026/04/01' is *parseable* by Date and returns local midnight,
    // which is acceptable — only true garbage falls into this branch.
    expect(parseLocalDate('not-a-date')).toBeNull();
  });
});

describe('formatLocalDate', () => {
  it('round-trips a YYYY-MM-DD string unchanged', () => {
    expect(formatLocalDate('2026-04-01')).toBe('2026-04-01');
  });

  it('formats an ISO datetime as the local date (no UTC shift)', () => {
    // The original bug: this used to render '2026-03-31' on EDT.
    expect(formatLocalDate('2026-04-01T00:00:00.000Z')).toBe('2026-04-01');
  });

  it('zero-pads single-digit months and days', () => {
    expect(formatLocalDate('2026-01-05')).toBe('2026-01-05');
  });

  it('formats a Date instance', () => {
    const d = new Date(2026, 6, 4); // July 4
    expect(formatLocalDate(d)).toBe('2026-07-04');
  });

  it('returns "—" for null / empty / invalid inputs', () => {
    expect(formatLocalDate(null)).toBe('—');
    expect(formatLocalDate(undefined)).toBe('—');
    expect(formatLocalDate('')).toBe('—');
    expect(formatLocalDate('garbage')).toBe('—');
  });
});

describe('rangeToBounds', () => {
  // 2026-04-09 (the chunk-6 phase E development date) used as a fixed
  // reference point so the tests are deterministic year-round.
  const NOW = new Date(2026, 3, 9); // April 9, 2026 (local midnight)

  it('"all" returns an empty object (no filter params)', () => {
    expect(rangeToBounds('all', NOW)).toEqual({});
  });

  it('"thisMonth" → first of current month → today', () => {
    expect(rangeToBounds('thisMonth', NOW)).toEqual({
      dateFrom: '2026-04-01',
      dateTo: '2026-04-09',
    });
  });

  it('"thisYear" → Jan 1 → today', () => {
    expect(rangeToBounds('thisYear', NOW)).toEqual({
      dateFrom: '2026-01-01',
      dateTo: '2026-04-09',
    });
  });

  it('"7d" includes today and 6 days back (7 days inclusive)', () => {
    expect(rangeToBounds('7d', NOW)).toEqual({
      dateFrom: '2026-04-03',
      dateTo: '2026-04-09',
    });
  });

  it('"30d" → 29 days back → today', () => {
    expect(rangeToBounds('30d', NOW)).toEqual({
      dateFrom: '2026-03-11',
      dateTo: '2026-04-09',
    });
  });

  it('"90d" → 89 days back → today', () => {
    expect(rangeToBounds('90d', NOW)).toEqual({
      dateFrom: '2026-01-10',
      dateTo: '2026-04-09',
    });
  });

  it('"thisMonth" on the 1st of the month produces a single-day window', () => {
    const firstOfMay = new Date(2026, 4, 1);
    expect(rangeToBounds('thisMonth', firstOfMay)).toEqual({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-01',
    });
  });

  it('"7d" crossing a month boundary computes the previous month correctly', () => {
    const earlyMay = new Date(2026, 4, 3); // May 3
    expect(rangeToBounds('7d', earlyMay)).toEqual({
      dateFrom: '2026-04-27', // 6 days before May 3
      dateTo: '2026-05-03',
    });
  });
});
