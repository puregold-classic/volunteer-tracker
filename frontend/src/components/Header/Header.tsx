import React from 'react';
import './Header.scss';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">🤝</span>
          <h1 className="title">{title}</h1>
        </div>
        
        {subtitle && (
          <p className="subtitle">{subtitle}</p>
        )}
        
        <nav className="nav">
          <a href="#home" className="nav-link active">首页</a>
          <a href="#volunteers" className="nav-link">志愿者</a>
          <a href="#stats" className="nav-link">统计</a>
          <a href="#about" className="nav-link">关于</a>
        </nav>
      </div>
    </header>
  );
};

export default Header;