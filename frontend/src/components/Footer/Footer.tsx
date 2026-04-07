import React from 'react';
import { Github } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-neutral-200/70 bg-white/90 dark:border-neutral-800/70 dark:bg-neutral-950/92">
      <div className="mx-auto w-full max-w-[92rem] px-4 py-3">
        <p className="flex items-center justify-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
          © {currentYear} Volunteer Tracker ·{' '}
          <a
            className="inline-flex items-center gap-1 text-neutral-500 transition hover:text-teal-600 dark:text-neutral-400 dark:hover:text-teal-300"
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
