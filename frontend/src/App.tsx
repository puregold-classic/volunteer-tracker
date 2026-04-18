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

import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Header from '@components/Header';
import Footer from '@components/Footer';
import { Button } from '@/components/ui/button';
import volunteerService from '@services/volunteerService';
import type { ProvinceCount } from '@components/HomeMap/HomeMap';
// HomePage stays eager (it's the landing route — lazy would just cost a
// flash of fallback for the first paint). The other 4 pages are gated
// behind auth or click and account for the bulk of the bundle, so we
// split them out.
import HomePage from './pages/HomePage';
const MePage = lazy(() => import('./pages/MePage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const VolunteerDetailPage = lazy(() => import('./pages/VolunteerDetailPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const TagsPage = lazy(() => import('./pages/TagsPage'));
import { useHomeState, QUICK_FOCUS_OPTIONS } from './hooks/useHomeState';
import { useAuth } from './context/AuthContext';
import { resolveVolunteerCardTarget } from '@/lib/routing';

// Inline route fallback while a code-split chunk is loading.
const RouteFallback: React.FC = () => (
  <div className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">加载中…</div>
);

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
  const { isAuthenticated, account } = useAuth();
  const home = useHomeState();
  const [provinceCounts, setProvinceCounts] = useState<ProvinceCount[]>([]);

  // Heatmap source data — fetched once on mount. Not affected by filters;
  // the heatmap shows the global 志愿者分布 regardless of what the list
  // above is currently filtered to.
  useEffect(() => {
    let cancelled = false;
    void volunteerService.getProvinceCounts().then((res) => {
      if (!cancelled && res?.success && Array.isArray(res.data)) {
        setProvinceCounts(res.data);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Click routing: anonymous → /login, self → /me, other → detail page.
  // Decision logic lives in lib/routing.ts so it can be unit-tested
  // without router / context mocks.
  const handleVolunteerClick = (id: string) => {
    const target = resolveVolunteerCardTarget({
      isAuthenticated,
      ownVolunteerId: account?.volunteerId,
      targetVolunteerId: id,
    });
    navigate(target.route);
  };
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
      provinceCounts={provinceCounts}
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
      onVolunteerClick={handleVolunteerClick}
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
      ? [
          { label: '项目支援台账', to: '/review', end: false },
          { label: '项目级录入', to: '/projects', end: false },
          { label: '标签管理', to: '/tags', end: false },
        ]
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
          <Suspense fallback={<RouteFallback />}>
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
            <Route
              path="/projects"
              element={
                <RequireRole allowed={['b_admin', 'a_admin', 'admin']}>
                  <ProjectsPage />
                </RequireRole>
              }
            />
            <Route
              path="/tags"
              element={
                <RequireRole allowed={['b_admin', 'a_admin', 'admin']}>
                  <TagsPage />
                </RequireRole>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
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
  return <MePage onBackHome={() => navigate('/')} />;
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
