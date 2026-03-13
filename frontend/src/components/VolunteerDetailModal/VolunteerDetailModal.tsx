import React from 'react';
import type { Volunteer } from '@services/types';
import type { NonProjectServiceRecord } from '@services/serviceRecordService';

const NPS_SERVICE_TYPES = ['翻译', '校对', '管理', '技术'] as const;
type NpsServiceType = (typeof NPS_SERVICE_TYPES)[number];

interface VolunteerDetailModalProps {
  isOpen: boolean;
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
  onClose: () => void;
  onLoadMoreServices: () => void;
  onToggleApplicationForm: () => void;
  onSubmitApplication: () => void;
  setDetailApplicationDate: (value: string) => void;
  setDetailApplicationType: (value: NpsServiceType) => void;
  setDetailApplicationDuration: (value: string) => void;
  setDetailApplicationDescription: (value: string) => void;
}

const VolunteerDetailModal: React.FC<VolunteerDetailModalProps> = ({
  isOpen,
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
  onClose,
  onLoadMoreServices,
  onToggleApplicationForm,
  onSubmitApplication,
  setDetailApplicationDate,
  setDetailApplicationType,
  setDetailApplicationDuration,
  setDetailApplicationDescription
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal volunteer-detail-modal">
        <div className="modal-header">
          <h3 className="modal-title">个人中心（志愿者）</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {volunteerDetailLoading ? (
            <p className="center-empty">正在加载志愿者详情...</p>
          ) : volunteerDetailError ? (
            <p className="auth-form-error">{volunteerDetailError}</p>
          ) : volunteerDetail ? (
            <div className="volunteer-detail-grid">
              <div className="volunteer-detail-main">
                <img src={volunteerDetail.avatar} alt={volunteerDetail.chineseName} className="volunteer-detail-avatar" />
                <div>
                  <h3>{volunteerDetail.chineseName}</h3>
                  <p>{volunteerDetail.englishName}</p>
                  <p><strong>ID:</strong> {volunteerDetail.id}</p>
                </div>
              </div>
              <p><strong>状态:</strong> {volunteerDetail.status}</p>
              <p><strong>地区:</strong> {volunteerDetail.region}</p>
              <p><strong>服务方向:</strong> {volunteerDetail.services.join('、') || '-'}</p>
              <p><strong>非项目时长:</strong> {volunteerDetail.nonProjectHours} 小时</p>
              <p><strong>非项目次数:</strong> {volunteerDetail.nonProjectCount} 次</p>
              <p><strong>邮箱:</strong> {volunteerDetail.email || '-'}</p>
              <p><strong>电话:</strong> {volunteerDetail.phone || '-'}</p>
              <p><strong>加入时间:</strong> {volunteerDetail.joinDate ? new Date(volunteerDetail.joinDate).toLocaleString() : '-'}</p>
              <p><strong>创建时间:</strong> {volunteerDetail.createdAt ? new Date(volunteerDetail.createdAt).toLocaleString() : '-'}</p>
              <p><strong>更新时间:</strong> {volunteerDetail.updatedAt ? new Date(volunteerDetail.updatedAt).toLocaleString() : '-'}</p>
              <div className="volunteer-detail-nps">
                <h4>非项目服务记录</h4>
                {volunteerDetailServices.length === 0 ? (
                  <p className="center-empty">暂无非项目服务记录</p>
                ) : (
                  <>
                    {volunteerDetailServices.map((record) => (
                      <article key={record.serviceId} className="nps-item">
                        <div className="nps-item__head">
                          <strong>{record.serviceType}</strong>
                          <span>{record.duration}h</span>
                        </div>
                        <p>{record.description}</p>
                        <small>{new Date(record.serviceDate).toLocaleDateString()} · {record.serviceId}</small>
                      </article>
                    ))}
                    {volunteerDetailHasMoreServices && (
                      <button
                        type="button"
                        className="nps-load-more"
                        onClick={onLoadMoreServices}
                        disabled={volunteerDetailServicesLoadingMore}
                      >
                        {volunteerDetailServicesLoadingMore ? '加载中...' : '查看更多记录'}
                      </button>
                    )}
                  </>
                )}
                <div className="nps-apply">
                  <button type="button" className="nps-load-more" onClick={onToggleApplicationForm}>
                    {showDetailApplicationForm ? '收起申请表单' : '提交NPS申请'}
                  </button>
                  {!showDetailApplicationForm && (
                    <p className="nps-msg">需填写：服务日期、类型、时长、服务描述。</p>
                  )}
                  {showDetailApplicationForm && (
                    <>
                      <div className="nps-apply-grid">
                        <input type="date" value={detailApplicationDate} onChange={(e) => setDetailApplicationDate(e.target.value)} />
                        <select value={detailApplicationType} onChange={(e) => setDetailApplicationType(e.target.value as NpsServiceType)}>
                          {NPS_SERVICE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={detailApplicationDuration}
                          onChange={(e) => setDetailApplicationDuration(e.target.value)}
                          placeholder="时长(小时)"
                        />
                        <input
                          type="text"
                          value={detailApplicationDescription}
                          onChange={(e) => setDetailApplicationDescription(e.target.value)}
                          placeholder="服务描述（至少5字）"
                        />
                      </div>
                      <button
                        type="button"
                        className="nps-load-more"
                        onClick={onSubmitApplication}
                        disabled={detailApplicationSubmitting || !volunteerDetail}
                      >
                        {detailApplicationSubmitting ? '提交中...' : '确认提交'}
                      </button>
                    </>
                  )}
                  {detailApplicationMessage && <p className="nps-msg">{detailApplicationMessage}</p>}
                </div>
              </div>
            </div>
          ) : (
            <p className="center-empty">暂无详情数据</p>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="modal-action-btn is-primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default VolunteerDetailModal;
