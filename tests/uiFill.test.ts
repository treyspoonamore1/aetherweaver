/**
 * Phase 5g, the fill on screen (docs/phase-5g.md, W8): the 18 relic, 6 event and 2 boon glyphs
 * (bound now, by the doc's ids); every fill relic, boon and event shows its glyph and its text
 * from content, the Codex lists every fill entry, and a Harmony's prerequisites read on its card
 * (bound once the fill's content is in `CONTENT`: the loops over `FILL_IDS` are empty before);
 * the trigger chips, the Result's and Summary's trigger lines, the HUD's relic pulses and
 * once-a-fight tiles, the HUD's Cue price through `cueCostNow`, and the lab's fill group.
 */
import { createElement, type FunctionComponent, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT, boonText, motifText, relicCurse, relicText, type Content } from '../src/content';
import { FILL_IDS } from '../src/content/fill';
import { createSim, cueCostNow } from '../src/sim';
import type { Mods } from '../src/sim/mods';
import type { RunState } from '../src/meta/types';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { relicHuds } from '../src/ui/hud/relics';
import {
  CATEGORY_ICON,
  TRIGGER_CHIPS_MAX,
  TRIGGER_CHIP_SECONDS,
  stepTriggerChips,
  triggerChipText,
  triggerSentence,
  triggerSource,
  triggerTallies,
  type TriggerChip,
  type TriggerSource,
} from '../src/ui/hud/triggers';
import { FILL_GLYPHS, PATHS, glyphKey } from '../src/ui/kit/iconPaths';
import { FIXTURE_TRIGGERS, fillFixtureContent } from '../src/ui/lab/fillFixture';
import { boonInfo, gainLines, relicInfo } from '../src/ui/screens/interlude';
import { statLines, triggerLines } from '../src/ui/screens/resultText';
import {
  harmonyHint,
  harmonyLeads,
  harmonyNeeds,
  harmonyPrereqs,
} from '../src/ui/screens/rosterModel';
import { useUi } from '../src/ui/store';
import { worldOf } from './sim/helpers';

/**
 * Opening Bars and Tempo Rubato are W3's (`src/sim/fill/finale.ts`, a neutral stub in this tree):
 * here `cueCostCut` does what its doc comment asks, so the HUD's read of `cueCostNow` is tested on
 * a real cut.
 */
vi.mock('../src/sim/fill/finale', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return {
    ...real,
    cueCostCut: (state: { mods: Mods; ledger: { cues: number } }, cost: number): number => {
      const n = state.ledger.cues;
      if (state.mods.freeCueEvery > 0 && (n + 1) % state.mods.freeCueEvery === 0) return 0;
      return n === 0 ? Math.max(0, cost - state.mods.firstCueCut) : cost;
    },
  };
});

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
  useUi.setState({ callouts: [] });
});

/** The .tsx kit, lab and HUD modules, at run time, typed as these tests read them. */
interface GlyphKit {
  GLYPHS: Readonly<Record<string, string>>;
  glyphPath(icon: string): string;
  RELIC_RARITY: Readonly<Record<string, { color: string }>>;
}
interface FillLab {
  harmonyLabRun(missing: boolean): RunState;
  labTriggerChips(seconds: number): TriggerChip[];
  FILL_VIEWS: { id: string; group: string; render(): ReactNode }[];
  FILL_RELIC_GLYPHS: readonly string[];
  FILL_EVENT_GLYPHS: readonly string[];
  FILL_BOON_GLYPHS: readonly string[];
}
async function tsx<T>(path: string): Promise<T> {
  return (await import(/* @vite-ignore */ path)) as T;
}
const glyphKit = () => tsx<GlyphKit>('../src/ui/kit/RelicGlyph');
const fillLab = () => tsx<FillLab>('../src/ui/lab/fillLab');

/** A .tsx module's export, at run time (the node test build has no JSX to import statically). */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

// ── The doc's ids (docs/phase-5g.md, the fill's tables) ─────────────────────────────

