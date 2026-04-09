// Local-time date helpers.
//
// Avoids the classic JS gotcha where `new Date('2026-04-01')` is parsed
// as UTC midnight and then shifted into the previous day in Western
// timezones — a record dated April 1 ends up bucketed into March for
// any user east of GMT… err, west of UTC. The frontend deals exclusively
// in calendar dates (no times), so we always parse the YYYY-MM-DD parts
// out of the string and construct a local-midnight Date.

/**
 * Parse a date-only or ISO datetime string as a *local* calendar date.
 * Both `'2026-04-01'` and `'2026-04-01T00:00:00.000Z'` produce a Date
 * representing April 1 at local midnight.
 */
export function parseLocalDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Format any date input to a YYYY-MM-DD string in local time. */
export function formatLocalDate(value: string | Date | null | undefined): string {
  const d = parseLocalDate(value);
  if (!d) return '—';
  return formatYMD(d);
}

/** Format a Date as YYYY-MM-DD using local-time fields. */
function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Date-range presets used by the ledger filter bar ───────────────────────

export type DateRangeKey = 'all' | '7d' | '30d' | '90d' | 'thisMonth' | 'thisYear';

/**
 * Convert a preset key to (dateFrom, dateTo) bounds in YYYY-MM-DD form.
 *
 * 'all' returns an empty object so callers can spread it without sending
 * filter params at all.
 *
 * The `now` parameter is injectable for deterministic testing — production
 * callers should omit it and get the current wall-clock time.
 */
export function rangeToBounds(
  key: DateRangeKey,
  now: Date = new Date(),
): { dateFrom?: string; dateTo?: string } {
  if (key === 'all') return {};
  const dateTo = formatYMD(now);
  let from: Date;
  if (key === 'thisMonth') from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (key === 'thisYear') from = new Date(now.getFullYear(), 0, 1);
  else if (key === '7d') from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  else if (key === '30d') from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  else /* 90d */ from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
  return { dateFrom: formatYMD(from), dateTo };
}
