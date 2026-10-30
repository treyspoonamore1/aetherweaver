/**
 * Phase 4f UI: technique variants (docs/phase-4f.md, docs/phase-4f/ui.md). Prep's Techniques
 * panel, the Weaver bar's slots, the statuses, the hints, the Training Grounds and the Codex's
 * page are pure models over content (`CONTENT.techniqueVariants`, `variantText`, the defaults'
 * `CONTENT.techniques`) and meta (`variantsFor`, `fitTechniques`, `variantsConfig`); the choices
 * run through the real stores and the HUD through a real sim. Every name and number is checked
 * against the content it comes from, so the variants can be tuned without leaving the screens
 * behind.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT, variantText, type TechniqueVariantDef } from '../src/content';
import * as Run from '../src/meta/run';
import {
  TECHNIQUE_SLOTS,
  fitTechniques,
  noVariants,
  variantsConfig,
  variantsFor,
  type Techniques,
} from '../src/meta/variants';
import { createSim, type Command, type Sim, type TechniqueKey } from '../src/sim';
import type { World } from '../src/sim/world';
import { rejectBuzz } from '../src/ui/hud/buzz';
import { evaluateHints } from '../src/ui/hud/hints';
import { STATUS, statusTitle } from '../src/ui/hud/labels';
import { slotState } from '../src/ui/hud/techniqueState';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { PATHS } from '../src/ui/kit/iconPaths';
import {
  SLOT_ICON,
  VARIANT_ICON,
  VARIANT_LOOK,
  VARIANT_STATUS,
  techniqueIcon,
} from '../src/ui/kit/variantLook';
import { labSetTechnique, mockHud, mockVariantsHud, techniquesRun } from '../src/ui/lab/mock';
import { spiritBudget } from '../src/ui/screens/chordModel';
import { REWIND_NAME } from '../src/ui/screens/callingText';
import {
  atelierRank,
  codexLines,
  defaultName,
  defaultText,
  lockText,
  optionState,
  rewindNote,
  sourceText,
  stepOption,
  techniqueClick,
  techniqueSlots,
  techniqueTip,
  techniquesSummary,
  trainingChoice,
  trainingOptions,
  variantSource,
} from '../src/ui/screens/variantsModel';
import type { HudSnapshot, TechniqueHud } from '../src/ui/store';

const VARIANTS = CONTENT.techniqueVariants;
const skipUnlocks = (on: boolean) =>
  useSettings.getState().update((s) => ({ ...s, unlockAll: on }));
const profile = () => useProfile.getState().profile;
const run = () => useRun.getState().run!;
/** A slot's own variants, from content. */
const own = (slot: TechniqueKey) => VARIANTS.filter((v) => v.slot === slot);
/** Phase 4g's content when it's there (docs/phase-4g.md); the plan's until then. */
const loom = CONTENT as unknown as {
  starlight?: { atelierRank?: number };
  mastery?: { callings?: { calling: string; variant: string }[] };
};
const KEYS: Record<TechniqueKey, string> = { ward: 'Q', chime: 'E', reel: 'F', glide: 'Space' };
/** A default's Spirit cost (null: Glide's, free). */
const baseCost = (slot: TechniqueKey): number | null =>
  slot === 'glide' ? null : CONTENT.techniques[slot].cost;

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

const INK_950 = '#050814';
const INK_900 = '#0a1022';
const INK_800 = '#111a33';

/** A sandbox fight with these variants, a second in (and a Calling, if given). */
function fight(techniques: Partial<Record<TechniqueKey, string>>, calling?: string): Sim {
  const sim = createSim({
    seed: 7,
    encounter: 'sandbox',
    debug: true,
    auras: [],
    techniques,
    calling: calling ? { id: calling, path: [] } : null,
  });
  step(sim, 60);
  return sim;
}

function step(sim: Sim, n: number, commands: Command[] = []): void {
  for (let i = 0; i < n; i++) {
    sim.step(i === 0 ? commands : []);
    sim.drainEvents();
  }
}

