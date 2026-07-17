// frontend/src/components/AdminCenter/AdminCenter.tsx — chunk 6 phase E
//
// Desktop-first admin dashboard. Replaces the v1 / chunk 3 long-form stack
// with a proper table + dialog-based workflow.
//
// Layout:
//
//   ┌────────────────────────────────────────────────────────────┐
//   │ 系统管理中心        [+ 志愿者] [+ admin] [⤴ CSV] [⚙ 重置]    │
//   ├────────────────────────────────────────────────────────────┤
//   │ Stats: 总账号 N · user X · b_admin Y · a_admin Z · admin W │
//   ├────────────────────────────────────────────────────────────┤
//   │ [搜索 ........] [角色 ▼] [部门 ▼]                           │
//   ├────────────────────────────────────────────────────────────┤
//   │ Code     姓名      邮箱           角色      部门     操作    │
//   │ PG-0001  张笔译    sample-...     b_admin   笔译...  [删除]  │
//   │ ...                                                        │
//   └────────────────────────────────────────────────────────────┘
//
// All forms (create volunteer+account, create admin, CSV import, system reset)
// open as Dialog modals. The list view is the primary surface.

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  KeyRound,
  Pencil,
  RefreshCcw,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import authService, { AdminAccountItem, CsvValidation } from '@services/authService';
import departmentService from '@services/departmentService';
import volunteerService from '@services/volunteerService';
import type { Department, Role } from '@services/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
} from '@/components/shared/form-fields';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MAINLAND_PROVINCES, TAIWAN_PROVINCE } from '@/lib/provinces';

interface AdminCenterProps {
  currentAccountId?: string;
}

