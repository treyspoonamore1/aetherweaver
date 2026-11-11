/**
 * Phase 5d's UI (docs/phase-5d.md "UI", "Accessibility with audio off", "Narrative beat and
 * ending"): the Finale's HUD keys exist only in the Finale; an audio-muted, Flashes-0 HUD still
 * shows every visual twin (the Discord meter, the Cue, Fortissimo's pips, the silence stave and
 * tint, stilled and downed frames, the note callout); Blind Score hides only the answers; the
 * sighting cards follow the Calling and Reel's variant; every Finale down names its answer; the
 * route copy, the epilogue (under 20 s, skippable) and the first-clear card; captions.
 */
import { readFileSync } from 'node:fs';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import {
  ALTO,
  BASS,
  BASSO_OSTINATO,
  CADENZA,
  CONDUCTOR,
  DOWNBEAT,
  FINAL_CADENCE,
  FORTISSIMO,
  HALF_CADENCE,
  LAMENT,
  MEASURE,
  REST,
  SFORZANDO,
  SHATTER_ARIA,
  SONG_GOES_ON,
  SOPRANO,
  TENOR,
} from '../src/content/crucibleIds';
import { DEFAULT_SETTINGS, migrateSettings, useSettings } from '../src/app/settings';
import { finaleCleared } from '../src/meta/runEnd';
import { createSim, type SimEvent } from '../src/sim';
import { evaluateHints, ANSWER_HINTS } from '../src/ui/hud/hints';
import {
  finaleDefeatLine,
  plainDefeatLine,
  captionCallout,
  cueText,
  defeatLine,
  discordSegments,
  discordText,
  finaleCallouts,
  finaleCaption,
  fortissimoInText,
  noteCallout,
  noteSources,
  silenceLeftFrac,
  silencePips,
} from '../src/ui/hud/finaleLook';
import { bossCastIcon } from '../src/ui/hud/legionLook';
import { settleHeldVoices, sightingFoes, sightingOf } from '../src/ui/hud/sighting';
import {
  REIGNITE_GLOW_S,
  buildHudSnapshot,
  heardReignite,
  heardSilence,
} from '../src/ui/hudBridge';
import {
  finaleHud,
  finaleMockCallouts,
  finaleRun,
  finaleSummaryRun,
  mockBonds,
  mockRankUps,
  riftSummaryRun,
  type FinaleScenario,
} from '../src/ui/lab/mock';
import { bossSpoils } from '../src/ui/screens/interlude';
import { deathAdviceLine, finaleDownLine } from '../src/ui/screens/resultText';
import {
  biomeTone,
  encounterIcon,
  movementCard,
  movementCardLook,
  movementLore,
  outcomeSub,
  routeHint,
  titleEyebrow,
} from '../src/ui/screens/routeText';
import type { HudSnapshot } from '../src/ui/store';
import { worldOf } from './sim/helpers';
import type { RunState } from '../src/meta/types';

/** A .tsx module, at run time (the node test build has no JSX to import statically). */
async function tsx<T>(path: string): Promise<T> {
  return (await import(/* @vite-ignore */ path)) as T;
}

// The components and the epilogue's model, typed as the tests use them.
type Props = Record<string, unknown>;
const { BossBar } = await tsx<{ BossBar: FunctionComponent<Props> }>('../src/ui/hud/BossBar');
const { HudView } = await tsx<{ HudView: FunctionComponent<Props> }>('../src/ui/hud/Hud');
const {
  EPILOGUE_SKIP_KEYS,
  EpilogueView,
  epilogueLines,
  epilogueMs,
  epilogueTakesKey,
  markEpilogueSeen,
} = await tsx<{
  EPILOGUE_SKIP_KEYS: ReadonlySet<string>;
  markEpilogueSeen(seed: number): void;
  epilogueTakesKey(e: Record<string, unknown>): boolean;
  EpilogueView: FunctionComponent<Props>;
  epilogueLines(party: readonly string[]): { speaker: string | null; text: string }[];
  epilogueMs(lines: number): number;
}>('../src/ui/screens/EpilogueView');
const { SummaryView, firstClearLines, summaryCard } = await tsx<{
  SummaryView: FunctionComponent<Props & { run: RunState }>;
  firstClearLines(open: boolean): { title: string; lines: string[] };
  summaryCard(o: {
    waiting: boolean;
    rankUps: number;
    rankCard: boolean;
    bondNotices: number;
  }): 'rank' | 'bond' | null;
}>('../src/ui/screens/SummaryScreen');

const BOSS_KEYS = ['discord', 'fortissimo', 'silence', 'cue'] as const;

function snapshot(encounter: string, ticks = 600): HudSnapshot {
  const sim = createSim({ seed: 7, encounter });
  for (let i = 0; i < ticks; i++) sim.step([]);
  return buildHudSnapshot(sim.state, { seed: 7, hovered: null });
}

function noFinaleKeys(hud: HudSnapshot, label: string): void {
  if (hud.boss) for (const k of BOSS_KEYS) expect(hud.boss, `${label} ${k}`).not.toHaveProperty(k);
  for (const h of hud.party) expect(h, `${label} stilled`).not.toHaveProperty('stilled');
}