const DOC_RELICS = [
  'pilgrims_lamp',
  'tin_whistle',
  'black_ribbon',
  'pedlars_ledger',
  'spare_strings',
  'echoing_shell',
  'lament_pin',
  'sand_glass',
  'prompt_book',
  'thornwreath',
  'bell_clapper',
  'menders_needle',
  'everbell',
  'heartwood_lute',
  'water_clock',
  'iron_mask',
  'red_ink',
  'hollow_crown',
];
const DOC_EVENTS = [
  'heros_doubt',
  'quartermaster',
  'bleeding_bell',
  'lost_weavers_echo',
  'unravelled_tapestry',
  'stopped_clock',
];
const DOC_BOONS = ['steadied', 'faltering'];
/** The doc's Harmonies and what each needs (hero, motifs, aura). */
const DOC_HARMONIES: Record<string, { hero?: string; motifs: string[]; aura?: string }> = {
  woven_aegis: { motifs: ['warded_weft', 'lingering_aegis'] },
  cutting_chorus: { motifs: ['razor_silk'], aura: 'fortissimo' },
  guardians_cadence: { hero: 'kael', motifs: ['iron_answer', 'riposte_bloom'] },
  spindle_lullaby: { motifs: ['razor_silk'], aura: 'lullaby' },
  tempo_rubato: { motifs: ['canon', 'opening_bars'] },
  concert_pitch: { motifs: ['steady_hands', 'thread_the_needle'] },
  grand_staff: { motifs: ['golden_filament', 'call_and_response'] },
  crossed_steel: { hero: 'seren', motifs: ['en_garde', 'second_intention'] },
  wounded_healer: { motifs: ['kindred_wound', 'saving_grace'] },
  closed_circle: { motifs: ['massed_voices', 'close_harmony'] },
};

const fill = <T extends { id: string }>(xs: readonly T[]): T[] =>
  xs.filter((x) => FILL_IDS.includes(x.id));
const PATH_SYNTAX = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/;
const DIAMOND = 'M12 3l7 9-7 9-7-9z';

describe('the fill’s glyphs (bound now, by the doc’s ids)', () => {
  const all = [...DOC_RELICS, ...DOC_EVENTS, ...DOC_BOONS];

  it('has exactly the doc’s 18 relics, 6 events and 2 boons', () => {
    expect(DOC_RELICS).toHaveLength(18);
    expect(DOC_EVENTS).toHaveLength(6);
    expect(Object.keys(FILL_GLYPHS).sort()).toEqual([...all].sort());
  });

  it('each is a stroked 24×24 path, its own, in the kit’s path syntax', async () => {
    const { GLYPHS, glyphPath } = await glyphKit();
    const existing = new Set([...Object.values(GLYPHS), ...Object.values(PATHS)]);
    const seen = new Set<string>();
    for (const id of all) {
      const d = FILL_GLYPHS[id]!;
      expect(d, id).toMatch(PATH_SYNTAX);
      expect(d.startsWith('M'), id).toBe(true);
      for (const n of d.match(/-?\d*\.?\d+/g) ?? []) {
        expect(Math.abs(Number(n)), `${id} ${n}`).toBeLessThanOrEqual(24);
      }
      expect(existing.has(d), `${id} copies an existing glyph`).toBe(false);
      expect(seen.has(d), `${id} repeats a fill glyph`).toBe(false);
      seen.add(d);
      // No fill id shadows an existing glyph key; each draws as itself.
      expect(GLYPHS[id], id).toBeUndefined();
      expect(glyphPath(id)).toBe(d);
    }
  });

  it('glyphKey picks the entry’s own glyph by id, else its content icon', () => {
    for (const id of all) expect(glyphKey({ id, icon: 'loom' })).toBe(id);
    for (const r of CONTENT.relics) if (!FILL_IDS.includes(r.id)) expect(glyphKey(r)).toBe(r.icon);
  });

  it('every relic, boon and event in content draws a real glyph (never the diamond)', async () => {
    const { glyphPath } = await glyphKit();
    for (const r of CONTENT.relics) expect(glyphPath(relicInfo(r.id).icon), r.id).not.toBe(DIAMOND);
    for (const b of CONTENT.boons)
      expect(glyphPath(boonInfo({ id: b.id, fights: b.fights }).icon), b.id).not.toBe(DIAMOND);
    for (const e of CONTENT.events) expect(glyphPath(glyphKey(e)), e.id).not.toBe(DIAMOND);
  });
});

