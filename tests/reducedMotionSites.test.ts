/**
 * Phase 7 (docs/phase-7.md, W2's Reduced motion): the five UI places that used to read the
 * operating system's motion setting themselves now follow Settings → Reduced motion through
 * `prefersReducedMotion()` (src/ui/kit/motion): On calms them whatever the OS says, Off never
 * does, and System (the default) follows the OS exactly as before.
 *
 * - the rank-up card shows every unlock at once (Rank.tsx);
 * - the Reliquary's detail and craft panels scroll to what changed without smoothing
 *   (ReliquaryScreen.tsx, two places);
 * - "Without you" reveals at once (WithoutYou.tsx);
 * - a refused Astrolabe star does not shake (AstrolabeMap.tsx).
 *
 * The node build renders without a DOM, so the effects that make the last four decisions are run
 * here inline over a stand-in element: only effects that ask about reduced motion, and every ref
 * made empty gets the stand-in. Everything else renders as it always does.
 */
import { createElement, type FunctionComponent } from 'react';
import type * as ReactModule from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, useSettings, type ReducedMotion } from '../src/app/settings';
import { mockCraft, mockRankUps, partwayReliquary, resultRun } from '../src/ui/lab/mock';

const gate = vi.hoisted(() => ({
  on: false,
  el: null as unknown,
}));

vi.mock('react', async (importOriginal) => {
  const React = await importOriginal<typeof ReactModule>();
  return {
    ...React,
    useEffect(f: () => unknown, deps?: readonly unknown[]) {
      React.useEffect(f as () => void, deps);
      if (gate.on && /prefersReducedMotion|prefers-reduced-motion/.test(String(f))) f();
    },
    useRef(init: unknown) {
      const ref = React.useRef(init);
      if (gate.on && init === null) ref.current = gate.el;
      return ref;
    },
  };
});

/** A .tsx module, at run time (the node test build has no JSX to import statically). */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

/** What the stand-in element saw: scrolls (with the query that found their target), shakes. */
const seen = { scrolls: [] as { via: string; behavior: unknown }[], shakes: 0, query: '' };
const target = { getBoundingClientRect: () => ({ top: 300, bottom: 400 }) };
const element = {
  getBoundingClientRect: () => ({ top: 0, bottom: 100 }),
  querySelector(q: string) {
    seen.query = q;
    return target;
  },
  querySelectorAll(q: string) {
    seen.query = q;
    return [target];
  },
  scrollBy(o: ScrollToOptions) {
    seen.scrolls.push({ via: seen.query, behavior: o.behavior });
  },
  animate() {
    seen.shakes++;
  },
};

/** The OS's answer to the media query (a stand-in window). */
function os(reduce: boolean): void {
  vi.stubGlobal('window', {
    matchMedia: (q: string) => ({ matches: reduce && q === '(prefers-reduced-motion: reduce)' }),
  });
}
function motion(m: ReducedMotion | undefined): void {
  useSettings.setState({
    settings: m === undefined ? DEFAULT_SETTINGS : { ...DEFAULT_SETTINGS, reducedMotion: m },
  });
}

/** Every case: the setting (absent: System), the OS, and whether the UI should be calm. */
const CASES: [ReducedMotion | undefined, boolean, boolean][] = [
  [undefined, false, false],
  [undefined, true, true],
  ['system', true, true],
  ['on', false, true],
  ['on', true, true],
  ['off', false, false],
  ['off', true, false],
];
const name = ([m, o]: (typeof CASES)[number]) => `${m ?? 'absent'} with the OS ${o ? 'on' : 'off'}`;

beforeEach(() => {
  seen.scrolls = [];
  seen.shakes = 0;
  seen.query = '';
  gate.el = element;
});
afterEach(() => {
  gate.on = false;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useSettings.setState({ settings: DEFAULT_SETTINGS });
});

