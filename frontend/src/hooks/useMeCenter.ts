import { useEffect, useState } from 'react';
import type { Volunteer } from '@services/types';
import serviceRecordService, { NonProjectServiceRecord } from '@services/serviceRecordService';
import { volunteerService } from '@services/volunteerService';
import applicationService, { MyApplicationRecord } from '@services/applicationService';

export const useMeCenter = (
  accountVolunteerId: string | null | undefined,
  activePage: 'home' | 'me' | 'review',
  isAuthenticated: boolean,
  isSystemAdmin: boolean,
  pageSize: number
) => {
  const [meVolunteer, setMeVolunteer] = useState<Volunteer | null>(null);
  const [mePanelLoading, setMePanelLoading] = useState(false);
  const [mePanelError, setMePanelError] = useState('');
  const [meServices, setMeServices] = useState<NonProjectServiceRecord[]>([]);
  const [meServicesPage, setMeServicesPage] = useState(1);
  const [meHasMoreServices, setMeHasMoreServices] = useState(false);
  const [meServicesLoadingMore, setMeServicesLoadingMore] = useState(false);
  const [myApplications, setMyApplications] = useState<MyApplicationRecord[]>([]);
  const [myApplicationsLoading, setMyApplicationsLoading] = useState(false);

  const fetchMePanel = async () => {
    if (!accountVolunteerId) {
      setMeVolunteer(null);
      setMeServices([]);
      setMeServicesPage(1);
      setMeHasMoreServices(false);
      setMyApplications([]);
      setMyApplicationsLoading(false);
      setMePanelError('');
      return;
    }

    setMePanelLoading(true);
    setMyApplicationsLoading(true);
    setMePanelError('');
    try {
      const [volunteerResult, serviceResult, myApplicationsResult] = await Promise.all([
        volunteerService.getVolunteerById(accountVolunteerId),
        serviceRecordService.getByVolunteer(accountVolunteerId, 1, pageSize),
        applicationService.getMyApplications(accountVolunteerId)
      ]);
      if (volunteerResult?.success && volunteerResult?.data) {
        setMeVolunteer(volunteerResult.data);
        const services = serviceResult?.data?.services || [];
        const pagination = serviceResult?.data?.pagination;
        setMeServices(services);
        setMeServicesPage(pagination?.page || 1);
        setMeHasMoreServices(Boolean(pagination && pagination.page < pagination.totalPages));
      } else {
        setMeVolunteer(null);
        setMeServices([]);
        setMeServicesPage(1);
        setMeHasMoreServices(false);
        setMePanelError('未找到绑定的志愿者档案');
      }
      setMyApplications(myApplicationsResult?.data?.applications || []);
    } catch (error: any) {
      setMeVolunteer(null);
      setMeServices([]);
      setMeServicesPage(1);
      setMeHasMoreServices(false);
      setMyApplications([]);
      setMePanelError(error?.message || '加载个人中心数据失败');
    } finally {
      setMePanelLoading(false);
      setMyApplicationsLoading(false);
    }
  };

  const fetchMyApplications = async () => {
    if (!accountVolunteerId) {
      setMyApplications([]);
      setMyApplicationsLoading(false);
      return;
    }
    setMyApplicationsLoading(true);
    try {
      const result = await applicationService.getMyApplications(accountVolunteerId);
      setMyApplications(result?.data?.applications || []);
    } catch {
      setMyApplications([]);
    } finally {
      setMyApplicationsLoading(false);
    }
  };

  const loadMoreMeServices = async () => {
    if (!accountVolunteerId || meServicesLoadingMore || !meHasMoreServices) return;
    setMeServicesLoadingMore(true);
    try {
      const nextPage = meServicesPage + 1;
      const result = await serviceRecordService.getByVolunteer(accountVolunteerId, nextPage, pageSize);
      const services = result?.data?.services || [];
      const pagination = result?.data?.pagination;
      setMeServices((prev) => [...prev, ...services]);
      setMeServicesPage(pagination?.page || nextPage);
      setMeHasMoreServices(Boolean(pagination && pagination.page < pagination.totalPages));
    } finally {
      setMeServicesLoadingMore(false);
    }
  };

  const withdrawApplication = async (applicationId: string) => {
    if (!accountVolunteerId) {
      return { success: false, message: '未绑定志愿者账号' };
    }
    try {
      const result = await applicationService.withdrawApplication(applicationId, accountVolunteerId);
      if (result?.success) {
        await fetchMyApplications();
        return { success: true, message: result.message || '申请已撤回' };
      }
      return { success: false, message: result?.error || result?.message || '撤回失败' };
    } catch (error: any) {
      return { success: false, message: error?.message || '撤回失败' };
    }
  };

  useEffect(() => {
    if (activePage !== 'me' || !isAuthenticated || isSystemAdmin) return;
    void fetchMePanel();
  }, [activePage, isAuthenticated, accountVolunteerId, isSystemAdmin]);

  return {
    meVolunteer,
    mePanelLoading,
    mePanelError,
    meServices,
    meHasMoreServices,
    meServicesLoadingMore,
    myApplications,
    myApplicationsLoading,
    fetchMePanel,
    loadMoreMeServices,
    fetchMyApplications,
    withdrawApplication
  };
};

export default useMeCenter;