describe('fill entries read from content (bound once the fill merges)', () => {
  it('every fill relic, boon and event the doc names has its glyph', () => {
    for (const r of fill(CONTENT.relics)) {
      expect(DOC_RELICS, r.id).toContain(r.id);
      expect(relicInfo(r.id).icon).toBe(r.id);
    }
    for (const b of fill(CONTENT.boons)) {
      expect(DOC_BOONS, b.id).toContain(b.id);
      expect(boonInfo({ id: b.id, fights: b.fights }).icon).toBe(b.id);
    }
    for (const e of fill(CONTENT.events)) {
      expect(DOC_EVENTS, e.id).toContain(e.id);
      expect(glyphKey(e)).toBe(e.id);
    }
  });

  it('texts take their numbers from values: nothing left unfilled, the values in the words', () => {
    for (const r of fill(CONTENT.relics)) {
      const info = relicInfo(r.id);
      expect(info.rule, r.id).toBe(relicText(r));
      expect(info.rule, r.id).not.toMatch(/\{/);
      if (r.curse) expect(info.curse, r.id).toBe(relicCurse(r));
      for (const [k, v] of Object.entries(r.values))
        if (r.text.includes(`{${k}}`)) expect(info.rule, `${r.id}.${k}`).toContain(String(v));
      if (r.empowered) {
        const emp = relicInfo(r.id, false, { empowered: true }).rule;
        for (const [k, v] of Object.entries(r.empowered.values))
          if (r.text.includes(`{${k}}`)) expect(emp, `${r.id} empowered ${k}`).toContain(String(v));
      }
    }
    for (const b of fill(CONTENT.boons)) {
      expect(boonInfo({ id: b.id, fights: b.fights }).text).toBe(boonText(b));
      expect(boonText(b)).not.toMatch(/\{/);
    }
    for (const m of fill(CONTENT.motifs))
      m.values.forEach((v, i) => {
        const t = motifText(m, i + 1);
        expect(t, m.id).not.toMatch(/\{v\}/);
        expect(t, m.id).toContain(String(v));
      });
  });

  it('a boon an event gives reads with its glyph and its text', () => {
    const run = { chords: [], party: [] };
    for (const b of CONTENT.boons) {
      const lines = gainLines(
        {
          relics: [],
          boons: [b.id],
          aether: 0,
          heal: 0,
          hurt: 0,
          before: [],
          motif: null,
          lostMotif: null,
          retuned: false,
        } as unknown as Parameters<typeof gainLines>[0],
        run,
      );
      expect(lines[0]!.glyph).toBe(glyphKey(b));
      expect(lines[0]!.text).toContain(boonText(b));
    }
  });
});

describe('the Codex lists every motif, Harmony, relic, boon and event', () => {
  type CodexProps = {
    onBack(): void;
    initialTab: string;
    roster?: readonly string[];
  };
  async function codex(tab: string): Promise<string> {
    const CodexView = await component<CodexProps>('../src/ui/screens/CodexScreen', 'CodexView');
    return renderToStaticMarkup(
      createElement(CodexView, {
        onBack: () => {},
        initialTab: tab,
        roster: CONTENT.heroes.map((h) => h.id),
      }),
    );
  }

  it('motifs: each by id with its text at every level; a Harmony names what it needs', async () => {
    const html = await codex('motifs');
    for (const m of CONTENT.motifs) {
      expect(html, m.id).toContain(`data-motif="${m.id}"`);
      expect(html, m.id).toContain(motifText(m, m.values.length));
    }
    const harmonies = CONTENT.motifs.filter((m) => m.requires.motifs);
    expect(harmonies.length).toBeGreaterThanOrEqual(1);
    expect(html.split('data-testid="codex-harmony"').length - 1).toBe(harmonies.length);
    for (const h of harmonies)
      expect(html).toContain(`needs ${harmonyNeeds(h.id).join(' + ')}`.replace(/&/g, '&amp;'));
    for (const m of fill(CONTENT.motifs)) expect(m.requires.expedition).toBe(true);
    if (fill(CONTENT.motifs).length > 0) expect(html).toContain('Expeditions only');
  });

  it('relics, boons and events: each by id', async () => {
    const relics = await codex('relics');
    for (const r of CONTENT.relics) expect(relics, r.id).toContain(`data-relic="${r.id}"`);
    const events = await codex('events');
    for (const e of CONTENT.events) expect(events, e.id).toContain(`data-event="${e.id}"`);
    for (const b of CONTENT.boons) expect(events, b.id).toContain(`data-boon="${b.id}"`);
  });
});

describe('a draft offering a Harmony shows its prerequisites', () => {
  it('Blood and Silk: Brann, then its two motifs, each owned or missing', () => {
    const have = { motifs: [{ id: 'blood_tithe' }], party: ['kael', 'brann', 'lyra'] };
    expect(harmonyPrereqs('blood_and_silk', have)).toEqual([
      { kind: 'hero', id: 'brann', text: 'Brann in your party', owned: true },
      { kind: 'motif', id: 'blood_tithe', text: 'Blood Tithe', owned: true },
      { kind: 'motif', id: 'taut_release', text: 'Taut Release', owned: false },
    ]);
    expect(harmonyPrereqs('blood_tithe', have)).toEqual([]);
  });

  it('a prerequisite’s card names every Harmony it leads to; the old hint reads as before', () => {
    const party = ['kael', 'brann', 'lyra'];
    expect(harmonyHint('blood_tithe', party)).toBe('Harmony: with Taut Release → Blood and Silk');
    const leads = harmonyLeads('blood_tithe', party, { motifs: [{ id: 'taut_release' }], party });
    expect(leads.map((l) => l.harmony.id)).toEqual(['blood_and_silk']);
    expect(leads[0]!.others).toEqual([
      { kind: 'motif', id: 'taut_release', text: 'Taut Release', owned: true },
    ]);
    expect(harmonyLeads('blood_tithe', CONTENT.defaultParty)).toEqual([]);
  });

  it('the card lists them, ticked or crossed, and its label says so', async () => {
    const { harmonyLabRun } = await fillLab();
    const DraftView = await component<{ run: unknown; onPick(): void; onReroll(): void }>(
      '../src/ui/screens/DraftScreen',
      'DraftView',
    );
    const missing = harmonyLabRun(true);
    const h = missing.draft!.options[0]!.motifId;
    const html = renderToStaticMarkup(
      createElement(DraftView, { run: missing, onPick: () => {}, onReroll: () => {} }),
    );
    expect(html).toContain('data-testid="harmony-needs"');
    expect(html).toContain('data-owned="true"');
    expect(html).toContain('data-owned="false"');
    expect(html).toContain('(missing)');
    // The second prerequisite is offered beside it, and names the Harmony it leads to.
    expect(html).toContain(`data-harmony="${h}"`);
    const full = renderToStaticMarkup(
      createElement(DraftView, { run: harmonyLabRun(false), onPick: () => {}, onReroll: () => {} }),
    );
    expect(full).toContain('data-testid="harmony-needs"');
    expect(full).not.toContain('data-owned="false"');
  });

  it('every fill Harmony lists the doc’s prerequisites (bound once W5 merges)', () => {
    for (const h of fill(CONTENT.motifs).filter((m) => m.requires.motifs)) {
      const doc = DOC_HARMONIES[h.id];
      expect(doc, h.id).toBeDefined();
      const needs = harmonyPrereqs(h.id, { motifs: [], party: [], chords: [] });
      expect(needs.filter((n) => n.kind === 'motif').map((n) => n.id)).toEqual(doc!.motifs);
      expect(needs.find((n) => n.kind === 'hero')?.id).toBe(doc!.hero);
      expect(needs.find((n) => n.kind === 'aura')?.id).toBe(doc!.aura);
      expect(needs.every((n) => !n.owned)).toBe(true);
      for (const id of doc!.motifs)
        expect(
          harmonyLeads(
            id,
            CONTENT.heroes.map((x) => x.id),
          ).map((l) => l.harmony.id),
          `${id} → ${h.id}`,
        ).toContain(h.id);
    }
  });
});

describe('motifTriggered on the HUD: chips, one a source, rate-limited', () => {
  const content = fillFixtureContent();
  const step = (
    chips: readonly TriggerChip[],
    prev: Record<string, number> | null,
    next: Record<string, number> | null,
    now: number,
  ) => stepTriggerChips(chips, prev, next, now, content);

  it('names a source from content (fixture before the merge), motifs before relics before boons', () => {
    expect(triggerSource('clean_strike', content)).toMatchObject({
      name: 'Clean Strike',
      kind: 'motif',
      category: 'aegis',
    });
    expect(triggerSource('echoing_shell', content)).toMatchObject({
      kind: 'relic',
      rarity: 'rare',
    });
    expect(triggerSource('faltering', content)).toMatchObject({ kind: 'boon', bane: true });
    expect(triggerSource('no_such_entry', content)).toBeNull();
  });

  it('a rise makes a chip; a source firing again while it shows counts up on the same chip', () => {
    let chips = step([], { clean_strike: 0 }, { clean_strike: 1 }, 10);
    expect(chips.map(triggerChipText)).toEqual(['Clean Strike']);
    // Every tick for a second: still one chip.
    let prev = 1;
    for (let t = 10 + 1 / 60; t < 11; t += 1 / 60) {
      chips = step(chips, { clean_strike: prev }, { clean_strike: prev + 1 }, t);
      prev++;
    }
    expect(chips).toHaveLength(1);
    expect(chips[0]!.count).toBe(prev);
    expect(chips[0]!.since).toBe(10);
  });

  it('goes after its time without fires; nothing on the first snapshot, unknown ids or a fall', () => {
    const chips = step([], { clean_strike: 0 }, { clean_strike: 2 }, 5);
    expect(step(chips, { clean_strike: 2 }, { clean_strike: 2 }, 5 + TRIGGER_CHIP_SECONDS)).toEqual(
      [],
    );
    expect(step([], null, { clean_strike: 3 }, 5)).toEqual([]);
    expect(step([], { mystery: 0 }, { mystery: 4 }, 5)).toEqual([]);
    expect(step([], { clean_strike: 9 }, { clean_strike: 0 }, 5)).toEqual([]);
  });

  it('shows at most three, newest first', () => {
    const ids = Object.keys(FIXTURE_TRIGGERS);
    let chips: TriggerChip[] = [];
    ids.forEach((id, i) => {
      chips = step(chips, { [id]: 0 }, { [id]: 1 }, 1 + i * 0.1);
    });
    expect(chips).toHaveLength(TRIGGER_CHIPS_MAX);
    expect(chips.map((c) => c.source.id)).toEqual(ids.slice(-TRIGGER_CHIPS_MAX).reverse());
  });

  it('draws its glyph beside its name in an existing colour (no new colour)', async () => {
    const { CATEGORY } = await tsx<{
      CATEGORY: Readonly<Record<string, { icon: string; color: string }>>;
    }>('../src/ui/kit/Chip');
    const { RELIC_RARITY } = await glyphKit();
    const { triggerColor } = await tsx<{ triggerColor(s: TriggerSource): string }>(
      '../src/ui/hud/TriggerChips',
    );
    for (const [cat, look] of Object.entries(CATEGORY))
      expect(CATEGORY_ICON[cat as keyof typeof CATEGORY_ICON]).toBe(look.icon);
    const known = new Set<string>([
      ...Object.values(CATEGORY).map((c) => c.color),
      ...Object.values(RELIC_RARITY).map((r) => r.color),
      '#86efac',
      '#fb7185',
    ]);
    for (const id of Object.keys(FIXTURE_TRIGGERS))
      expect(known.has(triggerColor(triggerSource(id, content)!)), id).toBe(true);
  });

  it('the HUD draws them under the relic bar', async () => {
    const { labTriggerChips } = await fillLab();
    const { mockHud, mockCallouts } = await import('../src/ui/lab/mock');
    const HudView = await component<Record<string, unknown>>('../src/ui/hud/Hud', 'HudView');
    const hud = mockHud('calm');
    const html = renderToStaticMarkup(
      createElement(HudView, {
        hud,
        callouts: mockCallouts('calm'),
        decree: null,
        triggerChips: labTriggerChips(hud.seconds),
      }),
    );
    expect(html).toContain('data-testid="trigger-chips"');
    expect(html).toContain('Clean Strike ×3');
    const plain = renderToStaticMarkup(createElement(HudView, { hud, callouts: [], decree: null }));
    expect(plain).not.toContain('trigger-chips');
  });

  it('the snapshot carries the ledger’s counts only while a trigger is held', () => {
    const sim = createSim({ seed: 3, encounter: 'first_light' });
    expect('triggers' in buildHudSnapshot(sim.state, { seed: 3, hovered: null })).toBe(false);
    worldOf(sim).ledger.triggers = { clean_strike: 2 };
    expect(buildHudSnapshot(sim.state, { seed: 3, hovered: null }).triggers).toEqual({
      clean_strike: 2,
    });
  });
});

describe('the Result and the Summary: "X triggered N times"', () => {
  const content = fillFixtureContent();

  it('one line a source, named from content, a silent one muted', () => {
    const lines = triggerLines({ triggers: { ...FIXTURE_TRIGGERS } }, content);
    expect(lines.map((l) => l.text)).toEqual([
      'Clean Strike triggered 7 times.',
      'Tender Guard triggered once.',
      'Saving Grace never triggered.',
      'Echoing Shell triggered 4 times.',
      'Red Ink triggered 7 times.',
    ]);
    expect(lines.map((l) => l.icon)).toEqual(['ward', 'ward', 'sparkle', 'relic', 'relic']);
    expect(lines[2]!.muted).toBe(true);
    expect(triggerSentence({ source: triggerSource('clean_strike', content)!, count: 1200 })).toBe(
      'Clean Strike triggered 1,200 times.',
    );
    expect(triggerTallies(undefined)).toEqual([]);
  });

  it('a fight without triggers reads as before; ids content doesn’t know are left out', async () => {
    const { resultRun } = await import('../src/ui/lab/mock');
    const r = resultRun(true).lastResult!;
    const before = statLines(r);
    expect(r.stats.triggers).toBeUndefined();
    const unknown = statLines({ ...r, stats: { ...r.stats, triggers: { no_such_entry: 3 } } });
    expect(unknown).toEqual(before);
  });

  it('every fill trigger names itself on the Result and the Summary (bound once the fill merges)', async () => {
    const triggered = [
      ...fill(CONTENT.motifs),
      ...fill(CONTENT.relics),
      ...fill(CONTENT.boons),
    ].filter((x) => (x as { triggers?: unknown }).triggers);
    if (triggered.length === 0) return;
    const { resultRun } = await import('../src/ui/lab/mock');
    const run = resultRun(true);
    const r = run.lastResult!;
    const triggers = Object.fromEntries(triggered.map((x, i) => [x.id, i + 2]));
    const lines = statLines({ ...r, stats: { ...r.stats, triggers } }).map((l) => l.text);
    triggered.forEach((x, i) =>
      expect(lines).toContain(
        `${(x as unknown as { name: string }).name} triggered ${i + 2} times.`,
      ),
    );
    const SummaryView = await component<Record<string, unknown>>(
      '../src/ui/screens/SummaryScreen',
      'SummaryView',
    );
    const result = { ...r, stats: { ...r.stats, triggers } };
    const html = renderToStaticMarkup(
      createElement(SummaryView, {
        run: {
          ...run,
          phase: 'summary',
          outcome: 'victory',
          results: [result],
          lastResult: result,
        },
        onNewRun: () => {},
        onLoom: () => {},
      }),
    );
    expect(html).toContain('data-testid="summary-triggers"');
  });
});

describe('the relic bar: trigger relics pulse, once-a-fight relics show spent', () => {
  const base = {
    relics: {
      ids: ['cantors_hymnal'],
      cleansed: [],
      metronomeAt: null,
      thimbleAt: null,
      veil: true,
    },
    time: 5,
    ledger: { perfects: 0, downs: 0 },
  };

  it('a relic the sim doesn’t count itself pulses on its trigger fires', () => {
    expect(relicHuds(base)[0]!.pulse).toBe(0);
    const hud = relicHuds({ ...base, ledger: { ...base.ledger, triggers: { cantors_hymnal: 3 } } });
    expect(hud[0]!.pulse).toBe(3);
  });

  it('a once-a-fight relic reads ready, then spent', () => {
    expect(relicHuds({ ...base, once: { cantors_hymnal: true } })[0]).toMatchObject({
      kind: 'once',
      ready: true,
    });
    expect(relicHuds({ ...base, once: { cantors_hymnal: false } })[0]).toMatchObject({
      kind: 'once',
      ready: false,
      label: expect.stringContaining('spent this fight'),
    });
    // Without the key (every existing relic as the bridge passes it), as before.
    expect(relicHuds({ ...base, once: { spare_strings: true } })[0]!.kind).toBe('passive');
  });

  it('Spare Strings and the Water Clock are once-a-fight tiles (bound once W6 merges)', () => {
    for (const id of ['spare_strings', 'water_clock']) {
      if (!CONTENT.relics.some((r) => r.id === id)) continue;
      const sim = createSim({ seed: 3, encounter: 'first_light' });
      worldOf(sim).relics.ids = [id];
      const tile = buildHudSnapshot(sim.state, { seed: 3, hovered: null }).relics[0]!;
      expect(tile, id).toMatchObject({ id, kind: 'once', ready: true });
    }
  });
});

describe('the Cue’s price on the HUD is the sim’s (cueCostNow), for every Calling', () => {
  function staged(mods: Partial<Mods>, cues = 0) {
    const sim = createSim({ seed: 3, encounter: 'first_light' });
    const world = worldOf(sim) as unknown as { mods: Mods; ledger: { cues: number } };
    world.mods = { ...world.mods, ...mods };
    world.ledger.cues = cues;
    return sim;
  }
  const shown = (sim: ReturnType<typeof createSim>) =>
    buildHudSnapshot(sim.state, { seed: 3, hovered: null }).weaver.cueCost;

  it('without the fill’s entries it is the fight’s cost, as before', () => {
    const sim = staged({});
    expect(shown(sim)).toBe(sim.state.dissonance.cueCost);
    expect(shown(sim)).toBe(cueCostNow(sim.state));
  });

  it('Opening Bars: the first Cue of the fight shows its cut', () => {
    const first = staged({ firstCueCut: 10 });
    expect(shown(first)).toBe(first.state.dissonance.cueCost - 10);
    expect(shown(first)).toBe(cueCostNow(first.state));
    const later = staged({ firstCueCut: 10 }, 1);
    expect(shown(later)).toBe(later.state.dissonance.cueCost);
  });

  it('Tempo Rubato: the free Cue shows free', () => {
    const free = staged({ freeCueEvery: 3 }, 2);
    expect(shown(free)).toBe(0);
    const paid = staged({ freeCueEvery: 3 }, 1);
    expect(shown(paid)).toBe(paid.state.dissonance.cueCost);
  });

  it('the hint and the meter read the same price', async () => {
    const sim = staged({ firstCueCut: 10 });
    const hud = buildHudSnapshot(sim.state, { seed: 3, hovered: null });
    const WeaverBar = await component<Record<string, unknown>>(
      '../src/ui/hud/WeaverBar',
      'WeaverBar',
    );
    const html = renderToStaticMarkup(createElement(WeaverBar, { hud }));
    expect(html).toContain(`data-cue-cost="${sim.state.dissonance.cueCost - 10}"`);
  });
});

describe('the UI lab’s fill group', () => {
  it('every view renders', async () => {
    const { FILL_VIEWS, FILL_RELIC_GLYPHS, FILL_EVENT_GLYPHS, FILL_BOON_GLYPHS } = await fillLab();
    expect(FILL_RELIC_GLYPHS).toEqual(DOC_RELICS);
    expect(FILL_EVENT_GLYPHS).toEqual(DOC_EVENTS);
    expect(FILL_BOON_GLYPHS).toEqual(DOC_BOONS);
    expect(new Set(FILL_VIEWS.map((v) => v.group))).toEqual(new Set(['Fill (5g)']));
    for (const v of FILL_VIEWS) {
      const html = renderToStaticMarkup(createElement(() => v.render() as never));
      expect(html.length, v.id).toBeGreaterThan(100);
    }
  });

  it('its fixture parses as content and gives way to content’s own entries', () => {
    const c = fillFixtureContent() as Pick<Content, 'motifs' | 'relics' | 'boons'>;
    for (const list of [c.motifs, c.relics, c.boons]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    for (const r of CONTENT.relics) expect(c.relics.find((x) => x.id === r.id)).toBe(r);
  });
});