describe('Reduced motion reaches the places that read the OS setting themselves', () => {
  it('the rank-up card: every unlock at once when calm, one at a time otherwise', async () => {
    const RankUpCard = await component<Record<string, unknown>>(
      '../src/ui/screens/Rank',
      'RankUpCard',
    );
    const rankUps = mockRankUps([5]);
    expect(rankUps[0]!.unlocks.length).toBeGreaterThan(0);
    for (const c of CASES) {
      os(c[1]);
      motion(c[0]);
      const html = renderToStaticMarkup(
        createElement(RankUpCard, { rankUps, onDismiss: () => {} }),
      );
      const visible = html.split('translate-y-0 opacity-100').length - 1;
      const waiting = html.split('translate-y-1 opacity-0').length - 1;
      expect(visible + waiting).toBeGreaterThan(0);
      expect([visible > 0, waiting > 0], name(c)).toStrictEqual([c[2], !c[2]]);
    }
  });

  it('"Without you": revealed at once when calm, after its beat otherwise', async () => {
    const path = '../src/ui/screens/WithoutYou';
    const { REVEAL_MS } = (await import(/* @vite-ignore */ path)) as { REVEAL_MS: number };
    const WithoutYouPanel = await component<Record<string, unknown>>(
      '../src/ui/screens/WithoutYou',
      'WithoutYouPanel',
    );
    const result = resultRun(true, 0, 'defeat').lastResult!;
    expect(result.withoutYou).toBeTruthy();
    for (const c of CASES) {
      os(c[1]);
      motion(c[0]);
      const delays: unknown[] = [];
      vi.spyOn(globalThis, 'setTimeout').mockImplementation(((_: () => void, ms?: number) => {
        delays.push(ms);
        return 0;
      }) as typeof setTimeout);
      gate.on = true;
      renderToStaticMarkup(createElement(WithoutYouPanel, { result, heroIds: [] }));
      gate.on = false;
      vi.restoreAllMocks();
      expect(delays, name(c)).toStrictEqual([c[2] ? 0 : REVEAL_MS]);
    }
  });

  it('the Astrolabe: a refused star shakes unless calm', async () => {
    const AstrolabeMap = await component<Record<string, unknown>>(
      '../src/ui/screens/AstrolabeMap',
      'AstrolabeMap',
    );
    const { STARS } = await import('../src/ui/screens/astrolabeModel');
    const star = STARS[0]!.id;
    for (const c of CASES) {
      os(c[1]);
      motion(c[0]);
      seen.shakes = 0;
      gate.on = true;
      renderToStaticMarkup(createElement(AstrolabeMap, { tree: [], buzz: { id: star, n: 1 } }));
      gate.on = false;
      expect(seen.shakes, name(c)).toBe(c[2] ? 0 : 1);
    }
  });

  it('the Reliquary: the detail and the craft panel scroll without smoothing when calm', async () => {
    const ReliquaryView = await component<Record<string, unknown>>(
      '../src/ui/screens/ReliquaryScreen',
      'ReliquaryView',
    );
    const made = mockCraft(
      partwayReliquary(),
      'r2',
      'inscribe',
      'aegis',
      (o) => o.kind === 'inscribed',
    );
    for (const c of CASES) {
      os(c[1]);
      motion(c[0]);
      seen.scrolls = [];
      gate.on = true;
      renderToStaticMarkup(
        createElement(ReliquaryView, {
          reliquary: made.reliquary,
          rank: 20,
          slots: 3,
          onCraft: () => ({ ok: false, reason: 'lab' }),
          onRelease: () => 0,
          onCarry: () => {},
          onBack: () => {},
          initialSelected: 'r2',
          initialAction: 'inscribe',
          initialArg: 'aegis',
          initialLast: made.record,
        }),
      );
      gate.on = false;
      const behavior = c[2] ? 'auto' : 'smooth';
      expect(seen.scrolls, name(c)).toStrictEqual([
        { via: '[data-fx]', behavior },
        { via: '[data-testid="craft-outcome"]', behavior },
      ]);
    }
  });

  it('no UI script reads the media query itself any more (the stylesheet’s rules aside)', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['Rank', 'ReliquaryScreen', 'WithoutYou', 'AstrolabeMap']) {
      const src = readFileSync(`src/ui/screens/${f}.tsx`, 'utf8');
      expect(src, f).not.toContain('matchMedia');
      expect(src, f).toContain("import { prefersReducedMotion } from '../kit/motion';");
    }
  });
});
