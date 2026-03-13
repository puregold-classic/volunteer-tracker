import { useEffect, useState } from 'react';
import reviewService, { ReviewPendingApplication } from '@services/reviewService';

export const useReviewCenter = (
  activePage: 'home' | 'me' | 'review',
  isAuthenticated: boolean,
  isReviewer: boolean
) => {
  const [pendingReviews, setPendingReviews] = useState<ReviewPendingApplication[]>([]);
  const [processedReviews, setProcessedReviews] = useState<ReviewPendingApplication[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);

  useEffect(() => {
    if (activePage !== 'review' || !isAuthenticated || !isReviewer) return;

    const fetchReviewData = async () => {
      setReviewLoading(true);
      setReviewError('');
      try {
        const [pendingResult, processedResult] = await Promise.all([
          reviewService.getPending(1, 20),
          reviewService.getProcessed(1, 20)
        ]);
        setPendingReviews(Array.isArray(pendingResult?.data) ? pendingResult.data : []);
        setProcessedReviews(Array.isArray(processedResult?.data) ? processedResult.data : []);
      } catch (error: any) {
        setReviewError(error?.message || '获取审核数据失败');
        setPendingReviews([]);
        setProcessedReviews([]);
      } finally {
        setReviewLoading(false);
      }
    };
    void fetchReviewData();
  }, [activePage, isAuthenticated, isReviewer, reviewRefreshKey]);

  return {
    pendingReviews,
    processedReviews,
    reviewLoading,
    reviewError,
    refreshReview: () => setReviewRefreshKey((v) => v + 1)
  };
};

export default useReviewCenter;
