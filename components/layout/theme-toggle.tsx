"use client";

import { Moon, SunMedium } from 'lucide-react';
import { useThemeTransition } from './theme-transition-provider';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme, isTransitioning } = useThemeTransition();
  const dark = theme === 'dark';

  if (compact) {
    return (
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(37,99,235,0.14))] hover:text-sky-800 dark:hover:text-sky-200"
        type="button"
        onClick={toggleTheme}
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        disabled={isTransitioning}
      >
        {dark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <button className="btn" type="button" onClick={toggleTheme} disabled={isTransitioning}>
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
