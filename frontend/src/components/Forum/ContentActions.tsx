import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { DraftablePostForm, useForumDraftDock, type ForumDraftTarget } from './ForumDraftDock';
import { postService } from '@/services/postService';
import { forumError } from '@/services/forumService';
import type { ForumPost, ForumComment } from '@/services/types';
import { useAuth } from '@/context/AuthContext';

export function ContentActions({ content, post, management = false, onChanged }: { content: ForumPost | ForumComment; post?: ForumPost; management?: boolean; onChanged: (deleted?: boolean) => void }) {
  const { account } = useAuth();
  const { floatingScope, returnRequest, reveal } = useForumDraftDock();
  const comment = !('title' in content), label = comment ? '评论' : '帖子';
  const sourcePost = 'title' in content ? content : post;
  const draftScope = `${comment ? 'edit-comment' : 'edit-post'}:${content.id}`;
  const target: ForumDraftTarget | undefined = sourcePost ? {
    circleId: sourcePost.circle.id, circleSlug: sourcePost.circle.slug, circleName: sourcePost.circle.name,
    postId: sourcePost.id, postTitle: sourcePost.title, updatedAt: content.updatedAt, management,
    ...('title' in content ? { kind: 'edit-post' as const } : { kind: 'edit-comment' as const, commentId: content.id }),
  } : undefined;
  const [action, setAction] = useState<'edit' | 'delete' | 'restore' | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [editorActivity, setEditorActivity] = useState({ busy: false, uploading: false });
  const ask = (a: typeof action) => {
    setError('');
    if (a === 'edit' && floatingScope === draftScope) { reveal(); return; }
    setAction(a);
  };
  const ownContent = !!account && content.author.accountId === account.id;
  const canEdit = content.capabilities.canEdit && (management || ownContent);
  const canDelete = content.capabilities.canDelete && (management || ownContent);
  const canRestore = content.capabilities.canRestore && management;
  useEffect(() => {
    const returning = returnRequest?.target;
    if (canEdit && returnRequest?.scope === draftScope && returning && (returning.kind === 'edit-post' || returning.kind === 'edit-comment') && returning.management === management) {
      setError('');
      setAction('edit');
    }
  }, [returnRequest, draftScope, management, canEdit]);
  if (!canEdit && !canDelete && !canRestore) return null;
  return <>
    <div className="flex flex-wrap gap-1">
      {canEdit && target && <Button variant="ghost" size="sm" onClick={() => ask('edit')}>编辑{label}</Button>}
      {canDelete && <Button variant="ghost" size="sm" onClick={() => ask('delete')}>删除{label}</Button>}
      {canRestore && <Button variant="outline" size="sm" onClick={() => ask('restore')}>恢复{label}</Button>}
    </div>
    <Dialog open={action === 'edit'} onOpenChange={(open) => { if (!open && !busy && !editorActivity.busy && !editorActivity.uploading) setAction(null); }} title={`编辑${label}`} closeOnOutsideClick={false} className="sm:max-w-3xl">
      {action === 'edit' && target && <DraftablePostForm onActivityChange={setEditorActivity} target={target} draftScope={draftScope} initialUpdatedAt={content.updatedAt} onDetached={() => setAction(null)} circleId={'circle' in content ? content.circle.id : content.circleId} management={management} initialFormat={content.bodyFormat} initialTitle={'title' in content ? content.title : ''} initialBody={content.body || ''} comment={comment} submitLabel="保存修改" save={async ({ title, body, bodyFormat, updatedAt }) => {
        setBusy(true);
        try { await postService.edit(content.id, { body, bodyFormat, ...(!comment ? { title } : {}), updatedAt: updatedAt || content.updatedAt }, comment); }
        finally { setBusy(false); }
      }} onPublished={() => { setEditorActivity({ busy: false, uploading: false }); setAction(null); onChanged(); }} onCancel={() => { if (!busy && !editorActivity.busy && !editorActivity.uploading) setAction(null); }} />}
    </Dialog>
    <Dialog open={action === 'delete' || action === 'restore'} onOpenChange={(open) => { if (!open && !busy) setAction(null); }} title={`${action === 'delete' ? '删除' : '恢复'}${label}`} closeOnOutsideClick={false} footer={<><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>取消</Button><Button disabled={busy} onClick={() => {
      if (busy) return;
      setBusy(true); setError('');
      const deleted = action === 'delete';
      void postService.setDeleted(content.id, deleted, comment).then(() => { setAction(null); onChanged(deleted); }).catch((err) => setError(forumError(err))).finally(() => setBusy(false));
    }}>{busy ? '正在处理…' : '确认'}</Button></>}><p className="text-sm leading-7">{action === 'delete' ? `删除后，${label}将对普通浏览隐藏，历史记录仍保留。` : `恢复后，${label}会重新出现在讨论中。`}</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</Dialog>
  </>;
}
