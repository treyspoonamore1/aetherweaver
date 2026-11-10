/**
 * The locales the text layer knows (docs/phase-7.md, decision 7): English, which ships, and the
 * pseudo-locale `en-XA` (English with accents, brackets and 30% padding), for testing only.
 * No imports, so `src/app/settings.ts` can read it without pulling in the text layer.
 */
export const LOCALES = ['en', 'en-XA'] as const;
export type Locale = (typeof LOCALES)[number];

/** The BCP 47 tag the formatters use for a locale: both print English as `en-US` does. */
export const NUMBER_TAG: Readonly<Record<Locale, string>> = { en: 'en-US', 'en-XA': 'en-US' };
