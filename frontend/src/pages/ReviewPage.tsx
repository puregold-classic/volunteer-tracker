import ReviewCenter from '@components/ReviewCenter';

interface ReviewPageProps {
  isReviewer: boolean;
  reviewLoading: boolean;
  reviewError: string;
  pendingReviews: unknown[];
  processedReviews: unknown[];
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
      pendingReviews={pendingReviews as never[]}
      processedReviews={processedReviews as never[]}
      onRefresh={onRefresh}
    />
  );
}

export default ReviewPage;
