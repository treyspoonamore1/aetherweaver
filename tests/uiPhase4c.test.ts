/**
 * Phase 4c UI: the Reliquary (docs/phase-4c.md, docs/phase-4c/ui.md). The screen's previews,
 * outcomes, carry and attunement, the Summary's enshrine panel, Prep's row, the run's marks and the
 * Codex's page are pure models over content (`inscriptionText`, `curseText`, `relicText`,
 * `CONTENT.reliquary`) and meta (`craftOdds`, `craftBlocked`, `fractureChance`, `releaseValue`,
 * `carriedRelics`, `enshrineOptions`); the carry and the enshrine flow also run through the real
 * stores. Every number is checked against the function it comes from, so the content's tuning
 * can't leave the screen behind.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { COLOR_VISIONS, deltaE, simulateVision } from '../src/app/colorVision';
import {
  CONTENT,
  INSCRIPTION_CATEGORIES,
  curseText,
  inscriptionDef,
  inscriptionText,
  relicDef,
  relicText,
  relicValues,
  type InscriptionCategory,
  type InscriptionDef,
} from '../src/content';
import { RANK_XP, UNLOCKS, rankOf } from '../src/meta/profile';
import {
  carriedRelics,
  carrySlots,
  chooseCarry,
  craftBlocked,
  craftOdds,
  empowered,
  fractureChance,
  releaseValue,
  reliquaryOpen,
  retune,
  runMaterials,
  type CraftAction,
  type Reliquary,
  type ReliquaryRelic,
} from '../src/meta/reliquary';
import * as Run from '../src/meta/run';
import type { EncounterResult, OwnedRelic } from '../src/meta/types';
import { relicHuds } from '../src/ui/hud/relics';
import { PATHS } from '../src/ui/kit/iconPaths';
import { CONSTELLATION_LOOK } from '../src/ui/kit/astrolabeLook';
import {
  CARRIED_LOOK,
  CATEGORY_LOOK,
  DISSONANCE_LOOK,
  FRACTURED_LOOK,
  SHARD_LOOK,
  TEAR_LOOK,
  TIER_LOOK,
} from '../src/ui/kit/reliquaryLook';
import {
  EMPTY_RELIQUARY,
  dissonated,
  fullReliquary,
  mockCraft,
  mockInscription,
  mockRelic,
  partwayReliquary,
} from '../src/ui/lab/mock';
import { ownedRelicInfo, relicInfo, relicSentence } from '../src/ui/screens/interlude';
import { rankPanel, unlockIcon } from '../src/ui/screens/rankText';
import {
  ACTIONS,
  DISSONANCE_KINDS,
  DORMANT_LINE,
  ROLE_LINE,
  attuneChange,
  carriedSnapshot,
  carryChange,
  carryLine,
  carryPlace,
  carrySlotViews,
  categoryOptions,
  codexEmpowered,
  codexInscriptions,
  craftPreview,
  defaultArg,
  dissonateChances,
  enshrineChoices,
  enshrineStage,
  fractureExamples,
  inscriptionOptions,
  inscriptionRow,
  instabilityView,
  materialsBadge,
  materialsHow,
  num,
  oddsText,
  outcomeView,
  paidLine,
  rangeText,
  releaseView,
  relicView,
  reliquaryUnlockLine,
  retuneChances,
  shardsText,
  tearsText,
  tierRange,
  tierValues,
  unitOf,
  valueText,
} from '../src/ui/screens/reliquaryModel';

const RULES = CONTENT.reliquary;
const NORMAL = CONTENT.inscriptions.filter((d) => d.kind === 'normal');
const DISSONANT = CONTENT.inscriptions.filter((d) => d.kind === 'dissonant');
/** Instabilities around the threshold and at the top. */
const INSTABILITIES = [0, RULES.fracture.above, RULES.fracture.above + 1, 44, 47, 60, 74, 100];

/** A Reliquary holding these relics, with these materials. */
function holding(relics: ReliquaryRelic[], shards = 999, tears = 9): Reliquary {
  return { relics, shards, tears, carry: [], seed: 7, next: relics.length + 1 };
}

/** Every relic of content, each with one Inscription of each category at a tier and some Instability. */
function sampleRelics(): ReliquaryRelic[] {
  const out: ReliquaryRelic[] = [];
  CONTENT.relics.forEach((def, i) => {
    INSTABILITIES.forEach((instability, j) => {
      const tier = 5 - ((i + j) % 3);
      const picks = INSCRIPTION_CATEGORIES.map(
        (c, k) => NORMAL.filter((d) => d.category === c)[(i + j + k) % 2] ?? NORMAL[0]!,
      ).slice(0, 1 + ((i + j) % RULES.maxInscriptions));
      out.push(
        mockRelic(
          `r${i}-${j}`,
          def.id,
          picks.map((d, k) => [d.id, Math.max(RULES.tierCap, tier - (k % 2)), (k * 0.37) % 1]),
          { instability },
        ),
      );
    });
  });
  return out;
}

const skipUnlocks = (on: boolean) =>
  useSettings.getState().update((s) => ({ ...s, unlockAll: on }));
