/**
 * Phase 6 UI (docs/phase-6.md, W5, part A): the Atlas station's chart, Echo cards and keepsakes;
 * the weekly panel's view-model and its four statuses; Prep's Echo and weekly panels; the
 * Summary's stars and weekly slot, and the first-clear card; the Codex's Atlas and Dissonance
 * pages; the Hall of Deeds' new glyphs and Atlas progress; the Atelier never selling an earned
 * look; Tyrant's decree, the Postlude's fourth pip and decree and Mimicry's sighting from
 * hand-built sim states; the Atlas sounds' cues; the station's adapter; and the lab's group.
 * Every number and name is read back from content and meta, never typed.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT, dissonanceLevel, heroDef, type EchoDef } from '../src/content';
import { ECHO_STARS } from '../src/content/echoes';
import {
  STARS_PER_ECHO,
  atlasKeepsakes,
  atlasTotals,
  recordStars,
  starRewardTexts,
  starRewards,
  starRules,
  starsLine,
} from '../src/meta/atlas';
import { maxDissonance } from '../src/meta/dissonance';
import { shopItems, noLook, type ShopItem } from '../src/meta/loom';
import { WEEKLY_STATUSES, newProfile, type ProfileAtlas } from '../src/meta/profile';
import { createSim } from '../src/sim';
import type { World } from '../src/sim/world';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import {
  MIMIC,
  answerSentence,
  bossPostlude,
  bossTyrant,
  mimicrySighting,
  postludeDecree,
  postludePhases,
  tyrantDecree,
  tyrantEdictDecree,
  POSTLUDE_DECREE_S,
} from '../src/ui/hud/phase6Look';
import { PATHS } from '../src/ui/kit/iconPaths';
import { ATLAS_SOUNDS, STATION_LOOK } from '../src/ui/kit/loomLook';
import {
  atlasAt,
  atlasRecordFor,
  phase6DeedFixtures,
  weeklyInput,
  weeklyRows,
} from '../src/ui/lab/phase6Fixture';
import {
  NO_ATLAS_ACTIONS,
  atlasActions,
  beginEcho,
  resetAtlasActions,
  setAtlasActions,
} from '../src/ui/screens/atlasActions';
import {
  STATUS_LOOK,
  atlasBadge,
  atlasCues,
  atlasInContent,
  atlasKeepsakeViews,
  atlasStationOpen,
  atlasView,
  bestLine,
  daysLeftLine,
  echoCard,
  laterPieces,
  legLine,
  prepEchoView,
  prepWeeklyView,
  starRows,
  summaryAtlasView,
  summaryWeeklyView,
  twistLines,
  verifyCue,
  weeklyPanelView,
} from '../src/ui/screens/atlasModel';
import { atlasProgress, deedBest, deedGlyph } from '../src/ui/screens/deedsModel';
import {
  EXPEDITIONS_ONLY,
  LATER_LEVELS,
  expeditionsOnly,
  idleReason,
  laterLevels,
  levelRows,
} from '../src/ui/screens/dissonanceModel';
import {
  STATIONS,
  stationIntro,
  stationViews,
  atelierUnlock,
  shelfItem,
} from '../src/ui/screens/loomModel';
import { prepEyebrow, summaryEyebrow } from '../src/ui/screens/routeText';

/** A .tsx module's export, at run time (the node test build has no JSX to import statically). */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

/** A .tsx module, at run time. */
async function tsxModule(path: string): Promise<unknown> {
  return import(/* @vite-ignore */ path);
}

const echoes = (): readonly EchoDef[] => CONTENT.echoes;
const echo = (id: string) => echoes().find((e) => e.id === id)!;
const allLit = (): ProfileAtlas => atlasAt('whole')!;

afterEach(() => resetAtlasActions());

