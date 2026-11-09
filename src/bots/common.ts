import { CONTENT, encounterDef } from '../content';
import {
  CONDUCTOR,
  DISCORD_MAX,
  FINAL_CADENCE,
  FORTISSIMO,
  GRAND_SILENCE,
  HALF_CADENCE,
  MEASURE,
  REST,
} from '../content/crucibleIds';
import { contains, telegraphDamage } from '../sim/combat/telegraphs';
import { quantize } from '../sim/core/dmath';
import { rewindCanRevive } from '../sim/systems/rewind';
import {
  beatAt,
  bloodlusting,
  crescendoCostOf,
  cueCostNow,
  fallingFast,
  gentle,
  onBeat,
  overextended,
  parryArmed,
  parryable,
  replantInField,
  saplingInField,
  segmentDistSq,
  summonsOf,
  suppressRadiusOf,
} from '../sim';
import type {
  Command,
  DeepReadonly,
  FieldZone,
  PartySlot,
  PastSample,
  EntityId,
  ReadonlyEntity,
  Telegraph,
  ThreadMode,
  WorldState,
} from '../sim';

export type ReadonlyTelegraph = DeepReadonly<Telegraph>;

export const MOVE_STEP = 1 / 1024;
export const AIM_STEP = 1 / 16;

export function weaverOf(state: WorldState): ReadonlyEntity {
  return state.entities.get(state.weaverId)!;
}

/**
 * Can the Weaver pay for a technique, keeping `margin` in hand? At the Astrolabe's price, and
 * from her Life with Eldritch Conduit (never down to nothing). Stasis's discount is left out, as
 * the bots always have; with no tree this is exactly `spirit >= cost + margin`.
 */
export function affords(
  state: WorldState,
  technique: 'ward' | 'chime' | 'reel',
  margin = 0,
): boolean {
  const w = weaverOf(state);
  const price = CONTENT.techniques[technique].cost * state.astrolabe.techCostMult + margin;
  return state.astrolabe.techniquesCostLife ? w.health!.hp - price >= 1 : w.weaver!.spirit >= price;
}

/** The slot the Thread will be on once `out` runs: the last `thread` command's, else `current`. */
export function threadingTo(out: readonly Command[], current: PartySlot | null): PartySlot | null {
  for (let i = out.length - 1; i >= 0; i--) {
    const c = out[i]!;
    if (c.t === 'thread') return c.slot;
  }
  return current;
}

/**
 * The commands that move the Thread from `current` to `want`. Bear (the Martyr) has its own
 * toggle, and leaving it returns to the mode it left, so a switch can take two decisions.
 */
export function modeCommands(current: ThreadMode, want: ThreadMode): Command[] {
  if (want === 'bear') return current === 'bear' ? [] : [{ t: 'mode', mode: 'bear' }];
  if (current === 'bear') return [{ t: 'mode', mode: 'bear' }];
  return current === want ? [] : [{ t: 'mode' }];
}

/** Where the Chronomancer's Rewind would send `e`, with the life it would give back. */
export function rewindSample(e: ReadonlyEntity): DeepReadonly<PastSample> | null {
  const h = e.hero;
  return h && h.past.length > 0 ? h.past[h.pastAt]! : null;
}

/**
 * The hero Rewind would help most (the Chronomancer): one who went down since its reach (while
 * its once-a-run revive is unspent), or one it would give back a big share of their life while
 * they're in danger. Null: hold it.
 */
export function rewindPick(
  state: WorldState,
  heroes: readonly HeroView[],
  w: ReadonlyEntity,
  range: number,
): HeroView | null {
  let best: HeroView | null = null;
  let score = 0;
  const revive = rewindCanRevive(state);
  for (const h of heroes) {
    const past = rewindSample(h.e);
    const hp = h.e.health!;
    if (!past || hp.dead || dist(h.e, w) > range - 0.3) continue;
    let s = 0;
    if (hp.downed) s = past.up && revive ? 2 + past.hp / hp.maxHp : 0;
    else {
      const back = (past.hp - hp.hp) / hp.maxHp;
      const danger =
        hp.hp < hp.maxHp * 0.35 ||
        threatsOn(state, h.e).some((t) => damageOf(t, h.e) >= hp.hp + shieldOf(h.e));
      if (back >= 0.35 && danger) s = back;
    }
    if (s > score) {
      best = h;
      score = s;
    }
  }
  return best;
}

export interface HeroView {
  e: ReadonlyEntity;
  slot: PartySlot;
  defId: string;
  role: string;
}

export function partyOf(state: WorldState, includeDowned = false): HeroView[] {
  const out: HeroView[] = [];
  state.party.forEach((id, slot) => {
    const e = state.entities.get(id);
    if (!e?.hero || !e.health || e.health.dead) return;
    if (!includeDowned && e.health.downed) return;
    const def = CONTENT.heroes.find((h) => h.id === e.hero!.defId)!;
    out.push({ e, slot: slot as PartySlot, defId: def.id, role: def.role });
  });
  return out;
}

export function enemiesOf(state: WorldState): ReadonlyEntity[] {
  return state.entities
    .list()
    .filter((e) => e.enemy && e.health && !e.health.dead && e.enemy.state !== 'spawning');
}

export function shieldOf(e: ReadonlyEntity): number {
  let total = 0;
  for (const s of e.health?.shields ?? []) total += s.amount;
  return total;
}

/**
 * HP fraction after shields, the damage already aimed at them, and what their damage-over-time
 * statuses will still deal (Movement II's bleed, pin and latch; none in Movement I).
 */
export function effectiveFraction(e: ReadonlyEntity): number {
  const h = e.health!;
  return (h.hp + shieldOf(e) - h.incoming - dotIncoming(e)) / h.maxHp;
}

export function dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z));
}

export function damaging(t: ReadonlyTelegraph): boolean {
  return t.damage > 0 || t.pctMaxHp > 0;
}

/** Damaging telegraphs that would hit `e` now, soonest first. */
export function threatsOn(state: WorldState, e: ReadonlyEntity): ReadonlyTelegraph[] {
  return state.telegraphs
    .filter((t) => damaging(t) && contains(state, t, e))
    .sort((a, b) => a.impact - b.impact);
}

export function damageOf(t: ReadonlyTelegraph, e: ReadonlyEntity): number {
  return telegraphDamage(t, e);
}

export function statusRemaining(e: ReadonlyEntity, id: string): number {
  const s = e.health?.statuses.find((x) => x.id === id);
  return s ? s.remaining : Infinity;
}

