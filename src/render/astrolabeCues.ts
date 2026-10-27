/**
 * The Astrolabe as render sees it (docs/phase-4/vfx.md). Pure helpers, no three.js, so what each
 * node shows, and when, is testable in Node against the real sim.
 *
 * Render reads `WorldState.astrolabe` (the nodes, `techniquesCostLife`, `lifeCapPct`), the
 * shields' `amount` / `max` / `expiresAt`, the heroes' `afterglowUntil` and `invulnerable`, and
 * the `graceShield`, `damageTaken`, `shieldBroken`, `techniqueCast`, `techniqueRejected` and
 * `revived` events, and nothing else. Every number comes from content (`astrolabeNode(id)
 * .values`) or the state, never hard-coded, so the lead's retuning shows up without render
 * changes. The flags follow the nodes' *effects*, as the sim's mods do.
 */
import { astrolabeNode } from '../content';
import { techniqueCost, type CostedTechnique } from '../sim';
import type { DeepReadonly, Health, ReadonlyEntity, Shield, WorldState } from '../sim';

/** The Astrolabe's own colours (semantic ones stay semantic: the live palette's). */
export const ASTRO_HEX = {
  /** Overflowing Grace: the light at the brim (the shell itself glows in the live Mend colour). */
  graceLight: '#e8fff8',
  /** Shatterproof Halo: the Ward ringing like a struck bell (the circlet is the Ward's colour). */
  halo: '#fff6dc',
  /** Eldritch Conduit: blood-violet, the Life a technique costs. */
  conduit: '#8f1f73',
  /** Its pale core (where the Life is drawn into her hand). */
  conduitHot: '#f6c8e8',
  /** Second Wind: warm, airy white (untouchable for a moment). */
  wind: '#fff8e8',
  /** Unbroken Chorus: her song holding against a Mute's glass. */
  resist: '#fff4d6',
} as const;

/** The node effects render shows (the sim's own names, sim/astrolabe.ts). */
export const ASTRO_EFFECTS = {
  grace: 'overflowing_grace',
  halo: 'shatterproof_halo',
  conduit: 'eldritch_conduit',
  prism: 'prism_covenant',
  unbroken: 'unbroken_chorus',
  afterglow: 'afterglow',
  secondWind: 'second_wind',
} as const;

/** What the tree shows in a fight, read once per frame into a reused object. */
export interface AstroLook {
  /** Any node with something to show. */
  any: boolean;
  /** Overflowing Grace, its cap (a share of the hero's life) and how long it lasts. */
  grace: boolean;
  graceCap: number;
  graceSeconds: number;
  /** Shatterproof Halo and its cap (the most of its barrier a Ward loses to one hit). */
  halo: boolean;
  haloCap: number;
  /** Eldritch Conduit: techniques are paid in Life (`state.astrolabe.techniquesCostLife`). */
  conduit: boolean;
  /** Prism Covenant: she can't be healed above `lifeCap` of her Life (`lifeCapPct`). */
  prism: boolean;
  lifeCap: number;
  /** Unbroken Chorus: Mutes can't crack her fields or silence her. */
  unbroken: boolean;
  /** Afterglow and how long Empower lingers. */
  afterglow: boolean;
  linger: number;
  /** Second Wind and how long the revived hero is untouchable. */
  secondWind: boolean;
  windSeconds: number;
  /** The node list the flags were built from (rebuilt only when it changes). */
  nodes: readonly string[] | null;
}

export function emptyAstroLook(): AstroLook {
  return {
    any: false,
    grace: false,
    graceCap: 0,
    graceSeconds: 0,
    halo: false,
    haloCap: 0,
    conduit: false,
    prism: false,
    lifeCap: 1,
    unbroken: false,
    afterglow: false,
    linger: 0,
    secondWind: false,
    windSeconds: 0,
    nodes: null,
  };
}

