import { api } from './api';

type ApplicationType = 'create' | 'update' | 'delete';
type ChangeField = 'serviceDate' | 'serviceType' | 'duration' | 'description' | 'isActive';

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

export const applicationService = {
  submitApplication: async (payload: SubmitApplicationPayload): Promise<SubmitApplicationResponse> => {
    return api.post('/applications', payload);
  }
};

export default applicationService;
