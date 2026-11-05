/**
 * Phase 5c, the W8 review fixes (docs/phase-5c/ui.md): the rune lock shares the Weaver bar's left
 * edge with the contribution readout instead of covering it; Prep's Route copy reads the run's
 * own length; the Reliquary's shelf shows which relics sleep; `rift.wraithCasting` is set from
 * the Wraith's cast and drives its hint; Retarget's glyph shows the hero keys.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { EXPEDITION_MOVEMENTS } from '../src/meta/profile';
import { createSim } from '../src/sim';
import { evaluateHints } from '../src/ui/hud/hints';
import { answerKeyLabel, bindingLabel } from '../src/ui/hud/labels';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { mockHud, riftHud, riftReliquary } from '../src/ui/lab/mock';
import { wakesLabel } from '../src/ui/screens/reliquaryModel';
import { expeditionLength, expeditionOnward, routeHint } from '../src/ui/screens/routeText';
import type { ContributionHud, HudSnapshot } from '../src/ui/store';

const noop = () => {};

/** A .tsx module's export, at run time (the node test build has no JSX to import statically). */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

type EdgeProps = { contribution: ContributionHud; runeLocked: boolean; below?: boolean };
const edgeBadges = () => component<EdgeProps>('../src/ui/hud/WeaverBar', 'WeaverEdgeBadges');
const answerGlyph = () =>
  component<{ tag: string; showKey?: boolean; rewind?: boolean }>(
    '../src/ui/hud/AnswerGlyph',
    'AnswerGlyph',
  );