describe('the Atlas station: the chart, the cards, the keepsakes', () => {
  it('counts every Echo and constellation from content: "N of 27 stars"', () => {
    const v = atlasView(undefined);
    expect(v.constellations.map((k) => k.id)).toEqual(CONTENT.constellations.map((k) => k.id));
    expect(v.constellations.flatMap((k) => k.echoes.map((e) => e.id)).sort()).toEqual(
      echoes()
        .map((e) => e.id)
        .sort(),
    );
    expect(v.of).toBe(echoes().length * STARS_PER_ECHO);
    expect(v.lit).toBe(0);
    expect(v.total).toBe(starsLine(undefined));
    expect(v.total).toBe(`0 of ${v.of} stars`);
    const part = atlasView(atlasAt('partway'));
    expect(part.lit).toBe(atlasTotals(atlasAt('partway')).lit);
    expect(part.total).toBe(`${part.lit} of ${part.of} stars`);
    // Every star sits in the chart; a line is lit only when both its stars are.
    for (const k of part.constellations) {
      for (const s of k.stars) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(1);
        expect(s.y).toBeGreaterThan(0);
        expect(s.y).toBeLessThan(1);
      }
      for (const l of k.lines) {
        const a = k.stars.find((s) => s.id === l.from)!;
        const b = k.stars.find((s) => s.id === l.to)!;
        expect(l.lit).toBe(a.lit > 0 && b.lit > 0);
      }
      expect(k.progress).toBe(`${k.lit} of ${k.of} stars`);
    }
  });

  it('the star rules and rewards are content’s, each lit in order', () => {
    const rows = starRows(2);
    expect(rows.map((r) => r.rule)).toEqual(starRules());
    expect(rows.map((r) => r.reward)).toEqual(starRewardTexts());
    expect(rows.map((r) => r.lit)).toEqual(ECHO_STARS.map((_, i) => i < 2));
    expect(rows[1]!.rule).toBe(`Clear it at ${ECHO_STARS[1]!.points} Dissonance`);
    expect(atlasView(undefined).about).toContain(`at ${ECHO_STARS[1]!.points} Dissonance`);
    expect(atlasView(undefined).about).toContain(`the third at ${ECHO_STARS[2]!.points}`);
  });

  it('an Echo card: name, text, legs, twists in words, stars and best', () => {
    const atlas = atlasAt('partway');
    for (const e of echoes()) {
      const c = echoCard(e, atlas);
      expect(c.name).toBe(e.name);
      expect(c.text).toBe(e.text);
      expect(c.legs).toHaveLength(e.legs.length);
      for (const l of c.legs) expect(l).not.toMatch(/undefined|\{|NaN/);
      expect(c.lit).toBe(atlas?.stars[e.id] ?? 0);
      expect(c.bestLine).toBe(bestLine(atlas?.best[e.id] ?? null));
    }
    // A Cappella: no Calling, no Astrolabe, no carried relics.
    expect(twistLines(echo('a_cappella').twists).map((t) => t.text)).toEqual([
      'No Calling',
      'No Astrolabe',
      'No carried relics',
    ]);
    // Strangers: the party by name; The Unrested: its forced levels by name, worth nothing.
    const party = echo('strangers').twists.party!;
    expect(twistLines(echo('strangers').twists)[0]!.text).toBe(
      `The party is ${party
        .map((h) => heroDef(h).name)
        .join(', ')
        .replace(/, ([^,]*)$/, ' and $1')}`,
    );
    const forced = echo('the_unrested').twists.dissonance!.map((l) => dissonanceLevel(l.id).name);
    expect(twistLines(echo('the_unrested').twists)[0]!.text).toBe(
      `${forced.join(' and ')} are always on, and add no points`,
    );
    // A leg of rests and a boss reads as them; a scaled leg names whose strength it plays at.
    const rehearsal = echo('last_rehearsal');
    expect(legLine(rehearsal.legs[1]!)).toMatch(/^A Respite and a Merchant, then Vharun/);
    expect(legLine(echo('retrograde').legs[0]!)).toMatch(/’s strength$/);
    // A leg at its own Movement's scale says nothing more.
    expect(legLine(echo('bells_in_the_rift').legs[0]!)).not.toMatch(/strength/);
    expect(bestLine(null)).toBe('Not cleared yet');
    expect(bestLine(0)).toBe('Cleared without Dissonance');
    expect(bestLine(12)).toBe('Best clear: 12 Dissonance');
  });

  it('keepsakes: every Atlas keepsake from content, earned as meta says', () => {
    const none = atlasKeepsakeViews(undefined);
    const earnedIn = [
      ...CONTENT.cosmetics.robes,
      ...CONTENT.cosmetics.threads,
      ...CONTENT.cosmetics.titles,
    ]
      .filter((k) => k.earned && ('constellation' in k.earned || 'atlas' in k.earned))
      .map((k) => k.id);
    expect(none.map((k) => k.id)).toEqual(earnedIn);
    expect(none.every((k) => !k.earned)).toBe(true);
    const one = atlasAt('constellation');
    expect(
      atlasKeepsakeViews(one)
        .filter((k) => k.earned)
        .map((k) => k.id),
    ).toEqual(atlasKeepsakes(one));
    expect(atlasKeepsakeViews(allLit()).every((k) => k.earned)).toBe(true);
    const v = atlasView(one);
    const first = v.constellations[0]!;
    expect(first.complete).toBe(true);
    expect(first.reward?.earned).toBe(true);
    expect(first.rewardLine).toMatch(new RegExp(`^All nine stars: the robe `));
  });

  it('the station: lit with Dissonance, its badge, its intro, beside Dissonance', () => {
    expect(STATIONS.indexOf('atlas')).toBe(STATIONS.indexOf('dissonance') + 1);
    expect(PATHS[STATION_LOOK.atlas.icon]).toBeTruthy();
    expect(atlasInContent()).toBe(echoes().length > 0);
    expect(atlasStationOpen(false, false)).toBe(false);
    expect(atlasStationOpen(true, false)).toBe(true);
    expect(atlasStationOpen(false, true)).toBe(true);
    expect(atlasBadge(undefined)).toBeNull();
    expect(atlasBadge(atlasAt('partway'))).toBe(starsLine(atlasAt('partway')));
    const p = newProfile(7);
    const dark = stationViews(p, false).find((s) => s.id === 'atlas')!;
    expect(dark.open).toBe(false);
    expect(dark.line).toBe(
      'Old roads played strangely, with stars to light. Opens with Dissonance.',
    );
    const lit = stationViews(
      { ...p, dissonance: { open: true, levels: [], best: {} }, atlas: atlasAt('partway') },
      false,
    ).find((s) => s.id === 'atlas')!;
    expect(lit.open).toBe(true);
    expect(lit.badge).toBe(starsLine(atlasAt('partway')));
    const intro = stationIntro('atlas');
    expect(intro.panels.length).toBeGreaterThanOrEqual(2);
    for (const panel of intro.panels) expect(panel.body).not.toMatch(/\{|undefined|NaN/);
    for (const k of CONTENT.constellations) expect(intro.panels[1]!.body).toContain(k.name);
  });
});

describe('the adapter: one call per action, a stub until the stores answer', () => {
  it('Begin calls beginEcho with the Echo’s id; the stub starts nothing', () => {
    expect(atlasActions()).toBe(NO_ATLAS_ACTIONS);
    expect(beginEcho('choir_of_blood')).toBe(false);
    const calls: string[] = [];
    setAtlasActions({
      beginEcho: (id) => {
        calls.push(id);
        return true;
      },
    });
    expect(beginEcho('retrograde')).toBe(true);
    expect(calls).toEqual(['retrograde']);
    // The rest stay stubs.
    expect(atlasActions().beginWeekly()).toBe(false);
    expect(atlasActions().addCode('AW1-x', null)).not.toBeNull();
    resetAtlasActions();
    expect(beginEcho('retrograde')).toBe(false);
  });
});

describe('the weekly panel: a plain input from the weekly model', () => {
  it('the week, days left, entry, best and every row, in the model’s order', () => {
    const input = weeklyInput('board');
    const v = weeklyPanelView(input);
    expect(v.title).toBe(`Week ${input.week}`);
    expect(v.left).toBe(daysLeftLine(input.daysLeft));
    expect(daysLeftLine(1)).toBe('Last day');
    expect(daysLeftLine(3)).toBe('3 days left');
    expect(v.entry).toBe(input.entryLine);
    expect(v.best).toBe('Your best this week: 3,210');
    expect(v.rows.map((r) => r.code)).toEqual(input.rows.map((r) => r.entry.code));
    expect(v.rows.map((r) => r.place)).toEqual(input.rows.map((_, i) => i + 1));
    expect(v.rows.find((r) => r.mine)!.who).toBe('You');
    // Every status in the board, each with its own word and glyph.
    expect(new Set(v.rows.map((r) => r.status.status))).toEqual(new Set(WEEKLY_STATUSES));
    expect(Object.keys(STATUS_LOOK).sort()).toEqual([...WEEKLY_STATUSES].sort());
    expect(new Set(WEEKLY_STATUSES.map((s) => STATUS_LOOK[s].icon)).size).toBe(4);
    expect(WEEKLY_STATUSES.map((s) => STATUS_LOOK[s].word)).toEqual([
      'Verified',
      'Another version',
      'Claimed',
      'Didn’t match',
    ]);
    // A code that can't be read keeps its place, with dashes.
    const unread = v.rows.find((r) => r.score === null)!;
    expect(unread.result).toBeNull();
    expect(unread.label).toContain('can’t be read');
    expect(v.canBegin).toBe(true);
    expect(v.canShare).toBe(true);
    expect(v.empty).toBeNull();
  });

  it('verification: its progress, and the verifier’s own message under its status', () => {
    const going = weeklyPanelView(weeklyInput('verifying'));
    const p = weeklyInput('verifying').progress!;
    expect(going.progress!.fraction).toBeCloseTo(p.ticks / p.totalTicks, 9);
    expect(going.progress!.line).toBe(`Verifying · fight ${p.fight + 1} of ${p.fights}`);
    for (const s of ['verified', 'otherVersion', 'claimed', 'mismatch'] as const) {
      const input = weeklyInput(s);
      const v = weeklyPanelView(input);
      expect(v.result!.status).toBe(s);
      expect(v.result!.message).toBe(input.result!.message);
      expect(v.result!.word).toBe(STATUS_LOOK[s].word);
    }
    const empty = weeklyPanelView(weeklyInput('empty'));
    expect(empty.rows).toEqual([]);
    expect(empty.empty).not.toBeNull();
    expect(empty.canShare).toBe(false);
    expect(empty.best).toBeNull();
    expect(weeklyPanelView({ ...weeklyInput('board'), entry: null }).canBegin).toBe(false);
  });

  it('a row: who, score, result and time', () => {
    const rows = weeklyRows();
    const lost = weeklyPanelView({ ...weeklyInput('board'), rows }).rows.find((r) =>
      r.result?.startsWith('Lost'),
    )!;
    expect(lost.result).toMatch(/^Lost after \d+ fights? won$/);
    expect(lost.time).toMatch(/^\d+ min$/);
  });
});

describe('Prep: an Echo’s twists, the weekly’s fixed choices, the levels', () => {
  it('an Echo: what it fixes, what is off, what is forced, what is yours', () => {
    const a = prepEchoView('a_cappella')!;
    expect(a.off).toEqual(['No Calling', 'No Astrolabe', 'No carried relics']);
    expect(a.fixed).toEqual(echo('a_cappella').legs.map(legLine));
    expect(a.yours).toBe('Your party, Chords and techniques are your own.');
    const s = prepEchoView('strangers')!;
    expect(s.fixed.at(-1)).toMatch(/^The party is /);
    expect(s.yours).toBe('Your Calling, Chords and techniques are your own.');
    const u = prepEchoView('the_unrested')!;
    expect(u.forced.map((l) => l.id)).toEqual(
      echo('the_unrested').twists.dissonance!.map((l) => l.id),
    );
    expect(prepEchoView('no_such_echo')).toBeNull();
    expect(prepEyebrow({ echo: 'a_cappella' })).toBe(
      `The Atlas of Echoes · ${echo('a_cappella').name}`,
    );
    expect(prepEyebrow({ weekly: { week: 44 } })).toBe('This Week’s Song · Week 44');
    expect(prepEyebrow({})).toBe('The Prelude · Movement I');
    expect(summaryEyebrow({ echo: 'retrograde' })).toBe(`${echo('retrograde').name} · summary`);
  });

  it('the weekly: each fixed choice locked, "Everyone plays this"', () => {
    const entry = {
      route: 'a_cappella',
      calling: null,
      party: [...CONTENT.defaultParty],
      dissonance: [{ id: CONTENT.dissonance[1]!.id, rank: 1 }],
    };
    const v = prepWeeklyView({ week: 44, entry });
    expect(v.everyone).toBe('Everyone plays this');
    expect(v.fixed.map((f) => f.label)).toEqual([
      'Route',
      'Calling',
      'Party',
      'Dissonance',
      'Seed',
    ]);
    expect(v.fixed[0]!.value).toBe(echo('a_cappella').name);
    expect(v.fixed[1]!.value).toBe('No Calling');
    expect(v.fixed[2]!.value).toBe(
      CONTENT.defaultParty
        .map((h) => heroDef(h).name)
        .join(', ')
        .replace(/, ([^,]*)$/, ' and $1'),
    );
    expect(v.points).toBe(CONTENT.dissonance[1]!.points);
    for (const f of v.fixed) expect(PATHS[f.icon], f.label).toBeTruthy();
    const exp = prepWeeklyView({ week: 45, entry: { ...entry, route: 'expedition' } });
    expect(exp.fixed[0]!.value).toBe('The Expedition, to the Finale');
  });

  it('the Dissonance total reads "out of" content’s most; forced and Expeditions-only rows', () => {
    const rows = levelRows([{ id: 'restless_dead', rank: 1, forced: true }]);
    const forced = rows.find((r) => r.id === 'restless_dead')!;
    expect(forced.forced).toBe(true);
    expect(forced.adds).toBe(0);
    expect(forced.label).toMatch(/set by the Echo, no points/);
    // Rows without Phase 6 state carry no new key (they read as before).
    for (const r of levelRows([])) {
      expect('forced' in r).toBe(false);
      expect('expeditionsOnly' in r).toBe(expeditionsOnly(dissonanceLevel(r.id)));
    }
    // No level is Expeditions only until True Dissonance lands (its effect, or its own flag).
    expect(levelRows([]).some((r) => r.expeditionsOnly)).toBe(
      CONTENT.dissonance.some((d) => d.effect === 'true_dissonance'),
    );
    expect(expeditionsOnly({ ...CONTENT.dissonance[0]!, effect: 'true_dissonance' })).toBe(true);
    expect(expeditionsOnly({ ...CONTENT.dissonance[0]!, expeditionsOnly: false } as never)).toBe(
      false,
    );
    expect(idleReason('true_dissonance')).toBe(`${EXPEDITIONS_ONLY}: a Prelude has no Finale.`);
    expect(maxDissonance()).toBe(CONTENT.dissonance.reduce((n, d) => n + d.points * d.ranks, 0));
  });
});

describe('the Summary: stars lit, the weekly slot, the first clear', () => {
  it('stars and their rewards from the run’s Atlas record', () => {
    const r = atlasRecordFor(0, 12, undefined);
    const v = summaryAtlasView(r)!;
    expect(r.lit).toEqual([1, 2]);
    expect(v.title).toBe(`Echo cleared at ${r.points} Dissonance`);
    expect(v.litLine).toBe('two stars lit');
    const pay = starRewards(0, 2);
    expect(v.rewards).toBe(`+${pay.shards} Tuning Shards`);
    expect(v.line).toBe(
      `Echo cleared at ${r.points} Dissonance · two stars lit · +${pay.shards} Tuning Shards`,
    );
    expect(v.bestLine).not.toBeNull();
    // The third star pays a Tear too.
    const third = summaryAtlasView(atlasRecordFor(0, 20, atlasAt('partway')))!;
    expect(third.rewards).toMatch(/Discord Tear$/);
    // A constellation completed names its keepsake.
    const first = CONTENT.constellations[0]!;
    const its = echoes().filter((e) => e.constellation === first.id);
    const before = atlasAt('constellation')!;
    const atlas = { stars: { ...before.stars, [its.at(-1)!.id]: 1 }, best: { ...before.best } };
    const done = summaryAtlasView(atlasRecordFor(echoes().indexOf(its.at(-1)!), 20, atlas))!;
    expect(done.completions[0]).toMatch(new RegExp(`^${first.name} is complete: the robe `));
    // No Echo, no card.
    expect(summaryAtlasView(recordStars({}, { outcome: 'victory', dissonance: [] }))).toBeNull();
  });

  it('the Atlas sounds’ cues', () => {
    expect(atlasCues(atlasRecordFor(0, 12, undefined))).toEqual({ stars: 2, constellation: false });
    expect(atlasCues({ lit: [], stars: 2, constellations: [], wholeAtlas: false })).toEqual({
      stars: null,
      constellation: false,
    });
    expect(
      atlasCues({ lit: [3], stars: 3, constellations: ['x'], wholeAtlas: false }).constellation,
    ).toBe(true);
    expect(verifyCue('verified')).toBe(ATLAS_SOUNDS.verified);
    expect(verifyCue('otherVersion')).toBe(ATLAS_SOUNDS.verified);
    expect(verifyCue('mismatch')).toBe(ATLAS_SOUNDS.mismatch);
    expect(verifyCue('claimed')).toBeNull();
    expect(ATLAS_SOUNDS).toEqual({
      star: 'atlasStar',
      constellation: 'atlasConstellation',
      verified: 'runVerified',
      mismatch: 'runMismatch',
    });
  });

  it('the weekly slot, and the first-clear card names only what is still to come', async () => {
    const w = summaryWeeklyView({ week: 44, score: 3210, won: true, code: 'AW1-X' });
    expect(w).toEqual({
      title: 'This Week’s Song · Week 44',
      score: '3,210 points',
      result: 'Won',
      code: 'AW1-X',
      canShare: true,
    });
    const { firstClearLines } = (await tsxModule('../src/ui/screens/SummaryScreen')) as unknown as {
      firstClearLines(open: boolean, rank?: number): { lines: string[] };
    };
    const built = laterPieces();
    const lines = firstClearLines(true).lines;
    expect(lines[0]).toBe('Dissonance is open');
    expect(lines.join(' ')).not.toMatch(/Coming later: the Atlas of Echoes/);
    if (built.atlas) expect(lines).toContain('The Atlas of Echoes is open: find it in the Loom');
    expect(lines.some((l) => l.startsWith('Coming later'))).toBe(!built.trueDissonance);
  });
});

describe('the Codex: the Atlas page, Dissonance’s still to come', () => {
  it('"still to come" lists only the levels content doesn’t hold', () => {
    expect(laterLevels().map((l) => l.effect)).toEqual(
      LATER_LEVELS.filter((l) => !CONTENT.dissonance.some((d) => d.effect === l.effect)).map(
        (l) => l.effect,
      ),
    );
  });

  it('the Atlas tab shows only with an Atlas given; its page lists every Echo', async () => {
    const CodexView = await component<Record<string, unknown>>(
      '../src/ui/screens/CodexScreen',
      'CodexView',
    );
    const without = renderToStaticMarkup(
      createElement(CodexView, { onBack: () => {}, initialTab: 'heroes' }),
    );
    expect(without).not.toContain('tab-atlas');
    const html = renderToStaticMarkup(
      createElement(CodexView, {
        onBack: () => {},
        initialTab: 'atlas',
        atlas: atlasAt('partway') ?? null,
        dissonance: { open: true, best: {} },
      }),
    );
    expect(html).toContain('tab-atlas');
    expect(html).toContain('data-testid="codex-atlas" data-open="true"');
    for (const e of echoes()) expect(html).toContain(e.name.replace(/’/g, '’'));
    const closed = renderToStaticMarkup(
      createElement(CodexView, {
        onBack: () => {},
        initialTab: 'atlas',
        atlas: null,
        allowance: { ...(await import('../src/meta/profile')).allowanceFor(1) },
        dissonance: { open: false, best: {} },
      }),
    );
    expect(closed).toContain('data-open="false"');
    const diss = renderToStaticMarkup(
      createElement(CodexView, {
        onBack: () => {},
        initialTab: 'dissonance',
        dissonance: { open: true, best: {} },
      }),
    );
    expect(diss.includes('data-testid="codex-later"')).toBe(laterLevels().length > 0);
  });
});

describe('the Hall of Deeds: the new rules’ glyphs, the profile Deeds’ progress', () => {
  it('each new rule has its own glyph, and cleanses its own', () => {
    const glyphs = new Map(phase6DeedFixtures().map((d) => [d.test, deedGlyph(d)]));
    expect(glyphs.get('movementWithout')).toBe('bell');
    expect(glyphs.get('dissonance')).toBe('dissonance');
    expect(glyphs.get('stars')).toBe('star');
    expect(glyphs.get('constellation')).toBe('atlas');
    expect(glyphs.get('weeks')).toBe('week');
    for (const g of glyphs.values()) expect(PATHS[g]).toBeTruthy();
    expect(
      deedGlyph({ ...phase6DeedFixtures()[0]!, id: 'x', test: 'runCount', stat: 'cleanses' }),
    ).toBe('purge');
  });

  it('"4 of 27 stars" from the Atlas; a constellation’s nearest; none once earned', () => {
    const [stars] = phase6DeedFixtures().filter((d) => d.test === 'stars');
    const constellation = phase6DeedFixtures().find((d) => d.test === 'constellation')!;
    const atlas = atlasAt('partway');
    const held = { earned: [], best: {}, atlas };
    expect(deedBest(stars!, held)!.line).toBe(starsLine(atlas));
    expect(deedBest(stars!, { ...held, earned: [stars!.id] })).toBeNull();
    const line = atlasProgress(constellation, atlas).line;
    expect(line).toMatch(/^\d+ of \d+ stars in /);
    const named = atlasProgress(
      { ...constellation, constellation: CONTENT.constellations[2]!.id },
      atlas,
    );
    expect(named.line).toMatch(new RegExp(`in ${CONTENT.constellations[2]!.name}$`));
    expect(deedBest(stars!, { earned: [], best: {} })!.line).toBe(
      `0 of ${echoes().length * STARS_PER_ECHO} stars`,
    );
  });
});

describe('the Atelier never sells an earned look', () => {
  it('keepsake prices leave earned looks out; an earned look is shown as earned, with its reason', () => {
    const c = CONTENT.cosmetics;
    const sold = [...c.robes, ...c.threads].filter((k) => !k.earned).map((k) => k.price);
    const lo = Math.min(...sold);
    const hi = Math.max(...sold);
    expect(atelierUnlock(CONTENT.starlight.atelierRank)!.text).toContain(
      lo === hi ? `(${lo})` : `(${lo}–${hi})`,
    );
    const state = { ...newProfile(7), starlight: 999, atlas: allLit() };
    const items = shopItems(state, 20, false);
    const earned = items.filter((i) => i.state === 'earned' && i.kind !== 'title');
    expect(earned.length).toBeGreaterThan(0);
    for (const i of earned) {
      const shelf = shelfItem(i as ShopItem, noLook(), 999);
      expect(shelf.status).toBe('Earned');
      expect(shelf.action).toBe('wear');
      expect(shelf.note).toMatch(/Atlas of Echoes/);
      expect(i.price).toBeNull();
    }
  });
});

/** A fight with its boss on the field. */
function bossFight(encounter: string) {
  const sim = createSim({ seed: 7, encounter });
  for (let i = 0; i < 900 && sim.state.encounter.bossId === null; i++) sim.step([]);
  const w = sim.state as unknown as World;
  expect(w.encounter.bossId).not.toBeNull();
  return { sim, w, boss: w.entities.get(w.encounter.bossId!)! };
}

describe('in the fight: Tyrant, the Postlude, Mimicry (hand-built states)', () => {
  it('Tyrant’s decree: the boss, the foe and its attack, then its answers', () => {
    const lance = CONTENT.attacks.find((a) => a.id === 'lancer_lance')!;
    const d = tyrantDecree('the_bellwarden', { attack: lance.id, from: 'glass_lancer', phase: 1 });
    expect(d.text).toBe(
      `The Bellwarden takes up the ${CONTENT.enemies.find((e) => e.id === 'glass_lancer')!.name}’s ${lance.name}. ${answerSentence(lance.answers)}`,
    );
    expect(answerSentence(['ward', 'reel', 'move'])).toBe(
      'Ward it, Reel the target, or step aside.',
    );
    expect(answerSentence(['ward'])).toBe('Ward it.');
    expect(answerSentence(['reel'], true)).toBe('Rewind the target.');
    // Blind Score cuts it to its first sentence, as every decree.
    const blind = tyrantDecree(
      'the_bellwarden',
      { attack: lance.id, from: 'glass_lancer', phase: 1 },
      { blind: true },
    );
    expect(blind.text).toBe(d.text.split('. ')[0] + '.');
    // The Conductor plays its own closing attacks earlier.
    const own = tyrantDecree('the_silent_conductor', {
      attack: lance.id,
      from: 'the_silent_conductor',
      phase: 1,
    });
    expect(own.text).toMatch(/^The Silent Conductor plays its /);
  });

  it('the boss bar reads `enemy.tyrant`; absent, nothing changes', () => {
    const { w, boss } = bossFight('bellwarden');
    const before = buildHudSnapshot(w, { seed: 7, hovered: null });
    expect('tyrant' in before.boss!).toBe(false);
    expect(bossTyrant(w, boss.id)).toEqual({});
    (boss.enemy as { tyrant?: unknown }).tyrant = {
      attack: 'lancer_lance',
      from: 'glass_lancer',
      phase: 1,
      readyAt: 6,
    };
    const hud = buildHudSnapshot(w, { seed: 7, hovered: null });
    expect(hud.boss!.tyrant!.text).toMatch(/takes up the Glass Lancer’s/);
    expect(hud.boss!.tyrant!.phase).toBe(1);
    const edict = tyrantEdictDecree(w, {
      type: 'tyrantEdict',
      tick: 1,
      boss: boss.id,
      phase: 2,
      attack: 'lamenter_dirge',
      from: 'lamenter',
    })!;
    expect(edict.text).toMatch(/Lamenter’s/);
    expect(edict.phase).toBe(2);
  });

  it('the Postlude: a fourth pip, the rise, its decree while fresh, its pressure', () => {
    const { w } = bossFight('the_silent_conductor');
    const before = buildHudSnapshot(w, { seed: 7, hovered: null });
    expect('postlude' in before.boss!).toBe(false);
    expect(postludePhases({ phase: 2, phases: 3 }, false)).toEqual({ phase: 2, phases: 3 });
    expect(postludePhases({ phase: 3, phases: 3, phaseAt: [0.6, 0.25] }, true)).toEqual({
      phase: 4,
      phases: 4,
      phaseAt: [],
    });
    if (!w.field.finale) (w.field as { finale?: object }).finale = {};
    const f = w.field.finale!;
    f.postlude = { since: w.time, riseUntil: w.time + 3 };
    const hud = buildHudSnapshot(w, { seed: 7, hovered: null });
    expect(hud.boss!.phases).toBe(before.boss!.phases + 1);
    expect(hud.boss!.phase).toBe(hud.boss!.phases);
    expect(hud.boss!.postlude!.rising).toBeCloseTo(3, 6);
    expect(hud.boss!.postlude!.decree).toEqual(postludeDecree(false));
    f.postlude = { since: w.time - POSTLUDE_DECREE_S - 1, riseUntil: w.time - 5, enraged: true };
    const later = bossPostlude(w).postlude!;
    expect(later).toEqual({ rising: null, enraged: true, decree: null });
    expect(postludeDecree(true).text).toBe(postludeDecree(false).text.split('. ')[0] + '.');
  });

  it('Mimicry: an ordinary enemy carrying Mimicking shows the Mimic’s card, only under Mimicry', () => {
    const sim = createSim({ seed: 3, encounter: 'first_light' });
    for (let i = 0; i < 300; i++) sim.step([]);
    const w = sim.state as unknown as World;
    const foe = w.entities.list().find((e) => e.enemy && e.health && !e.health.dead)!;
    const foes = [foe.enemy!.defId];
    expect(mimicrySighting(w, foes, true)).toEqual(foes);
    foe.enemy!.affixes.push('mimicking');
    expect(mimicrySighting(w, foes, true)).toEqual([...foes, MIMIC]);
    expect(mimicrySighting(w, foes, false)).toEqual(foes);
    // Read from the fight's levels by default: no Mimicry level in force here.
    expect(mimicrySighting(w, foes)).toEqual(foes);
    expect(buildHudSnapshot(w, { seed: 3, hovered: null }).foes).not.toContain(MIMIC);
  });

  it('the boss bar draws Tyrant’s line and the Postlude', async () => {
    const BossBar = await component<Record<string, unknown>>('../src/ui/hud/BossBar', 'BossBar');
    const boss = {
      id: 1,
      name: 'The Bellwarden',
      hp: 10,
      maxHp: 100,
      shield: 0,
      phase: 4,
      phases: 4,
      phaseAt: [],
      cast: null,
      enrageIn: null,
      decree: null,
      foreseen: null,
      tyrant: tyrantDecree('the_bellwarden', {
        attack: 'lancer_lance',
        from: 'glass_lancer',
        phase: 1,
      }),
      postlude: { rising: 1.5, enraged: false, decree: postludeDecree() },
    };
    const html = renderToStaticMarkup(createElement(BossBar, { boss, decree: null }));
    expect(html).toContain('data-testid="boss-tyrant"');
    expect(html).toContain('data-testid="boss-postlude"');
    expect(html).toContain('Phase 4 / 4');
    expect(html).toContain(postludeDecree().text);
  });
});

describe('the views render; the lab has a view for each', () => {
  it('the Atlas station, the weekly panel, Prep and the Summary', async () => {
    const AtlasScreenView = await component<Record<string, unknown>>(
      '../src/ui/screens/AtlasParts',
      'AtlasScreenView',
    );
    const html = renderToStaticMarkup(
      createElement(AtlasScreenView, {
        atlas: atlasAt('partway'),
        weekly: weeklyInput('mismatch'),
        onBack: () => {},
        still: true,
      }),
    );
    for (const e of echoes()) expect(html).toContain(`data-echo="${e.id}"`);
    expect(html).toContain(starsLine(atlasAt('partway')));
    for (const s of WEEKLY_STATUSES) expect(html).toContain(`data-status="${s}"`);
    expect(html).toContain('data-testid="weekly-result"');
    expect(html).toContain('data-testid="echo-begin"');
    const PrepView = await component<Record<string, unknown>>(
      '../src/ui/screens/PrepScreen',
      'PrepView',
    );
    const { newRun } = await import('../src/meta/run');
    const run = newRun(7);
    const plain = renderToStaticMarkup(
      createElement(PrepView, { run, onChords: () => {}, onEmbark: () => {}, onBack: () => {} }),
    );
    expect(plain).not.toContain('prep-echo');
    expect(plain).not.toContain('prep-weekly');
    const echoPrep = renderToStaticMarkup(
      createElement(PrepView, {
        run: { ...run, echo: 'a_cappella' },
        onChords: () => {},
        onEmbark: () => {},
        onBack: () => {},
      }),
    );
    expect(echoPrep).toContain('data-testid="prep-echo"');
    const weeklyPrep = renderToStaticMarkup(
      createElement(PrepView, {
        run,
        onChords: () => {},
        onEmbark: () => {},
        onBack: () => {},
        weekly: { week: 44, entry: weeklyInput('board').entry },
      }),
    );
    expect(weeklyPrep).toContain('Everyone plays this');
    const SummaryView = await component<Record<string, unknown>>(
      '../src/ui/screens/SummaryScreen',
      'SummaryView',
    );
    const { summaryRun } = await import('../src/ui/lab/mock');
    const s = renderToStaticMarkup(
      createElement(SummaryView, {
        run: summaryRun('victory'),
        onNewRun: () => {},
        onLoom: () => {},
        atlas: atlasRecordFor(0, 12, undefined),
        weekly: { week: 44, score: 3210, won: true, code: 'AW1-X' },
      }),
    );
    expect(s).toContain('data-testid="summary-atlas"');
    expect(s).toContain('data-testid="summary-weekly"');
    const sPlain = renderToStaticMarkup(
      createElement(SummaryView, {
        run: summaryRun('victory'),
        onNewRun: () => {},
        onLoom: () => {},
      }),
    );
    expect(sPlain).not.toContain('summary-atlas');
    expect(sPlain).not.toContain('summary-weekly');
  });

  it('the lab’s Phase 6 views: unique ids, each renders', async () => {
    const { PHASE6_VIEWS } = (await tsxModule('../src/ui/lab/phase6Lab')) as unknown as {
      PHASE6_VIEWS: { id: string; render(): unknown }[];
    };
    const ids = PHASE6_VIEWS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of PHASE6_VIEWS) {
      const html = renderToStaticMarkup(v.render() as never);
      expect(html.length, v.id).toBeGreaterThan(100);
      expect(html, v.id).not.toMatch(/undefined|NaN/);
    }
  }, 60_000);
});
