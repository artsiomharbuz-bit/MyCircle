import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, darkColors, lightColors } from './theme';

export type AppearanceMode = 'dark' | 'light' | 'system';

const APPEARANCE_KEY = 'mycircle.appearanceMode';

type ThemeContextValue = {
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
  scheme: 'dark' | 'light';
  colors: Colors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<AppearanceMode>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(APPEARANCE_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        setModeState(stored);
      }
      setLoaded(true);
    });
  }, []);

  const setMode = (next: AppearanceMode) => {
    setModeState(next);
    AsyncStorage.setItem(APPEARANCE_KEY, next);
  };

  const scheme: 'dark' | 'light' =
    mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
  const colors = scheme === 'light' ? lightColors : darkColors;

  // Wait for the stored preference to load before rendering anything, so we
  // don't flash the default theme for a frame on launch.
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ mode, setMode, scheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return ctx;
}
