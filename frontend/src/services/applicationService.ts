import { api } from './api';

type ApplicationType = 'create' | 'update' | 'delete';
type ChangeField = 'serviceDate' | 'serviceType' | 'duration' | 'description' | 'isActive';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface SubmitApplicationPayload {
  applicationType: ApplicationType;
  volunteerId: string;
  volunteerName: string;
  targetId?: string;
  changes: Array<{
    field: ChangeField;
    from?: string | number | boolean | null;
    to: string | number | boolean | null;
  }>;
  submittedBy: {
    id: string;
    name: string;
    role: 'user' | 'b_admin' | 'a_admin' | 'admin';
  };
}

export interface SubmitApplicationResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    applicationId: string;
    status: string;
    submittedAt: string;
  };
}

export interface MyApplicationRecord {
  applicationId: string;
  applicationType: ApplicationType;
  targetType: string;
  volunteerId: string;
  volunteerName: string;
  changes: Array<{
    field: ChangeField;
    from?: string | number | boolean | null;
    to: string | number | boolean | null;
  }>;
  targetId?: string;
  submittedBy: {
    id: string;
    name: string;
    role: 'user' | 'b_admin' | 'a_admin' | 'admin';
    timestamp?: string;
  };
  status: ApplicationStatus;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyApplicationsResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    applications: MyApplicationRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface WithdrawApplicationResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    applicationId: string;
    status: ApplicationStatus;
    withdrawnAt: string;
  };
}

export interface DeactivateAllMyApplicationsResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    deactivatedCount: number;
  };
}

export const applicationService = {
  submitApplication: async (payload: SubmitApplicationPayload): Promise<SubmitApplicationResponse> => {
    return api.post('/applications', payload);
  },

  getMyApplications: async (volunteerId: string): Promise<MyApplicationsResponse> => {
    return api.get('/applications/my', {
      params: {
        submittedById: volunteerId
      }
    });
  },

  withdrawApplication: async (
    applicationId: string,
    withdrawnById?: string
  ): Promise<WithdrawApplicationResponse> => {
    const payload = withdrawnById ? { withdrawnBy: { id: withdrawnById } } : undefined;
    return api.delete(`/applications/${applicationId}`, payload ? { data: payload } : undefined);
  },

  deactivateAllMyApplications: async (
    submittedById: string
  ): Promise<DeactivateAllMyApplicationsResponse> => {
    return api.post('/applications/my/deactivate-all', { submittedById });
  }
};

export default applicationService;
