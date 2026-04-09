// frontend/src/App.tsx — chunk 6 phase A
//
// react-router v6 Routes. Replaces v1's hand-rolled hash-routing parser.
//
// Route structure:
//   /                          → HomePage           (public, desktop-first browse)
//   /login                     → LoginPage          (public)
//   /volunteers/:id            → VolunteerDetailPage (public detail)
//   /me                        → MePage             (auth, mobile-first for users; admin → AdminCenter)
//   /review                    → ReviewPage         (b_admin+; will be renamed to /ledger in phase F)
//   *                          → 404 fallback
//
// HomePage state still flows through useHomeState in this file because it's
// a complex shared hook; I'll move ownership into HomePage when I rewrite
// HomePage in phase C.

import { useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Header from '@components/Header';
import Footer from '@components/Footer';
import { Button } from '@/components/ui/button';
import HomePage from './pages/HomePage';
import MePage from './pages/MePage';
import ReviewPage from './pages/ReviewPage';
import LoginPage from './pages/LoginPage';
import VolunteerDetailPage from './pages/VolunteerDetailPage';
import { useHomeState, QUICK_FOCUS_OPTIONS } from './hooks/useHomeState';
import { useAuth } from './context/AuthContext';

// ─── Auth gate ──────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function RequireRole({ allowed, children }: { allowed: string[]; children: React.ReactNode }) {
  const { account, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!account || !allowed.includes(account.role)) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="font-serif text-2xl font-semibold text-foreground">权限不足</h2>
        <p className="mt-2 text-muted-foreground">该页面需要 {allowed.join(' / ')} 权限</p>
      </div>
    );
  }
  return <>{children}</>;
}

// ─── HomePage container — keeps the existing useHomeState wiring ────────────

function HomePageContainer() {
  const navigate = useNavigate();
  const home = useHomeState();
  return (
    <HomePage
      homeStatus={home.homeStatus}
      homeServices={home.homeServices}
      homeDepartmentId={home.homeDepartmentId}
      homeSearch={home.homeSearch}
      homeStats={home.homeStats}
      homeStatsLoading={home.homeStatsLoading}
      selectedRegions={home.selectedRegions}
      selectedProvinces={home.selectedProvinces}
      debouncedSearch={home.debouncedSearch}
      primaryFocusRegion={home.primaryFocusRegion}
      quickFocusOptions={QUICK_FOCUS_OPTIONS}
      homeFilterParams={home.homeFilterParams}
      onStatusChange={home.setHomeStatus}
      onDepartmentChange={home.setHomeDepartmentId}
      onServiceToggle={home.toggleService}
      onResetFilters={home.resetFilters}
      onProvinceSelect={home.toggleProvince}
      onResetProvinceSelections={home.resetProvinceSelections}
      onQuickFocusSelect={home.toggleRegion}
      onRefreshMap={home.resetMap}
      onSearchChange={home.setHomeSearch}
      onClearSearch={() => home.setHomeSearch('')}
      onLocationRemove={home.removeLocation}
      onServiceRemove={home.removeService}
      isLocationActive={home.isLocationActive}
      onVolunteerClick={(id) => navigate(`/volunteers/${id}`)}
    />
  );
}

// ─── App shell ──────────────────────────────────────────────────────────────

function App() {
  const { account, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  // Use the home stats just to display total in the header subtitle (optional)
  // In phase A I'm keeping HomePage's useHomeState owned by the container,
  // so we don't have shared stats here.

  // Build nav items per role
  const navItems = [
    { label: '首页', to: '/', end: true },
    ...(isAuthenticated ? [{ label: '个人中心', to: '/me', end: false }] : []),
    ...(isAuthenticated && account && ['b_admin', 'a_admin', 'admin'].includes(account.role)
      ? [{ label: '项目支援台账', to: '/review', end: false }]
      : []),
  ];

  // Listen to unauthorized events (from api.ts) and redirect
  useEffect(() => {
    const handler = () => {
      if (window.location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    };
    window.addEventListener('app:unauthorized', handler);
    return () => window.removeEventListener('app:unauthorized', handler);
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/90 backdrop-blur-sm">
        <div className="rounded-2xl border border-border bg-card px-6 py-5 text-center text-sm font-medium text-foreground shadow-xl">
          正在检查登录状态…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        navItems={navItems}
        actions={
          isAuthenticated ? (
            <>
              <span className="hidden sm:inline-flex rounded-lg bg-muted/60 border border-border px-3 py-1.5 text-sm font-medium text-foreground shrink-0">
                {account?.name} · {account?.role}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg shrink-0"
                onClick={() => {
                  void logout().then(() => navigate('/'));
                }}
              >
                退出登录
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" className="rounded-lg shrink-0" asChild>
              <Link to="/login">登录</Link>
            </Button>
          )
        }
      />

      <main className="flex-1 py-6 md:py-4">
        <div className="mx-auto w-full max-w-[92rem] px-2 sm:px-4">
          <Routes>
            <Route path="/" element={<HomePageContainer />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/volunteers/:id" element={<VolunteerDetailPageWrapper />} />
            <Route
              path="/me"
              element={
                <RequireAuth>
                  <MePageWrapper />
                </RequireAuth>
              }
            />
            <Route
              path="/review"
              element={
                <RequireRole allowed={['b_admin', 'a_admin', 'admin']}>
                  <ReviewPageWrapper />
                </RequireRole>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ─── Page wrappers (adapt old-prop signatures to react-router params) ──────

function VolunteerDetailPageWrapper() {
  const navigate = useNavigate();
  const id = window.location.pathname.split('/').pop() || '';
  return <VolunteerDetailPage volunteerId={id} onBackHome={() => navigate('/')} />;
}

function MePageWrapper() {
  const navigate = useNavigate();
  return (
    <MePage
      homeTotalVolunteers={0}
      onVolunteerDetail={(id) => navigate(`/volunteers/${id}`)}
      onBackHome={() => navigate('/')}
    />
  );
}

function ReviewPageWrapper() {
  const { account } = useAuth();
  const isReviewer = Boolean(account && ['b_admin', 'a_admin', 'admin'].includes(account.role));
  return <ReviewPage isReviewer={isReviewer} />;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="font-serif text-6xl font-semibold text-primary">404</p>
      <p className="mt-3 text-foreground">页面不存在</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">返回首页</Link>
      </Button>
    </div>
  );
}

export default App;
