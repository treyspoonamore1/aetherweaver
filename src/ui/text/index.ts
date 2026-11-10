/**
 * The text layer (docs/phase-7.md, *Words used here* and *Contracts*): the one module every
 * player-facing string passes through on its way to the screen.
 *
 * - `t(key, params?)`: a UI message from the catalogue (`./en/`), in the locale in force.
 * - `tc(kind, id, field)`: content text by id (an aura's name, a relic's text), English from
 *   `CONTENT`, unchanged. Content and sim text are never edited for localization: they are looked
 *   up at display time, so `contentVersion` and every hash stay put (ground rule 7).
 * - The formatters (`./format`): `num`, `percent`, `seconds`, `clockText`, `plural`,
 *   `possessive`, printing exactly today's English for `'en'`.
 * - `pseudo` (`en-XA`), `currentLocale`, `setLocale`, `useLocale`.
 *
 * W0 builds it inert: the catalogue is empty, the locale is `'en'` and nothing sets another.
 */
import { CONTENT, type Content } from '../../content';
import { EN, type TextKey } from './en';
import { currentLocale } from './locale';
import type { Locale } from './locales';
import { pseudo } from './pseudo';

export { clockText, num, percent, plural, possessive, seconds } from './format';
export { currentLocale, setLocale, useLocale } from './locale';
export { LOCALES, type Locale } from './locales';
export { pseudo } from './pseudo';
export { simText, simTextSource } from './simText';
export { EN, EN_AREAS, type TextKey } from './en';
export type { Catalogue } from './catalogue';

/**
 * A message's parameters: each fills its `{name}` placeholder, printed as a template literal
 * prints it (`String(value)`), so a message prints exactly what the template it replaced did.
 */
export type TextParams = Readonly<Record<string, string | number | boolean | null | undefined>>;

/** Fills a template's `{name}` placeholders (a missing parameter leaves its placeholder). */
export function interpolate(template: string, params?: TextParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  );
}

/** A template in a locale: as written for `'en'`, pseudo-localized for `'en-XA'`. */
export function localize(template: string, locale: Locale = currentLocale()): string {
  return locale === 'en-XA' ? pseudo(template) : template;
}

/** A UI message. An unknown key prints itself, so a missing message shows on screen. */
export function t(key: TextKey, params?: TextParams, locale: Locale = currentLocale()): string {
  const template = (EN as Readonly<Record<string, string>>)[key];
  return interpolate(localize(template ?? key, locale), params);
}

/** The content lists whose entries have an id (`CONTENT.auras`, `CONTENT.relics`, ...). */
export type ContentKind = {
  [K in keyof Content]: Content[K] extends readonly (infer E)[]
    ? E extends { id: string }
      ? K
      : never
    : never;
}[keyof Content];

type EntryOf<K extends ContentKind> = Content[K] extends readonly (infer E)[] ? E : never;

/** The fields of a content entry that hold text. */
export type TextField<K extends ContentKind> = {
  [F in keyof EntryOf<K>]-?: EntryOf<K>[F] extends string | undefined ? F : never;
}[keyof EntryOf<K>] &
  string;

const byId = new Map<string, Map<string, Record<string, unknown>>>();

function entry(kind: string, id: string): Record<string, unknown> | undefined {
  let m = byId.get(kind);
  if (!m) {
    m = new Map();
    const list = (CONTENT as unknown as Record<string, readonly { id: string }[]>)[kind] ?? [];
    for (const e of list) m.set(e.id, e as unknown as Record<string, unknown>);
    byId.set(kind, m);
  }
  return m.get(id);
}

/**
 * Content text by id: `tc('auras', 'sostenuto', 'name')` → "Sostenuto". English from `CONTENT`,
 * exactly as written; pseudo-localized for `'en-XA'`. An unknown entry or an empty field: "".
 */
export function tc<K extends ContentKind>(
  kind: K,
  id: string,
  field: TextField<K>,
  locale: Locale = currentLocale(),
): string {
  const v = entry(kind, id)?.[field];
  return typeof v === 'string' ? localize(v, locale) : '';
}
