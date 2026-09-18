// v3.9: 个人简介 — a short self-authored intro on the volunteer's profile.
//
// Two shapes over the same data:
//   <BioDisplay>  read-only, used on VolunteerDetailPage (someone else's page)
//   <BioEditor>   self-service edit, used on MePage
//
// The 200-char cap is enforced server-side in VolunteerService.normalizeBio; the
// counter here is a convenience, not the guard. Keep BIO_MAX_LENGTH in sync.

import React, { useState } from 'react';
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

export const BioDisplay: React.FC<{ bio?: string | null; className?: string }> = ({
  bio,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);
  const text = (bio ?? '').trim();
  if (!text) return null;

  const needsClamp = charCount(text) > CLAMP_THRESHOLD;

  return (
    <div className={cn('text-sm leading-relaxed text-foreground/85', className)}>
      <p className={cn('whitespace-pre-wrap', needsClamp && !expanded && 'line-clamp-2')}>{text}</p>
      {needsClamp && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-primary hover:underline"
        >
          {expanded ? '收起' : '展开'}
        </button>
      )}
    </div>
  );
};

export const BioEditor: React.FC<{
  bio?: string | null;
  /** Called with the saved volunteer so the page can refresh its own copy. */
  onSaved?: (bio: string | null) => void;
}> = ({ bio, onSaved }) => {
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

  if (!editing) {
    return (
      <div className="mt-3">
        {current ? (
          <div className="flex items-start gap-2">
            <BioDisplay bio={current} className="min-w-0 flex-1" />
            <Button variant="ghost" size="sm" onClick={startEditing} className="shrink-0">
              编辑
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={startEditing}>
            + 添加个人简介
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <FormTextarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        autoFocus
        placeholder="一句话介绍自己，比如擅长的语种、参与的项目…"
      />
      <div className="flex items-center justify-between gap-3">
        <span className={cn('text-xs tabular-nums', overLimit ? 'text-destructive' : 'text-muted-foreground')}>
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
};