const run = () => useRun.getState().run!;
const reliquary = () => useProfile.getState().profile.reliquary;

/** Puts relics straight into the profile's Reliquary, with materials. */
function stock(relics: ReliquaryRelic[], carry: string[] = [], shards = 100, tears = 2): void {
  const p = useProfile.getState().profile;
  useProfile.setState({
    profile: {
      ...p,
      reliquary: { ...p.reliquary, relics, carry, next: relics.length + 1, shards, tears },
    },
  });
}

/** Ends the run in place (its last fight the boss, won or lost), with these relics found. */
function endRun(won: boolean, found: OwnedRelic[] = []): void {
  const fights = [
    { kind: 'skirmish', outcome: 'victory', grade: 'B' },
    { kind: 'elite', outcome: 'victory', grade: 'A' },
    { kind: 'boss', outcome: won ? 'victory' : 'defeat', grade: 'S' },
  ] as EncounterResult[];
  const r = run();
  useRun.setState({
    run: {
      ...r,
      phase: 'result',
      pending: null,
      outcome: won ? null : 'defeat',
      relics: [...r.relics, ...found],
      results: fights,
    },
  });
  useRun.getState().continueFromResult();
}

/** WCAG contrast of two colours (#rrggbb). */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** `color-mix(in srgb, a share, b)`, as the badges and chips draw their backgrounds. */
function mix(a: string, share: number, b: string): string {
  const ch = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [ch(a), ch(b)];
  return `#${x
    .map((v, i) => Math.round(v * share + y[i]! * (1 - share)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

const INK_900 = '#0a1022';
const INK_800 = '#111a33';

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.setState({ run: null });
});

describe('numbers come from content', () => {
  it('shows chances honestly, to a tenth of a percent', () => {
    expect(oddsText(0.6)).toBe('60%');
    expect(oddsText(0.105)).toBe('10.5%');
    expect(oddsText(1 / 3)).toBe('33.3%');
    expect(oddsText(fractureChance(RULES.fracture.above + 1))).toBe(
      `${Math.round(RULES.fracture.perPoint * 10) / 10}%`,
    );
    expect(num(0.1 + 0.2)).toBe('0.3');
    expect(shardsText(1)).toBe('1 Tuning Shard');
    expect(tearsText(2)).toBe('2 Discord Tears');
  });

  it('reads every Inscription’s unit, tiers and steps from content', () => {
    for (const def of NORMAL) {
      if (def.kind !== 'normal') continue;
      const after = def.text.split('{v}')[1]!;
      const unit = unitOf(def);
      // The unit is what follows the value in its own text (none for a count).
      if (unit) expect(after.startsWith(unit)).toBe(true);
      else expect(after).not.toMatch(/^(%| m\b| s\b)/);
      for (let tier = 5; tier >= 1; tier--) {
        const [min, max] = def.tiers[5 - tier]!;
        expect(tierRange(def, tier)).toEqual([min, max]);
        expect(rangeText(def, tier)).toBe(
          min === max ? `${num(min)}${unit}` : `${num(min)}–${num(max)}${unit}`,
        );
        const values = tierValues(def, tier);
        expect(values[0]).toBe(min);
        expect(values.at(-1)).toBe(max);
        expect(values.length).toBe(Math.round((max - min) / def.step) + 1);
        expect(valueText(def, min)).toBe(`${num(min)}${unit}`);
      }
    }
  });

  it('Retune lands exactly on the values the screen lists, each as likely', () => {
    for (const def of NORMAL) {
      for (const tier of [5, 4, 3]) {
        const values = tierValues(def, tier);
        if (values.length < 2) continue;
        const relic = mockRelic('r1', 'tuning_fork', [[def.id, tier, 0]]);
        const seen = new Map<number, number>();
        for (let seed = 1; seed <= 600; seed++) {
          const res = retune({ ...holding([relic]), seed }, 'r1', 0);
          if (!res.ok || res.outcome.kind !== 'retuned') continue;
          seen.set(res.outcome.to, (seen.get(res.outcome.to) ?? 0) + 1);
        }
        expect([...seen.keys()].sort((a, b) => a - b)).toEqual(values);
        for (const n of seen.values()) expect(n / 600).toBeGreaterThan(0.5 / values.length);
        // The chances add up, and the lowest value can't roll lower.
        const chances = retuneChances(relic.inscriptions[0]!);
        expect(chances.reduce((s, c) => s + c.p, 0)).toBeCloseTo(1, 9);
        expect(chances.find((c) => c.key === 'lower')!.p).toBe(0);
        expect(chances.find((c) => c.key === 'higher')!.p).toBeCloseTo(
          (values.length - 1) / values.length,
          9,
        );
      }
    }
  });

  it('a relic reads as content writes it: its effect, curse, Inscriptions and Dissonance', () => {
    const rq = fullReliquary();
    for (const r of rq.relics) {
      const v = relicView(r);
      const def = relicDef(r.id);
      expect(v.text).toBe(relicText(def, empowered(r)));
      expect(v.wasText).toBe(empowered(r) ? relicText(def) : null);
      v.inscriptions.forEach((row, i) => {
        const ins = r.inscriptions[i]!;
        expect(row.text).toBe(inscriptionText(inscriptionDef(ins.id), ins.value));
        expect(row.tierLabel).toBe(`T${ins.tier}`);
        expect(row.rangeText).toBe(rangeText(inscriptionDef(ins.id), ins.tier));
        expect(row.within).toBeGreaterThanOrEqual(0);
        expect(row.within).toBeLessThanOrEqual(1);
      });
      if (r.dissonance?.kind === 'dissonant')
        expect(v.dissonant!.text).toBe(inscriptionText(inscriptionDef(r.dissonance.inscription!)));
      if (r.dissonance?.kind === 'cursed') {
        const curse = CONTENT.curses.find((c) => c.id === r.dissonance!.curse)!;
        expect(v.curse!.text).toBe(curseText(curse));
      }
      expect(v.fracture).toBe(fractureChance(r.instability));
      expect(v.release).toBe(releaseValue(r));
      expect(v.max).toBe(RULES.maxInscriptions);
      expect(v.craftable).toBe(!r.fractured && r.dissonance === null);
      expect(v.label).toContain(v.name);
    }
  });

  it('Instability: the bar’s threshold and every Fracture line are the meta’s', () => {
    for (const value of INSTABILITIES) {
      const relic = mockRelic('r1', 'prism_loom', [], { instability: value });
      const v = instabilityView(relic, Math.min(100, value + RULES.inscribe.instability));
      expect(v.above).toBe(RULES.fracture.above);
      expect(v.fracture).toBe(fractureChance(value));
      expect(v.fractureAfter).toBe(
        fractureChance(Math.min(100, value + RULES.inscribe.instability)),
      );
      if (v.fracture > 0) expect(v.fractureLine).toContain(oddsText(v.fracture));
      else expect(v.fractureLine).toContain(String(RULES.fracture.above));
    }
    for (const e of fractureExamples()) expect(e.p).toBe(fractureChance(e.at));
  });
});

describe('every preview is craftOdds’ and craftBlocked’s', () => {
  it('cost, odds, Fracture chance, Instability after and the reason, for every craft', () => {
    let checked = 0;
    const relics = sampleRelics();
    for (const r of relics) {
      for (const materials of [
        { shards: 999, tears: 9 },
        { shards: 0, tears: 0 },
      ]) {
        const rq = holding([r], materials.shards, materials.tears);
        const args: [CraftAction, number | InscriptionCategory | undefined][] = [
          ...INSCRIPTION_CATEGORIES.map(
            (c) => ['inscribe', c] as [CraftAction, InscriptionCategory],
          ),
          ...r.inscriptions.flatMap((_, i) => [
            ['retune', i] as [CraftAction, number],
            ['ascend', i] as [CraftAction, number],
          ]),
          ['dissonate', undefined],
        ];
        for (const [action, arg] of args) {
          const p = craftPreview(rq, r, action, arg);
          const odds = craftOdds(r, action, typeof arg === 'number' ? arg : undefined);
          expect(p.odds).toEqual(odds);
          expect(p.cost).toEqual({ shards: odds.shards, tears: odds.tears });
          expect(p.blocked).toBe(craftBlocked(rq, r, action, arg));
          expect(p.instability).toEqual({ from: r.instability, to: odds.instability });
          expect(p.nextFracture).toBe(fractureChance(odds.instability));
          expect(p.fractureText).toBe(action === 'dissonate' ? 'none' : oddsText(odds.fracture));
          expect(p.canPay).toBe(rq.shards >= odds.shards && rq.tears >= odds.tears);
          if (action === 'inscribe') {
            const tiers = (odds.tiers ?? [])
              .map((q, i) => ({ q, tier: 5 - i }))
              .filter((t) => t.q > 0);
            expect(p.chances.map((c) => [c.label, c.p, c.text])).toEqual(
              tiers.map((t) => [`T${t.tier}`, t.q, oddsText(t.q)]),
            );
          } else if (action === 'ascend') {
            expect(p.chances[0]!.p).toBe(odds.success);
            expect(p.chances[0]!.text).toBe(oddsText(odds.success!));
            expect(p.chances[1]!.p).toBeCloseTo(1 - odds.success!, 12);
          } else if (action === 'dissonate') {
            expect(Object.fromEntries(p.chances.map((c) => [c.key, c.p]))).toEqual(odds.outcomes);
          }
          // A refused craft sounds short of materials only when plenty would make it.
          if (p.blocked)
            expect(p.blockSound).toBe(
              craftBlocked(holding([r]), r, action, arg) === null ? 'cantAfford' : 'error',
            );
          // The Fracture comes first: the overall odds add up, and match the meta's.
          if (p.overall) {
            expect(p.overall.reduce((sum, o) => sum + o.p, 0)).toBeCloseTo(1, 12);
            expect(p.overall.at(-1)!.p).toBe(odds.fracture);
            if (action === 'ascend')
              expect(p.overall[0]!.p).toBeCloseTo((1 - odds.fracture) * odds.success!, 12);
          } else expect(action === 'dissonate' || odds.fracture === 0).toBe(true);
          // What's at stake names the Fracture chance when there is one.
          if (action !== 'dissonate' && odds.fracture > 0)
            expect(p.stakes.join(' ')).toContain(oddsText(odds.fracture));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('Inscribe’s kinds: one it can’t take is disabled with the meta’s reason, the rest open', () => {
    // Silver Thimble in the lab holds every Choir Inscription.
    const rq = partwayReliquary();
    const thimble = rq.relics.find((r) => r.uid === 'r3')!;
    const options = categoryOptions(rq, thimble);
    expect(options.map((o) => o.category)).toEqual([...INSCRIPTION_CATEGORIES]);
    for (const o of options) {
      const left = NORMAL.filter(
        (d) => d.category === o.category && !thimble.inscriptions.some((i) => i.id === d.id),
      );
      expect(o.left).toEqual(left.map((d) => d.name));
      expect(o.blocked).toBe(
        left.length === 0
          ? craftBlocked(holding([thimble]), thimble, 'inscribe', o.category)
          : null,
      );
    }
    expect(options.find((o) => o.category === 'choir')!.blocked).not.toBeNull();
    // A relic at its last Inscription is refused as a whole (at the button), not kind by kind.
    const full = mockRelic(
      'r1',
      'prism_loom',
      NORMAL.slice(0, RULES.maxInscriptions).map((d) => [d.id, 5]),
    );
    expect(categoryOptions(holding([full]), full).every((o) => o.blocked === null)).toBe(true);
    expect(craftPreview(holding([full]), full, 'inscribe', 'weaver').blocked).toBe(
      craftBlocked(holding([full]), full, 'inscribe', 'weaver'),
    );
  });

  it('Ascend: T2 and T1 wait for Dissonance; Retune: a tier of one value is refused', () => {
    const fixed = NORMAL.find((d) => d.kind === 'normal' && d.tiers[0]![0] === d.tiers[0]![1])!;
    const relic = mockRelic('r1', 'prism_loom', [
      [NORMAL[0]!.id, RULES.tierCap],
      [NORMAL[1]!.id, 5],
      [fixed.id, 5],
    ]);
    const rq = holding([relic]);
    const ascend = inscriptionOptions(rq, relic, 'ascend');
    expect(ascend[0]!.blocked).toBe(craftBlocked(rq, relic, 'ascend', 0));
    expect(ascend[0]!.blocked).toContain(`T${RULES.tierCap - 1}`);
    expect(ascend[1]!.blocked).toBeNull();
    expect(ascend[1]!.p).toBe(craftOdds(relic, 'ascend', 1).success);
    expect(ascend[1]!.to).toBe(4);
    const tune = inscriptionOptions(rq, relic, 'retune');
    expect(tune[2]!.blocked).toBe(craftBlocked(rq, relic, 'retune', 2));
    expect(tune[1]!.blocked).toBeNull();
    // The first choice worth previewing skips the refused ones.
    expect(defaultArg(rq, relic, 'ascend')).toBe(1);
    expect(defaultArg(rq, relic, 'retune')).toBe(0);
  });

  it('a fractured or Dissonated relic stays as it is, in the meta’s words', () => {
    for (const r of fullReliquary().relics.filter((x) => x.fractured || x.dissonance)) {
      const v = relicView(r);
      expect(v.craftable).toBe(false);
      expect(v.frozen).toBe(craftBlocked(holding([r]), r, 'inscribe', 'silk'));
      expect(v.state!.label).toBe(
        r.fractured ? FRACTURED_LOOK.label : DISSONANCE_LOOK[r.dissonance!.kind].label,
      );
    }
  });

  it('Dissonate’s four outcomes for each relic, and what a relic with nothing to grow does', () => {
    for (const def of CONTENT.relics) {
      const r = mockRelic('r1', def.id);
      const chances = dissonateChances(r);
      expect(chances.map((c) => c.key)).toEqual([...DISSONANCE_KINDS]);
      expect(Object.fromEntries(chances.map((c) => [c.key, c.p]))).toEqual(
        craftOdds(r, 'dissonate').outcomes,
      );
      const emp = chances.find((c) => c.key === 'empowered')!;
      if (def.empowered) expect(emp.detail).toContain(relicText(def, true));
      else expect(emp.p).toBe(0);
    }
  });

  it('Release: the shards are releaseValue’s, broken down by content', () => {
    for (const r of fullReliquary().relics) {
      const v = releaseView(r);
      expect(v.total).toBe(releaseValue(r));
      expect(v.base).toBe(RULES.release[relicDef(r.id).rarity]);
      expect(v.base + v.per * v.count).toBe(v.total);
      expect(v.line).toContain(shardsText(v.total));
    }
  });
});

describe('after a craft', () => {
  const rq = partwayReliquary();

  it('each outcome says what happened, with its sound and effect (real crafts)', () => {
    const fine = mockCraft(
      rq,
      'r2',
      'inscribe',
      'aegis',
      (o) => o.kind === 'inscribed' && o.inscription.tier <= RULES.tierCap,
    );
    const plain = mockCraft(
      rq,
      'r2',
      'inscribe',
      'aegis',
      (o) => o.kind === 'inscribed' && o.inscription.tier > RULES.tierCap,
    );
    for (const made of [fine, plain]) {
      const o = made.record.outcome;
      if (o.kind !== 'inscribed') throw new Error('not inscribed');
      const v = outcomeView(made.record);
      const fineOne = o.inscription.tier <= RULES.tierCap;
      expect(v.sound).toBe(fineOne ? 'inscribeFine' : 'inscribe');
      expect(v.effect).toBe(fineOne ? 'etchFine' : 'etch');
      expect(v.title).toContain(inscriptionDef(o.inscription.id).name);
      expect(v.lines[0]).toBe(
        inscriptionText(inscriptionDef(o.inscription.id), o.inscription.value),
      );
      expect(v.target).toBe(made.record.after.inscriptions.length - 1);
      expect(v.announce).toContain(v.title);
    }
    const tuned = mockCraft(rq, 'r3', 'retune', 0, (o) => o.kind === 'retuned' && o.to > o.from);
    expect(outcomeView(tuned.record)).toMatchObject({
      sound: 'retune',
      effect: 'tune',
      target: 0,
      tone: 'good',
    });
    const rose = mockCraft(rq, 'r2', 'ascend', 0, (o) => o.kind === 'ascended');
    expect(outcomeView(rose.record)).toMatchObject({ sound: 'ascend', effect: 'rise', target: 0 });
    const missed = mockCraft(rq, 'r1', 'ascend', 0, (o) => o.kind === 'missed');
    const mv = outcomeView(missed.record);
    expect(mv).toMatchObject({ sound: 'ascendMiss', effect: 'miss', tone: 'bad' });
    expect(mv.lines[0]).toContain(String(missed.record.after.instability));
    const cracked = mockCraft(rq, 'r1', 'inscribe', 'bond', (o) => o.kind === 'fractured');
    const fv = outcomeView(cracked.record);
    expect(fv).toMatchObject({ sound: 'fracture', effect: 'crack', target: null });
    expect(fv.lines[0]).toContain(shardsText(RULES.inscribe.cost));
    expect(cracked.record.after.fractured).toBe(true);
  });

  it('a Dissonate reveals each of its outcomes with its own sound', () => {
    const sounds = {
      dissonant: 'dissonant',
      empowered: 'empowered',
      cursed: 'cursedRelic',
      shattered: 'shattered',
    } as const;
    for (const kind of DISSONANCE_KINDS) {
      const made = mockCraft(rq, 'r1', 'dissonate', undefined, dissonated(kind));
      const v = outcomeView(made.record);
      expect(v.kind).toBe(kind);
      expect(v.sound).toBe(sounds[kind]);
      const d = made.record.after.dissonance!;
      if (kind === 'dissonant')
        expect(v.lines[0]).toBe(inscriptionText(inscriptionDef(d.inscription!)));
      if (kind === 'empowered') expect(v.lines[0]).toBe(relicText(relicDef('prism_loom'), true));
      if (kind === 'cursed') {
        const curse = CONTENT.curses.find((c) => c.id === d.curse)!;
        expect(v.title).toContain(curse.name);
        expect(v.lines.at(-1)).toContain(curseText(curse));
        // Each rise it lists is the relic's own, before and after.
        const rose = made.record.after.inscriptions.filter(
          (ins, i) => ins.tier !== made.record.before.inscriptions[i]!.tier,
        );
        expect(v.lines.length - 1).toBe(rose.length);
        for (const ins of rose) expect(v.lines.join(' ')).toContain(`→ T${ins.tier}`);
        expect(
          Math.min(...made.record.after.inscriptions.map((i) => i.tier)),
        ).toBeGreaterThanOrEqual(RULES.dissonate.cursedTierCap);
      }
    }
  });
});

describe('the carry and attunement', () => {
  const twin = fullReliquary(); // r2 and r10 are both Cantor's Hymnal; r2 is carried

  it('shows a slot per Rank that opens one, the first attuned, the locked ones with their Rank', () => {
    for (const rank of [10, 14, 15, 19, 20]) {
      const slots = carrySlots(rank);
      const views = carrySlotViews([], slots);
      expect(views.map((s) => s.rank)).toEqual(RULES.slotRanks);
      expect(views.filter((s) => s.open)).toHaveLength(slots);
      for (const s of views) {
        expect(s.role).toBe(s.index === 0 ? 'attuned' : 'lends');
        expect(s.lockLine).toBe(s.open ? null : `Opens at Rank ${s.rank}`);
      }
    }
    expect(ROLE_LINE.attuned).toContain('own effect');
    expect(ROLE_LINE.lends).toContain('sleeps');
    expect(carryLine(1, 2)).toBe('Carrying 1 of 2');
  });

  it('never two of the same relic, never past the slots: the screen says why first', () => {
    const slots = 3;
    const same = carryChange(twin, 'r10', slots);
    expect('problem' in same && same.problem).toContain(relicDef('cantors_hymnal').name);
    // The store would refuse it too (it keeps the first of a pair).
    expect(chooseCarry(twin, [...twin.carry, 'r10'], slots).carry).toEqual(twin.carry);
    const full = carryChange(twin, 'r4', slots);
    expect('problem' in full && full.problem).toContain('full');
    const fewer = carryChange(partwayReliquary(), 'r4', 2);
    expect('problem' in fewer && fewer.problem).toContain(`Rank ${RULES.slotRanks[2]}`);
    // Taking one out, and putting one in where there's room.
    expect(carryChange(twin, 'r7', slots)).toEqual({ uids: ['r1', 'r2'], adding: false });
    expect(carryChange(partwayReliquary(), 'r4', 3)).toEqual({
      uids: ['r1', 'r2', 'r4'],
      adding: true,
    });
  });

  it('attuning moves a relic to the first slot; the store and the run follow', () => {
    skipUnlocks(true);
    stock(partwayReliquary().relics, ['r1', 'r2']);
    useRun.getState().newRun(5);
    expect(run().relics.map((r) => [r.id, !!r.dormant])).toEqual([
      ['prism_loom', false],
      ['cantors_hymnal', true],
    ]);
    const change = attuneChange(reliquary(), 'r2', useProfile.getState().carrySlots());
    if ('problem' in change) throw new Error(change.problem);
    expect(change.uids).toEqual(['r2', 'r1']);
    useProfile.getState().setCarry(change.uids);
    expect(reliquary().carry).toEqual(['r2', 'r1']);
    expect(carryPlace(reliquary(), 'r2', 3)).toEqual({ index: 0, role: 'attuned' });
    expect(carryPlace(reliquary(), 'r1', 3)).toEqual({ index: 1, role: 'lends' });
    // Prep's run follows: the Hymnal attuned, the Loom dormant (it lends its Inscriptions).
    expect(run().carried.map((r) => r.uid)).toEqual(['r2', 'r1']);
    expect(run().relics.map((r) => [r.id, !!r.dormant])).toEqual([
      ['cantors_hymnal', false],
      ['prism_loom', true],
    ]);
    // Every carry the screen asks for is one the store keeps as it is.
    for (const uid of ['r3', 'r4', 'r5', 'r6']) {
      const c = carryChange(reliquary(), uid, 3);
      if ('problem' in c) continue;
      useProfile.getState().setCarry(c.uids);
      expect(reliquary().carry).toEqual(c.uids);
    }
    // A relic not carried, attuned straight away when there's room.
    useProfile.getState().setCarry(['r1']);
    const fresh = attuneChange(reliquary(), 'r3', 3);
    expect(fresh).toEqual({ uids: ['r3', 'r1'] });
  });

  it('a run’s relics read as carried, attuned or dormant, with their Inscriptions', () => {
    const carried = carriedRelics(fullReliquary(), 3);
    const r = Run.embark(Run.newRun(7, undefined, [], carried));
    expect(r.relics.map((x) => !!x.dormant)).toEqual([false, true, true]);
    for (const owned of r.relics) {
      const snap = carriedSnapshot(owned, r.carried);
      expect(snap?.id).toBe(owned.id);
      const info = ownedRelicInfo(owned);
      expect(info.dormant).toBe(!!owned.dormant);
      expect(info.rule).toBe(relicText(relicDef(owned.id), !!owned.empowered));
      if (owned.dormant) expect(relicSentence(info)).toContain('dormant');
    }
    // A relic the run found isn't from the Reliquary.
    expect(carriedSnapshot({ id: 'tuning_fork', carried: false }, r.carried)).toBeNull();
    // A dormant Star Chart gives no fourth draft choice (the Draft screen asks relicActive).
    const chart = mockRelic('r9', 'star_chart');
    const withChart = Run.embark(Run.newRun(7, undefined, [], [carried[0]!, chart]));
    expect(Run.hasRelic(withChart, 'star_chart')).toBe(true);
    expect(Run.relicActive(withChart, 'star_chart')).toBe(false);
    expect(DORMANT_LINE).toContain('Inscriptions');
  });

  it('the HUD reads an Empowered relic’s own numbers (a Thimble recovers sooner)', () => {
    const def = relicDef('silver_thimble');
    const src = (empoweredIds: string[]) =>
      relicHuds({
        relics: {
          ids: ['silver_thimble', 'cracked_metronome'],
          cleansed: [],
          empowered: empoweredIds,
          metronomeAt: 30,
          thimbleAt: 30,
          veil: false,
        },
        time: 20,
        ledger: { perfects: 0, downs: 0 },
      });
    const plain = src([]);
    const grown = src(['silver_thimble', 'cracked_metronome']);
    expect(plain[0]!.total).toBe(def.values.cooldown);
    expect(grown[0]!.total).toBe(relicValues(def, true).cooldown);
    expect(grown[0]!.total).not.toBe(plain[0]!.total);
    expect(grown[1]!.total).toBe(relicValues(relicDef('cracked_metronome'), true).cooldown);
    expect(grown.map((h) => h.empowered)).toEqual([true, true]);
    expect(relicInfo('silver_thimble', false, { empowered: true }).rule).toBe(relicText(def, true));
  });
});

describe('the Summary’s enshrine, through the stores', () => {
  const found: OwnedRelic[] = [
    { id: 'tuning_fork', cleansed: false },
    { id: 'glass_halo', cleansed: true },
  ];

  it('a won run pays, offers what it found (not what it carried), and enshrines once', () => {
    skipUnlocks(true);
    stock(partwayReliquary().relics.slice(0, 2), ['r1'], 10, 0);
    useRun.getState().newRun(31);
    useRun.getState().embark();
    endRun(true, found);
    const r = run();
    expect(r.phase).toBe('summary');
    expect(enshrineStage(r, reliquary())).toBe('choose');
    const paid = runMaterials(r);
    expect(r.reliquary).toMatchObject(paid);
    expect(paidLine(r.reliquary!)).toContain(shardsText(paid.shards));
    expect(reliquary().shards).toBe(10 + paid.shards);
    // The choices: what it found, each arriving with content's count; the carried one isn't one.
    const choices = enshrineChoices(r);
    expect(choices.map((c) => c.id)).toEqual(['tuning_fork', 'glass_halo']);
    for (const c of choices)
      expect(c.arrives).toBe(RULES.enshrineInscriptions[relicDef(c.id).rarity]);
    expect(choices.find((c) => c.id === 'glass_halo')!.arrivesLine).toContain('cleansed');
    // Enshrine: once.
    const res = useRun.getState().enshrine('glass_halo');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.relic.inscriptions).toHaveLength(RULES.enshrineInscriptions.cursed);
    expect(res.relic.cleansed).toBe(true);
    expect(reliquary().relics.at(-1)!.uid).toBe(res.relic.uid);
    expect(enshrineStage(run(), reliquary())).toBe('done');
    expect(useRun.getState().enshrine('tuning_fork').ok).toBe(false);
    expect(reliquary().relics).toHaveLength(3);
  });

  it('a full Reliquary releases one first, right there; then it enshrines', () => {
    skipUnlocks(true);
    stock(fullReliquary().relics);
    useRun.getState().newRun(32);
    useRun.getState().embark();
    endRun(true, found);
    expect(enshrineStage(run(), reliquary())).toBe('full');
    const refused = useRun.getState().enshrine('tuning_fork');
    expect(refused.ok).toBe(false);
    const shards = reliquary().shards;
    const gone = reliquary().relics.find((r) => r.uid === 'r9')!;
    expect(useProfile.getState().releaseRelic('r9')).toBe(releaseView(gone).total);
    expect(reliquary().shards).toBe(shards + releaseValue(gone));
    expect(enshrineStage(run(), reliquary())).toBe('choose');
    expect(useRun.getState().enshrine('tuning_fork').ok).toBe(true);
    expect(reliquary().relics).toHaveLength(RULES.capacity);
  });

  it('a lost run pays and offers nothing; a closed Reliquary shows nothing', () => {
    skipUnlocks(true);
    useRun.getState().newRun(33);
    useRun.getState().embark();
    endRun(false, found);
    expect(enshrineStage(run(), reliquary())).toBe('lost');
    expect(run().reliquary).toMatchObject(runMaterials(run()));
    // Before Rank 10 (no Skip the unlocks), a run's end pays nothing and the panel is closed.
    skipUnlocks(false);
    useProfile.getState().award(RANK_XP[8]!);
    expect(useProfile.getState().reliquaryOpen()).toBe(false);
    useRun.getState().newRun(34);
    useRun.getState().embark();
    endRun(true, found);
    expect(run().reliquary).toBeNull();
    expect(enshrineStage(run(), reliquary())).toBe('closed');
  });
});

describe('the Codex, the Ranks, the Title', () => {
  it('lists every Inscription with its five tiers, T2 and T1 marked as waiting', () => {
    const groups = codexInscriptions();
    expect(groups.map((g) => g.category)).toEqual([...INSCRIPTION_CATEGORIES]);
    const rows = groups.flatMap((g) => g.rows);
    expect(rows.map((r) => r.id).sort()).toEqual(NORMAL.map((d) => d.id).sort());
    for (const row of rows) {
      const def = inscriptionDef(row.id) as InscriptionDef;
      expect(row.tiers.map((t) => t.tier)).toEqual([5, 4, 3, 2, 1]);
      for (const t of row.tiers) {
        expect(t.text).toBe(rangeText(def, t.tier));
        expect(t.reachable).toBe(t.tier >= RULES.tierCap);
      }
      expect(row.text).not.toContain('{v}');
    }
  });

  it('the empowered relics, those with nothing to grow, the Dissonant ones and the curses', () => {
    const e = codexEmpowered();
    expect(e.rows.map((r) => r.id)).toEqual(
      CONTENT.relics.filter((d) => d.empowered).map((d) => d.id),
    );
    for (const r of e.rows) {
      expect(r.text).toBe(relicText(relicDef(r.id)));
      expect(r.empowered).toBe(relicText(relicDef(r.id), true));
      expect(r.empowered).not.toBe(r.text);
    }
    expect(e.none).toEqual(CONTENT.relics.filter((d) => !d.empowered).map((d) => d.name));
    expect(DISSONANT.length).toBeGreaterThan(0);
    for (const d of DISSONANT) expect(inscriptionText(d)).not.toMatch(/\{[a-z]\}/);
    for (const c of CONTENT.curses) expect(curseText(c)).not.toMatch(/\{[a-z]\}/);
  });

  it('the materials and where they come from, from content', () => {
    const how = materialsHow();
    const s = RULES.shards;
    for (const n of [s.perFight, s.elite, s.miniboss, s.boss])
      expect(how.shards).toContain(String(n));
    expect(how.shards).toContain(
      CONTENT.encounters.find((e) => e.kind === 'boss')!.name.replace(/^The /, 'the '),
    );
    expect(how.tears).toContain(RULES.tearGrade);
    expect(materialsBadge(EMPTY_RELIQUARY)).toBeNull();
    expect(materialsBadge({ shards: 24, tears: 1 })).toBe('24 Tuning Shards, 1 Discord Tear');
  });

  it('opens at Rank 10, slots at 15 and 20: the unlocks read with their own icons', () => {
    const [open, ...later] = RULES.slotRanks;
    expect(reliquaryOpen(open! - 1)).toBe(false);
    expect(reliquaryOpen(open!)).toBe(true);
    expect(reliquaryOpen(1, true)).toBe(true);
    const unlocks = UNLOCKS.filter((u) => u.kind === 'reliquary' || u.kind === 'carrySlot');
    expect(unlocks.map((u) => u.rank)).toEqual(RULES.slotRanks);
    expect(unlockIcon(unlocks[0]!)).toBe('reliquary');
    expect(unlockIcon(unlocks[1]!)).toBe('carry');
    for (const icon of [
      'reliquary',
      'carry',
      'shard',
      'tear',
      'crack',
      'shatter',
      'inscribe',
      'ascend',
      'dissonate',
      'release',
    ])
      expect(PATHS[icon as keyof typeof PATHS]).toBeTruthy();
    const line = reliquaryUnlockLine(unlocks[0]!)!;
    for (const r of later) expect(line).toContain(`Rank ${r}`);
    expect(reliquaryUnlockLine(unlocks[1]!)).toContain('attuned');
    expect(reliquaryUnlockLine({ kind: 'aura', target: 'x' })).toBeNull();
    // The Rank panel before each says what it opens.
    for (const u of unlocks) {
      const p = rankPanel({ xp: RANK_XP[u.rank - 2]!, runs: 0, wins: 0 });
      expect(rankOf(RANK_XP[u.rank - 2]!)).toBe(u.rank - 1);
      expect(p.next.map((x) => x.id)).toContain(u.id);
    }
  });

  it('every look reads: the five kinds apart in every colour vision, tiers rising, text legible', () => {
    // The Weaver's sage stays apart from the four constellations in every colour-vision mode.
    const four = Object.values(CONSTELLATION_LOOK).map((l) => l.color);
    for (const vision of COLOR_VISIONS)
      for (const c of four)
        expect(
          deltaE(simulateVision(CATEGORY_LOOK.weaver.color, vision), simulateVision(c, vision)),
        ).toBeGreaterThanOrEqual(20);
    for (const c of INSCRIPTION_CATEGORIES) expect(CATEGORY_LOOK[c].name).toBeTruthy();
    // Higher tiers read better: more pips, more fill, as much glow or more.
    for (let tier = 5; tier > 1; tier--) {
      const [lo, hi] = [TIER_LOOK[tier]!, TIER_LOOK[tier - 1]!];
      expect(hi.pips).toBe(lo.pips + 1);
      expect(hi.fill).toBeGreaterThan(lo.fill);
      expect(hi.glow).toBeGreaterThanOrEqual(lo.glow);
    }
    // Text on the dark panels: at least 4.5:1, on the tints the badges and chips draw.
    for (const t of Object.values(TIER_LOOK))
      expect(contrast(t.color, mix(t.color, t.fill, INK_900))).toBeGreaterThanOrEqual(4.5);
    for (const look of [...Object.values(DISSONANCE_LOOK), FRACTURED_LOOK, CARRIED_LOOK])
      expect(contrast(look.color, mix(look.color, 0.14, INK_900))).toBeGreaterThanOrEqual(4.5);
    for (const color of [SHARD_LOOK.color, TEAR_LOOK.color, CATEGORY_LOOK.weaver.color])
      expect(contrast(color, INK_800)).toBeGreaterThanOrEqual(4.5);
  });

  it('every tab of the crafting panel has its label, and the lab’s Reliquaries are real', () => {
    expect(ACTIONS).toEqual(['inscribe', 'retune', 'ascend', 'dissonate', 'release']);
    for (const rq of [partwayReliquary(), fullReliquary()]) {
      for (const r of rq.relics)
        for (const ins of r.inscriptions) {
          const [min, max] = tierRange(inscriptionDef(ins.id), ins.tier);
          expect(ins.value).toBeGreaterThanOrEqual(min);
          expect(ins.value).toBeLessThanOrEqual(max);
          expect(inscriptionRow(ins).rangeText).toBe(rangeText(inscriptionDef(ins.id), ins.tier));
        }
      expect(rq.relics.length).toBeLessThanOrEqual(RULES.capacity);
    }
    expect(fullReliquary().relics).toHaveLength(RULES.capacity);
    expect(mockInscription('potent_thread', 5, 0).value).toBe(
      tierRange(inscriptionDef('potent_thread'), 5)[0],
    );
  });
});
