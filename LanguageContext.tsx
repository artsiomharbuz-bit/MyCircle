import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n, { LanguageCode, RTL_LANGUAGES, SUPPORTED_LANGUAGES } from './i18n';

const LANGUAGE_KEY = 'mycircle.language';

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectDeviceLanguage(): LanguageCode {
  const codes = SUPPORTED_LANGUAGES.map((l) => l.code) as string[];
  const deviceLocales = Localization.getLocales();
  for (const locale of deviceLocales) {
    if (codes.includes(locale.languageCode ?? '')) {
      return locale.languageCode as LanguageCode;
    }
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((stored) => {
      const initial =
        (stored && (SUPPORTED_LANGUAGES.some((l) => l.code === stored) ? (stored as LanguageCode) : null)) ||
        detectDeviceLanguage();
      setLanguageState(initial);
      i18n.changeLanguage(initial);
      applyDirection(initial);
      setLoaded(true);
    });
  }, []);

  const setLanguage = (next: LanguageCode) => {
    setLanguageState(next);
    i18n.changeLanguage(next);
    AsyncStorage.setItem(LANGUAGE_KEY, next);
    applyDirection(next);
  };

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
  );
}

function applyDirection(language: LanguageCode) {
  const shouldBeRTL = RTL_LANGUAGES.includes(language);
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
  }
}

export function useAppLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useAppLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
