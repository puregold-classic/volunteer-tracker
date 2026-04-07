import { useEffect, useState } from 'react';
import { cn } from './lib/utils';
import Header from '@components/Header';
import { Button } from '@/components/ui/button';
import Footer from '@components/Footer';
import HomePage from './pages/HomePage';
import MePage from './pages/MePage';
import ReviewPage from './pages/ReviewPage';
import LoginPage from './pages/LoginPage';
import VolunteerDetailPage from './pages/VolunteerDetailPage';
import useReviewCenter from './hooks/useReviewCenter';
import { useHomeState, QUICK_FOCUS_OPTIONS } from './hooks/useHomeState';
import { useAuth } from './context/AuthContext';

type AppRoute = 'home' | 'login' | 'me' | 'review' | 'volunteer';

type RouteState = {
  route: AppRoute;
  volunteerId?: string;
};

const parseHashRoute = (): RouteState => {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  if (raw === '/' || raw === '') return { route: 'home' };
  if (raw === '/login') return { route: 'login' };
  if (raw === '/me') return { route: 'me' };
  if (raw === '/review') return { route: 'review' };
  if (raw.startsWith('/volunteer/')) {
    const volunteerId = decodeURIComponent(raw.replace('/volunteer/', '').trim());
    return volunteerId ? { route: 'volunteer', volunteerId } : { route: 'home' };
  }
  return { route: 'home' };
};

const toHash = (route: RouteState): string => {
  switch (route.route) {
    case 'login':
      return '#/login';
    case 'me':
      return '#/me';
    case 'review':
      return '#/review';
    case 'volunteer':
      return route.volunteerId ? `#/volunteer/${encodeURIComponent(route.volunteerId)}` : '#/';
    case 'home':
    default:
      return '#/';
  }
};

function App() {
  const [routeState, setRouteState] = useState<RouteState>(() => parseHashRoute());
  const {
    homeStatus,
    homeServices,

    homeSearch,
    homeStats,
    homeStatsLoading,
    selectedRegions,
    selectedProvinces,
    debouncedSearch,
    primaryFocusRegion,
    homeFilterParams,
    setHomeStatus,
    toggleService,
    setHomeSearch,
    toggleRegion,
    toggleProvince,
    isLocationActive,
    removeLocation,
    removeService,
    resetFilters,
    resetProvinceSelections,
    resetMap,
  } = useHomeState();
  const { account, isAuthenticated, isLoading, logout } = useAuth();
  const isReviewer = Boolean(account && ['b_admin', 'a_admin', 'admin'].includes(account.role));
  const currentPage = routeState.route;
  const { pendingReviews, processedReviews, reviewLoading, reviewError, refreshReview } = useReviewCenter(
    currentPage === 'review' ? 'review' : 'home',
    isAuthenticated,
    isReviewer
  );

  const navigateTo = (nextRoute: RouteState) => {
    const nextHash = toHash(nextRoute);
    if (window.location.hash === nextHash) {
      setRouteState(nextRoute);
      return;
    }
    window.location.hash = nextHash;
  };

  useEffect(() => {
    const syncRoute = () => setRouteState(parseHashRoute());
    window.addEventListener('hashchange', syncRoute);
    syncRoute();
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  const promptLogin = () => navigateTo({ route: 'login' });

  const goToPersonalCenter = () => {
    if (!isAuthenticated) { promptLogin(); return; }
    navigateTo({ route: 'me' });
  };

  const goToReviewCenter = () => {
    if (!isAuthenticated) { promptLogin(); return; }
    navigateTo({ route: 'review' });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-white/90 backdrop-blur-sm dark:bg-neutral-950/85">
        <div className="rounded-2xl bg-white px-6 py-5 text-center text-sm font-medium text-neutral-700 shadow-xl dark:bg-neutral-900 dark:text-neutral-100">
          正在检查登录状态...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      <Header
        title="志愿者管理系统"
        subtitle="全球志愿者可视化平台"
        navItems={[
          {
            label: '首页',
            active: currentPage === 'home',
            onClick: () => {
              navigateTo({ route: 'home' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          },
          { label: '个人中心', active: currentPage === 'me', onClick: goToPersonalCenter },
          { label: '审核中心', active: currentPage === 'review', onClick: goToReviewCenter }
        ]}
        actions={
          isAuthenticated ? (
            <>
              <span className="hidden sm:inline-flex rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-600 shrink-0">
                {account?.name} · {account?.role}
              </span>
              <Button
                variant="outline"
                size="sm"
                className={cn('border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 rounded-lg shrink-0')}
                onClick={() => {
                  navigateTo({ route: 'home' });
                  void logout();
                }}
              >
                退出登录
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              className={cn('rounded-lg shrink-0')}
              onClick={() => navigateTo({ route: 'login' })}
            >
              登录
            </Button>
          )
        }
      />

      <main className="flex-1 py-6 md:py-4">
        <div className="mx-auto w-full max-w-[92rem] px-2">
          {currentPage === 'home' && (
            <HomePage
              homeStatus={homeStatus}
              homeServices={homeServices}

              homeSearch={homeSearch}
              homeStats={homeStats}
              homeStatsLoading={homeStatsLoading}
              selectedRegions={selectedRegions}
              selectedProvinces={selectedProvinces}
              debouncedSearch={debouncedSearch}
              primaryFocusRegion={primaryFocusRegion}
              quickFocusOptions={QUICK_FOCUS_OPTIONS}
              homeFilterParams={homeFilterParams}
              onStatusChange={setHomeStatus}
              onServiceToggle={toggleService}
              onResetFilters={resetFilters}
              onProvinceSelect={toggleProvince}
              onResetProvinceSelections={resetProvinceSelections}
              onQuickFocusSelect={toggleRegion}
              onRefreshMap={resetMap}
              onSearchChange={setHomeSearch}
              onClearSearch={() => setHomeSearch('')}
              onLocationRemove={removeLocation}
              onServiceRemove={removeService}
              isLocationActive={isLocationActive}
              onVolunteerClick={(id) => navigateTo({ route: 'volunteer', volunteerId: id })}
            />
          )}

          {currentPage === 'login' && (
            <LoginPage
              onLoginSuccess={() => navigateTo({ route: 'me' })}
              onBackHome={() => navigateTo({ route: 'home' })}
            />
          )}

          {currentPage === 'me' && (
            <MePage
              homeTotalVolunteers={homeStats.totalVolunteers}
              onVolunteerDetail={(id) => navigateTo({ route: 'volunteer', volunteerId: id })}
              onBackHome={() => navigateTo({ route: 'home' })}
            />
          )}

          {currentPage === 'review' && (
            <ReviewPage
              isReviewer={isReviewer}
              reviewLoading={reviewLoading}
              reviewError={reviewError}
              pendingReviews={pendingReviews}
              processedReviews={processedReviews}
              onRefresh={refreshReview}
            />
          )}

          {currentPage === 'volunteer' && routeState.volunteerId && (
            <VolunteerDetailPage
              volunteerId={routeState.volunteerId}
              onBackHome={() => navigateTo({ route: 'home' })}
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
