import { FollowCircle } from '@/components/Forum/ForumInteractions';
import { PostList } from '@/components/Forum/PostList';
import { CircleCover } from '@/components/Forum/CircleCover';
import { CircleFiles } from '@/components/Forum/CircleFiles';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Settings2, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCircle } from '@/components/Forum/useCircle';

export default function CirclePage() {
  const [params, setParams] = useSearchParams();
  const files = params.get('tab') === 'files';
  const { circle, setCircle, loading, error, refresh } = useCircle();
  return <div className="mx-auto max-w-4xl space-y-4 px-2 py-4 sm:px-4 sm:py-6">
    <Link to="/forum" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />全部圈子</Link>
    {loading ? <p role="status" className="py-10 text-center text-muted-foreground">正在加载圈子…</p> : !circle ? <div role="alert" className="space-y-3 rounded-2xl border border-border p-8 text-center"><p>{error}</p><Button variant="outline" onClick={refresh}>重试</Button></div> : <>
      <section aria-label="圈子信息" className="rounded-2xl border border-border bg-card">
        <details key={circle.id} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4 [&::-webkit-details-marker]:hidden">
            {circle.coverId ? <CircleCover id={circle.coverId} name={circle.name} icon /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UsersRound aria-hidden="true" className="h-5 w-5" /></span>}
            <h1 className="min-w-0 flex-1 break-words text-base font-semibold [overflow-wrap:anywhere] sm:text-lg">{circle.name}</h1>
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><span className="group-open:hidden">圈子介绍</span><span className="hidden group-open:inline">收起介绍</span><ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" /></span>
          </summary>
          <div className="space-y-4 border-t border-border px-4 py-4 sm:px-5">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]">{circle.description || '在这里与同伴交流。'}</p>
            {!!circle.roles.length && <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{circle.roles.map(({ role, account }) => <span key={account.accountId}>{role === 'OWNER' ? '圈主' : '协管员'} · {account.name}{account.isActive === false ? '（已停用）' : ''}</span>)}</div>}
          </div>
        </details>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><nav aria-label="圈子内容" className="flex gap-2"><Button variant={files ? 'ghost' : 'secondary'} aria-pressed={!files} onClick={() => setParams({})}>讨论</Button><Button variant={files ? 'secondary' : 'ghost'} aria-pressed={files} onClick={() => setParams({ tab: 'files' })}>圈文件</Button></nav><div className="flex flex-wrap gap-2"><FollowCircle id={circle.id} following={circle.isFollowing} onChange={(isFollowing) => setCircle({ ...circle, isFollowing })} />{circle.capabilities.canViewManagement && <Button variant="outline" size="sm" asChild><Link to={`/forum/c/${circle.slug}/manage`}><Settings2 className="mr-1 h-4 w-4" />圈子管理</Link></Button>}</div></div>
      {files ? <CircleFiles key={circle.id} circle={circle} /> : <PostList key={circle.id} circle={circle} />}
    </>}
  </div>;
}
