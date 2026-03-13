import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CalendarDays, ChevronLeft, Clock3, Mail, MessageCircleMore, Phone, Send, User2 } from 'lucide-react';
import type { Volunteer } from '@services/types';
import type { NonProjectServiceRecord } from '@services/serviceRecordService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { SectionHeader } from '@/components/shared/section-header';
import { StatCard } from '@/components/shared/stat-card';

const NPS_SERVICE_TYPES = ['翻译', '校对', '管理', '技术'] as const;
type NpsServiceType = (typeof NPS_SERVICE_TYPES)[number];

interface VolunteerDetailPageProps {
  volunteerDetailLoading: boolean;
  volunteerDetailError: string;
  volunteerDetail: Volunteer | null;
  volunteerDetailServices: NonProjectServiceRecord[];
  volunteerDetailHasMoreServices: boolean;
  volunteerDetailServicesLoadingMore: boolean;
  showDetailApplicationForm: boolean;
  detailApplicationDate: string;
  detailApplicationType: NpsServiceType;
  detailApplicationDuration: string;
  detailApplicationDescription: string;
  detailApplicationSubmitting: boolean;
  detailApplicationMessage: string;
  onBackHome: () => void;
  onLoadMoreServices: () => void;
  onToggleApplicationForm: () => void;
  onSubmitApplication: () => void;
  setDetailApplicationDate: (value: string) => void;
  setDetailApplicationType: (value: NpsServiceType) => void;
  setDetailApplicationDuration: (value: string) => void;
  setDetailApplicationDescription: (value: string) => void;
}

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : '-');
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : '-');

