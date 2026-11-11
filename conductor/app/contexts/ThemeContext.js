import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme } from '../styles/theme';

export const THEME_STORAGE_KEY = 'aerekos.theme.mode';

function readWebMode() {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

function initialMode() {
  return readWebMode() || 'dark';
}

function applyDocumentTheme(mode) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const bg = getTheme(mode).colors.background;
  document.documentElement.style.backgroundColor = bg;
  document.body.style.backgroundColor = bg;
  document.documentElement.setAttribute('data-theme', mode);
}

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children, initialMode: initialModeProp }) => {
  const [mode, setModeState] = useState(() => initialModeProp || initialMode());

  useEffect(() => {
    applyDocumentTheme(mode);
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (cancelled) return;
        if (stored === 'dark' || stored === 'light') {
          setModeState(stored);
          if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
            localStorage.setItem(THEME_STORAGE_KEY, stored);
          }
        }
      } catch {
        /* keep seeded mode */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setMode = useCallback(async (next) => {
    const m = next === 'dark' ? 'dark' : 'light';
    setModeState(m);
    applyDocumentTheme(m);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, m);
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, m);
      }
    } catch {
      /* ignore persist errors */
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const theme = useMemo(() => getTheme(mode), [mode]);

  const value = useMemo(() => ({
    ...theme,
    setMode,
    toggleMode,
  }), [theme, setMode, toggleMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback for modules rendered outside provider during tests
    return {
      ...getTheme('dark'),
      setMode: async () => {},
      toggleMode: () => {},
    };
  }
  return ctx;
}

export default ThemeContext;
