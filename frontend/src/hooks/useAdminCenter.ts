import { useState } from 'react';
import authService, { AdminAccountItem } from '@services/authService';
import { volunteerService } from '@services/volunteerService';
import type { Volunteer } from '@services/types';

export const useAdminCenter = () => {
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
        if (adminDetailAccountId === accountId) setAdminDetailAccountId('');
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

  return {
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
  };
};

export default useAdminCenter;
