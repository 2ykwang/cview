import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'cview-theme';

export function readInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* localStorage may be blocked */ }
  if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) return 'dark';
  return 'light';
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => readInitialTheme());

  useEffect(() => { applyTheme(theme); }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try { window.localStorage?.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
