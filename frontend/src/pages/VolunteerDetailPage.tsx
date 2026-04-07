import { type ReactNode, useState } from 'react';
import { CalendarDays, ChevronLeft, Clock3, Mail, MessageCircleMore, Phone, Send, User2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { SectionHeader } from '@/components/shared/section-header';
import { StatCard } from '@/components/shared/stat-card';
import { useVolunteerDetail, NpsServiceType } from '@/hooks/useVolunteerDetail';

const NPS_SERVICE_TYPES = ['翻译', '校对', '管理', '技术'] as const;

interface VolunteerDetailPageProps {
  volunteerId: string;
  onBackHome: () => void;
}

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : '-');
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : '-');

function VolunteerDetailPage({ volunteerId, onBackHome }: VolunteerDetailPageProps) {
  const {
    loading,
    error,
    volunteer,
    services,
    hasMoreServices,
    loadingMore,
    showForm,
    appDate,
    appType,
    appDuration,
    appDescription,
    appSubmitting,
    appMessage,
    loadMore,
    toggleForm,
    submitApplication,
    setAppDate,
    setAppType,
    setAppDuration,
    setAppDescription,
  } = useVolunteerDetail(volunteerId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (loading) {
    return (
      <div className="space-y-6">
        <Button type="button" variant="ghost" onClick={onBackHome}><ChevronLeft className="h-4 w-4" />返回首页</Button>
        <Card className="p-10 text-center text-sm text-neutral-500 dark:text-neutral-400">正在加载志愿者详情...</Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button type="button" variant="ghost" onClick={onBackHome}><ChevronLeft className="h-4 w-4" />返回首页</Button>
        <ErrorState title="志愿者详情加载失败" description={error} actionLabel="返回首页" onAction={onBackHome} />
      </div>
    );
  }

  if (!volunteer) {
    return (
      <div className="space-y-6">
        <Button type="button" variant="ghost" onClick={onBackHome}><ChevronLeft className="h-4 w-4" />返回首页</Button>
        <EmptyState title="暂无详情数据" description="当前未获取到该志愿者资料。" actionLabel="返回首页" onAction={onBackHome} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button type="button" variant="ghost" onClick={onBackHome}><ChevronLeft className="h-4 w-4" />返回首页</Button>

      <Card variant="glass" className="overflow-hidden">
        <div className="h-28 bg-[linear-gradient(135deg,rgba(14,165,233,0.22),rgba(59,130,246,0.12),rgba(168,85,247,0.18))]" />
        <div className="relative -mt-10 p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-end gap-4">
              <img src={volunteer.avatar} alt={volunteer.chineseName} className="h-20 w-20 rounded-[1.5rem] border-4 border-white object-cover shadow-lg dark:border-neutral-950" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{volunteer.chineseName}</h1>
                  <Badge variant={volunteer.status === '在职' ? 'success' : 'outline'}>{volunteer.status}</Badge>
                </div>
                <p className="mt-1 text-base text-neutral-500 dark:text-neutral-400">{volunteer.englishName || '—'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">ID：{volunteer.id}</Badge>
                  <Badge variant="info">地区：{volunteer.region || '-'}</Badge>
                  {volunteer.services.slice(0, 3).map((service) => <Badge key={service} variant="default">{service}</Badge>)}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline"><Phone className="h-4 w-4" />联系</Button>
              <Button type="button" variant="outline"><MessageCircleMore className="h-4 w-4" />分配任务</Button>
              <Button type="button" onClick={toggleForm}><Send className="h-4 w-4" />{showForm ? '收起申请入口' : '提交 NPS 申请'}</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="非项目时长" value={`${volunteer.nonProjectHours}h`} hint="累计非项目服务时间" icon={<Clock3 className="h-5 w-5" />} />
        <StatCard label="服务记录数" value={`${volunteer.nonProjectCount} 次`} hint="历史记录总量" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="加入时间" value={volunteer.joinDate ? formatDate(volunteer.joinDate) : '-'} hint="成员进入系统时间" icon={<User2 className="h-5 w-5" />} />
        <StatCard label="最近更新" value={formatDate(volunteer.updatedAt)} hint="资料最后更新时间" icon={<User2 className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card variant="elevated" className="p-6">
          <SectionHeader eyebrow="key info" title="关键信息" description="先看联系方式、账号状态、服务方向与时间元数据。" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoBlock label="邮箱" value={volunteer.email || '-'} icon={<Mail className="h-4 w-4 text-neutral-400" />} />
            <InfoBlock label="电话" value={volunteer.phone || '-'} icon={<Phone className="h-4 w-4 text-neutral-400" />} />
            <InfoBlock label="创建时间" value={formatDateTime(volunteer.createdAt)} />
            <InfoBlock label="更新时间" value={formatDateTime(volunteer.updatedAt)} />
            <InfoBlock label="服务方向" value={volunteer.services.length ? volunteer.services.join('、') : '-'} />
            <InfoBlock label="状态" value={volunteer.status} />
          </div>
        </Card>

        <Card variant="elevated" className="p-6">
          <SectionHeader eyebrow="records" title="服务记录区" description="保留原分页加载逻辑，统一成可快速扫读的记录卡片。" />
          <div className="mt-5 space-y-3">
            {services.length === 0 ? (
              <EmptyState title="暂无非项目服务记录" description="该志愿者还没有可展示的非项目服务条目。" />
            ) : (
              services.map((record) => (
                <Card key={record.serviceId} className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="info">{record.serviceType}</Badge>
                        <Badge variant="outline">{record.serviceId}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{record.description || '—'}</p>
                    </div>
                    <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-right dark:bg-neutral-900">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">服务日期</p>
                      <p className="mt-1 font-medium">{formatDate(record.serviceDate)}</p>
                      <p className="mt-2 text-sm font-semibold text-teal-600 dark:text-teal-300">{record.duration}h</p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
          {hasMoreServices && (
            <div className="mt-4">
              <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? '加载中...' : '查看更多记录'}
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Card variant="glass" className="p-6">
        <SectionHeader eyebrow="action" title="行动区 / NPS 申请入口" description="保持既有申请参数与提交链路不变，只重做信息分区与确认体验。" />
        {!showForm ? (
          <div className="mt-5 rounded-3xl border border-dashed border-neutral-200 bg-neutral-50/70 p-6 dark:border-neutral-700 dark:bg-neutral-900/50">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">提交前请准备：服务日期、服务类型、时长、服务描述。表单开启后仍沿用现有申请接口和审核流程。</p>
            <div className="mt-4"><Button type="button" onClick={toggleForm}>打开申请表单</Button></div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2"><label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">服务日期</label><Input type="date" value={appDate} onChange={(e) => setAppDate(e.target.value)} /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">服务类型</label><Select value={appType} onChange={(e) => setAppType(e.target.value as NpsServiceType)}>{NPS_SERVICE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</Select></div>
              <div className="space-y-2"><label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">服务时长</label><Input type="number" step="0.5" min="0.5" value={appDuration} onChange={(e) => setAppDuration(e.target.value)} placeholder="时长(小时)" /></div>
              <div className="space-y-2 md:col-span-2 xl:col-span-1"><label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">服务描述</label><textarea value={appDescription} onChange={(e) => setAppDescription(e.target.value)} placeholder="服务描述（至少5字）" className="min-h-[120px] w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base sm:text-sm text-neutral-900 shadow-sm outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:focus:border-teal-500/60 dark:focus:ring-teal-500/10" /></div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button className="w-full sm:w-auto" type="button" disabled={appSubmitting || !volunteer} onClick={() => setConfirmOpen(true)}>{appSubmitting ? '提交中...' : '确认提交申请'}</Button>
              <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={toggleForm}>收起表单</Button>
            </div>
            {appMessage && <p className="text-sm text-neutral-600 dark:text-neutral-300">{appMessage}</p>}
          </div>
        )}
      </Card>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认提交 NPS 申请？"
        description="将沿用现有申请接口，进入审核流程。"
        confirmText={appSubmitting ? '提交中...' : '确认提交'}
        onConfirm={submitApplication}
      />
    </div>
  );
}

function InfoBlock({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return <div className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900"><p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p><p className="mt-2 flex items-center gap-2 font-medium">{icon}{value}</p></div>;
}

export default VolunteerDetailPage;