// ── Movement II (docs/phase-5a.md, "Bots and harness") ───────────────────────────────

/** The bleed stacks at which the bots (and the hints) Chime: the content's rule of thumb. */
export const BLEED_CHIME_AT = 5;

/** A status's stacks on `e` (bleed); 0 without it. */
export function statusStacks(e: ReadonlyEntity, id: string): number {
  return e.health?.statuses.find((x) => x.id === id)?.stacks ?? 0;
}

/** Rooted by an Impaler's charge or Vharun's Impale (Reel frees them). */
export function isPinned(e: ReadonlyEntity): boolean {
  return e.health?.statuses.some((x) => x.id === 'pinned') ?? false;
}

/** Held by a Leech's latch (Reel or Chime frees them). */
export function isLatched(e: ReadonlyEntity): boolean {
  return e.health?.statuses.some((x) => x.id === 'latched') ?? false;
}

/** The Leech holding `e`, or null (not latched, or its source is gone). */
export function latchedBy(e: ReadonlyEntity): EntityId | null {
  return e.health?.statuses.find((x) => x.id === 'latched')?.source ?? null;
}

/**
 * The damage `e`'s damage-over-time statuses will still deal if left alone: each status that
 * ticks (bleed, pinned, latched) deals `dps × stacks` a second for its remaining time. 0 when
 * none ticks, which is always so in Movement I.
 */
export function dotIncoming(e: ReadonlyEntity): number {
  let total = 0;
  for (const s of e.health?.statuses ?? []) {
    if (s.dps === undefined) continue;
    total += s.dps * Math.max(1, s.stacks) * s.remaining;
  }
  return total;
}

/**
 * The places worth standing in: the Hollow Cantor's hymn circles, or Vharun's Sanctuary pools
 * under the Bloodmoon. Empty when there are none.
 */
export function zoneFor(state: WorldState): readonly { x: number; z: number; r: number }[] {
  if (state.field.hymnCircles.length > 0) return state.field.hymnCircles;
  return state.field.sanctuary?.pools ?? [];
}

/** Is `p` inside one of `zones`? */
export function inZone(
  zones: readonly { x: number; z: number; r: number }[],
  p: { x: number; z: number },
): boolean {
  return zones.some((z) => dist(z, p) <= z.r);
}

/** Is this a Movement II (or later) fight? Gates the bots' Movement II habits. */
export function laterMovement(state: WorldState): boolean {
  return (encounterDef(state.encounter.id).movement ?? 1) >= 2;
}

/** A Crimson Sentinel's guard that is up (not broken), or null. */
export function guardUp(
  state: WorldState,
  e: ReadonlyEntity,
): { fx: number; fz: number; brokenUntil: number } | null {
  const g = e.enemy?.guard;
  return g && g.brokenUntil <= state.time ? g : null;
}

/**
 * Attacks that strike the same hero again as they land: Twin Cleave's first blow. A reversed
 * follow-up (the Crimson Tide's back sweep) turns on the boss's other side, not on the hero just
 * struck, and the Tide's front is a big hit the forecast already sees, so it isn't counted here.
 * (Some telegraphs, a Volatile burst, have no def.)
 */
const FOLLOWED = new Set(
  CONTENT.attacks.filter((a) => a.followUp && !a.followUp.reverse).map((a) => a.id),
);

/** A telegraph whose attack strikes its hero again as it lands (Twin Cleave's first blow). */
export function hasFollowUp(t: ReadonlyTelegraph): boolean {
  return FOLLOWED.has(t.attackId);
}

/** A Blood Pact link (Scatter answers it; Chime can't). */
export function isPact(t: ReadonlyTelegraph): boolean {
  return t.kind === 'link' && t.linkStatus === 'pact';
}

/** Emits move/aim only when they change, quantised like the input layer. */
export class Intent {
  private lastMove = { x: Number.NaN, z: Number.NaN };
  private lastAim = { x: Number.NaN, z: Number.NaN };

  move(out: Command[], x: number, z: number): void {
    const m = Math.sqrt(x * x + z * z);
    let mx = 0;
    let mz = 0;
    if (m > 1e-6) {
      mx = quantize(x / Math.max(1, m), MOVE_STEP);
      mz = quantize(z / Math.max(1, m), MOVE_STEP);
    }
    if (mx === this.lastMove.x && mz === this.lastMove.z) return;
    this.lastMove = { x: mx, z: mz };
    out.push({ t: 'move', x: mx, z: mz });
  }

  /** Move toward a point, easing in over the last metre. */
  moveTo(
    out: Command[],
    from: { x: number; z: number },
    to: { x: number; z: number },
    deadzone = 0.4,
  ): void {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < deadzone) return this.move(out, 0, 0);
    const k = d < 1.5 ? d / 1.5 : 1;
    this.move(out, (dx / d) * k, (dz / d) * k);
  }

  aim(out: Command[], x: number, z: number): void {
    const ax = quantize(x, AIM_STEP);
    const az = quantize(z, AIM_STEP);
    if (ax === this.lastAim.x && az === this.lastAim.z) return;
    this.lastAim = { x: ax, z: az };
    out.push({ t: 'aim', x: ax, z: az });
  }
}

export function centroid(points: readonly { x: number; z: number }[]): { x: number; z: number } {
  if (points.length === 0) return { x: 0, z: 0 };
  let x = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    z += p.z;
  }
  return { x: x / points.length, z: z / points.length };
}

/** A point outside the telegraph's shape, near `e` (for dodging). */
export function escapeFrom(
  t: ReadonlyTelegraph,
  e: { x: number; z: number },
  margin: number,
): { x: number; z: number } | null {
  const s = t.shape;
  if (s.kind === 'circle' || s.kind === 'cone') {
    const dx = e.x - s.x;
    const dz = e.z - s.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    return { x: s.x + (dx / d) * (s.r + margin), z: s.z + (dz / d) * (s.r + margin) };
  }
  if (s.kind === 'line') {
    const lx = s.toX - s.x;
    const lz = s.toZ - s.z;
    const l = Math.sqrt(lx * lx + lz * lz) || 1;
    const nx = -lz / l;
    const nz = lx / l;
    const side = (e.x - s.x) * nx + (e.z - s.z) * nz >= 0 ? 1 : -1;
    const off = s.width / 2 + margin;
    const along = ((e.x - s.x) * lx + (e.z - s.z) * lz) / l;
    return {
      x: s.x + (lx / l) * along + nx * side * off,
      z: s.z + (lz / l) * along + nz * side * off,
    };
  }
  if (s.kind === 'donut') {
    const dx = e.x - s.x;
    const dz = e.z - s.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    const r = Math.max(0, s.innerR - margin);
    return { x: s.x + (dx / d) * r, z: s.z + (dz / d) * r };
  }
  return null;
}

