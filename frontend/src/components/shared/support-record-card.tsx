// Visual card for a single ProjectSupport record. Shared between MePage
// (own records, deletable) and VolunteerDetailPage (someone else's records,
// read-only). The `showDelete` prop gates the delete button — pages decide
// based on ownership / role.

import { Calendar, Clock3, Link2, Pencil, Send, Tag, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProjectSupport } from '@services/types';
import { formatLocalDate } from '@/lib/date-utils';

export interface SupportRecordCardProps {
  support: ProjectSupport;
  onDelete?: (supportId: string) => void;
  /** Edit the record's date / duration / description (owner or admin). */
  onEdit?: (support: ProjectSupport) => void;
  /** v3.2: open the edit-tags dialog (post-hoc attach/detach tags on own PS). */
  onEditTags?: (support: ProjectSupport) => void;
  busy?: boolean;
  showDelete?: boolean;
  showEdit?: boolean;
  showId?: boolean;
}

export const SupportRecordCard: React.FC<SupportRecordCardProps> = ({
  support,
  onDelete,
  onEdit,
  onEditTags,
  busy = false,
  showDelete = true,
  showEdit = true,
  showId = true,
}) => {
  // Training-attendance records are organizer-owned (batch-entered); the owner
  // can't edit or delete them — only view. Mirrors the backend guard.
  const isAttendance = support.serviceItem?.category === 'TRAINING_ATTENDANCE';
  const canMutate = support.status === 'ACTIVE' && !isAttendance;
  return (
  <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {showId && (
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {support.supportId}
            </span>
          )}
          <Badge
            variant={support.status === 'ACTIVE' ? 'success' : 'outline'}
            className="text-[10px] py-0.5"
          >
            {support.statusDisplay}
          </Badge>
          {support.isProxy && (
            <Badge variant="info" className="text-[10px] py-0.5">
              代提交
            </Badge>
          )}
          {/* v3.2: show all attached tags (Project concept fully replaced). */}
          {support.tags && support.tags.map((t) => (
            <Badge
              key={t.attachmentId}
              variant="outline"
              className="gap-1 text-[10px] py-0.5"
              title={t.group ? `${t.group.name}: ${t.name}` : t.name}
            >
              <Tag className="h-2.5 w-2.5" />
              {t.name}
            </Badge>
          ))}
        </div>
        <p className="mt-1 font-serif text-sm font-semibold text-foreground">
          {support.serviceItem?.departmentName} / {support.serviceItem?.name}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatLocalDate(support.serviceDate)}
          <span>·</span>
          <Clock3 className="h-3 w-3" />
          <span className="tabular-nums">{support.duration}h</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {showEdit && onEdit && canMutate && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => onEdit(support)}
            disabled={busy}
            aria-label="编辑"
            title="编辑 时长 / 日期 / 描述"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {onEditTags && support.status === 'ACTIVE' && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => onEditTags(support)}
            disabled={busy}
            aria-label={support.tags && support.tags.length > 0 ? '修改标签' : '添加标签'}
            title={support.tags && support.tags.length > 0 ? '修改标签' : '添加标签'}
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {showDelete && onDelete && canMutate && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => onDelete(support.supportId)}
            disabled={busy}
            aria-label="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
    <p className="text-xs text-muted-foreground line-clamp-2">{support.description}</p>
    {support.isProxy && support.submittedBy && (
      <p className="flex items-center gap-1 text-[11px] text-accent">
        <Send className="h-3 w-3" />
        来源：{support.submittedBy.chineseName}（{support.submittedBy.volunteerCode}）
      </p>
    )}
  </div>
  );
};

export default SupportRecordCard;
