/**
 * The locale in force (docs/phase-7.md, *Contracts*): `'en'` until something sets another.
 * W0 declares it inert: nothing calls `setLocale` yet. W3a connects it to `settings.locale`
 * (absent: `'en'`), the UI lab and `?locale=en-XA`.
 */
import { create } from 'zustand';
import type { Locale } from './locales';

const useLocaleStore = create<{ locale: Locale }>()(() => ({ locale: 'en' }));

/** The locale strings are written in right now (outside React). */
export function currentLocale(): Locale {
  return useLocaleStore.getState().locale;
}

/** Sets the locale for every later `t`, `tc` and formatter call, and re-renders `useLocale` users. */
export function setLocale(locale: Locale): void {
  if (useLocaleStore.getState().locale !== locale) useLocaleStore.setState({ locale });
}

/** The locale, for a component that must re-render when it changes. */
export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}