// ── Calls, holds, planted fields and the beam song ────────────────────────────────────

/** The hero with an open, unanswered call, if any. */
export function caller(party: readonly HeroView[]): HeroView | null {
  return party.find((h) => h.e.hero!.call && !h.e.hero!.call.answered) ?? null;
}

/** A hero hanging on in a Fermata hold (heal them!), if any. */
export function heldHero(party: readonly HeroView[]): HeroView | null {
  return party.find((h) => h.e.hero!.hold) ?? null;
}

export function plantedChord(state: WorldState): WorldState['field']['chords'][number] | null {
  return state.field.chords.find((c) => c.anchor === 'planted') ?? null;
}

/** The beam song (Chord I), if it has any auras. */
export function beamSong(state: WorldState): WorldState['field']['chords'][number] | null {
  return state.field.chords.find((c) => c.role === 'beam' && c.auras.length > 0) ?? null;
}

const DEFENSIVE_AURAS = new Set(['sostenuto', 'ostinato', 'fermata']);

/** A beam song of mostly defensive auras belongs on the tank; mixed or offensive, on a striker. */
export function defensiveSong(chord: { auras: readonly string[] }): boolean {
  return chord.auras.filter((a) => DEFENSIVE_AURAS.has(a)).length * 2 > chord.auras.length;
}

/** Where to plant a Pedal Point field: the party's centre, pulled toward the tank. */
export function plantSpot(party: readonly HeroView[]): { x: number; z: number } {
  let x = 0;
  let z = 0;
  let w = 0;
  for (const h of party) {
    const k = h.role === 'tank' ? 2 : 1;
    x += h.e.x * k;
    z += h.e.z * k;
    w += k;
  }
  return w > 0 ? { x: x / w, z: z / w } : { x: 0, z: 0 };
}

export function plantCommand(at: { x: number; z: number }): Command {
  return { t: 'plant', point: { x: quantize(at.x, AIM_STEP), z: quantize(at.z, AIM_STEP) } };
}

// ── Brann, the Bloodsworn (docs/phase-5b.md, "Bots and harness") ─────────────────────

/** The party's hero with this def, or null (a slot by defId: the roster moves keys). */
export function heroByDef(party: readonly HeroView[], defId: string): HeroView | null {
  return party.find((h) => h.defId === defId) ?? null;
}

/** The slot of the party's hero with this def, or null when it isn't in the party. */
export function slotOf(state: WorldState, defId: string): PartySlot | null {
  const slot = state.party.findIndex((id) => state.entities.get(id)?.hero?.defId === defId);
  return slot < 0 ? null : (slot as PartySlot);
}

/** Below this effective life the bots Mend Brann; above it he's where he fights best. */
export const BRANN_FLOOR = 0.25;
/** With Berserker's Hymn the bots let him sit lower: his healthy band is 0.15–0.30. */
export const BRANN_HYMN_FLOOR = 0.15;

/**
 * What the bots read of a Blood Rage hero (Brann), through the sim's own rules
 * (`bloodlusting`, `fallingFast`): where he stands against his 40% line, whether he'd refuse a
 * Rally, whether he's dropping faster than he has life, and whether a hit on the way would kill
 * him.
 */
export interface BloodView {
  hero: HeroView;
  /** Below his quirk's line (40%): Bloodlust, Blood Tithe and the Ward-first rule hold. */
  low: boolean;
  /** Bloodlust holds now: he won't come back for a Rally. */
  lusting: boolean;
  fast: boolean;
  /** A telegraph on him (an Execution aside) would take more than his life and shields. */
  lethal: boolean;
  /** The effective life the bots Mend him up to (BRANN_FLOOR, or the Hymn's band). */
  floor: number;
}

/** The party's Blood Rage hero, read for the bots; null without one (every default party). */
export function bloodOf(state: WorldState, party: readonly HeroView[]): BloodView | null {
  const hero = party.find((h) => h.e.hero!.blood !== undefined);
  if (!hero) return null;
  const e = hero.e;
  const h = e.health!;
  const below = CONTENT.heroes.find((d) => d.id === hero.defId)?.quirk.below ?? 0;
  return {
    hero,
    low: h.hp < h.maxHp * below,
    lusting: bloodlusting(CONTENT, e),
    fast: fallingFast(e),
    // An Execution isn't counted: a Ward or a Reel answers it, never a Mend his cut halves.
    lethal: threatsOn(state, e).some(
      (t) => t.executeBelow === undefined && damageOf(t, e) >= h.hp + shieldOf(e),
    ),
    floor: e.hero!.talents.includes('berserkers_hymn') ? BRANN_HYMN_FLOOR : BRANN_FLOOR,
  };
}

/**
 * The bots' Mend need for a hero (lower is more urgent): its effective life, except that Brann
 * reads as healthy (1) while he holds his floor, isn't falling fast and no lethal hit is on him.
 */
export function mendNeed(h: HeroView, blood: BloodView | null): number {
  const f = effectiveFraction(h.e);
  if (!blood || blood.hero.slot !== h.slot) return f;
  return f >= blood.floor && !blood.fast && !blood.lethal ? 1 : f;
}

// ── Seren and Oro (docs/phase-5e.md, "Bots and harness") ─────────────────────────────
// Each reader answers null or empty without its hero, through the sim's own pure rules
// (`parryArmed`, `parryable`, `overextended`, `gentle`, `saplingInField`), and draws nothing,
// so no other party's decision reads anything new.

export { summonsOf } from '../sim';

/** How near (beyond its reach) an enemy on Seren counts as about to swing at her (m). */
const SWING_SLACK = 1;

/** A parryable blow on its way to a hero: a basic melee swing at her, or a cone aimed at her. */
export interface NextSwing {
  /** The enemy swinging. */
  source: ReadonlyEntity;
  /** The sim time it lands (a swing: once its attack cooldown runs out). */
  at: number;
  /** The cone's telegraph; null for a basic melee swing. */
  telegraph: ReadonlyTelegraph | null;
}