function VolunteerDetailPage(props: VolunteerDetailPageProps) {
  const {
    volunteerDetailLoading,
    volunteerDetailError,
    volunteerDetail,
    volunteerDetailServices,
    volunteerDetailHasMoreServices,
    volunteerDetailServicesLoadingMore,
    showDetailApplicationForm,
    detailApplicationDate,
    detailApplicationType,
    detailApplicationDuration,
    detailApplicationDescription,
    detailApplicationSubmitting,
    detailApplicationMessage,
    onBackHome,
    onLoadMoreServices,
    onToggleApplicationForm,
    onSubmitApplication,
    setDetailApplicationDate,
    setDetailApplicationType,
    setDetailApplicationDuration,
    setDetailApplicationDescription,
  } = props;
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (volunteerDetailLoading) {
    return (
      <div className="space-y-6">
        <Button type="button" variant="ghost" onClick={onBackHome}><ChevronLeft className="h-4 w-4" />返回首页</Button>
        <Card className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">正在加载志愿者详情...</Card>
      </div>
    );
  }

  if (volunteerDetailError) {
    return (
      <div className="space-y-6">
        <Button type="button" variant="ghost" onClick={onBackHome}><ChevronLeft className="h-4 w-4" />返回首页</Button>
        <ErrorState title="志愿者详情加载失败" description={volunteerDetailError} actionLabel="返回首页" onAction={onBackHome} />
      </div>
    );
  }

  if (!volunteerDetail) {
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
              <img src={volunteerDetail.avatar} alt={volunteerDetail.chineseName} className="h-20 w-20 rounded-[1.5rem] border-4 border-white object-cover shadow-lg dark:border-slate-950" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{volunteerDetail.chineseName}</h1>
                  <Badge variant={volunteerDetail.status === '在职' ? 'success' : 'outline'}>{volunteerDetail.status}</Badge>
                </div>
                <p className="mt-1 text-base text-slate-500 dark:text-slate-400">{volunteerDetail.englishName || '—'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">ID：{volunteerDetail.id}</Badge>
                  <Badge variant="info">地区：{volunteerDetail.region || '-'}</Badge>
                  {volunteerDetail.services.slice(0, 3).map((service) => <Badge key={service} variant="default">{service}</Badge>)}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline"><Phone className="h-4 w-4" />联系</Button>
              <Button type="button" variant="outline"><MessageCircleMore className="h-4 w-4" />分配任务</Button>
              <Button type="button" onClick={onToggleApplicationForm}><Send className="h-4 w-4" />{showDetailApplicationForm ? '收起申请入口' : '提交 NPS 申请'}</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="非项目时长" value={`${volunteerDetail.nonProjectHours}h`} hint="累计非项目服务时间" icon={<Clock3 className="h-5 w-5" />} />
        <StatCard label="服务记录数" value={`${volunteerDetail.nonProjectCount} 次`} hint="历史记录总量" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="加入时间" value={volunteerDetail.joinDate ? formatDate(volunteerDetail.joinDate) : '-'} hint="成员进入系统时间" icon={<User2 className="h-5 w-5" />} />
        <StatCard label="最近更新" value={formatDate(volunteerDetail.updatedAt)} hint="资料最后更新时间" icon={<User2 className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card variant="elevated" className="p-6">
          <SectionHeader eyebrow="key info" title="关键信息" description="先看联系方式、账号状态、服务方向与时间元数据。" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoBlock label="邮箱" value={volunteerDetail.email || '-'} icon={<Mail className="h-4 w-4 text-slate-400" />} />
            <InfoBlock label="电话" value={volunteerDetail.phone || '-'} icon={<Phone className="h-4 w-4 text-slate-400" />} />
            <InfoBlock label="创建时间" value={formatDateTime(volunteerDetail.createdAt)} />
            <InfoBlock label="更新时间" value={formatDateTime(volunteerDetail.updatedAt)} />
            <InfoBlock label="服务方向" value={volunteerDetail.services.length ? volunteerDetail.services.join('、') : '-'} />
            <InfoBlock label="状态" value={volunteerDetail.status} />
          </div>
        </Card>

        <Card variant="elevated" className="p-6">
          <SectionHeader eyebrow="records" title="服务记录区" description="保留原分页加载逻辑，统一成可快速扫读的记录卡片。" />
          <div className="mt-5 space-y-3">
            {volunteerDetailServices.length === 0 ? (
              <EmptyState title="暂无非项目服务记录" description="该志愿者还没有可展示的非项目服务条目。" />
            ) : (
              volunteerDetailServices.map((record) => (
                <Card key={record.serviceId} className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="info">{record.serviceType}</Badge>
                        <Badge variant="outline">{record.serviceId}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{record.description || '—'}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right dark:bg-slate-900">
                      <p className="text-xs text-slate-500 dark:text-slate-400">服务日期</p>
                      <p className="mt-1 font-medium">{formatDate(record.serviceDate)}</p>
                      <p className="mt-2 text-sm font-semibold text-sky-600 dark:text-sky-300">{record.duration}h</p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
          {volunteerDetailHasMoreServices && (
            <div className="mt-4">
              <Button type="button" variant="outline" onClick={onLoadMoreServices} disabled={volunteerDetailServicesLoadingMore}>
                {volunteerDetailServicesLoadingMore ? '加载中...' : '查看更多记录'}
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Card variant="glass" className="p-6">
        <SectionHeader eyebrow="action" title="行动区 / NPS 申请入口" description="保持既有申请参数与提交链路不变，只重做信息分区与确认体验。" />
        {!showDetailApplicationForm ? (
          <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 p-6 dark:border-slate-700 dark:bg-slate-900/50">
            <p className="text-sm text-slate-600 dark:text-slate-300">提交前请准备：服务日期、服务类型、时长、服务描述。表单开启后仍沿用现有申请接口和审核流程。</p>
            <div className="mt-4"><Button type="button" onClick={onToggleApplicationForm}>打开申请表单</Button></div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300">服务日期</label><Input type="date" value={detailApplicationDate} onChange={(e) => setDetailApplicationDate(e.target.value)} /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300">服务类型</label><Select value={detailApplicationType} onChange={(e) => setDetailApplicationType(e.target.value as NpsServiceType)}>{NPS_SERVICE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</Select></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300">服务时长</label><Input type="number" step="0.5" min="0.5" value={detailApplicationDuration} onChange={(e) => setDetailApplicationDuration(e.target.value)} placeholder="时长(小时)" /></div>
              <div className="space-y-2 md:col-span-2 xl:col-span-1"><label className="text-sm font-medium text-slate-700 dark:text-slate-300">服务描述</label><textarea value={detailApplicationDescription} onChange={(e) => setDetailApplicationDescription(e.target.value)} placeholder="服务描述（至少5字）" className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base sm:text-sm text-slate-900 shadow-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-sky-500/60 dark:focus:ring-sky-500/10" /></div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button className="w-full sm:w-auto" type="button" disabled={detailApplicationSubmitting || !volunteerDetail} onClick={() => setConfirmOpen(true)}>{detailApplicationSubmitting ? '提交中...' : '确认提交申请'}</Button>
              <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={onToggleApplicationForm}>收起表单</Button>
            </div>
            {detailApplicationMessage && <p className="text-sm text-slate-600 dark:text-slate-300">{detailApplicationMessage}</p>}
          </div>
        )}
      </Card>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认提交 NPS 申请？"
        description="将沿用现有申请接口，进入审核流程。"
        confirmText={detailApplicationSubmitting ? '提交中...' : '确认提交'}
        onConfirm={onSubmitApplication}
      />
    </div>
  );
}

function InfoBlock({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900"><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-2 flex items-center gap-2 font-medium">{icon}{value}</p></div>;
}

export default VolunteerDetailPage;
