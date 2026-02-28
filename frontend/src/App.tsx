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
import { useAuth } from './context/AuthContext';

type HeaderPage = 'home' | 'me' | 'review';

function App() {
  const [activePage, setActivePage] = useState<HeaderPage>('home');
  const [homeStatus, setHomeStatus] = useState<'all' | '在职' | '不在职'>('all');
  const [homeService, setHomeService] = useState<string>('all');
  const [homeRegions, setHomeRegions] = useState<string[]>([]);
  const [homeProvinces, setHomeProvinces] = useState<string[]>([]);
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
  const { account, isAuthenticated, isLoading, login, logout } = useAuth();
  const isReviewer = Boolean(account && ['b_admin', 'a_admin', 'admin'].includes(account.role));

  const QUICK_FOCUS_OPTIONS = ['中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '重置世界视图'] as const;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(homeSearch.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [homeSearch]);

  const homeFilterParams = useMemo<VolunteersParams>(() => {
    const params: VolunteersParams = {
      limit: 20,
      order: 'desc',
      sortBy: 'createdAt'
    };
    if (homeStatus !== 'all') params.status = homeStatus;
    if (homeService !== 'all') params.services = [homeService];
    if (homeRegions.length > 0) params.region = homeRegions;
    if (homeProvinces.length > 0) params.province = homeProvinces;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [homeStatus, homeService, homeRegions, homeProvinces, debouncedSearch]);

  const homeStatsFilterParams = useMemo<VolunteersParams>(() => {
    const params: VolunteersParams = {};
    if (homeStatus !== 'all') params.status = homeStatus;
    if (homeService !== 'all') params.services = [homeService];
    if (homeRegions.length > 0) params.region = homeRegions;
    if (homeProvinces.length > 0) params.province = homeProvinces;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [homeStatus, homeService, homeRegions, homeProvinces, debouncedSearch]);

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
    try {
      const result = await volunteerService.getVolunteerById(id);
      if (result?.success && result?.data) {
        setVolunteerDetail(result.data);
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

  const primaryFocusRegion = homeRegions.length > 0 ? homeRegions[homeRegions.length - 1] : '';
  const nonChinaRegions = homeRegions.filter((region) => !['中国大陆', '中国台湾'].includes(region));
  const regionProvinceSummary = (() => {
    if (homeProvinces.length > 0 && nonChinaRegions.length > 0) {
      return `中国省份: ${homeProvinces.join(' / ')}；其他地区: ${nonChinaRegions.join(' / ')}`;
    }
    if (homeProvinces.length > 0) {
      return `中国省份: ${homeProvinces.join(' / ')}`;
    }
    if (homeRegions.length > 0) {
      return `地区: ${homeRegions.join(' / ')}`;
    }
    return '未选择';
  })();

  const toggleRegion = (region: string) => {
    setHomeRegions((prev) => {
      const exists = prev.includes(region);
      const next = exists ? prev.filter((item) => item !== region) : [...prev, region];
      if (!next.includes('中国大陆') && !next.includes('中国台湾')) {
        setHomeProvinces([]);
      }
      return next;
    });
  };

  const toggleProvince = (province: string) => {
    const normalized = province === '台湾' ? '台湾省' : province;
    if (normalized === '台湾省') {
      setHomeRegions((prev) => (prev.includes('中国台湾') ? prev : [...prev, '中国台湾']));
    } else {
      setHomeRegions((prev) => (prev.includes('中国大陆') ? prev : [...prev, '中国大陆']));
    }
    setHomeProvinces((prev) => (prev.includes(normalized) ? prev.filter((p) => p !== normalized) : [...prev, normalized]));
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
                        <option value="项目培训">项目培训</option>
                        <option value="非项目培训">非项目培训</option>
                        <option value="受训">受训</option>
                        <option value="管理">管理</option>
                        <option value="技术">技术</option>
                        <option value="社区服务">社区服务</option>
                      </select>
                    </div>
                    <div className="filter-field">
                      <span>地区/省份</span>
                      <div className="filter-selected">
                        {regionProvinceSummary}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="filter-reset"
                      onClick={() => {
                        setHomeStatus('all');
                        setHomeService('all');
                        setHomeRegions([]);
                        setHomeProvinces([]);
                        setHomeSearch('');
                      }}
                    >
                      重置
                    </button>
                  </div>
                </div>

                <div className="map-stage">
                  <HomeMap
                    activeProvince={homeProvinces}
                    focusRegion={primaryFocusRegion}
                    onProvinceSelect={(province) => {
                      toggleProvince(province);
                    }}
                    onReset={() => setHomeProvinces([])}
                  />
                </div>

                <div className="focus-bar">
                  {QUICK_FOCUS_OPTIONS.map((item) => (
                    <button
                      key={item}
                      className={homeRegions.includes(item) ? 'is-active' : ''}
                      onClick={() => {
                        if (item === '重置世界视图') {
                          setHomeRegions([]);
                          setHomeProvinces([]);
                          return;
                        }
                        toggleRegion(item);
                      }}
                    >
                      {item}
                    </button>
                  ))}
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
                    {homeRegions.map((region) => <span key={`region-${region}`} className="summary-tag">地区: {region}</span>)}
                    {homeProvinces.map((province) => <span key={`province-${province}`} className="summary-tag">省份: {province}</span>)}
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
              <h2>个人中心</h2>
              <div className="info-grid">
                <p><strong>姓名:</strong> {account?.name || '-'}</p>
                <p><strong>邮箱:</strong> {account?.email || '-'}</p>
                <p><strong>角色:</strong> {account?.role || '-'}</p>
                <p><strong>绑定志愿者ID:</strong> {account?.volunteerId || '未绑定'}</p>
                <p><strong>账号状态:</strong> {account?.isActive ? '启用' : '停用'}</p>
                <p><strong>最近登录:</strong> {account?.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : '暂无'}</p>
              </div>
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
              <h3 className="modal-title">志愿者详情</h3>
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
