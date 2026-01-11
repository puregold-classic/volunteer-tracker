import React from 'react';
import './Footer.scss';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3 className="footer-title">志愿者管理系统</h3>
          <p className="footer-description">
            一个全球志愿者可视化管理系统，展示志愿者分布和支持多维筛选。
          </p>
        </div>
        
        <div className="footer-section">
          <h4 className="footer-subtitle">功能模块</h4>
          <ul className="footer-links">
            <li><a href="#map">地图可视化</a></li>
            <li><a href="#volunteers">志愿者管理</a></li>
            <li><a href="#stats">数据统计</a></li>
            <li><a href="#reports">报告生成</a></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h4 className="footer-subtitle">技术支持</h4>
          <ul className="footer-links">
            <li><a href="#api">API文档</a></li>
            <li><a href="#github">GitHub仓库</a></li>
            <li><a href="#issues">问题反馈</a></li>
            <li><a href="#contact">联系我们</a></li>
          </ul>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p className="copyright">
          © {currentYear} Volunteer Tracker Demo. All rights reserved.
        </p>
        <p className="version">版本: v1.0.0-demo</p>
      </div>
    </footer>
  );
};

export default Footer;