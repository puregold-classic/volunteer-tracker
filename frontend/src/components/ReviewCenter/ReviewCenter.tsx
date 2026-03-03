import React from 'react';
import { ReviewPendingApplication } from '@services/reviewService';

interface ReviewCenterProps {
  isReviewer: boolean;
  reviewLoading: boolean;
  reviewError: string;
  pendingReviews: ReviewPendingApplication[];
  processedReviews: ReviewPendingApplication[];
  onRefresh: () => void;
}

const ReviewCenter: React.FC<ReviewCenterProps> = ({
  isReviewer,
  reviewLoading,
  reviewError,
  pendingReviews,
  processedReviews,
  onRefresh
}) => {
  return (
    <section className="center-panel">
      <div className="center-panel__head">
        <h2>审核中心</h2>
        <button type="button" className="filter-reset" onClick={onRefresh}>刷新</button>
      </div>
      {!isReviewer ? (
        <p className="center-empty">当前账号无审核权限（需 b_admin / a_admin / admin）。</p>
      ) : reviewLoading ? (
        <p className="center-empty">正在加载审核数据...</p>
      ) : reviewError ? (
        <p className="center-empty">{reviewError}</p>
      ) : (
        <div className="review-columns">
          <div className="review-column">
            <h3>待审核列表 ({pendingReviews.length})</h3>
            {pendingReviews.length === 0 ? (
              <p className="center-empty">暂无待审核记录</p>
            ) : (
              pendingReviews.map((item) => (
                <article key={item.applicationId} className="review-item-card">
                  <p><strong>{item.volunteerName}</strong> · {item.applicationType}</p>
                  <p>ID: {item.applicationId}</p>
                  <p>志愿者ID: {item.volunteerId}</p>
                  <p>提交时间: {new Date(item.createdAt).toLocaleString()}</p>
                </article>
              ))
            )}
          </div>
          <div className="review-column">
            <h3>已审核记录 ({processedReviews.length})</h3>
            {processedReviews.length === 0 ? (
              <p className="center-empty">暂无已审核记录</p>
            ) : (
              processedReviews.map((item) => (
                <article key={item.applicationId} className="review-item-card">
                  <p><strong>{item.volunteerName}</strong> · {item.status}</p>
                  <p>ID: {item.applicationId}</p>
                  <p>类型: {item.applicationType}</p>
                  <p>更新时间: {new Date(item.updatedAt).toLocaleString()}</p>
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default ReviewCenter;
