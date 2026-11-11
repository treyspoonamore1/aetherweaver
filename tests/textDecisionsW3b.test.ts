/**
 * Phase 7 W3b, from the review (docs/phase-7.md, *W3a and W3b*): no English word reaches a
 * message as a parameter, the UI decides on data rather than on its own words (so en-XA behaves
 * as en), and the strings ratchet's total can only fall.
 */
import { execFileSync } from 'node:child_process';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { runEventDef } from '../src/content';
import { forgeServiceStatus, choiceInfo } from '../src/ui/screens/interlude';
import { eventRun, forgeAfter, forgeRun } from '../src/ui/lab/mock';
import { movementCard } from '../src/ui/screens/routeText';
import type { Callout, StatusHud } from '../src/ui/store';
import { setLocale, type Locale } from '../src/ui/text';
import { ROOT, readBaseline, scanSource } from '../tools/strings';

type Props = Record<string, unknown>;
async function tsx<T>(path: string): Promise<T> {
  return (await import(/* @vite-ignore */ path)) as T;
}

afterEach(() => setLocale('en'));

const LOCALES: Locale[] = ['en', 'en-XA'];

describe('words reach a message by key, never as a parameter', () => {
  it('the scanner counts a word handed into t()’s parameters, and not a compared one', () => {
    const src = `
      export function f(n: number, k: string) {
        return t('screens.x.y', {
          value: n === 1 ? 'stop' : 'stops',
          other: k === 'mend' ? t('screens.x.z') : '',
          tpl: \`won \${n}\`,
        });
      }`;
    expect(scanSource('x.ts', src).map((f) => [f.kind, f.text])).toEqual([
      ['literal', 'stop'],
      ['literal', 'stops'],
      ['template', 'won ${…}'],
    ]);
  });

  it('a chosen word is pseudo-localized with its message (routeText’s stops)', () => {
    setLocale('en-XA');
    const text = movementCard(2).text;
    expect(text).not.toMatch(/\bstops?\b/);
    setLocale('en');
    expect(movementCard(2).text).toMatch(/\bstops?\b/);
  });
});

describe('the UI decides on data, not on its own words', () => {
  it('the Forge: a service short of Aether says so by a flag, in every locale', () => {
    for (const locale of LOCALES) {
      setLocale(locale);
      const poor = forgeRun({ aether: 1, curse: false });
      expect(forgeServiceStatus(poor, 'temper').short, locale).toBe(true);
      expect(forgeServiceStatus(poor, 'cleanse').short, locale).toBe(false);
      expect(forgeServiceStatus(forgeRun(), 'temper').short, locale).toBe(false);
      expect(forgeServiceStatus(forgeAfter('cleanse').run, 'temper').short, locale).toBe(false);
    }
  });

  it('an event choice short of Aether says so by a flag, in every locale', () => {
    const def = runEventDef('broken_loom');
    const mend = def.choices.find((c) => c.id === 'mend')!;
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(choiceInfo(eventRun('broken_loom', 25), def.id, mend).short, locale).toBe(true);
      expect(choiceInfo(eventRun('broken_loom', 200), def.id, mend).short, locale).toBe(false);
    }
  });

  it('a status badge rings its Chime bell from the data, in every locale', async () => {
    const { StatusBadge } = await tsx<{ StatusBadge: FunctionComponent<Props> }>(
      '../src/ui/hud/StatusBadge',
    );
    const bleed: StatusHud = { id: 'bleed', remaining: 0, duration: 0, stacks: 9 };
    const bells: number[] = [];
    for (const locale of LOCALES) {
      setLocale(locale);
      const html = renderToStaticMarkup(createElement(StatusBadge, { status: bleed }));
      bells.push(html.split('<svg').length);
    }
    expect(bells[1]).toBe(bells[0]);
    setLocale('en');
    const html = renderToStaticMarkup(createElement(StatusBadge, { status: bleed }));
    expect(html).toContain('title="Chime it away"');
  });

  it('a one-wave fight shows no wave toast, whatever the toast says', async () => {
    const { Callouts } = await tsx<{ Callouts: FunctionComponent<Props> }>(
      '../src/ui/hud/Callouts',
    );
    const wave = (text: string): Callout => ({ id: 1, kind: 'wave', text, expiresAt: 0 });
    const show = (text: string, waves: number) =>
      renderToStaticMarkup(
        createElement(Callouts, { callouts: [wave(text)], barkSpeakers: [], waves }),
      );
    expect(show('Wave 1 of 1', 1)).not.toContain('Wave 1 of 1');
    expect(show('[Ŵáṽé 1 óƒ 1]', 1)).not.toContain('Ŵáṽé');
    expect(show('Wave 2 of 3', 3)).toContain('Wave 2 of 3');
    expect(show('[Ŵáṽé 2 óƒ 3]', 3)).toContain('Ŵáṽé 2 óƒ 3');
  });
});

/** The ratchet's total when W3b lowered it: raising it means editing this line, in review. */
const CEILING = 42;

describe('the strings baseline only falls', () => {
  const total = (b: Record<string, number>) => Object.values(b).reduce((a, n) => a + n, 0);

  it('its total stays at or under the recorded ceiling', () => {
    expect(total(readBaseline())).toBeLessThanOrEqual(CEILING);
  });

  it('its total is no higher than the last committed baseline’s', () => {
    let committed: Record<string, number>;
    try {
      committed = JSON.parse(
        execFileSync('git', ['show', 'HEAD:tests/strings.baseline.json'], {
          cwd: ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }),
      ) as Record<string, number>;
    } catch {
      return; // no git here (a source archive): the ceiling above still holds
    }
    expect(total(readBaseline())).toBeLessThanOrEqual(total(committed));
  });
});
