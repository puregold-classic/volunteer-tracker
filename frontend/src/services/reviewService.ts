import { api } from './api';

export interface ReviewPendingApplication {
  applicationId: string;
  applicationType: 'create' | 'update' | 'delete';
  targetType: string;
  volunteerId: string;
  volunteerName: string;
  targetId?: string | null;
  changes: Array<{
    field: string;
    from: unknown;
    to: unknown;
  }>;
  submittedBy: {
    id: string;
    name: string;
    role: string;
    timestamp?: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  createdAt: string;
  updatedAt: string;
}

export interface ReviewPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PendingReviewResponse {
  success: boolean;
  message?: string;
  data: ReviewPendingApplication[];
  pagination: ReviewPagination;
}

export interface ProcessedReviewResponse {
  success: boolean;
  message?: string;
  data: ReviewPendingApplication[];
  pagination: ReviewPagination;
}

export const reviewService = {
  getPending: async (page = 1, limit = 10): Promise<PendingReviewResponse> => {
    return api.get('/reviews/pending', { params: { page, limit } });
  },

  getProcessed: async (page = 1, limit = 10): Promise<ProcessedReviewResponse> => {
    return api.get('/reviews/processed', { params: { page, limit } });
  },

  processReview: async (
    applicationId: string,
    result: 'approved' | 'rejected',
    notes: string
  ): Promise<{ success: boolean; message?: string }> => {
    return api.post(`/reviews/${applicationId}`, { result, notes });
  },

  reopenReview: async (reviewIdOrApplicationId: string): Promise<{ success: boolean; message?: string }> => {
    return api.post(`/reviews/${reviewIdOrApplicationId}/reopen`);
  },

  withdrawReview: async (reviewIdOrApplicationId: string): Promise<{ success: boolean; message?: string }> => {
    return api.delete(`/reviews/${reviewIdOrApplicationId}`);
  }
};

export default reviewService;