/**
 * Every parryable blow on its way to `e`, soonest first (then by source id): a cone telegraph of
 * `PARRY_REACH` m or less whose target is her (docs/phase-5e.md, "Parry: what is melee"), and
 * each basic melee swing of an enemy on her within its reach (+`SWING_SLACK`), due when its
 * attack cooldown runs out. A stunned, sleeping, staggered or casting enemy swings at nobody.
 */
export function parryableBlows(state: WorldState, e: ReadonlyEntity): NextSwing[] {
  const out: NextSwing[] = [];
  for (const t of state.telegraphs) {
    if (t.target !== e.id || t.kind !== 'cleave' || !damaging(t)) continue;
    if (!parryable(ATTACK_DEFS.get(t.attackId))) continue;
    const source = state.entities.get(t.owner);
    if (source?.enemy) out.push({ source, at: t.impact, telegraph: t });
  }
  for (const m of state.entities.list()) {
    const c = m.enemy;
    if (!c || c.targetId !== e.id || c.cast || !m.health || m.health.dead) continue;
    if (c.state === 'spawning') continue;
    const def = ENEMY_DEFS.get(c.defId);
    if (!def || def.basic.kind !== 'melee') continue;
    if (m.health.statuses.some((s) => HELD.has(s.id))) continue;
    const reach = def.basic.range + m.radius + e.radius + SWING_SLACK;
    if (dist(m, e) > reach) continue;
    out.push({ source: m, at: state.time + Math.max(0, c.attackCooldown), telegraph: null });
  }
  return out.sort((a, b) => a.at - b.at || a.source.id - b.source.id);
}

/** Statuses that stop an enemy swinging. */
const HELD: ReadonlySet<string> = new Set(['stun', 'stagger', 'sleep']);

/** The next parryable blow on its way to `e` (`parryableBlows`' soonest), or null. */
export function nextSwing(state: WorldState, e: ReadonlyEntity): NextSwing | null {
  return parryableBlows(state, e)[0] ?? null;
}

/** What the bots read of Seren, the Riposte (docs/phase-5e.md, "Readers"). */
export interface DuelView {
  seren: HeroView;
  /** En garde: a Weaver Ward (or Blade Waltz) is on her, so her next parryable blow is parried. */
  armed: boolean;
  /** Her Showboat duel's target while it stands; null without one. */
  quarry: ReadonlyEntity | null;
  /** The next parryable blow on its way to her; null without one. */
  nextSwing: NextSwing | null;
  /** Surrounded (3+ enemies on her) or low outside every field, while duelling. */
  overextended: boolean;
}

/** The party's standing duellist (Seren), read for the bots; null without her. */
export function duelOf(state: WorldState, party: readonly HeroView[]): DuelView | null {
  const seren = party.find((h) => h.e.hero!.duel !== undefined);
  if (!seren) return null;
  const duel = seren.e.hero!.duel!;
  const q = duel.quarry === null ? undefined : state.entities.get(duel.quarry);
  const quarry = q?.enemy && q.health && !q.health.dead ? q : null;
  return {
    seren,
    armed: parryArmed(seren.e),
    quarry,
    nextSwing: nextSwing(state, seren.e),
    overextended: overextended(state, seren.e),
  };
}

/** A Sapling below this share of its life is hurt (the Thread on Oro Mends it at half). */
export const SAPLING_HURT = 0.7;

/** What the bots read of Oro, the Grovekeeper (docs/phase-5e.md, "Readers"). */
export interface GroveView {
  oro: HeroView;
  /** His standing Saplings, in entity order. */
  saplings: ReadonlyEntity[];
  /** The Ancient while it stands; else null. */
  ancient: ReadonlyEntity | null;
  /** The share of his awake, planted Saplings standing in your field (1 with none). */
  inFieldShare: number;
  /** His awake, planted Saplings standing outside your field. */
  outside: ReadonlyEntity[];
  /** Some Sapling is below `SAPLING_HURT` of its life. */
  hurt: boolean;
  /** The lowest life share among his Saplings (1 with none). */
  lowest: number;
  /** Gentle: no Focus stands, so he tends rather than fights. */
  tending: boolean;
}

/**
 * A Rally would bring at least one of `saplings` (his, outside your field) home: its re-plant
 * spot at the Weaver's front stands inside your field now (`replantInField`). False when no
 * re-plant can land in it (her songs too small to reach 4 m ahead of her, a mute dome over her
 * front); so a Rally isn't spent every few seconds for nothing. Through the Silent Verse the
 * spots are drawn into the hymn circle she stands in (`frontSpot`), so it holds. Draws nothing.
 */
export function rallyBringsHome(
  state: WorldState,
  grove: GroveView,
  saplings: readonly ReadonlyEntity[],
): boolean {
  const ids = grove.oro.e.hero!.grove!.saplings;
  return saplings.some((s) => {
    const i = ids.indexOf(s.id);
    return i >= 0 && replantInField(state, grove.oro.e, i);
  });
}

/** A summon held (dormant, Oro down or the Grand Silence) or burrowing (a Rally's re-plant). */
function settling(state: WorldState, s: ReadonlyEntity): boolean {
  const c = s.summon!;
  return c.dormant === true || (c.burrowUntil !== undefined && c.burrowUntil > state.time);
}

/** The party's standing summoner (Oro), read for the bots; null without him. */
export function groveOf(state: WorldState, party: readonly HeroView[]): GroveView | null {
  const oro = party.find((h) => h.e.hero!.grove !== undefined);
  if (!oro) return null;
  const mine = summonsOf(state, oro.e.id);
  const saplings = mine.filter((s) => s.summon!.kind === 'sapling');
  const ancient = mine.find((s) => s.summon!.kind === 'ancient') ?? null;
  const outside: ReadonlyEntity[] = [];
  let planted = 0;
  let lowest = 1;
  for (const s of saplings) {
    lowest = Math.min(lowest, s.health!.hp / s.health!.maxHp);
    if (settling(state, s)) continue;
    planted++;
    if (!saplingInField(state, s)) outside.push(s);
  }
  return {
    oro,
    saplings,
    ancient,
    inFieldShare: planted === 0 ? 1 : (planted - outside.length) / planted,
    outside,
    hurt: lowest < SAPLING_HURT,
    lowest,
    tending: gentle(state, oro.e),
  };
}

/** A hero who joined the roster (not one of the content's default party: Brann, Seren, Oro). */
export function isRecruit(defId: string): boolean {
  return !CONTENT.defaultParty.includes(defId);
}