const hudOf = (sim: Sim): HudSnapshot => buildHudSnapshot(sim.state, { seed: 7, hovered: null });
const slotOf = (hud: HudSnapshot, key: TechniqueKey): TechniqueHud =>
  hud.weaver.techniques.find((t) => t.key === key)!;

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('Prep’s panel reads content and meta', () => {
  it('each slot: its default, then its two variants, their names, texts and numbers', () => {
    const slots = techniqueSlots({ techniques: noVariants(), owned: [], all: true });
    expect(slots.map((s) => s.slot)).toEqual(TECHNIQUE_SLOTS);
    for (const view of slots) {
      const t = CONTENT.techniques[view.slot];
      expect(view.name).toBe(t.name);
      expect(view.key).toBe(KEYS[view.slot]);
      expect(view.options.map((o) => o.id)).toEqual([
        null,
        ...variantsFor(view.slot).map((v) => v.id),
      ]);
      const [base, ...variants] = view.options;
      expect(base!.name).toBe(t.name);
      expect(base!.text).toBe(defaultText(view.slot));
      expect(base!.icon).toBe(SLOT_ICON[view.slot]);
      expect(base!.cost).toBe(baseCost(view.slot));
      expect(base!.cooldown).toBe(t.cooldown);
      for (const o of variants) {
        const def = VARIANTS.find((v) => v.id === o.id)!;
        expect(o.name).toBe(def.name);
        expect(o.text).toBe(variantText(def));
        expect(o.icon).toBe(VARIANT_ICON[def.id]);
        // The variant's own cost and cooldown where content gives them, else the default's.
        const cost = view.slot === 'glide' ? null : (def.cost ?? baseCost(view.slot));
        expect(o.cost).toBe(cost);
        expect(o.cooldown).toBe(def.cooldown ?? t.cooldown);
        expect(o.costChanged).toBe(cost !== base!.cost);
        expect(o.cooldownChanged).toBe((def.cooldown ?? t.cooldown) !== t.cooldown);
      }
    }
  });

  it('the defaults are told with content’s numbers', () => {
    const t = CONTENT.techniques;
    expect(defaultText('ward')).toContain(`${Math.round(t.ward.barrierPct * 100)}% of their life`);
    expect(defaultText('ward')).toContain(`+ ${t.ward.barrierFlat}`);
    expect(defaultText('ward')).toContain(`${t.ward.perfectWindow} s`);
    expect(defaultText('chime')).toContain(`within ${t.chime.radius} m`);
    expect(defaultText('chime')).toContain(`${Math.round(t.chime.healPct * 100)}%`);
    expect(defaultText('chime')).toContain(`${t.chime.immunity} s`);
    expect(defaultText('glide')).toContain(`${t.glide.distance} m`);
    expect(defaultText('glide')).toContain(`${t.glide.iframes} s`);
  });

  it('every variant has a glyph of its own; an unknown one takes its slot’s', () => {
    for (const v of VARIANTS) {
      expect(VARIANT_ICON[v.id], v.id).toBeDefined();
      expect(PATHS[VARIANT_ICON[v.id]!]).toBeDefined();
      expect(techniqueIcon(v.slot, v.id)).toBe(VARIANT_ICON[v.id]);
    }
    expect(new Set(Object.values(VARIANT_ICON)).size).toBe(Object.keys(VARIANT_ICON).length);
    expect(techniqueIcon('reel', 'not_a_variant')).toBe('reel');
    expect(techniqueIcon('glide', null)).toBe('glide');
  });

  it('how a variant is had: Phase 4g’s content when there, the plan’s until then', () => {
    const rank = loom.starlight?.atelierRank ?? 5;
    expect(atelierRank()).toBe(rank);
    const mastery = loom.mastery?.callings ?? [
      { calling: 'luminary', variant: 'chorale' },
      { calling: 'martyr', variant: 'aegis_link' },
      { calling: 'chronomancer', variant: 'phase_step' },
    ];
    for (const v of VARIANTS) {
      const m = mastery.find((x) => x.variant === v.id);
      const name = m && CONTENT.callings.find((c) => c.id === m.calling)!.name;
      expect(variantSource(v.id).kind).toBe(m ? 'mastery' : 'rank');
      expect(lockText(v.id)).toBe(
        m ? `Starlight, from the ${name}’s top mastery` : `Starlight, from Weaver Rank ${rank}`,
      );
      expect(sourceText(v.id)).toContain(m ? `the ${name}’s top mastery` : `Weaver Rank ${rank}`);
    }
  });
});

