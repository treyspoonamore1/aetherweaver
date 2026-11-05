import type { Content, StatusPayload } from '../content';
import { CONTENT, attackDef } from '../content';
import { DOOM_CHIME_AT } from '../content/unstitched';
import type { EntityId, ReadonlyEntity, WorldState } from '../sim';
import { threadSegment } from '../sim';
import { ABYSS_MOOD, MAX_PIPS, pipOffset } from './crimsonCues';

/**
 * Movement III, the Unstitched (docs/phase-5c.md, Presentation; docs/phase-5c/vfx-audio.md):
 * what render reads from the state for the Rift's statuses, zones, cuts, mirrors and the
 * Unweaver's Thread, and the colours it draws them in. Everything here is pure (tests, the lab).
 * Every key it reads is absent in Movements I and II (`field.zones`, `field.unravel`,
 * `field.stolen`, `enemy.tethered`, `enemy.mimic`, `enemy.emboldenedUntil`, the Rift's statuses,
 * `threadSnapped.cause`), so nothing here draws there.
 */

/**
 * The new semantic colours. Each is ΔE ≥ 20 from lethal, threat, the Martyr's Bear, Mend and
 * Empower under every colour-vision palette (tests/colorVision.test.ts,
 * tests/renderMovement3.test.ts). Doom, Doubt and the stitch link are ailments and draw in the
 * live ailment violet (`C.ailment`, lethal at four Doom stacks): not new colours.
 *
 * Measured (lowest ΔE over every vision vs lethal, threat, Bear, Mend and Empower), 2026-11-05:
 * possess 35.8, unravel 26.8, rune 40.5, mirror 38.5, swirl 24.9, fray 24.9, strand 34.1,
 * spindle 30.2.
 */
export const RIFT_HEX = {
  /**
   * A possessed hero's rim, mask and tether (an indigo: never enemy-bar red, never Focus gold,
   * so the player reads "save them", not "kill them"). Ranked above threaded in the rim priority.
   */
  possess: '#4b3fb8',
  /** Unravel's Thread core (near-black; its barbs are the live lethal). */
  unravel: '#0f0b1a',
  /**
   * The Null Priest's rune ring at the Weaver's feet (bone). Bone sits near the Weaver's gold
   * and Lyra under tritanopia, so the rune is shape-coded too: glyphs round a circle, never the
   * Mute's dashed glass ring.
   */
  rune: '#e8e3c8',
  /** The Seamstress's cross-stitch link and the sewn tether between a stitched pair (bone). */
  stitch: '#e8e3c8',
  /**
   * A mirror: the Mimic's shimmer to its beneficiary, the mirrorWard shell (an inverted hexagon,
   * never Ward's pale cyan: ΔE ≥ 20 from shield too), Emboldened's shimmer (never gold: gold
   * means "the Weaver did this", 04 §1 rule 4), the champion's mirror Thread.
   */
  mirror: '#c8c4b8',
  /** The Void Maw's swirl, tightening through the Inhale's tell, then turning inward. */
  swirl: '#7c6fe0',
  /** A cut Thread's fray: the 'CUT' / 'UNPICKED' callout and the frayed stub at her hand. */
  fray: '#fecdd3',
  /** Guard Strand turning a cut aside: a spark of silk at the crossing. */
  strand: '#fde2c4',
  /** A Spindle's tether beam to the Unweaver, and the plating it lays on it. */
  spindle: '#d9c7a0',
} as const;

/**
 * Ambient Abyssal Rift colours: lights, sky, cloth and debris. Not semantic (nothing reads as an
 * answer or a threat by them), so they stay ambient. Teal is Mend: the naive fray teal #2dd4bf is
 * ΔE 0.0 from it and a teal rim light would make every hero look Mended, so no entry here comes
 * within 20 ΔE of Mend or shield in any vision (tests/colorVision.test.ts). The pale moon key is
 * a warm bone, not the design's first pick #cdd8f5 (ΔE 3.8 from shield under deuteranopia: every
 * hero it lit would look Warded); the rim is a cold, desaturated blue-teal (#3c6f8a measured 18.4
 * from Mend under tritanopia, so #346782) at ≤ 0.45; the fray a dark teal (#176762, not #1f6f6a,
 * 18.1 under tritanopia), drifting off the combat disc only.
 */
