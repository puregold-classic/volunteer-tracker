import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/82 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/78">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-3 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500 text-sm text-white shadow-md shadow-sky-200/60 dark:shadow-sky-950/40">
            🤝
          </div>
          <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50 md:text-lg">{title}</h1>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <nav className="flex flex-1 items-center gap-2 overflow-x-auto pb-1 sm:flex-initial sm:overflow-visible sm:pb-0">
            {navItems.map((item) => (
              <Button
                key={item.label}
                type="button"
                variant={item.active ? 'default' : 'ghost'}
                size="sm"
                className={cn('rounded-full px-3.5', !item.active && 'text-slate-600 dark:text-slate-300')}
                onClick={item.onClick}
              >
                {item.active && <Sparkles className="h-3.5 w-3.5" />}
                {item.label}
              </Button>
            ))}
          </nav>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
};

export default Header;