function num(values: Readonly<Record<string, number>>, key: string, fallback: number): number {
  const v = values[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Fills `out` from the state: the flags from the nodes' effects, the numbers from content. */
export function astroLook(state: WorldState, out: AstroLook): AstroLook {
  const a = state.astrolabe;
  if (out.nodes !== a.nodes) {
    out.nodes = a.nodes;
    out.grace = false;
    out.graceCap = 0;
    out.graceSeconds = 0;
    out.halo = false;
    out.haloCap = 0;
    out.unbroken = false;
    out.afterglow = false;
    out.linger = 0;
    out.secondWind = false;
    out.windSeconds = 0;
    for (let i = 0; i < a.nodes.length; i++) {
      let node: ReturnType<typeof astrolabeNode>;
      try {
        node = astrolabeNode(a.nodes[i]!);
      } catch {
        continue;
      }
      const v = node.values;
      switch (node.effect) {
        case ASTRO_EFFECTS.grace:
          out.grace = true;
          out.graceCap = Math.max(out.graceCap, num(v, 'cap', 0) / 100);
          out.graceSeconds = Math.max(out.graceSeconds, num(v, 'seconds', 0));
          break;
        case ASTRO_EFFECTS.halo:
          out.halo = true;
          out.haloCap = num(v, 'cap', 0) / 100;
          break;
        case ASTRO_EFFECTS.unbroken:
          out.unbroken = true;
          break;
        case ASTRO_EFFECTS.afterglow:
          out.afterglow = true;
          out.linger = Math.max(out.linger, num(v, 'seconds', 0));
          break;
        case ASTRO_EFFECTS.secondWind:
          out.secondWind = true;
          out.windSeconds = Math.max(out.windSeconds, num(v, 'seconds', 0));
          break;
        default:
          break;
      }
    }
  }
  // The state's own flags (the sim resolved them from the same nodes).
  out.conduit = a.techniquesCostLife;
  out.lifeCap = a.lifeCapPct;
  out.prism = a.lifeCapPct < 1;
  out.any =
    out.grace ||
    out.halo ||
    out.conduit ||
    out.prism ||
    out.unbroken ||
    out.afterglow ||
    out.secondWind;
  return out;
}

/** A shield of one kind on `h` (the sim keeps one per kind), without allocating. */
export function shieldOn(
  h: DeepReadonly<Health> | undefined,
  kind: Shield['kind'],
): DeepReadonly<Shield> | undefined {
  if (!h) return undefined;
  for (let i = 0; i < h.shields.length; i++) if (h.shields[i]!.kind === kind) return h.shields[i];
  return undefined;
}

/**
 * The sim marks Overflowing Grace's own shield (`grace: true`, docs/phase-4.md); render reads the
 * mark when it is there, and otherwise knows the shield by the `graceShield` event that formed it.
 */
export function graceMarked(s: DeepReadonly<Shield> | undefined): boolean {
  return !!s && 'grace' in s && s.grace === true;
}

/**
 * The shield the sim marks as Overflowing Grace's on `h`, if any. Found by its mark, not by
 * kind: should the sim let it stand beside another overshield (a Thimble's), this is still it.
 */
export function graceShieldOn(
  h: DeepReadonly<Health> | undefined,
): DeepReadonly<Shield> | undefined {
  if (!h) return undefined;
  for (let i = 0; i < h.shields.length; i++) if (graceMarked(h.shields[i])) return h.shields[i];
  return undefined;
}

/** `ref` if it is still one of `h`'s shields (by identity), without allocating. */
export function stillOn(
  h: DeepReadonly<Health> | undefined,
  ref: unknown,
): DeepReadonly<Shield> | undefined {
  if (!h || ref === null || ref === undefined) return undefined;
  for (let i = 0; i < h.shields.length; i++) if (h.shields[i] === ref) return h.shields[i];
  return undefined;
}

/**
 * Could Overflowing Grace be feeding this overshield? Only the Weaver's own (a hero's own
 * Aegis Wall is theirs to keep) and never an aura's (the chorus pulse's barrier is the songs').
 */
export function graceCandidate(s: DeepReadonly<Shield> | undefined): boolean {
  return !!s && s.kind === 'overshield' && s.fromWeaver && !s.fromAura;
}

/** How full Overflowing Grace's shield is (1 = at its cap: brimming). */
export function graceFill(amount: number, maxHp: number, cap: number): number {
  const full = maxHp * cap;
  if (full <= 0) return 0;
  const f = amount / full;
  return f < 0 ? 0 : f > 1 ? 1 : f;
}

/**
 * Prism Covenant: the Weaver is at its cap (as full as it lets her be). The sim's own ceiling,
 * `maxHp × lifeCapPct`, with half a point (or half a percent) of slack.
 */
export function atLifeCap(state: WorldState): boolean {
  const cap = state.astrolabe.lifeCapPct;
  if (cap >= 1) return false;
  const h = state.entities.get(state.weaverId)?.health;
  if (!h || h.downed || h.dead) return false;
  const ceiling = h.maxHp * cap;
  return h.hp >= ceiling - Math.max(0.5, h.maxHp * 0.005);
}

/** Afterglow: how much of Empower's linger is left on a hero (1 just after, 0 when it's gone). */
export function afterglowLeft(
  state: WorldState,
  e: ReadonlyEntity | undefined,
  linger: number,
): number {
  const h = e?.hero;
  if (!h || !e.health || e.health.dead || e.health.downed) return 0;
  const left = h.afterglowUntil - state.time;
  if (left <= 0) return 0;
  if (linger <= 0) return 1;
  return left >= linger ? 1 : left / linger;
}

/**
 * How much of a Ward's life is left (1 when cast, 0 when it goes), from the state: `seen` is
 * when render first saw it (a Ward cast in Stasis has its `appliedAt` held with the enemies'
 * clocks, entities.ts), so its shorter life under Shatterproof Halo reads as it is.
 */
export function wardLife(s: DeepReadonly<Shield>, seen: number, time: number): number {
  const total = s.expiresAt - seen;
  if (total <= 1e-6) return 0;
  const left = (s.expiresAt - time) / total;
  return left < 0 ? 0 : left > 1 ? 1 : left;
}

/**
 * Shatterproof Halo held a big hit: since the last look the Ward lost its cap (`max × cap`, the
 * most one hit takes) and absorbed more than it lost (the cap held the rest back). Two smaller
 * hits that add up to the cap absorb no more than they take, so they don't ring.
 */
export function haloHeld(
  before: number,
  amount: number,
  max: number,
  absorbed: number,
  cap: number,
): boolean {
  if (cap <= 0 || max <= 0) return false;
  const lost = before - amount;
  return lost >= max * cap - 0.5 && absorbed > lost + 0.5;
}

/** Techniques with a price (Glide is free; Rewind is paid at Reel's). */
export function costedTechnique(t: string): CostedTechnique | null {
  if (t === 'ward' || t === 'chime' || t === 'reel') return t;
  if (t === 'rewind') return 'reel';
  return null;
}

/** What a technique costs in Life under Eldritch Conduit (the sim's own `techniqueCost`). */
export function lifeCostOf(state: WorldState, technique: string): number {
  const t = costedTechnique(technique);
  if (!t || !state.astrolabe.techniquesCostLife) return 0;
  return techniqueCost(state, t).amount;
}

/** An arc of a circle: its centre angle and half-width (radians, from +x toward +z). */
export interface Arc {
  centre: number;
  half: number;
}

/**
 * Where a Mute's dome (centre `m`, radius `rd`) meets a field (centre `f`, radius `rf`): the arc
 * of the dome's rim inside the field (`dome`) and of the field's rim inside the dome (`field`),
 * each with `half` 0 for none and π for the whole circle. False when they don't touch.
 */
export function domeMeets(
  mx: number,
  mz: number,
  rd: number,
  fx: number,
  fz: number,
  rf: number,
  dome: Arc,
  field: Arc,
): boolean {
  dome.half = 0;
  field.half = 0;
  if (rd <= 0 || rf <= 0) return false;
  const dx = fx - mx;
  const dz = fz - mz;
  // (Not Math.hypot: it allocates in V8, and this runs every frame.)
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d >= rd + rf) return false;
  dome.centre = Math.atan2(dz, dx);
  field.centre = Math.atan2(-dz, -dx);
  if (d + rd <= rf) {
    // The whole dome stands inside the field.
    dome.half = Math.PI;
    return true;
  }
  if (d + rf <= rd) {
    // The whole field stands inside the dome.
    field.half = Math.PI;
    return true;
  }
  const cd = (d * d + rd * rd - rf * rf) / (2 * d * rd);
  const cf = (d * d + rf * rf - rd * rd) / (2 * d * rf);
  dome.half = Math.acos(cd < -1 ? -1 : cd > 1 ? 1 : cd);
  field.half = Math.acos(cf < -1 ? -1 : cf > 1 ? 1 : cf);
  return true;
}
