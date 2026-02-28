import React from 'react';
import './Header.scss';

interface HeaderNavItem {
  label: string;
  active?: boolean;
  onClick: () => void;
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  navItems?: HeaderNavItem[];
  actions?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle, navItems = [], actions }) => {
  return (
    <header className="header">
      <div className="container">
        <div className="logo">
          <span className="logo-icon">🤝</span>
          <div>
            <h1 className="title">{title}</h1>
            {subtitle && <p className="subtitle">{subtitle}</p>}
          </div>
        </div>

        <div className="header-right">
          <nav className="nav">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`nav-link ${item.active ? 'active' : ''}`}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ))}
          </nav>
          {actions && <div className="actions">{actions}</div>}
        </div>
      </div>
    </header>
  );
};

export default Header;
