import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import './App.scss';
import VolunteerList from '@components/VolunteerList';
import Header from '@components/Header';
import Footer from '@components/Footer';
import HomeMap from '@components/HomeMap';
import AdminCenter from '@components/AdminCenter';
import ReviewCenter from '@components/ReviewCenter';
import MeCenter from '@components/MeCenter';
import VolunteerDetailModal from '@components/VolunteerDetailModal';
import { VolunteersParams } from '@services/api';
import { volunteerService } from '@services/volunteerService';
import type { Volunteer } from '@services/types';
import serviceRecordService, { NonProjectServiceRecord } from '@services/serviceRecordService';
import applicationService, { MyApplicationRecord } from '@services/applicationService';
import useAdminCenter from './hooks/useAdminCenter';
import useReviewCenter from './hooks/useReviewCenter';
import useMeCenter from './hooks/useMeCenter';
import { useAuth } from './context/AuthContext';

type HeaderPage = 'home' | 'me' | 'review';
type HotProvinceFilter = 'all' | '北京' | '上海' | '深圳';
type HomeSelection = { type: 'region' | 'province'; value: string };

const HOT_PROVINCE_MAP: Record<HotProvinceFilter, string | undefined> = {
  all: undefined,
  北京: '北京市',
  上海: '上海市',
  深圳: '广东省'
};
const NPS_PAGE_SIZE = 8;
const NPS_SERVICE_TYPES = ['翻译', '校对', '管理', '技术'] as const;
type NpsServiceType = (typeof NPS_SERVICE_TYPES)[number];

const isNpsServiceType = (value: string): value is NpsServiceType => {
  return (NPS_SERVICE_TYPES as readonly string[]).includes(value);
};

