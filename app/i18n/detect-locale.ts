export type Locale = "fr" | "en";

export const DEFAULT_LOCALE: Locale = "fr";
export const SUPPORTED_LOCALES: Locale[] = ["fr", "en"];
export const LOCALE_STORAGE_KEY = "ohm-locale";

export function normalizeLocale(input: string | null | undefined): Locale | null {
  if (!input) return null;
  const lowered = input.toLowerCase();
  if (lowered.startsWith("fr")) return "fr";
  if (lowered.startsWith("en")) return "en";
  return null;
}

export function detectBrowserLocale(): Locale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }
  return normalizeLocale(window.navigator.language) ?? DEFAULT_LOCALE;
}

export function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore storage failures
  }
}
