import React, { useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import reviewService, { ReviewPendingApplication } from '@services/reviewService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SectionHeader } from '@/components/shared/section-header';

interface ReviewCenterProps {
  isReviewer: boolean;
  reviewLoading: boolean;
  reviewError: string;
  pendingReviews: ReviewPendingApplication[];
  processedReviews: ReviewPendingApplication[];
  onRefresh: () => void;
}

const CHART_Y_TICK_COUNT = 4;
type ChartMode = 'create' | 'update' | 'delete';

const CHART_MODE_LABEL: Record<ChartMode, string> = {
  create: 'Create',
  update: 'Change',
  delete: 'Delete'
};

const readChangeValue = (item: ReviewPendingApplication, field: string): unknown => {
  const change = item.changes.find((entry) => entry.field === field);
  if (!change) return undefined;
  return change.to ?? change.from;
};

const getServiceType = (item: ReviewPendingApplication): string => {
  const value = item.serviceType ?? readChangeValue(item, 'serviceType');
  return typeof value === 'string' && value.trim() ? value : '未分类';
};

const getDuration = (item: ReviewPendingApplication): number => {
  const value = item.duration ?? readChangeValue(item, 'duration');
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const getServiceDate = (item: ReviewPendingApplication): string => {
  const value = readChangeValue(item, 'serviceDate');
  return typeof value === 'string' ? value : '';
};

const getDescription = (item: ReviewPendingApplication): string => {
  const value = readChangeValue(item, 'description');
  return typeof value === 'string' ? value : '';
};

const getUnitValue = (item: ReviewPendingApplication, mode: ChartMode): number => {
  if (mode === 'create') return getDuration(item);
  return 1;
};

const colorByPerson = (personId: string): string => {
  let hash = 0;
  for (let index = 0; index < personId.length; index += 1) {
    hash = personId.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 68% 52%)`;
};

const formatChangeValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const hasEffectiveChange = (from: unknown, to: unknown): boolean => {
  if (from === null && to === null) return false;
  if (from === undefined && to === undefined) return false;
  if (from === to) return false;
  return true;
};

const ReviewCenter: React.FC<ReviewCenterProps> = ({
  isReviewer,
  reviewLoading,
  reviewError,
  pendingReviews,
  processedReviews,
  onRefresh
}) => {
  const [chartMode, setChartMode] = useState<ChartMode>('create');
  const [selectedGroup, setSelectedGroup] = useState<{ serviceType: string; volunteerId: string } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSubmittingId, setReviewSubmittingId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [reviewActionMessage, setReviewActionMessage] = useState('');
  const [hideProcessed, setHideProcessed] = useState(false);
  const [selectedProcessed, setSelectedProcessed] = useState<ReviewPendingApplication | null>(null);

  const pendingByMode = useMemo(
    () => pendingReviews.filter((item) => item.applicationType === chartMode),
    [pendingReviews, chartMode]
  );
  const visibleProcessed = useMemo(
    () => (hideProcessed ? [] : processedReviews),
    [processedReviews, hideProcessed]
  );

  const stackedChart = useMemo(() => {
    const map = new Map<
      string,
      {
        totalHours: number;
        people: Array<{ volunteerId: string; volunteerName: string; hours: number }>;
      }
    >();

    pendingByMode.forEach((item) => {
      const serviceType = getServiceType(item);
      const unitValue = getUnitValue(item, chartMode);
      if (!unitValue) return;

      const bucket = map.get(serviceType) ?? { totalHours: 0, people: [] };
      bucket.totalHours += unitValue;

      const existed = bucket.people.find((person) => person.volunteerId === item.volunteerId);
      if (existed) {
        existed.hours += unitValue;
      } else {
        bucket.people.push({
          volunteerId: item.volunteerId,
          volunteerName: item.volunteerName,
          hours: unitValue
        });
      }

      map.set(serviceType, bucket);
    });

    const bars = Array.from(map.entries())
      .map(([serviceType, value]) => ({
        serviceType,
        totalHours: value.totalHours,
        people: value.people.sort((a, b) => a.volunteerName.localeCompare(b.volunteerName, 'zh-Hans-CN'))
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    const maxHours = bars.length > 0 ? Math.max(...bars.map((bar) => bar.totalHours)) : 0;
    const roundedMax = maxHours <= 4 ? 4 : Math.ceil(maxHours / 2) * 2;
    const yTicks = Array.from({ length: CHART_Y_TICK_COUNT + 1 }, (_, idx) => {
      const ratio = 1 - idx / CHART_Y_TICK_COUNT;
      return Number((roundedMax * ratio).toFixed(1));
    });

    const legendMap = new Map<string, { volunteerId: string; volunteerName: string; hours: number }>();
    bars.forEach((bar) => {
      bar.people.forEach((person) => {
        const current = legendMap.get(person.volunteerId);
        if (current) {
          current.hours += person.hours;
        } else {
          legendMap.set(person.volunteerId, { ...person });
        }
      });
    });

    const legend = Array.from(legendMap.values()).sort((a, b) => b.hours - a.hours);

    return { bars, maxHours: roundedMax, yTicks, legend };
  }, [pendingByMode, chartMode]);

  const selectedApplications = useMemo(() => {
    if (!selectedGroup) return [];
    return pendingReviews
      .filter((item) => item.applicationType === chartMode)
      .filter((item) => getServiceType(item) === selectedGroup.serviceType && item.volunteerId === selectedGroup.volunteerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [pendingReviews, selectedGroup, chartMode]);
  const selectedProcessedEffectiveChanges = useMemo(
    () => (selectedProcessed?.changes || []).filter((change) => hasEffectiveChange(change.from, change.to)),
    [selectedProcessed]
  );

  const handleReview = async (applicationId: string, result: 'approved' | 'rejected') => {
    try {
      setReviewSubmittingId(applicationId);
      setReviewActionMessage('');
      const note = reviewNote.trim() || (result === 'approved' ? '图表快速审核：通过' : '图表快速审核：驳回');
      const res = await reviewService.processReview(applicationId, result, note);
      setReviewActionMessage(res?.message || `申请 ${applicationId} 已${result === 'approved' ? '通过' : '驳回'}`);
      onRefresh();
    } catch (error: any) {
      setReviewActionMessage(error?.message || '审核操作失败');
    } finally {
      setReviewSubmittingId(null);
    }
  };

  const handleApproveAllInCurrentGraph = async () => {
    if (pendingByMode.length === 0) return;
    try {
      setBulkApproving(true);
      setReviewActionMessage('');
      const note = reviewNote.trim() || `图表一键通过：${CHART_MODE_LABEL[chartMode]} 申请`;
      const results = await Promise.allSettled(
        pendingByMode.map((item) => reviewService.processReview(item.applicationId, 'approved', note))
      );
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      setReviewActionMessage(
        failed > 0
          ? `一键通过完成：成功 ${succeeded} 条，失败 ${failed} 条`
          : `一键通过完成：成功 ${succeeded} 条`
      );
      onRefresh();
    } finally {
      setBulkApproving(false);
    }
  };

  return (
    <section className="space-y-5">
      <Card variant="elevated" className="p-6">
        <SectionHeader
          eyebrow="review"
          title="审核中心"
          description="保持现有审核逻辑不变，优先统一按钮、输入框和状态标签反馈。"
          actions={<Button type="button" variant="outline" onClick={onRefresh}><RefreshCcw className="h-4 w-4" />刷新</Button>}
        />
      </Card>
      {!isReviewer ? (
        <p className="center-empty">当前账号无审核权限（需 b_admin / a_admin / admin）。</p>
      ) : reviewLoading ? (
        <p className="center-empty">正在加载审核数据...</p>
      ) : reviewError ? (
        <p className="center-empty">{reviewError}</p>
      ) : (
        <div className="space-y-6">
          <Card variant="elevated" className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">待审核申请图表</h3>
            <div className="review-chart-card mt-4">
              <h4>{CHART_MODE_LABEL[chartMode]} 申请图</h4>
              <div className="review-chart-switch">
                {(Object.keys(CHART_MODE_LABEL) as ChartMode[]).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={chartMode === mode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setChartMode(mode);
                      setSelectedGroup(null);
                      setReviewActionMessage('');
                    }}
                  >
                    {CHART_MODE_LABEL[mode]}
                  </Button>
                ))}
              </div>
              <p className="review-chart-subtitle">
                横轴按服务分类，{chartMode === 'create' ? '纵轴为工时' : '纵轴为申请数量（每条等高）'}，堆叠段按志愿者区分（同人同色）。
              </p>
              {stackedChart.bars.length === 0 ? (
                <p className="center-empty">当前没有可展示的 {chartMode} 待审核记录</p>
              ) : (
                <>
                  <div className="review-chart-shell">
                    <div className="review-chart-y-axis">
                      {stackedChart.yTicks.map((tick) => (
                        <span key={tick}>{chartMode === 'create' ? `${tick}h` : `${tick}`}</span>
                      ))}
                    </div>
                    <div className="review-chart-plot">
                      {stackedChart.yTicks.map((tick) => (
                        <div key={`line-${tick}`} className="review-chart-grid-line" />
                      ))}
                      <div className="review-chart-bars">
                        {stackedChart.bars.map((bar) => (
                          <div key={bar.serviceType} className="review-chart-bar-wrap">
                            <div className="review-chart-bar">
                              {bar.people.map((person) => (
                                <div
                                  key={`${bar.serviceType}-${person.volunteerId}`}
                                  className="review-chart-segment"
                                  style={{
                                    height: `${(person.hours / stackedChart.maxHours) * 100}%`,
                                    backgroundColor: colorByPerson(person.volunteerId)
                                  }}
                                  onClick={() => {
                                    setSelectedGroup({ serviceType: bar.serviceType, volunteerId: person.volunteerId });
                                    setReviewActionMessage('');
                                  }}
                                  title={`${person.volunteerName} · ${chartMode === 'create' ? `${person.hours.toFixed(1)}h` : `${person.hours}条`}`}
                                />
                              ))}
                            </div>
                            <p className="review-chart-x-label">{bar.serviceType}</p>
                            <p className="review-chart-total">
                              {chartMode === 'create' ? `${bar.totalHours.toFixed(1)}h` : `${Math.round(bar.totalHours)}条`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="review-chart-legend">
                    {stackedChart.legend.map((person) => (
                      <span key={person.volunteerId} className="review-chart-legend-item">
                        <i style={{ backgroundColor: colorByPerson(person.volunteerId) }} />
                        {person.volunteerName}
                      </span>
                    ))}
                  </div>
                  <div className="review-chart-bulk">
                    <Button
                      type="button"
                      onClick={() => void handleApproveAllInCurrentGraph()}
                      disabled={bulkApproving || pendingByMode.length === 0}
                    >
                      {bulkApproving ? '一键通过中...' : `一键通过当前${CHART_MODE_LABEL[chartMode]}图全部`}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
            <Card variant="elevated" className="p-6">
              <SectionHeader eyebrow="pending" title={`待审核列表 (${pendingReviews.length})`} description="左侧主列承载待审核列表与快速操作入口。" />
              <div className="mt-5 space-y-3">
                {pendingReviews.length === 0 ? (
                  <p className="center-empty">暂无待审核记录</p>
                ) : (
                  pendingReviews.map((item) => (
                    <article key={item.applicationId} className="review-item-card">
                      <p className="flex flex-wrap items-center gap-2"><strong>{item.volunteerName}</strong><Badge variant="outline">{item.applicationType}</Badge></p>
                      <p>ID: {item.applicationId}</p>
                      <p>志愿者ID: {item.volunteerId}</p>
                      <p>提交时间: {new Date(item.createdAt).toLocaleString()}</p>
                    </article>
                  ))
                )}
              </div>
            </Card>

            <Card variant="elevated" className="p-6">
              <SectionHeader
                eyebrow="processed"
                title={`已审核记录 (${visibleProcessed.length})`}
                actions={<Button type="button" variant="outline" size="sm" onClick={() => setHideProcessed((v) => !v)}>{hideProcessed ? '恢复显示' : '清空列表'}</Button>}
              />
              <div className="mt-5 space-y-3">
                {visibleProcessed.length === 0 ? (
                  <p className="center-empty">暂无已审核记录</p>
                ) : (
                  visibleProcessed.map((item) => (
                    <article
                      key={item.applicationId}
                      className="review-item-card"
                      onClick={() => setSelectedProcessed(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedProcessed(item);
                        }
                      }}
                    >
                      <p><strong>{item.volunteerName}</strong> · {item.status}</p>
                      <p>ID: {item.applicationId}</p>
                      <p>类型: {item.applicationType}</p>
                      <p>更新时间: {new Date(item.updatedAt).toLocaleString()}</p>
                    </article>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
      {selectedGroup && (
        <div className="modal-overlay" onClick={() => setSelectedGroup(null)}>
          <div className="modal review-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{CHART_MODE_LABEL[chartMode]} 申请明细</h3>
              <button className="modal-close" onClick={() => setSelectedGroup(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="review-detail-meta">
                类型: <strong>{CHART_MODE_LABEL[chartMode]}</strong> · 分类: <strong>{selectedGroup.serviceType}</strong> · 志愿者ID: <strong>{selectedGroup.volunteerId}</strong>
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">审核备注（可选，留空将用默认备注）</label>
                <Input
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="例如：信息完整，建议通过"
                />
              </div>
              {selectedApplications.length === 0 ? (
                <p className="center-empty">暂无可操作记录，可能刚刚已处理。</p>
              ) : (
                <div className="review-detail-list">
                  {selectedApplications.map((item) => (
                    <article key={item.applicationId} className="review-item-card">
                      <p>
                        <strong>{item.volunteerName}</strong> · {chartMode === 'create' ? `${getDuration(item).toFixed(1)}h` : '1条'}
                      </p>
                      <p>ID: {item.applicationId}</p>
                      <p>服务日期: {getServiceDate(item) || '-'}</p>
                      <p>描述: {getDescription(item) || '-'}</p>
                      <p>提交时间: {new Date(item.createdAt).toLocaleString()}</p>
                      <div className="review-item-actions">
                        <Button
                          type="button"
                          disabled={reviewSubmittingId === item.applicationId}
                          onClick={() => void handleReview(item.applicationId, 'approved')}
                        >
                          {reviewSubmittingId === item.applicationId ? '处理中...' : '通过'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={reviewSubmittingId === item.applicationId}
                          onClick={() => void handleReview(item.applicationId, 'rejected')}
                        >
                          驳回
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {reviewActionMessage && <p className="nps-msg">{reviewActionMessage}</p>}
            </div>
          </div>
        </div>
      )}
      {selectedProcessed && (
        <div className="modal-overlay" onClick={() => setSelectedProcessed(null)}>
          <div className="modal review-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">已审核详情</h3>
              <button className="modal-close" onClick={() => setSelectedProcessed(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="review-detail-meta">
                <strong>{selectedProcessed.volunteerName}</strong> · {selectedProcessed.applicationType} · {selectedProcessed.status}
              </p>
              <p className="review-detail-meta">申请ID: {selectedProcessed.applicationId}</p>
              <div className="review-detail-list">
                {selectedProcessedEffectiveChanges.length === 0 ? (
                  <p className="center-empty">无变更明细</p>
                ) : (
                  selectedProcessedEffectiveChanges.map((change, index) => (
                    <article key={`${selectedProcessed.applicationId}-${change.field}-${index}`} className="review-item-card">
                      <p><strong>{change.field}</strong></p>
                      <p>{formatChangeValue(change.from)} → {formatChangeValue(change.to)}</p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ReviewCenter;