// ── Movement III (docs/phase-5c.md, "Bots and harness") ──────────────────────────────
// Every reader below reads public state and content only, and answers null, false, 0 or an
// empty list when its mechanic is absent, so no Movement I or II decision reads anything new.

export { cutWouldLand, threadSegment } from '../sim';
/** Doom's stacks at which the bots (and the hints) Chime: the content's rule of thumb. */
export { DOOM_CHIME_AT } from '../content/unstitched';

const ATTACK_DEFS = new Map(CONTENT.attacks.map((a) => [a.id, a]));
const ENEMY_DEFS = new Map(CONTENT.enemies.map((e) => [e.id, e]));
const AFFIX_DEFS = new Map(CONTENT.affixes.map((f) => [f.id, f]));

/** A ground circle: a zone, a tell, a rune. */
export interface Circle {
  x: number;
  z: number;
  r: number;
}

/** A telegraph whose attack cuts the Thread (the Shears, the Snip, the Unpick). */
export function isCut(t: ReadonlyTelegraph): boolean {
  return ATTACK_DEFS.get(t.attackId)?.cut !== undefined;
}

/**
 * `cutWouldLand` with room to spare: would this cut line reach the Thread on `slot` were it
 * `margin` m wider? The Weaver and her hero keep moving until it lands, so a Thread that only
 * just clears it now may not then. False for anything that isn't a cut line.
 */
export function cutThreatens(
  state: WorldState,
  t: ReadonlyTelegraph,
  slot: PartySlot | null,
  margin: number,
): boolean {
  const cut = ATTACK_DEFS.get(t.attackId)?.cut;
  const s = t.shape;
  if (!cut || slot === null || s.kind !== 'line') return false;
  const w = state.entities.get(state.weaverId);
  const id = state.party[slot];
  const hero = id === undefined ? undefined : state.entities.get(id);
  if (!w || !hero?.health || hero.health.dead) return false;
  const half = s.width / 2 + margin;
  return segmentDistSq(s.x, s.z, s.toX, s.toZ, w.x, w.z, hero.x, hero.z) <= half * half;
}

/** The cut telegraphs aimed along a line (every cut but the Unpick's), soonest first. */
export function cutLines(state: WorldState): ReadonlyTelegraph[] {
  return state.telegraphs
    .filter((t) => t.shape.kind === 'line' && isCut(t) && !ATTACK_DEFS.get(t.attackId)!.cut!.always)
    .sort((a, b) => a.impact - b.impact);
}

/** The timed zones on the field (the Inhale's pull, the Null rune), oldest first; or none. */
export function hazardZones(state: WorldState): readonly DeepReadonly<FieldZone>[] {
  return state.field.zones ?? [];
}

/** Is `p` inside a Null rune (a `null` zone)? */
export function inNullZone(state: WorldState, p: { x: number; z: number }): boolean {
  return hazardZones(state).some((z) => z.kind === 'null' && dist(z, p) <= z.r);
}

/** Is `p` inside an Inhale's pull (a `pull` zone)? */
export function inPullZone(state: WorldState, p: { x: number; z: number }): boolean {
  return hazardZones(state).some((z) => z.kind === 'pull' && dist(z, p) <= z.r);
}

/** The telegraphs that will lay a zone of this kind as they land (their tells), as circles. */
function zoneTells(state: WorldState, kind: 'pull' | 'null'): (Circle & { impact: number })[] {
  const out: (Circle & { impact: number })[] = [];
  for (const t of state.telegraphs) {
    if (t.shape.kind !== 'circle' || ATTACK_DEFS.get(t.attackId)?.zone?.kind !== kind) continue;
    out.push({ x: t.shape.x, z: t.shape.z, r: t.shape.r, impact: t.impact });
  }
  return out;
}

/** The Void Maws' Inhales in their tell: where each pull will be, and when. Empty without one. */
export function inhaleTell(state: WorldState): (Circle & { impact: number })[] {
  return zoneTells(state, 'pull');
}

/** The Null runes closing (their tells), where each will form. Empty without one. */
export function closingRunes(state: WorldState): (Circle & { impact: number })[] {
  return zoneTells(state, 'null');
}

/** A point `margin` outside `c`, straight out from its centre through `p` (+x from dead centre). */
export function outOf(
  c: Circle,
  p: { x: number; z: number },
  margin: number,
): { x: number; z: number } {
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const ux = d > 1e-6 ? dx / d : 1;
  const uz = d > 1e-6 ? dz / d : 0;
  return { x: c.x + ux * (c.r + margin), z: c.z + uz * (c.r + margin) };
}

/**
 * Where to step to leave the Null rune (laid, or closing) that `p` stands deepest in: straight
 * out from its centre, `margin` past its edge. Null when it stands in none.
 */
export function runeEscape(
  state: WorldState,
  p: { x: number; z: number },
  margin = 1,
): { x: number; z: number } | null {
  let worst: Circle | null = null;
  let depth = 0;
  const runes: Circle[] = [
    ...hazardZones(state).filter((z) => z.kind === 'null'),
    ...closingRunes(state),
  ];
  for (const c of runes) {
    const d = c.r - dist(c, p);
    if (d >= 0 && (worst === null || d > depth)) {
      worst = c;
      depth = d;
    }
  }
  return worst ? outOf(worst, p, margin) : null;
}

/** Possessed by a Doubt Wraith: disabled, and striking an ally (a Chime frees them). */
export function isPossessed(e: ReadonlyEntity): boolean {
  return e.health?.statuses.some((x) => x.id === 'possessed') ?? false;
}

/** Sewn to the floor by the Seamstress's Stitch (a Chime frees; a Reel frees the one it pulls). */
export function isStitched(e: ReadonlyEntity): boolean {
  return e.health?.statuses.some((x) => x.id === 'stitched') ?? false;
}

/** How soon a Needle Rain circle must land for `walksIntoLanding` to steer round it (s). */
const LANDING_LOOKAHEAD = 1.5;
/** The room she keeps from its edge (m). */
const LANDING_MARGIN = 0.4;

/**
 * A circle a Movement III attacker drops on a hero (Needle Rain) that lands within
 * `LANDING_LOOKAHEAD` s on the stretch from `w` toward `goal` she can walk before it lands. The
 * Weaver keeps to her party, so without it she follows a hero into the needle meant for them.
 * A circle she already stands in is left to the dodge. Null without one: always before
 * Movement III, whose attackers alone are read.
 */
