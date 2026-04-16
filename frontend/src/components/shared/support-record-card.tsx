// Visual card for a single ProjectSupport record. Shared between MePage
// (own records, deletable) and VolunteerDetailPage (someone else's records,
// read-only). The `showDelete` prop gates the delete button — pages decide
// based on ownership / role.

import { Calendar, Clock3, Link2, Send, Tag, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProjectSupport } from '@services/types';
import { formatLocalDate } from '@/lib/date-utils';

export interface SupportRecordCardProps {
  support: ProjectSupport;
  onDelete?: (supportId: string) => void;
  /** v3 wave-2 step 3: open the link-project dialog for this record. */
  onLinkProject?: (support: ProjectSupport) => void;
  busy?: boolean;
  showDelete?: boolean;
  showId?: boolean;
}

export const SupportRecordCard: React.FC<SupportRecordCardProps> = ({
  support,
  onDelete,
  onLinkProject,
  busy = false,
  showDelete = true,
  showId = true,
}) => (
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
          {support.project && (
            <Badge variant="outline" className="gap-1 text-[10px] py-0.5">
              <Tag className="h-2.5 w-2.5" />
              {support.project.name}
            </Badge>
          )}
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
        {onLinkProject && support.status === 'ACTIVE' && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => onLinkProject(support)}
            disabled={busy}
            aria-label={support.project ? '修改关联项目' : '关联项目'}
            title={support.project ? '修改关联项目' : '关联项目'}
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {showDelete && support.status === 'ACTIVE' && onDelete && (
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

export default SupportRecordCard;
