import React from 'react';
import './VolunteerCard.scss';
import { Volunteer } from '@services/types';

export interface VolunteerCardProps {
  volunteer: Volunteer;
  onClick?: (id: string) => void;
  compact?: boolean;
}

const VolunteerCard: React.FC<VolunteerCardProps> = ({ 
  volunteer, 
  onClick,
  compact = false 
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick(volunteer.id);
    }
  };

  if (compact) {
    return (
      <div className="volunteer-card compact" onClick={handleClick}>
        <div className="card-header">
          <img src={volunteer.avatar} alt={volunteer.chineseName} className="avatar" />
          <div className="name-section">
            <h3 className="chinese-name">{volunteer.chineseName}</h3>
            <p className="english-name">{volunteer.englishName}</p>
          </div>
        </div>
        
        <div className="card-body">
          <div className="info-row">
            <span className="label">ID:</span>
            <span className="value">{volunteer.id}</span>
          </div>
          
          <div className="info-row">
            <span className="label">服务方向:</span>
            <div className="services">
              {volunteer.services.map((service, index) => (
                <span key={index} className="service-tag">{service}</span>
              ))}
            </div>
          </div>
          
          <div className="info-row">
            <span className="label">非项目服务:</span>
            <span className="value">
              {volunteer.nonProjectHours}小时 ({volunteer.nonProjectCount}次)
            </span>
          </div>
          
          <div className="info-row">
            <span className="label">状态:</span>
            <span className={`status ${volunteer.status === '在职' ? 'active' : 'inactive'}`}>
              {volunteer.status === '在职' ? '● 在职' : '○ 不在职'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="volunteer-card full" onClick={handleClick}>
      <div className="card-header">
        <img src={volunteer.avatar} alt={volunteer.chineseName} className="avatar" />
        <div className="name-section">
          <h2 className="chinese-name">{volunteer.chineseName}</h2>
          <h3 className="english-name">{volunteer.englishName}</h3>
          <div className="id-badge">{volunteer.id}</div>
        </div>
      </div>
      
      <div className="card-divider"></div>
      
      <div className="card-body">
        <div className="section">
          <h4 className="section-title">服务方向</h4>
          <div className="services-grid">
            {volunteer.services.map((service, index) => (
              <span key={index} className="service-pill">{service}</span>
            ))}
          </div>
        </div>
        
        <div className="section">
          <h4 className="section-title">非项目服务统计</h4>
          <div className="stats">
            <div className="stat-item">
              <span className="stat-value">{volunteer.nonProjectHours}</span>
              <span className="stat-label">小时</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{volunteer.nonProjectCount}</span>
              <span className="stat-label">次</span>
            </div>
          </div>
        </div>
        
        <div className="section">
          <h4 className="section-title">状态</h4>
          <div className={`status-badge ${volunteer.status === '在职' ? 'active' : 'inactive'}`}>
            {volunteer.status === '在职' ? '● 在职' : '○ 不在职'}
          </div>
        </div>
        
        <div className="section">
          <h4 className="section-title">地区</h4>
          <p className="region">{volunteer.region}</p>
        </div>
      </div>
    </div>
  );
};

export default VolunteerCard;