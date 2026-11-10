/**
 * Connects the text layer's locale to the player's settings and the page's address (docs/phase-7.md,
 * *W3a*): `?locale=en-XA` (or `?locale=en`) wins for the page's life; otherwise `settings.locale`,
 * absent meaning English. A later change to the setting sets the locale again. The labs switch it
 * with `setLocale` directly.
 */
import { useSettings, type Settings } from '../../app/settings';
import { setLocale } from './locale';
import { LOCALES, type Locale } from './locales';

/** The locale `?locale=` names, or null when it names none the text layer knows. */
export function localeFromSearch(search: string): Locale | null {
  const v = new URLSearchParams(search).get('locale');
  return LOCALES.find((l) => l === v) ?? null;
}

/** The locale the settings choose: absent means English. */
export function localeFromSettings(settings: Settings): Locale {
  return settings.locale ?? 'en';
}

/**
 * Sets the locale now and keeps it following the settings (unless the address fixed it).
 * Returns the unsubscribe.
 */
export function installLocale(search = globalThis.location?.search ?? ''): () => void {
  const fixed = localeFromSearch(search);
  setLocale(fixed ?? localeFromSettings(useSettings.getState().settings));
  if (fixed) return () => {};
  return useSettings.subscribe((s) => setLocale(localeFromSettings(s.settings)));
}