describe('owned and locked', () => {
  it('only owned variants are open; Skip the unlocks opens them all; the default always', () => {
    const owned = [own('chime')[1]!.id, own('glide')[1]!.id];
    for (const all of [false, true]) {
      const slots = techniqueSlots({ techniques: noVariants(), owned, all });
      for (const view of slots) {
        const [base, ...variants] = view.options;
        expect(base!.open && base!.owned && base!.chosen).toBe(true);
        expect(base!.lock).toBeNull();
        for (const o of variants) {
          const has = owned.includes(o.id!);
          expect(o.owned).toBe(has);
          expect(o.open).toBe(has || all);
          expect(o.lock).toBe(has || all ? null : lockText(o.id!));
        }
      }
    }
  });

  it('a click chooses what’s open, explains what’s locked, and leaves the chosen be', () => {
    const chime = own('chime');
    const owned = [chime[1]!.id];
    const view = techniqueSlots({
      techniques: { ...noVariants(), chime: chime[1]!.id },
      owned,
      all: false,
    }).find((s) => s.slot === 'chime')!;
    const [base, locked, chosen] = view.options;
    expect(view.chosen).toBe(chosen);
    expect(techniqueClick(view, chosen!)).toEqual({ kind: 'none' });
    expect(techniqueClick(view, locked!)).toEqual({
      kind: 'locked',
      announce: `${locked!.name}: ${lockText(locked!.id!)}.`,
    });
    expect(techniqueClick(view, base!)).toEqual({
      kind: 'choose',
      slot: 'chime',
      id: null,
      announce: `${CONTENT.techniques.chime.name} on E.`,
    });
  });

  it('the arrow keys move between open options, skipping the locked, and wrap', () => {
    const glide = own('glide');
    const ctx = (chosen: string | null, owned: string[]) =>
      techniqueSlots({ techniques: { ...noVariants(), glide: chosen }, owned, all: false }).find(
        (s) => s.slot === 'glide',
      )!;
    // Only the second variant owned: from the default, either way lands on it.
    let view = ctx(null, [glide[1]!.id]);
    expect(stepOption(view, 1)?.id).toBe(glide[1]!.id);
    expect(stepOption(view, -1)?.id).toBe(glide[1]!.id);
    // Both owned: down goes in order and wraps to the default; up goes back.
    view = ctx(
      glide[1]!.id,
      glide.map((v) => v.id),
    );
    expect(stepOption(view, 1)?.id).toBeNull();
    expect(stepOption(view, -1)?.id).toBe(glide[0]!.id);
    // Nothing else open: nowhere to go.
    expect(stepOption(ctx(null, []), 1)).toBeNull();
  });

  it('the panel’s line: none owned, some, or every one open', () => {
    expect(techniquesSummary([], false)).toMatchObject({ owned: 0, choosable: false });
    expect(techniquesSummary([], false).line).toContain('Skip the unlocks');
    const some = techniquesSummary([VARIANTS[0]!.id, 'gone', VARIANTS[0]!.id], false);
    expect(some).toMatchObject({ owned: 1, total: VARIANTS.length, choosable: true });
    expect(some.line).toBe(
      `1 of ${VARIANTS.length} variants owned. The rest are bought with Starlight.`,
    );
    expect(techniquesSummary([], true)).toMatchObject({ all: true, choosable: true });
  });
});

