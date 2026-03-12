import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface LoginPageProps {
  loginEmail: string;
  loginPassword: string;
  loginSubmitting: boolean;
  loginError: string;
  onSubmit: (event: FormEvent) => Promise<void> | void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onBackHome: () => void;
}

function LoginPage({
  loginEmail,
  loginPassword,
  loginSubmitting,
  loginError,
  onSubmit,
  onEmailChange,
  onPasswordChange,
  onBackHome
}: LoginPageProps) {
  const emailId = 'login-email';
  const passwordId = 'login-password';

  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">账号登录</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">登录后可访问个人中心、审核中心与服务申请。</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBackHome}>
          返回首页
        </Button>
      </div>

      <form className="space-y-6" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label htmlFor={emailId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
            邮箱
          </label>
          <Input
            id={emailId}
            type="email"
            value={loginEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="admin@example.com"
            disabled={loginSubmitting}
            autoComplete="email"
            error={!!loginError && !loginEmail}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={passwordId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
            密码
          </label>
          <Input
            id={passwordId}
            type="password"
            value={loginPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="请输入密码"
            disabled={loginSubmitting}
            autoComplete="current-password"
            error={!!loginError && !loginPassword}
          />
        </div>
        {loginError && (
          <p className="text-sm text-red-500 dark:text-red-400" role="alert">
            {loginError}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={onBackHome} disabled={loginSubmitting}>
            取消
          </Button>
          <Button variant="default" type="submit" disabled={loginSubmitting}>
            {loginSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loginSubmitting ? '登录中...' : '登录'}
          </Button>
        </div>
      </form>
    </section>
  );
}

export default LoginPage;
