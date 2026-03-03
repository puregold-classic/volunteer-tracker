import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import './App.scss';
import VolunteerList from '@components/VolunteerList';
import Header from '@components/Header';
import Footer from '@components/Footer';
import HomeMap from '@components/HomeMap';
import { VolunteersParams } from '@services/api';
import { volunteerService } from '@services/volunteerService';
import reviewService, { ReviewPendingApplication } from '@services/reviewService';
import type { Volunteer } from '@services/types';
import serviceRecordService, { NonProjectServiceRecord } from '@services/serviceRecordService';
import applicationService from '@services/applicationService';
import authService, { AdminAccountItem } from '@services/authService';
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
  const [pendingReviews, setPendingReviews] = useState<ReviewPendingApplication[]>([]);
  const [processedReviews, setProcessedReviews] = useState<ReviewPendingApplication[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [volunteerDetailLoading, setVolunteerDetailLoading] = useState(false);
  const [volunteerDetailError, setVolunteerDetailError] = useState('');
  const [volunteerDetail, setVolunteerDetail] = useState<Volunteer | null>(null);
  const [volunteerDetailServices, setVolunteerDetailServices] = useState<NonProjectServiceRecord[]>([]);
  const [volunteerDetailServicesPage, setVolunteerDetailServicesPage] = useState(1);
  const [volunteerDetailHasMoreServices, setVolunteerDetailHasMoreServices] = useState(false);
  const [volunteerDetailServicesLoadingMore, setVolunteerDetailServicesLoadingMore] = useState(false);
  const [meVolunteer, setMeVolunteer] = useState<Volunteer | null>(null);
  const [mePanelLoading, setMePanelLoading] = useState(false);
  const [mePanelError, setMePanelError] = useState('');
  const [meServices, setMeServices] = useState<NonProjectServiceRecord[]>([]);
  const [meServicesPage, setMeServicesPage] = useState(1);
  const [meHasMoreServices, setMeHasMoreServices] = useState(false);
  const [meServicesLoadingMore, setMeServicesLoadingMore] = useState(false);
  const [meApplicationDate, setMeApplicationDate] = useState('');
  const [meApplicationType, setMeApplicationType] = useState<(typeof NPS_SERVICE_TYPES)[number]>('翻译');
  const [meApplicationDuration, setMeApplicationDuration] = useState('1');
  const [meApplicationDescription, setMeApplicationDescription] = useState('');
  const [meApplicationSubmitting, setMeApplicationSubmitting] = useState(false);
  const [meApplicationMessage, setMeApplicationMessage] = useState('');
  const [showMeApplicationForm, setShowMeApplicationForm] = useState(false);
  const [detailApplicationDate, setDetailApplicationDate] = useState('');
  const [detailApplicationType, setDetailApplicationType] = useState<(typeof NPS_SERVICE_TYPES)[number]>('翻译');
  const [detailApplicationDuration, setDetailApplicationDuration] = useState('1');
  const [detailApplicationDescription, setDetailApplicationDescription] = useState('');
  const [detailApplicationSubmitting, setDetailApplicationSubmitting] = useState(false);
  const [detailApplicationMessage, setDetailApplicationMessage] = useState('');
  const [showDetailApplicationForm, setShowDetailApplicationForm] = useState(false);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccountItem[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminImportCsvText, setAdminImportCsvText] = useState('');
  const [adminImportCreateAccounts, setAdminImportCreateAccounts] = useState(true);
  const [adminDefaultPassword, setAdminDefaultPassword] = useState('Volunteer@123');
  const [adminActionMessage, setAdminActionMessage] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminFormChineseName, setAdminFormChineseName] = useState('');
  const [adminFormEnglishName, setAdminFormEnglishName] = useState('');
  const [adminFormStatus, setAdminFormStatus] = useState<'在职' | '不在职'>('在职');
  const [adminFormRegion, setAdminFormRegion] = useState<'中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他'>('其他');
  const [adminFormProvince, setAdminFormProvince] = useState('');
  const [adminFormServices, setAdminFormServices] = useState('翻译');
  const [adminFormUsername, setAdminFormUsername] = useState('');
  const [adminFormEmail, setAdminFormEmail] = useState('');
  const [adminNewAccountName, setAdminNewAccountName] = useState('');
  const [adminNewAccountEmail, setAdminNewAccountEmail] = useState('');
  const [adminNewAccountPassword, setAdminNewAccountPassword] = useState('Volunteer@123');
  const [adminNewAccountRole, setAdminNewAccountRole] = useState<'user' | 'b_admin' | 'a_admin' | 'admin'>('user');
  const [adminNewAccountVolunteerId, setAdminNewAccountVolunteerId] = useState('');
  const [adminDetailAccountId, setAdminDetailAccountId] = useState('');
  const [adminDetailLoading, setAdminDetailLoading] = useState(false);
  const [adminDetailForm, setAdminDetailForm] = useState({
    accountName: '',
    accountEmail: '',
    role: 'user' as 'user' | 'b_admin' | 'a_admin' | 'admin',
    isActive: true,
    volunteerId: '',
    volunteerChineseName: '',
    volunteerEnglishName: '',
    volunteerStatus: '在职' as '在职' | '不在职',
    volunteerRegion: '其他' as '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他',
    volunteerProvince: '',
    volunteerServices: '翻译',
    volunteerPhone: '',
    volunteerEmail: ''
  });
  const { account, isAuthenticated, isLoading, login, logout } = useAuth();
  const isReviewer = Boolean(account && ['b_admin', 'a_admin', 'admin'].includes(account.role));
  const isSystemAdmin = account?.role === 'admin';

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

  useEffect(() => {
    if (activePage !== 'review' || !isAuthenticated || !isReviewer) return;

    const fetchReviewData = async () => {
      setReviewLoading(true);
      setReviewError('');
      try {
        const [pendingResult, processedResult] = await Promise.all([
          reviewService.getPending(1, 20),
          reviewService.getProcessed(1, 20)
        ]);
        setPendingReviews(Array.isArray(pendingResult?.data) ? pendingResult.data : []);
        setProcessedReviews(Array.isArray(processedResult?.data) ? processedResult.data : []);
      } catch (error: any) {
        setReviewError(error?.message || '获取审核数据失败');
        setPendingReviews([]);
        setProcessedReviews([]);
      } finally {
        setReviewLoading(false);
      }
    };
    void fetchReviewData();
  }, [activePage, isAuthenticated, isReviewer, reviewRefreshKey]);

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

  const fetchMePanel = async () => {
    if (!account?.volunteerId) {
      setMeVolunteer(null);
      setMeServices([]);
      setMeServicesPage(1);
      setMeHasMoreServices(false);
      setMePanelError('');
      return;
    }

    setMePanelLoading(true);
    setMePanelError('');
    try {
      const [volunteerResult, serviceResult] = await Promise.all([
        volunteerService.getVolunteerById(account.volunteerId),
        serviceRecordService.getByVolunteer(account.volunteerId, 1, NPS_PAGE_SIZE)
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
    } catch (error: any) {
      setMeVolunteer(null);
      setMeServices([]);
      setMeServicesPage(1);
      setMeHasMoreServices(false);
      setMePanelError(error?.message || '加载个人中心数据失败');
    } finally {
      setMePanelLoading(false);
    }
  };

  const loadMoreMeServices = async () => {
    if (!account?.volunteerId || meServicesLoadingMore || !meHasMoreServices) return;
    setMeServicesLoadingMore(true);
    try {
      const nextPage = meServicesPage + 1;
      const result = await serviceRecordService.getByVolunteer(account.volunteerId, nextPage, NPS_PAGE_SIZE);
      const services = result?.data?.services || [];
      const pagination = result?.data?.pagination;
      setMeServices((prev) => [...prev, ...services]);
      setMeServicesPage(pagination?.page || nextPage);
      setMeHasMoreServices(Boolean(pagination && pagination.page < pagination.totalPages));
    } finally {
      setMeServicesLoadingMore(false);
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

  const submitNpsApplication = async (
    volunteer: Volunteer,
    form: { date: string; type: string; duration: string; description: string },
    setSubmitting: (value: boolean) => void,
    setMessage: (value: string) => void,
    onSuccess: () => Promise<void> | void
  ) => {
    if (!account) {
      promptLogin();
      return;
    }

    if (!form.date || !form.description.trim()) {
      setMessage('请填写服务日期和服务描述');
      return;
    }

    const durationValue = Number(form.duration);
    if (!durationValue || durationValue <= 0) {
      setMessage('服务时长必须大于 0');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      const submitterVolunteerId = account.volunteerId || (account.role === 'admin' ? 'PG-0000' : '');
      if (!submitterVolunteerId) {
        setMessage('当前账号未绑定志愿者ID，无法提交申请');
        return;
      }

      const payload = {
        applicationType: 'create' as const,
        volunteerId: volunteer.id,
        volunteerName: volunteer.chineseName,
        changes: [
          { field: 'serviceDate' as const, to: form.date },
          { field: 'serviceType' as const, to: form.type },
          { field: 'duration' as const, to: durationValue },
          { field: 'description' as const, to: form.description.trim() }
        ],
        submittedBy: {
          id: submitterVolunteerId,
          name: account.name,
          role: account.role
        }
      };

      const result = await applicationService.submitCreateApplication(payload);
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
    await submitNpsApplication(
      meVolunteer,
      {
        date: meApplicationDate,
        type: meApplicationType,
        duration: meApplicationDuration,
        description: meApplicationDescription
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
    await submitNpsApplication(
      volunteerDetail,
      {
        date: detailApplicationDate,
        type: detailApplicationType,
        duration: detailApplicationDuration,
        description: detailApplicationDescription
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

  const fetchAdminCenter = async () => {
    setAdminLoading(true);
    setAdminError('');
    try {
      const result = await authService.adminListAccounts();
      if (result?.success) {
        const list = Array.isArray(result.data) ? result.data : [];
        setAdminAccounts(list);
      } else {
        setAdminError(result?.error || result?.message || '加载管理数据失败');
      }
    } catch (error: any) {
      setAdminError(error?.message || '加载管理数据失败');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminImport = async () => {
    if (!adminImportCsvText.trim()) {
      setAdminActionMessage('请先粘贴CSV数据');
      return;
    }
    setAdminSubmitting(true);
    setAdminActionMessage('');
    try {
      const result = await authService.adminImportVolunteers({
        csvText: adminImportCsvText.trim(),
        createAccounts: adminImportCreateAccounts,
        defaultPassword: adminDefaultPassword || 'Volunteer@123'
      });
      if (result?.success) {
        const data = result.data || {};
        setAdminActionMessage(
          `导入完成：新增志愿者 ${data.createdVolunteers || 0}，新增账号 ${data.createdAccounts || 0}`
        );
        await Promise.all([fetchAdminCenter(), volunteerService.getStats()]);
      } else {
        setAdminActionMessage(result?.error || result?.message || '导入失败');
      }
    } catch (error: any) {
      setAdminActionMessage(error?.message || '导入失败');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleAdminCreateSingle = async () => {
    if (!adminFormChineseName.trim()) {
      setAdminActionMessage('请填写中文姓名');
      return;
    }
    if (['中国大陆', '中国台湾'].includes(adminFormRegion) && !adminFormProvince.trim()) {
      setAdminActionMessage(`${adminFormRegion}必须填写省份`);
      return;
    }
    setAdminSubmitting(true);
    setAdminActionMessage('');
    try {
      const result = await authService.adminCreateVolunteer({
        chineseName: adminFormChineseName.trim(),
        englishName: adminFormEnglishName.trim() || adminFormChineseName.trim(),
        status: adminFormStatus,
        region: adminFormRegion,
        province: adminFormProvince.trim(),
        services: adminFormServices
          .split(/[、,，|/]/)
          .map((item) => item.trim())
          .filter(Boolean),
        username: adminFormUsername.trim(),
        email: adminFormEmail.trim(),
        role: 'user',
        createAccount: true,
        defaultPassword: adminDefaultPassword || 'Volunteer@123'
      });
      if (result?.success) {
        setAdminActionMessage(`已创建志愿者 ${result?.data?.volunteer?.id || ''}，账号邮箱 ${result?.data?.account?.email || '未创建'}`);
        setAdminFormChineseName('');
        setAdminFormEnglishName('');
        setAdminFormProvince('');
        setAdminFormServices('翻译');
        setAdminFormUsername('');
        setAdminFormEmail('');
        await fetchAdminCenter();
      } else {
        setAdminActionMessage(result?.error || result?.message || '创建失败');
      }
    } catch (error: any) {
      setAdminActionMessage(error?.message || '创建失败');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleAdminGenerateAccounts = async () => {
    setAdminSubmitting(true);
    setAdminActionMessage('');
    try {
      const result = await authService.adminGenerateMissingAccounts({
        defaultPassword: adminDefaultPassword || 'Volunteer@123'
      });
      if (result?.success) {
        setAdminActionMessage(
          `账号生成完成：扫描志愿者 ${result?.data?.scannedVolunteers || 0}，新增账号 ${result?.data?.createdAccounts || 0}`
        );
        await fetchAdminCenter();
      } else {
        setAdminActionMessage(result?.error || result?.message || '生成失败');
      }
    } catch (error: any) {
      setAdminActionMessage(error?.message || '生成失败');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleAdminResetSystem = async () => {
    if (!window.confirm('确认清空业务数据并仅保留系统管理员账号？此操作不可撤销。')) return;
    setAdminSubmitting(true);
    setAdminActionMessage('');
    try {
      const result = await authService.adminResetSystem();
      if (result?.success) {
        setAdminActionMessage('系统数据已清空，仅保留系统管理员账号');
        setAdminImportCsvText('');
        await fetchAdminCenter();
      } else {
        setAdminActionMessage(result?.error || result?.message || '重置失败');
      }
    } catch (error: any) {
      setAdminActionMessage(error?.message || '重置失败');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleAdminCreateAccount = async () => {
    if (!adminNewAccountName.trim() || !adminNewAccountEmail.trim() || !adminNewAccountPassword.trim()) {
      setAdminActionMessage('新增账号需要填写姓名、邮箱和密码');
      return;
    }
    setAdminSubmitting(true);
    setAdminActionMessage('');
    try {
      const payload: {
        email: string;
        password: string;
        name: string;
        role: 'user' | 'b_admin' | 'a_admin' | 'admin';
        volunteerId?: string;
      } = {
        email: adminNewAccountEmail.trim(),
        password: adminNewAccountPassword.trim(),
        name: adminNewAccountName.trim(),
        role: adminNewAccountRole
      };
      if (adminNewAccountVolunteerId.trim()) payload.volunteerId = adminNewAccountVolunteerId.trim();
      const result = await authService.createAccountByAdmin(payload);
      if (result?.success) {
        setAdminActionMessage('账号创建成功');
        setAdminNewAccountName('');
        setAdminNewAccountEmail('');
        setAdminNewAccountPassword('Volunteer@123');
        setAdminNewAccountRole('user');
        setAdminNewAccountVolunteerId('');
        await fetchAdminCenter();
      } else {
        setAdminActionMessage(result?.error || result?.message || '账号创建失败');
      }
    } catch (error: any) {
      setAdminActionMessage(error?.message || '账号创建失败');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const openAdminDetail = async (accountItem: AdminAccountItem) => {
    setAdminDetailAccountId(accountItem.id);
    setAdminDetailLoading(true);
    setAdminActionMessage('');
    try {
      let volunteerData: Volunteer | null = null;
      if (accountItem.volunteerId && /^PG-\d{4}$/i.test(accountItem.volunteerId) && accountItem.volunteerId !== 'PG-0000') {
        const volunteerResult = await volunteerService.getVolunteerById(accountItem.volunteerId);
        if (volunteerResult?.success && volunteerResult?.data) volunteerData = volunteerResult.data;
      }
      setAdminDetailForm({
        accountName: accountItem.name || '',
        accountEmail: accountItem.email || '',
        role: accountItem.role,
        isActive: Boolean(accountItem.isActive),
        volunteerId: accountItem.volunteerId || '',
        volunteerChineseName: volunteerData?.chineseName || accountItem.volunteer?.chineseName || '',
        volunteerEnglishName: volunteerData?.englishName || '',
        volunteerStatus: (volunteerData?.status as '在职' | '不在职') || '在职',
        volunteerRegion: (volunteerData?.region as '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他') || '其他',
        volunteerProvince: volunteerData?.province || '',
        volunteerServices: volunteerData?.services?.join(',') || '翻译',
        volunteerPhone: volunteerData?.phone || '',
        volunteerEmail: volunteerData?.email || ''
      });
    } catch (error: any) {
      setAdminActionMessage(error?.message || '加载用户详情失败');
    } finally {
      setAdminDetailLoading(false);
    }
  };

  const handleAdminSaveDetail = async () => {
    if (!adminDetailAccountId) return;
    if (['中国大陆', '中国台湾'].includes(adminDetailForm.volunteerRegion) && !adminDetailForm.volunteerProvince.trim()) {
      setAdminActionMessage(`${adminDetailForm.volunteerRegion}必须填写省份`);
      return;
    }
    setAdminSubmitting(true);
    setAdminActionMessage('');
    try {
      const volunteerPayload = adminDetailForm.volunteerId
        ? {
          chineseName: adminDetailForm.volunteerChineseName.trim(),
          englishName: adminDetailForm.volunteerEnglishName.trim() || adminDetailForm.volunteerChineseName.trim(),
          status: adminDetailForm.volunteerStatus,
          region: adminDetailForm.volunteerRegion,
          province: adminDetailForm.volunteerProvince.trim(),
          services: adminDetailForm.volunteerServices.split(/[、,，|/]/).map((item) => item.trim()).filter(Boolean),
          phone: adminDetailForm.volunteerPhone.trim(),
          email: adminDetailForm.volunteerEmail.trim()
        }
        : undefined;

      const result = await authService.adminUpdateAccount(adminDetailAccountId, {
        name: adminDetailForm.accountName.trim(),
        email: adminDetailForm.accountEmail.trim(),
        role: adminDetailForm.role,
        isActive: adminDetailForm.isActive,
        volunteer: volunteerPayload
      });
      if (result?.success) {
        setAdminActionMessage('用户信息更新成功');
        await fetchAdminCenter();
      } else {
        setAdminActionMessage(result?.error || result?.message || '用户信息更新失败');
      }
    } catch (error: any) {
      setAdminActionMessage(error?.message || '用户信息更新失败');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleAdminDeleteAccount = async (accountId: string) => {
    if (!window.confirm('确认删除该账号及其关联用户信息？此操作不可撤销。')) return;
    setAdminSubmitting(true);
    setAdminActionMessage('');
    try {
      const result = await authService.adminDeleteAccount(accountId);
      if (result?.success) {
        setAdminActionMessage('账号及关联信息已删除');
        if (adminDetailAccountId === accountId) {
          setAdminDetailAccountId('');
        }
        await fetchAdminCenter();
      } else {
        setAdminActionMessage(result?.error || result?.message || '删除失败');
      }
    } catch (error: any) {
      setAdminActionMessage(error?.message || '删除失败');
    } finally {
      setAdminSubmitting(false);
    }
  };

  useEffect(() => {
    if (activePage !== 'me' || !isAuthenticated) return;
    if (isSystemAdmin) {
      void fetchAdminCenter();
      return;
    }
    void fetchMePanel();
  }, [activePage, isAuthenticated, account?.volunteerId, isSystemAdmin]);

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
              <div className="center-panel__head">
                <h2>{isSystemAdmin ? '系统管理中心' : '我的个人中心'}</h2>
                {isSystemAdmin ? (
                  <button type="button" className="filter-reset" onClick={() => void fetchAdminCenter()}>
                    刷新数据
                  </button>
                ) : (
                  <button type="button" className="filter-reset" onClick={() => void fetchMePanel()}>
                    刷新面板
                  </button>
                )}
              </div>
              {isSystemAdmin ? (
                adminLoading ? (
                  <p className="center-empty">正在加载管理中心数据...</p>
                ) : (
                  <div className="admin-center">
                    <section className="quick-actions-panel">
                      <h3>系统清理</h3>
                      <p>该操作会删除志愿者、服务记录、申请、审计及非系统管理员账号。</p>
                      <button
                        type="button"
                        className="action-chip"
                        onClick={() => void handleAdminResetSystem()}
                        disabled={adminSubmitting}
                      >
                        清空数据并仅保留系统管理员
                      </button>
                    </section>

                    <section className="nps-panel">
                      <h3>单条录入（自动生成ID）</h3>
                      <div className="admin-single-grid">
                        <input
                          type="text"
                          value={adminFormChineseName}
                          onChange={(e) => setAdminFormChineseName(e.target.value)}
                          placeholder="中文姓名 *"
                        />
                        <input
                          type="text"
                          value={adminFormEnglishName}
                          onChange={(e) => setAdminFormEnglishName(e.target.value)}
                          placeholder="英文姓名"
                        />
                        <select value={adminFormStatus} onChange={(e) => setAdminFormStatus(e.target.value as '在职' | '不在职')}>
                          <option value="在职">在职</option>
                          <option value="不在职">不在职</option>
                        </select>
                        <select
                          value={adminFormRegion}
                          onChange={(e) => setAdminFormRegion(e.target.value as '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他')}
                        >
                          <option value="中国大陆">中国大陆</option>
                          <option value="中国台湾">中国台湾</option>
                          <option value="东南亚">东南亚</option>
                          <option value="美国">美国</option>
                          <option value="欧洲">欧洲</option>
                          <option value="其他">其他</option>
                        </select>
                        <input
                          type="text"
                          value={adminFormProvince}
                          onChange={(e) => setAdminFormProvince(e.target.value)}
                          placeholder="省份（大陆/台湾必填）"
                        />
                        <input
                          type="text"
                          value={adminFormServices}
                          onChange={(e) => setAdminFormServices(e.target.value)}
                          placeholder="服务方向（如：翻译,校对）"
                        />
                        <input
                          type="text"
                          value={adminFormUsername}
                          onChange={(e) => setAdminFormUsername(e.target.value)}
                          placeholder="用户名（用于默认邮箱）"
                        />
                        <input
                          type="text"
                          value={adminFormEmail}
                          onChange={(e) => setAdminFormEmail(e.target.value)}
                          placeholder="邮箱（可留空）"
                        />
                      </div>
                      <div className="quick-actions-row">
                        <button
                          type="button"
                          className="action-chip"
                          onClick={() => void handleAdminCreateSingle()}
                          disabled={adminSubmitting}
                        >
                          {adminSubmitting ? '提交中...' : '新增1条志愿者+账号'}
                        </button>
                      </div>
                      {adminActionMessage && <p className="nps-msg">{adminActionMessage}</p>}
                    </section>

                    <section className="nps-panel">
                      <h3>CSV批量导入（自动生成ID）</h3>
                      <p className="nps-msg">CSV首行可用字段：chineseName,englishName,status,region,province,services,username,email,phone,role</p>
                      <textarea
                        className="admin-csv-input"
                        value={adminImportCsvText}
                        onChange={(e) => setAdminImportCsvText(e.target.value)}
                        placeholder={`chineseName,englishName,status,region,province,services,username,email,role\n张三,Zhang San,在职,中国大陆,上海市,翻译|校对,zhangsan,zhangsan@example.com,user`}
                      />
                      <div className="admin-form-row">
                        <label>
                          默认密码
                          <input
                            type="text"
                            value={adminDefaultPassword}
                            onChange={(e) => setAdminDefaultPassword(e.target.value)}
                          />
                        </label>
                        <label className="admin-checkbox">
                          <input
                            type="checkbox"
                            checked={adminImportCreateAccounts}
                            onChange={(e) => setAdminImportCreateAccounts(e.target.checked)}
                          />
                          导入后自动创建账号
                        </label>
                      </div>
                      <div className="quick-actions-row">
                        <button
                          type="button"
                          className="action-chip"
                          onClick={() => void handleAdminImport()}
                          disabled={adminSubmitting}
                        >
                          开始导入
                        </button>
                        <button
                          type="button"
                          className="action-chip"
                          onClick={() => void handleAdminGenerateAccounts()}
                          disabled={adminSubmitting}
                        >
                          为已有志愿者补全账号
                        </button>
                      </div>
                      {adminActionMessage && <p className="nps-msg">{adminActionMessage}</p>}
                      {adminError && <p className="auth-form-error">{adminError}</p>}
                    </section>

                    <section className="nps-panel">
                      <h3>账号权限管理</h3>
                      <div className="admin-single-grid">
                        <input
                          type="text"
                          value={adminNewAccountName}
                          onChange={(e) => setAdminNewAccountName(e.target.value)}
                          placeholder="账号姓名 *"
                        />
                        <input
                          type="email"
                          value={adminNewAccountEmail}
                          onChange={(e) => setAdminNewAccountEmail(e.target.value)}
                          placeholder="账号邮箱 *"
                        />
                        <input
                          type="text"
                          value={adminNewAccountPassword}
                          onChange={(e) => setAdminNewAccountPassword(e.target.value)}
                          placeholder="初始密码 *"
                        />
                        <select
                          value={adminNewAccountRole}
                          onChange={(e) => setAdminNewAccountRole(e.target.value as 'user' | 'b_admin' | 'a_admin' | 'admin')}
                        >
                          <option value="user">user</option>
                          <option value="b_admin">b_admin</option>
                          <option value="a_admin">a_admin</option>
                          <option value="admin">admin</option>
                        </select>
                        <input
                          type="text"
                          value={adminNewAccountVolunteerId}
                          onChange={(e) => setAdminNewAccountVolunteerId(e.target.value)}
                          placeholder="绑定志愿者ID（可选）"
                        />
                      </div>
                      <div className="quick-actions-row">
                        <button
                          type="button"
                          className="action-chip"
                          onClick={() => void handleAdminCreateAccount()}
                          disabled={adminSubmitting}
                        >
                          新增账号
                        </button>
                      </div>
                      {adminAccounts.length === 0 ? (
                        <p className="center-empty">暂无账号数据</p>
                      ) : (
                        <div className="admin-simple-list">
                          {adminAccounts.map((item) => (
                            <article key={item.id} className="admin-simple-card">
                              <p><strong>ID:</strong> {item.volunteerId || item.id}</p>
                              <p>
                                <strong>姓名:</strong>{' '}
                                <button
                                  type="button"
                                  className="admin-name-link"
                                  onClick={() => void openAdminDetail(item)}
                                >
                                  {item.name}
                                </button>
                              </p>
                              <p><strong>权限:</strong> {item.role}</p>
                            </article>
                          ))}
                        </div>
                      )}
                      {adminDetailAccountId && (
                        <div className="admin-detail-panel">
                          <h4>用户详情编辑</h4>
                          {adminDetailLoading ? (
                            <p className="center-empty">正在加载详情...</p>
                          ) : (
                            <>
                              <div className="admin-single-grid">
                                <input
                                  type="text"
                                  value={adminDetailForm.accountName}
                                  onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, accountName: e.target.value }))}
                                  placeholder="账号姓名"
                                  disabled={adminDetailAccountId === account?.id}
                                />
                                <input
                                  type="email"
                                  value={adminDetailForm.accountEmail}
                                  onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, accountEmail: e.target.value }))}
                                  placeholder="账号邮箱"
                                  disabled={adminDetailAccountId === account?.id}
                                />
                                <select
                                  value={adminDetailForm.role}
                                  onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, role: e.target.value as 'user' | 'b_admin' | 'a_admin' | 'admin' }))}
                                  disabled={adminDetailAccountId === account?.id}
                                >
                                  <option value="user">user</option>
                                  <option value="b_admin">b_admin</option>
                                  <option value="a_admin">a_admin</option>
                                  <option value="admin">admin</option>
                                </select>
                                <select
                                  value={adminDetailForm.isActive ? 'active' : 'inactive'}
                                  onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, isActive: e.target.value === 'active' }))}
                                  disabled={adminDetailAccountId === account?.id}
                                >
                                  <option value="active">启用</option>
                                  <option value="inactive">停用</option>
                                </select>
                              </div>
                              {adminDetailForm.volunteerId && (
                                <>
                                  <p className="nps-msg">志愿者ID: {adminDetailForm.volunteerId}</p>
                                  <div className="admin-single-grid">
                                    <input
                                      type="text"
                                      value={adminDetailForm.volunteerChineseName}
                                      onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerChineseName: e.target.value }))}
                                      placeholder="中文姓名"
                                    />
                                    <input
                                      type="text"
                                      value={adminDetailForm.volunteerEnglishName}
                                      onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerEnglishName: e.target.value }))}
                                      placeholder="英文姓名"
                                    />
                                    <select
                                      value={adminDetailForm.volunteerStatus}
                                      onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerStatus: e.target.value as '在职' | '不在职' }))}
                                    >
                                      <option value="在职">在职</option>
                                      <option value="不在职">不在职</option>
                                    </select>
                                    <select
                                      value={adminDetailForm.volunteerRegion}
                                      onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerRegion: e.target.value as '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他' }))}
                                    >
                                      <option value="中国大陆">中国大陆</option>
                                      <option value="中国台湾">中国台湾</option>
                                      <option value="东南亚">东南亚</option>
                                      <option value="美国">美国</option>
                                      <option value="欧洲">欧洲</option>
                                      <option value="其他">其他</option>
                                    </select>
                                    <input
                                      type="text"
                                      value={adminDetailForm.volunteerProvince}
                                      onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerProvince: e.target.value }))}
                                      placeholder="省份"
                                    />
                                    <input
                                      type="text"
                                      value={adminDetailForm.volunteerServices}
                                      onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerServices: e.target.value }))}
                                      placeholder="服务方向（逗号分隔）"
                                    />
                                    <input
                                      type="text"
                                      value={adminDetailForm.volunteerPhone}
                                      onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerPhone: e.target.value }))}
                                      placeholder="电话"
                                    />
                                    <input
                                      type="email"
                                      value={adminDetailForm.volunteerEmail}
                                      onChange={(e) => setAdminDetailForm((prev) => ({ ...prev, volunteerEmail: e.target.value }))}
                                      placeholder="志愿者邮箱"
                                    />
                                  </div>
                                </>
                              )}
                              <div className="quick-actions-row">
                                <button
                                  type="button"
                                  className="action-chip"
                                  disabled={adminSubmitting || adminDetailAccountId === account?.id}
                                  onClick={() => void handleAdminSaveDetail()}
                                >
                                  保存修改
                                </button>
                                <button
                                  type="button"
                                  className="action-chip"
                                  disabled={adminSubmitting || adminDetailAccountId === account?.id}
                                  onClick={() => void handleAdminDeleteAccount(adminDetailAccountId)}
                                >
                                  删除用户
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </section>
                  </div>
                )
              ) : mePanelLoading ? (
                <p className="center-empty">正在加载个人中心数据...</p>
              ) : (
                <div className="personal-shell">
                  <section className="profile-hero">
                    <div className="profile-hero__main">
                      <img
                        src={meVolunteer?.avatar || 'https://ui-avatars.com/api/?name=User&background=random'}
                        alt={meVolunteer?.chineseName || account?.name || '用户头像'}
                        className="profile-avatar"
                      />
                      <div className="profile-meta">
                        <h3>{meVolunteer?.chineseName || account?.name || '-'}</h3>
                        <p>{meVolunteer?.englishName || account?.email || '-'}</p>
                        <div className="profile-tags">
                          <span>{meVolunteer?.id || account?.volunteerId || '未绑定ID'}</span>
                          <span className={meVolunteer?.status === '在职' ? 'is-active' : 'is-inactive'}>
                            {meVolunteer?.status || '未绑定志愿者'}
                          </span>
                          <span>{meVolunteer?.region || '地区未设置'}</span>
                        </div>
                      </div>
                    </div>
                    <p className="profile-note">
                      服务方向：{meVolunteer?.services?.length ? meVolunteer.services.join('、') : '暂无'}
                    </p>
                    <p className="profile-note">
                      加入时间：{meVolunteer?.joinDate ? new Date(meVolunteer.joinDate).toLocaleDateString() : '暂无'}
                    </p>
                  </section>

                  <section className="service-board">
                    <div className="board-item">
                      <span>总时长</span>
                      <strong>{meVolunteer?.nonProjectHours ?? 0}h</strong>
                    </div>
                    <div className="board-item">
                      <span>本月</span>
                      <strong>{Math.min(meVolunteer?.nonProjectHours ?? 0, 20)}h</strong>
                    </div>
                    <div className="board-item">
                      <span>总次数</span>
                      <strong>{meVolunteer?.nonProjectCount ?? 0}次</strong>
                    </div>
                  </section>

                  <section className="quick-actions-panel">
                    <h3>快捷操作</h3>
                    <div className="quick-actions-row">
                      <button
                        type="button"
                        className="action-chip"
                        disabled={!meVolunteer}
                        onClick={() => meVolunteer && void handleVolunteerClick(meVolunteer.id)}
                      >
                        查看个人详情
                      </button>
                      <button type="button" className="action-chip" onClick={() => setActivePage('home')}>
                        返回首页地图
                      </button>
                      <button type="button" className="action-chip" onClick={() => void logout()}>
                        退出账号
                      </button>
                    </div>
                  </section>

                  <section className="community-panel">
                    <h3>我所在的社区</h3>
                    <p>地区：{meVolunteer?.region || '暂无'} | 本地志愿者：{homeStats.totalVolunteers} 人</p>
                    <p>账号角色：{account?.role || '-'} | 最近登录：{account?.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : '暂无'}</p>
                  </section>
                  <section className="nps-panel">
                    <h3>我的非项目服务记录</h3>
                    {meServices.length === 0 ? (
                      <p className="center-empty">暂无非项目服务记录</p>
                    ) : (
                      <>
                        <div className="nps-list">
                          {meServices.map((record) => (
                            <article key={record.serviceId} className="nps-item">
                              <div className="nps-item__head">
                                <strong>{record.serviceType}</strong>
                                <span>{record.duration}h</span>
                              </div>
                              <p>{record.description}</p>
                              <small>{new Date(record.serviceDate).toLocaleDateString()} · {record.serviceId}</small>
                            </article>
                          ))}
                        </div>
                        {meHasMoreServices && (
                          <button
                            type="button"
                            className="nps-load-more"
                            onClick={() => void loadMoreMeServices()}
                            disabled={meServicesLoadingMore}
                          >
                            {meServicesLoadingMore ? '加载中...' : '查看更多记录'}
                          </button>
                        )}
                      </>
                    )}
                    <div className="nps-apply">
                      <button
                        type="button"
                        className="nps-load-more"
                        onClick={() => {
                          setShowMeApplicationForm((v) => !v);
                          setMeApplicationMessage('');
                        }}
                      >
                        {showMeApplicationForm ? '收起申请表单' : '提交NPS申请'}
                      </button>
                      {!showMeApplicationForm && (
                        <p className="nps-msg">需填写：服务日期、类型、时长、服务描述。</p>
                      )}
                      {showMeApplicationForm && (
                        <>
                          <div className="nps-apply-grid">
                            <input type="date" value={meApplicationDate} onChange={(e) => setMeApplicationDate(e.target.value)} />
                            <select value={meApplicationType} onChange={(e) => setMeApplicationType(e.target.value as (typeof NPS_SERVICE_TYPES)[number])}>
                              {NPS_SERVICE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              value={meApplicationDuration}
                              onChange={(e) => setMeApplicationDuration(e.target.value)}
                              placeholder="时长(小时)"
                            />
                            <input
                              type="text"
                              value={meApplicationDescription}
                              onChange={(e) => setMeApplicationDescription(e.target.value)}
                              placeholder="服务描述（至少5字）"
                            />
                          </div>
                          <button
                            type="button"
                            className="nps-load-more"
                            onClick={() => void submitMeNpsApplication()}
                            disabled={meApplicationSubmitting || !meVolunteer}
                          >
                            {meApplicationSubmitting ? '提交中...' : '确认提交'}
                          </button>
                        </>
                      )}
                      {meApplicationMessage && <p className="nps-msg">{meApplicationMessage}</p>}
                    </div>
                  </section>
                  {mePanelError && <p className="auth-form-error">{mePanelError}</p>}
                </div>
              )}
              {!isSystemAdmin && (
                <div className="info-grid">
                  <p><strong>姓名:</strong> {account?.name || '-'}</p>
                  <p><strong>邮箱:</strong> {account?.email || '-'}</p>
                  <p><strong>角色:</strong> {account?.role || '-'}</p>
                  <p><strong>绑定志愿者ID:</strong> {account?.volunteerId || '未绑定'}</p>
                  <p><strong>账号状态:</strong> {account?.isActive ? '启用' : '停用'}</p>
                  <p><strong>最近登录:</strong> {account?.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : '暂无'}</p>
                </div>
              )}
            </section>
          )}

          {activePage === 'review' && (
            <section className="center-panel">
              <div className="center-panel__head">
                <h2>审核中心</h2>
                <button
                  type="button"
                  className="filter-reset"
                  onClick={() => setReviewRefreshKey((v) => v + 1)}
                >
                  刷新
                </button>
              </div>
              {!isReviewer ? (
                <p className="center-empty">当前账号无审核权限（需 b_admin / a_admin / admin）。</p>
              ) : reviewLoading ? (
                <p className="center-empty">正在加载审核数据...</p>
              ) : reviewError ? (
                <p className="center-empty">{reviewError}</p>
              ) : (
                <div className="review-columns">
                  <div className="review-column">
                    <h3>待审核列表 ({pendingReviews.length})</h3>
                    {pendingReviews.length === 0 ? (
                      <p className="center-empty">暂无待审核记录</p>
                    ) : (
                      pendingReviews.map((item) => (
                        <article key={item.applicationId} className="review-item-card">
                          <p><strong>{item.volunteerName}</strong> · {item.applicationType}</p>
                          <p>ID: {item.applicationId}</p>
                          <p>志愿者ID: {item.volunteerId}</p>
                          <p>提交时间: {new Date(item.createdAt).toLocaleString()}</p>
                        </article>
                      ))
                    )}
                  </div>
                  <div className="review-column">
                    <h3>已审核记录 ({processedReviews.length})</h3>
                    {processedReviews.length === 0 ? (
                      <p className="center-empty">暂无已审核记录</p>
                    ) : (
                      processedReviews.map((item) => (
                        <article key={item.applicationId} className="review-item-card">
                          <p><strong>{item.volunteerName}</strong> · {item.status}</p>
                          <p>ID: {item.applicationId}</p>
                          <p>类型: {item.applicationType}</p>
                          <p>更新时间: {new Date(item.updatedAt).toLocaleString()}</p>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>
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

      {showVolunteerModal && (
        <div className="modal-overlay">
          <div className="modal volunteer-detail-modal">
            <div className="modal-header">
              <h3 className="modal-title">个人中心（志愿者）</h3>
              <button className="modal-close" onClick={() => setShowVolunteerModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {volunteerDetailLoading ? (
                <p className="center-empty">正在加载志愿者详情...</p>
              ) : volunteerDetailError ? (
                <p className="auth-form-error">{volunteerDetailError}</p>
              ) : volunteerDetail ? (
                <div className="volunteer-detail-grid">
                  <div className="volunteer-detail-main">
                    <img src={volunteerDetail.avatar} alt={volunteerDetail.chineseName} className="volunteer-detail-avatar" />
                    <div>
                      <h3>{volunteerDetail.chineseName}</h3>
                      <p>{volunteerDetail.englishName}</p>
                      <p><strong>ID:</strong> {volunteerDetail.id}</p>
                    </div>
                  </div>
                  <p><strong>状态:</strong> {volunteerDetail.status}</p>
                  <p><strong>地区:</strong> {volunteerDetail.region}</p>
                  <p><strong>服务方向:</strong> {volunteerDetail.services.join('、') || '-'}</p>
                  <p><strong>非项目时长:</strong> {volunteerDetail.nonProjectHours} 小时</p>
                  <p><strong>非项目次数:</strong> {volunteerDetail.nonProjectCount} 次</p>
                  <p><strong>邮箱:</strong> {volunteerDetail.email || '-'}</p>
                  <p><strong>电话:</strong> {volunteerDetail.phone || '-'}</p>
                  <p><strong>加入时间:</strong> {volunteerDetail.joinDate ? new Date(volunteerDetail.joinDate).toLocaleString() : '-'}</p>
                  <p><strong>创建时间:</strong> {volunteerDetail.createdAt ? new Date(volunteerDetail.createdAt).toLocaleString() : '-'}</p>
                  <p><strong>更新时间:</strong> {volunteerDetail.updatedAt ? new Date(volunteerDetail.updatedAt).toLocaleString() : '-'}</p>
                  <div className="volunteer-detail-nps">
                    <h4>非项目服务记录</h4>
                    {volunteerDetailServices.length === 0 ? (
                      <p className="center-empty">暂无非项目服务记录</p>
                    ) : (
                      <>
                        {volunteerDetailServices.map((record) => (
                          <article key={record.serviceId} className="nps-item">
                            <div className="nps-item__head">
                              <strong>{record.serviceType}</strong>
                              <span>{record.duration}h</span>
                            </div>
                            <p>{record.description}</p>
                            <small>{new Date(record.serviceDate).toLocaleDateString()} · {record.serviceId}</small>
                          </article>
                        ))}
                        {volunteerDetailHasMoreServices && (
                          <button
                            type="button"
                            className="nps-load-more"
                            onClick={() => void loadMoreVolunteerDetailServices()}
                            disabled={volunteerDetailServicesLoadingMore}
                          >
                            {volunteerDetailServicesLoadingMore ? '加载中...' : '查看更多记录'}
                          </button>
                        )}
                      </>
                    )}
                    <div className="nps-apply">
                      <button
                        type="button"
                        className="nps-load-more"
                        onClick={() => {
                          setShowDetailApplicationForm((v) => !v);
                          setDetailApplicationMessage('');
                        }}
                      >
                        {showDetailApplicationForm ? '收起申请表单' : '提交NPS申请'}
                      </button>
                      {!showDetailApplicationForm && (
                        <p className="nps-msg">需填写：服务日期、类型、时长、服务描述。</p>
                      )}
                      {showDetailApplicationForm && (
                        <>
                          <div className="nps-apply-grid">
                            <input type="date" value={detailApplicationDate} onChange={(e) => setDetailApplicationDate(e.target.value)} />
                            <select value={detailApplicationType} onChange={(e) => setDetailApplicationType(e.target.value as (typeof NPS_SERVICE_TYPES)[number])}>
                              {NPS_SERVICE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              value={detailApplicationDuration}
                              onChange={(e) => setDetailApplicationDuration(e.target.value)}
                              placeholder="时长(小时)"
                            />
                            <input
                              type="text"
                              value={detailApplicationDescription}
                              onChange={(e) => setDetailApplicationDescription(e.target.value)}
                              placeholder="服务描述（至少5字）"
                            />
                          </div>
                          <button
                            type="button"
                            className="nps-load-more"
                            onClick={() => void submitDetailNpsApplication()}
                            disabled={detailApplicationSubmitting || !volunteerDetail}
                          >
                            {detailApplicationSubmitting ? '提交中...' : '确认提交'}
                          </button>
                        </>
                      )}
                      {detailApplicationMessage && <p className="nps-msg">{detailApplicationMessage}</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="center-empty">暂无详情数据</p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-action-btn is-primary" onClick={() => setShowVolunteerModal(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}

export default App;
