"use client";

import { ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react';

type ThemeMode = 'light' | 'dark';

type ThemeTransitionContextValue = {
  theme: ThemeMode;
  isTransitioning: boolean;
  toggleTheme: () => void;
};

const ThemeTransitionContext = createContext<ThemeTransitionContextValue | null>(null);

const TRANSITION_MS = 620;

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem('theme', theme);
}

export function ThemeTransitionProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [overlayTheme, setOverlayTheme] = useState<ThemeMode | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const reducedMotionRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    applyTheme(theme);

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      reducedMotionRef.current = media.matches;
    };

    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const toggleTheme = () => {
    if (isTransitioning) return;

    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';

    if (reducedMotionRef.current) {
      setTheme(next);
      return;
    }

    setOverlayTheme(theme);
    setOverlayVisible(false);
    setIsTransitioning(true);

    // Apply the new theme immediately so the updated UI is visible underneath
    // the old-theme overlay as it wipes away from left to right.
    setTheme(next);
    applyTheme(next);

    requestAnimationFrame(() => {
      setOverlayVisible(true);
    });

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setOverlayVisible(false);
      setOverlayTheme(null);
      setIsTransitioning(false);
    }, TRANSITION_MS);
  };

  const value = {
    theme,
    isTransitioning,
    toggleTheme,
  };

  return (
    <ThemeTransitionContext.Provider value={value}>
      {children}

      {overlayTheme ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
        >
          <div
            className="absolute inset-0 origin-right will-change-transform"
            style={{
              backgroundColor: overlayTheme === 'dark' ? 'rgb(2, 6, 23)' : 'rgb(248, 250, 252)',
              transform: overlayVisible ? 'scaleX(0)' : 'scaleX(1)',
              transition: `transform ${TRANSITION_MS}ms ease-in-out`,
            }}
          />
        </div>
      ) : null}
    </ThemeTransitionContext.Provider>
  );
}

export function useThemeTransition() {
  const value = useContext(ThemeTransitionContext);
  if (!value) {
    throw new Error('useThemeTransition must be used within ThemeTransitionProvider');
  }
  return value;
}
