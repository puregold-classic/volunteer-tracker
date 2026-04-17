// frontend/src/components/shared/scrollable-bar-chart.tsx — v3 wave 3
//
// Vertical-bar primitive with uniform bar-width rules used across the
// ledger. Project convention (记进 CLAUDE.md):
//
//   - N ≤ 6  bars → width as if 6, left-aligned, right empty
//   - 6 < N ≤ 12 → bars fill container naturally
//   - N > 12     → each bar uses the 12-width, overflow horizontal scroll
//
// Why: prevents a 3-bar chart from stretching wide and looking
// disproportionate while also capping crowd so 50 volunteer bars
// don't squish into unreadable slivers.
//
// Supports single-value bars and category-stacked bars (pass `segments`
// instead of `value`). Click handlers supported for drill-down.

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface BarSegment {
  key: string;
  value: number;
  color: string;
}

export interface BarDatum {
  key: string;
  label: string;
  /** Secondary label under the main one (e.g. department name under volunteer name). */
  sublabel?: string;
  /** Single-value bar: use `value` + optional `color`. */
  value?: number;
  color?: string;
  /** Stacked bar: use `segments` (ignored if `value` is set). */
  segments?: BarSegment[];
  /** Click handler. If omitted, bar is not focusable. */
  onClick?: () => void;
  active?: boolean;
}

export interface ScrollableBarChartProps {
  bars: BarDatum[];
  /** Chart pixel height, default 180. */
  height?: number;
  /** Override max value for Y scaling; otherwise derived from data. */
  max?: number;
  /** Formatter for the number printed above each bar. */
  formatValue?: (v: number) => string;
  /** Optional className for the outer container. */
  className?: string;
  /** Hide the value label above each bar. Useful when the bars are stacked or very thin. */
  hideValueLabel?: boolean;
}

const MIN_SLOTS = 6;
const MAX_VISIBLE = 12;

export const ScrollableBarChart: React.FC<ScrollableBarChartProps> = ({
  bars,
  height = 180,
  max,
  formatValue = (v) => `${v}`,
  className,
  hideValueLabel = false,
}) => {
  const { slotCount, scrollable } = useMemo(() => {
    if (bars.length <= MIN_SLOTS) return { slotCount: MIN_SLOTS, scrollable: false };
    if (bars.length <= MAX_VISIBLE) return { slotCount: bars.length, scrollable: false };
    return { slotCount: MAX_VISIBLE, scrollable: true };
  }, [bars.length]);

  const resolvedMax = useMemo(() => {
    if (max !== undefined) return max;
    let m = 0;
    for (const b of bars) {
      if (b.value !== undefined && b.value > m) m = b.value;
      if (b.segments) {
        const sum = b.segments.reduce((acc, s) => acc + s.value, 0);
        if (sum > m) m = sum;
      }
    }
    return m || 1;
  }, [bars, max]);

  const slotPct = 100 / slotCount;
  const totalWidthPct = scrollable ? (bars.length / slotCount) * 100 : 100;

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'relative',
          scrollable ? 'overflow-x-auto' : 'overflow-hidden',
        )}
      >
        <div
          className="flex items-end"
          style={{ height: `${height}px`, width: `${totalWidthPct}%`, minWidth: '100%' }}
        >
          {bars.map((b) => {
            const total = b.segments
              ? b.segments.reduce((acc, s) => acc + s.value, 0)
              : (b.value ?? 0);
            const barHeight = resolvedMax > 0 ? (total / resolvedMax) * 100 : 0;

            return (
              <div
                key={b.key}
                className="flex flex-col items-center justify-end px-1"
                style={{ width: `${slotPct}%`, minWidth: '0' }}
              >
                {!hideValueLabel && total > 0 && (
                  <span className="mb-1 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {formatValue(total)}
                  </span>
                )}
                <button
                  type="button"
                  disabled={!b.onClick}
                  onClick={b.onClick}
                  className={cn(
                    'relative flex w-[70%] flex-col-reverse overflow-hidden rounded-t-md transition-all',
                    b.onClick
                      ? 'cursor-pointer hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      : 'cursor-default',
                    b.active && 'ring-2 ring-primary ring-offset-2',
                  )}
                  style={{ height: `${Math.max(barHeight, total > 0 ? 2 : 0)}%`, minHeight: total > 0 ? '2px' : '0' }}
                  aria-label={`${b.label}: ${formatValue(total)}`}
                >
                  {b.segments ? (
                    b.segments
                      .filter((s) => s.value > 0)
                      .map((s) => (
                        <div
                          key={s.key}
                          style={{
                            height: `${(s.value / total) * 100}%`,
                            backgroundColor: s.color,
                          }}
                        />
                      ))
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{ backgroundColor: b.color || 'var(--primary, #f59e0b)' }}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {/* Labels row — separate flex so bar alignment isn't affected by text wrap */}
      <div
        className={cn(
          scrollable ? 'overflow-x-auto' : 'overflow-hidden',
        )}
      >
        <div className="flex" style={{ width: `${totalWidthPct}%`, minWidth: '100%' }}>
          {bars.map((b) => (
            <div
              key={b.key}
              className="flex flex-col items-center px-1 pt-1.5 text-center"
              style={{ width: `${slotPct}%`, minWidth: '0' }}
            >
              <span className="truncate text-[11px] text-foreground" title={b.label}>
                {b.label}
              </span>
              {b.sublabel && (
                <span className="truncate text-[10px] text-muted-foreground" title={b.sublabel}>
                  {b.sublabel}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScrollableBarChart;