export const ABYSS_HEX = {
  /** The mood's own (crimsonCues.ts ABYSS_MOOD, which the mood table reads). */
  sky: ABYSS_MOOD.sky,
  moon: ABYSS_MOOD.moon,
  rim: ABYSS_MOOD.rim,
  fog: '#0a0a1c',
  /** Fray motes (kept to the rim) and the stitched floor's faint threads at the edge. */
  fray: '#176762',
  /** Void cloth: the Unstitched bodies, the floor's cloth panels, the torn hangings. */
  cloth: '#2a2547',
  /** Floating slabs and the broken pillars. */
  slab: '#26233d',
  /** The rift tears' cold glow (additive cards on the far side). */
  tear: '#576fb6',
  /** A cloth death's indigo smoke. */
  smoke: '#1c1830',
  /** The bone seams on cloth bodies and stones. */
  bone: '#e8e3c8',
} as const;

/** The affix colours, as content has them (tests/colorVision.test.ts measures them). */
export const RIFT_AFFIX_HEX = {
  severing: '#f8fafc',
  silencing: '#2563eb',
  mimicking: '#e0e7ff',
  doom_touched: '#5b21b6',
} as const;

/**
 * The stack count Doom ignites at, as content gives it: the first Doom payload's `burst.at`
 * (its `maxStacks` if it has no burst), wherever it is applied (an attack's or zone's status, an
 * enemy's basic hit, an affix's onHit: the payloads the content lint walks). 5 only if content
 * has no Doom at all, when nothing draws it.
 */
export function doomIgnitionAt(content: Pick<Content, 'attacks' | 'enemies' | 'affixes'>): number {
  const at = (p: StatusPayload | undefined): number | undefined =>
    p?.id === 'doom' ? (p.burst?.at ?? p.maxStacks) : undefined;
  for (const f of content.affixes) {
    const n = at(f.onHit);
    if (n !== undefined) return n;
  }
  for (const e of content.enemies) {
    const n = at(e.basic.onHit);
    if (n !== undefined) return n;
  }
  for (const a of content.attacks) {
    const n = at(a.status) ?? at(a.zone?.status);
    if (n !== undefined) return n;
  }
  return 5;
}

/** Doom ignites at this many stacks (its pips count up to it): read from content, never typed. */
export const DOOM_AT = doomIgnitionAt(CONTENT);
/** From this many stacks the pips turn lethal and Chime and Ward show (content's rule). */
export { DOOM_CHIME_AT };

/** A cut Thread's callout, by cause ('UNPICKED' for the Seamstress's Unpick). */
export function cutLabel(cause: string | undefined): string {
  return cause === 'unpick' ? 'UNPICKED' : 'CUT';
}

// ── Statuses ─────────────────────────────────────────────────────────────────────────────

/** The Rift statuses render draws on a hero, read once per hero per frame (reused). */
export interface RiftStatusLook {
  /** Possessed: by which enemy (its source; -1: none). `possessed` is true even with no source. */
  possessed: boolean;
  possessedBy: EntityId;
  /** The Wraith's mark during its cast. */
  doubt: boolean;
  /** Doom's stacks (0: none); Doom's ignition mark. */
  doom: number;
  doomed: boolean;
  /** Stitched: by which source (-1: none). `stitch`: inside the Stitch link's windup. */
  stitched: boolean;
  stitchedBy: EntityId;
  stitch: boolean;
  /** Inside an Inhale's pull (`voided`). */
  voided: boolean;
  /** Taking Unravel's reversed Mend (display). */
  unravelled: boolean;
  /** An enemy's Emboldened (display). */
  emboldened: boolean;
}

export function emptyRiftLook(): RiftStatusLook {
  return {
    possessed: false,
    possessedBy: -1,
    doubt: false,
    doom: 0,
    doomed: false,
    stitched: false,
    stitchedBy: -1,
    stitch: false,
    voided: false,
    unravelled: false,
    emboldened: false,
  };
}

