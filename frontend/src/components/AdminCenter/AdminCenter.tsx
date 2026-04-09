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
  FileSpreadsheet,
  Pencil,
  RefreshCcw,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import authService, { AdminAccountItem } from '@services/authService';
import departmentService from '@services/departmentService';
import volunteerService from '@services/volunteerService';
import type { Department, Role } from '@services/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

const createAdminSchema = z.object({
  name: z.string().trim().min(1, '姓名必填'),
  email: z.string().trim().email('邮箱格式错误'),
  password: z.string().min(8, '密码至少 8 位'),
});

type CreateAdminForm = z.infer<typeof createAdminSchema>;

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
    formState: { errors, isSubmitting },
  } = useForm<CreateVolunteerForm>({
    resolver: zodResolver(createVolunteerSchema),
    defaultValues: {
      chineseName: '', englishName: '', status: '在职', region: '其他', province: '',
      departmentId: '', email: '', phone: '', password: 'Volunteer@123', role: 'user',
    },
  });

  const region = watch('region');
  const showProvince = region === '中国大陆' || region === '中国台湾';

  useEffect(() => { if (open) reset(); }, [open, reset]);

  const onSubmit = async (data: CreateVolunteerForm) => {
    const result = await authService.adminCreateVolunteerAccount({
      volunteer: {
        chineseName: data.chineseName,
        englishName: data.englishName || undefined,
        status: data.status,
        region: data.region,
        province: data.province || undefined,
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
          <Field label="中文姓名" required error={errors.chineseName?.message}>
            <Input {...register('chineseName')} placeholder="如 张三" />
          </Field>
          <Field label="英文姓名" error={errors.englishName?.message}>
            <Input {...register('englishName')} placeholder="如 Zhang San" />
          </Field>
        </div>

        {/* Status + Department row */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="状态" required>
            <Select {...register('status')}>
              <option value="在职">在职</option>
              <option value="不在职">不在职</option>
            </Select>
          </Field>
          <Field label="部门" required error={errors.departmentId?.message}>
            <Select {...register('departmentId')}>
              <option value="">— 选择部门 —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Region + Province row */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="地区" required>
            <Select {...register('region')}>
              {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label={showProvince ? '省份 *' : '省份'} error={errors.province?.message}>
            <Input
              {...register('province')}
              placeholder={showProvince ? '大陆 / 台湾必填' : '可选'}
            />
          </Field>
        </div>

        {/* Email + Phone row */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="邮箱" required error={errors.email?.message}>
            <Input type="email" {...register('email')} placeholder="user@example.com" />
          </Field>
          <Field label="电话" error={errors.phone?.message}>
            <Input {...register('phone')} placeholder="可选" />
          </Field>
        </div>

        {/* Password + Role row */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="账号密码" required error={errors.password?.message}>
            <Input type="text" {...register('password')} />
          </Field>
          <Field label="角色" required>
            <Select {...register('role')}>
              <option value="user">user</option>
              <option value="b_admin">b_admin</option>
              <option value="a_admin">a_admin</option>
            </Select>
          </Field>
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

// ─── Create admin dialog ────────────────────────────────────────────────────

const CreateAdminDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}> = ({ open, onOpenChange, onCreated }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAdminForm>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  useEffect(() => { if (open) reset(); }, [open, reset]);

  const onSubmit = async (data: CreateAdminForm) => {
    const result = await authService.adminCreateAdmin(data);
    if (result?.success) {
      toast({ title: 'admin 账号创建成功', description: data.email });
      onCreated();
      onOpenChange(false);
    } else {
      toast({ title: '创建失败', description: (result as any)?.error || '未知错误', variant: 'destructive' });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="新增 admin 账号"
      description="admin 角色不绑定 volunteer，仅用于系统管理"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="姓名" required error={errors.name?.message}>
          <Input {...register('name')} placeholder="如 系统管理员" />
        </Field>
        <Field label="邮箱" required error={errors.email?.message}>
          <Input type="email" {...register('email')} placeholder="admin@example.com" />
        </Field>
        <Field label="密码" required error={errors.password?.message}>
          <Input type="text" {...register('password')} placeholder="≥ 8 位" />
        </Field>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting} size="lg">
            {isSubmitting ? '创建中…' : '新增 admin'}
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

  useEffect(() => { if (open) { setCsvText(''); setDefaultPassword('Volunteer@123'); } }, [open]);

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
      title="CSV 批量导入志愿者"
      description="字段：chineseName, englishName, status, region, province, departmentId, email, phone, role, password"
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">CSV 数据</label>
          <textarea
            rows={8}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={'chineseName,englishName,status,region,province,departmentId,email,role\n张三,Zhang San,在职,中国大陆,上海市,TECH,zhangsan@vt.local,user'}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">默认密码（可被 CSV 中的 password 列覆盖）</label>
          <Input value={defaultPassword} onChange={(e) => setDefaultPassword(e.target.value)} />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" className="flex-1" disabled={submitting} size="lg" onClick={onSubmit}>
            {submitting ? '导入中…' : '开始导入'}
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
      description="清空所有志愿者、项目支援、审计日志和非 admin 账号。仅 dev sandbox 使用。"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">不可撤销操作</p>
              <p className="mt-1 text-foreground">
                此操作会删除所有志愿者档案、项目支援记录、审计日志，并清空所有非 admin
                账号。当前 admin 账号会保留。
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            请输入 <span className="font-mono font-bold">RESET</span> 确认
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET"
          />
        </div>

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
    });
  }, [account, reset]);

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
            <Field label="登录姓名" required error={errors.name?.message}>
              <Input {...register('name')} />
            </Field>
            <Field label="邮箱" required error={errors.email?.message}>
              <Input type="email" {...register('email')} />
            </Field>
            <Field label="角色" required>
              <Select {...register('role')} disabled={isSelf}>
                <option value="user">user</option>
                <option value="b_admin">b_admin</option>
                <option value="a_admin">a_admin</option>
                <option value="admin">admin</option>
              </Select>
            </Field>
            <Field label="状态">
              <label className="flex h-8 items-center gap-2 px-1">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  disabled={isSelf}
                  className="h-4 w-4 rounded border-border text-primary"
                />
                <span className="text-sm text-foreground">激活账号</span>
              </label>
            </Field>
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
              <Field label="中文姓名" error={errors.chineseName?.message}>
                <Input {...register('chineseName')} />
              </Field>
              <Field label="英文姓名" error={errors.englishName?.message}>
                <Input {...register('englishName')} placeholder="可选" />
              </Field>
              <Field label="在职状态">
                <Select {...register('status')}>
                  <option value="在职">在职</option>
                  <option value="不在职">不在职</option>
                </Select>
              </Field>
              <Field label="部门" error={errors.departmentId?.message}>
                <Select {...register('departmentId')}>
                  <option value="">— 选择部门 —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="地区">
                <Select {...register('region')}>
                  {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
              <Field label={showProvince ? '省份 *' : '省份'} error={errors.province?.message}>
                <Input {...register('province')} placeholder={showProvince ? '大陆 / 台湾必填' : '可选'} />
              </Field>
              <Field label="电话">
                <Input {...register('phone')} placeholder="可选" />
              </Field>
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

// ─── Field wrapper (label + error) ──────────────────────────────────────────

const Field: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required, error, children }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-foreground">
      {label}
      {required && <span className="text-destructive">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

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
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
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
          <h2 className="font-serif text-2xl font-semibold text-foreground">系统管理中心</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">志愿者 / 账号 / 系统配置</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            刷新
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCsvImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4" />
            CSV 导入
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCreateAdminOpen(true)}>
            <Shield className="h-4 w-4" />
            新增 admin
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
            <Input
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
                  'inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors border',
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
            <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="">全部部门</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
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
              清空所有志愿者、项目支援、审计日志和非 admin 账号。仅 dev sandbox 使用。
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
      <CreateAdminDialog
        open={createAdminOpen}
        onOpenChange={setCreateAdminOpen}
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
