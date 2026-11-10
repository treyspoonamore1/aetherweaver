/**
 * Text the sim hands the HUD as English (a boss decree's name and words, a hero's bark), shown in
 * the locale by its content source (docs/phase-7.md, *W3a*: "Content and sim text shown through
 * `tc()` and by id ... Where it has none, the HUD keeps the sim's English").
 *
 * The sim's events and hashed state carry the English line, not an id, and neither may change
 * (ground rules 1 and 7). So the line is looked up in `CONTENT`: a line that is a content string
 * (a hero's `barks.*` entry, an enemy's `decree` or `decreeNoDome`, a Calling's text) is that
 * content entry's text and is localized as `tc` would; any other line is the sim's own English and
 * is shown unchanged. In English both are the line itself.
 */
import { CONTENT } from '../../content';
import { CONDUCTOR_DECREES, POSTLUDE_DECREE } from '../../content/crucible';
import { currentLocale } from './locale';
import type { Locale } from './locales';
import { pseudo } from './pseudo';

let sources: Map<string, string> | null = null;

/** Every string in CONTENT, with the path of the first entry that holds it. */
function contentStrings(): Map<string, string> {
  if (sources) return sources;
  const m = new Map<string, string>();
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'string') {
      if (!m.has(v)) m.set(v, path);
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${path}[${i}]`));
    } else if (v && typeof v === 'object') {
      const id = (v as { id?: unknown }).id;
      for (const [k, x] of Object.entries(v))
        walk(x, typeof id === 'string' ? `${path}{${id}}.${k}` : `${path}.${k}`);
    }
  };
  walk(CONTENT, 'CONTENT');
  // The Finale's decrees are content constants the sim reads outside CONTENT.
  walk(CONDUCTOR_DECREES, 'CONDUCTOR_DECREES');
  walk(POSTLUDE_DECREE, 'POSTLUDE_DECREE');
  sources = m;
  return m;
}

/** Where a sim line comes from in CONTENT (`CONTENT.heroes{kael}.barks.hit[0]`), or null. */
export function simTextSource(line: string): string | null {
  return contentStrings().get(line) ?? null;
}

/** A sim line in the locale: localized when CONTENT holds it, else the sim's English. */
export function simText(line: string, locale: Locale = currentLocale()): string {
  if (locale === 'en') return line;
  return contentStrings().has(line) ? pseudo(line) : line;
}
