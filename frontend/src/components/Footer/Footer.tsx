import React from 'react';
import { Github } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-slate-200/70 bg-white/90 dark:border-slate-800/70 dark:bg-slate-950/92">
      <div className="mx-auto w-full max-w-[92rem] px-4 py-3">
        <p className="flex items-center justify-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          © {currentYear} Volunteer Tracker ·{' '}
          <a
            className="inline-flex items-center gap-1 text-slate-500 transition hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300"
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
