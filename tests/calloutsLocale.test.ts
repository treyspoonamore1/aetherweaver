/**
 * Phase 7 (docs/phase-7.md, W3a's localization readiness): the callouts never read their own
 * words. A Grand Silence note's number and pips come from the note it carries (`noteCallout`), and
 * the Crescendo's sparkle from what its banner carries (a Perfect banner with no glyph of its own
 * and no detail line), so a translated or pseudo-localized line is drawn exactly as English is.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { noteCallout } from '../src/ui/hud/finaleLook';
import { PATHS } from '../src/ui/kit/iconPaths';
import type { Callout } from '../src/ui/store';
import { pseudo, setLocale, type Locale } from '../src/ui/text';

interface CalloutsModule {
  Callouts: FunctionComponent<{ callouts: Callout[]; barkSpeakers: string[] }>;
}
/** A .tsx module, at run time (the node test build has no JSX to import statically). */
const callouts = async () => {
  const path = '../src/ui/hud/Callouts';
  return ((await import(/* @vite-ignore */ path)) as CalloutsModule).Callouts;
};

afterEach(() => setLocale('en'));

/** The callouts as the runtime pushes them, their lines in `locale` (en-XA: pseudo-localized). */
function made(locale: Locale): Callout[] {
  const say = (text: string) => (locale === 'en' ? text : pseudo(text));
  const at = { expiresAt: 0 };
  const note = noteCallout(3, 8, 'perfect').callout;
  const last = noteCallout(8, 8, 'clutch').callout;
  return [
    // src/app/runtime.ts, crescendoStart and perfectWard.
    { id: 1, kind: 'perfect', text: say('Crescendo — Sunrise'), color: '#fde68a', ...at },
    {
      id: 2,
      kind: 'perfect',
      text: say('Perfect Ward'),
      detail: say('Kael · 520 negated'),
      color: '#f5d78e',
      ...at,
    },
    { id: 3, ...note, text: say(note.text), ...at },
    { id: 4, ...last, text: say(last.text), ...at },
  ];
}

/** Each banner's markup, rendered alone (the stack shows two big banners and one note). */
async function shown(locale: Locale): Promise<string[]> {
  setLocale(locale);
  const Callouts = await callouts();
  return made(locale).map((c) =>
    renderToStaticMarkup(createElement(Callouts, { callouts: [c], barkSpeakers: [] })),
  );
}

/** An icon's path in the markup (each banner draws its glyph either side of its line). */
const glyphs = (html: string, name: keyof typeof PATHS) =>
  html.split(`d="${PATHS[name]}"`).length - 1;
const pips = (html: string) => [...html.matchAll(/class="h-2 w-2 rounded-full border"[^>]*>/g)];
const lit = (html: string) => pips(html).filter((m) => !m[0].includes('transparent')).length;

describe('callouts decide on what they carry, never their words', () => {
  it('in English: the Crescendo’s sparkle, Perfect Ward’s ward, a note’s number and pips', async () => {
    const [crescendo, ward, note, last] = await shown('en');
    expect(crescendo).toContain('Crescendo — Sunrise');
    expect(glyphs(crescendo, 'sparkle')).toBe(2);
    expect(glyphs(ward, 'sparkle')).toBe(0);
    expect(glyphs(ward, 'ward')).toBe(2);
    expect(note).toContain('data-note="3"');
    expect(pips(note)).toHaveLength(8);
    expect(lit(note)).toBe(3);
    expect(note).toContain('Note 3/8 · Perfect Ward');
    expect(last).toContain('data-note="8"');
    expect(lit(last)).toBe(8);
    // The note carries its number (the banner reads it, not the line).
    expect(noteCallout(3, 8, 'perfect').callout.note).toStrictEqual({ n: 3, of: 8 });
  });

  it('in en-XA: the same markup, only the words changed', async () => {
    const en = await shown('en');
    const xa = await shown('en-XA');
    const words = made('en');
    const pseudoWords = made('en-XA');
    const escape = (s: string) => renderToStaticMarkup(createElement('i', null, s)).slice(3, -4);
    en.forEach((html, i) => {
      let swapped = html.replace(escape(words[i]!.text), escape(pseudoWords[i]!.text));
      if (words[i]!.detail)
        swapped = swapped.replace(escape(words[i]!.detail!), escape(pseudoWords[i]!.detail!));
      expect(xa[i], words[i]!.text).toBe(swapped);
      expect(xa[i]).not.toContain(words[i]!.text);
    });
    expect(lit(xa[2]!)).toBe(3);
    expect(glyphs(xa[0]!, 'sparkle')).toBe(2);
    expect(glyphs(xa[1]!, 'ward')).toBe(2);
  });
});
