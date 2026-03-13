import React from 'react';
import { Sparkles } from 'lucide-react';
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

const Header: React.FC<HeaderProps> = ({ title, navItems = [], actions }) => {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="mx-auto max-w-[92rem] px-4 sm:px-6">
        {/* Desktop / Tablet: 3-column grid — logo | nav | actions */}
        <div className="grid items-center h-14 grid-cols-[auto_1fr_auto] md:grid-cols-[1fr_auto_1fr]">

          {/* Logo — left */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500 text-sm text-white shadow-sm shadow-sky-200/60">
              🤝
            </div>
            <h1 className="truncate text-[0.875rem] font-semibold tracking-tight text-slate-800 sm:max-w-none max-w-[140px]">
              {title}
            </h1>
          </div>

          {/* Nav — center, tablet+ only */}
          {navItems.length > 0 && (
            <nav className="hidden md:flex items-center justify-center gap-0.5 rounded-xl bg-slate-50 border border-slate-100 p-1">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                    item.active
                      ? 'bg-white text-slate-900 shadow-sm shadow-slate-200/80 border border-slate-100'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/70'
                  )}
                >
                  {item.active && <Sparkles className="h-3 w-3 text-sky-500 shrink-0" />}
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          {/* Actions — right */}
          {actions && (
            <div className="flex items-center justify-end gap-2">
              {actions}
            </div>
          )}
        </div>

        {/* Mobile nav row — shown below main row on small screens */}
        {navItems.length > 0 && (
          <div className="flex md:hidden items-center gap-1 pb-2 overflow-x-auto scrollbar-none">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                  item.active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                )}
              >
                {item.active && <Sparkles className="h-3 w-3 text-sky-400 shrink-0" />}
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
