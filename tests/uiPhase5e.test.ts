/**
 * Phase 5e UI (docs/phase-5e.md, "UI"): Seren's and Oro's frames from mock HUDs (her chips, never
 * faded out of reach and never silver; his Sapling row inside the 19 rem frame), the HUD bridge's
 * duel and grove blocks from a real sim, their hints, the per-hero copy (Passive, the New ally
 * card, the locked text, the recruit lines, the party notes, the Codex's terms), Prep's 3 × 2
 * picker and the Bonds tabs, the Result and Summary lines, the epilogue's RECRUIT_LINES, the
 * Rank-up glyphs, and Brann's and the default party's UI held byte-equal to before (the pin in
 * `uiPhase5e.brann.json`, recorded from W3's head by `uiPhase5eBrannPin.ts`).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useSettings } from '../src/app/settings';
import { CONTENT, deedText, heroDef } from '../src/content';
import { heroRoster, UNLOCKS } from '../src/meta/profile';
import type { DeathRecap } from '../src/meta/types';
import { createSim } from '../src/sim';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import {
  DUEL_VIOLET,
  duelChips,
  duelOutline,
  outOfReach,
  overextendedRallyHome,
} from '../src/ui/hud/duelLook';
import { ancientChip, saplingRows, saplingsOutside, tendingTitle } from '../src/ui/hud/groveLook';
import { frameState } from '../src/ui/hud/healthModel';
import { bindingLabel } from '../src/ui/hud/labels';
import { evaluateHints } from '../src/ui/hud/hints';
import { MIRROR_CHOIR_OTHERS, shownDecree } from '../src/ui/hud/legionLook';
import { CONDUCTOR_DECREES } from '../src/content/crucible';
import { SILENCE_INK } from '../src/ui/hud/finaleLook';
import { allyOf } from '../src/ui/hud/sighting';
import {
  DUO_PARTIES,
  ORO_PARTIES,
  SEREN_PARTIES,
  brannPrepRun,
  oroHud,
  recruitResultRun,
  recruitSummaryRun,
  serenHud,
  type OroScenario,
  type SerenScenario,
} from '../src/ui/lab/mock';
import { heroTabColumns } from '../src/ui/screens/bondsModel';
import { deedGlyph } from '../src/ui/screens/deedsModel';
import { unlockIcon } from '../src/ui/screens/rankText';
import { deathAdviceLine, runDownAdvice } from '../src/ui/screens/resultText';
import {
  duelLine,
  groveLine,
  heroPronouns,
  heroTerms,
  lockedHeroText,
  missingStarterNotes,
  passiveIcon,
  passiveRow,
  pickerColumns,
  recruitLine,
  runDuel,
  runGrove,
  summonsEntry,
  summonsRow,
} from '../src/ui/screens/rosterModel';
import { useUi, type HeroHud, type HudSnapshot } from '../src/ui/store';
import { brannUiPin } from './uiPhase5eBrannPin';
import { worldOf } from './sim/helpers';

const EPILOGUE = '../src/ui/screens/EpilogueView';
const { epilogueLines, epilogueSpeaker } = (await import(/* @vite-ignore */ EPILOGUE)) as {
  epilogueLines(party: readonly string[]): { speaker: string | null; text: string }[];
  epilogueSpeaker(party: readonly string[]): string;
};

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useUi.setState({ callouts: [] });
});

/** A .tsx module's export, at run time (the node test build has no JSX to import statically). */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

async function framesHtml(hud: HudSnapshot, extra: Record<string, unknown> = {}): Promise<string> {
  const PartyFrames = await component<Record<string, unknown>>(
    '../src/ui/hud/PartyFrames',
    'PartyFrames',
  );
  return renderToStaticMarkup(
    createElement(PartyFrames, {
      party: hud.party,
      threadMode: hud.weaver.threadMode,
      barks: [],
      chords: hud.weaver.chords,
      calling: hud.calling,
      rewind: hud.weaver.rewind,
      ...extra,
    }),
  );
}

/** One hero's frame out of the frames' markup (from its button to the next frame). */
function frameOf(html: string, name: string): string {
  const at = html.indexOf(`aria-label="Thread ${name}`);
  expect(at, name).toBeGreaterThan(-1);
  const start = html.lastIndexOf('<button', at);
  const next = html.indexOf('<button', at + 1);
  return html.slice(start, next < 0 ? undefined : next);
}

const seren = (s: SerenScenario) => serenHud(s).party.find((h) => h.defId === 'seren')!;
const oro = (s: OroScenario) => oroHud(s).party.find((h) => h.defId === 'oro')!;
const KEYS = { reel: 'F', rally: 'C', rallyHome: false };

