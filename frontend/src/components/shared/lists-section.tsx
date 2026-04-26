// frontend/src/components/shared/lists-section.tsx — v3.4 multi-list
//
// MePage 上的「我的 list」区块.  Replaces v3-wave-3 single-list "我的关注".
//
// Features per list:
// - 切换器（dropdown，列出所有 list，默认在最上）
// - List CRUD（新建 / 改名 / 删除，默认 list 不可改）
// - 成员管理（添加 — typeahead；移除；编辑 note）
// - CSV 导出（list 全员的 ACTIVE ProjectSupport 切片）
// - 代提交 / 展开台账（保留 v3-wave-3 行为）

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Heart,
  ListPlus,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import volunteerService from '@services/volunteerService';
import ledgerService, { type LedgerVolunteerService } from '@services/ledgerService';
import { useVolunteerLists } from '@/context/FollowedContext';
import { useAuth } from '@/context/AuthContext';
import type { Volunteer } from '@services/types';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ScrollableBarChart } from '@/components/shared/scrollable-bar-chart';
import { useRecordsDialog } from '@/components/shared/records-dialog';
import { deptColor } from '@/lib/ledger-colors';
import { toast } from '@/hooks/use-toast';

// ─── Helpers ────────────────────────────────────────────────────────────────

interface ProxyTarget { id: string; chineseName: string }

