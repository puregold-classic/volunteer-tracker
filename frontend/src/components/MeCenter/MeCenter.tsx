import React, { useMemo } from 'react';
import { CalendarDays, FileText, Layers3, LogOut, MapPinned, RefreshCcw, UserRound } from 'lucide-react';
import type { Volunteer } from '@services/types';
import { Account } from '@services/authService';
import { NonProjectServiceRecord } from '@services/serviceRecordService';
import { MyApplicationRecord } from '@services/applicationService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { SectionHeader } from '@/components/shared/section-header';
import { StatCard } from '@/components/shared/stat-card';

interface MeCenterProps {
  account: Account | null;
  homeTotalVolunteers: number;
  meVolunteer: Volunteer | null;
  mePanelLoading: boolean;
  mePanelError: string;
  meServices: NonProjectServiceRecord[];
  meHasMoreServices: boolean;
  meServicesLoadingMore: boolean;
  myApplications: MyApplicationRecord[];
  myApplicationsLoading: boolean;
  myApplicationsDeactivating: boolean;
  meApplicationDate: string;
  meApplicationType: '翻译' | '校对' | '管理' | '技术';
  meApplicationDuration: string;
  meApplicationDescription: string;
  meApplicationSubmitting: boolean;
  meApplicationMessage: string;
  showMeApplicationForm: boolean;
  meEditingServiceId: string | null;
  meEditDate: string;
  meEditType: '翻译' | '校对' | '管理' | '技术';
  meEditDuration: string;
  meEditDescription: string;
  meRecordActionSubmitting: boolean;
  meRecordActionMessage: string;
  onRefresh: () => void;
  onVolunteerDetail: (id: string) => void;
  onBackHome: () => void;
  onLogout: () => void;
  onLoadMore: () => void;
  onWithdrawApplication: (applicationId: string) => Promise<void> | void;
  onDeactivateAllMyApplications: () => Promise<void> | void;
  onResubmitApplication: (application: MyApplicationRecord) => void;
  onToggleApplicationForm: () => void;
  onSubmitApplication: () => void;
  onStartEdit: (record: NonProjectServiceRecord) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (record: NonProjectServiceRecord) => void;
  onSubmitDelete: (record: NonProjectServiceRecord) => void;
  setMeApplicationDate: (value: string) => void;
  setMeApplicationType: (value: '翻译' | '校对' | '管理' | '技术') => void;
  setMeApplicationDuration: (value: string) => void;
  setMeApplicationDescription: (value: string) => void;
  setMeEditDate: (value: string) => void;
  setMeEditType: (value: '翻译' | '校对' | '管理' | '技术') => void;
  setMeEditDuration: (value: string) => void;
  setMeEditDescription: (value: string) => void;
}

const NPS_SERVICE_TYPES = ['翻译', '校对', '管理', '技术'] as const;
const APPLICATION_STATUS_LABEL: Record<'pending' | 'approved' | 'rejected' | 'withdrawn', string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  withdrawn: '已撤回',
};

const fmtDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : '-');
const fmtDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : '-');

