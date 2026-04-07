import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onBackHome: () => void;
}

function LoginPage({ onLoginSuccess, onBackHome }: LoginPageProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const emailId = 'login-email';
  const passwordId = 'login-password';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError('请输入邮箱和密码');
      toast({ title: '登录失败', description: '请输入邮箱和密码', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      toast({ title: '登录成功', description: '欢迎回来！' });
      onLoginSuccess();
    } catch (err: any) {
      const msg = err?.message || '登录失败，请稍后重试';
      setError(msg);
      toast({ title: '登录失败', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-md">
      {/* Brand header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 text-2xl shadow-md shadow-teal-200/60">
          🤝
        </div>
        <h1 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">纯金经典翻译计划</h1>
        <p className="mt-1 text-sm text-neutral-400">志愿者管理网站</p>
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">账号登录</h2>
          <Button variant="ghost" size="sm" onClick={onBackHome}>返回首页</Button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor={emailId} className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              邮箱
            </label>
            <Input
              id={emailId}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="admin@example.com"
              disabled={submitting}
              autoComplete="email"
              error={!!error && !email}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={passwordId} className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              密码
            </label>
            <Input
              id={passwordId}
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="请输入密码"
              disabled={submitting}
              autoComplete="current-password"
              error={!!error && !password}
            />
          </div>
          {error && (
            <p className="text-sm text-red-500 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <Button className="mt-2 w-full" variant="default" type="submit" disabled={submitting} size="lg">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? '登录中...' : '登录'}
          </Button>
          <p className="text-center text-xs text-neutral-400">
            登录后可访问个人中心、审核中心与服务申请。
          </p>
        </form>
      </div>
    </section>
  );
}

export default LoginPage;
