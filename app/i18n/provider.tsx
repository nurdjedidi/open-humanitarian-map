import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  detectBrowserLocale,
  readStoredLocale,
  writeStoredLocale,
  type Locale,
} from "./detect-locale";
import { getMessage } from "./messages";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isReady: boolean;
  t: (key: string, vars?: Record<string, string | number | null | undefined>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(
  template: string,
  vars?: Record<string, string | number | null | undefined>,
) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const nextLocale = readStoredLocale() ?? detectBrowserLocale();
    setLocaleState(nextLocale);
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    writeStoredLocale(nextLocale);
  }, []);

  const t = useCallback<I18nContextValue["t"]>(
    (key, vars) => {
      const message =
        getMessage(locale, key) ??
        getMessage(DEFAULT_LOCALE, key) ??
        key;
      return interpolate(message, vars);
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      isReady,
      t,
    }),
    [isReady, locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18nContext() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18nContext must be used within an I18nProvider");
  }
  return context;
}
