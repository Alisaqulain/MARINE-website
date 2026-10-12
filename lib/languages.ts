/** Supported storefront languages only. */
export const SITE_LOCALES = [
  { code: "en", name: "English", native: "English" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "fr", name: "French", native: "Français" },
  { code: "ar", name: "Arabic", native: "العربية" },
] as const;

export type SiteLanguage = {
  code: string;
  name: string;
  native: string;
};

export const languages: SiteLanguage[] = [...SITE_LOCALES];

export const LANGUAGE_STORAGE_KEY = "marina-muse-lang";