export function walksIntoLanding(
  state: WorldState,
  w: ReadonlyEntity,
  goal: { x: number; z: number },
): ReadonlyTelegraph | null {
  const dx = goal.x - w.x;
  const dz = goal.z - w.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) return null;
  const ux = dx / d;
  const uz = dz / d;
  for (const t of state.telegraphs) {
    const s = t.shape;
    if (t.kind !== 'burst' || s.kind !== 'circle' || !damaging(t)) continue;
    const left = t.impact - state.time;
    if (left < 0 || left > LANDING_LOOKAHEAD) continue;
    const owner = state.entities.get(t.owner)?.enemy?.defId;
    if ((ENEMY_DEFS.get(owner ?? '')?.movement ?? 1) < 3) continue;
    if (contains(state, t, w)) continue;
    const reach = Math.min(d, CONTENT.weaver.moveSpeed * left + LANDING_MARGIN);
    let u = (s.x - w.x) * ux + (s.z - w.z) * uz;
    u = u < 0 ? 0 : u > reach ? reach : u;
    const px = w.x + ux * u - s.x;
    const pz = w.z + uz * u - s.z;
    const r = s.r + w.radius + LANDING_MARGIN;
    if (px * px + pz * pz <= r * r) return t;
  }
  return null;
}

/** Doom's stacks on `e` (Doom-touched); 0 without it. */
export function doomStacks(e: ReadonlyEntity): number {
  return statusStacks(e, 'doom');
}

/** A telegraph that leaves its hero possessed when it lands (the Doubt Wraith's mark). */
export function possessesOnHit(t: ReadonlyTelegraph): boolean {
  return ATTACK_DEFS.get(t.attackId)?.status?.id === 'possessed';
}

/** A mirror being cast (a Mimic, a Mimicking elite), with the copy its cast bar shows. */
export interface MimicCast {
  e: ReadonlyEntity;
  copy: 'empower' | 'ward' | 'chime';
  /** When its cast ends. */
  end: number;
}

/** Every mirror being cast now. Empty without one. */
export function mimicCasting(enemies: readonly ReadonlyEntity[]): MimicCast[] {
  const out: MimicCast[] = [];
  for (const e of enemies) {
    const c = e.enemy!;
    if (c.mimic && c.cast) out.push({ e, copy: c.mimic.copy, end: c.cast.end });
  }
  return out;
}

/** An enemy that never moves (its def is `stationary`: a Void Maw, a Spindle). */
export function stationary(e: ReadonlyEntity): boolean {
  return ENEMY_DEFS.get(e.enemy?.defId ?? '')?.stationary === true;
}

/** No standing hero has a target: the party stands idle. */
export function idleParty(state: WorldState): boolean {
  return state.party.every((id) => {
    const h = state.entities.get(id);
    return !h?.hero || !h.health || h.health.downed || h.health.dead || h.hero.targetId === null;
  });
}

/** `StallWatch`: how long the party must be stalled, and how much nearer counts as progress. */
export const STALL_FOR = 3;
const STALL_PROGRESS = 1;

/**
 * A hero who has a stationary target (a Void Maw, a Spindle) but can't reach it: out of their
 * basic attack's reach and neither attacking nor casting. A ranged hero held at her leash from
 * the Weaver keeps the Maw as her target and never comes within range of it.
 */
function stalledOnStationary(state: WorldState, h: ReadonlyEntity): boolean {
  const hero = h.hero!;
  const target = hero.targetId === null ? undefined : state.entities.get(hero.targetId);
  if (!target || !stationary(target)) return false;
  if (hero.action === 'attacking' || hero.action === 'casting' || hero.action === 'channeling')
    return false;
  const range = CONTENT.heroes.find((d) => d.id === hero.defId)?.attack.range ?? 0;
  return dist(h, target) > range + target.radius + h.radius;
}

/**
 * The party is stalled on stationary enemies (docs/phase-5c.md, `focusStationary`): every
 * standing hero is idle (no target) or stalled on a stationary target out of reach, and at least
 * one is stalled (with none, `idleParty` already says so). It reports a stall only once it has
 * lasted `STALL_FOR` s with no stalled hero coming `STALL_PROGRESS` m nearer their target (a
 * melee hero walking up to a Maw is not stalled). Pure reading: no RNG, and false whenever no
 * hero targets a stationary enemy, so it never answers outside Movement III.
 */
export class StallWatch {
  private since: number | null = null;
  private nearest = Infinity;

  /** Call once per decision (it times the stall); true once it has lasted `STALL_FOR` s. */
  update(state: WorldState, now: number): boolean {
    let nearest = Infinity;
    let stalled = false;
    for (const id of state.party) {
      const h = state.entities.get(id);
      if (!h?.hero || !h.health || h.health.downed || h.health.dead) continue;
      if (h.hero.targetId === null) continue;
      if (!stalledOnStationary(state, h)) {
        this.since = null;
        return false;
      }
      stalled = true;
      nearest = Math.min(nearest, dist(h, state.entities.get(h.hero.targetId)!));
    }
    if (!stalled) {
      this.since = null;
      return false;
    }
    if (this.since === null || nearest < this.nearest - STALL_PROGRESS) {
      this.since = now;
      this.nearest = nearest;
    }
    return now - this.since >= STALL_FOR;
  }
}

/** The stationary enemy (its def `stationary`) nearest the Weaver; null without one. */
export function nearestStationary(
  state: WorldState,
  enemies: readonly ReadonlyEntity[],
): ReadonlyEntity | null {
  const w = weaverOf(state);
  let best: ReadonlyEntity | null = null;
  for (const e of enemies) if (stationary(e) && (!best || dist(e, w) < dist(best, w))) best = e;
  return best;
}

/** The standing Spindles (adds whose def is `tether`): the boss takes less while any stands. */
export function spindlesUp(enemies: readonly ReadonlyEntity[]): ReadonlyEntity[] {
  return enemies.filter((e) => ENEMY_DEFS.get(e.enemy!.defId)?.tether !== undefined);
}

/** The Stolen Verse running with an aura (`field.stolen`), while it stands; else null. */
export function stolenVerse(state: WorldState): ReadonlyEntity | null {
  const id = state.field.stolen?.add;
  const e = id === undefined ? undefined : state.entities.get(id);
  return e?.enemy && e.health && !e.health.dead && e.enemy.state !== 'spawning' ? e : null;
}

