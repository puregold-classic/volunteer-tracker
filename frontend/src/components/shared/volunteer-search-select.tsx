// Inline volunteer typeahead picker. Type a name / volunteer code, pick from
// the debounced search results. Once a volunteer is chosen it collapses to a
// chip with a "重选" button. Used by the proxy-submit flow (为他人提交) and any
// other place that needs to pick a single volunteer by search.
//
// Search logic mirrors AddMemberDialog in lists-section.tsx (same API +
// 200ms debounce + race-cancel), extracted here for reuse.

import { useEffect, useState } from 'react';
import volunteerService from '@services/volunteerService';
import type { Volunteer } from '@services/types';
import { deptColor } from '@/lib/ledger-colors';

export interface VolunteerSearchSelectProps {
  selected: Volunteer | null;
  onSelect: (v: Volunteer | null) => void;
  /** Exclude this volunteer id from results (e.g. the current user). */
  excludeId?: string;
  placeholder?: string;
}

export const VolunteerSearchSelect: React.FC<VolunteerSearchSelectProps> = ({
  selected,
  onSelect,
  excludeId,
  placeholder = '搜索姓名或志愿者 ID（PG-XXXX）',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Volunteer[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (selected) return; // collapsed to chip — no search
    const q = query.trim();
    if (q.length < 1) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await volunteerService.getAllVolunteers({ search: q, limit: 20 });
        if (!cancelled && res?.success && res.data) {
          setResults(res.data.filter((v) => v.id !== excludeId));
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query, selected, excludeId]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
          style={{ backgroundColor: deptColor(selected.departmentId) }}
        >
          {selected.chineseName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium text-foreground">{selected.chineseName}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{selected.volunteerCode}</span>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{selected.department?.name}</p>
        </div>
        <button
          type="button"
          onClick={() => { onSelect(null); setQuery(''); }}
          className="shrink-0 rounded px-2 py-1 text-[11px] text-primary hover:bg-primary/10"
        >
          重选
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {query.trim() && (
        <div className="max-h-56 space-y-1 overflow-auto rounded-lg border border-border bg-background p-1">
          {searching && <p className="px-2 py-3 text-xs text-muted-foreground">搜索中…</p>}
          {!searching && results.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">无匹配</p>
          )}
          {results.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => { onSelect(v); setResults([]); }}
              className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-accent"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
                style={{ backgroundColor: deptColor(v.departmentId) }}
              >
                {v.chineseName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium">{v.chineseName}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{v.volunteerCode}</span>
                </div>
                <p className="truncate text-[11px] text-muted-foreground">{v.department?.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default VolunteerSearchSelect;