describe('Seren’s frame: chips, the outline, never silver', () => {
  it('en garde, Riposte Chain, a duel, a kill shot, Thousand Cuts and Blade Waltz', () => {
    expect(duelChips(seren('seren-garde'), KEYS).map((c) => c.label)).toEqual(['En garde']);
    expect(duelChips(seren('seren-chain'), KEYS).map((c) => c.label)).toEqual(['Parry ×2']);
    expect(duelChips(seren('seren-duel'), KEYS).map((c) => c.label)).toEqual([
      'Duelling Bell Brute',
    ]);
    expect(duelChips(seren('seren-killshot'), KEYS).map((c) => c.id)).toEqual([
      'killShot',
      'garde',
    ]);
    expect(duelChips(seren('seren-cuts'), KEYS).map((c) => c.label)).toEqual(['Cuts 2.6 s']);
    expect(duelChips(seren('seren-waltz'), KEYS).map((c) => c.label)).toEqual(['Blade Waltz']);
  });

  it('overextended names its answer by the Reel slot: Reel, or Rally for the Chronomancer and the Anchor', () => {
    const over = duelChips(seren('seren-over'), KEYS)[0]!;
    expect(over).toMatchObject({ id: 'over', label: 'Overextended · Reel', key: 'F', alarm: true });
    const home = duelChips(seren('seren-over'), { ...KEYS, rallyHome: true })[0]!;
    expect(home).toMatchObject({ label: 'Overextended · Rally', key: 'C' });
  });

  it('out of reach: a chip and her pulsing violet outline in place of the fade', async () => {
    const h = seren('seren-reach');
    expect(outOfReach(h)).toBe(true);
    expect(frameState(h).far).toBe(false);
    expect(duelChips(h, KEYS).map((c) => c.label)).toContain('Out of reach · Glide closer');
    expect(duelOutline(h)).toEqual({ color: DUEL_VIOLET, pulse: true });
    const frame = frameOf(await framesHtml(serenHud('seren-reach')), 'Seren');
    expect(frame).not.toContain('opacity-[0.62]');
    expect(frame).not.toContain('data-far');
    expect(frame).toContain('data-reach="outline"');
    expect(frame).toContain('data-testid="duel-reach"');
    // Any other hero that far still fades, as it always did.
    const kael = { ...h, defId: 'kael', duel: undefined } as HeroHud;
    expect(frameState(kael).far).toBe(true);
    expect(duelOutline(kael)).toBeNull();
  });

  it('downed out of reach, she fades as any hero does (the chip and outline are gone)', async () => {
    const h = { ...seren('seren-reach'), downed: true } as HeroHud;
    expect(outOfReach(h)).toBe(false);
    expect(duelOutline(h)).toBeNull();
    expect(duelChips(h, KEYS).map((c) => c.id)).not.toContain('reach');
    expect(frameState(h).far).toBe(true);
    const hud = serenHud('seren-reach');
    const downed: HudSnapshot = {
      ...hud,
      party: hud.party.map((p) => (p.defId === 'seren' ? { ...p, downed: true } : p)),
    };
    const frame = frameOf(await framesHtml(downed), 'Seren');
    expect(frame).toContain('data-far');
    // Downed within reach: no fade.
    expect(frameState({ ...h, distance: 3 }).far).toBe(false);
  });

  it('every frame state draws in her violet: never the silver of the Grand Silence', async () => {
    expect(DUEL_VIOLET).toBe(heroDef('seren').color);
    expect(SILENCE_INK.toLowerCase()).toBe('#cbd5e1');
    for (const s of [
      'seren-garde',
      'seren-chain',
      'seren-duel',
      'seren-over',
      'seren-reach',
      'seren-killshot',
      'seren-cuts',
      'seren-waltz',
    ] as const) {
      const frame = frameOf(await framesHtml(serenHud(s)), 'Seren');
      expect(frame.toLowerCase(), s).not.toContain('#cbd5e1');
      expect(frame.toLowerCase(), s).not.toMatch(/rgb\(203[ ,]+213[ ,]+225/);
      expect(frame, s).toMatch(/data-testid="duel-/);
    }
  });

  it('the over chip carries its key, and the Chronomancer’s frame says Rally', async () => {
    const plain = frameOf(await framesHtml(serenHud('seren-over')), 'Seren');
    expect(plain).toContain('Overextended · Reel');
    const anchor = frameOf(
      await framesHtml(serenHud('seren-over'), { reelVariant: 'anchor' }),
      'Seren',
    );
    expect(anchor).toContain('Overextended · Rally');
  });

  it('under the Swap the over chip says Rally too: Swap puts you in her duel, never her home', async () => {
    // Review fix: the Swap variant fell to the Reel chip ('Reel her home') while the hint said
    // 'Swap puts you in her duel; Rally brings her home'.
    expect(overextendedRallyHome(null, null)).toBe(false);
    expect(overextendedRallyHome(null, 'anchor')).toBe(true);
    expect(overextendedRallyHome(null, 'swap')).toBe(true);
    expect(overextendedRallyHome({ ready: true }, null)).toBe(true);
    const html = await framesHtml(serenHud('seren-over'), { reelVariant: 'swap' });
    const frame = frameOf(html, 'Seren');
    expect(frame).toContain('Overextended · Rally');
    expect(frame).not.toContain('Overextended · Reel');
    expect(frame).not.toContain('Reel her home');
    const C = bindingLabel('directiveRally');
    const chip = duelChips(seren('seren-over'), {
      reel: 'F',
      rally: C,
      rallyHome: overextendedRallyHome(null, 'swap'),
    })[0]!;
    expect(chip).toMatchObject({ id: 'over', label: 'Overextended · Rally', key: C });
    // The chip and the hint agree: both send the Swap player to Rally.
    const hud = serenHud('seren-over');
    const swapHud: HudSnapshot = {
      ...hud,
      encounter: { ...hud.encounter, status: 'fighting', elapsed: 12, enemies: 4 },
      weaver: {
        ...hud.weaver,
        rewind: null,
        techniques: hud.weaver.techniques.map((t) =>
          t.key === 'reel' ? { ...t, variant: { id: 'swap', name: 'Swap', text: '' } } : t,
        ),
      },
    };
    const hints = evaluateHints(swapHud).map((h) => h.id);
    expect(hints).toContain('serenSwap');
    expect(hints).not.toContain('serenOver');
  });

  it('the boss bar marks a blow she will parry', async () => {
    const BossBar = await component<Record<string, unknown>>('../src/ui/hud/BossBar', 'BossBar');
    const hud = serenHud('seren-cast');
    const html = renderToStaticMarkup(createElement(BossBar, { boss: hud.boss }));
    expect(html).toContain('data-testid="cast-parried"');
    expect(
      renderToStaticMarkup(
        createElement(BossBar, {
          boss: { ...hud.boss!, cast: { ...hud.boss!.cast!, parried: undefined } },
        }),
      ),
    ).not.toContain('cast-parried');
  });
});

describe('Oro’s frame: the Sapling row, the Ancient, the Gentle glyph', () => {
  it('one mini bar per Sapling, felled ones with their timer, outside ones marked', async () => {
    expect(saplingRows(oro('oro-grove')).map((r) => [r.name, r.felled, r.inField])).toEqual([
      ['Moss', false, true],
      ['Fern', false, true],
    ]);
    const felled = saplingRows(oro('oro-felled'))[1]!;
    expect(felled).toMatchObject({ felled: true, respawnIn: 7.4, life: 0, inField: false });
    expect(saplingsOutside(oro('oro-outside'))).toBe(1);
    expect(saplingsOutside(oro('oro-felled'))).toBe(0);
    const html = frameOf(await framesHtml(oroHud('oro-felled')), 'Oro');
    expect(html.match(/data-testid="sapling-bar"/g)).toHaveLength(2);
    expect(html).toContain('data-felled="true"');
    expect(html).toContain('8s');
    const out = frameOf(await framesHtml(oroHud('oro-outside')), 'Oro');
    expect(out).toContain('data-testid="sapling-out"');
    // The starters' frames have none of it.
    const kael = frameOf(await framesHtml(oroHud('oro-grove')), 'Kael');
    expect(kael).not.toContain('sapling-bar');
  });

  it('the Ancient’s timer, Cued as your field; tending’s closed leaf on his portrait', async () => {
    expect(ancientChip(oro('oro-ancient'))).toMatchObject({
      label: 'Ancient 6 s · your field',
      cued: true,
    });
    expect(ancientChip(oro('oro-grove'))).toBeNull();
    expect(tendingTitle(oro('oro-tending'))).toMatch(/won’t fight without a Focus/);
    expect(tendingTitle(oro('oro-grove'))).toBeNull();
    const html = frameOf(await framesHtml(oroHud('oro-ancient')), 'Oro');
    expect(html).toContain('data-testid="ancient-chip"');
    expect(html).toContain('data-cued="true"');
    expect(frameOf(await framesHtml(oroHud('oro-tending')), 'Oro')).toContain(
      'data-testid="grove-tending"',
    );
  });

  it('the Sapling row fits within the 19 rem frame: equal shrinking cells, no fixed widths', async () => {
    for (const [s, n] of [
      ['oro-grove', 2],
      ['oro-swarm', 3],
    ] as const) {
      const html = frameOf(await framesHtml(oroHud(s), { layout: undefined }), 'Oro');
      // From the grove row to the chips row under it.
      const from = html.indexOf('data-testid="grove-row"');
      const row = html.slice(from, html.indexOf('min-h-5', from));
      expect(row, s).toContain(`grid w-full min-w-0 gap-1 grid-cols-${n}`);
      const bars = row.match(/<span class="([^"]*)"[^>]*data-testid="sapling-bar"/g) ?? [];
      expect(bars, s).toHaveLength(n);
      for (const b of bars) {
        expect(b).toContain('min-w-0');
        expect(b).toContain('overflow-hidden');
      }
      // Nothing in the row sets a width beyond its pips' 0.375 rem dots.
      const widths = [...row.matchAll(/(?<![\w-])w-(\[[^\]]+\]|\d+(?:\.\d+)?)/g)].map((m) => m[1]);
      for (const w of widths) expect(['1.5'], `${s}: w-${w}`).toContain(w);
    }
    // The frames themselves keep the 19 rem width.
    const whole = await framesHtml(oroHud('oro-swarm'));
    expect(whole).toContain('w-[19rem]');
  });
});