/** Reads the Rift's statuses off an entity into `out`. False when it has none of them. */
export function riftStatuses(e: ReadonlyEntity, out: RiftStatusLook): boolean {
  out.possessed = false;
  out.possessedBy = -1;
  out.doubt = false;
  out.doom = 0;
  out.doomed = false;
  out.stitched = false;
  out.stitchedBy = -1;
  out.stitch = false;
  out.voided = false;
  out.unravelled = false;
  out.emboldened = false;
  const h = e.health;
  if (!h) return false;
  let any = false;
  for (const s of h.statuses) {
    switch (s.id) {
      case 'possessed':
        out.possessed = true;
        out.possessedBy = s.source ?? -1;
        any = true;
        break;
      case 'doubt':
        out.doubt = true;
        any = true;
        break;
      case 'doom':
        out.doom = Math.max(1, s.stacks);
        any = true;
        break;
      case 'doomed':
        out.doomed = true;
        any = true;
        break;
      case 'stitched':
        out.stitched = true;
        out.stitchedBy = s.source ?? -1;
        any = true;
        break;
      case 'stitch':
        out.stitch = true;
        any = true;
        break;
      case 'voided':
        out.voided = true;
        any = true;
        break;
      case 'unravelled':
        out.unravelled = true;
        any = true;
        break;
      case 'emboldened':
        out.emboldened = true;
        any = true;
        break;
      default:
        break;
    }
  }
  return any;
}

/** Where Doom pip `i` of five sits over the head: on the bleed pips' arc (crimsonCues). */
export function doomPipOffset(i: number, out: { x: number; y: number }): void {
  pipOffset(i, Math.min(DOOM_AT, MAX_PIPS), out);
}

/**
 * The answers a hero's Rift statuses want over the head (null: none), and its badge's label:
 * possessed: Chime (it frees them), Focus (the Wraith); Doom from four stacks: Chime or Ward;
 * stitched: Chime frees both (a Reel frees the one it pulls).
 */
export function riftAnswers(
  look: RiftStatusLook,
): readonly ('chime' | 'focus' | 'ward' | 'reel')[] | null {
  if (look.possessed) return CHIME_FOCUS;
  if (look.stitched) return CHIME_REEL;
  if (look.doom >= DOOM_CHIME_AT) return CHIME_WARD;
  return null;
}
const CHIME_FOCUS = ['chime', 'focus'] as const;
const CHIME_REEL = ['chime', 'reel'] as const;
const CHIME_WARD = ['chime', 'ward'] as const;

export function riftLabel(look: RiftStatusLook): string {
  if (look.possessed) return 'Possessed';
  if (look.stitched) return 'Stitched';
  return `Doom ×${look.doom}/${DOOM_AT}`;
}

/**
 * The stitched pairs (docs/phase-5c.md, Stitch): heroes with `stitched` that share a source, in
 * party order, written into `out` as [a, b] id pairs (reused; its length is set). A lone stitched
 * hero (the other Warded the root) has no pair.
 */
export function stitchedPairs(
  state: Pick<WorldState, 'party' | 'entities'>,
  out: EntityId[],
): number {
  out.length = 0;
  const party = state.party;
  for (let i = 0; i < party.length; i++) {
    const a = state.entities.get(party[i]!);
    const sa = stitchedSource(a);
    if (sa === undefined) continue;
    for (let j = i + 1; j < party.length; j++) {
      const b = state.entities.get(party[j]!);
      if (stitchedSource(b) === sa) out.push(party[i]!, party[j]!);
    }
  }
  return out.length / 2;
}

function stitchedSource(e: ReadonlyEntity | undefined): EntityId | null | undefined {
  if (!e?.health || e.health.dead) return undefined;
  for (const s of e.health.statuses) if (s.id === 'stitched') return s.source;
  return undefined;
}

// ── Cuts ─────────────────────────────────────────────────────────────────────────────────

/** An attack that cuts the Thread (`cut`), and how (null: none, or not an attack). */
export function cutOf(attackId: string): { lock: number; always?: boolean } | null {
  try {
    return attackDef(attackId).cut ?? null;
  } catch {
    return null;
  }
}

/**
 * Where a cut line's centre crosses the Thread (the scissors marker), into `out`; false when it
 * doesn't cross (or there is no Thread). The line is (x, z) → (toX, toZ); the Thread the
 * Weaver → the threaded hero (`threadSegment`, the sim's own).
 */
export function shearsCrossing(
  state: WorldState,
  line: { readonly x: number; readonly z: number; readonly toX: number; readonly toZ: number },
  out: { x: number; z: number },
): boolean {
  const seg = threadSegment(state);
  if (!seg) return false;
  return crossing(line.x, line.z, line.toX, line.toZ, seg.ax, seg.az, seg.bx, seg.bz, out);
}