const REGION_OPTIONS = ['中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '其他'] as const;

const ROLE_LABELS: Record<Role, string> = {
  user: 'user',
  b_admin: 'b_admin',
  a_admin: 'a_admin',
  admin: 'admin',
};

const roleBadgeVariant = (role: Role): 'default' | 'success' | 'info' | 'destructive' => {
  switch (role) {
    case 'admin':
      return 'destructive';
    case 'a_admin':
      return 'info';
    case 'b_admin':
      return 'success';
    default:
      return 'default';
  }
};

// ─── Schemas ────────────────────────────────────────────────────────────────

const createVolunteerSchema = z.object({
  chineseName: z.string().trim().min(1, '中文姓名必填'),
  englishName: z.string().trim().optional(),
  status: z.enum(['在职', '不在职']),
  region: z.enum(['中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '其他']),
  province: z.string().optional(),
  birthday: z.string().optional(),
  departmentId: z.string().min(1, '请选择部门'),
  email: z.string().trim().email('邮箱格式错误'),
  phone: z.string().optional(),
  password: z.string().min(8, '密码至少 8 位'),
  role: z.enum(['user', 'b_admin', 'a_admin']),
}).refine(
  (d) => !['中国大陆', '中国台湾'].includes(d.region) || (d.province && d.province.trim().length > 0),
  { message: '中国大陆 / 中国台湾 必须填写省份', path: ['province'] },
);

type CreateVolunteerForm = z.infer<typeof createVolunteerSchema>;

// ─── Create volunteer dialog ────────────────────────────────────────────────

const CreateVolunteerDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departments: Department[];
  onCreated: () => void;
}> = ({ open, onOpenChange, departments, onCreated }) => {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateVolunteerForm>({
    resolver: zodResolver(createVolunteerSchema),
    defaultValues: {
      chineseName: '', englishName: '', status: '在职', region: '其他', province: '',
      birthday: '', departmentId: '', email: '', phone: '', password: 'Volunteer@123', role: 'user',
    },
  });

  const region = watch('region');
  const showProvince = region === '中国大陆' || region === '中国台湾';

  useEffect(() => { if (open) reset(); }, [open, reset]);
  // 台湾只有「台湾省」，切到台湾时自动填上，省得用户手选
  useEffect(() => { if (region === '中国台湾') setValue('province', TAIWAN_PROVINCE); }, [region, setValue]);

  const onSubmit = async (data: CreateVolunteerForm) => {
    const result = await authService.adminCreateVolunteerAccount({
      volunteer: {
        chineseName: data.chineseName,
        englishName: data.englishName || undefined,
        status: data.status,
        region: data.region,
        province: data.province || undefined,
        birthday: data.birthday || undefined,
        departmentId: data.departmentId,
        email: data.email,
        phone: data.phone || undefined,
      },
      account: {
        email: data.email,
        password: data.password,
        name: data.chineseName,
        role: data.role,
      },
    });
    if (result?.success) {
      toast({ title: '创建成功', description: `${data.chineseName} (${data.email})` });
      onCreated();
      onOpenChange(false);
    } else {
      toast({
        title: '创建失败',
        description: (result as any)?.error || '未知错误',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="新增志愿者 + 账号"
      description="一次创建志愿者档案和登录账号（v2.1 统一原子入口）"
      className="sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="中文姓名" required error={errors.chineseName?.message}>
            <FormInput {...register('chineseName')} placeholder="如 张三" />
          </FormField>
          <FormField label="英文姓名" error={errors.englishName?.message}>
            <FormInput {...register('englishName')} placeholder="如 Zhang San" />
          </FormField>
        </div>

        {/* Status + Department row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="状态" required>
            <FormSelect {...register('status')}>
              <option value="在职">在职</option>
              <option value="不在职">不在职</option>
            </FormSelect>
          </FormField>
          <FormField label="部门" required error={errors.departmentId?.message}>
            <FormSelect {...register('departmentId')}>
              <option value="">— 选择部门 —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </FormSelect>
          </FormField>
        </div>

        {/* Region + Province row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="地区" required>
            <FormSelect {...register('region')}>
              {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </FormSelect>
          </FormField>
          <FormField label={showProvince ? '省份 *' : '省份'} error={errors.province?.message}>
            {region === '中国大陆' ? (
              <FormSelect {...register('province')}>
                <option value="">— 选择省份 —</option>
                {MAINLAND_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </FormSelect>
            ) : region === '中国台湾' ? (
              <FormSelect {...register('province')}>
                <option value={TAIWAN_PROVINCE}>{TAIWAN_PROVINCE}</option>
              </FormSelect>
            ) : (
              <FormInput {...register('province')} placeholder="可选（海外地区）" />
            )}
          </FormField>
        </div>

        {/* Birthday — drives the human ID */}
        <FormField
          label="生日"
          error={errors.birthday?.message}
          hint="填了用生日制 ID（生日 MMDD + 去重字母，如 0305a）；留空用 PG-NNNN 流水号"
        >
          <FormInput type="date" {...register('birthday')} className="sm:max-w-xs" />
        </FormField>

        {/* Email + Phone row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="邮箱" required error={errors.email?.message}>
            <FormInput type="email" {...register('email')} placeholder="user@example.com" />
          </FormField>
          <FormField label="电话" error={errors.phone?.message}>
            <FormInput {...register('phone')} placeholder="可选" />
          </FormField>
        </div>

        {/* Password + Role row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="账号密码" required error={errors.password?.message}>
            <FormInput type="text" {...register('password')} />
          </FormField>
          <FormField label="角色" required>
            <FormSelect {...register('role')}>
              <option value="user">user</option>
              <option value="b_admin">b_admin</option>
              <option value="a_admin">a_admin</option>
            </FormSelect>
          </FormField>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting} size="lg">
            {isSubmitting ? '创建中…' : '创建志愿者+账号'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};


// ─── CSV import dialog ──────────────────────────────────────────────────────

const CsvImportDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}> = ({ open, onOpenChange, onImported }) => {
  const [csvText, setCsvText] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('Volunteer@123');
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<CsvValidation | null>(null);

  useEffect(() => {
    if (open) { setCsvText(''); setDefaultPassword('Volunteer@123'); setValidation(null); }
  }, [open]);

  // 改动 CSV 文本后，之前的校验结果作废（强制重新校验）
  const onCsvChange = (v: string) => { setCsvText(v); if (validation) setValidation(null); };

  const onValidate = async () => {
    if (!csvText.trim()) { toast({ title: '请先粘贴 CSV 数据', variant: 'destructive' }); return; }
    setValidating(true);
    try {
      const res = await authService.adminValidateVolunteers({ csvText: csvText.trim() });
      if (res?.success && res.data) {
        setValidation(res.data);
        toast({
          title: '校验完成',
          description: `${res.data.validCount} 行通过 · ${res.data.invalidCount} 行有问题`,
          variant: res.data.invalidCount > 0 ? 'destructive' : undefined,
        });
      } else {
        toast({ title: '校验失败', description: (res as any)?.error || '未知错误', variant: 'destructive' });
      }
    } finally {
      setValidating(false);
    }
  };

  const onSubmit = async () => {
    if (!csvText.trim()) {
      toast({ title: '请粘贴 CSV 数据', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await authService.adminImportVolunteers({
        csvText: csvText.trim(),
        defaultPassword: defaultPassword || 'Volunteer@123',
      });
      if (result?.success) {
        const data = (result.data as any) || {};
        toast({
          title: '导入完成',
          description: `创建 ${data.created || 0}，跳过 ${data.skipped || 0}`,
        });
        onImported();
        onOpenChange(false);
      } else {
        toast({ title: '导入失败', description: (result as any)?.error || '未知错误', variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Excel / CSV 粘贴导入志愿者"
      description="从 Excel 直接复制粘贴即可（Tab 分隔，可不带表头）。无表头时按列顺序：中文名 · 英文名 · 状态 · 地区 · 省份 · 部门 · 邮箱 · 角色"
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
          <span className="text-sm text-muted-foreground">先下载模板发给大家填，填好后把表格整块复制粘贴到下面</span>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href="/volunteer-import-template.xlsx" download="志愿者导入模板.xlsx">
              <Download className="h-4 w-4" />
              下载模板
            </a>
          </Button>
        </div>
        <FormField label="粘贴数据" required hint="部门可写中文名（网络技术部）或 id（NET_TECH）；状态/地区/角色留空默认 在职 / 其他 / user">
          <FormTextarea
            rows={8}
            value={csvText}
            onChange={(e) => onCsvChange(e.target.value)}
            placeholder={'从 Excel 选中整块直接粘贴，例如：\n张书语\twill\t在职\t中国大陆\t辽宁省\t网络技术部\t2441192638@qq.com\tuser'}
            className="font-mono text-xs leading-relaxed"
          />
        </FormField>
        <FormField label="默认密码" hint="可被 CSV 中的 password 列覆盖">
          <FormInput value={defaultPassword} onChange={(e) => setDefaultPassword(e.target.value)} />
        </FormField>

        {validation && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <span className="text-emerald-600">{validation.validCount} 行通过</span>
              {validation.invalidCount > 0 && (
                <span className="inline-flex items-center gap-1 text-rose-600">
                  <AlertTriangle className="h-3.5 w-3.5" />{validation.invalidCount} 行有问题
                </span>
              )}
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {validation.rows.map((r) => (
                <div key={r.row} className={cn('rounded-md px-2 py-1', r.ok ? 'text-muted-foreground' : 'bg-rose-50 dark:bg-rose-950/30')}>
                  <div className="flex items-center gap-1.5">
                    {r.ok
                      ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      : <X className="h-3.5 w-3.5 shrink-0 text-rose-600" />}
                    <span className="font-medium">第 {r.row} 行</span>
                    <span className="truncate text-muted-foreground">{r.chineseName || '（无姓名）'} · {r.email || '（无邮箱）'}</span>
                  </div>
                  {!r.ok && (
                    <ul className="ml-5 mt-0.5 list-disc text-rose-700 dark:text-rose-400">
                      {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" variant="outline" className="flex-1" disabled={validating || submitting} onClick={onValidate}>
            {validating ? '校验中…' : '校验'}
          </Button>
          <Button type="button" className="flex-1" disabled={submitting || validating} size="lg" onClick={onSubmit}>
            {submitting
              ? '导入中…'
              : validation && validation.invalidCount > 0
                ? `仍导入通过的 ${validation.validCount} 行`
                : '开始导入'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

// ─── System reset dialog ────────────────────────────────────────────────────

const SystemResetDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}> = ({ open, onOpenChange, onDone }) => {
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) setConfirmText(''); }, [open]);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await authService.adminResetSystem();
      if (result?.success) {
        toast({ title: '系统已重置', description: '所有业务数据已清空' });
        onDone();
        onOpenChange(false);
      } else {
        toast({ title: '重置失败', description: (result as any)?.error || '未知错误', variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="⚠️ 系统重置"
      description="清空所有志愿者、项目服务、审计日志和非 admin 账号。仅 dev sandbox 使用。"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">不可撤销操作</p>
              <p className="mt-1 text-foreground">
                此操作会删除所有志愿者档案、项目服务记录、审计日志，并清空所有非 admin
                账号。当前 admin 账号会保留。
              </p>
            </div>
          </div>
        </div>

        <FormField
          label={
            <>
              请输入 <span className="font-mono font-bold text-destructive">RESET</span> 确认
            </>
          }
          required
        >
          <FormInput
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET"
          />
        </FormField>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            disabled={submitting || confirmText !== 'RESET'}
            onClick={onSubmit}
            size="lg"
          >
            {submitting ? '清空中…' : '确认清空'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

// ─── Edit account dialog ────────────────────────────────────────────────────

const editAccountSchema = z.object({
  // Account fields
  name: z.string().trim().min(1, '姓名必填'),
  email: z.string().trim().email('邮箱格式错误'),
  // 'admin' 保留在 enum 里是为了已有 admin 账号能正常回填/校验；但下面的角色下拉**不提供** admin
  // 选项，加上后端 updateAccount 拦截"提升为 admin"，所以无法把普通账号设成 admin。
  role: z.enum(['user', 'b_admin', 'a_admin', 'admin']),
  isActive: z.boolean(),
  // Volunteer fields (only meaningful when account has linked volunteer)
  chineseName: z.string().trim().optional(),
  englishName: z.string().trim().optional(),
  status: z.enum(['在职', '不在职']).optional(),
  region: z.enum(['中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '其他']).optional(),
  province: z.string().optional(),
  departmentId: z.string().optional(),
  phone: z.string().optional(),
  birthday: z.string().optional(),
});

type EditAccountForm = z.infer<typeof editAccountSchema>;

const EditAccountDialog: React.FC<{
  account: AdminAccountItem | null;
  departments: Department[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}> = ({ account, departments, isSelf, onClose, onSaved }) => {
  const open = !!account;
  const hasVolunteer = !!account?.volunteer;
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<EditAccountForm>({
    resolver: zodResolver(editAccountSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'user',
      isActive: true,
      chineseName: '',
      englishName: '',
      status: '在职',
      region: '其他',
      province: '',
      departmentId: '',
      phone: '',
    },
  });

  const region = watch('region');
  const showProvince = region === '中国大陆' || region === '中国台湾';

  useEffect(() => {
    if (!account) return;
    reset({
      name: account.name,
      email: account.email,
      role: account.role,
      isActive: account.isActive,
      chineseName: account.volunteer?.chineseName || '',
      englishName: account.volunteer?.englishName || '',
      status: (account.volunteer?.status as '在职' | '不在职') || '在职',
      region: (account.volunteer?.region as EditAccountForm['region']) || '其他',
      province: account.volunteer?.province || '',
      departmentId: account.volunteer?.department?.id || '',
      phone: account.volunteer?.phone || '',
      birthday: account.volunteer?.birthday ? account.volunteer.birthday.slice(0, 10) : '',
    });
  }, [account, reset]);
  // 台湾只有「台湾省」；切到台湾自动填（标 dirty 以便随编辑保存）
  useEffect(() => {
    if (region === '中国台湾') setValue('province', TAIWAN_PROVINCE, { shouldDirty: true });
  }, [region, setValue]);

  const onSubmit = async (data: EditAccountForm) => {
    if (!account) return;

    // 1) Patch account fields if any changed
    const accountPatch: Record<string, unknown> = {};
    if (dirtyFields.name) accountPatch.name = data.name;
    if (dirtyFields.email) accountPatch.email = data.email;
    if (dirtyFields.role) accountPatch.role = data.role;
    if (dirtyFields.isActive) accountPatch.isActive = data.isActive;

    if (Object.keys(accountPatch).length > 0) {
      const res = await authService.adminUpdateAccount(account.id, accountPatch as any);
      if (!res?.success) {
        toast({
          title: '账号更新失败',
          description: (res as any)?.error || '未知错误',
          variant: 'destructive',
        });
        return;
      }
    }

    // 2) Patch volunteer fields if any changed (only if account has volunteer)
    if (hasVolunteer && account.volunteerId) {
      const volunteerPatch: Record<string, unknown> = {};
      if (dirtyFields.chineseName) volunteerPatch.chineseName = data.chineseName;
      if (dirtyFields.englishName) volunteerPatch.englishName = data.englishName || null;
      if (dirtyFields.status) volunteerPatch.status = data.status;
      if (dirtyFields.region) volunteerPatch.region = data.region;
      if (dirtyFields.province) volunteerPatch.province = data.province || null;
      if (dirtyFields.departmentId) volunteerPatch.departmentId = data.departmentId;
      if (dirtyFields.phone) volunteerPatch.phone = data.phone || null;
      // v3.7: birthday 可后补/改；后端只更新字段，不重算 volunteerCode（ID 不可变）
      if (dirtyFields.birthday) volunteerPatch.birthday = data.birthday || null;

      if (Object.keys(volunteerPatch).length > 0) {
        const res = await volunteerService.updateVolunteer(account.volunteerId, volunteerPatch as any);
        if (!res?.success) {
          toast({
            title: '志愿者信息更新失败',
            description: (res as any)?.error || '未知错误',
            variant: 'destructive',
          });
          return;
        }
      }
    }

    toast({ title: '保存成功', description: data.name });
    onSaved();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={account ? `编辑账号 · ${account.name}` : '编辑账号'}
      description={
        isSelf
          ? '不能修改自己的角色或停用自己的账号'
          : hasVolunteer
            ? '账号信息 + 志愿者档案，仅修改改动过的字段'
            : '系统 admin 账号（无 volunteer 关联）'
      }
      className="sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* ── Account section ── */}
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Shield className="h-3 w-3" />
            账号信息
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="登录姓名" required error={errors.name?.message}>
              <FormInput {...register('name')} />
            </FormField>
            <FormField label="邮箱" required error={errors.email?.message}>
              <FormInput type="email" {...register('email')} />
            </FormField>
            <FormField label="角色" required>
              <FormSelect {...register('role')} disabled={isSelf}>
                <option value="user">user</option>
                <option value="b_admin">b_admin</option>
                <option value="a_admin">a_admin</option>
              </FormSelect>
            </FormField>
            <FormField label="账号状态">
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 transition-colors hover:border-primary/40 sm:h-10">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  disabled={isSelf}
                  className="h-4 w-4 rounded border-border text-primary"
                />
                <span className="text-sm text-foreground">激活账号</span>
              </label>
            </FormField>
          </div>
        </div>

        {/* ── Volunteer section (only for non-admin accounts with volunteer) ── */}
        {hasVolunteer && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Users className="h-3 w-3" />
              志愿者档案 · {account?.volunteerCode}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="中文姓名" error={errors.chineseName?.message}>
                <FormInput {...register('chineseName')} />
              </FormField>
              <FormField label="英文姓名" error={errors.englishName?.message}>
                <FormInput {...register('englishName')} placeholder="可选" />
              </FormField>
              <FormField label="在职状态">
                <FormSelect {...register('status')}>
                  <option value="在职">在职</option>
                  <option value="不在职">不在职</option>
                </FormSelect>
              </FormField>
              <FormField label="部门" error={errors.departmentId?.message}>
                <FormSelect {...register('departmentId')}>
                  <option value="">— 选择部门 —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="地区">
                <FormSelect {...register('region')}>
                  {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </FormSelect>
              </FormField>
              <FormField label={showProvince ? '省份 *' : '省份'} error={errors.province?.message}>
                {region === '中国大陆' ? (
                  <FormSelect {...register('province')}>
                    <option value="">— 选择省份 —</option>
                    {MAINLAND_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </FormSelect>
                ) : region === '中国台湾' ? (
                  <FormSelect {...register('province')}>
                    <option value={TAIWAN_PROVINCE}>{TAIWAN_PROVINCE}</option>
                  </FormSelect>
                ) : (
                  <FormInput {...register('province')} placeholder="可选（海外地区）" />
                )}
              </FormField>
              <FormField label="电话">
                <FormInput {...register('phone')} placeholder="可选" />
              </FormField>
              <FormField label="生日" error={errors.birthday?.message} hint="补生日不改已有志愿者 ID（code 保持不变）">
                <FormInput type="date" {...register('birthday')} />
              </FormField>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting} size="lg">
            {isSubmitting ? '保存中…' : '保存修改'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

// Field is now imported from components/shared/form-fields as FormField.

// ─── Main AdminCenter ───────────────────────────────────────────────────────

const AdminCenter: React.FC<AdminCenterProps> = ({ currentAccountId }) => {
  const [accounts, setAccounts] = useState<AdminAccountItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Dialog open states
  const [createVolunteerOpen, setCreateVolunteerOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [systemResetOpen, setSystemResetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminAccountItem | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [accountsRes, deptRes] = await Promise.all([
        authService.adminListAccounts(),
        departmentService.list(),
      ]);
      if (accountsRes?.success) setAccounts(accountsRes.data || []);
      else setError((accountsRes as any)?.error || '加载账号列表失败');
      if (deptRes?.success) setDepartments(deptRes.data || []);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const handleDelete = async (accountId: string, name: string) => {
    if (!window.confirm(`确认删除 ${name} 的账号及关联志愿者？此操作不可撤销。`)) return;
    const result = await authService.adminDeleteAccount(accountId);
    if (result?.success) {
      toast({ title: '已删除', description: name });
      await refresh();
    } else {
      toast({ title: '删除失败', description: (result as any)?.error || '未知错误', variant: 'destructive' });
    }
  };

  const handleResetPassword = async (accountId: string, name: string) => {
    const newPw = window.prompt(`为 ${name} 重置密码（至少 8 位）：`);
    if (!newPw) return;
    if (newPw.length < 8) {
      toast({ title: '密码长度至少 8 位', variant: 'destructive' });
      return;
    }
    const result = await authService.adminResetPassword(accountId, newPw);
    if (result?.success) {
      toast({ title: '密码已重置', description: `${name} 的所有会话已登出` });
    } else {
      toast({ title: '重置失败', description: (result as any)?.error || '未知错误', variant: 'destructive' });
    }
  };

  // ─── Filtering ────────────────────────────────────────────────────────────

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (roleFilter !== 'all' && a.role !== roleFilter) return false;
      if (departmentFilter && a.volunteer?.department?.id !== departmentFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [
          a.name,
          a.email,
          a.volunteerCode || '',
          a.volunteer?.chineseName || '',
          a.volunteer?.englishName || '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [accounts, roleFilter, departmentFilter, search]);

  // ─── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const byRole: Record<string, number> = { user: 0, b_admin: 0, a_admin: 0, admin: 0 };
    for (const a of accounts) byRole[a.role] = (byRole[a.role] || 0) + 1;
    return { total: accounts.length, byRole };
  }, [accounts]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground">系统管理员中心</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">志愿者 / 账号 / 系统配置</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            刷新
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCsvImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4" />
            Excel 导入
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateVolunteerOpen(true)}>
            <UserPlus className="h-4 w-4" />
            新增志愿者
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI strip — same language as ReviewPage */}
      <Card variant="elevated" className="overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {[
            { label: '总账号', value: stats.total, emphasized: true },
            { label: 'user', value: stats.byRole.user || 0 },
            { label: 'b/a admin', value: (stats.byRole.b_admin || 0) + (stats.byRole.a_admin || 0) },
            { label: 'admin', value: stats.byRole.admin || 0 },
          ].map((tile) => (
            <div
              key={tile.label}
              className={cn(
                'bg-card px-4 py-4 sm:px-5 sm:py-5',
                tile.emphasized && 'border-l-4 border-l-primary',
              )}
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {tile.label}
              </div>
              <p className="mt-2 font-serif text-xl font-semibold tabular-nums leading-none text-foreground sm:text-2xl">
                {tile.value}
                <span className="ml-1 text-xs font-normal text-muted-foreground">个</span>
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Account list */}
      <Card variant="elevated" className="overflow-hidden p-0">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <FormInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索姓名 / 邮箱 / Code"
              className="pl-10 pr-9"
            />
            {search && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Role filter chips */}
          <div className="flex items-center gap-1">
            {(['all', 'user', 'b_admin', 'a_admin', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={cn(
                  'inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors',
                  roleFilter === r
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {r === 'all' ? '全部角色' : r}
              </button>
            ))}
          </div>

          {/* Department filter */}
          <div className="w-44">
            <FormSelect value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="">全部部门</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </FormSelect>
          </div>
        </div>

        {/* Empty / loading states (shared between mobile + desktop) */}
        {loading && filteredAccounts.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">加载中…</p>
        )}
        {!loading && filteredAccounts.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {accounts.length === 0 ? '暂无账号数据' : '没有匹配的账号'}
          </p>
        )}

        {/* Mobile: card list */}
        {filteredAccounts.length > 0 && (
          <ul className="divide-y divide-border md:hidden">
            {filteredAccounts.map((account) => {
              const isSelf = account.id === currentAccountId;
              return (
                <li
                  key={`m-${account.id}`}
                  className={cn(
                    'px-4 py-3 transition-colors',
                    isSelf && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-foreground">{account.name}</p>
                        <Badge variant={roleBadgeVariant(account.role)} className="shrink-0 text-[10px] py-0.5">
                          {ROLE_LABELS[account.role]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{account.email}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {account.volunteerCode ? (
                          <span className="font-mono tabular-nums">{account.volunteerCode}</span>
                        ) : (
                          <span className="italic">系统 admin</span>
                        )}
                        {account.volunteer?.department && (
                          <span> · {account.volunteer.department.name}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setEditingAccount(account)}
                        aria-label="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleResetPassword(account.id, account.name)}
                        aria-label="重置密码"
                        title="重置密码"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleDelete(account.id, account.name)}
                        disabled={isSelf}
                        title={isSelf ? '不能删除自己' : '删除账号'}
                        aria-label="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Desktop / tablet: table */}
        {filteredAccounts.length > 0 && (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">姓名</th>
                  <th className="px-4 py-3 font-medium">邮箱</th>
                  <th className="px-4 py-3 font-medium">角色</th>
                  <th className="px-4 py-3 font-medium">部门</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => {
                  const isSelf = account.id === currentAccountId;
                  return (
                    <tr
                      key={account.id}
                      onClick={() => setEditingAccount(account)}
                      className={cn(
                        'cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-muted/30',
                        isSelf && 'bg-primary/5',
                      )}
                    >
                      <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                        {account.volunteerCode || <span className="italic">(admin)</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{account.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{account.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={roleBadgeVariant(account.role)} className="text-[10px] py-0.5">
                          {ROLE_LABELS[account.role]}
                        </Badge>
                        {!account.isActive && (
                          <Badge variant="outline" className="ml-1 text-[10px] py-0.5">已停用</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {account.volunteer?.department?.name || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setEditingAccount(account)}
                          aria-label="编辑"
                          title="编辑账号"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => handleResetPassword(account.id, account.name)}
                          aria-label="重置密码"
                          title="重置密码"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => handleDelete(account.id, account.name)}
                          disabled={isSelf}
                          title={isSelf ? '不能删除自己' : '删除账号'}
                          aria-label="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <Users className="mr-1 inline h-3 w-3" />
          显示 {filteredAccounts.length} / {accounts.length} 条
        </div>
      </Card>

      {/* Danger zone */}
      <Card variant="elevated" className="border-destructive/30 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-sm font-semibold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              危险区域
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              清空所有志愿者、项目服务、审计日志和非 admin 账号。仅 dev sandbox 使用。
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setSystemResetOpen(true)}
          >
            清空数据
          </Button>
        </div>
      </Card>

      {/* Dialogs */}
      <CreateVolunteerDialog
        open={createVolunteerOpen}
        onOpenChange={setCreateVolunteerOpen}
        departments={departments}
        onCreated={refresh}
      />
      <CsvImportDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        onImported={refresh}
      />
      <SystemResetDialog
        open={systemResetOpen}
        onOpenChange={setSystemResetOpen}
        onDone={refresh}
      />
      <EditAccountDialog
        account={editingAccount}
        departments={departments}
        isSelf={editingAccount?.id === currentAccountId}
        onClose={() => setEditingAccount(null)}
        onSaved={refresh}
      />
    </div>
  );
};

export default AdminCenter;
