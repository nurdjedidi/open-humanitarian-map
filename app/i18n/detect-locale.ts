export type Locale = "fr" | "en";

export const DEFAULT_LOCALE: Locale = "en";
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
  // Toujours retourner anglais par défaut comme demandé par l'utilisateur, 
  // ignorant la langue du navigateur pour le premier chargement.
  return DEFAULT_LOCALE;
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
