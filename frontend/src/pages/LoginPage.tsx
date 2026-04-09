// frontend/src/pages/LoginPage.tsx — chunk 6 phase A
//
// Self-routing: useNavigate instead of onLoginSuccess/onBackHome props.
// Tokens migrated to semantic (no more text-neutral-XXX).

import { FormEvent, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Handshake } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';

interface LocationState {
  from?: { pathname: string };
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
      toast({ title: '登录成功', description: '欢迎回来' });
      // Resume original target if redirected here from a protected page
      const state = location.state as LocationState | undefined;
      const next = state?.from?.pathname || '/me';
      navigate(next, { replace: true });
    } catch (err: any) {
      const msg = err?.message || '登录失败，请稍后重试';
      setError(msg);
      toast({ title: '登录失败', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-md py-12">
      {/* Brand header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
          <Handshake className="h-7 w-7" strokeWidth={2} />
        </div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">纯金经典翻译计划</h1>
        <p className="mt-1 text-sm text-muted-foreground">志愿者管理</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-foreground">账号登录</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">返回首页</Link>
          </Button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="login-email" className="text-sm font-medium text-foreground">
              邮箱
            </label>
            <Input
              id="login-email"
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
            <label htmlFor="login-password" className="text-sm font-medium text-foreground">
              密码
            </label>
            <Input
              id="login-password"
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
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button className="mt-2 w-full" variant="default" type="submit" disabled={submitting} size="lg">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? '登录中...' : '登录'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            登录后可访问个人中心、项目支援台账与提交流程
          </p>
        </form>
      </div>
    </section>
  );
}

export default LoginPage;