describe('the choices go through the stores', () => {
  it('with Skip the unlocks: a click sets the profile’s choice, and the run in Prep follows', () => {
    skipUnlocks(true);
    useRun.getState().newRun(41);
    for (const slot of TECHNIQUE_SLOTS) {
      const variant = own(slot)[1]!;
      let view = techniqueSlots({
        techniques: run().techniques,
        owned: profile().variants,
        all: useProfile.getState().variantsAll(),
      }).find((s) => s.slot === slot)!;
      const action = techniqueClick(
        view,
        view.options.find((o) => o.id === variant.id)!,
      );
      expect(action.kind).toBe('choose');
      if (action.kind !== 'choose') continue;
      useProfile.getState().setTechnique(action.slot, action.id);
      expect(profile().techniques[slot]).toBe(variant.id);
      expect(run().techniques[slot]).toBe(variant.id);
      view = techniqueSlots({ techniques: run().techniques, owned: [], all: true }).find(
        (s) => s.slot === slot,
      )!;
      expect(view.chosen.id).toBe(variant.id);
    }
    // Embarking freezes it; the fight plays it.
    const chosen = { ...run().techniques };
    useRun.getState().embark();
    useProfile.getState().setTechnique('ward', null);
    expect(run().techniques).toEqual(chosen);
    useRun.getState().chooseNode(Run.reachable(run())[0]!.id);
    expect(useRun.getState().combatConfig()!.techniques).toEqual(variantsConfig(chosen));
  });

  it('without it: a locked variant stays locked until it’s owned', () => {
    useRun.getState().newRun(42);
    const skate = own('glide').at(-1)!;
    let view = techniqueSlots({
      techniques: run().techniques,
      owned: profile().variants,
      all: false,
    }).find((s) => s.slot === 'glide')!;
    const option = () => view.options.find((o) => o.id === skate.id)!;
    expect(techniqueClick(view, option()).kind).toBe('locked');
    // The store refuses it too.
    useProfile.getState().setTechnique('glide', skate.id);
    expect(profile().techniques.glide).toBeNull();
    // Owned (Phase 4g's shop calls this): open, chosen, and the run follows.
    useProfile.getState().ownVariant(skate.id);
    view = techniqueSlots({
      techniques: run().techniques,
      owned: profile().variants,
      all: false,
    }).find((s) => s.slot === 'glide')!;
    expect(option().open).toBe(true);
    const action = techniqueClick(view, option());
    expect(action).toMatchObject({ kind: 'choose', id: skate.id });
    useProfile.getState().setTechnique('glide', skate.id);
    expect(run().techniques.glide).toBe(skate.id);
  });

  it('turning Skip the unlocks off shows the unowned choice locked, and the run plays the default', () => {
    skipUnlocks(true);
    useRun.getState().newRun(43);
    const chorale = own('ward')[0]!;
    useProfile.getState().setTechnique('ward', chorale.id);
    expect(run().techniques.ward).toBe(chorale.id);
    skipUnlocks(false);
    expect(run().techniques.ward).toBeNull();
    const view = techniqueSlots({
      techniques: run().techniques,
      owned: profile().variants,
      all: false,
    }).find((s) => s.slot === 'ward')!;
    expect(view.chosen.id).toBeNull();
    expect(view.options.find((o) => o.id === chorale.id)!.open).toBe(false);
  });

  it('the lab’s choice follows the store’s rules', () => {
    for (const slot of TECHNIQUE_SLOTS)
      for (const all of [false, true])
        for (const owned of [[], [own(slot)[0]!.id]])
          for (const id of [null, ...VARIANTS.map((v) => v.id)]) {
            useProfile.getState().resetProgress();
            skipUnlocks(all);
            for (const o of owned) useProfile.getState().ownVariant(o);
            useProfile.getState().setTechnique(slot, id);
            expect(labSetTechnique(noVariants(), slot, id, owned, all), `${slot} ${id}`).toEqual(
              profile().techniques,
            );
          }
    const run7 = techniquesRun({ ward: own('ward')[0]!.id, glide: 'gone' }, [], false);
    expect(run7.techniques).toEqual(noVariants());
    expect(techniquesRun({ ward: own('ward')[0]!.id }, [], true).techniques.ward).toBe(
      own('ward')[0]!.id,
    );
  });
});

