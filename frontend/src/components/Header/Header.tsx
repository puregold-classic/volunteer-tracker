// frontend/src/components/Header/Header.tsx — chunk 6 phase A
//
// Warm Editorial header. Uses semantic tokens (foreground / muted-foreground /
// primary / border) so it picks up the theme automatically. Nav items are
// react-router NavLinks, so active state is derived from the URL — no more
// onClick prop drilling.

import React from 'react';
import { NavLink } from 'react-router-dom';
import { Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HeaderNavItem {
  label: string;
  to: string;
  /** Optional matcher: if set, this nav is "active" when the route matches this. Defaults to exact match on `to`. */
  end?: boolean;
}

interface HeaderProps {
  navItems?: HeaderNavItem[];
  actions?: React.ReactNode;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative flex items-center px-4 text-sm font-medium transition-colors duration-150 outline-none',
    'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    isActive
      ? 'text-primary'
      : 'text-muted-foreground hover:text-foreground',
  );

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative flex shrink-0 items-center px-3.5 text-sm font-medium transition-colors duration-150 outline-none',
    'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    isActive
      ? 'text-primary'
      : 'text-muted-foreground hover:text-foreground',
  );

const ActiveBar: React.FC<{ inset: 'desktop' | 'mobile' }> = ({ inset }) => (
  <span
    className={cn(
      'absolute bottom-0 h-0.5 rounded-full bg-primary',
      inset === 'desktop' ? 'inset-x-3' : 'inset-x-2',
    )}
  />
);

const Header: React.FC<HeaderProps> = ({ navItems = [], actions }) => {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/[0.92] backdrop-blur-xl">
      <div className="mx-auto max-w-[92rem] px-4 sm:px-6">
        <div className="flex items-stretch" style={{ height: '3.5rem' }}>
          {/* Brand */}
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
            <Handshake className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
            <div className="min-w-0">
              <p className="font-serif text-[0.95rem] font-semibold leading-tight text-foreground">
                纯金经典翻译计划
              </p>
              <p className="text-[0.68rem] leading-tight text-muted-foreground -mt-px">
                志愿者管理
              </p>
            </div>
          </NavLink>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Desktop nav + actions */}
          <div className="hidden md:flex items-stretch">
            {navItems.length > 0 && (
              <nav className="flex items-stretch">
                {navItems.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end ?? true} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        {item.label}
                        {isActive && <ActiveBar inset="desktop" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            )}

            {actions && (
              <div className="flex items-center gap-2 pl-3 ml-2 border-l border-border">
                {actions}
              </div>
            )}
          </div>

          {/* Mobile actions only */}
          {actions && (
            <div className="flex md:hidden items-center gap-2">{actions}</div>
          )}
        </div>

        {/* Mobile nav row */}
        {navItems.length > 0 && (
          <div
            className="flex items-stretch gap-0.5 overflow-x-auto scrollbar-none md:hidden"
            style={{ height: '2.25rem' }}
          >
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end ?? true} className={mobileNavLinkClass}>
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && <ActiveBar inset="mobile" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
