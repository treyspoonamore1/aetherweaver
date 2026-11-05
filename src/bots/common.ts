import { CONTENT, encounterDef } from '../content';
import { contains, telegraphDamage } from '../sim/combat/telegraphs';
import { quantize } from '../sim/core/dmath';
import { rewindCanRevive } from '../sim/systems/rewind';
import { bloodlusting, fallingFast, segmentDistSq, suppressRadiusOf } from '../sim';
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
