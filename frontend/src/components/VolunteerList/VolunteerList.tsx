import React, { useState, useEffect } from 'react';
import './VolunteerList.scss';
import VolunteerCard from '@components/VolunteerCard';
import { Volunteer } from '@services/types';
import { volunteerService } from '@services/volunteerService';
import { VolunteersParams } from '@services/api';

export interface VolunteerListProps {
  compact?: boolean;
  onVolunteerClick?: (id: string) => void;
  showStats?: boolean;
  showPagination?: boolean;
  filterParams?: VolunteersParams;
  emptyMessage?: string;
}

const VolunteerList: React.FC<VolunteerListProps> = ({
  compact = false,
  onVolunteerClick,
  showStats = true,
  showPagination = true,
  filterParams,
  emptyMessage
}) => {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalHours: 0
  });

  useEffect(() => {
    fetchVolunteers(filterParams);
    if (showStats || showPagination) {
      fetchStats();
    }
  }, [JSON.stringify(filterParams), showStats, showPagination]);

  const fetchVolunteers = async (params?: VolunteersParams) => {
    try {
      setLoading(true);
      const response = await volunteerService.getAllVolunteers(params);
      if (response.success && response.data) {
        setVolunteers(response.data || []);
      }
    } catch (err: any) {
      setError(err.message || '获取志愿者数据失败');
      console.error('Error fetching volunteers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await volunteerService.getStats();
      if (response.success && response.data.summary) {
        const { summary } = response.data;
        setStats({
          total: summary.totalVolunteers,
          active: summary.totalActive,
          totalHours: summary.totalHours
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleVolunteerClick = (id: string) => {
    if (onVolunteerClick) {
      onVolunteerClick(id);
    } else {
      // 默认行为：显示详情
      window.open(`/volunteers/${id}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>正在加载志愿者数据...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>加载失败</h3>
        <p>{error}</p>
        <button onClick={fetchVolunteers} className="retry-button">
          重试
        </button>
      </div>
    );
  }

  if (volunteers.length === 0) {
    return (
      <div className="empty-container">
        <div className="empty-icon">📋</div>
        <h3>暂无匹配结果</h3>
        <p>{emptyMessage || '当前筛选条件下没有志愿者数据'}</p>
      </div>
    );
  }

  return (
    <div className="volunteer-list">
      {showStats && (
        <div className="stats-bar">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">总志愿者</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.active}</div>
            <div className="stat-label">在职志愿者</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalHours}</div>
            <div className="stat-label">总服务小时</div>
          </div>
        </div>
      )}

      {/* 志愿者网格 */}
      <div className={`volunteers-grid ${compact ? 'compact' : 'full'}`}>
        {volunteers.map((volunteer) => (
          <VolunteerCard
            key={volunteer.id}
            volunteer={volunteer}
            compact={compact}
            onClick={handleVolunteerClick}
          />
        ))}
      </div>

      {showPagination && (
        <div className="pagination-info">
          <span>显示 {volunteers.length} 位志愿者</span>
          <span>共 {stats.total} 位志愿者</span>
        </div>
      )}
    </div>
  );
};

export default VolunteerList;
