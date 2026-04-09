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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
