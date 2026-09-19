// v3.9: 个人简介 — a short self-authored intro on the volunteer's profile.
//
// Two shapes over the same data:
//   <BioDisplay>  read-only, used on VolunteerDetailPage (someone else's page)
//   <BioEditor>   self-service edit, used on MePage
//
// Both render the same block: a left accent rule over a faint tint, which
// separates prose from the metadata row above it without shouting. The bio sits
// *after* the metadata on both pages — name and identity facts are what people
// scan for, prose comes last.
//
// The 200-char cap is enforced server-side in VolunteerService.normalizeBio; the
// counter here is a convenience, not the guard. Keep BIO_MAX_LENGTH in sync.

import React, { useState } from 'react';
import { ChevronDown, Pencil, Plus } from 'lucide-react';
import { Button } from '@components/ui/button';
import { FormTextarea } from '@components/shared/form-fields';
import { toast } from '@/hooks/use-toast';
import { volunteerService } from '@services/volunteerService';
import { cn } from '@/lib/utils';

export const BIO_MAX_LENGTH = 200;

/** Code-point length, so an emoji counts as 1 the way the backend counts it. */
const charCount = (text: string) => [...text].length;

// Long bios collapse to a couple of lines. The threshold is deliberately below
// the 200 cap: a 3-line blurb is fine inline, and a toggle on a 2-line bio is
// just noise.
const CLAMP_THRESHOLD = 90;

/** The shared shell — accent rule + tint. Keeps both shapes visually identical. */
const BioShell: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => (
  <div
    className={cn(
      'relative rounded-lg border-l-2 border-primary/30 bg-muted/40 py-2 pl-3 pr-3',
      className,
    )}
  >
    {children}
  </div>
);

export const BioDisplay: React.FC<{
  bio?: string | null;
  className?: string;
  /** Extra right padding so text clears an absolutely-positioned action button. */
  reserveActionSpace?: boolean;
}> = ({ bio, className, reserveActionSpace = false }) => {
  const [expanded, setExpanded] = useState(false);
  const text = (bio ?? '').trim();
  if (!text) return null;

  const needsClamp = charCount(text) > CLAMP_THRESHOLD;

  return (
    <BioShell className={className}>
      <p
        className={cn(
          'whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80',
          reserveActionSpace && 'pr-6',
          needsClamp && !expanded && 'line-clamp-2',
        )}
      >
        {text}
      </p>
      {needsClamp && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          {expanded ? '收起' : '展开'}
          <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
    </BioShell>
  );
};

export const BioEditor: React.FC<{
  bio?: string | null;
  className?: string;
  /** Called with the server-normalized value so the page can update its copy. */
  onSaved?: (bio: string | null) => void;
}> = ({ bio, className, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bio ?? '');
  const [saving, setSaving] = useState(false);

  const current = (bio ?? '').trim();
  const count = charCount(draft);
  const overLimit = count > BIO_MAX_LENGTH;

  const startEditing = () => {
    setDraft(bio ?? '');
    setEditing(true);
  };

  const save = async () => {
    if (overLimit || saving) return;
    setSaving(true);
    try {
      const res = await volunteerService.updateMyBio(draft);
      if (res?.success) {
        // Trust the server's normalized value (trimmed, blank → null) rather
        // than the draft, so what's shown matches what's stored.
        const saved = res.data?.bio ?? null;
        onSaved?.(saved);
        setEditing(false);
        toast({ title: saved ? '简介已更新' : '简介已清空' });
      } else {
        toast({
          title: '保存失败',
          description: (res as any)?.error || '未知错误',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '保存失败',
        description: err?.message || '未知错误',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className={cn('space-y-2', className)}>
        <FormTextarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          autoFocus
          placeholder="一句话介绍自己，比如擅长的语种、参与的项目…"
        />
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              'text-xs tabular-nums',
              overLimit ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {count} / {BIO_MAX_LENGTH}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              取消
            </Button>
            <Button size="sm" onClick={save} disabled={saving || overLimit}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state: a dashed placeholder the same size as the filled block, so the
  // hero doesn't jump when the first bio is added.
  if (!current) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground',
          className,
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        添加个人简介
      </button>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <BioDisplay bio={current} reserveActionSpace />
      <button
        type="button"
        onClick={startEditing}
        aria-label="编辑个人简介"
        title="编辑个人简介"
        className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