const downloadCsv = async (volunteerIds: string[], listName: string) => {
  if (volunteerIds.length === 0) {
    toast({ title: '该 list 还没有成员，无法导出', variant: 'destructive' });
    return;
  }
  // axios responseType=blob 不能复用现有 api.get（统一返回 data）；走原始 axios.
  // 但 api 拦截器会自动 unwrap. 走 raw fetch 更简单——auth token 从 localStorage 拿。
  const token = localStorage.getItem('auth_token');
  const params = new URLSearchParams({
    format: 'csv',
    volunteerIds: volunteerIds.join(','),
  });
  const res = await fetch(`/api/v1/exports/supports?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    toast({ title: '导出失败', description: msg || `${res.status}`, variant: 'destructive' });
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().split('T')[0];
  a.download = `list-${listName}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ─── Add-member typeahead dialog ────────────────────────────────────────────

const AddMemberDialog: React.FC<{
  open: boolean;
  listName: string;
  excludedIds: Set<string>;
  onAdd: (volunteer: Volunteer, note?: string) => Promise<void>;
  onClose: () => void;
}> = ({ open, listName, excludedIds, onAdd, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Volunteer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Volunteer | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery(''); setResults([]); setSelected(null); setNote('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await volunteerService.getAllVolunteers({ search: q, limit: 20 });
        if (!cancelled && res?.success && res.data) {
          setResults(res.data.filter((v) => !excludedIds.has(v.id)));
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query, open, excludedIds]);

  const onSubmit = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await onAdd(selected, note.trim() || undefined);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title={`添加到「${listName}」`}>
      <div className="space-y-3 py-2">
        {!selected ? (
          <>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索姓名或志愿者 ID（PG-XXXX）"
              className="h-9 w-full rounded border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="max-h-72 space-y-1 overflow-auto">
              {searching && <p className="px-2 py-3 text-xs text-muted-foreground">搜索中…</p>}
              {!searching && results.length === 0 && query.trim() && (
                <p className="px-2 py-3 text-xs text-muted-foreground">无匹配（已在 list 中的会被过滤）</p>
              )}
              {results.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelected(v)}
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
                    <p className="truncate text-[11px] text-muted-foreground">
                      {v.department?.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{selected.chineseName}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{selected.volunteerCode}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{selected.department?.name}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">备注（可选）</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：常代提交、培训搭子…"
                maxLength={200}
                className="h-9 w-full rounded border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                重新选择
              </Button>
              <Button size="sm" onClick={() => void onSubmit()} disabled={busy}>
                添加
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};

// ─── Note-edit prompt (lightweight) ─────────────────────────────────────────

const NoteEditDialog: React.FC<{
  open: boolean;
  initialNote: string;
  volunteerName: string;
  onSave: (note: string) => Promise<void>;
  onClose: () => void;
}> = ({ open, initialNote, volunteerName, onSave, onClose }) => {
  const [val, setVal] = useState(initialNote);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setVal(initialNote); }, [open, initialNote]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title={`${volunteerName} · 备注`}>
      <div className="space-y-3 py-2">
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="留空清除备注"
          maxLength={200}
          className="h-9 w-full rounded border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(val);
                onClose();
              } finally { setBusy(false); }
            }}
          >
            保存
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

// ─── Rename dialog ──────────────────────────────────────────────────────────

const RenameListDialog: React.FC<{
  open: boolean;
  initialName: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}> = ({ open, initialName, onSave, onClose }) => {
  const [val, setVal] = useState(initialName);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setVal(initialName); }, [open, initialName]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title="重命名 list">
      <div className="space-y-3 py-2">
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          maxLength={32}
          className="h-9 w-full rounded border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button
            size="sm"
            disabled={busy || !val.trim()}
            onClick={async () => {
              setBusy(true);
              try { await onSave(val.trim()); onClose(); } finally { setBusy(false); }
            }}
          >
            保存
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

// ─── Main section ───────────────────────────────────────────────────────────

export interface ListsSectionProps {
  onProxySubmit: (target: ProxyTarget) => void;
  recordsDialog: ReturnType<typeof useRecordsDialog>;
}

export const ListsSection: React.FC<ListsSectionProps> = ({ onProxySubmit, recordsDialog }) => {
  const { account } = useAuth();
  const isListOwner = account?.role === 'a_admin' || account?.role === 'b_admin';
  const { lists, setMemberOf, setMemberNote, createList, renameList, deleteList } =
    useVolunteerLists();
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [expandedVolId, setExpandedVolId] = useState<string | null>(null);
  const [services, setServices] = useState<LedgerVolunteerService[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [noteEditing, setNoteEditing] = useState<{
    listId: string; volunteerId: string; note: string; name: string;
  } | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [busy, setBusy] = useState(false);

  // Default to the first list (default list) once loaded.
  useEffect(() => {
    if (!activeListId && lists.length > 0) setActiveListId(lists[0].id);
    // Track if active list got deleted.
    if (activeListId && !lists.find((l) => l.id === activeListId)) {
      setActiveListId(lists[0]?.id ?? null);
    }
  }, [lists, activeListId]);

  const activeList = useMemo(
    () => lists.find((l) => l.id === activeListId) ?? null,
    [lists, activeListId],
  );

  useEffect(() => {
    if (!expandedVolId) { setServices([]); return; }
    ledgerService.volunteerServices(expandedVolId).then((res) => {
      if (res?.success && res.data) setServices(res.data);
    });
  }, [expandedVolId]);

  // Non-list-owner roles never see this section.
  if (!isListOwner) return null;

  if (lists.length === 0 && !creatingNew) {
    // Empty cold-start: show a slim header + "新建 list" CTA so admin_a/b
    // can create their first list without first having to follow anyone.
    return (
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <Heart className="h-4 w-4 text-rose-500" />
          <h2 className="font-serif text-lg font-semibold text-foreground">我的 list</h2>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
          <p>还没有任何 list. 去首页 / 详情页点 ❤︎ 关注会自动建「我的关注」list.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setCreatingNew(true)}
          >
            <ListPlus className="mr-1 h-3.5 w-3.5" />
            或直接新建一个 list
          </Button>
        </div>
      </section>
    );
  }

  const memberIds = new Set(activeList?.members.map((m) => m.volunteer.id) ?? []);

  const onCreate = async () => {
    const name = newListName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const created = await createList(name);
      if (created) {
        setActiveListId(created.id);
        setCreatingNew(false);
        setNewListName('');
        toast({ title: `已创建「${name}」` });
      } else {
        toast({ title: '创建失败', description: '可能已存在同名 list', variant: 'destructive' });
      }
    } finally { setBusy(false); }
  };

  const onDelete = async () => {
    if (!activeList || activeList.isDefault) return;
    if (!window.confirm(`删除 list「${activeList.name}」？\n该 list 内的成员关系会一并清空（不影响志愿者本身）`)) return;
    setBusy(true);
    try {
      const ok = await deleteList(activeList.id);
      if (ok) {
        toast({ title: `已删除「${activeList.name}」` });
      } else {
        toast({ title: '删除失败', variant: 'destructive' });
      }
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-3">
      {/* Header: title + list switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <Heart className="h-4 w-4 text-rose-500" />
        <h2 className="font-serif text-lg font-semibold text-foreground">我的 list</h2>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <select
            value={activeListId ?? ''}
            onChange={(e) => setActiveListId(e.target.value)}
            className="h-8 rounded border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.members.length}){l.isDefault ? ' · 默认' : ''}
              </option>
            ))}
          </select>

          {!creatingNew ? (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCreatingNew(true)}
              aria-label="新建 list"
              title="新建 list"
            >
              <ListPlus className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onCreate();
                  else if (e.key === 'Escape') { setCreatingNew(false); setNewListName(''); }
                }}
                placeholder="list 名称"
                maxLength={32}
                className="h-8 w-32 rounded border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" disabled={busy || !newListName.trim()} onClick={() => void onCreate()}>
                创建
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { setCreatingNew(false); setNewListName(''); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {activeList && !activeList.isDefault && (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setRenameOpen(true)}
                aria-label="改名"
                title="改名"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => void onDelete()}
                aria-label="删除"
                title="删除"
                className="text-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Toolbar: add member + export */}
      {activeList && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2">
          <span className="text-xs text-muted-foreground">
            {activeList.members.length} 名成员
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              添加成员
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={activeList.members.length === 0}
              onClick={() => void downloadCsv(
                activeList.members.map((m) => m.volunteer.id),
                activeList.name,
              )}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>
      )}

      {/* Member list */}
      {!activeList || activeList.members.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
          {activeList?.isDefault
            ? '还没有关注任何志愿者. 去首页或志愿者详情页点 ❤︎ 加入.'
            : '尚无成员. 点上方「添加成员」.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {activeList.members.map((m) => {
            const isExpanded = expandedVolId === m.volunteer.id;
            return (
              <li key={m.id} className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3 p-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: deptColor(m.volunteer.departmentId) }}
                  >
                    {m.volunteer.chineseName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="truncate font-medium text-foreground">
                        {m.volunteer.chineseName}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {m.volunteer.volunteerCode}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.volunteer.department?.name} · {m.volunteer.region}
                    </p>
                    {m.note && (
                      <p className="truncate text-[11px] italic text-muted-foreground">
                        “{m.note}”
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onProxySubmit({
                      id: m.volunteer.id,
                      chineseName: m.volunteer.chineseName,
                    })}
                  >
                    <Send className="mr-1 h-3.5 w-3.5" />
                    代提交
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setNoteEditing({
                      listId: activeList!.id,
                      volunteerId: m.volunteer.id,
                      note: m.note ?? '',
                      name: m.volunteer.chineseName,
                    })}
                    aria-label="编辑备注"
                    title="编辑备注"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={async () => {
                      if (!window.confirm(`从「${activeList!.name}」移除 ${m.volunteer.chineseName}？`)) return;
                      try {
                        await setMemberOf(activeList!.id, m.volunteer.id, false);
                        toast({ title: '已移除' });
                      } catch {
                        toast({ title: '移除失败', variant: 'destructive' });
                      }
                    }}
                    aria-label="移除"
                    title="移除"
                    className="text-rose-500"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setExpandedVolId(isExpanded ? null : m.volunteer.id)}
                    aria-label={isExpanded ? '收起' : '展开'}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
                {isExpanded && (
                  <div className="border-t border-border p-3">
                    {services.length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted-foreground">
                        该志愿者暂无记录
                      </p>
                    ) : (
                      <ScrollableBarChart
                        bars={services.map((s) => ({
                          key: s.serviceItemId,
                          label: s.serviceItemName,
                          sublabel: s.departmentName,
                          value: Number(s.totalHours),
                          color: deptColor(s.departmentId),
                          onClick: () => recordsDialog.open(
                            `${m.volunteer.chineseName} / ${s.serviceItemName}`,
                            { volunteerId: m.volunteer.id, serviceItemId: s.serviceItemId },
                          ),
                        }))}
                        height={120}
                        formatValue={(n) => `${n}h`}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Dialogs */}
      {activeList && (
        <AddMemberDialog
          open={addOpen}
          listName={activeList.name}
          excludedIds={memberIds}
          onAdd={async (v, note) => {
            await setMemberOf(activeList.id, v.id, true, note);
            toast({ title: `已加入「${activeList.name}」`, description: `· ${v.chineseName}` });
          }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {activeList && !activeList.isDefault && (
        <RenameListDialog
          open={renameOpen}
          initialName={activeList.name}
          onSave={async (name) => {
            const ok = await renameList(activeList.id, name);
            if (ok) toast({ title: `已更名为「${name}」` });
            else toast({ title: '改名失败', variant: 'destructive' });
          }}
          onClose={() => setRenameOpen(false)}
        />
      )}
      <NoteEditDialog
        open={!!noteEditing}
        initialNote={noteEditing?.note ?? ''}
        volunteerName={noteEditing?.name ?? ''}
        onSave={async (note) => {
          if (!noteEditing) return;
          await setMemberNote(noteEditing.listId, noteEditing.volunteerId, note);
          toast({ title: '备注已更新' });
        }}
        onClose={() => setNoteEditing(null)}
      />
    </section>
  );
};

export default ListsSection;