describe('the HUD bridge builds duel and grove from the sim, only for their heroes', () => {
  it('a Kael, Seren and Oro party: Seren has duel, Oro has grove with a row per Sapling', () => {
    const sim = createSim({ seed: 3, encounter: 'first_light', party: ['kael', 'seren', 'oro'] });
    for (let i = 0; i < 30; i++) sim.step([]);
    const hud = buildHudSnapshot(sim.state, { seed: 3, hovered: null });
    const [k, s, o] = hud.party;
    expect(k!.duel).toBeUndefined();
    expect(k!.grove).toBeUndefined();
    expect(s!.duel).toMatchObject({ armed: false, overextended: false, charges: 0 });
    expect(s!.grove).toBeUndefined();
    expect(o!.duel).toBeUndefined();
    expect(o!.grove!.saplings).toHaveLength(heroDef('oro').summons!.sapling.count);
    expect(typeof o!.grove!.tending).toBe('boolean');
  });

  it('his held grove never reads as burrowing: Oro down, then his wake; a Rally’s re-plant does', () => {
    const sim = createSim({ seed: 3, encounter: 'first_light', party: ['kael', 'seren', 'oro'] });
    const w = worldOf(sim);
    for (let i = 0; i < 30; i++) sim.step([]);
    const oro = w.entities.get(w.party[2]!)!;
    const rows = () =>
      buildHudSnapshot(sim.state, { seed: 3, hovered: null }).party[2]!.grove!.saplings;
    expect(rows().filter((r) => r.hpPct >= 0).length).toBeGreaterThan(0);
    oro.health!.downed = true;
    oro.health!.bleedOut = 60;
    for (let i = 0; i < 30; i++) sim.step([]);
    const ids = oro.hero!.grove!.saplings;
    expect(w.entities.get(ids[0]!)!.summon!.burrowUntil!).toBeGreaterThan(w.time);
    expect(rows().some((r) => r.burrowing)).toBe(false);
    oro.health!.downed = false;
    oro.health!.bleedOut = 0;
    for (let i = 0; i < 30; i++) sim.step([]);
    expect(w.entities.get(ids[0]!)!.summon!.dormant).toBeUndefined();
    expect(rows().some((r) => r.burrowing)).toBe(false);
    const c = w.entities.get(ids[0]!)!.summon!;
    c.plantX += 3;
    c.burrowUntil = w.time + 0.8;
    expect(rows().find((r) => r.id === ids[0])!.burrowing).toBe(true);
  });

  it('his held grove is neither in your songs nor outside them: Oro down, then his wake', () => {
    // The field gives a held Sapling no auras and no regen, and a Rally skips a dormant one, so
    // its row reads held: not 'stands in your songs', and not 'outside: Rally to re-plant'.
    for (const auras of [['sostenuto'], []]) {
      const sim = createSim({
        seed: 3,
        encounter: 'first_light',
        party: ['kael', 'seren', 'oro'],
        auras,
      });
      const w = worldOf(sim);
      for (let i = 0; i < 60; i++) sim.step([]);
      const oro = w.entities.get(w.party[2]!)!;
      const ids = oro.hero!.grove!.saplings;
      const hero = () => buildHudSnapshot(sim.state, { seed: 3, hovered: null }).party[2]!;
      const standing = () => hero().grove!.saplings.filter((r) => r.hpPct >= 0);
      expect(standing().length).toBe(2);
      expect(standing().every((r) => r.held === undefined)).toBe(true);
      const check = () => {
        for (const id of ids) expect(w.entities.get(id)!.summon!.inField).toBeUndefined();
        expect(standing().every((r) => r.held === true && r.inField === false)).toBe(true);
        expect(saplingsOutside(hero())).toBe(0);
        for (const r of saplingRows(hero()).filter((x) => !x.felled)) {
          expect(r).toMatchObject({ held: true, inField: false, burrowing: false });
          expect(r.title).toContain('is held where it stands');
          expect(r.title).not.toContain('stands in your songs');
          expect(r.title).not.toContain('Rally');
        }
      };
      oro.health!.downed = true;
      oro.health!.bleedOut = 60;
      for (let i = 0; i < 30; i++) sim.step([]);
      check();
      oro.health!.downed = false;
      oro.health!.bleedOut = 0;
      for (let i = 0; i < 30; i++) sim.step([]);
      expect(w.entities.get(ids[0]!)!.summon!.dormant).toBeUndefined();
      check();
      // Awake (the 2 s wake over): the rows read the field again, and no key is left behind.
      for (let i = 0; i < 120; i++) sim.step([]);
      expect(standing().every((r) => r.held === undefined)).toBe(true);
    }
  });

  it('the default party has neither key', () => {
    const sim = createSim({ seed: 3, encounter: 'first_light' });
    const hud = buildHudSnapshot(sim.state, { seed: 3, hovered: null });
    for (const h of hud.party) {
      expect('duel' in h).toBe(false);
      expect('grove' in h).toBe(false);
    }
    expect(hud.boss?.cast ?? null).toBeNull();
  });
});

