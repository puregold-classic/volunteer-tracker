import { api } from './api';

export interface SubmitApplicationPayload {
  applicationType: 'create';
  volunteerId: string;
  volunteerName: string;
  changes: Array<{
    field: 'serviceDate' | 'serviceType' | 'duration' | 'description';
    to: string | number;
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

export const applicationService = {
  submitCreateApplication: async (payload: SubmitApplicationPayload): Promise<SubmitApplicationResponse> => {
    return api.post('/applications', payload);
  }
};

export default applicationService;
