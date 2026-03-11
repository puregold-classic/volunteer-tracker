import ReviewCenter from '@components/ReviewCenter';
import type { ReviewPendingApplication } from '@services/reviewService';

interface ReviewPageProps {
  isReviewer: boolean;
  reviewLoading: boolean;
  reviewError: string;
  pendingReviews: ReviewPendingApplication[];
  processedReviews: ReviewPendingApplication[];
  onRefresh: () => Promise<void> | void;
}

function ReviewPage({
  isReviewer,
  reviewLoading,
  reviewError,
  pendingReviews,
  processedReviews,
  onRefresh
}: ReviewPageProps) {
  return (
    <ReviewCenter
      isReviewer={isReviewer}
      reviewLoading={reviewLoading}
      reviewError={reviewError}
      pendingReviews={pendingReviews}
      processedReviews={processedReviews}
      onRefresh={onRefresh}
    />
  );
}

export default ReviewPage;