describe('their hints, each with its own id', () => {
  const ids = (hud: HudSnapshot) => evaluateHints(hud).map((h) => h.id);
  const fighting = (hud: HudSnapshot): HudSnapshot => ({
    ...hud,
    encounter: { ...hud.encounter, status: 'fighting', elapsed: 12, enemies: 4 },
  });

  it('Seren: duelling, surrounded, out of reach, the kill shot', () => {
    expect(ids(fighting(serenHud('seren-duel')))).toContain('serenDuel');
    expect(ids(fighting(serenHud('seren-over')))).toContain('serenOver');
    expect(ids(fighting(serenHud('seren-reach')))).toContain('serenReach');
    expect(ids(fighting(serenHud('seren-garde')))).toContain('serenKillShot');
    // Duelling outside the field is by design: no 'strayed' Reel hint for her.
    expect(ids(fighting(serenHud('seren-duel')))).not.toContain('strayed');
    const over = evaluateHints(fighting(serenHud('seren-over'))).find((h) => h.id === 'serenOver')!;
    expect(over.text).toContain(
      `Reel {${bindingLabel('reel')}} her home, or Rally {${bindingLabel('directiveRally')}}`,
    );
  });

  it('Oro: Saplings outside your songs, tending, bosses ignore them', () => {
    expect(ids(fighting(oroHud('oro-outside')))).toContain('oroOutside');
    expect(ids(fighting(oroHud('oro-grove')))).not.toContain('oroOutside');
    expect(ids(fighting(oroHud('oro-tending')))).toContain('oroGentle');
    const boss = fighting({ ...oroHud('oro-grove'), boss: serenHud('seren-cast').boss });
    expect(ids(boss)).toContain('oroBoss');
  });
});

