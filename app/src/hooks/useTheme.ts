import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'concreta.theme';
const ACCENT_KEY = 'concreta.accent';

/** Tema por defecto (DESIGN.md: oscuro por defecto). */
const DEFAULT_THEME: Theme = 'dark';

function readInitialTheme(): Theme {
  if (typeof document !== 'undefined') {
    // El script anti-FOUC de index.html ya fijó data-theme; respétalo.
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
  }
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* localStorage no disponible */
  }
  return DEFAULT_THEME;
}

function readInitialAccent(): string | null {
  try {
    return localStorage.getItem(ACCENT_KEY);
  } catch {
    return null;
  }
}

export interface ThemeApi {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  /** Acento configurable (override de `--accent`); `null` = token por tema. */
  accent: string | null;
  setAccent: (hex: string | null) => void;
}

/**
 * Gestiona tema (claro/oscuro) y acento, aplicándolos a `<html>` vía
 * `data-theme` y la variable CSS `--accent`, y persistiéndolos en
 * localStorage. Única fuente de verdad del tema (las tasas IVA/GG/BI son
 * estado del store, no de aquí).
 */
export function useTheme(): ThemeApi {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);
  const [accent, setAccentState] = useState<string | null>(readInitialAccent);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (accent) {
      root.style.setProperty('--accent', accent);
      try {
        localStorage.setItem(ACCENT_KEY, accent);
      } catch {
        /* noop */
      }
    } else {
      root.style.removeProperty('--accent');
      try {
        localStorage.removeItem(ACCENT_KEY);
      } catch {
        /* noop */
      }
    }
  }, [accent]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  );
  const setAccent = useCallback((hex: string | null) => setAccentState(hex), []);

  return { theme, setTheme, toggleTheme, accent, setAccent };
}