const MeCenter: React.FC<MeCenterProps> = ({
  account,
  homeTotalVolunteers,
  meVolunteer,
  mePanelLoading,
  mePanelError,
  meServices,
  meHasMoreServices,
  meServicesLoadingMore,
  myApplications,
  myApplicationsLoading,
  myApplicationsDeactivating,
  meApplicationDate,
  meApplicationType,
  meApplicationDuration,
  meApplicationDescription,
  meApplicationSubmitting,
  meApplicationMessage,
  showMeApplicationForm,
  meEditingServiceId,
  meEditDate,
  meEditType,
  meEditDuration,
  meEditDescription,
  meRecordActionSubmitting,
  meRecordActionMessage,
  onRefresh,
  onVolunteerDetail,
  onBackHome,
  onLogout,
  onLoadMore,
  onWithdrawApplication,
  onDeactivateAllMyApplications,
  onResubmitApplication,
  onToggleApplicationForm,
  onSubmitApplication,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onSubmitDelete,
  setMeApplicationDate,
  setMeApplicationType,
  setMeApplicationDuration,
  setMeApplicationDescription,
  setMeEditDate,
  setMeEditType,
  setMeEditDuration,
  setMeEditDescription,
}) => {
  const getChangeToValue = (item: MyApplicationRecord, field: 'serviceDate' | 'serviceType' | 'duration' | 'description') => {
    return item.changes.find((change) => change.field === field)?.to;
  };

  const getDescriptionSummary = (item: MyApplicationRecord) => {
    const raw = getChangeToValue(item, 'description');
    const text = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
    if (!text) return '-';
    return text.length > 18 ? `${text.slice(0, 18)}...` : text;
  };

  const getServiceTypeLabel = (item: MyApplicationRecord) => {
    const raw = getChangeToValue(item, 'serviceType');
    const text = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
    return text || '-';
  };

  const pendingCount = useMemo(() => myApplications.filter((item) => item.status === 'pending').length, [myApplications]);

  if (mePanelLoading) {
    return <Card className="p-10 text-center text-sm text-neutral-500 dark:text-neutral-400">正在加载个人中心数据...</Card>;
  }

  return (
    <section className="space-y-6">
      {mePanelError && <ErrorState title="个人中心部分数据加载异常" description={mePanelError} />}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card variant="glass" className="p-5">
            <div className="flex flex-col items-start gap-4">
              <img
                src={meVolunteer?.avatar || 'https://ui-avatars.com/api/?name=User&background=random'}
                alt={meVolunteer?.chineseName || account?.name || '用户头像'}
                className="h-20 w-20 rounded-[1.5rem] border border-white/70 object-cover shadow-lg dark:border-neutral-800"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600 dark:text-teal-300">personal center</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{meVolunteer?.chineseName || account?.name || '-'}</h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{meVolunteer?.englishName || account?.email || '-'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{meVolunteer?.id || account?.volunteerId || '未绑定ID'}</Badge>
                <Badge variant={meVolunteer?.status === '在职' ? 'success' : 'outline'}>{meVolunteer?.status || '未绑定志愿者'}</Badge>
                <Badge variant="info">{meVolunteer?.region || '地区未设置'}</Badge>
              </div>
            </div>
          </Card>

          <Card variant="elevated" className="p-5">
            <SectionHeader eyebrow="account" title="个人信息" />
            <div className="mt-4 space-y-3">
              <InfoItem label="姓名" value={account?.name || '-'} />
              <InfoItem label="邮箱" value={account?.email || '-'} />
              <InfoItem label="角色" value={account?.role || '-'} />
              <InfoItem label="志愿者 ID" value={account?.volunteerId || '未绑定'} />
              <InfoItem label="账号状态" value={account?.isActive ? '启用' : '停用'} />
              <InfoItem label="最近登录" value={fmtDateTime(account?.lastLoginAt)} />
              <InfoItem label="服务方向" value={meVolunteer?.services?.length ? meVolunteer.services.join('、') : '暂无'} />
              <InfoItem label="加入时间" value={fmtDate(meVolunteer?.joinDate)} />
            </div>
          </Card>

          <Card variant="elevated" className="p-5">
            <SectionHeader eyebrow="actions" title="功能操作" />
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" variant="outline" onClick={onRefresh}><RefreshCcw className="h-4 w-4" />刷新面板</Button>
              <Button type="button" variant="outline" disabled={!meVolunteer} onClick={() => meVolunteer && onVolunteerDetail(meVolunteer.id)}><UserRound className="h-4 w-4" />查看个人详情</Button>
              <Button type="button" variant="ghost" onClick={onBackHome}><MapPinned className="h-4 w-4" />返回首页</Button>
              <Button type="button" variant="ghost" onClick={onLogout}><LogOut className="h-4 w-4" />退出账号</Button>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <StatCard label="累计非项目时长" value={`${meVolunteer?.nonProjectHours ?? 0}h`} icon={<CalendarDays className="h-5 w-5" />} />
            <StatCard label="累计服务次数" value={`${meVolunteer?.nonProjectCount ?? 0}次`} icon={<Layers3 className="h-5 w-5" />} />
            <StatCard label="待处理申请" value={pendingCount} icon={<FileText className="h-5 w-5" />} />
            <StatCard label="本地志愿者数" value={homeTotalVolunteers} icon={<MapPinned className="h-5 w-5" />} />
          </div>
        </div>

        <div className="space-y-6">
          <Card variant="elevated" className="p-6">
            <SectionHeader
              eyebrow="records"
              title="我的非项目服务记录"
              description="保持现有增删改申请逻辑，只调整成右侧主工作区。"
              actions={
                <Button type="button" variant={showMeApplicationForm ? 'outline' : 'success'} onClick={onToggleApplicationForm}>
                  {showMeApplicationForm ? '收起表单' : '+ 提交服务记录'}
                </Button>
              }
            />

            <div className="mt-5 space-y-3">
              {meServices.length === 0 ? (
                <EmptyState title="暂无非项目服务记录" description="你还没有可展示的非项目服务条目。" />
              ) : (
                meServices.map((record) => (
                  <Card key={record.serviceId} className="p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="info">{record.serviceType}</Badge>
                          <Badge variant="outline">{record.serviceId}</Badge>
                          <Badge variant="warning">{record.duration}h</Badge>
                        </div>
                        <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">{record.description || '-'}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">服务日期：{fmtDate(record.serviceDate)}</p>
                      </div>

                      {meVolunteer?.id === record.volunteerId && (
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" disabled={meRecordActionSubmitting} onClick={() => onStartEdit(record)}>修改（提交审核）</Button>
                          <Button type="button" variant="destructive" size="sm" disabled={meRecordActionSubmitting} onClick={() => onSubmitDelete(record)}>删除（提交审核）</Button>
                        </div>
                      )}
                    </div>

                    {meEditingServiceId === record.serviceId && (
                      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <Input type="date" value={meEditDate} onChange={(e) => setMeEditDate(e.target.value)} />
                          <Select value={meEditType} onChange={(e) => setMeEditType(e.target.value as '翻译' | '校对' | '管理' | '技术')}>
                            {NPS_SERVICE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                          </Select>
                          <Input type="number" step="0.5" min="0.5" value={meEditDuration} onChange={(e) => setMeEditDuration(e.target.value)} placeholder="时长(小时)" />
                          <Input type="text" value={meEditDescription} onChange={(e) => setMeEditDescription(e.target.value)} placeholder="服务描述（至少5字）" />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button type="button" disabled={meRecordActionSubmitting} onClick={() => onSubmitEdit(record)}>{meRecordActionSubmitting ? '提交中...' : '确认提交修改'}</Button>
                          <Button type="button" variant="outline" disabled={meRecordActionSubmitting} onClick={onCancelEdit}>取消</Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>

            {meHasMoreServices && (
              <div className="mt-4"><Button type="button" variant="outline" onClick={onLoadMore} disabled={meServicesLoadingMore}>{meServicesLoadingMore ? '加载中...' : '查看更多记录'}</Button></div>
            )}

            <div className="mt-5 rounded-3xl border border-dashed border-neutral-200 bg-neutral-50/70 p-5 dark:border-neutral-700 dark:bg-neutral-900/60">
              {!showMeApplicationForm ? (
                <p className="text-sm text-neutral-600 dark:text-neutral-300">申请前需填写：服务日期、服务类型、时长、服务描述。现有审核链路保持不变。</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Input type="date" value={meApplicationDate} onChange={(e) => setMeApplicationDate(e.target.value)} />
                    <Select value={meApplicationType} onChange={(e) => setMeApplicationType(e.target.value as '翻译' | '校对' | '管理' | '技术')}>
                      {NPS_SERVICE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </Select>
                    <Input type="number" step="0.5" min="0.5" value={meApplicationDuration} onChange={(e) => setMeApplicationDuration(e.target.value)} placeholder="时长(小时)" />
                    <Input type="text" value={meApplicationDescription} onChange={(e) => setMeApplicationDescription(e.target.value)} placeholder="服务描述（至少5字）" />
                  </div>
                  <Button type="button" onClick={onSubmitApplication} disabled={meApplicationSubmitting || !meVolunteer}>{meApplicationSubmitting ? '提交中...' : '确认提交'}</Button>
                </div>
              )}
              {meApplicationMessage && <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{meApplicationMessage}</p>}
              {meRecordActionMessage && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{meRecordActionMessage}</p>}
            </div>
          </Card>

          <Card variant="elevated" className="p-6">
            <SectionHeader
              eyebrow="applications"
              title="我的申请记录"
              description="保留撤回、重新提交与批量隐藏逻辑。"
              actions={
                <Button
                  type="button"
                  variant="outline"
                  disabled={myApplicationsDeactivating || myApplicationsLoading || myApplications.length === 0}
                  onClick={async () => {
                    const firstConfirm = window.confirm('确认清空“我的申请记录”？此操作不会删除数据，只会隐藏记录。');
                    if (!firstConfirm) return;
                    const secondConfirm = window.confirm('请再次确认：要清空当前账号下全部申请记录展示吗？');
                    if (!secondConfirm) return;
                    await onDeactivateAllMyApplications();
                  }}
                >
                  {myApplicationsDeactivating ? '清空中...' : '清空我的申请记录'}
                </Button>
              }
            />

            <div className="mt-5 space-y-3">
              {myApplicationsLoading ? (
                <Card className="p-6 text-sm text-neutral-500 dark:text-neutral-400">正在加载申请记录...</Card>
              ) : myApplications.length === 0 ? (
                <EmptyState title="暂无申请记录" description="提交 NPS 申请后，会在这里查看审核状态。" />
              ) : (
                myApplications.map((item) => (
                  <Card key={item.applicationId} className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{item.applicationType}</Badge>
                          <Badge variant={item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'destructive' : item.status === 'pending' ? 'pending' : 'outline'}>
                            {APPLICATION_STATUS_LABEL[item.status] || item.status}
                          </Badge>
                          <Badge variant="outline">{item.applicationId}</Badge>
                        </div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-300">服务类型：{getServiceTypeLabel(item)} · 内容摘要：{getDescriptionSummary(item)}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">提交时间：{fmtDateTime(item.createdAt)}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">审核意见：{item.reviewNotes?.trim() || '-'}</p>
                        {item.submittedBy?.name && account?.name && item.submittedBy.name !== account.name && (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">代提交：{item.submittedBy.name}</p>
                        )}
                      </div>
                      {(item.status === 'pending' || item.status === 'rejected') && (
                        <div className="flex flex-wrap gap-2">
                          {item.status === 'pending' && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                const confirmed = window.confirm(`确认撤回该申请？\n申请ID: ${item.applicationId}`);
                                if (!confirmed) return;
                                await onWithdrawApplication(item.applicationId);
                              }}
                            >
                              撤回
                            </Button>
                          )}
                          {item.status === 'rejected' && (
                            <Button type="button" variant="outline" size="sm" onClick={() => onResubmitApplication(item)}>
                              重新提交
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-50">{value}</p>
    </div>
  );
}

export default MeCenter;
