import React from 'react';
import type { Volunteer } from '@services/types';
import { Account } from '@services/authService';
import { NonProjectServiceRecord } from '@services/serviceRecordService';
import { MyApplicationRecord } from '@services/applicationService';

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
  withdrawn: '已撤回'
};

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
  setMeEditDescription
}) => {
  const getChangeToValue = (
    item: MyApplicationRecord,
    field: 'serviceDate' | 'serviceType' | 'duration' | 'description'
  ) => {
    return item.changes.find((change) => change.field === field)?.to;
  };

  const getDescriptionSummary = (item: MyApplicationRecord) => {
    const raw = getChangeToValue(item, 'description');
    const text = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
    if (!text) return '-';
    return text.length > 10 ? `${text.slice(0, 10)}...` : text;
  };

  const getServiceTypeLabel = (item: MyApplicationRecord) => {
    const raw = getChangeToValue(item, 'serviceType');
    const text = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
    return text || '-';
  };

  return (
    <section className="center-panel">
      <div className="center-panel__head">
        <h2>我的个人中心</h2>
        <button type="button" className="filter-reset" onClick={onRefresh}>刷新面板</button>
      </div>
      {mePanelLoading ? (
        <p className="center-empty">正在加载个人中心数据...</p>
      ) : (
        <div className="personal-shell">
          <section className="profile-hero">
            <div className="profile-hero__main">
              <img
                src={meVolunteer?.avatar || 'https://ui-avatars.com/api/?name=User&background=random'}
                alt={meVolunteer?.chineseName || account?.name || '用户头像'}
                className="profile-avatar"
              />
              <div className="profile-meta">
                <h3>{meVolunteer?.chineseName || account?.name || '-'}</h3>
                <p>{meVolunteer?.englishName || account?.email || '-'}</p>
                <div className="profile-tags">
                  <span>{meVolunteer?.id || account?.volunteerId || '未绑定ID'}</span>
                  <span className={meVolunteer?.status === '在职' ? 'is-active' : 'is-inactive'}>
                    {meVolunteer?.status || '未绑定志愿者'}
                  </span>
                  <span>{meVolunteer?.region || '地区未设置'}</span>
                </div>
              </div>
            </div>
            <p className="profile-note">服务方向：{meVolunteer?.services?.length ? meVolunteer.services.join('、') : '暂无'}</p>
            <p className="profile-note">加入时间：{meVolunteer?.joinDate ? new Date(meVolunteer.joinDate).toLocaleDateString() : '暂无'}</p>
          </section>

          <section className="service-board">
            <div className="board-item"><span>总时长</span><strong>{meVolunteer?.nonProjectHours ?? 0}h</strong></div>
            <div className="board-item"><span>本月</span><strong>{Math.min(meVolunteer?.nonProjectHours ?? 0, 20)}h</strong></div>
            <div className="board-item"><span>总次数</span><strong>{meVolunteer?.nonProjectCount ?? 0}次</strong></div>
          </section>

          <section className="quick-actions-panel">
            <h3>快捷操作</h3>
            <div className="quick-actions-row">
              <button type="button" className="action-chip" disabled={!meVolunteer} onClick={() => meVolunteer && onVolunteerDetail(meVolunteer.id)}>
                查看个人详情
              </button>
              <button type="button" className="action-chip" onClick={onBackHome}>返回首页地图</button>
              <button type="button" className="action-chip" onClick={onLogout}>退出账号</button>
            </div>
          </section>

          <section className="community-panel">
            <h3>我所在的社区</h3>
            <p>地区：{meVolunteer?.region || '暂无'} | 本地志愿者：{homeTotalVolunteers} 人</p>
            <p>账号角色：{account?.role || '-'} | 最近登录：{account?.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : '暂无'}</p>
          </section>

          <section className="nps-panel">
            <h3>我的非项目服务记录</h3>
            {meServices.length === 0 ? (
              <p className="center-empty">暂无非项目服务记录</p>
            ) : (
              <>
                <div className="nps-list">
                  {meServices.map((record) => (
                    <article key={record.serviceId} className="nps-item">
                      <div className="nps-item__head"><strong>{record.serviceType}</strong><span>{record.duration}h</span></div>
                      <p>{record.description}</p>
                      <small>{new Date(record.serviceDate).toLocaleDateString()} · {record.serviceId}</small>
                      {meVolunteer?.id === record.volunteerId && (
                        <div className="nps-item__actions">
                          <button
                            type="button"
                            className="action-chip"
                            disabled={meRecordActionSubmitting}
                            onClick={() => onStartEdit(record)}
                          >
                            修改（提交审核）
                          </button>
                          <button
                            type="button"
                            className="action-chip nps-item__delete"
                            disabled={meRecordActionSubmitting}
                            onClick={() => onSubmitDelete(record)}
                          >
                            删除（提交审核）
                          </button>
                        </div>
                      )}
                      {meEditingServiceId === record.serviceId && (
                        <div className="nps-item__edit">
                          <div className="nps-apply-grid">
                            <input type="date" value={meEditDate} onChange={(e) => setMeEditDate(e.target.value)} />
                            <select value={meEditType} onChange={(e) => setMeEditType(e.target.value as '翻译' | '校对' | '管理' | '技术')}>
                              {NPS_SERVICE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                            <input type="number" step="0.5" min="0.5" value={meEditDuration} onChange={(e) => setMeEditDuration(e.target.value)} placeholder="时长(小时)" />
                            <input type="text" value={meEditDescription} onChange={(e) => setMeEditDescription(e.target.value)} placeholder="服务描述（至少5字）" />
                          </div>
                          <div className="nps-item__actions">
                            <button
                              type="button"
                              className="nps-load-more"
                              disabled={meRecordActionSubmitting}
                              onClick={() => onSubmitEdit(record)}
                            >
                              {meRecordActionSubmitting ? '提交中...' : '确认提交修改'}
                            </button>
                            <button type="button" className="nps-load-more" disabled={meRecordActionSubmitting} onClick={onCancelEdit}>
                              取消
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                {meHasMoreServices && (
                  <button type="button" className="nps-load-more" onClick={onLoadMore} disabled={meServicesLoadingMore}>
                    {meServicesLoadingMore ? '加载中...' : '查看更多记录'}
                  </button>
                )}
              </>
            )}
            <div className="nps-apply">
              <button type="button" className="nps-load-more" onClick={onToggleApplicationForm}>
                {showMeApplicationForm ? '收起申请表单' : '提交NPS申请'}
              </button>
              {!showMeApplicationForm && <p className="nps-msg">需填写：服务日期、类型、时长、服务描述。</p>}
              {showMeApplicationForm && (
                <>
                  <div className="nps-apply-grid">
                    <input type="date" value={meApplicationDate} onChange={(e) => setMeApplicationDate(e.target.value)} />
                    <select value={meApplicationType} onChange={(e) => setMeApplicationType(e.target.value as '翻译' | '校对' | '管理' | '技术')}>
                      {NPS_SERVICE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <input type="number" step="0.5" min="0.5" value={meApplicationDuration} onChange={(e) => setMeApplicationDuration(e.target.value)} placeholder="时长(小时)" />
                    <input type="text" value={meApplicationDescription} onChange={(e) => setMeApplicationDescription(e.target.value)} placeholder="服务描述（至少5字）" />
                  </div>
                  <button type="button" className="nps-load-more" onClick={onSubmitApplication} disabled={meApplicationSubmitting || !meVolunteer}>
                    {meApplicationSubmitting ? '提交中...' : '确认提交'}
                  </button>
                </>
              )}
              {meApplicationMessage && <p className="nps-msg">{meApplicationMessage}</p>}
              {meRecordActionMessage && <p className="nps-msg">{meRecordActionMessage}</p>}
            </div>
          </section>

          <section className="community-panel">
            <div className="center-panel__head">
              <h3>我的申请记录</h3>
              <button
                type="button"
                className="filter-reset"
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
              </button>
            </div>
            {myApplicationsLoading ? (
              <p className="center-empty">正在加载申请记录...</p>
            ) : myApplications.length === 0 ? (
              <p className="center-empty">暂无申请记录</p>
            ) : (
              <div className="nps-list">
                {myApplications.map((item) => (
                  <article key={item.applicationId} className="nps-item">
                    <div className="nps-item__head">
                      <strong>申请类型：{item.applicationType}</strong>
                      <span>状态：{APPLICATION_STATUS_LABEL[item.status] || item.status}</span>
                    </div>
                    <p>时间：{new Date(item.createdAt).toLocaleString()}</p>
                    <p>服务类型：{getServiceTypeLabel(item)}</p>
                    <p>内容摘要：{getDescriptionSummary(item)}</p>
                    {item.submittedBy?.name && account?.name && item.submittedBy.name !== account.name && (
                      <small>代提交：{item.submittedBy.name}</small>
                    )}
                    <small>审核意见：{item.reviewNotes?.trim() || '-'}</small>
                    {(item.status === 'pending' || item.status === 'rejected') && (
                      <div className="nps-item__actions">
                        {item.status === 'pending' && (
                          <button
                            type="button"
                            className="action-chip nps-item__delete"
                            onClick={async () => {
                              const confirmed = window.confirm(`确认撤回该申请？\n申请ID: ${item.applicationId}`);
                              if (!confirmed) return;
                              await onWithdrawApplication(item.applicationId);
                            }}
                          >
                            撤回
                          </button>
                        )}
                        {item.status === 'rejected' && (
                          <button
                            type="button"
                            className="action-chip"
                            onClick={() => onResubmitApplication(item)}
                          >
                            重新提交
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
          {mePanelError && <p className="auth-form-error">{mePanelError}</p>}
        </div>
      )}
      <div className="info-grid">
        <p><strong>姓名:</strong> {account?.name || '-'}</p>
        <p><strong>邮箱:</strong> {account?.email || '-'}</p>
        <p><strong>角色:</strong> {account?.role || '-'}</p>
        <p><strong>绑定志愿者ID:</strong> {account?.volunteerId || '未绑定'}</p>
        <p><strong>账号状态:</strong> {account?.isActive ? '启用' : '停用'}</p>
        <p><strong>最近登录:</strong> {account?.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : '暂无'}</p>
      </div>
    </section>
  );
};

export default MeCenter;