/** The enemy Mirror Weave weaves, and the boss's interruptible cast on it. */
export const CHAMPION_DEF = 'mirror_champion';
export const MIRROR_WARD_ATTACK = 'unweaver_mirror_ward';

/** The Unweaver's Hollow Champion while it stands; else null. */
export function champion(enemies: readonly ReadonlyEntity[]): ReadonlyEntity | null {
  return enemies.find((e) => e.enemy!.defId === CHAMPION_DEF) ?? null;
}

/** The enemy casting a Mirror Ward now (interrupt it); else null. */
export function mirrorWardCasting(enemies: readonly ReadonlyEntity[]): ReadonlyEntity | null {
  return enemies.find((e) => e.enemy!.cast?.attackId === MIRROR_WARD_ATTACK) ?? null;
}

/** Unravel's window (`field.unravel`: Mend wounds) while it is open; else null. */
export function unravelUp(state: WorldState): { until: number } | null {
  const u = state.field.unravel;
  return u ? { until: u.until } : null;
}

/**
 * An enemy carrying a Mute's aura suppression: the Mute itself, or a Silencing elite. It
 * replaces the bots' `defId === 'mute'`; in Movements I and II only the Mute qualifies.
 */
export function suppresses(state: WorldState, e: ReadonlyEntity): boolean {
  return suppressRadiusOf(state, e) > 0;
}

/** An elite carrying a Mute's field by its affix (Silencing), not by its own def. */
export function carriesSilence(e: ReadonlyEntity): boolean {
  const affixes = e.enemy?.affixes;
  if (!affixes) return false;
  return affixes.some((id) => (AFFIX_DEFS.get(id)?.suppressRadius ?? 0) > 0);
}

/** The reach of a Severing elite's cut around the Thread (its affix's radius); else null. */
export function severingReach(e: ReadonlyEntity): number | null {
  const affixes = e.enemy?.affixes;
  if (!affixes) return null;
  for (const id of affixes) {
    const cut = AFFIX_DEFS.get(id)?.cut;
    if (cut) return cut.radius;
  }
  return null;
}

// ── The Finale (docs/phase-5d.md, "Bots and harness") ────────────────────────────────
// Every reader below reads public state and content only (`field.finale`, the `stilled` status,
// the Conductor's telegraphs), and answers null, false or an empty list outside the Silent
// Conductor's fight, so no Movement I-III decision reads anything new.

/** Discord at which the Skilled bot banks its Crescendo for Fortissimo Silence, whatever its rise. */
export const FINALE_BANK_AT = 60;

/** The Grand Silence's program: the blows the notes are made on. */
const SILENCE_PROGRAM: ReadonlySet<string> = new Set([REST, MEASURE, FINAL_CADENCE, HALF_CADENCE]);
const FORTISSIMO_IDS: ReadonlySet<string> = new Set(FORTISSIMO);

/** The Conductor's Discord: its value (0-100), its rise a second, and the seconds until 100. */
export interface DiscordView {
  value: number;
  rate: number;
  /** Seconds until it reaches 100 at its present rise: 0 at 100, Infinity with no rise. */
  eta: number;
}

/** The Conductor's Discord while it stands (phases 1-2); null without it. */
export function discordOf(state: WorldState): DiscordView | null {
  const d = state.field.finale?.discord;
  if (!d) return null;
  const left = DISCORD_MAX - d.value;
  return {
    value: d.value,
    rate: d.rate,
    eta: left <= 0 ? 0 : d.rate > 0 ? left / d.rate : Infinity,
  };
}

/** Fortissimo Silence being played: the pulse winding up and when it lands. */
export interface FortissimoView {
  pulse: 1 | 2 | 3;
  impact: number;
  /** When that pulse began winding up (its telegraph's start); null without the telegraph. */
  start: number | null;
}

/** Fortissimo Silence while it is played; null without it (and always outside the Finale). */
export function fortissimoLive(state: WorldState): FortissimoView | null {
  const f = state.field.finale?.fortissimo;
  if (!f) return null;
  const id = FORTISSIMO[f.pulse - 1];
  const t = state.telegraphs.find((x) => x.attackId === id);
  return { pulse: f.pulse, impact: f.impact, start: t ? t.start : null };
}

/** A telegraph of Fortissimo Silence (any of its three pulses). */
export function isFortissimo(t: ReadonlyTelegraph): boolean {
  return FORTISSIMO_IDS.has(t.attackId);
}

/** A Cue of the Conductor's: its soloist and Solo, and the Solo's target once it has begun. */
export interface CueView {
  boss: EntityId;
  soloist: EntityId;
  /** The Solo's attack id (`SOLOS[voice]`). */
  solo: string;
  /** The hero the Solo is aimed at, once it has begun; null before. */
  target: EntityId | null;
  /** The Solo has begun: its telegraph is live. */
  singing: boolean;
  /** When the Solo lands: its telegraph's impact once begun, else the Cue's end + its windup. */
  impact: number;
}

/** A Solo's windup when its def isn't there to say (docs/phase-5d.md: every Solo is 2.5 s). */
const SOLO_WINDUP = 2.5;

/** The Conductor's live Cue (its cast, then the Solo it begins); null without one. */
export function cueOf(state: WorldState): CueView | null {
  const c = state.field.finale?.cue;
  if (!c) return null;
  const t = state.telegraphs.find((x) => x.owner === c.soloist && x.attackId === c.solo);
  const windup = ATTACK_DEFS.get(c.solo)?.windup ?? SOLO_WINDUP;
  return {
    boss: c.boss,
    soloist: c.soloist,
    solo: c.solo,
    target: c.target ?? t?.target ?? null,
    singing: t !== undefined,
    impact: t ? t.impact : c.until + windup,
  };
}

/** The Grand Silence as it holds: the notes so far, of 8, and its cap. */
export type SilenceView = NonNullable<NonNullable<WorldState['field']['finale']>['silence']>;

/** The Grand Silence while it holds; null without it. */
export function silenceOf(state: WorldState): SilenceView | null {
  return state.field.finale?.silence ?? null;
}

/** Stilled by the Grand Silence (only the Conductor applies it). */
export function isStilled(e: ReadonlyEntity): boolean {
  return e.health?.statuses.some((x) => x.id === 'stilled') ?? false;
}

/** A blow of the Grand Silence's program (the Rest, the Measure, either Cadence). */
export function isSilenceBlow(t: ReadonlyTelegraph): boolean {
  return SILENCE_PROGRAM.has(t.attackId);
}