describe('the Chronomancer', () => {
  it('Rewind takes Reel’s slot: Prep says the Reel choice has no effect', () => {
    const chrono = CONTENT.callings.find((c) => (c.values.rewind ?? 0) > 0)!;
    const reel = own('reel')[0]!;
    const slots = techniqueSlots({
      techniques: { ...noVariants(), reel: reel.id },
      owned: [],
      all: true,
      callingId: chrono.id,
    });
    for (const view of slots) expect(view.note === null).toBe(view.slot !== 'reel');
    const view = slots.find((s) => s.slot === 'reel')!;
    expect(view.note).toBe(rewindNote(chrono.id));
    expect(view.note).toContain(chrono.name);
    expect(view.note).toContain(`${REWIND_NAME} takes ${CONTENT.techniques.reel.name}’s slot`);
    const action = techniqueClick(view, view.options[0]!);
    expect(action.kind === 'choose' && action.announce).toContain(REWIND_NAME);
    // Another Calling, or none: no note.
    for (const c of [null, ...CONTENT.callings.filter((x) => x.id !== chrono.id).map((x) => x.id)])
      expect(rewindNote(c)).toBeNull();
    // A Chronomancer run in Prep, through the stores.
    skipUnlocks(true);
    useRun.getState().newRun(44);
    useRun.getState().setCalling(chrono.id);
    useProfile.getState().setTechnique('reel', reel.id);
    expect(
      techniqueSlots({
        techniques: run().techniques,
        owned: [],
        all: true,
        callingId: run().calling?.id,
      }).find((s) => s.slot === 'reel')!.note,
    ).toBe(rewindNote(chrono.id));
  });

  it('in the fight, Reel’s slot is Rewind’s, whatever variant was chosen', () => {
    const chrono = CONTENT.callings.find((c) => (c.values.rewind ?? 0) > 0)!;
    const ward = own('ward')[1]!;
    const hud = hudOf(fight({ ward: ward.id, reel: own('reel')[0]!.id }, chrono.id));
    const reel = slotOf(hud, 'reel');
    expect(reel.name).toBe(REWIND_NAME);
    expect(reel.icon).toBe('rewind');
    expect(reel.variant).toBeNull();
    expect(slotOf(hud, 'ward').variant?.id).toBe(ward.id);
    const tip = techniqueTip(reel, hud.weaver.rewind!.seconds);
    expect(tip.name).toBe(REWIND_NAME);
    expect(tip.text).toContain(`${chrono.values.rewind} s`);
  });
});