describe('the per-hero copy', () => {
  it('Passive rows, their glyphs, and Oro’s Saplings row', () => {
    expect(passiveRow(heroDef('seren'))).toEqual({
      name: 'Parry',
      text: expect.stringMatching(
        /^While Warded, the next melee blow on her is parried and countered for 300%\./,
      ) as unknown as string,
    });
    expect(passiveRow(heroDef('oro'))).toEqual({
      name: 'Rootbond',
      text: 'Your Thread on Oro also Mends his summons at 50%.',
    });
    expect(passiveIcon(heroDef('brann'))).toBe('flame');
    expect(passiveIcon(heroDef('seren'))).toBe('blades');
    expect(passiveIcon(heroDef('oro'))).toBe('leaf');
    expect(summonsRow(heroDef('oro'))).toBe(
      '2 Saplings · 456 life · take your songs · bosses ignore them',
    );
    expect(summonsRow(heroDef('seren'))).toBeNull();
    expect(summonsEntry(heroDef('oro'))).toHaveLength(3);
    expect(summonsEntry(heroDef('kael'))).toEqual([]);
  });

  it('the Ancient’s stand: uncued it leaves with Wildgrowth, so only the Cued tree stands its 8 s', () => {
    // Uncued it rises after its 1 s ground warning and leaves as the 8 s Solo ends (7 s up);
    // only the Cued Ancient stands `life` (8 s) from rising. Neither line says it stands 8 s.
    const line = summonsEntry(heroDef('oro'))[1]!;
    expect(line).toContain('for the rest of Wildgrowth’s 8 s (Cued, 8 s from rising)');
    expect(line).not.toContain('life for 8 s');
    const term = heroTerms(['oro']).find((t) => t.term === 'Ancient')!.text;
    expect(term).toContain(
      'rises for the rest of Wildgrowth’s 8 s (Cued, it stands 8 s from rising)',
    );
    expect(term).not.toContain('rises for 8 s');
  });

  it('the New ally cards', () => {
    expect(allyOf('seren')!.lines).toEqual([
      'Ward her as the blow lands: she parries and counters threefold. A Perfect Ward is a kill shot.',
      'She hunts the strongest foe. Reel or Rally her when she’s surrounded.',
    ]);
    expect(allyOf('oro')!.lines).toEqual([
      'His Saplings take your songs: keep them in your field, or Rally to re-plant them.',
      'Your Thread on him Mends them too. He won’t fight without a Focus.',
    ]);
  });

  it('the locked text and the recruit lines come from content', () => {
    expect(lockedHeroText('seren')).toBe(heroDef('seren').recruit!.lockedText);
    expect(lockedHeroText('oro')).toBe(heroDef('oro').recruit!.lockedText);
    expect(recruitLine('seren', 'gorehound_matriarch')).toBe(
      heroDef('seren').recruit!.fallbackText,
    );
    expect(recruitLine('oro', 'the_seamstress')).toBe(heroDef('oro').recruit!.fallbackText);
    expect(recruitLine('seren', 'legion_vanguard')).toBe(
      'Seren, the Riposte, will fight beside you from your next run.',
    );
    expect(recruitLine('seren', 'first_light', 'word')).toBe(
      'Seren, the Riposte, will fight beside you from your next run. Word of your fight reached her.',
    );
    expect(heroPronouns('seren').obj).toBe('her');
    expect(heroPronouns('brann').obj).toBe('him');
  });

  it('party notes name who holds and who interrupts, and OB’s note (Q8)', () => {
    const text = (p: readonly string[]) => missingStarterNotes(p).map((n) => n.text);
    expect(text(SEREN_PARTIES.SB)[0]).toMatch(/The bosses will find Seren — Ward her/);
    expect(text(ORO_PARTIES.OB)).toEqual([
      'No Kael: nothing holds the bosses, and Oro won’t. Keep a Perfect, a Reel or a Chime for each boss blow.',
    ]);
    expect(text(DUO_PARTIES.W)).toEqual([
      'No Kael: nothing taunts. The bosses will find Seren — Ward her as the blow lands: she parries it whole.',
      'No Lyra: Seren’s Lunge is your interrupter. Break guards with Focus.',
    ]);
    expect(text(DUO_PARTIES.SO)).toEqual([
      'No Lyra: only Kael’s Shield Bash and Seren’s Lunge interrupt. Break guards with Focus.',
      'No Vexis: no Gravity Well — swarms stay spread out.',
    ]);
    expect(text(['kael', 'brann', 'seren'])[0]).toBe(
      'No Lyra: only Kael’s Shield Bash, Brann’s Sunder Leap and Seren’s Lunge interrupt. Break guards with Focus.',
    );
  });

  it('a condemned Seren is never "him"', () => {
    const execution = CONTENT.attacks.find((a) => a.executeBelow !== undefined)!;
    expect(
      shownDecree(execution.decree!, [
        { defId: 'lyra' },
        { defId: 'vexis' },
        { defId: 'seren', execute: 0.4, healCut: 0.5 },
      ]),
    ).toBe(execution.decree);
  });

  it('the Codex’s terms appear with their hero, and never for an earlier roster', async () => {
    expect(heroTerms(heroRoster({ recruited: ['brann'] }, false))).toEqual([]);
    expect(heroTerms(['kael', 'lyra', 'vexis', 'seren']).map((t) => t.term)).toEqual([
      'Parry',
      'Kill shot',
      'Showboat',
      'Heavy',
    ]);
    expect(heroTerms(heroRoster({ recruited: ['oro'] }, false)).map((t) => t.term)).toEqual([
      'Sapling',
      'Ancient',
      'Rooted',
      'Rootbond',
      'Tending',
      'Heavy',
    ]);
    const CodexView = await component<Record<string, unknown>>(
      '../src/ui/screens/CodexScreen',
      'CodexView',
    );
    const all = heroRoster({ recruited: ['brann', 'seren', 'oro'] }, false);
    const html = renderToStaticMarkup(
      createElement(CodexView, { onBack: () => {}, initialTab: 'heroes', roster: all }),
    );
    expect(html).toContain('data-testid="codex-hero-terms"');
    expect(html).toContain('data-testid="codex-summons-oro"');
    expect(html).toContain('data-testid="codex-passive-seren"');
    const locked = renderToStaticMarkup(
      createElement(CodexView, {
        onBack: () => {},
        initialTab: 'heroes',
        roster: CONTENT.defaultParty,
      }),
    );
    expect(locked).not.toContain('codex-hero-terms');
    expect(locked).toContain(heroDef('seren').recruit!.lockedText!);
    expect(locked).toContain(heroDef('oro').recruit!.lockedText!);
  });

  it('their downs name their answers, Calling-aware', () => {
    const down = (duel: DeathRecap['duel'], heroId = 'seren'): DeathRecap =>
      ({
        heroId,
        time: 30,
        killer: 'Bell Brute',
        recap: [],
        answers: ['ward'],
        readyTechniques: [],
        duel,
      }) as unknown as DeathRecap;
    const over = down({ overextended: true, far: false, parryable: false, warded: false } as never);
    expect(deathAdviceLine(over, DUO_PARTIES.SO)).toBe(
      'Reel or Rally her out of the pack, or Cue Thousand Cuts.',
    );
    expect(deathAdviceLine(over, DUO_PARTIES.SO, 'chronomancer')).toBe(
      'Rally her, or Rewind as the pack closes.',
    );
    const run = recruitResultRun(DUO_PARTIES.SO);
    const r = { ...run.lastResult!, deaths: [over] };
    expect(runDownAdvice([r], 'seren', 'chronomancer')).toEqual([
      { text: 'Rally her, or Rewind as the pack closes.', count: 1 },
    ]);
  });
});