/** Where segments a→b and c→d cross (into `out`); false when they don't. */
export function crossing(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
  out: { x: number; z: number },
): boolean {
  const rx = bx - ax;
  const rz = bz - az;
  const sx = dx - cx;
  const sz = dz - cz;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return false;
  const qx = cx - ax;
  const qz = cz - az;
  const t = (qx * sz - qz * sx) / den;
  const u = (qx * rz - qz * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return false;
  out.x = ax + rx * t;
  out.z = az + rz * t;
  return true;
}

// ── Zones, the Mirror, the Unweaver ──────────────────────────────────────────────────────

/** The Seamstress's Needle Rain (and the Unpick's follow-up): circles with falling needles. */
const NEEDLES = new Set([
  'seamstress_needles',
  'seamstress_needles_2',
  'seamstress_needles_3',
  'seamstress_unpick_rain',
]);

export function isNeedle(attackId: string): boolean {
  return NEEDLES.has(attackId);
}

/** A mark whose status is Doom's ignition (`doomed`): its pips burn lethal round the mark. */
export function isDoomMark(attackId: string): boolean {
  try {
    return attackDef(attackId).markStatus === 'doomed';
  } catch {
    return false;
  }
}

/** A Stitch link (`linkStatus 'stitch'`): the telegraph's own, else its attack's. */
export function isStitch(t: { readonly attackId: string; readonly linkStatus?: string }): boolean {
  if (t.linkStatus === 'stitch') return true;
  try {
    return attackDef(t.attackId).linkStatus === 'stitch';
  } catch {
    return false;
  }
}

/** A zone attack's kind ('pull': the Inhale; 'null': the rune), or null. */
export function zoneOf(attackId: string): 'pull' | 'null' | null {
  try {
    return attackDef(attackId).zone?.kind ?? null;
  } catch {
    return null;
  }
}

/** Inside some pull zone at (x, z): the zone's index in `zones`, else -1. */
export function inPull(
  zones:
    | readonly {
        readonly kind: string;
        readonly x: number;
        readonly z: number;
        readonly r: number;
      }[]
    | null
    | undefined,
  x: number,
  z: number,
): number {
  if (!zones) return -1;
  for (let i = 0; i < zones.length; i++) {
    const zn = zones[i]!;
    if (zn.kind !== 'pull') continue;
    if ((x - zn.x) * (x - zn.x) + (z - zn.z) * (z - zn.z) <= zn.r * zn.r) return i;
  }
  return -1;
}

/** An enemy is Emboldened at sim time `time` (the Mimic's Empower copy, the Unweaver's Thread). */
export function emboldenedAt(e: ReadonlyEntity, time: number): boolean {
  const until = e.enemy?.emboldenedUntil;
  return until !== undefined && until > time;
}

/** Defs whose standing adds tether their boss (`tether`): the Spindles. */
const TETHER_DEFS = new Set(CONTENT.enemies.filter((d) => d.tether).map((d) => d.id));

export function isTetherDef(defId: string): boolean {
  return TETHER_DEFS.has(defId);
}

/** The Spindles' damage cut on the boss, as its floater reads it ('−80%'), from content. */
export const SPINDLED_LABEL = `−${Math.round((CONTENT.enemies.find((d) => d.tether)?.tether?.dr ?? 0) * 100)}%`;

/** The Unweaver's champion (its mirror Thread runs from the boss to it). */
export const CHAMPION_ID = 'mirror_champion';
export const UNWEAVER_ID = 'the_unweaver';
export const STOLEN_VERSE_ID = 'stolen_verse';

/** The Rift's cloth bodies drift rather than walk (a hover gait: no bob, a slow sway). */
const HOVER = new Set(['doubt_wraith', 'null_priest', 'the_unweaver', 'stolen_verse', 'mimic']);

export function hovers(defId: string): boolean {
  return HOVER.has(defId);
}

/** The Mimic's copy as the SPRITE.mode glyph draws it: Mend's plus (0) … Empower's star (1). */
export function copyGlyph(copy: 'empower' | 'ward' | 'chime'): number {
  return copy === 'empower' ? 1 : 0;
}

/** The Mimic's copy as a word (its cast-bar badge). */
export function copyLabel(copy: 'empower' | 'ward' | 'chime'): string {
  return copy === 'empower' ? 'Empower' : copy === 'ward' ? 'Ward' : 'Chime';
}

/** The Rift is drawn in this fight: some entity, zone or field key of Movement III is present. */
export function riftKeysPresent(state: WorldState): boolean {
  const f = state.field;
  return f.zones !== undefined || f.unravel !== undefined || f.stolen !== undefined;
}
