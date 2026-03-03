import { api } from './api';

export interface NonProjectServiceRecord {
  serviceId: string;
  volunteerId: string;
  volunteerName: string;
  serviceDate: string;
  serviceType: string;
  duration: number;
  description: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface VolunteerServiceListResponse {
  success: boolean;
  message?: string;
  data?: {
    volunteerId: string;
    services: NonProjectServiceRecord[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export const serviceRecordService = {
  getByVolunteer: async (volunteerId: string, page = 1, limit = 8): Promise<VolunteerServiceListResponse> => {
    return api.get(`/services/volunteer/${volunteerId}`, { params: { page, limit } });
  }
};

export default serviceRecordService;
