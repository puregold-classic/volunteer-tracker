import React from 'react';

const FOOTER_LINKS = [
  { label: '首页', href: '#/' },
  { label: '个人中心', href: '#/me' },
  { label: '审核中心', href: '#/review' },
  { label: '登录', href: '#/login' },
];

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-slate-200/70 bg-white/90 dark:border-slate-800/70 dark:bg-slate-950/92">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-3 px-4 py-5 md:flex-row md:items-center md:justify-between">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {FOOTER_LINKS.map((link) => (
            <a key={link.label} className="text-slate-600 transition hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-300" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <p className="text-sm text-slate-500 dark:text-slate-400">© {currentYear} Volunteer Tracker Demo</p>
      </div>
    </footer>
  );
};

export default Footer;