const fighting = (hud: HudSnapshot): HudSnapshot => ({
  ...hud,
  encounter: { ...hud.encounter, status: 'fighting' },
});

describe('the HUD bridge: Finale keys only in the Finale', () => {
  it('Movement I-III fights, their bosses included, carry none of them', () => {
    for (const id of ['first_light', 'hollow_cantor', 'crimson_gate', 'vharun', 'the_unweaver']) {
      const hud = snapshot(id, 900);
      if (id !== 'first_light' && id !== 'crimson_gate') expect(hud.boss, id).not.toBeNull();
      noFinaleKeys(hud, id);
    }
  });

  it('the Conductor’s fight fills them from field.finale and the stilled status, then drops them', () => {
    const sim = createSim({ seed: 7, encounter: CONDUCTOR });
    for (let i = 0; i < 900 && sim.state.encounter.bossId === null; i++) sim.step([]);
    const world = worldOf(sim);
    const boss = world.encounter.bossId!;
    // Nothing yet: the keys follow field.finale, not the encounter.
    noFinaleKeys(buildHudSnapshot(sim.state, { seed: 7, hovered: null }), 'before');
    const [kael, lyra] = [world.party[0]!, world.party[1]!];
    world.field.finale = {
      discord: { value: 72, rate: 1 },
      fortissimo: { pulse: 2, impact: world.time + 1.5 },
      cue: { boss, soloist: boss, solo: BASSO_OSTINATO, target: lyra, until: world.time + 2 },
      silence: {
        notes: 3,
        of: 8,
        since: world.time,
        until: world.time + 40,
        sources: ['perfect', 'clutch', 'reel'],
      },
    };
    world.entities.get(kael)!.health!.statuses.push({
      id: 'stilled',
      remaining: 1e9,
      duration: 1e9,
      stacks: 1,
      source: boss,
    });
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    expect(hud.boss?.discord).toEqual({ value: 72, max: 100, rate: 1 });
    expect(hud.boss?.fortissimo).toEqual({ pulse: 2, of: 3 });
    expect(hud.boss?.silence).toEqual({
      notes: 3,
      of: 8,
      sources: ['perfect', 'clutch', 'reel'],
      left: 40,
      cap: 40,
    });
    expect(hud.boss?.cue).toEqual({
      soloist: 'The Silent Conductor',
      solo: 'Basso Ostinato',
      target: 'Lyra',
    });
    expect(hud.party[0]!.stilled).toBe(true);
    expect(hud.party[1]).not.toHaveProperty('stilled');
    // The script's cleanup deletes field.finale and strips stilled: every key goes with them.
    delete world.field.finale;
    const statuses = world.entities.get(kael)!.health!.statuses;
    statuses.splice(
      statuses.findIndex((s) => s.id === 'stilled'),
      1,
    );
    noFinaleKeys(buildHudSnapshot(sim.state, { seed: 7, hovered: null }), 'after');
  });

  it('a Cue names its target only once the Solo has begun', () => {
    const sim = createSim({ seed: 7, encounter: CONDUCTOR });
    for (let i = 0; i < 900 && sim.state.encounter.bossId === null; i++) sim.step([]);
    const world = worldOf(sim);
    const boss = world.encounter.bossId!;
    world.field.finale = {
      cue: { boss, soloist: boss, solo: CADENZA, until: world.time + 1.2 },
    };
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    expect(hud.boss?.cue).toEqual({ soloist: 'The Silent Conductor', solo: 'Cadenza' });
    expect(cueText({ soloist: 'Mirror Bass', solo: 'Basso Ostinato' })).toBe(
      'Cue · Bass: Basso Ostinato',
    );
    expect(cueText({ soloist: 'Mirror Bass', solo: 'Basso Ostinato', target: 'Lyra' })).toBe(
      'Cue · Bass: Basso Ostinato → Lyra',
    );
  });
});

