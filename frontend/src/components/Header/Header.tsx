import React from 'react';
import { Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const Header: React.FC<HeaderProps> = ({ navItems = [], actions }) => {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-100 bg-white/[0.97] backdrop-blur-lg">
      <div className="mx-auto max-w-[92rem] px-4 sm:px-6">
        <div className="flex items-stretch" style={{ height: '3.5rem' }}>

          {/* Brand — left */}
          <div className="flex shrink-0 items-center gap-2.5">
            <Handshake className="h-5 w-5 shrink-0 text-teal-500" strokeWidth={2} />
            <div className="min-w-0">
              <p className="text-[0.875rem] font-semibold leading-tight text-neutral-900">
                纯金经典翻译计划
              </p>
              <p className="text-[0.68rem] leading-tight text-neutral-400 -mt-px">
                志愿者管理网站
              </p>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right: nav + actions — desktop */}
          <div className="hidden md:flex items-stretch">
            {navItems.length > 0 && (
              <nav className="flex items-stretch">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className={cn(
                      'relative flex items-center px-4 text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-400',
                      item.active
                        ? 'text-teal-600'
                        : 'text-neutral-500 hover:text-neutral-800'
                    )}
                  >
                    {item.label}
                    {item.active && (
                      <span className="absolute bottom-0 inset-x-3 h-0.5 rounded-full bg-teal-500" />
                    )}
                  </button>
                ))}
              </nav>
            )}

            {/* Divider + actions */}
            {actions && (
              <div className="flex items-center gap-2 pl-3 ml-2 border-l border-neutral-100">
                {actions}
              </div>
            )}
          </div>

          {/* Right: actions only — mobile */}
          {actions && (
            <div className="flex md:hidden items-center gap-2">
              {actions}
            </div>
          )}
        </div>

        {/* Mobile nav row */}
        {navItems.length > 0 && (
          <div
            className="flex items-stretch gap-0.5 overflow-x-auto scrollbar-none md:hidden"
            style={{ height: '2.25rem' }}
          >
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={cn(
                  'relative flex shrink-0 items-center px-3.5 text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-400',
                  item.active
                    ? 'text-teal-600'
                    : 'text-neutral-500 hover:text-neutral-800'
                )}
              >
                {item.label}
                {item.active && (
                  <span className="absolute bottom-0 inset-x-2 h-0.5 rounded-full bg-teal-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
