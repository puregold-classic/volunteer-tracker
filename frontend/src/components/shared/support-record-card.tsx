// Visual card for a single ProjectSupport record. Shared between MePage
// (own records, deletable) and VolunteerDetailPage (someone else's records,
// read-only). The `showDelete` prop gates the delete button — pages decide
// based on ownership / role.

import { Calendar, Clock3, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProjectSupport } from '@services/types';

export interface SupportRecordCardProps {
  support: ProjectSupport;
  onDelete?: (supportId: string) => void;
  busy?: boolean;
  showDelete?: boolean;
}

export const SupportRecordCard: React.FC<SupportRecordCardProps> = ({
  support,
  onDelete,
  busy = false,
  showDelete = true,
}) => (
  <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {support.supportId}
          </span>
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
        </div>
        <p className="mt-1 font-serif text-sm font-semibold text-foreground">
          {support.serviceItem?.departmentName} / {support.serviceItem?.name}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {new Date(support.serviceDate).toISOString().split('T')[0]}
          <span>·</span>
          <Clock3 className="h-3 w-3" />
          <span className="tabular-nums">{support.duration}h</span>
        </div>
      </div>
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
    <p className="text-xs text-muted-foreground line-clamp-2">{support.description}</p>
  </div>
);

export default SupportRecordCard;