describe('the Discord meter and the silence stave', () => {
  it('Discord fills four segments of 25, and says when Fortissimo Silence comes', () => {
    expect(discordSegments({ value: 72, max: 100 })).toEqual([1, 1, 0.88, 0]);
    expect(discordText({ value: 72.6, max: 100 })).toBe(
      'Conductor’s Discord 72/100 · Crescendo cancels Fortissimo Silence',
    );
    expect(discordText({ value: 72.6, max: 100 }, true)).toBe('Conductor’s Discord 72/100');
    expect(fortissimoInText({ value: 86, max: 100, rate: 1 })).toBe('Fortissimo Silence in ~14 s');
    expect(fortissimoInText({ value: 100, max: 100, rate: 1 })).toBe('Fortissimo Silence now');
    expect(fortissimoInText({ value: 40, max: 100, rate: 0 })).toBeNull();
    // Always written in full: "Fortissimo" alone is an aura.
    expect(discordText({ value: 1, max: 100 })).not.toMatch(/Fortissimo(?! Silence)/);
  });

  it('the stave fills a pip per note with its source', () => {
    expect(silencePips({ notes: 3, of: 8, sources: ['perfect', 'clutch', 'rewind'] })).toEqual([
      'perfect',
      'clutch',
      'rewind',
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('the Coda bar drains against the real cap, stretched by the windup assists', () => {
    // telegraphLead 1.5: the cap is 75 s. Five seconds in, the bar must already have drained.
    expect(silenceLeftFrac({ left: 70, cap: 75 })).toBeCloseTo(70 / 75, 10);
    expect(silenceLeftFrac({ left: 75, cap: 75 })).toBe(1);
    expect(silenceLeftFrac({ left: 25, cap: 50 })).toBe(0.5);
    expect(silenceLeftFrac({ left: 0, cap: 75 })).toBe(0);
    // A missing or zero cap falls back to the default cap, never a divide by zero.
    expect(silenceLeftFrac({ left: 25, cap: 0 })).toBe(0.5);
    // The bridge carries the cap the sim fixed at entry (until - since), not a guess from `left`.
    const sim = createSim({ seed: 7, encounter: CONDUCTOR });
    for (let i = 0; i < 900 && sim.state.encounter.bossId === null; i++) sim.step([]);
    const world = worldOf(sim);
    world.field.finale = {
      silence: { notes: 0, of: 8, since: world.time - 5, until: world.time + 70, sources: [] },
    };
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    expect(hud.boss?.silence?.left).toBeCloseTo(70, 6);
    expect(hud.boss?.silence?.cap).toBeCloseTo(75, 6);
    const html = renderToStaticMarkup(
      createElement(BossBar, { boss: hud.boss!, decree: null, blind: true }),
    );
    expect(html).toContain('The Coda in 70 s');
    // The stave's drain bar (the boss's life bar, still full, is the other width:100%).
    const stave = html.slice(html.indexOf('data-testid="boss-silence"'));
    expect(stave).not.toContain('width:100%');
    expect(stave).toMatch(/width:93\.33\d*%/);
    delete world.field.finale;
  });

  it('Stasis inside the silence holds the Coda bar: the cap stays the one fixed at entry', () => {
    const sim = createSim({ seed: 7, encounter: CONDUCTOR });
    for (let i = 0; i < 900 && sim.state.encounter.bossId === null; i++) sim.step([]);
    const world = worldOf(sim);
    const now = world.time;
    // The silence began 14 s ago with the default 50 s cap; 10 s ran, then a 4 s Stasis pushed
    // `until` 4 s on and left `since` (conductorBoss.ts's Stasis hook): 40 s are still left.
    const since = now - 14;
    world.field.finale = {
      silence: { notes: 2, of: 8, since, until: now + 40, sources: ['perfect', 'clutch'] },
    };
    const began = {
      type: 'silenceBegan',
      tick: world.tick,
      boss: world.encounter.bossId!,
      until: since + 50,
    } as SimEvent;
    const heard = heardSilence([began], sim.state);
    expect(heard).toEqual({ since, cap: 50 });
    expect(heardSilence([], sim.state)).toBeNull();
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null, silenceHeard: heard });
    expect(hud.boss?.silence?.left).toBeCloseTo(40, 6);
    expect(hud.boss?.silence?.cap).toBeCloseTo(50, 6);
    expect(silenceLeftFrac(hud.boss!.silence!)).toBeCloseTo(0.8, 6);
    // A cap heard for another silence (an earlier `since`) is not this one's.
    const stale = buildHudSnapshot(sim.state, {
      seed: 7,
      hovered: null,
      silenceHeard: { since: since - 100, cap: 30 },
    });
    expect(stale.boss?.silence?.cap).toBeCloseTo(54, 6);
    delete world.field.finale;
  });

  it('Blind Score hides only the answers, never the meter, the stave or the Cue', () => {
    const blind = (scenario: FinaleScenario) =>
      renderToStaticMarkup(
        createElement(BossBar, { boss: finaleHud(scenario).boss!, decree: null, blind: true }),
      );
    const seen = (scenario: FinaleScenario) =>
      renderToStaticMarkup(
        createElement(BossBar, { boss: finaleHud(scenario).boss!, decree: null }),
      );
    expect(seen('discord-75')).toContain('Crescendo cancels Fortissimo Silence');
    expect(blind('discord-75')).toContain('Conductor’s Discord 75/100');
    expect(blind('discord-75')).not.toContain('Crescendo cancels');
    expect(seen('cue')).toContain('interrupt the soloist');
    expect(blind('cue')).toContain('Cue · Bass: Basso Ostinato → Lyra');
    expect(blind('cue')).not.toContain('interrupt the soloist');
    expect(seen('silence-4')).toContain('data-testid="boss-silence-ask"');
    expect(blind('silence-4')).toContain('data-testid="boss-silence-stave"');
    expect(blind('silence-4')).not.toContain('data-testid="boss-silence-ask"');
  });

  it('the Conductor casts under a baton; Fortissimo Silence under the music cut off', () => {
    expect(bossCastIcon(CONDUCTOR)).toBe('baton');
    expect(bossCastIcon(CONDUCTOR, true)).toBe('mute');
    // Every other boss keeps its glyph.
    expect(bossCastIcon('the_unweaver')).toBe('scissors');
    expect(bossCastIcon('hollow_cantor')).toBe('bell');
  });
});

describe('an audio-muted, Flashes-0 HUD shows every twin', () => {
  function hudHtml(scenario: FinaleScenario): string {
    useSettings.getState().update((d) => ({
      ...d,
      flashes: 0,
      volumes: { master: 0, music: 0, sfx: 0, ui: 0 },
    }));
    const hud = finaleHud(scenario);
    return renderToStaticMarkup(
      createElement(HudView, {
        hud,
        callouts: finaleMockCallouts(scenario),
        decree: hud.boss?.decree ?? null,
        keyHints: false,
        coach: false,
      }),
    );
  }

  it('Discord: the numbered meter, its rise and the countdown to Fortissimo Silence', () => {
    const html = hudHtml('discord-75');
    expect(html).toContain('data-testid="boss-discord-meter"');
    expect(html).toContain('aria-valuenow="75"');
    expect(html).toContain('+1.0/s');
    expect(html).toContain('Fortissimo Silence in ~25 s');
  });

  it('a Cue: the soloist and its Solo on the boss bar, the target once begun', () => {
    expect(hudHtml('cue')).toContain('Cue · Bass: Basso Ostinato → Lyra');
  });

  it('Fortissimo Silence: its pulse pips and the meter at 100', () => {
    const html = hudHtml('fortissimo');
    expect(html).toContain('aria-label="blow 1 of 3"');
    expect(html).toContain('Fortissimo Silence now');
  });

  it('the Grand Silence: the tint, the stave with its notes, stilled frames, the note callout', () => {
    const html = hudHtml('silence-4');
    expect(html).toContain('data-testid="silence-tint"');
    expect(html).toContain('Grand Silence · 4/8 notes');
    expect(html.match(/data-note="(perfect|clutch|reel|rewind)"/g)).toHaveLength(4);
    expect(html.match(/data-testid="stilled-strip"/g)).toHaveLength(3);
    expect(html).toContain('Stilled · waits for your song');
    expect(html).toContain('data-testid="note-callout"');
    expect(html).toContain('Note 4/8 · Clutch Chime');
    expect(html).toContain('The Coda in 34 s');
  });

  it('a downed frame promises the song; at eight notes the stave, tint and freeze are gone', () => {
    const downed = hudHtml('stilled-downed');
    expect(downed).toContain('The song will bring them back');
    const back = hudHtml('silence-8');
    expect(back).toContain('Note 8/8 · The song returns!');
    expect(back).not.toContain('data-testid="silence-tint"');
    expect(back).not.toContain('data-testid="stilled-strip"');
    expect(back).not.toContain('data-testid="boss-silence"');
    useSettings.getState().reset();
  });
});

describe('the sighting card follows the Calling and Reel’s variant', () => {
  const conductor = (rewinds: boolean, paradox: boolean, reel: string | null) =>
    sightingOf(CONDUCTOR, rewinds, paradox, reel);

  it('the Conductor’s card names the notes this Weaver can play', () => {
    const plain = conductor(false, false, null);
    expect(plain.lesson).toContain('Perfect Wards, Clutch Chimes and Reel-saves are heard');
    expect(plain.answers).toEqual(['focus', 'crescendo', 'ward', 'chime', 'reel']);
    const chrono = conductor(true, false, null);
    expect(chrono.lesson).toContain('a Rewind that undoes a blow');
    expect(chrono.lesson).not.toContain('Reel');
    expect(chrono.answers).not.toContain('reel');
    const anchor = conductor(false, false, 'anchor');
    expect(anchor.lesson).toContain('only your Perfect Wards and Clutch Chimes are heard');
    expect(anchor.answers).not.toContain('reel');
    expect(conductor(false, false, 'swap').lesson).toContain('Swap takes the blow on you');
  });

  it('each voice teaches its Solo’s verb; a Chronomancer card never teaches Reel', () => {
    expect(sightingOf(ALTO).lesson).toMatch(/Lament marks a hero\. Chime it away/);
    expect(sightingOf(BASS).lesson).toMatch(/Ward on the beat/);
    expect(sightingOf(SOPRANO).lesson).toMatch(/Scatter so it catches one/);
    expect(sightingOf(TENOR).lesson).toMatch(/Reel them out/);
    expect(sightingOf(TENOR, true).lesson).toMatch(/Rewind them back out/);
    expect(sightingOf(TENOR, true).lesson).not.toMatch(/Reel/);
    expect(sightingOf(TENOR, true, true).lesson).toMatch(/Paradox cancels it/);
    expect(sightingOf(TENOR, false, false, 'anchor').lesson).toMatch(/Anchor holds them/);
    expect(sightingOf(TENOR, false, false, 'swap').lesson).toMatch(/Swap takes the blow on you/);
  });

  it('a voice’s card waits for its first Cue; every other foe’s shows as it appears', () => {
    expect(sightingFoes([CONDUCTOR, ALTO, BASS], null)).toEqual([CONDUCTOR]);
    expect(sightingFoes([CONDUCTOR, ALTO, BASS], 'Mirror Bass')).toEqual([CONDUCTOR, BASS]);
    expect(sightingFoes(['shears', 'hollow_chorister'], null)).toEqual([
      'shears',
      'hollow_chorister',
    ]);
    expect(sightingFoes(undefined, null)).toBeUndefined();
  });

  it('no earlier foe’s card changes', () => {
    for (const e of CONTENT.enemies.filter((x) => (x.movement ?? 1) < 4))
      for (const reel of [null, 'anchor', 'swap'])
        expect(sightingOf(e.id, false, false, reel), e.id).toEqual(sightingOf(e.id));
  });
});

describe('hints, recaps and callouts', () => {
  it('the three Finale hints, each hidden by Blind Score', () => {
    const ids = (s: FinaleScenario) => evaluateHints(fighting(finaleHud(s))).map((h) => h.id);
    expect(ids('cue')).toContain('discord');
    expect(ids('fortissimo')).toContain('fortissimo');
    expect(ids('silence-0')).toContain('silence');
    for (const id of ['discord', 'fortissimo', 'silence']) expect(ANSWER_HINTS.has(id)).toBe(true);
    const silence = evaluateHints(fighting(finaleHud('silence-0'))).find((h) => h.id === 'silence');
    expect(silence?.text).toMatch(/Eight notes bring your heroes back — even the fallen/);
    const fort = evaluateHints(fighting(finaleHud('fortissimo'))).find(
      (h) => h.id === 'fortissimo',
    );
    expect(fort?.text).toMatch(/your Crescendo \{.+\} cancels it/);
  });

  it('every Finale down names an answer; no earlier death gets a Finale line', () => {
    const killers = [
      LAMENT,
      BASSO_OSTINATO,
      CADENZA,
      SHATTER_ARIA,
      DOWNBEAT,
      SFORZANDO,
      ...FORTISSIMO,
      REST,
      MEASURE,
      FINAL_CADENCE,
      HALF_CADENCE,
    ].map((id) => CONTENT.attacks.find((a) => a.id === id)!.name);
    // The voices' basic blows, and the Conductor's own melee (no telegraph answers it).
    for (const voice of [ALTO, BASS, TENOR, SOPRANO, CONDUCTOR])
      killers.push(CONTENT.enemies.find((e) => e.id === voice)!.name);
    for (const killer of killers) {
      const line = finaleDownLine({ killer });
      expect(line, killer).toMatch(/: /);
      expect(
        deathAdviceLine({ heroId: 'lyra', killer, answers: [] }, ['kael', 'lyra', 'vexis']),
      ).toBe(line);
    }
    expect(
      finaleDownLine(
        { killer: CONTENT.attacks.find((a) => a.id === CADENZA)!.name },
        'chronomancer',
      ),
    ).toMatch(/Rewind/);
    for (const a of CONTENT.attacks.filter((x) => !killers.includes(x.name)))
      expect(finaleDownLine({ killer: a.name }), a.id).toBeNull();
    for (const e of CONTENT.enemies.filter((x) => (x.movement ?? 1) < 4))
      expect(finaleDownLine({ killer: e.name }), e.id).toBeNull();
  });

  it('notes, the song’s return, the Coda and a cancelled Fortissimo Silence', () => {
    const at = { time: 0 };
    const ev = (e: Record<string, unknown>) => ({ ...at, ...e }) as unknown as SimEvent;
    const names = (id: number) => ['Kael', 'Lyra', 'Vexis'][id] ?? null;
    expect(noteCallout(3, 8, 'perfect').callout.text).toBe('Note 3/8 · Perfect Ward');
    expect(noteCallout(8, 8, 'reel').callout.text).toBe('Note 8/8 · The song returns!');
    expect(
      finaleCallouts(ev({ type: 'silenceNote', n: 2, of: 8, source: 'rewind', hero: null }), names),
    ).toHaveLength(1);
    expect(
      finaleCallouts(ev({ type: 'reignited', boss: 9, revived: [1] }), names)[0]!.callout.text,
    ).toBe('Lyra stands again');
    expect(
      finaleCallouts(ev({ type: 'silenceBroken', boss: 9, notes: 5 }), names)[0]!.callout.text,
    ).toBe('The Coda — your heroes wake without the song');
    expect(
      finaleCallouts(ev({ type: 'fortissimoCancelled', boss: 9, by: 'crescendo' }), names)[0]!
        .callout.text,
    ).toBe('Fortissimo Silence — cancelled');
    expect(
      finaleCallouts(ev({ type: 'fortissimoCancelled', boss: 9, by: 'phase' }), names),
    ).toEqual([]);
    expect(finaleCallouts(ev({ type: 'perfectWard', target: 0 }), names)).toEqual([]);
  });

  it('captions say the key sounds in words, and nothing else', () => {
    const ev = (e: Record<string, unknown>) => ({ time: 0, ...e }) as unknown as SimEvent;
    expect(finaleCaption(ev({ type: 'silenceBegan', boss: 9, until: 50 }))).toBe('The music stops');
    expect(
      finaleCaption(ev({ type: 'silenceNote', n: 3, of: 8, source: 'perfect', hero: 0 })),
    ).toBe('Note 3 of 8 · Perfect Ward');
    expect(
      finaleCaption(ev({ type: 'discordRose', boss: 9, telegraph: 1, amount: 8, value: 40 })),
    ).toBe('Discord rises');
    expect(finaleCaption(ev({ type: 'reignited', boss: 9, revived: [] }))).toBe('The song returns');
    expect(finaleCaption(ev({ type: 'perfectWard', target: 0 }))).toBeNull();
    expect(captionCallout('The music stops').callout.text).toBe('[The music stops]');
  });

  it('the defeat callout: the Conductor’s silence holds; elsewhere the song falls silent', () => {
    expect(defeatLine(CONDUCTOR)).toBe(finaleDefeatLine());
    expect(defeatLine('the_unweaver')).toBe(plainDefeatLine());
    expect(plainDefeatLine()).toBe('The song falls silent…');
  });

  it('the Calling- and variant-aware note sources', () => {
    expect(noteSources()).toBe('Perfect Wards, Clutch Chimes and Reel-saves');
    expect(noteSources({ rewinds: true })).toMatch(/Rewind that undoes a blow/);
    expect(noteSources({ reel: 'anchor' })).toBe('Perfect Wards and Clutch Chimes');
  });
});

describe('the route, the map and the ending', () => {
  it('the Crucible’s look, the baton, the Unweaver’s spoils and the Finale’s victory line', () => {
    expect(biomeTone('celestial_crucible')).toBe('crucible');
    expect(movementCardLook(4).button).toBe('Ascend');
    expect(encounterIcon(CONDUCTOR)).toBe('baton');
    expect(bossSpoils('the_unweaver').giftBlurb).toBe(
      'The Rift knits shut, and the sky above rings white-gold. Take something epic.',
    );
    expect(movementCard(4, 4).text).toBe('The Celestial Crucible: 1 stop to the Silent Conductor.');
    const won = finaleSummaryRun('victory');
    expect(finaleCleared(won)).toBe(true);
    expect(outcomeSub(won)).toBe('The Silent Conductor lowers its baton, and the song goes on.');
    expect(outcomeSub(finaleSummaryRun('defeat'))).toMatch(
      /lost in the Finale, in the Celestial Crucible/,
    );
    // The Finale route's map: the Unweaver leads on; the Conductor is the one stop ahead.
    const arrive = finaleRun('arrive');
    const unweaver = arrive.map.rows.flat().find((n) => n.encounterId === 'the_unweaver')!;
    expect(unweaver.next.length).toBeGreaterThan(0);
  });

  it('the Prelude’s strings and an I-III win are unchanged', () => {
    expect(titleEyebrow(false)).toBe('Movement I · The Prelude');
    expect(routeHint('prelude')).toBe('Movement I alone, to The Hollow Cantor.');
    expect(outcomeSub(riftSummaryRun('victory'))).toBe(
      'The Unweaver falls, and the Rift knits shut.',
    );
  });

  it('the epilogue is under 20 s, skippable, and answered by the party’s first hero', () => {
    const lines = epilogueLines(['lyra', 'kael', 'vexis']);
    expect(lines).toHaveLength(5);
    expect(lines[2]).toMatchObject({ speaker: 'Lyra', text: 'You never asked if we were tired.' });
    expect(epilogueLines(['brann', 'kael', 'lyra'])[2]!.text).toBe(
      'Rest? I’ve only just got loud.',
    );
    expect(epilogueMs(lines.length)).toBeLessThanOrEqual(20_000);
    for (const key of ['Escape', 'Enter', ' ']) expect(EPILOGUE_SKIP_KEYS.has(key)).toBe(true);
    const html = renderToStaticMarkup(
      createElement(EpilogueView, {
        party: ['kael', 'lyra', 'vexis'],
        onDone: () => {},
        still: true,
      }),
    );
    expect(html).toContain('data-testid="epilogue-skip"');
    expect(html).toContain('aria-label="Skip the epilogue"');
    expect(html.match(/data-testid="epilogue-line"/g)).toHaveLength(5);
    expect(Number(/data-ms="(\d+)"/.exec(html)![1])).toBeLessThanOrEqual(20_000);
  });

  it('the Summary: the song goes on, the epilogue and the first-clear card; never on an I-III win', () => {
    const won = finaleSummaryRun('victory');
    expect(won.deeds).toContain(SONG_GOES_ON);
    const html = renderToStaticMarkup(
      createElement(SummaryView, {
        run: won,
        onNewRun: () => {},
        onLoom: () => {},
        dissonanceOpen: false,
        epilogueStill: true,
      }),
    );
    expect(html).toContain('The song goes on');
    expect(html).toContain('data-testid="epilogue"');
    expect(html).toContain('The Song Goes On — your first Finale clear');
    expect(html).toContain('Dissonance opens with a Finale clear at Weaver Rank 15 or above');
    // Phase 6: only what content doesn't hold yet is "coming later" (the Atlas is built; True
    // Dissonance arrives with its level), and every line the card shows is in the page.
    for (const l of firstClearLines(false).lines.slice(1)) expect(html).toContain(l);
    expect(html).not.toContain('Coming later: the Atlas of Echoes');
    expect(firstClearLines(true).lines[0]).toBe('Dissonance is open');
    const rift = renderToStaticMarkup(
      createElement(SummaryView, {
        run: riftSummaryRun('victory'),
        onNewRun: () => {},
        onLoom: () => {},
        epilogueStill: true,
      }),
    );
    expect(rift).toContain('The silence is broken');
    expect(rift).not.toContain('data-testid="epilogue"');
    expect(rift).not.toContain('data-testid="first-clear"');
  });
});

describe('captions setting', () => {
  it('defaults off, and settings saved before it load with it off', () => {
    expect(DEFAULT_SETTINGS.captions).toBe(false);
    const saved = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as Record<string, unknown>;
    delete saved.captions;
    expect(migrateSettings(saved)?.captions).toBe(false);
    expect(migrateSettings({ ...saved, captions: true })?.captions).toBe(true);
  });
});

// ── Review fixes (the verification of W8) ───────────────────────────────────────────────

describe('review fixes', () => {
  it('the Conductor’s own melee names an answer in the recap, Calling-aware', () => {
    const killer = CONTENT.enemies.find((e) => e.id === CONDUCTOR)!.name;
    expect(killer).toBe('The Silent Conductor');
    const line = finaleDownLine({ killer });
    expect(line).toMatch(/^The Conductor’s baton: keep the tank Warded and Mended, or Reel/);
    expect(
      deathAdviceLine({ heroId: 'kael', killer, answers: [] }, ['kael', 'lyra', 'vexis']),
    ).toBe(line);
    expect(finaleDownLine({ killer }, 'chronomancer')).toMatch(/Rewind the blow$/);
  });

  it('the epilogue leaves a dialog’s keys alone', () => {
    const press = (over: Record<string, unknown> = {}) => ({
      key: 'Enter',
      repeat: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      defaultPrevented: false,
      target: null,
      ...over,
    });
    expect(epilogueTakesKey(press())).toBe(true);
    expect(epilogueTakesKey(press({ key: 'Escape' }))).toBe(true);
    expect(epilogueTakesKey(press({ key: 'a' }))).toBe(false);
    expect(epilogueTakesKey(press({ repeat: true }))).toBe(false);
    expect(epilogueTakesKey(press({ defaultPrevented: true }))).toBe(false);
    // A dialog the player opened over the Summary: Enter, Space and Escape are the dialog's.
    const inDialog = { closest: (sel: string) => (sel.includes('dialog') ? {} : null) };
    for (const key of ['Enter', ' ', 'Escape'])
      expect(epilogueTakesKey(press({ key, target: inDialog })), key).toBe(false);
    expect(epilogueTakesKey(press({ target: { closest: () => null } }))).toBe(true);
  });

  it('no Summary card covers the epilogue: the Rank-up and Bond cards wait until it ends', () => {
    // The order: nothing while the epilogue is up (or a skip key is still held as it closes),
    // then the Weaver's Rank-up card, then the Bond card.
    const o = { waiting: false, rankUps: 1, rankCard: true, bondNotices: 1 };
    expect(summaryCard({ ...o, waiting: true })).toBeNull();
    expect(summaryCard({ ...o, waiting: true, rankUps: 0 })).toBeNull();
    expect(summaryCard(o)).toBe('rank');
    expect(summaryCard({ ...o, rankUps: 0 })).toBe('bond');
    expect(summaryCard({ ...o, rankCard: false })).toBeNull();
    expect(summaryCard({ ...o, rankUps: 0, bondNotices: 0 })).toBeNull();

    const run = finaleSummaryRun('victory');
    const bonds = mockBonds(2);
    const bondCard = {
      notices: [{ heroId: run.party[0]!.heroId, rank: 2 }],
      bonds,
      first: true,
      unlockAll: false,
      onDismiss: () => {},
    };
    const summary = (rankUps: boolean, epilogueStill: boolean) =>
      renderToStaticMarkup(
        createElement(SummaryView, {
          run,
          onNewRun: () => {},
          onLoom: () => {},
          bonds,
          bondCard,
          epilogueStill,
          ...(rankUps ? { rankUps: mockRankUps([5]), onDismissRankUps: () => {} } : {}),
        }),
      );
    // The epilogue is up (a Finale victory): no card, no dialog, and its Skip is uncovered.
    for (const rankUps of [true, false]) {
      const html = summary(rankUps, true);
      expect(html).toContain('data-testid="epilogue-skip"');
      expect(html).not.toContain('data-testid="rank-up"');
      expect(html).not.toContain('data-testid="bond-rank-up"');
      expect(html).not.toContain('role="dialog"');
    }
    // Once it has ended or been skipped (closing marks the run's seed seen, so a Summary shown
    // again has no epilogue): the cards, the Rank-up first, then the Bond card.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    try {
      expect(summary(false, false)).toContain('data-testid="epilogue"');
      markEpilogueSeen(run.seed);
      const ranked = summary(true, false);
      expect(ranked).not.toContain('data-testid="epilogue"');
      expect(ranked).toContain('data-testid="rank-up"');
      expect(ranked).not.toContain('data-testid="bond-rank-up"');
      const bonded = summary(false, false);
      expect(bonded).not.toContain('data-testid="epilogue"');
      expect(bonded).toContain('data-testid="bond-rank-up"');
    } finally {
      vi.unstubAllGlobals();
    }
    // The Summary decides which card shows from the epilogue's state, and holds them for a skip
    // key still held as it closed (the node test build renders no effects, so this reads the
    // source).
    const src = readFileSync(
      new URL('../src/ui/screens/SummaryScreen.tsx', import.meta.url),
      'utf8',
    );
    expect(src).toMatch(/waiting: epilogueOn \|\| keyHeld,/);
    expect(src).toMatch(/setKeyHeld\(skipKeyDown\(\)\);\s*setEpilogue\(false\);/);
  });

  it('a voice killed before its Cue is still recorded as seen (the Codex unlocks it)', () => {
    const tenor = CONTENT.enemies.find((e) => e.id === TENOR)!.name;
    // The Tenor joins, uncued: its card waits, nothing recorded yet.
    let step = settleHeldVoices([], [CONDUCTOR, TENOR, ALTO], null);
    expect(step).toEqual({ held: [TENOR, ALTO], record: [] });
    // The Alto is Cued: its card shows (sightingFoes), it is no longer held.
    step = settleHeldVoices(step.held, [CONDUCTOR, TENOR, ALTO], 'Mirror Alto');
    expect(step).toEqual({ held: [TENOR], record: [] });
    expect(sightingFoes([CONDUCTOR, TENOR, ALTO], 'Mirror Alto')).toEqual([CONDUCTOR, ALTO]);
    // The Tenor is burst down before the Conductor ever Cues it: recorded without a card.
    step = settleHeldVoices(step.held, [CONDUCTOR, ALTO], null);
    expect(step).toEqual({ held: [ALTO], record: [TENOR] });
    // A voice Cued as it leaves gets its card instead (it is in the foes this time).
    expect(settleHeldVoices([TENOR], [TENOR], tenor)).toEqual({ held: [], record: [] });
    // The fight ends (or the choir shatters at the silence) with voices still waiting.
    expect(settleHeldVoices([ALTO, BASS], undefined, null)).toEqual({
      held: [],
      record: [ALTO, BASS],
    });
    // Every other fight holds nothing back, so nothing is recorded this way.
    expect(settleHeldVoices([], ['vharun', 'mirror_champion'], null)).toEqual({
      held: [],
      record: [],
    });
  });

  it('Reignite relights the frames gold for a moment, the revived ones rising', () => {
    const at = 0;
    const ev = (e: Record<string, unknown>) => ({ time: at, ...e }) as unknown as SimEvent;
    expect(heardReignite([ev({ type: 'silenceBroken', boss: 9, notes: 5 })], 10)).toBeNull();
    const sim = createSim({ seed: 7, encounter: CONDUCTOR });
    for (let i = 0; i < 120; i++) sim.step([]);
    const world = worldOf(sim);
    const lyra = world.party[1]!;
    const heard = heardReignite([ev({ type: 'reignited', boss: 9, revived: [lyra] })], world.time);
    expect(heard).toEqual({ at: world.time, revived: [lyra] });
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null, reignited: heard });
    expect(hud.party.map((h) => h.reignite)).toEqual(['relit', 'risen', 'relit']);
    // Without one heard, or once its moment has passed, the frames are as before.
    for (const h of buildHudSnapshot(sim.state, { seed: 7, hovered: null }).party)
      expect(h).not.toHaveProperty('reignite');
    const late = { ...heard!, at: world.time - REIGNITE_GLOW_S - 0.1 };
    for (const h of buildHudSnapshot(sim.state, { seed: 7, hovered: null, reignited: late }).party)
      expect(h).not.toHaveProperty('reignite');
    // On screen, with no sound and Flashes at 0: relit gold, and the risen frame says so.
    const lab = finaleHud('silence-8');
    const html = renderToStaticMarkup(
      createElement(HudView, {
        hud: lab,
        callouts: finaleMockCallouts('silence-8'),
        decree: null,
        keyHints: false,
        coach: false,
      }),
    );
    expect(html.match(/data-testid="reignite-strip"/g)).toHaveLength(3);
    expect(html).toContain('Relit · the song returns');
    expect(html).toContain('Risen · the song brought them back');
    expect(html.match(/data-reignite="risen"/g)?.length).toBeGreaterThanOrEqual(1);
    // Earlier fights' frames never carry it.
    const rift = snapshot('the_unweaver', 300);
    for (const h of rift.party) expect(h).not.toHaveProperty('reignite');
  });

  it('the Directive wheel greys every spoke with “Frozen” in the silence, and only then', async () => {
    const { DirectiveWheelView, frozenHint } = await tsx<{
      DirectiveWheelView: FunctionComponent<Props>;
      frozenHint: () => string;
    }>('../src/ui/hud/DirectiveWheel');
    const FROZEN_HINT = frozenHint();
    const wheel = { x: 200, y: 200, dx: 0, dy: -60, via: 'key', focusTarget: 4, spoke: 'focus' };
    const frozen = renderToStaticMarkup(createElement(DirectiveWheelView, { wheel, frozen: true }));
    expect(frozen).toContain('data-frozen="true"');
    expect(frozen.match(new RegExp(FROZEN_HINT, 'g'))).toHaveLength(4);
    expect(frozen.match(/aria-disabled="true"/g)).toHaveLength(4);
    const open = renderToStaticMarkup(createElement(DirectiveWheelView, { wheel }));
    expect(open).not.toContain('data-frozen');
    expect(open).not.toContain(FROZEN_HINT);
    expect(open.match(/aria-disabled="true"/g)).toBeNull();
  });

  it('the Crucible’s Movement card opens with its line; earlier cards have none', () => {
    expect(movementLore(4)).toBe(
      'Above the Rift the sky rings like a struck bell. Someone is conducting it.',
    );
    for (const n of [1, 2, 3]) expect(movementLore(n), String(n)).toBeNull();
    // The stops line is as W3 pinned it.
    expect(movementCard(4).text).toBe('The Celestial Crucible: 1 stop to the Silent Conductor.');
  });
});