describe('in a fight: the Weaver bar from a real sim', () => {
  const ALL: Partial<Record<TechniqueKey, string>> = Object.fromEntries(
    TECHNIQUE_SLOTS.map((s) => [s, own(s).at(-1)!.id]),
  );

  it('each slot names its variant, with its glyph and content’s text', () => {
    for (const pick of [0, 1]) {
      const chosen = Object.fromEntries(TECHNIQUE_SLOTS.map((s) => [s, own(s)[pick]!.id]));
      const hud = hudOf(fight(chosen));
      for (const slot of TECHNIQUE_SLOTS) {
        const t = slotOf(hud, slot);
        const def = VARIANTS.find((v) => v.id === chosen[slot])!;
        expect(t.variant).toEqual({ id: def.id, name: def.name, text: variantText(def) });
        expect(t.name).toBe(def.name);
        expect(t.icon).toBe(VARIANT_ICON[def.id]);
        const tip = techniqueTip(t);
        expect(tip.sub).toBe(`A ${defaultName(slot)} variant`);
        expect(tip.text).toBe(variantText(def));
      }
      // The controls reminder names them, in key order.
      expect(hud.weaver.techniques.map((t) => t.name)).toEqual(
        TECHNIQUE_SLOTS.map((s) => VARIANTS.find((v) => v.id === chosen[s])!.name),
      );
    }
    // Without variants, as before.
    const plain = hudOf(fight({}));
    for (const slot of TECHNIQUE_SLOTS) {
      const t = slotOf(plain, slot);
      expect(t.variant).toBeNull();
      expect(t.name).toBe(CONTENT.techniques[slot].name);
      expect(t.icon).toBe(SLOT_ICON[slot]);
      expect(techniqueTip(t).text).toBe(defaultText(slot));
    }
  });

  it('a variant with a cost of its own costs that, and can’t be cast below it', () => {
    const priced = VARIANTS.filter(
      (v): v is TechniqueVariantDef & { slot: 'ward' | 'chime' | 'reel' } =>
        v.slot !== 'glide' && v.cost !== undefined && v.cost !== CONTENT.techniques[v.slot].cost,
    );
    for (const v of priced) {
      const sim = fight({ [v.slot]: v.id });
      const base = CONTENT.techniques[v.slot].cost;
      expect(slotOf(hudOf(sim), v.slot).cost).toBeCloseTo(v.cost!, 6);
      expect(slotOf(hudOf(sim), v.slot).baseCost).toBeCloseTo(v.cost!, 6);
      // Between the default's cost and the variant's: the default could, the variant can't.
      const w = (sim.state as unknown as World).entities.get(sim.state.weaverId)!.weaver!;
      w.spirit = (base + v.cost!) / 2;
      expect(slotOf(hudOf(sim), v.slot).affordable).toBe(v.cost! < base);
      const plain = fight({});
      (plain.state as unknown as World).entities.get(plain.state.weaverId)!.weaver!.spirit =
        (base + v.cost!) / 2;
      expect(slotOf(hudOf(plain), v.slot).affordable).toBe(base < v.cost!);
    }
  });

  it('Skate: its charges on the slot, ready while one is left', () => {
    const skate = VARIANTS.find((v) => v.id === 'skate')!;
    const sim = fight({ glide: skate.id });
    let glide = slotOf(hudOf(sim), 'glide');
    const charges = skate.values.charges!;
    expect(glide.maxCharges).toBe(charges);
    expect(glide.charges).toBe(charges);
    expect(slotState(glide, false).ready).toBe(true);
    expect(techniqueTip(glide).stats).toContain(`${charges} charges`);
    // One spent: the cooldown runs for it, and the slot still works.
    step(sim, 6, [{ t: 'glide', x: 1, z: 0 }]);
    glide = slotOf(hudOf(sim), 'glide');
    expect(glide.charges).toBe(charges - 1);
    expect(glide.remaining).toBeGreaterThan(0);
    expect(slotState(glide, false)).toMatchObject({ ready: true, cooling: false, refilling: true });
    // All spent: it waits for the next.
    for (let i = 1; i < charges; i++) step(sim, 6, [{ t: 'glide', x: 1, z: 0 }]);
    glide = slotOf(hudOf(sim), 'glide');
    expect(glide.charges).toBe(0);
    expect(slotState(glide, false)).toMatchObject({ ready: false, cooling: true });
    // The default Glide waits after one, as before.
    const plain = fight({});
    step(plain, 6, [{ t: 'glide', x: 1, z: 0 }]);
    const g = slotOf(hudOf(plain), 'glide');
    expect(g.maxCharges).toBe(1);
    expect(slotState(g, false).cooling).toBe(true);
  });

  it('rejections still buzz the slot', () => {
    const hud = mockVariantsHud('calm', ALL);
    const callouts = [
      {
        id: 9,
        kind: 'reject' as const,
        text: 'Glide: not ready',
        key: 'reject:glide',
        expiresAt: 0,
      },
    ];
    expect(rejectBuzz(callouts)).toEqual({ glide: 9 });
    expect(slotOf(hud, 'glide').variant?.id).toBe(ALL.glide);
  });

  it('Absolve’s and Anchor’s guards on the frames, in their own looks and content’s words', () => {
    const absolve = VARIANTS.find((v) => v.id === 'absolve')!;
    const anchor = VARIANTS.find((v) => v.id === 'anchor')!;
    const sim = fight({ chime: absolve.id, reel: anchor.id });
    step(sim, 1, [{ t: 'thread', slot: 0 }]);
    step(sim, 1, [{ t: 'tech', id: 'reel', slot: 0 }]);
    const lyra = sim.state.entities.get(sim.state.party[1]!)!;
    step(sim, 1, [{ t: 'tech', id: 'chime', point: { x: lyra.x, z: lyra.z } }]);
    step(sim, 30);
    const hud = hudOf(sim);
    const statuses = (slot: number) => hud.party[slot]!.statuses.map((s) => s.id);
    expect(statuses(0)).toContain('anchored');
    expect(statuses(1)).toContain('absolved');
    for (const [id, def] of [
      ['absolved', absolve],
      ['anchored', anchor],
    ] as const) {
      const look = STATUS[id];
      expect(look.icon).toBe(VARIANT_STATUS[id].icon);
      expect(look.color).toBe(VARIANT_STATUS[id].color);
      expect(look.help).toBe(
        `Your ${def.name}: they take ${def.values.pct}% less damage while it lasts.`,
      );
      expect(statusTitle(look)).toContain(def.name);
    }
    // Their own glyphs, not the immunity's colour.
    expect(STATUS.absolved.color).not.toBe(STATUS.immune.color);
    expect(STATUS.anchored.icon).not.toBe(STATUS.absolved.icon);
  });

  it('the coach hints name the variant in the slot, and explain nothing content doesn’t', () => {
    const base = mockHud('calm');
    const lethal = (techniques: (t: TechniqueHud) => Partial<TechniqueHud>): HudSnapshot => ({
      ...base,
      weaver: {
        ...base.weaver,
        techniques: base.weaver.techniques.map((t) => ({ ...t, ...techniques(t) })),
      },
      party: base.party.map((h, i) =>
        i === 0 ? { ...h, lethal: true, incoming: h.hp * 2, threaded: false } : h,
      ),
    });
    const variant = (id: string) => {
      const def = VARIANTS.find((v) => v.id === id)!;
      return { id, name: def.name, text: variantText(def) };
    };
    const ward = own('ward')[0]!;
    const hints = evaluateHints(
      lethal((t) => (t.key === 'ward' ? { variant: variant(ward.id), name: ward.name } : {})),
    );
    expect(hints.find((h) => h.id === 'lethal-ward')!.text).toContain(`cast ${ward.name} {Q}`);
    // Ward not ready: Reel's slot, its variant by name.
    for (const reel of own('reel')) {
      const h = evaluateHints(
        lethal((t) =>
          t.key === 'ward'
            ? { affordable: false }
            : t.key === 'reel'
              ? { variant: variant(reel.id), name: reel.name }
              : {},
        ),
      ).find((x) => x.id === 'lethal-reel')!;
      expect(h.text).toBe(`${base.party[0]!.name} is in a lethal zone — ${reel.name} {F} on them`);
    }
    const plain = evaluateHints(lethal((t) => (t.key === 'ward' ? { affordable: false } : {})));
    expect(plain.find((x) => x.id === 'lethal-reel')!.text).toContain('Reel them out {F}');
  });
});