describe('Prep 3 × 2, the Bonds tabs, the Result and the Summary', () => {
  it('the picker lays five or six out three across; four or fewer as they were', async () => {
    expect([1, 2, 3, 4, 5, 6].map(pickerColumns)).toEqual([1, 2, 3, 4, 3, 3]);
    const PrepView = await component<Record<string, unknown>>(
      '../src/ui/screens/PrepScreen',
      'PrepView',
    );
    for (const recruited of [
      ['seren', 'oro'],
      ['brann', 'seren', 'oro'],
    ]) {
      const roster = heroRoster({ recruited }, false);
      const html = renderToStaticMarkup(
        createElement(PrepView, {
          run: brannPrepRun(DUO_PARTIES.SO),
          onChords: () => {},
          onEmbark: () => {},
          onBack: () => {},
          rank: 12,
          party: { roster, onChange: () => {} },
        }),
      );
      expect(html, recruited.join()).toContain('repeat(3, minmax(0, 1fr))');
      expect(html.match(/data-testid="prep-pick-/g)).toHaveLength(roster.length);
      expect(html).toContain('data-testid="prep-passive-seren"');
      expect(html).toContain('data-testid="prep-summons-oro"');
    }
  });

  it('the Bonds tabs: 3 × 2 at five and six', () => {
    expect([3, 4, 5, 6].map(heroTabColumns)).toEqual([
      'sm:grid-cols-3',
      'sm:grid-cols-4',
      'sm:grid-cols-3',
      'sm:grid-cols-3',
    ]);
  });

  it('duel-line and grove-line on the Result and the Summary', async () => {
    const run = recruitResultRun(DUO_PARTIES.SO);
    const r = run.lastResult!;
    const s = r.heroes.find((h) => h.heroId === 'seren')!;
    const o = r.heroes.find((h) => h.heroId === 'oro')!;
    expect(duelLine('seren', s.duel!)).toBe(
      'Seren · parries 14 · kill shots 3 · your Wards dealt 4,210 · overextended 6 s',
    );
    expect(groveLine('oro', o.grove!)).toBe(
      'Oro · Saplings in your songs 74% · felled 3 · Rootbond 1,120 · Ancients 1',
    );
    const two = { ...run, results: [...run.results, r] };
    expect(runDuel(two, 'seren')).toMatchObject({ parries: 28, killShots: 6 });
    expect(runGrove(two, 'oro')).toMatchObject({ saplingsLost: 6, inFieldShare: 0.74 });
    expect(runDuel(two, 'kael')).toBeNull();
    const ResultView = await component<Record<string, unknown>>(
      '../src/ui/screens/ResultScreen',
      'ResultView',
    );
    const html = renderToStaticMarkup(
      createElement(ResultView, { run, result: r, onContinue: () => {} }),
    );
    expect(html).toContain('data-testid="duel-line"');
    expect(html).toContain('data-testid="grove-line"');
    const SummaryView = await component<Record<string, unknown>>(
      '../src/ui/screens/SummaryScreen',
      'SummaryView',
    );
    const summary = renderToStaticMarkup(
      createElement(SummaryView, {
        run: recruitSummaryRun(DUO_PARTIES.SO),
        onNewRun: () => {},
        onLoom: () => {},
      }),
    );
    expect(summary).toContain('data-testid="duel-line"');
    expect(summary).toContain('data-testid="grove-line"');
  });
});

describe('the epilogue and the Rank-ups', () => {
  it('Seren or Oro answers the Conductor when present (Seren first); every other party is unchanged', () => {
    expect(epilogueSpeaker(['kael', 'seren', 'oro'])).toBe('seren');
    expect(epilogueSpeaker(['oro', 'seren', 'kael'])).toBe('seren');
    expect(epilogueSpeaker(['kael', 'lyra', 'oro'])).toBe('oro');
    expect(epilogueLines(['lyra', 'vexis', 'oro'])[2]).toMatchObject({
      speaker: 'Oro',
      text: 'Even the grove sleeps, and then it wakes.',
    });
    expect(epilogueLines(['brann', 'kael', 'seren'])[2]).toMatchObject({
      speaker: 'Seren',
      text: 'You call it rest. I call it forfeit.',
    });
    expect(epilogueSpeaker(['lyra', 'kael', 'vexis'])).toBe('lyra');
    expect(epilogueSpeaker(['brann', 'kael', 'lyra'])).toBe('brann');
  });

  it('their Rank-ups and Deeds carry their glyphs', () => {
    const u = (id: string) => UNLOCKS.find((x) => x.id === id)!;
    expect(unlockIcon(u('recruit.seren'))).toBe('blades');
    expect(unlockIcon(u('recruit.oro'))).toBe('leaf');
    const tally = CONTENT.deeds.filter((d) => d.test === 'heroTally');
    expect(tally.map((d) => [d.id, deedGlyph(d)])).toEqual([
      ['debt_paid', 'blades'],
      ['not_a_leaf_lost', 'leaf'],
    ]);
    expect(deedText(tally[0]!)).toMatch(/Seren/);
  });
});

describe('review fixes: the Mirror Choir decree, and Brann’s Codex entry', () => {
  const look = (...ids: string[]) => ids.map((defId) => ({ defId }));

  it('the Mirror Choir decree says your other heroes still sing, for a Seren or Oro party only', () => {
    const text = CONDUCTOR_DECREES.mirrorChoir;
    expect(shownDecree(text, look('kael', 'seren', 'oro'))).toBe(MIRROR_CHOIR_OTHERS);
    expect(shownDecree(text, look('lyra', 'vexis', 'oro'))).toBe(MIRROR_CHOIR_OTHERS);
    expect(shownDecree(text, look('kael', 'brann', 'seren'))).toBe(MIRROR_CHOIR_OTHERS);
    expect(MIRROR_CHOIR_OTHERS).toContain('your other heroes still sing');
    expect(MIRROR_CHOIR_OTHERS).not.toContain('every voice of your party');
    // Every party of the first four reads the sim's text, unchanged.
    for (const p of [
      look('kael', 'lyra', 'vexis'),
      look('kael', 'lyra', 'brann'),
      look('brann', 'vexis'),
    ])
      expect(shownDecree(text, p)).toBe(text);
    // The other Conductor decrees are untouched whoever is in the party.
    for (const other of [CONDUCTOR_DECREES.overture, CONDUCTOR_DECREES.grandSilence])
      expect(shownDecree(other, look('kael', 'seren', 'oro'))).toBe(other);
  });

  it('the HUD bridge words a Seren party’s Mirror Choir decree that way too', async () => {
    const { decreeShownNow } = await import('../src/ui/hudBridge');
    const sim = createSim({ seed: 7, encounter: 'first_light', party: ['kael', 'seren', 'oro'] });
    expect(decreeShownNow(sim.state, CONDUCTOR_DECREES.mirrorChoir)).toBe(MIRROR_CHOIR_OTHERS);
    const plain = createSim({ seed: 7, encounter: 'first_light' });
    expect(decreeShownNow(plain.state, CONDUCTOR_DECREES.mirrorChoir)).toBe(
      CONDUCTOR_DECREES.mirrorChoir,
    );
  });

  it('the Codex heroes page for the first four is byte-equal to W3’s, but for the narrowed locked lines', async () => {
    // Review fix: the Passive <dt> gained flex classes for every hero, Brann included. Recorded at
    // cf8c56e (W3's head) with the old locked lines stripped; here the new ones are stripped.
    const CodexView = await component<Record<string, unknown>>(
      '../src/ui/screens/CodexScreen',
      'CodexView',
    );
    const html = renderToStaticMarkup(
      createElement(CodexView, {
        onBack: () => {},
        initialTab: 'heroes',
        roster: ['kael', 'lyra', 'vexis', 'brann'],
      }),
    );
    expect(html).toContain('<dt class="font-semibold">Passive · Blood Rage</dt>');
    let stripped = html;
    for (const id of ['seren', 'oro'])
      stripped = stripped.replace(heroDef(id).recruit!.lockedText!, '');
    expect(createHash('sha256').update(stripped).digest('hex')).toBe(
      'b9f17d814045a040d1d1861fab7b40bca854a29cb20cb1c9d2287727a6c6421c',
    );
  });
});

describe('Brann’s and the default party’s UI are byte-equal to before', () => {
  it('every pinned text and frame hashes as recorded at W3’s head', async () => {
    const want = JSON.parse(
      readFileSync(join(__dirname, 'uiPhase5e.brann.json'), 'utf8'),
    ) as Record<string, string>;
    const pin = await brannUiPin();
    const got: Record<string, string> = {};
    for (const [k, v] of Object.entries(pin))
      got[k] = createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
    expect(Object.keys(got)).toEqual(Object.keys(want));
    expect(got).toEqual(want);
  });
});
