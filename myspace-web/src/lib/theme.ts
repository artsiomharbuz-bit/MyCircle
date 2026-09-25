import { useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'mycircle.web.theme';

export function getThemeChoice(): ThemeChoice {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

export function setThemeChoice(choice: ThemeChoice) {
  if (choice === 'system') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, choice);
  applyTheme(choice);
}

export function useThemeChoice(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(getThemeChoice);
  useEffect(() => applyTheme(choice), [choice]);
  return [
    choice,
    (c) => {
      setThemeChoice(c);
      setChoice(c);
    },
  ];
}
