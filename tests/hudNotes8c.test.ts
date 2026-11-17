/**
 * Phase 8c (docs/phase-8.md, "the fight out from under the interface"): the HUD's notes column
 * (the key reminders, the boss's decree and the coach's hints, at the top right, off the arena's
 * middle) and the slimmer boss bar.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { mockCallouts, mockHud } from '../src/ui/lab/mock';

type Props = Record<string, unknown>;
/** The components are .tsx: loaded as the other UI tests load them. */
async function tsx<T>(path: string): Promise<T> {
  return (await import(/* @vite-ignore */ path)) as T;
}
const { HudView } = await tsx<{ HudView: FunctionComponent<Props> }>('../src/ui/hud/Hud');
const { KeyHints } = await tsx<{ KeyHints: FunctionComponent<Props> }>('../src/ui/hud/KeyHints');

type Global = { window?: unknown };

/** A browser window as wide as `width`, for the HUD's one media query. */
function screen(width: number): void {
  (globalThis as Global).window = {
    matchMedia: (query: string) => ({
      matches: width >= Number(/min-width: (\d+)px/.exec(query)?.[1] ?? Infinity),
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  };
}

afterEach(() => {
  delete (globalThis as Global).window;
});

function hud(keyHints: boolean, forceCoach = false, announced = false): string {
  const snapshot = mockHud('boss');
  return renderToStaticMarkup(
    createElement(HudView, {
      hud: snapshot,
      // `announced`: the moment the Requiem decree is called out (its banner is up).
      callouts: announced ? mockCallouts('boss') : [],
      decree: snapshot.boss!.decree ?? null,
      keyHints,
      coach: forceCoach,
      forceCoach,
    }),
  );
}

/** The markup of the element with this test id, to its end (enough to see what it holds). */
function from(html: string, testid: string): string {
  const at = html.indexOf(`data-testid="${testid}"`);
  return at < 0 ? '' : html.slice(at);
}

describe('the notes column', () => {
  it('on a wide screen the decree leaves the boss bar for the top right', () => {
    screen(1280);
    const html = hud(false);
    const notes = from(html, 'hud-notes');
    expect(notes).toContain('data-testid="decree-line"');
    expect(notes).toContain('Every hero will lose 90% of their life');
    // Once, and not under the bar: the bar's own markup ends before the notes begin.
    expect(html.split('data-testid="decree-line"')).toHaveLength(2);
    expect(html.indexOf('data-testid="decree-line"')).toBeGreaterThan(
      html.indexOf('data-testid="hud-notes"'),
    );
    // Whole, not cut to two lines: the column is narrow.
    expect(notes.slice(0, notes.indexOf('Every hero'))).not.toContain('line-clamp-2');
  });

  it('on a narrow screen the decree stays under the boss bar, as it always did', () => {
    for (const narrow of [() => screen(1024), () => {}]) {
      narrow();
      const html = hud(false);
      expect(html).not.toContain('data-testid="hud-notes"');
      const bar = from(html, 'boss-bar');
      expect(bar).toContain('data-testid="decree-line"');
      expect(bar).toContain('line-clamp-2');
    }
  });

  it('a decree is announced there too, not across the arena’s middle', () => {
    screen(1280);
    const wide = hud(false, false, true);
    const notes = from(wide, 'hud-notes');
    // The banner's own words (the quiet line waits while it is up, as before).
    expect(notes).toContain('text-violet-300');
    expect(notes).toContain('Requiem');
    expect(wide.slice(0, wide.indexOf('data-testid="hud-notes"'))).not.toContain('text-violet-300');
    expect(notes).not.toContain('data-testid="decree-line"');
    // Narrow: the banner is where it was, under the boss bar in the middle.
    screen(1024);
    const narrow = hud(false, false, true);
    expect(narrow).not.toContain('data-testid="hud-notes"');
    expect(narrow).toContain('text-violet-300');
    expect(narrow).toContain('top-[11.25rem]');
  });

  it('holds the key reminders first, then the decree', () => {
    screen(1920);
    const notes = from(hud(true), 'hud-notes');
    const keys = notes.indexOf('aria-label="Controls"');
    expect(keys).toBeGreaterThan(0);
    expect(notes.indexOf('data-testid="decree-line"')).toBeGreaterThan(keys);
  });
});

describe('the key reminders in the column', () => {
  it('are placed by the notes column and hidden where the HUD has no room for them', () => {
    const html = renderToStaticMarkup(createElement(KeyHints, {}));
    expect(html).toContain('hidden');
    expect(html).toContain('min-[1180px]:block');
    expect(html).not.toContain('absolute');
  });
});

describe('the boss bar', () => {
  it('carries its numbers on the health bar, not on a row of their own', () => {
    const html = hud(false);
    const bar = from(html, 'boss-bar');
    const meter = bar.slice(bar.indexOf('role="meter"'));
    const cast = meter.indexOf('Requiem');
    expect(meter.indexOf('21,000 / 75,000')).toBeGreaterThan(0);
    expect(meter.indexOf('21,000 / 75,000')).toBeLessThan(cast);
    // And it sits close to the top edge.
    expect(html).toContain('left-1/2 top-2 w-[36rem]');
  });
});