function App() {
  const [activePage, setActivePage] = useState<HeaderPage>('home');
  const [homeStatus, setHomeStatus] = useState<'all' | '在职' | '不在职'>('all');
  const [homeService, setHomeService] = useState<string>('all');
  const [homeHotProvince, setHomeHotProvince] = useState<HotProvinceFilter>('all');
  const [homeRegionMode, setHomeRegionMode] = useState<'single' | 'multiple'>('multiple');
  const [homeSelections, setHomeSelections] = useState<HomeSelection[]>([]);
  const [homeSearch, setHomeSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [homeStats, setHomeStats] = useState({
    totalVolunteers: 0,
    totalActive: 0,
    totalHours: 0
  });
  const [homeStatsLoading, setHomeStatsLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [volunteerDetailLoading, setVolunteerDetailLoading] = useState(false);
  const [volunteerDetailError, setVolunteerDetailError] = useState('');
  const [volunteerDetail, setVolunteerDetail] = useState<Volunteer | null>(null);
  const [volunteerDetailServices, setVolunteerDetailServices] = useState<NonProjectServiceRecord[]>([]);
  const [volunteerDetailServicesPage, setVolunteerDetailServicesPage] = useState(1);
  const [volunteerDetailHasMoreServices, setVolunteerDetailHasMoreServices] = useState(false);
  const [volunteerDetailServicesLoadingMore, setVolunteerDetailServicesLoadingMore] = useState(false);
  const [meApplicationDate, setMeApplicationDate] = useState('');
  const [meApplicationType, setMeApplicationType] = useState<NpsServiceType>('翻译');
  const [meApplicationDuration, setMeApplicationDuration] = useState('1');
  const [meApplicationDescription, setMeApplicationDescription] = useState('');
  const [meApplicationSubmitting, setMeApplicationSubmitting] = useState(false);
  const [meApplicationMessage, setMeApplicationMessage] = useState('');
  const [showMeApplicationForm, setShowMeApplicationForm] = useState(false);
  const [meEditingServiceId, setMeEditingServiceId] = useState<string | null>(null);
  const [meEditDate, setMeEditDate] = useState('');
  const [meEditType, setMeEditType] = useState<NpsServiceType>('翻译');
  const [meEditDuration, setMeEditDuration] = useState('1');
  const [meEditDescription, setMeEditDescription] = useState('');
  const [meRecordActionSubmitting, setMeRecordActionSubmitting] = useState(false);
  const [meRecordActionMessage, setMeRecordActionMessage] = useState('');
  const [detailApplicationDate, setDetailApplicationDate] = useState('');
  const [detailApplicationType, setDetailApplicationType] = useState<NpsServiceType>('翻译');
  const [detailApplicationDuration, setDetailApplicationDuration] = useState('1');
  const [detailApplicationDescription, setDetailApplicationDescription] = useState('');
  const [detailApplicationSubmitting, setDetailApplicationSubmitting] = useState(false);
  const [detailApplicationMessage, setDetailApplicationMessage] = useState('');
  const [showDetailApplicationForm, setShowDetailApplicationForm] = useState(false);
  const { account, isAuthenticated, isLoading, login, logout } = useAuth();
  const isReviewer = Boolean(account && ['b_admin', 'a_admin', 'admin'].includes(account.role));
  const isSystemAdmin = account?.role === 'admin';
  const {
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
    withdrawApplication: withdrawMyApplication,
    deactivateAllMyApplications
  } = useMeCenter(account?.volunteerId, activePage, isAuthenticated, isSystemAdmin, NPS_PAGE_SIZE);
  const { pendingReviews, processedReviews, reviewLoading, reviewError, refreshReview } = useReviewCenter(
    activePage,
    isAuthenticated,
    isReviewer
  );
  const {
    adminAccounts,
    adminLoading,
    adminError,
    adminImportCsvText,
    adminImportCreateAccounts,
    adminDefaultPassword,
    adminActionMessage,
    adminSubmitting,
    adminFormChineseName,
    adminFormEnglishName,
    adminFormStatus,
    adminFormRegion,
    adminFormProvince,
    adminFormServices,
    adminFormUsername,
    adminFormEmail,
    adminNewAccountName,
    adminNewAccountEmail,
    adminNewAccountPassword,
    adminNewAccountRole,
    adminNewAccountVolunteerId,
    adminDetailAccountId,
    adminDetailLoading,
    adminDetailForm,
    fetchAdminCenter,
    handleAdminImport,
    handleAdminCreateSingle,
    handleAdminGenerateAccounts,
    handleAdminResetSystem,
    handleAdminCreateAccount,
    openAdminDetail,
    handleAdminSaveDetail,
    handleAdminDeleteAccount,
    setAdminImportCsvText,
    setAdminImportCreateAccounts,
    setAdminDefaultPassword,
    setAdminFormChineseName,
    setAdminFormEnglishName,
    setAdminFormStatus,
    setAdminFormRegion,
    setAdminFormProvince,
    setAdminFormServices,
    setAdminFormUsername,
    setAdminFormEmail,
    setAdminNewAccountName,
    setAdminNewAccountEmail,
    setAdminNewAccountPassword,
    setAdminNewAccountRole,
    setAdminNewAccountVolunteerId,
    setAdminDetailForm
  } = useAdminCenter();

  const QUICK_FOCUS_OPTIONS = ['中国大陆', '中国台湾', '东南亚', '美国', '欧洲'] as const;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(homeSearch.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [homeSearch]);

  useEffect(() => {
    if (homeRegionMode !== 'single') return;
    setHomeSelections((prev) => (prev.length <= 1 ? prev : [prev[prev.length - 1]]));
  }, [homeRegionMode, homeSelections]);

  const selectedRegions = useMemo(
    () => homeSelections.filter((item) => item.type === 'region').map((item) => item.value),
    [homeSelections]
  );
  const selectedProvinces = useMemo(
    () => homeSelections.filter((item) => item.type === 'province').map((item) => item.value),
    [homeSelections]
  );

  const homeFilterParams = useMemo<VolunteersParams>(() => {
    const params: VolunteersParams = {
      limit: 20,
      order: 'desc',
      sortBy: 'createdAt'
    };
    if (homeStatus !== 'all') params.status = homeStatus;
    if (homeService !== 'all') params.services = [homeService];
    if (selectedRegions.length > 0) params.region = selectedRegions;
    if (selectedProvinces.length > 0) params.province = selectedProvinces;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [homeStatus, homeService, selectedRegions, selectedProvinces, debouncedSearch]);

  const homeStatsFilterParams = useMemo<VolunteersParams>(() => {
    const params: VolunteersParams = {};
    if (homeStatus !== 'all') params.status = homeStatus;
    if (homeService !== 'all') params.services = [homeService];
    if (selectedRegions.length > 0) params.region = selectedRegions;
    if (selectedProvinces.length > 0) params.province = selectedProvinces;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [homeStatus, homeService, selectedRegions, selectedProvinces, debouncedSearch]);

  useEffect(() => {
    const fetchHomeStats = async () => {
      setHomeStatsLoading(true);
      try {
        const result = await volunteerService.getStats(homeStatsFilterParams);
        if (result?.success && result?.data?.summary) {
          setHomeStats({
            totalVolunteers: result.data.summary.totalVolunteers || 0,
            totalActive: result.data.summary.totalActive || 0,
            totalHours: result.data.summary.totalHours || 0
          });
        } else {
          setHomeStats({ totalVolunteers: 0, totalActive: 0, totalHours: 0 });
        }
      } catch {
        setHomeStats({ totalVolunteers: 0, totalActive: 0, totalHours: 0 });
      } finally {
        setHomeStatsLoading(false);
      }
    };
    void fetchHomeStats();
  }, [homeStatsFilterParams]);

  const handleVolunteerClick = async (id: string) => {
    setShowVolunteerModal(true);
    setVolunteerDetailLoading(true);
    setVolunteerDetailError('');
    setVolunteerDetail(null);
    setVolunteerDetailServices([]);
    setVolunteerDetailServicesPage(1);
    setVolunteerDetailHasMoreServices(false);
    try {
      const [volunteerResult, serviceResult] = await Promise.all([
        volunteerService.getVolunteerById(id),
        serviceRecordService.getByVolunteer(id, 1, NPS_PAGE_SIZE)
      ]);
      if (volunteerResult?.success && volunteerResult?.data) {
        setVolunteerDetail(volunteerResult.data);
        const services = serviceResult?.data?.services || [];
        const pagination = serviceResult?.data?.pagination;
        setVolunteerDetailServices(services);
        setVolunteerDetailServicesPage(pagination?.page || 1);
        setVolunteerDetailHasMoreServices(Boolean(pagination && pagination.page < pagination.totalPages));
      } else {
        setVolunteerDetailError('未找到该志愿者信息');
      }
    } catch (error: any) {
      setVolunteerDetailError(error?.message || '加载志愿者详情失败');
    } finally {
      setVolunteerDetailLoading(false);
    }
  };

  const promptLogin = () => {
    setLoginError('请先登录后再访问该功能');
    setShowLoginModal(true);
  };

  const goToPersonalCenter = () => {
    if (!isAuthenticated) {
      promptLogin();
      return;
    }
    setActivePage('me');
  };

  const goToReviewCenter = () => {
    if (!isAuthenticated) {
      promptLogin();
      return;
    }
    setActivePage('review');
  };

  const primaryFocusRegion = selectedRegions.length > 0 ? selectedRegions[selectedRegions.length - 1] : '';
  const toggleLocationSelection = (selection: HomeSelection, source: 'map' | 'quick-focus' | 'hot') => {
    if (source !== 'hot' && homeHotProvince !== 'all') {
      setHomeHotProvince('all');
    }
    setHomeSelections((prev) => {
      const exists = prev.some((item) => item.type === selection.type && item.value === selection.value);
      if (homeRegionMode === 'single') {
        return [selection];
      }
      if (exists) {
        return prev.filter((item) => !(item.type === selection.type && item.value === selection.value));
      }
      return [...prev, selection];
    });
  };

  const toggleRegion = (region: string) => {
    toggleLocationSelection({ type: 'region', value: region }, 'quick-focus');
  };

  const toggleProvince = (province: string) => {
    const normalized = province === '台湾' ? '台湾省' : province;
    toggleLocationSelection({ type: 'province', value: normalized }, 'map');
  };

  const handleRegionModeChange = (mode: 'single' | 'multiple') => {
    if (mode === homeRegionMode) return;
    setHomeRegionMode(mode);

    if (mode !== 'single') return;
    setHomeSelections((prev) => (prev.length > 0 ? [prev[prev.length - 1]] : []));
  };

  const handleLoginSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError('请输入邮箱和密码');
      return;
    }

    setLoginSubmitting(true);
    setLoginError('');
    try {
      await login(loginEmail, loginPassword);
      setShowLoginModal(false);
      setLoginPassword('');
    } catch (error: any) {
      setLoginError(error?.message || '登录失败，请稍后重试');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const loadMoreVolunteerDetailServices = async () => {
    if (!volunteerDetail?.id || volunteerDetailServicesLoadingMore || !volunteerDetailHasMoreServices) return;
    setVolunteerDetailServicesLoadingMore(true);
    try {
      const nextPage = volunteerDetailServicesPage + 1;
      const result = await serviceRecordService.getByVolunteer(volunteerDetail.id, nextPage, NPS_PAGE_SIZE);
      const services = result?.data?.services || [];
      const pagination = result?.data?.pagination;
      setVolunteerDetailServices((prev) => [...prev, ...services]);
      setVolunteerDetailServicesPage(pagination?.page || nextPage);
      setVolunteerDetailHasMoreServices(Boolean(pagination && pagination.page < pagination.totalPages));
    } finally {
      setVolunteerDetailServicesLoadingMore(false);
    }
  };

  const buildSubmitter = () => {
    if (!account) return null;
    const submitterVolunteerId = account.volunteerId || (account.role === 'admin' ? 'PG-0000' : '');
    if (!submitterVolunteerId) return null;
    return {
      id: submitterVolunteerId,
      name: account.name,
      role: account.role
    };
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
    setSubmitting: (value: boolean) => void,
    setMessage: (value: string) => void,
    onSuccess: () => Promise<void> | void
  ) => {
    const submitter = buildSubmitter();
    if (!submitter) {
      promptLogin();
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

  const submitDetailNpsApplication = async () => {
    if (!volunteerDetail) return;
    if (!detailApplicationDate || !detailApplicationDescription.trim()) {
      setDetailApplicationMessage('请填写服务日期和服务描述');
      return;
    }
    const durationValue = Number(detailApplicationDuration);
    if (!durationValue || durationValue <= 0) {
      setDetailApplicationMessage('服务时长必须大于 0');
      return;
    }
    await submitNpsApplication(
      {
        applicationType: 'create',
        volunteer: volunteerDetail,
        changes: [
          { field: 'serviceDate', to: detailApplicationDate },
          { field: 'serviceType', to: detailApplicationType },
          { field: 'duration', to: durationValue },
          { field: 'description', to: detailApplicationDescription.trim() }
        ]
      },
      setDetailApplicationSubmitting,
      setDetailApplicationMessage,
      async () => {
        const result = await serviceRecordService.getByVolunteer(volunteerDetail.id, 1, NPS_PAGE_SIZE);
        const services = result?.data?.services || [];
        const pagination = result?.data?.pagination;
        setVolunteerDetailServices(services);
        setVolunteerDetailServicesPage(pagination?.page || 1);
        setVolunteerDetailHasMoreServices(Boolean(pagination && pagination.page < pagination.totalPages));
        setDetailApplicationDate('');
        setDetailApplicationType('翻译');
        setDetailApplicationDuration('1');
        setDetailApplicationDescription('');
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

    const changes: Array<{
      field: 'serviceDate' | 'serviceType' | 'duration' | 'description';
      from: string | number;
      to: string | number;
    }> = [];

    if (currentDate !== nextDate) changes.push({ field: 'serviceDate', from: currentDate, to: nextDate });
    if (currentType !== nextType) changes.push({ field: 'serviceType', from: currentType, to: nextType });
    if (currentDuration !== nextDuration) changes.push({ field: 'duration', from: currentDuration, to: nextDuration });
    if (currentDescription !== nextDescription) changes.push({ field: 'description', from: currentDescription, to: nextDescription });

    if (changes.length === 0) {
      setMeRecordActionMessage('没有检测到任何修改，请先调整内容再提交');
      return;
    }

    await submitNpsApplication(
      {
        applicationType: 'update',
        volunteer: meVolunteer,
        targetId: record.serviceId,
        changes
      },
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
    const confirmed = window.confirm(`确认提交删除审核申请？\n记录ID: ${record.serviceId}`);
    if (!confirmed) return;
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
      async () => {
        await fetchMePanel();
      }
    );
  };

  const handleWithdrawMyApplication = async (applicationId: string) => {
    const result = await withdrawMyApplication(applicationId);
    setMeRecordActionMessage(result.message);
  };

  const handleDeactivateAllMyApplications = async () => {
    const result = await deactivateAllMyApplications();
    setMeRecordActionMessage(result.message);
  };

  const handleResubmitRejectedApplication = (application: MyApplicationRecord) => {
    const getChangeToValue = (field: 'serviceDate' | 'serviceType' | 'duration' | 'description') =>
      application.changes.find((change) => change.field === field)?.to;

    const serviceDate = getChangeToValue('serviceDate');
    const serviceType = getChangeToValue('serviceType');
    const duration = getChangeToValue('duration');
    const description = getChangeToValue('description');

    setMeApplicationDate(typeof serviceDate === 'string' ? serviceDate : '');
    setMeApplicationType(
      typeof serviceType === 'string' && isNpsServiceType(serviceType) ? serviceType : '翻译'
    );
    setMeApplicationDuration(duration === null || duration === undefined ? '1' : String(duration));
    setMeApplicationDescription(typeof description === 'string' ? description : String(description ?? ''));
    setShowMeApplicationForm(true);
    setMeApplicationMessage('');
  };

  useEffect(() => {
    if (activePage !== 'me' || !isAuthenticated || !isSystemAdmin) return;
    void fetchAdminCenter();
  }, [activePage, isAuthenticated, isSystemAdmin]);

  if (isLoading) {
    return <div className="loading-overlay"><div className="loading-content">正在检查登录状态...</div></div>;
  }

  return (
    <div className="app">
      <Header 
        title="志愿者管理系统" 
        subtitle="全球志愿者可视化平台"
        navItems={[
          {
            label: '首页',
            active: activePage === 'home',
            onClick: () => {
              setActivePage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          },
          { label: '个人中心', active: activePage === 'me', onClick: goToPersonalCenter },
          { label: '审核中心', active: activePage === 'review', onClick: goToReviewCenter }
        ]}
        actions={
          isAuthenticated ? (
            <>
              <span className="account-chip">{account?.name} · {account?.role}</span>
              <button
                className="action-btn"
                onClick={() => {
                  setActivePage('home');
                  void logout();
                }}
              >
                退出登录
              </button>
            </>
          ) : (
            <button
              className="action-btn"
              onClick={() => {
                setLoginError('');
                setShowLoginModal(true);
              }}
            >
              登录
            </button>
          )
        }
      />
      
      <main className="main-content">
        <div className="container">
          {activePage === 'home' && (
            <div className="home-shell">
              <section className="home-left">
                <div className="controls-bar">
                  <div className="filter-tools">
                    <div className="filter-field">
                      <span>状态</span>
                      <select value={homeStatus} onChange={(e) => setHomeStatus(e.target.value as 'all' | '在职' | '不在职')}>
                        <option value="all">全部</option>
                        <option value="在职">在职</option>
                        <option value="不在职">不在职</option>
                      </select>
                    </div>
                    <div className="filter-field">
                      <span>方向</span>
                      <select value={homeService} onChange={(e) => setHomeService(e.target.value)}>
                        <option value="all">全部</option>
                        <option value="翻译">翻译</option>
                        <option value="校对">校对</option>
                        <option value="管理">管理</option>
                        <option value="技术">技术</option>
                      </select>
                    </div>
                    <div className="filter-field">
                      <span>热门省份</span>
                      <select
                        value={homeHotProvince}
                        onChange={(e) => {
                          const value = e.target.value as HotProvinceFilter;
                          setHomeHotProvince(value);
                          const province = HOT_PROVINCE_MAP[value];
                          if (province) {
                            toggleLocationSelection({ type: 'province', value: province }, 'hot');
                          }
                        }}
                      >
                        <option value="all">全部</option>
                        <option value="北京">北京</option>
                        <option value="上海">上海</option>
                        <option value="深圳">深圳</option>
                      </select>
                    </div>
                    <div className="filter-field">
                      <span>地区/省份</span>
                      <div className="filter-mode-switch">
                        <button
                          type="button"
                          className={homeRegionMode === 'single' ? 'is-active' : ''}
                          onClick={() => handleRegionModeChange('single')}
                        >
                          单选
                        </button>
                        <button
                          type="button"
                          className={homeRegionMode === 'multiple' ? 'is-active' : ''}
                          onClick={() => handleRegionModeChange('multiple')}
                        >
                          多选
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="filter-reset"
                      onClick={() => {
                        setHomeStatus('all');
                        setHomeService('all');
                        setHomeHotProvince('all');
                        setHomeRegionMode('multiple');
                        setHomeSelections([]);
                        setHomeSearch('');
                      }}
                    >
                      重置
                    </button>
                  </div>
                </div>

                <div className="map-stage">
                  <HomeMap
                    activeProvince={selectedProvinces}
                    activeRegions={selectedRegions}
                    quickFocusOptions={[...QUICK_FOCUS_OPTIONS]}
                    focusRegion={primaryFocusRegion}
                    onProvinceSelect={(province) => {
                      toggleProvince(province);
                    }}
                    onReset={() => setHomeSelections((prev) => prev.filter((item) => item.type !== 'province'))}
                    onQuickFocusSelect={(item) => toggleRegion(item)}
                    onRefresh={() => {
                      setHomeSelections([]);
                      setHomeHotProvince('all');
                    }}
                  />
                </div>
              </section>

              <aside className="home-right">
                <div className="home-summary">
                  <div className="home-summary__head">
                    <h3>筛选摘要</h3>
                    <span>{homeStatsLoading ? '同步中...' : `${homeStats.totalVolunteers} 条`}</span>
                  </div>
                  <div className="home-summary__metrics">
                    <div>
                      <strong>{homeStatsLoading ? '...' : homeStats.totalVolunteers}</strong>
                      <span>匹配志愿者</span>
                    </div>
                    <div>
                      <strong>
                        {homeStatsLoading || homeStats.totalVolunteers === 0
                          ? '...'
                          : `${Math.round((homeStats.totalActive / homeStats.totalVolunteers) * 100)}%`}
                      </strong>
                      <span>在职占比</span>
                    </div>
                    <div>
                      <strong>{homeStatsLoading ? '...' : `${homeStats.totalHours}h`}</strong>
                      <span>总服务时长</span>
                    </div>
                  </div>
                  <div className="home-summary__filters">
                    <span className="summary-tag">{homeStatus === 'all' ? '状态: 全部' : `状态: ${homeStatus}`}</span>
                    <span className="summary-tag">{homeService === 'all' ? '方向: 全部' : `方向: ${homeService}`}</span>
                    {selectedRegions.map((region) => <span key={`region-${region}`} className="summary-tag">地区: {region}</span>)}
                    {selectedProvinces.map((province) => <span key={`province-${province}`} className="summary-tag">省份: {province}</span>)}
                    {debouncedSearch && <span className="summary-tag">搜索: {debouncedSearch}</span>}
                  </div>
                </div>

                <div className="home-search">
                  <input
                    type="text"
                    value={homeSearch}
                    onChange={(e) => setHomeSearch(e.target.value)}
                    placeholder="搜索姓名 / 英文名 / ID / 省份..."
                  />
                  {homeSearch && (
                    <button type="button" onClick={() => setHomeSearch('')}>
                      清空
                    </button>
                  )}
                </div>

                <div className="home-volunteer-list">
                  <VolunteerList 
                    compact
                    onVolunteerClick={handleVolunteerClick}
                    showStats={false}
                    showPagination={false}
                    filterParams={homeFilterParams}
                  />
                </div>
              </aside>
            </div>
          )}

          {activePage === 'me' && (
            <section className="center-panel">
              {isSystemAdmin ? (
                <AdminCenter
                  accountId={account?.id}
                  adminLoading={adminLoading}
                  adminSubmitting={adminSubmitting}
                  adminError={adminError}
                  adminActionMessage={adminActionMessage}
                  adminAccounts={adminAccounts}
                  adminImportCsvText={adminImportCsvText}
                  adminImportCreateAccounts={adminImportCreateAccounts}
                  adminDefaultPassword={adminDefaultPassword}
                  adminFormChineseName={adminFormChineseName}
                  adminFormEnglishName={adminFormEnglishName}
                  adminFormStatus={adminFormStatus}
                  adminFormRegion={adminFormRegion}
                  adminFormProvince={adminFormProvince}
                  adminFormServices={adminFormServices}
                  adminFormUsername={adminFormUsername}
                  adminFormEmail={adminFormEmail}
                  adminNewAccountName={adminNewAccountName}
                  adminNewAccountEmail={adminNewAccountEmail}
                  adminNewAccountPassword={adminNewAccountPassword}
                  adminNewAccountRole={adminNewAccountRole}
                  adminNewAccountVolunteerId={adminNewAccountVolunteerId}
                  adminDetailAccountId={adminDetailAccountId}
                  adminDetailLoading={adminDetailLoading}
                  adminDetailForm={adminDetailForm}
                  onRefresh={() => void fetchAdminCenter()}
                  onResetSystem={() => void handleAdminResetSystem()}
                  onCreateSingle={() => void handleAdminCreateSingle()}
                  onImport={() => void handleAdminImport()}
                  onGenerateAccounts={() => void handleAdminGenerateAccounts()}
                  onCreateAccount={() => void handleAdminCreateAccount()}
                  onOpenDetail={(item) => void openAdminDetail(item)}
                  onSaveDetail={() => void handleAdminSaveDetail()}
                  onDeleteAccount={(id) => void handleAdminDeleteAccount(id)}
                  setAdminImportCsvText={setAdminImportCsvText}
                  setAdminImportCreateAccounts={setAdminImportCreateAccounts}
                  setAdminDefaultPassword={setAdminDefaultPassword}
                  setAdminFormChineseName={setAdminFormChineseName}
                  setAdminFormEnglishName={setAdminFormEnglishName}
                  setAdminFormStatus={setAdminFormStatus}
                  setAdminFormRegion={setAdminFormRegion}
                  setAdminFormProvince={setAdminFormProvince}
                  setAdminFormServices={setAdminFormServices}
                  setAdminFormUsername={setAdminFormUsername}
                  setAdminFormEmail={setAdminFormEmail}
                  setAdminNewAccountName={setAdminNewAccountName}
                  setAdminNewAccountEmail={setAdminNewAccountEmail}
                  setAdminNewAccountPassword={setAdminNewAccountPassword}
                  setAdminNewAccountRole={setAdminNewAccountRole}
                  setAdminNewAccountVolunteerId={setAdminNewAccountVolunteerId}
                  setAdminDetailForm={setAdminDetailForm}
                />
              ) : (
                <MeCenter
                  account={account}
                  homeTotalVolunteers={homeStats.totalVolunteers}
                  meVolunteer={meVolunteer}
                  mePanelLoading={mePanelLoading}
                  mePanelError={mePanelError}
                  meServices={meServices}
                  meHasMoreServices={meHasMoreServices}
                  meServicesLoadingMore={meServicesLoadingMore}
                  myApplications={myApplications}
                  myApplicationsLoading={myApplicationsLoading}
                  myApplicationsDeactivating={myApplicationsDeactivating}
                  meApplicationDate={meApplicationDate}
                  meApplicationType={meApplicationType}
                  meApplicationDuration={meApplicationDuration}
                  meApplicationDescription={meApplicationDescription}
                  meApplicationSubmitting={meApplicationSubmitting}
                  meApplicationMessage={meApplicationMessage}
                  showMeApplicationForm={showMeApplicationForm}
                  meEditingServiceId={meEditingServiceId}
                  meEditDate={meEditDate}
                  meEditType={meEditType}
                  meEditDuration={meEditDuration}
                  meEditDescription={meEditDescription}
                  meRecordActionSubmitting={meRecordActionSubmitting}
                  meRecordActionMessage={meRecordActionMessage}
                  onRefresh={() => void fetchMePanel()}
                  onVolunteerDetail={(id) => void handleVolunteerClick(id)}
                  onBackHome={() => setActivePage('home')}
                  onLogout={() => void logout()}
                  onLoadMore={() => void loadMoreMeServices()}
                  onWithdrawApplication={(applicationId) => void handleWithdrawMyApplication(applicationId)}
                  onDeactivateAllMyApplications={() => void handleDeactivateAllMyApplications()}
                  onResubmitApplication={handleResubmitRejectedApplication}
                  onToggleApplicationForm={() => {
                    setShowMeApplicationForm((v) => !v);
                    setMeApplicationMessage('');
                  }}
                  onSubmitApplication={() => void submitMeNpsApplication()}
                  onStartEdit={(record) => startMeEdit(record)}
                  onCancelEdit={cancelMeEdit}
                  onSubmitEdit={(record) => void submitMeUpdateApplication(record)}
                  onSubmitDelete={(record) => void submitMeDeleteApplication(record)}
                  setMeApplicationDate={setMeApplicationDate}
                  setMeApplicationType={setMeApplicationType}
                  setMeApplicationDuration={setMeApplicationDuration}
                  setMeApplicationDescription={setMeApplicationDescription}
                  setMeEditDate={setMeEditDate}
                  setMeEditType={setMeEditType}
                  setMeEditDuration={setMeEditDuration}
                  setMeEditDescription={setMeEditDescription}
                />
              )}
            </section>
          )}

          {activePage === 'review' && (
            <ReviewCenter
              isReviewer={isReviewer}
              reviewLoading={reviewLoading}
              reviewError={reviewError}
              pendingReviews={pendingReviews}
              processedReviews={processedReviews}
              onRefresh={refreshReview}
            />
          )}
        </div>
      </main>

      {showLoginModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">账号登录</h3>
              <button className="modal-close" onClick={() => setShowLoginModal(false)}>×</button>
            </div>
            <form className="modal-body" onSubmit={handleLoginSubmit}>
              <div className="auth-form-field">
                <label>邮箱</label>
                <input
                  className="auth-form-input"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>
              <div className="auth-form-field">
                <label>密码</label>
                <input
                  className="auth-form-input"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="请输入密码"
                />
              </div>
              {loginError && <p className="auth-form-error">{loginError}</p>}
              <div className="modal-footer">
                <button type="button" className="modal-action-btn" onClick={() => setShowLoginModal(false)}>取消</button>
                <button type="submit" className="modal-action-btn is-primary" disabled={loginSubmitting}>
                  {loginSubmitting ? '登录中...' : '登录'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <VolunteerDetailModal
        isOpen={showVolunteerModal}
        volunteerDetailLoading={volunteerDetailLoading}
        volunteerDetailError={volunteerDetailError}
        volunteerDetail={volunteerDetail}
        volunteerDetailServices={volunteerDetailServices}
        volunteerDetailHasMoreServices={volunteerDetailHasMoreServices}
        volunteerDetailServicesLoadingMore={volunteerDetailServicesLoadingMore}
        showDetailApplicationForm={showDetailApplicationForm}
        detailApplicationDate={detailApplicationDate}
        detailApplicationType={detailApplicationType}
        detailApplicationDuration={detailApplicationDuration}
        detailApplicationDescription={detailApplicationDescription}
        detailApplicationSubmitting={detailApplicationSubmitting}
        detailApplicationMessage={detailApplicationMessage}
        onClose={() => setShowVolunteerModal(false)}
        onLoadMoreServices={() => void loadMoreVolunteerDetailServices()}
        onToggleApplicationForm={() => {
          setShowDetailApplicationForm((v) => !v);
          setDetailApplicationMessage('');
        }}
        onSubmitApplication={() => void submitDetailNpsApplication()}
        setDetailApplicationDate={setDetailApplicationDate}
        setDetailApplicationType={setDetailApplicationType}
        setDetailApplicationDuration={setDetailApplicationDuration}
        setDetailApplicationDescription={setDetailApplicationDescription}
      />
      
      <Footer />
    </div>
  );
}

export default App;
