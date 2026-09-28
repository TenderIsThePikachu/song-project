import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'song-project-theme';

function getSavedTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

type ThemeStoreState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;

  root.classList.add('is-theme-changing');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.classList.remove('is-theme-changing');
    });
  });
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  theme: getSavedTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    set({ theme: nextTheme });
  },
}));
