import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Volunteer } from '@services/types';
import serviceRecordService, { NonProjectServiceRecord } from '@services/serviceRecordService';
import { volunteerService } from '@services/volunteerService';
import applicationService, { MyApplicationRecord } from '@services/applicationService';

const NPS_SERVICE_TYPES = ['翻译', '校对', '管理', '技术'] as const;
type NpsServiceType = (typeof NPS_SERVICE_TYPES)[number];

const isNpsServiceType = (value: string): value is NpsServiceType =>
  (NPS_SERVICE_TYPES as readonly string[]).includes(value);

export const useMeCenter = (
  accountVolunteerId: string | null | undefined,
  activePage: 'home' | 'me' | 'review',
  isAuthenticated: boolean,
  isSystemAdmin: boolean,
  pageSize: number
) => {
  const { account } = useAuth();

  // ── panel data ────────────────────────────────────────────────────────────
  const [meVolunteer, setMeVolunteer] = useState<Volunteer | null>(null);
  const [mePanelLoading, setMePanelLoading] = useState(false);
  const [mePanelError, setMePanelError] = useState('');
  const [meServices, setMeServices] = useState<NonProjectServiceRecord[]>([]);
  const [meServicesPage, setMeServicesPage] = useState(1);
  const [meHasMoreServices, setMeHasMoreServices] = useState(false);
  const [meServicesLoadingMore, setMeServicesLoadingMore] = useState(false);
  const [myApplications, setMyApplications] = useState<MyApplicationRecord[]>([]);
  const [myApplicationsLoading, setMyApplicationsLoading] = useState(false);
  const [myApplicationsDeactivating, setMyApplicationsDeactivating] = useState(false);

  // ── application form ──────────────────────────────────────────────────────
  const [showMeApplicationForm, setShowMeApplicationForm] = useState(false);
  const [meApplicationDate, setMeApplicationDate] = useState('');
  const [meApplicationType, setMeApplicationType] = useState<NpsServiceType>('翻译');
  const [meApplicationDuration, setMeApplicationDuration] = useState('1');
  const [meApplicationDescription, setMeApplicationDescription] = useState('');
  const [meApplicationSubmitting, setMeApplicationSubmitting] = useState(false);
  const [meApplicationMessage, setMeApplicationMessage] = useState('');

  // ── edit record ───────────────────────────────────────────────────────────
  const [meEditingServiceId, setMeEditingServiceId] = useState<string | null>(null);
  const [meEditDate, setMeEditDate] = useState('');
  const [meEditType, setMeEditType] = useState<NpsServiceType>('翻译');
  const [meEditDuration, setMeEditDuration] = useState('1');
  const [meEditDescription, setMeEditDescription] = useState('');
  const [meRecordActionSubmitting, setMeRecordActionSubmitting] = useState(false);
  const [meRecordActionMessage, setMeRecordActionMessage] = useState('');

  // ── fetch helpers ─────────────────────────────────────────────────────────
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

  // ── application / edit helpers ────────────────────────────────────────────
  const buildSubmitter = () => {
    if (!account) return null;
    const submitterVolunteerId = account.volunteerId || (account.role === 'admin' ? 'PG-0000' : '');
    if (!submitterVolunteerId) return null;
    return { id: submitterVolunteerId, name: account.name, role: account.role };
  };

  const submitNpsApplication = async (
    payload: {
      applicationType: 'create' | 'update' | 'delete';
      volunteer: Volunteer;
      targetId?: string;
      changes: Array<{
        field: 'serviceDate' | 'serviceType' | 'duration' | 'description' | 'isActive';
        from?: string | number | boolean | null;
        to: string | number | boolean | null;
      }>;
    },
    setSubmitting: (v: boolean) => void,
    setMessage: (v: string) => void,
    onSuccess: () => Promise<void> | void
  ) => {
    const submitter = buildSubmitter();
    if (!submitter) {
      setMessage('请先登录后再提交申请');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const result = await applicationService.submitApplication({
        applicationType: payload.applicationType,
        volunteerId: payload.volunteer.id,
        volunteerName: payload.volunteer.chineseName,
        targetId: payload.targetId,
        changes: payload.changes,
        submittedBy: submitter
      });
      if (result?.success) {
        setMessage(`申请已提交：${result?.data?.applicationId || '待生成ID'}`);
        await onSuccess();
      } else {
        setMessage(result?.error || result?.message || '提交失败');
      }
    } catch (error: any) {
      setMessage(error?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const submitMeNpsApplication = async () => {
    if (!meVolunteer) return;
    if (!meApplicationDate || !meApplicationDescription.trim()) {
      setMeApplicationMessage('请填写服务日期和服务描述');
      return;
    }
    const durationValue = Number(meApplicationDuration);
    if (!durationValue || durationValue <= 0) {
      setMeApplicationMessage('服务时长必须大于 0');
      return;
    }
    await submitNpsApplication(
      {
        applicationType: 'create',
        volunteer: meVolunteer,
        changes: [
          { field: 'serviceDate', to: meApplicationDate },
          { field: 'serviceType', to: meApplicationType },
          { field: 'duration', to: durationValue },
          { field: 'description', to: meApplicationDescription.trim() }
        ]
      },
      setMeApplicationSubmitting,
      setMeApplicationMessage,
      async () => {
        await fetchMePanel();
        setMeApplicationDate('');
        setMeApplicationType('翻译');
        setMeApplicationDuration('1');
        setMeApplicationDescription('');
      }
    );
  };

  const startMeEdit = (record: NonProjectServiceRecord) => {
    setMeEditingServiceId(record.serviceId);
    setMeEditDate(record.serviceDate ? new Date(record.serviceDate).toISOString().split('T')[0] : '');
    setMeEditType(isNpsServiceType(record.serviceType) ? record.serviceType : '翻译');
    setMeEditDuration(String(record.duration ?? 1));
    setMeEditDescription(record.description || '');
    setMeRecordActionMessage('');
  };

  const cancelMeEdit = () => {
    setMeEditingServiceId(null);
    setMeRecordActionMessage('');
  };

  const submitMeUpdateApplication = async (record: NonProjectServiceRecord) => {
    if (!meVolunteer || meVolunteer.id !== record.volunteerId) {
      setMeRecordActionMessage('只能修改自己的非项目服务记录');
      return;
    }
    if (!meEditDate || !meEditDescription.trim()) {
      setMeRecordActionMessage('请填写服务日期和服务描述');
      return;
    }
    const durationValue = Number(meEditDuration);
    if (!durationValue || durationValue <= 0) {
      setMeRecordActionMessage('服务时长必须大于 0');
      return;
    }
    const currentDate = new Date(record.serviceDate).toISOString().split('T')[0];
    const currentType = (record.serviceType || '').trim();
    const currentDuration = Number(record.duration);
    const currentDescription = (record.description || '').trim();
    const nextDate = meEditDate.trim();
    const nextType = meEditType.trim();
    const nextDuration = durationValue;
    const nextDescription = meEditDescription.trim();

    const changes: Array<{ field: 'serviceDate' | 'serviceType' | 'duration' | 'description'; from: string | number; to: string | number }> = [];
    if (currentDate !== nextDate) changes.push({ field: 'serviceDate', from: currentDate, to: nextDate });
    if (currentType !== nextType) changes.push({ field: 'serviceType', from: currentType, to: nextType });
    if (currentDuration !== nextDuration) changes.push({ field: 'duration', from: currentDuration, to: nextDuration });
    if (currentDescription !== nextDescription) changes.push({ field: 'description', from: currentDescription, to: nextDescription });

    if (changes.length === 0) {
      setMeRecordActionMessage('没有检测到任何修改，请先调整内容再提交');
      return;
    }
    await submitNpsApplication(
      { applicationType: 'update', volunteer: meVolunteer, targetId: record.serviceId, changes },
      setMeRecordActionSubmitting,
      setMeRecordActionMessage,
      async () => {
        await fetchMePanel();
        setMeEditingServiceId(null);
      }
    );
  };

  const submitMeDeleteApplication = async (record: NonProjectServiceRecord) => {
    if (!meVolunteer || meVolunteer.id !== record.volunteerId) {
      setMeRecordActionMessage('只能删除自己的非项目服务记录');
      return;
    }
    if (!window.confirm(`确认提交删除审核申请？\n记录ID: ${record.serviceId}`)) return;
    await submitNpsApplication(
      {
        applicationType: 'delete',
        volunteer: meVolunteer,
        targetId: record.serviceId,
        changes: [
          { field: 'serviceDate', from: new Date(record.serviceDate).toISOString().split('T')[0], to: new Date(record.serviceDate).toISOString().split('T')[0] },
          { field: 'serviceType', from: record.serviceType, to: record.serviceType },
          { field: 'duration', from: record.duration, to: record.duration },
          { field: 'description', from: record.description, to: record.description },
          { field: 'isActive', from: true, to: false }
        ]
      },
      setMeRecordActionSubmitting,
      setMeRecordActionMessage,
      async () => { await fetchMePanel(); }
    );
  };

  const toggleMeApplicationForm = () => {
    setShowMeApplicationForm((v) => !v);
    setMeApplicationMessage('');
  };

  const prefillMeApplicationFromRecord = (application: MyApplicationRecord) => {
    const getTo = (field: 'serviceDate' | 'serviceType' | 'duration' | 'description') =>
      application.changes.find((c) => c.field === field)?.to;
    const serviceDate = getTo('serviceDate');
    const serviceType = getTo('serviceType');
    const duration = getTo('duration');
    const description = getTo('description');
    setMeApplicationDate(typeof serviceDate === 'string' ? serviceDate : '');
    setMeApplicationType(typeof serviceType === 'string' && isNpsServiceType(serviceType) ? serviceType : '翻译');
    setMeApplicationDuration(duration === null || duration === undefined ? '1' : String(duration));
    setMeApplicationDescription(typeof description === 'string' ? description : String(description ?? ''));
    setShowMeApplicationForm(true);
    setMeApplicationMessage('');
  };

  const withdrawApplication = async (applicationId: string) => {
    if (!accountVolunteerId) return { success: false, message: '未绑定志愿者账号' };
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

  const handleWithdrawMyApplication = async (applicationId: string) => {
    const record = myApplications.find((item) => item.applicationId === applicationId);
    const result = await withdrawApplication(applicationId);
    if (result.success && record) {
      prefillMeApplicationFromRecord(record);
      setMeRecordActionMessage(`${result.message}，已自动填入申请表，可修改后重新提交`);
      return;
    }
    setMeRecordActionMessage(result.message);
  };

  const deactivateAllMyApplications = async () => {
    if (!accountVolunteerId) return { success: false, message: '未绑定志愿者账号' };
    setMyApplicationsDeactivating(true);
    try {
      const result = await applicationService.deactivateAllMyApplications(accountVolunteerId);
      if (result?.success) {
        await fetchMyApplications();
        return { success: true, message: result.message || `已清空 ${result?.data?.deactivatedCount || 0} 条申请记录` };
      }
      return { success: false, message: result?.error || result?.message || '清空失败' };
    } catch (error: any) {
      return { success: false, message: error?.message || '清空失败' };
    } finally {
      setMyApplicationsDeactivating(false);
    }
  };

  const handleDeactivateAllMyApplications = async () => {
    const result = await deactivateAllMyApplications();
    setMeRecordActionMessage(result.message);
  };

  useEffect(() => {
    if (activePage !== 'me' || !isAuthenticated || isSystemAdmin) return;
    void fetchMePanel();
  }, [activePage, isAuthenticated, accountVolunteerId, isSystemAdmin]);

  return {
    // panel data
    meVolunteer,
    mePanelLoading,
    mePanelError,
    meServices,
    meHasMoreServices,
    meServicesLoadingMore,
    myApplications,
    myApplicationsLoading,
    myApplicationsDeactivating,
    fetchMePanel,
    loadMoreMeServices,
    fetchMyApplications,
    // application form
    showMeApplicationForm,
    meApplicationDate,
    meApplicationType,
    meApplicationDuration,
    meApplicationDescription,
    meApplicationSubmitting,
    meApplicationMessage,
    setShowMeApplicationForm,
    setMeApplicationDate,
    setMeApplicationType,
    setMeApplicationDuration,
    setMeApplicationDescription,
    toggleMeApplicationForm,
    submitMeNpsApplication,
    // edit record
    meEditingServiceId,
    meEditDate,
    meEditType,
    meEditDuration,
    meEditDescription,
    meRecordActionSubmitting,
    meRecordActionMessage,
    setMeEditDate,
    setMeEditType,
    setMeEditDuration,
    setMeEditDescription,
    startMeEdit,
    cancelMeEdit,
    submitMeUpdateApplication,
    submitMeDeleteApplication,
    // withdraw / deactivate
    handleWithdrawMyApplication,
    handleDeactivateAllMyApplications,
    prefillMeApplicationFromRecord,
  };
};

export default useMeCenter;