/** The element whose opening tag carries this data-testid, and its class attribute. */
function classOf(html: string, testId: string): string {
  const m = html.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`));
  expect(m, testId).toBeTruthy();
  return m![0].match(/class="([^"]*)"/)?.[1] ?? '';
}

describe('the Weaver bar: the rune lock never covers the contribution readout', () => {
  const contribution = mockHud('calm').contribution;

  it('both sit in one flowing row on the left edge; neither is placed on its own', async () => {
    const WeaverEdgeBadges = await edgeBadges();
    const html = renderToStaticMarkup(
      createElement(WeaverEdgeBadges, { contribution, runeLocked: true }),
    );
    expect(html).toMatch(/data-testid="contribution-readout"/);
    expect(html).toMatch(/data-testid="rune-lock"/);
    expect(classOf(html, 'weaver-edge-left')).toMatch(/\babsolute\b/);
    expect(classOf(html, 'weaver-edge-left')).toMatch(/\bflex\b/);
    expect(classOf(html, 'contribution-readout')).not.toMatch(/\babsolute\b/);
    expect(classOf(html, 'rune-lock')).not.toMatch(/\babsolute\b/);
    // The readout comes first, the rune beside it.
    expect(html.indexOf('contribution-readout')).toBeLessThan(html.indexOf('"rune-lock"'));
  });

  it('the whole bar in a Null rune: the rune is inside the left edge row', async () => {
    const WeaverEdgeBadges = await edgeBadges();
    const WeaverBar = await component<{ hud: HudSnapshot }>('../src/ui/hud/WeaverBar', 'WeaverBar');
    const hud = riftHud('rift-rune');
    expect(hud.weaver.runeLocked).toBe(true);
    const html = renderToStaticMarkup(createElement(WeaverBar, { hud }));
    const row = html.slice(html.indexOf('data-testid="weaver-edge-left"'));
    const end = row.indexOf('data-testid="weaver-bar"') === -1 ? row.length : undefined;
    expect(row.slice(0, end)).toMatch(/data-testid="rune-lock"/);
    expect(classOf(html, 'rune-lock')).not.toMatch(/\babsolute\b/);
    // The bar at the top of the screen: the row moves to its bottom edge.
    const top = renderToStaticMarkup(
      createElement(WeaverEdgeBadges, { contribution, runeLocked: true, below: true }),
    );
    expect(classOf(top, 'weaver-edge-left')).toMatch(/-bottom-3/);
  });

  it('no rune, no badge; nothing done yet, no readout', async () => {
    const WeaverEdgeBadges = await edgeBadges();
    const none = renderToStaticMarkup(
      createElement(WeaverEdgeBadges, { contribution, runeLocked: false }),
    );
    expect(none).not.toMatch(/rune-lock/);
    const empty = renderToStaticMarkup(
      createElement(WeaverEdgeBadges, {
        contribution: {
          auras: { healing: 0, shielded: 0, amplified: 0 },
          thread: { healing: 0, amplified: 0 },
          total: 0,
        },
        runeLocked: true,
      }),
    );
    expect(empty).not.toMatch(/contribution-readout/);
    expect(empty).toMatch(/rune-lock/);
  });
});

describe('Prep’s Route copy follows the run’s own length', () => {
  it('an Expedition names its own Movements; the Prelude names what an Expedition plays now', () => {
    expect(expeditionLength({ movements: 2 })).toBe(2);
    expect(expeditionLength({ movements: 3 })).toBe(3);
    expect(expeditionLength({ movements: 1 })).toBe(EXPEDITION_MOVEMENTS);
    expect(expeditionLength({})).toBe(EXPEDITION_MOVEMENTS);
    // A two-Movement Expedition (saved before Phase 5c) reads as it did then.
    expect(expeditionOnward(expeditionLength({ movements: 2 }))).toBe('into Movement II');
    expect(routeHint('expedition', expeditionLength({ movements: 2 }))).toMatch(
      /^Movement I, then Movement II \(/,
    );
    expect(expeditionOnward(expeditionLength({ movements: 3 }))).toBe('through Movements II–III');
  });

  it('Prep passes the run to both lines', () => {
    const src = readFileSync(join(__dirname, '../src/ui/screens/PrepScreen.tsx'), 'utf8');
    expect(src).toMatch(/expeditionOnward\(expeditionLength\(run\)\)/);
    expect(src).toMatch(/routeHint\(routeOf\(run\), expeditionLength\(run\)\)/);
    expect(src).not.toMatch(/expeditionOnward\(\)/);
    expect(src).not.toMatch(/routeHint\(routeOf\(run\)\)/);
  });
});

describe('the Reliquary’s shelf shows which relics sleep', () => {
  it('a moon on each sleeping relic’s tile, none on the others', async () => {
    const ReliquaryView = await component<Record<string, unknown>>(
      '../src/ui/screens/ReliquaryScreen',
      'ReliquaryView',
    );
    const rq = riftReliquary();
    const html = renderToStaticMarkup(
      createElement(ReliquaryView, {
        reliquary: rq,
        rank: 20,
        slots: 3,
        onCraft: () => ({ ok: false, reason: 'lab' }),
        onRelease: () => 0,
        onCarry: noop,
        onBack: noop,
      }),
    );
    const sleepers = rq.relics.filter((r) => wakesLabel(r.id) !== null);
    expect(sleepers.length).toBeGreaterThan(0);
    expect(sleepers.length).toBeLessThan(rq.relics.length);
    const tiles = html.split('data-testid="reliquary-tile"').slice(1);
    expect(tiles).toHaveLength(rq.relics.length);
    const marked = tiles.filter((t) => {
      const own = t.slice(0, t.indexOf('</button>'));
      return own.includes('data-testid="tile-wakes"');
    });
    expect(marked).toHaveLength(sleepers.length);
    expect(html).toMatch(/title="Wakes in the Abyssal Rift: carried into any other fight/);
  });
});

describe('rift.wraithCasting: set from the Wraith’s cast, and its hint follows it', () => {
  const fighting = (hud: HudSnapshot) =>
    evaluateHints({ ...hud, encounter: { ...hud.encounter, status: 'fighting' } }).map((h) => h.id);

  it('the bridge sets it while a doubt mark is in its windup, and only then', () => {
    const doubt = new Set(CONTENT.attacks.filter((a) => a.markStatus === 'doubt').map((a) => a.id));
    expect(doubt.size).toBeGreaterThan(0);
    const sim = createSim({ seed: 7, encounter: 'wraith_vigil' });
    let casting = false;
    let quiet = false;
    for (let i = 0; i < 60 * 40 && !(casting && quiet); i++) {
      sim.step([]);
      if (i % 6) continue;
      const on = sim.state.telegraphs.some((t) => doubt.has(t.attackId));
      const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
      expect(!!hud.rift?.wraithCasting, `tick ${i}`).toBe(on);
      if (on) {
        casting = true;
        expect(fighting(hud)).toContain('wraith');
      } else quiet = true;
    }
    expect(casting).toBe(true);
    expect(quiet).toBe(true);
  });

  it('a lingering doubt mark with no cast says nothing; a cast with no marked hero still hints', () => {
    const hud = riftHud('rift-possessed');
    expect(hud.rift?.wraithCasting).toBe(true);
    expect(fighting(hud).filter((id) => id === 'wraith')).toHaveLength(1);
    const after = { ...hud, rift: undefined };
    expect(fighting(after)).not.toContain('wraith');
    const unmarked: HudSnapshot = {
      ...hud,
      party: hud.party.map((h) => ({
        ...h,
        statuses: h.statuses.filter((s) => s.id !== 'doubt'),
      })),
    };
    const hints = evaluateHints({
      ...unmarked,
      encounter: { ...unmarked.encounter, status: 'fighting' },
    });
    expect(hints.find((h) => h.id === 'wraith')?.text).toMatch(/Doubt Wraith is casting/);
  });

  it('never in Movement I or II', () => {
    for (const encounter of ['first_light', 'crimson_gate']) {
      const sim = createSim({ seed: 7, encounter });
      for (let i = 0; i < 600; i++) sim.step([]);
      expect(buildHudSnapshot(sim.state, { seed: 7, hovered: null }).rift).toBeUndefined();
    }
  });
});

describe('Retarget’s glyph shows the hero keys', () => {
  it('"1–3" as bound, and the keyless answers stay keyless', async () => {
    const AnswerGlyph = await answerGlyph();
    const keys = `${bindingLabel('focus1')}–${bindingLabel('focus3')}`;
    expect(answerKeyLabel('thread')).toBe(keys);
    expect(renderToStaticMarkup(createElement(AnswerGlyph, { tag: 'thread' }))).toContain(keys);
    expect(
      renderToStaticMarkup(createElement(AnswerGlyph, { tag: 'thread', showKey: false })),
    ).not.toContain(keys);
    for (const tag of ['move', 'dome', 'mend'] as const) expect(answerKeyLabel(tag)).toBeNull();
    expect(answerKeyLabel('ward')).toBe(bindingLabel('ward'));
    expect(answerKeyLabel('empower')).toBe(bindingLabel('threadMode'));
    // Rewind keeps Reel's key.
    expect(
      renderToStaticMarkup(createElement(AnswerGlyph, { tag: 'reel', rewind: true })),
    ).toContain(bindingLabel('reel'));
  });
});
