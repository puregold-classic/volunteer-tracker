import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, FormInput, FormTextarea } from '@/components/shared/form-fields';
import { AccountPicker } from './AccountPicker';
import { forumError, forumService } from '@/services/forumService';
import type { ForumAccount, ForumCircle } from '@/services/types';

export function CircleForm({ circle, onSaved }: { circle?: ForumCircle; onSaved: (circle: ForumCircle) => void }) {
  const [name, setName] = useState(circle?.name || '');
  const [slug, setSlug] = useState(circle?.slug || '');
  const [description, setDescription] = useState(circle?.description || '');
  const [owners, setOwners] = useState<ForumAccount[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form className="space-y-4" onSubmit={(e) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || [...name.trim()].length > 40 || [...description.trim()].length > 500) { setError('圈名为 1–40 字，简介最多 500 字。'); return; }
    if (!circle && !owners.length) { setError('请至少指定一位圈主。'); return; }
    setBusy(true); setError('');
    const request = circle ? forumService.update(circle.id, { name, description, ...(circle.capabilities.canChangeSlug ? { slug } : {}) }) : forumService.create({ name, slug, description, ownerIds: owners.map((a) => a.accountId) });
    void request.then(onSaved).catch((err) => setError(forumError(err))).finally(() => setBusy(false));
  }}>
    <FormField label="圈名" required><FormInput aria-label="圈名" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：共读交流" required disabled={busy} /></FormField>
    {(!circle || circle.capabilities.canChangeSlug) && <FormField label="圈子地址" required hint="小写字母、数字和连字符；修改后原链接将失效。"><FormInput aria-label="圈子地址" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="reading-club" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={64} disabled={busy} /></FormField>}
    <FormField label="简介" hint={`${[...description].length} / 500`}><FormTextarea aria-label="简介" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="这个圈子适合聊些什么？" disabled={busy} /></FormField>
    {!circle && <FormField label="指定圈主" required hint="可以指定多位圈主。"><AccountPicker value={owners} onChange={setOwners} multiple disabled={busy} /></FormField>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button disabled={busy} type="submit">{busy ? '正在保存…' : circle ? '保存设置' : '创建圈子'}</Button>
  </form>;
}