describe('the songs’ budget, the Training Grounds, the Codex, the looks', () => {
  it('the Spirit budget names the run’s variants at their own costs', () => {
    const chosen: Techniques = {
      ...noVariants(),
      ...Object.fromEntries((['ward', 'chime', 'reel'] as const).map((s) => [s, own(s)[0]!.id])),
    };
    const b = spiritBudget([{ auras: [], ornaments: [] }], 'spirit', null, { techniques: chosen });
    for (const t of b.techniques) {
      const def = VARIANTS.find((v) => v.id === chosen[t.key])!;
      expect(t.name).toBe(def.name);
      expect(t.cost).toBeCloseTo(def.cost ?? CONTENT.techniques[t.key].cost, 6);
    }
    // On a Chronomancer run, Reel's slot reads as Rewind, whatever its variant.
    const chrono = CONTENT.callings.find((c) => (c.values.rewind ?? 0) > 0)!;
    const r = spiritBudget([{ auras: [], ornaments: [] }], 'spirit', chrono.id, {
      techniques: chosen,
    });
    expect(r.techniques.find((t) => t.key === 'reel')!.name).toBe(REWIND_NAME);
    expect(r.techniques.find((t) => t.key === 'reel')!.cost).toBe(CONTENT.techniques.reel.cost);
  });

  it('the Training Grounds start with the profile’s choice, every variant open, ownership untouched', () => {
    const chorale = own('ward')[0]!;
    const skate = own('glide').at(-1)!;
    // Chosen under Skip the unlocks, then turned off: Prep plays the default, training doesn't.
    skipUnlocks(true);
    useProfile.getState().setTechnique('ward', chorale.id);
    useProfile.getState().setTechnique('glide', skate.id);
    skipUnlocks(false);
    expect(useProfile.getState().runTechniques()).toEqual(noVariants());
    expect(trainingChoice(profile())).toEqual({
      ...noVariants(),
      ward: chorale.id,
      glide: skate.id,
    });
    expect(trainingChoice(profile())).toEqual(fitTechniques(profile().techniques, [], true));
    for (const slot of TECHNIQUE_SLOTS) {
      const options = trainingOptions(slot, trainingChoice(profile()));
      expect(options.every((o) => o.open && o.lock === null)).toBe(true);
      expect(options.find((o) => o.chosen)!.id).toBe(trainingChoice(profile())[slot]);
    }
    expect(profile().variants).toEqual([]);
  });

  it('the Codex: every slot, owned, open or locked, and how each is had', () => {
    const owned = [own('chime')[1]!.id];
    for (const all of [false, true]) {
      const slots = techniqueSlots({ techniques: noVariants(), owned, all });
      for (const o of slots.flatMap((s) => s.options)) {
        const state = optionState(o, all);
        expect(state.kind).toBe(
          o.id === null ? 'default' : owned.includes(o.id) ? 'owned' : all ? 'open' : 'locked',
        );
      }
    }
    const lines = codexLines().join(' ');
    for (const v of VARIANTS.filter((x) => variantSource(x.id).kind === 'mastery'))
      expect(lines).toContain(v.name);
    expect(lines).toContain(`Weaver Rank ${atelierRank()}`);
    expect(lines).toContain('Skip the unlocks');
    expect(lines).toContain(REWIND_NAME);
  });

  it('the variant look and the guards’ colours read at 4.5:1 or better on the dark panels', () => {
    for (const c of [
      VARIANT_LOOK.color,
      VARIANT_LOOK.light,
      VARIANT_STATUS.absolved.color,
      VARIANT_STATUS.anchored.color,
    ])
      for (const bg of [INK_950, INK_900, INK_800])
        expect(contrast(c, bg), `${c} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it('the lab’s HUD is what the bridge reads of a real fight with those variants', () => {
    const ALL = Object.fromEntries(TECHNIQUE_SLOTS.map((s) => [s, own(s)[0]!.id]));
    const pick = (t: TechniqueHud) => ({
      key: t.key,
      name: t.name,
      icon: t.icon,
      variant: t.variant,
      cost: t.cost,
      maxCharges: t.maxCharges,
    });
    expect(mockVariantsHud('calm', ALL).weaver.techniques.map(pick)).toEqual(
      hudOf(fight(ALL)).weaver.techniques.map(pick),
    );
  });
});