/** A Cadence of the Grand Silence (the Final or the Half). */
export function isCadence(t: ReadonlyTelegraph): boolean {
  return t.attackId === FINAL_CADENCE || t.attackId === HALF_CADENCE;
}

/** The Silent Conductor while it stands (the fight's boss), or null: outside its fight. */
function conductorOf(state: WorldState): ReadonlyEntity | null {
  const id = state.encounter.bossId;
  if (id === null) return null;
  const boss = state.entities.get(id);
  if (!boss?.enemy || boss.enemy.defId !== CONDUCTOR || boss.health?.dead) return null;
  return boss;
}

/** Some hero of the party is stilled by the Grand Silence. */
function anyStilled(state: WorldState): boolean {
  return state.party.some((p) => {
    const h = state.entities.get(p);
    return h !== undefined && isStilled(h);
  });
}

/**
 * The last burn: the Silent Conductor in its last phase with the Grand Silence over (after
 * Reignite or the Coda), not still being cast and no hero stilled. `silenceSeen` is whether this
 * fight's Grand Silence has been seen to hold (`SilenceWatch`): phase 3 alone is not enough, as
 * the phase shift (and any gap before the cast) comes before the silence, and a Solo Cued there
 * would be frozen. False outside its fight.
 */
export function finaleBurn(state: WorldState, silenceSeen: boolean): boolean {
  if (!silenceSeen) return false;
  const c = conductorOf(state)?.enemy;
  if (!c) return false;
  if (c.phase < 3 || state.field.finale?.silence || c.cast?.attackId === GRAND_SILENCE)
    return false;
  return !anyStilled(state);
}

/**
 * A bot's memory of the Grand Silence (docs/phase-5d.md): whether this fight's silence has been
 * seen to hold (the silence itself, or a stilled hero) since the Conductor was last seen before
 * its last phase. A new fight (or no Conductor) forgets it. Read-only and without RNG: outside
 * the Finale it stays false and changes nothing.
 */
export class SilenceWatch {
  private seen = false;

  /** Looks at this tick's state; call it every tick the bot is asked (cheap, no draws). */
  observe(state: WorldState): void {
    const c = conductorOf(state)?.enemy;
    if (!c || c.phase < 3) this.seen = false;
    else if (state.field.finale?.silence || anyStilled(state)) this.seen = true;
  }

  /** The last burn, by `finaleBurn`, once the silence has been seen. */
  burn(state: WorldState): boolean {
    return finaleBurn(state, this.seen);
  }
}

// ── The Conductor (docs/phase-5f.md, "Bots and harness"): every reader is null, false or empty
// on a run without the Calling, so the bots' other decisions are untouched. ──

/** The Conductor's numbers this fight (`state.calling.conducting`); the type of its view. */
export type ConductingView = NonNullable<NonNullable<WorldState['calling']>['conducting']>;
/** The Conductor's fight state (`state.field.conducting`). */
export type ConductingField = NonNullable<WorldState['field']['conducting']>;

/** What a Cue costs and what the Crescendo costs are the sim's (re-exported, one rule). */
export { crescendoCostOf, cueCostNow, onBeat };

/**
 * The Conductor's view and field; null without the Calling. The field is created with the world
 * on a Conductor run, so the two are both there or both absent.
 */
export function conductingOf(
  state: WorldState,
): { view: ConductingView; field: ConductingField } | null {
  const view = state.calling?.conducting;
  const field = state.field.conducting;
  return view && field ? { view, field } : null;
}

/**
 * Seconds until the downbeat's window next opens: 0 inside it, null without A Tempo. Uses the
 * sim's `onBeat` and `beatAt`, so the bot's window is the sim's.
 */
export function beatSoon(state: WorldState): number | null {
  const beat = state.calling?.conducting?.beat;
  if (!beat) return null;
  if (onBeat(state)) return 0;
  const { next } = beatAt(state.time, beat.bar);
  return Math.max(0, next - beat.within - state.time);
}

/**
 * The open chain a Cue could still join: who is in it and how long (s) until its window shuts;
 * null with no chain, a full one (three long) or a closed window.
 */
export function chainOpen(
  state: WorldState,
): { heroes: readonly EntityId[]; closesIn: number } | null {
  const c = conductingOf(state);
  const chain = c?.field.chain;
  if (!c || !chain || chain.heroes.length >= 3) return null;
  const closesIn = chain.at + c.view.chainWindow - state.time;
  return closesIn >= 0 ? { heroes: chain.heroes, closesIn } : null;
}

/** The Grand Finale is playing. */
export function finaleOn(state: WorldState): boolean {
  return state.field.conducting?.finale !== undefined;
}

/** Marcato is on the path and can be given now (never given, or its cooldown is over). */
export function marcatoReady(state: WorldState): boolean {
  const c = conductingOf(state);
  if (!c || !c.view.marcato) return false;
  return !c.field.marcato || state.time >= c.field.marcato.readyAt;
}

/** A hero able to take a Finale turn now (as the sim reads it: charge aside, not mid-Solo). */
export function finaleFree(h: HeroView): boolean {
  const c = h.e.hero!;
  return (
    c.soloActive <= 0 && c.hold === null && c.reel === null && !isStilled(h.e) && !isPossessed(h.e)
  );
}

/** How far a hero's Solo reaches (m): its own radius or reach, else the hero's attack range. */
export function soloReach(h: HeroView): number {
  const def = CONTENT.heroes.find((d) => d.id === h.defId)!;
  const own = h.e.hero!.soloId === def.solo.id;
  return own ? (def.solo.radius ?? def.solo.reach ?? def.attack.range) : def.attack.range;
}

/**
 * Seconds until a hero's Solo is full from fighting (0 if it is; Infinity when it isn't charging:
 * mid-Solo or not engaged), from its charge time and the fight's `soloChargeMult`.
 */
export function soloFullIn(state: WorldState, h: HeroView): number {
  const c = h.e.hero!;
  if (c.solo >= 100) return 0;
  if (c.soloActive > 0 || !c.engaged) return Infinity;
  const def = CONTENT.heroes.find((d) => d.id === h.defId)!;
  const alt = CONTENT.altSolos.find((s) => s.id === c.soloId);
  const chargeTime = c.soloId === def.solo.id ? def.solo.chargeTime : (alt?.chargeTime ?? 25);
  return (100 - c.solo) / ((100 / chargeTime) * state.mods.soloChargeMult);
}
