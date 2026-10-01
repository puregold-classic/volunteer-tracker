import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormField, FormSelect } from '@/components/shared/form-fields';
import { AccountPicker } from './AccountPicker';
import { forumService } from '@/services/forumService';
import type { ForumAccount, ForumCircle } from '@/services/types';

export type CircleAction = { title: string; description: string; run: () => Promise<ForumCircle> };
export function CircleRoles({ circle, onAction }: { circle: ForumCircle; onAction: (action: CircleAction) => void }) {
  const [selected, setSelected] = useState<ForumAccount[]>([]);
  const [operation, setOperation] = useState('STEWARD');
  const [sourceId, setSourceId] = useState('');
  const cap = circle.capabilities;
  const owners = circle.roles.filter((r) => r.role === 'OWNER');
  const transferSource = cap.isSystemAdmin ? (sourceId || owners[0]?.account.accountId || '') : cap.accountId;
  const canAssign = cap.canManageStewards || cap.canManageOwners || cap.canTransferOwnership;
  const hasSource = cap.isSystemAdmin ? owners.length > 0 : cap.circleRole === 'OWNER';
  return <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div><h2 className="font-serif text-xl font-semibold">圈务成员</h2><p className="mt-1 text-sm text-muted-foreground">圈主负责圈子设置与协管员任命，协管员协助维护讨论。</p></div>
    {circle.needsOwner && <p className="rounded-xl bg-muted p-3 text-sm">当前没有有效圈主，等待系统管理员指派。</p>}
    <ul className="divide-y divide-border">{circle.roles.map(({ role, account }) => <li key={account.accountId} className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="flex items-center gap-2"><span className="text-sm font-medium">{account.name}</span><Badge variant="outline">{role === 'OWNER' ? '圈主' : '协管员'}</Badge>{account.isActive === false && <span className="text-xs text-muted-foreground">已停用</span>}</div>
      {(role === 'OWNER' ? cap.canManageOwners : cap.canManageStewards) && <Button size="sm" variant="ghost" aria-label={`移除${role === 'OWNER' ? '圈主' : '协管员'} ${account.name}`} onClick={() => onAction({ title: `移除${role === 'OWNER' ? '圈主' : '协管员'}`, description: `确认移除 ${account.name} 的圈务身份？对方仍可正常浏览和参与开放的圈子。`, run: () => forumService.setRole(circle.id, account.accountId, role, true) })}>移除</Button>}
    </li>)}</ul>
    {canAssign && <div className="space-y-4 border-t border-border pt-5">
      <FormField label="圈务操作"><FormSelect aria-label="圈务操作" value={operation} onChange={(e) => { setOperation(e.target.value); setSelected([]); }}>
        {cap.canManageStewards && <option value="STEWARD">任命协管员</option>}
        {cap.canManageOwners && <option value="OWNER">任命圈主</option>}
        {cap.canTransferOwnership && hasSource && <option value="TRANSFER">转让圈主</option>}
      </FormSelect></FormField>
      {operation === 'TRANSFER' && cap.isSystemAdmin && <FormField label="原圈主"><FormSelect aria-label="原圈主" value={transferSource} onChange={(e) => setSourceId(e.target.value)}>{owners.map(({ account }) => <option key={account.accountId} value={account.accountId}>{account.name}</option>)}</FormSelect></FormField>}
      <AccountPicker value={selected} onChange={setSelected} circleId={circle.id} />
      <Button disabled={!selected.length || (operation === 'TRANSFER' && (!transferSource || selected[0].accountId === transferSource))} onClick={() => {
        const target = selected[0];
        if (!target) return;
        const transferring = operation === 'TRANSFER';
        onAction({ title: transferring ? '转让圈主' : operation === 'OWNER' ? '任命圈主' : '任命协管员',
          description: transferring ? `确认将圈主身份转让给 ${target.name}？原圈主将失去此身份，其他圈主不受影响。` : `确认任命 ${target.name} 为本圈${operation === 'OWNER' ? '圈主' : '协管员'}？`,
          run: () => transferring ? forumService.transfer(circle.id, transferSource, target.accountId) : forumService.setRole(circle.id, target.accountId, operation as 'OWNER' | 'STEWARD'),
        });
      }}>{operation === 'TRANSFER' ? '转让圈主' : operation === 'OWNER' ? '任命圈主' : '任命协管员'}</Button>
    </div>}
  </section>;
}
