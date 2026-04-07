import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { volunteerService } from '@services/volunteerService';
import serviceRecordService from '@services/serviceRecordService';
import applicationService from '@services/applicationService';
import type { Volunteer } from '@services/types';
import type { NonProjectServiceRecord } from '@services/serviceRecordService';

const NPS_PAGE_SIZE = 8;
const NPS_SERVICE_TYPES = ['翻译', '校对', '管理', '技术'] as const;
export type NpsServiceType = (typeof NPS_SERVICE_TYPES)[number];

export function useVolunteerDetail(volunteerId: string | undefined) {
  const { account } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [services, setServices] = useState<NonProjectServiceRecord[]>([]);
  const [servicesPage, setServicesPage] = useState(1);
  const [hasMoreServices, setHasMoreServices] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [appDate, setAppDate] = useState('');
  const [appType, setAppType] = useState<NpsServiceType>('翻译');
  const [appDuration, setAppDuration] = useState('1');
  const [appDescription, setAppDescription] = useState('');
  const [appSubmitting, setAppSubmitting] = useState(false);
  const [appMessage, setAppMessage] = useState('');

  useEffect(() => {
    if (!volunteerId) return;

    const fetchDetail = async () => {
      setLoading(true);
      setError('');
      setVolunteer(null);
      setServices([]);
      setServicesPage(1);
      setHasMoreServices(false);
      try {
        const [volunteerResult, serviceResult] = await Promise.all([
          volunteerService.getVolunteerById(volunteerId),
          serviceRecordService.getByVolunteer(volunteerId, 1, NPS_PAGE_SIZE)
        ]);
        if (volunteerResult?.success && volunteerResult?.data) {
          setVolunteer(volunteerResult.data);
          const svcs = serviceResult?.data?.services || [];
          const pagination = serviceResult?.data?.pagination;
          setServices(svcs);
          setServicesPage(pagination?.page || 1);
          setHasMoreServices(Boolean(pagination && pagination.page < pagination.totalPages));
        } else {
          setError('未找到该志愿者信息');
        }
      } catch (err: any) {
        setError(err?.message || '加载志愿者详情失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [volunteerId]);

  const refreshServices = async (currentVolunteerId: string) => {
    const result = await serviceRecordService.getByVolunteer(currentVolunteerId, 1, NPS_PAGE_SIZE);
    const svcs = result?.data?.services || [];
    const pagination = result?.data?.pagination;
    setServices(svcs);
    setServicesPage(pagination?.page || 1);
    setHasMoreServices(Boolean(pagination && pagination.page < pagination.totalPages));
  };

  const loadMore = async () => {
    if (!volunteer?.id || loadingMore || !hasMoreServices) return;
    setLoadingMore(true);
    try {
      const nextPage = servicesPage + 1;
      const result = await serviceRecordService.getByVolunteer(volunteer.id, nextPage, NPS_PAGE_SIZE);
      const svcs = result?.data?.services || [];
      const pagination = result?.data?.pagination;
      setServices((prev) => [...prev, ...svcs]);
      setServicesPage(pagination?.page || nextPage);
      setHasMoreServices(Boolean(pagination && pagination.page < pagination.totalPages));
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleForm = () => {
    setShowForm((v) => !v);
    setAppMessage('');
  };

  const submitApplication = async () => {
    if (!volunteer) return;
    if (!appDate || !appDescription.trim()) {
      setAppMessage('请填写服务日期和服务描述');
      return;
    }
    const durationValue = Number(appDuration);
    if (!durationValue || durationValue <= 0) {
      setAppMessage('服务时长必须大于 0');
      return;
    }
    const submitterVolunteerId = account?.volunteerId || (account?.role === 'admin' ? 'PG-0000' : '');
    if (!submitterVolunteerId || !account) {
      setAppMessage('请先登录后再提交申请');
      return;
    }
    const submitter = { id: submitterVolunteerId, name: account.name, role: account.role };

    setAppSubmitting(true);
    setAppMessage('');
    try {
      const result = await applicationService.submitApplication({
        applicationType: 'create',
        volunteerId: volunteer.id,
        volunteerName: volunteer.chineseName,
        changes: [
          { field: 'serviceDate', to: appDate },
          { field: 'serviceType', to: appType },
          { field: 'duration', to: durationValue },
          { field: 'description', to: appDescription.trim() }
        ],
        submittedBy: submitter
      });
      if (result?.success) {
        setAppMessage(`申请已提交：${result?.data?.applicationId || '待生成ID'}`);
        await refreshServices(volunteer.id);
        setAppDate('');
        setAppType('翻译');
        setAppDuration('1');
        setAppDescription('');
      } else {
        setAppMessage(result?.error || result?.message || '提交失败');
      }
    } catch (err: any) {
      setAppMessage(err?.message || '提交失败');
    } finally {
      setAppSubmitting(false);
    }
  };

  return {
    loading,
    error,
    volunteer,
    services,
    hasMoreServices,
    loadingMore,
    showForm,
    appDate,
    appType,
    appDuration,
    appDescription,
    appSubmitting,
    appMessage,
    loadMore,
    toggleForm,
    submitApplication,
    setAppDate,
    setAppType,
    setAppDuration,
    setAppDescription,
  };
}
