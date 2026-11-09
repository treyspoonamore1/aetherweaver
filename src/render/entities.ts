import * as THREE from 'three';
import type { ColorVision } from '../app/colorVision';
import { CONTENT, bloodRageOf, enemyDef, heroDef } from '../content';
import {
  bloodRageBonus,
  possessionVictim,
  suppressRadiusOf,
  weaverSilenced,
  type EntityId,
  type EntityKind,
  type ReadonlyEntity,
  type WorldState,
} from '../sim';
import {
  CHAMPION_ID,
  DOOM_AT,
  DOOM_CHIME_AT,
  RIFT_HEX,
  STOLEN_VERSE_ID,
  doomPipOffset,
  emboldenedAt,
  emptyRiftLook,
  hovers,
  inPull,
  isTetherDef,
  riftStatuses,
  stitchedPairs,
} from './riftCues';
import { BEAM } from './fx/beams';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import { PARTICLE } from './fx/particles';
import type { FxKit } from './fx/kit';
import {
  OWN_LOOK,
  OWN_RIM,
  restRim,
  ribbonHex,
  weaverPalette,
  type WeaverLook,
} from './keepsakeCues';
import { ModelBatch } from './models/batch';
import {
  buildAncient,
  buildCrown,
  buildEnemy,
  buildHero,
  buildSapling,
  buildWeaver,
  recolorModel,
} from './models/library';
import {
  SEREN_FLASH,
  SEREN_VIOLET,
  cutting,
  duelHero,
  enGarde,
  heavyPip,
  overextendedLook,
  parryGlyph,
  quarryOf,
  reachArcShows,
  rosterHeavyShown,
  weaverReach,
} from './serenCues';
import {
  GROVE_BARK,
  GROVE_HEX,
  GROVE_MOSS,
  GROVE_OUT,
  GROVE_SEED,
  GROVE_VINE,
  SUMMON_BATCH,
  ancientRising,
  ancientTauntRadius,
  burrowing,
  choirSings,
  CHOIR_RADIUS,
  GROVE_CHOIR,
  stillHeld,
  ownerOf,
  rootedLook,
  summonCoverage,
  tending,
} from './groveCues';
import type { ModelMaterial } from './models/material';
import { shineLevel, shineOf } from './callingCues';
import { ASTRO_HEX, astroLook, atLifeCap, emptyAstroLook, graceMarked } from './astrolabeCues';
import {
  CHRONO_HEX,
  chronoLook,
  emptyChronoLook,
  reviveWindow,
  rewindPreviewHero,
  rewindSample,
  slowDanced,
  stasisWave,
} from './chronoCues';
import { MARTYR_HEX } from './martyrCues';
import {
  BLEED_CHIME_AT,
  BRANN_HEX,
  CRIMSON_HEX,
  FRENZY_SPIN,
  MAX_PIPS,
  PIP_LIFT,
  WOUND_LIFT,
  WOUND_SIZE,
  crimsonStatuses,
  emptyStatusLook,
  guardArc,
  guardBrokenAt,
  guardHalf,
  isQuadruped,
  moveOf,
  pipOffset,
  signalHex,
} from './crimsonCues';
import {
  DISSONANCE_HEX,
  RISEN_DESAT,
  cueTicks,
  dissonanceLook,
  emptyDissonanceLook,
  emptyRiseShape,
  riseShape,
} from './dissonanceCues';
import {
  C,
  approach,
  auraColor,
  clamp01,
  color,
  currentVision,
  threadColor as threadModeColor,
} from './palette';
import {
  POUR_TRAVEL,
  auraHearing,
  beamSong,
  chordMask,
  focusLevel,
  isAllIn,
  isFullEcho,
} from './songs';
import type { FrameInfo } from './types';

/** Per-entity render state. Views never mutate the sim; this is all presentation. */
export interface EntityRec {
  id: EntityId;
  kind: EntityKind;
  batch: ModelBatch;
  radius: number;
  height: number;
  /** Signature colour (hero), accent (enemy), gold (Weaver). */
  color: THREE.Color;
  hex: string;
  accent: THREE.Color;
  role: string;
  tier: string;
  affixColor: THREE.Color | null;
  /**
   * Every affix's colour, in the enemy's order (Elite Vanguard gives elites a second one: its rim
   * takes each in turn, and its crown wears a gem for each; docs/phase-4d/vfx-audio.md).
   */
  affixColors: THREE.Color[];
  suppressRadius: number;
  seen: number;
  x: number;
  z: number;
  y: number;
  yaw: number;
  walk: number;
  flash: number;
  lunge: number;
  lungeX: number;
  lungeZ: number;
  stagger: number;
  lie: number;
  dissolve: number;
  /** ≥ 0 while the death dissolve plays (seconds). */
  dying: number;
  goldRim: number;
  rimFlash: number;
  /** How much the beam song swells this hero right now (0..1, render-side fade). */
  beam: number;
  bleedMax: number;
  smokeAcc: number;
  sparkleAcc: number;
  /**
   * The Luminary (docs/phase-3c/vfx.md): how brightly this hero shines (the shine level,
   * 0..1.6, smoothed: a quick brighten into the field, a slower fade out), and how much they
   * stand in the field (0..1, smoothed; Haloed's halo follows it).
   */
  shine: number;
  lit: number;
  /** Real seconds since this hero last stepped into the light (the kindle flare). */
  kindled: number;
  /**
   * The Martyr (docs/phase-3d/vfx.md): the Weaver's flinch when a wound she Bears reaches her
   * (0..1.4, decays in ~0.3 s): a crimson rim flash and a small recoil.
   */
  flinch: number;
  /**
   * A held rim tint, written each frame by the Martyr's view (Low-Life Vigil's pulse, Scarred
   * Hide's hardened rim). 0 for none. Read on the next frame (MartyrView syncs after this).
   */
  rimHold: number;
  rimHoldColor: THREE.Color;
  /**
   * The Chronomancer (docs/phase-3e/vfx.md). `frost`: an enemy held by Stasis (0..1, smoothed;
   * it rises as the stillness spreading from the Weaver reaches it). `slow`: Slow Dance holds it
   * back in the field (0..1). `chronoFlash`: a silver rim flash (Rewind's arrival, a revive, an
   * Echo Ward), decaying in ~0.4 s.
   */
  frost: number;
  slow: number;
  chronoFlash: number;
  /** The Ward last seen on this entity and the sim time it was first seen (its pop). */
  wardRef: unknown;
  wardSeen: number;
  /**
   * The Astrolabe (docs/phase-4/vfx.md). `graceRef`: the overshield Overflowing Grace formed or
   * feeds on this hero (AstrolabeView draws it in its own look, so the plain overshield shell is
   * skipped). `conduit`: Eldritch Conduit's blood-violet flicker on the Weaver (0..1.3, decays in
   * ~0.3 s). `prism`: Prism Covenant's spectral edge on the Weaver (0..1, smoothed). Afterglow
   * leaves the rim alone (a hero's aura tint shows through it): AstrolabeView draws it.
   */
  graceRef: unknown;
  conduit: number;
  prism: number;
  /**
   * Restless Dead (Dissonance, docs/phase-4d/vfx-audio.md). `risen`: 1 once this enemy has risen
   * (it won't again): drawn drained to ash, a pale rim, an ash life bar, ash drifting off it.
   * `rising`: how far down it is as it stands back up (0..1, the rise's pose; 0 otherwise).
   */
  risen: number;
  rising: number;
  /**
   * Movement II (docs/phase-5a/vfx-audio.md). `quad`: a Legion quadruped (a dog's gait).
   * `guardHalf`: its guard arc's half angle (0: no guard); `guardWasBroken`, `guardFlash`: the
   * flash as it breaks. `travel`: a charge (1) or leap (2) being drawn from where it stood to
   * where the sim snapped it (`travelT` of `travelDur` seconds).
   */
  quad: boolean;
  guardHalf: number;
  guardWasBroken: boolean;
  guardFlash: number;
  travel: number;
  travelT: number;
  travelDur: number;
  travelFromX: number;
  travelFromZ: number;
  /**
   * Movement III (docs/phase-5c/vfx-audio.md). `defId`: an enemy's def ('' otherwise). `hover`:
   * a cloth body that drifts instead of walking (the Wraith, the Null Priest, the Unweaver…).
   * `riftGems`: its Rift affixes' crown-gem shapes (SPRITE styles; empty for every other elite).
   * `streakAt`: when a possessed hero last lashed out (render clock).
   */
  defId: string;
  hover: boolean;
  riftGems: number[];
  riftGemColors: THREE.Color[];
  streakAt: number;
  dragAcc: number;
  lastHp: number;
  alive: boolean;
}

/** The crown gem each Rift affix wears (docs/phase-5c.md, Affixes): its shape says which. */
const RIFT_GEM: Readonly<Record<string, number>> = {
  severing: SPRITE.scissors,
  silencing: SPRITE.rune,
  mimicking: SPRITE.mirror,
  doom_touched: SPRITE.doomPip,
};

/** Rewind's preview (the Chronomancer): where the threaded hero would go back to. */
export interface RewindGhost {
  /** The hero, or -1 while there is none. */
  hero: EntityId;
  /** Where Rewind would send them (smoothed between samples). */
  x: number;
  z: number;
  yaw: number;
  /** Shown, 0..1 (fades in and out). */
  alpha: number;
  /** The hero is down and Rewind would stand them back up (0..1, smoothed). */
  revive: number;
  /** Seconds left to stand a downed hero back up (0 while they stand). */
  window: number;
  /** The model ghost is drawn (it hides while the hero stands where they stood). */
  drawn: boolean;
}

interface Ghost {
  active: boolean;
  /** Glide afterimage of the Weaver, or the "death that didn't happen" of a saved hero. */
  save: boolean;
  /**
   * The Chronomancer's: 1 an afterimage left along Rewind's streak (silver), 2 a downed hero's
   * fall played backwards, rising and running from (x, z) to (x2, z2) as Rewind stands them up.
   * 3: Seren's afterimage (Thousand Cuts' blinks, Feint's step), violet; `side` 2: gold-edged
   * (a Cued Thousand Cuts).
   */
  chrono: number;
  x2: number;
  z2: number;
  batch: ModelBatch | null;
  x: number;
  z: number;
  yaw: number;
  age: number;
  life: number;
  /** Save ghosts: which entity, and the side it falls to. */
  hero: EntityId;
  side: number;
  radius: number;
}

const BLACK = new THREE.Color(0, 0, 0);
const ENEMY_BAR = color('#ef4444');
/** A plain enemy's resting rim (the lowest in the rim's order: any other tint replaces it). */
const HOSTILE_RIM = 0.18;
const MUTE_GLASS = color('#c4b5fd');
const AILMENTS = new Set([
  'dirge',
  'silence',
  'sleep',
  'stun',
  'resound',
  'shaken',
  // Movement II (docs/phase-5a.md): the sim's AILMENTS gain the same three.
  'bleed',
  'latched',
  'wound',
  // Movement III (docs/phase-5c.md): and these six.
  'doubt',
  'possessed',
  'doom',
  'doomed',
  'stitch',
  'stitched',
]);
/** Movement III's colours (riftCues.ts). */
const POSSESS = color(RIFT_HEX.possess);
const STITCH = color(RIFT_HEX.stitch);
const MIRROR = color(RIFT_HEX.mirror);
const RUNE = color(RIFT_HEX.rune);
const SPINDLE = color(RIFT_HEX.spindle);
const SWIRL = color(RIFT_HEX.swirl);
/** A possessed hero lashes out every this many seconds (the sim's tick, POSSESS_TICK). */
const LASH_EVERY = 0.5;
/** Doom's pips sit this far above the bleed pips' arc (both may show at once). */
export const DOOM_PIP_LIFT = 0.26;
const GUARD = color(CRIMSON_HEX.guard);
const PIN = color(CRIMSON_HEX.pin);
const STAKE = color(CRIMSON_HEX.stake);
/** How long a leap's arc and a charge's rush are drawn (s): the sim snaps the position. */
export const LEAP_SECONDS = 0.42;
export const CHARGE_SECONDS = 0.22;
const HIST = 26;
/** Fermata's stillness: the held hero's rim and the suspended motes around them. */
const FERMATA = color('#e2d6f8');
/** The Martyr's flinch: a warm crimson rim. */
const FLINCH = color(MARTYR_HEX.blood);
const GHOST_ASH = color('#e8e4f4');
const SAVE_GHOST_LIFE = 1.05;
/** The Chronomancer's silver: frozen enemies' rims, Rewind's ghosts. */
const CHRONO_SILVER = color(CHRONO_HEX.silver);
/** Eldritch Conduit: a technique paid in Life flickers her rim blood-violet. */
const CONDUIT = color(ASTRO_HEX.conduit);
/** Brann (docs/phase-5b.md): Blood Rage's ember. */
const EMBER = color(BRANN_HEX.ember);
/** Red Frenzy's swipe ring: his own crimson (docs/phase-5b.md), his Solo rather than a signal. */
const FRENZY = color(BRANN_HEX.body);
/** Restless Dead: a risen enemy's ash (its rim, life bar, motes) and the light it re-forms in. */
const ASH = color(DISSONANCE_HEX.ash);
const GRAVE = color(DISSONANCE_HEX.grave);
/** Elite Vanguard: each affix holds an elite's rim for one pulse of it (2π of the pulse's phase). */
const AFFIX_TURN = Math.PI * 2;
/** A downed hero's fall played backwards (Rewind standing them up): how long it takes. */
export const UNFALL_LIFE = 0.55;
/** Points of the Weaver's hand path her ribbons trail along (`weaverRibbons`). */
export const RIBBON_SAMPLES = HIST;

/**
 * The Weaver's three ribbons, trailing from her hand's path (`hist`: `count` points, newest first,
 * x y z), fluttering and drooping behind her as she faces `yaw`: the middle one in `inner`, the
 * outer two in `outer` (her own white-gold, or her Thread look's filament and glow). The lab's
 * lineup of looks draws them too.
 */
export function weaverRibbons(
  kit: FxKit,
  hist: Float32Array,
  count: number,
  yaw: number,
  now: number,
  inner: THREE.Color,
  outer: THREE.Color,
): void {
  if (count < 3) return;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const sideX = -fz;
  const sideZ = fx;
  for (let r = 0; r < 3; r++) {
    const off = (r - 1) * 0.16;
    const baseY = 1.12 - r * 0.12;
    const c = r === 1 ? inner : outer;
    kit.ribbons.beginStrip();
    const n = Math.min(count, 18 + r * 3);
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const px = hist[k * 3] + sideX * off * (1 + t);
      const pz = hist[k * 3 + 2] + sideZ * off * (1 + t);
      const flutter = Math.sin(now * 5 + k * 0.55 + r * 2) * 0.09 * t;
      const droop = t * 0.75;
      kit.ribbons.point(
        px - fx * t * 0.55 + sideX * flutter,
        hist[k * 3 + 1] + baseY - droop + Math.sin(now * 3.3 + k * 0.4 + r) * 0.06 * t,
        pz - fz * t * 0.55 + sideZ * flutter,
        0.075 * (1 - t * 0.7),
        c,
        (1 - t) * 0.85,
        t * 2,
      );
    }
    kit.ribbons.endStrip();
  }
}

function hasStatus(list: readonly { readonly id: string }[], id: string): boolean {
  for (let i = 0; i < list.length; i++) if (list[i]!.id === id) return true;
  return false;
}

function angleApproach(current: number, target: number, rate: number, dt: number): number {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-rate * dt));
}

export class EntityLayer {
  readonly recs = new Map<EntityId, EntityRec>();
  readonly group = new THREE.Group();
  private readonly batches = new Map<string, ModelBatch>();
  private readonly crown: ModelBatch;
  private readonly ghosts: Ghost[] = [];
  private frameNo = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly tint = new THREE.Color();
  private readonly tmpColor = new THREE.Color();
  /** Aura colours by coverage mask (bit i ⇔ CONTENT.auras[i]) and their average (rim tint). */
  private readonly maskColors = new Map<number, THREE.Color[]>();
  private readonly maskAvg = new Map<number, THREE.Color>();
  /** The beam song this frame: its coverage bits, focus level (songs.ts), all in. */
  private beamMask = 0;
  /** The beam song's echo plays at full strength (Spindle of Fate). */
  private beamFullEcho = false;
  private beamLevel = 0;
  private beamAllIn = false;
  private beamTarget: EntityId | null = null;
  private beamSince = 0;
  // Weaver ribbon history.
  private readonly hist = new Float32Array(HIST * 3);
  private histCount = 0;
  private histTimer = 0;
  private shadowsEnabled = true;
  weaverId: EntityId = -1;
  /** Real seconds of the frame (presentation clock), and the frame's FX step. */
  private now = 0;
  private frameDt = 0;
  /** The Luminary's Sunrise, smoothed (0..1): the heroes' light turns more golden. */
  sunrise = 0;
  /** The Chronomancer, read once a frame (docs/phase-3e/vfx.md). */
  readonly chrono = emptyChronoLook();
  /** The Astrolabe, read once a frame (docs/phase-4/vfx.md). */
  readonly astro = emptyAstroLook();
  /** Dissonance, read once a frame (docs/phase-4d/vfx-audio.md). */
  readonly dis = emptyDissonanceLook();
  /** A risen enemy's pose as it stands back up (reused). */
  private readonly riseOut = emptyRiseShape();
  /** Silent Cues: where the Cue's cost falls on the Resonance orbit, in segments (reused). */
  private readonly ticks = new Float32Array(8);
  /** What was drawn last frame (tests, the lab): risen enemies marked, rising, crown gems, Cue ticks. */
  readonly drawnDis = { risen: 0, rising: 0, gems: 0, cueTicks: 0 };
  /**
   * Movement II, what was drawn last frame (tests, the lab): quadrupeds in their gait, a Pounce's
   * crouch, a charge's lean, leaps and charges in flight, stack pips, Wound hearts, latch
   * tethers, pin stakes, guard arcs (and broken ones).
   */
  readonly drawnM2 = {
    quadrupeds: 0,
    crouch: 0,
    lean: 0,
    leaps: 0,
    charges: 0,
    pips: 0,
    pipsHot: 0,
    wounds: 0,
    tethers: 0,
    stakes: 0,
    guardArcs: 0,
    guardBroken: 0,
  };
  /**
   * Brann (docs/phase-5b.md), what was drawn last frame (tests, the lab): Blood Rage's ember glow,
   * Red Frenzy's spin and swipe ring (gold-edged when Cued), Bloodletting's pips on his axe.
   */
  readonly drawn5b = { rage: 0, spin: 0, frenzy: 0, frenzyGold: 0, bloodlet: 0 };
  /**
   * Seren and Oro (docs/phase-5e.md), what was drawn last frame (tests, the lab). Seren: her
   * notched ring, the en-garde blades, the duel tether and crown, the overextended notch pulse,
   * the reach arc, Thousand Cuts' hidden model and afterimages, the crossed-blades glyph on a
   * blow she can parry, the heavy pip. Oro: summons drawn (Saplings, the Ancient), their aura
   * rims (lit and greyed), root tethers, burrow trails, dormant summons (and waking ones, held
   * grey and still), the Ancient's warning and taunt ring, vines on rooted enemies, the tending
   * leaf.
   */
  readonly drawn5e = {
    notched: 0,
    enGarde: 0,
    tethers: 0,
    crowns: 0,
    overextended: 0,
    reachArcs: 0,
    hidden: 0,
    afterimages: 0,
    parryGlyphs: 0,
    heavyPips: 0,
    saplings: 0,
    ancients: 0,
    summonRims: 0,
    greyRims: 0,
    rootTethers: 0,
    burrows: 0,
    /** Verdant Choir's leaf rings (one per Sapling singing it). */
    choirRings: 0,
    dormant: 0,
    warnings: 0,
    tauntRings: 0,
    vines: 0,
    tending: 0,
  };
  /** The summons drawn last frame, in entity order (the summon bars read it). */
  readonly summonIds: EntityId[] = [];
  /** Seren or Oro is in the party this frame (the heavy pip may show). */
  private rosterHeavy = false;
  /**
   * Movement III (docs/phase-5c/vfx-audio.md), what was drawn last frame (tests, the lab): cloth
   * bodies drifting, a Maw's pulse; possession's rim, mask, tether and streaks; Doom's pips (and
   * those at four or more), a doomed hero's glow; sewn pairs; drag streaks in a pull; the rune
   * lock over a silenced Weaver; Emboldened shimmers, mirror shells, Spindle tethers, the
   * Spindles' plating, the champion's mirror Thread; Rift crown gems; the Stolen Verse's tint.
   */
  readonly drawnM3 = {
    hover: 0,
    mawPulse: 0,
    possessRims: 0,
    masks: 0,
    possessTethers: 0,
    streaks: 0,
    doomPips: 0,
    doomHot: 0,
    doomed: 0,
    sewn: 0,
    rooted: 0,
    drag: 0,
    runeLock: 0,
    emboldened: 0,
    mirrorShells: 0,
    spindleTethers: 0,
    plating: 0,
    championBeams: 0,
    gems: 0,
    verseTint: 0,
  };
  /**
   * The Finale (docs/phase-5d.md), what was drawn last frame (tests, the lab): heroes stilled by
   * the Grand Silence, drawn through Fermata's freeze-frame (desaturated, no tremor).
   */
  readonly drawnFinale = { stilled: 0 };
  /** Lab only: heroes shown stilled while the sim has none (never written into the sim). */
  stilledOverride: ReadonlySet<EntityId> | null = null;
  /** A Finale fight this frame (`field.finale`, or the lab's override): stilled is read only then. */
  private finaleLive = false;
  /** A hero's Rift statuses this frame (reused); the stitched pairs (id pairs, reused). */
  private readonly m3Look = emptyRiftLook();
  private readonly pairs: EntityId[] = [];
  /** The stolen aura's colour this frame (null: nothing stolen), the Stolen Verse's rim. */
  private stolenColor: THREE.Color | null = null;
  /** Lab-only: the stolen aura's id (the Stolen Verse's tint) while the sim has none. */
  stolenOverride: string | null = null;
  /**
   * This frame's Rift scene (collected as the entities are drawn): the tethered boss (an enemy
   * with `tethered` adds; it wears the plating), the standing tether adds (Spindles), the Hollow
   * Champions, and the boss their mirror Thread runs from.
   */
  private hub: EntityRec | null = null;
  private readonly tetherRecs: EntityRec[] = [];
  private readonly championRecs: EntityRec[] = [];
  private champHub: EntityRec | null = null;
  /** A hero's Legion statuses this frame (reused). */
  private readonly m2Look = emptyStatusLook();
  private readonly arc = { start: 0, len: 0 };
  private readonly pip = { x: 0, y: 0 };
  /**
   * The enemies' animation clock (real seconds): it stands still while Stasis holds them, so a
   * frozen enemy keeps its pose mid-motion (a stagger's shake, a stun's wobble, a boss's breath).
   */
  private enemyClock = 0;
  /** Real seconds since Stasis began, and where the Weaver stood (its stillness spreads from there). */
  private stasisAge = 0;
  private stasisX = 0;
  private stasisZ = 0;
  private stasisOn = false;
  /**
   * Phase Step's decoy (a Glide variant, docs/phase-4f/vfx-audio.md): the Weaver's own model where
   * she blinked from, standing until `until` (sim time; the enemies lose her that long). `drawn`:
   * it was drawn last frame (tests, the lab).
   */
  readonly decoy = { x: 0, z: 0, yaw: 0, until: -1, drawn: false };
  /** Rewind's preview: the model ghost where the threaded hero would go back to. */
  readonly rewindGhost: RewindGhost = {
    hero: -1,
    x: 0,
    z: 0,
    yaw: 0,
    alpha: 0,
    revive: 0,
    window: 0,
    drawn: false,
  };
  /**
   * What the Weaver wears (Phase 4g, keepsakeCues.ts): her robe colours her model and her resting
   * rim, her Thread look her ribbons and hands. `lookVision`: the colour vision it was fitted to
   * (null: fit it on the next frame).
   */
  private look: WeaverLook = { ...OWN_LOOK };
  private lookVision: ColorVision | null = null;
  private ribbonOuter: THREE.Color = C.gold;
  private ribbonInner: THREE.Color = C.goldHot;
  private rimAtRest: THREE.Color = C.gold;
  private rimAtRestStrength: number = OWN_RIM.strength;

  constructor(private readonly model: ModelMaterial) {
    this.group.name = 'entities';
    this.crown = new ModelBatch(buildCrown(), model.material, 48, false);
    this.group.add(this.crown.mesh);
    for (let i = 0; i < 18; i++) {
      this.ghosts.push({
        active: false,
        save: false,
        chrono: 0,
        x2: 0,
        z2: 0,
        batch: null,
        x: 0,
        z: 0,
        yaw: 0,
        age: 0,
        life: 0.4,
        hero: -1,
        side: 1,
        radius: 0.6,
      });
    }
  }

  setShadows(enabled: boolean): void {
    this.shadowsEnabled = enabled;
    for (const [key, b] of this.batches) b.mesh.castShadow = enabled && this.castsShadow(key);
  }

  /** What the Weaver wears (the profile's look). Cheap when unchanged: called every frame. */
  setLook(look: Readonly<WeaverLook>): void {
    if (look.robe === this.look.robe && look.thread === this.look.thread) return;
    this.look.robe = look.robe;
    this.look.thread = look.thread;
    this.lookVision = null;
  }

  /** What the Weaver wears now (tests, the lab). */
  get weaverLook(): Readonly<WeaverLook> {
    return this.look;
  }

  /**
   * Dresses her in the look as the colour vision sees it: the model recoloured in place (her
   * robe, her hands), her resting rim, her ribbons. Only when the look or the vision changes.
   */
  private fitLook(): void {
    const vision = currentVision();
    this.lookVision = vision;
    const weaver = this.batches.get('weaver');
    if (weaver) recolorModel(weaver.geometry, buildWeaver(weaverPalette(this.look, vision)));
    const rim = restRim(this.look.robe);
    this.rimAtRest = color(rim.hex);
    this.rimAtRestStrength = rim.strength;
    // (Her own are `C.gold` and `C.goldHot`: the same shared colours.)
    const ribbons = ribbonHex(this.look.thread, vision);
    this.ribbonOuter = color(ribbons.glow);
    this.ribbonInner = color(ribbons.filament);
  }

  private castsShadow(key: string): boolean {
    if (key === 'weaver' || key.startsWith('hero:')) return true;
    if (key === SUMMON_BATCH.ancient.key) return true;
    if (key.startsWith('enemy:')) {
      const def = enemyDef(key.slice(6));
      return (
        def.role === 'brute' ||
        def.role === 'miniboss' ||
        def.role === 'boss' ||
        def.role === 'controller'
      );
    }
    return false;
  }

  private batchFor(key: string, build: () => THREE.BufferGeometry, capacity: number): ModelBatch {
    let b = this.batches.get(key);
    if (!b) {
      b = new ModelBatch(
        build(),
        this.model.material,
        capacity,
        this.shadowsEnabled && this.castsShadow(key),
      );
      this.batches.set(key, b);
      this.group.add(b.mesh);
    }
    return b;
  }

  private createRec(e: ReadonlyEntity, state: WorldState): EntityRec {
    let batch: ModelBatch;
    const riftGems: number[] = [];
    const riftGemColors: THREE.Color[] = [];
    let hover = false;
    let hex = '#f5d78e';
    let accentHex = '#f5d78e';
    let role: string = e.kind;
    let tier = 'normal';
    let suppressRadius = 0;
    let quad = false;
    let half = 0;
    let affixColor: THREE.Color | null = null;
    const affixColors: THREE.Color[] = [];
    if (e.kind === 'weaver') {
      batch = this.batchFor(
        'weaver',
        () => buildWeaver(weaverPalette(this.look, currentVision())),
        16,
      );
      this.weaverId = e.id;
    } else if (e.hero) {
      const def = heroDef(e.hero.defId);
      // Room for the hero plus a few save ghosts (same model, same draw call).
      batch = this.batchFor(`hero:${def.id}`, () => buildHero(def), 8);
      hex = def.color;
      accentHex = def.color;
      role = def.role;
    } else if (e.enemy) {
      const def = enemyDef(e.enemy.defId);
      const big = def.role === 'boss' || def.role === 'miniboss';
      batch = this.batchFor(`enemy:${def.id}`, () => buildEnemy(def), big ? 4 : 64);
      hex = def.accent;
      accentHex = def.accent;
      role = def.role;
      tier = e.enemy.tier;
      // The def's dome, else a Silencing affix's (Movement III): the sim's own rule. For every
      // Movement I and II def it is `def.suppressRadius`, as before.
      suppressRadius = suppressRadiusOf(state, e);
      quad = isQuadruped(def.id);
      hover = hovers(def.id);
      half = def.guard ? guardHalf(def.id) : 0;
      for (const affix of e.enemy.affixes) {
        const a = CONTENT.affixes.find((x) => x.id === affix);
        if (a) affixColors.push(color(a.color));
        const gem = RIFT_GEM[affix];
        if (gem !== undefined && a) {
          riftGems.push(gem);
          riftGemColors.push(color(a.color));
        }
      }
      affixColor = affixColors[0] ?? null;
    } else if (e.summon) {
      // Oro's summons (docs/phase-5e.md): two lazy batches, made by the first summon drawn.
      const owner = state.entities.get(e.summon.owner);
      const moss = owner?.hero ? heroDef(owner.hero.defId).color : GROVE_HEX.moss;
      const spec = e.summon.kind === 'ancient' ? SUMMON_BATCH.ancient : SUMMON_BATCH.sapling;
      batch = this.batchFor(
        spec.key,
        () => (e.summon!.kind === 'ancient' ? buildAncient(moss) : buildSapling(moss)),
        spec.capacity,
      );
      hex = moss;
      accentHex = moss;
      role = e.summon.kind;
    } else {
      // Debug dummies share the chorister silhouette in a neutral grey.
      batch = this.batchFor(
        'dummy',
        () => buildEnemy({ ...enemyDef('hollow_chorister'), color: '#8b8fa8', accent: '#5b5f7a' }),
        512,
      );
      hex = '#8b8fa8';
      accentHex = '#5b5f7a';
    }
    const rec: EntityRec = {
      id: e.id,
      kind: e.kind,
      batch,
      radius: e.radius,
      height: e.height,
      color: color(hex),
      hex,
      accent: color(accentHex),
      role,
      tier,
      affixColor,
      affixColors,
      suppressRadius,
      seen: 0,
      x: e.x,
      z: e.z,
      y: 0,
      yaw: Math.atan2(-e.fx, -e.fz),
      walk: Math.random() * 10,
      flash: 0,
      lunge: 0,
      lungeX: 0,
      lungeZ: 0,
      stagger: 0,
      lie: 0,
      dissolve: 0,
      dying: -1,
      goldRim: 0,
      rimFlash: 0,
      beam: 0,
      bleedMax: 0,
      smokeAcc: 0,
      sparkleAcc: 0,
      shine: 0,
      lit: e.hero?.inField ? 1 : 0,
      kindled: 10,
      flinch: 0,
      rimHold: 0,
      rimHoldColor: new THREE.Color(),
      frost: 0,
      slow: 0,
      chronoFlash: 0,
      wardRef: null,
      wardSeen: 0,
      graceRef: null,
      conduit: 0,
      prism: 0,
      risen: 0,
      rising: 0,
      quad,
      guardHalf: half,
      guardWasBroken: false,
      guardFlash: 0,
      travel: 0,
      travelT: 0,
      travelDur: 0,
      travelFromX: 0,
      travelFromZ: 0,
      defId: e.enemy?.defId ?? '',
      hover,
      riftGems,
      riftGemColors,
      streakAt: -10,
      dragAcc: 0,
      lastHp: e.health?.hp ?? 0,
      alive: true,
    };
    this.recs.set(e.id, rec);
    return rec;
  }

  /** Lab-only: forget an entity's record, so it is read afresh (its affixes) next frame. */
  forget(id: EntityId): void {
    this.recs.delete(id);
  }

  // ── Event hooks (called by the feedback layer) ─────────────────────────────────────

  /**
   * A charge or a leap (`attackFired` 'charge' / 'leap', Movement II): the sim snapped the
   * caster to where it lands; it is drawn rushing (or arcing) there from where it was drawn.
   */
  travel(id: EntityId, kind: 'charge' | 'leap', fromX: number, fromZ: number): void {
    const r = this.recs.get(id);
    if (!r) return;
    r.travel = kind === 'leap' ? 2 : 1;
    r.travelT = 0;
    r.travelDur = kind === 'leap' ? LEAP_SECONDS : CHARGE_SECONDS;
    // From where it was last drawn (the event's own start, if it was never drawn).
    const drawn = r.seen > 0;
    r.travelFromX = drawn ? r.x : fromX;
    r.travelFromZ = drawn ? r.z : fromZ;
  }

  /** A guard broke (`guardBroken`): its arc flashes. */
  guardBreak(id: EntityId): void {
    const r = this.recs.get(id);
    if (r) r.guardFlash = 1;
  }

  hit(id: EntityId, amount = 1): void {
    const r = this.recs.get(id);
    if (r) r.flash = Math.max(r.flash, amount);
  }

  lungeAt(id: EntityId, toX: number, toZ: number): void {
    const r = this.recs.get(id);
    if (!r) return;
    const dx = toX - r.x;
    const dz = toZ - r.z;
    const d = Math.hypot(dx, dz) || 1;
    r.lungeX = dx / d;
    r.lungeZ = dz / d;
    r.lunge = 1;
  }

  staggerEntity(id: EntityId): void {
    const r = this.recs.get(id);
    if (r) r.stagger = 1;
  }

  saveFlash(id: EntityId): void {
    const r = this.recs.get(id);
    if (r) r.goldRim = 1;
  }

  /** The Martyr: a wound she Bears reaches her (a crimson flash and a recoil). */
  flinch(id: EntityId, amount = 1): void {
    const r = this.recs.get(id);
    if (r) r.flinch = Math.max(r.flinch, Math.min(1.4, amount));
  }

  attachFlash(id: EntityId): void {
    const r = this.recs.get(id);
    if (r) r.rimFlash = 1;
  }

  /** The Chronomancer: a silver rim flash (Rewind's arrival, a revive, an Echo Ward). */
  chronoFlash(id: EntityId, amount = 1): void {
    const r = this.recs.get(id);
    if (r) r.chronoFlash = Math.max(r.chronoFlash, Math.min(1.5, amount));
  }

  /** Eldritch Conduit: a technique paid in Life flickers the Weaver's rim blood-violet. */
  conduitFlash(id: EntityId, amount = 1): void {
    const r = this.recs.get(id);
    if (r) r.conduit = Math.max(r.conduit, Math.min(1.3, amount));
  }

  /**
   * Rewind's streak: afterimages of the hero left behind along it, from where they were (the
   * first, at once) back toward where they go (later ones), silver and quick to fade.
   */
  rewindEchoes(id: EntityId, fromX: number, fromZ: number, toX: number, toZ: number): void {
    const r = this.recs.get(id);
    if (!r || r.kind !== 'hero') return;
    const n = 4;
    for (let i = 0; i < n; i++) {
      const g = this.freeGhost();
      if (!g) return;
      const k = i / n;
      g.active = true;
      g.save = false;
      g.chrono = 1;
      g.batch = r.batch;
      g.hero = id;
      g.x = fromX + (toX - fromX) * k;
      g.z = fromZ + (toZ - fromZ) * k;
      g.yaw = r.yaw;
      g.age = -k * 0.16;
      g.life = 0.34;
      g.radius = r.radius;
    }
  }

  /**
   * Rewind stands a downed hero back up: their fall plays backwards, the body rising from where
   * it lay and running back to where they stood, silver, merging into the hero there.
   */
  unfall(id: EntityId, fromX: number, fromZ: number, toX: number, toZ: number): boolean {
    const r = this.recs.get(id);
    if (!r || r.kind !== 'hero') return false;
    const g = this.freeGhost();
    if (!g) return false;
    g.active = true;
    g.save = false;
    g.chrono = 2;
    g.batch = r.batch;
    g.hero = id;
    g.x = fromX;
    g.z = fromZ;
    g.x2 = toX;
    g.z2 = toZ;
    g.yaw = r.yaw;
    g.age = 0;
    g.life = UNFALL_LIFE;
    g.radius = r.radius;
    g.side = Math.random() < 0.5 ? -1 : 1;
    return true;
  }

  markDying(id: EntityId): void {
    const r = this.recs.get(id);
    if (r && r.dying < 0) {
      r.dying = 0;
      r.flash = 1;
    }
  }

  /** Phase Step: a decoy of the Weaver stands at (x, z), facing `yaw`, until sim time `until`. */
  phaseDecoy(x: number, z: number, yaw: number, until: number): void {
    const d = this.decoy;
    d.x = x;
    d.z = z;
    d.yaw = yaw;
    d.until = until;
  }

  /**
   * Phase Step's decoy: the Weaver's model, a gold-rimmed shimmer of her (the same model and draw
   * call), held still where she was until its time is up; it dissolves in its last moment.
   */
  private drawDecoy(state: WorldState): void {
    const d = this.decoy;
    d.drawn = false;
    const left = d.until - state.time;
    if (left <= 0) return;
    const w = this.recs.get(this.weaverId);
    if (!w) return;
    const out = 1 - clamp01(left / 0.3);
    const flicker = 0.05 * (0.5 + 0.5 * Math.sin(this.now * 7.3));
    const m = this.compose(d.x, 0, d.z, d.yaw, 0, 0, 1);
    w.batch.push(m, 0.06, 0.08 + flicker + 0.85 * out, 0.4, 0.45, C.gold, 1.15);
    d.drawn = true;
  }

  ghost(x: number, z: number, yaw: number, delay: number): void {
    const w = this.recs.get(this.weaverId);
    if (!w) return;
    const g = this.freeGhost();
    if (!g) return;
    g.active = true;
    g.save = false;
    g.chrono = 0;
    g.batch = w.batch;
    g.x = x;
    g.z = z;
    g.yaw = yaw;
    g.age = -delay;
    g.life = 0.42;
  }

  /** The Chronomancer's ghosts playing: Rewind's afterimages (1) or a fall played back (2). */
  chronoGhosts(kind: 1 | 2): number {
    let n = 0;
    for (const g of this.ghosts) if (g.active && g.chrono === kind) n++;
    return n;
  }

  private freeGhost(): Ghost | null {
    for (const g of this.ghosts) if (!g.active) return g;
    return null;
  }

  /**
   * Signature 1, "the death that didn't happen": a translucent, ashen copy of the saved hero
   * buckles and falls where they stood, dissolving in gold, while the real hero fights on.
   * Returns false if one was spawned for this hero a moment ago (a Fermata save sends both
   * `fermataReleased` and `save`).
   */
  saveGhost(id: EntityId): boolean {
    const r = this.recs.get(id);
    if (!r || r.kind !== 'hero') return false;
    for (const g of this.ghosts) {
      if (g.active && g.save && g.hero === id && g.age < 0.3) return false;
    }
    const g = this.freeGhost();
    if (!g) return false;
    g.active = true;
    g.save = true;
    g.chrono = 0;
    g.batch = r.batch;
    g.hero = id;
    g.x = r.x;
    g.z = r.z;
    g.yaw = r.yaw;
    g.age = 0;
    g.life = SAVE_GHOST_LIFE;
    g.side = Math.random() < 0.5 ? -1 : 1;
    g.radius = r.radius;
    return true;
  }

  /** Aura colours for a coverage mask, in content order (cached per mask). */
  auraColors(mask: number): readonly THREE.Color[] {
    let list = this.maskColors.get(mask);
    if (!list) {
      list = [];
      const auras = CONTENT.auras;
      for (let i = 0; i < auras.length; i++) {
        if (mask & (1 << i)) list.push(auraColor(auras[i]!.id));
      }
      this.maskColors.set(mask, list);
      const avg = new THREE.Color(0, 0, 0);
      for (const c of list) avg.add(c);
      if (list.length > 0) avg.multiplyScalar(1 / list.length);
      this.maskAvg.set(mask, avg);
    }
    return list;
  }

  /**
   * An affixed enemy's rim colour (into `this.tint`): its one affix's, or with several (Elite
   * Vanguard) each in turn, one per pulse of the rim, crossing over at the pulse's dimmest.
   */
  private affixTint(rec: EntityRec, clock: number): void {
    const list = rec.affixColors;
    const n = list.length;
    if (n <= 1) {
      this.tint.copy(rec.affixColor ?? list[0] ?? BLACK);
      return;
    }
    // The pulse (0.45 + 0.2 sin(3 clock + id)) is dimmest at whole turns of `u`.
    const u = (clock * 3 + rec.id) / AFFIX_TURN + 0.25;
    const turn = Math.floor(u);
    const f = u - turn;
    const at = ((turn % n) + n) % n;
    const a = list[at]!;
    if (f > 0.9) this.tint.copy(a).lerp(list[(at + 1) % n]!, (f - 0.9) / 0.2);
    else if (f < 0.1) this.tint.copy(list[(at + n - 1) % n]!).lerp(a, 0.5 + f / 0.2);
    else this.tint.copy(a);
  }

  private auraTint(mask: number): THREE.Color {
    this.auraColors(mask);
    return this.maskAvg.get(mask)!;
  }

  // ── Per-frame sync ─────────────────────────────────────────────────────────────────

  sync(state: WorldState, frame: FrameInfo, kit: FxKit, dt: number): void {
    this.frameNo++;
    this.now = frame.time;
    this.frameDt = dt;
    if (this.lookVision !== currentVision()) this.fitLook();
    this.model.uniforms.uTime.value = frame.time;
    for (const b of this.batches.values()) b.begin();
    this.crown.begin();

    const weaver = state.entities.get(state.weaverId);
    const w = weaver?.weaver;
    const threadedId = w && w.threadSlot !== null ? (state.party[w.threadSlot] ?? null) : null;
    const threadColor = threadModeColor(w?.threadMode);
    const beam = beamSong(state);
    this.beamMask = beam ? chordMask(beam.auras) : 0;
    this.beamFullEcho = beam ? isFullEcho(beam) : false;
    this.beamLevel = beam ? focusLevel(beam.focus) : 0;
    this.beamAllIn = beam ? isAllIn(beam) : false;
    const lum = state.calling?.id === 'luminary';
    this.sunrise = approach(this.sunrise, lum && state.field.crescendo ? 1 : 0, 4, dt);
    astroLook(state, this.astro);
    dissonanceLook(state, this.dis);
    this.drawnDis.risen = 0;
    this.drawnDis.rising = 0;
    this.drawnDis.gems = 0;
    this.drawnDis.cueTicks = 0;
    const m2 = this.drawnM2;
    m2.quadrupeds = 0;
    m2.crouch = 0;
    m2.lean = 0;
    m2.leaps = 0;
    m2.charges = 0;
    m2.pips = 0;
    m2.pipsHot = 0;
    m2.wounds = 0;
    m2.tethers = 0;
    m2.stakes = 0;
    m2.guardArcs = 0;
    m2.guardBroken = 0;
    const m3 = this.drawnM3;
    for (const k of Object.keys(m3) as (keyof typeof m3)[]) m3[k] = 0;
    this.drawnFinale.stilled = 0;
    this.finaleLive = state.field.finale !== undefined || this.stilledOverride !== null;
    this.hub = null;
    this.champHub = null;
    this.tetherRecs.length = 0;
    this.championRecs.length = 0;
    // Steal Verse (Movement III): the stolen aura's colour, for the Stolen Verse's rim.
    const stolen = state.field.stolen;
    const stolenId = stolen
      ? state.field.chords[stolen.chord]?.auras[stolen.aura]
      : (this.stolenOverride ?? undefined);
    this.stolenColor = stolenId ? auraColor(stolenId) : null;
    const b5 = this.drawn5b;
    b5.rage = 0;
    b5.spin = 0;
    b5.frenzy = 0;
    b5.frenzyGold = 0;
    b5.bloodlet = 0;
    // Seren and Oro (docs/phase-5e.md): counters, and whether either is here at all.
    const d5 = this.drawn5e;
    for (const k of Object.keys(d5) as (keyof typeof d5)[]) d5[k] = 0;
    this.summonIds.length = 0;
    this.rosterHeavy = rosterHeavyShown(state);
    // The Chronomancer's Stasis: the enemies' clock stops and the stillness spreads from her.
    const look = chronoLook(state, this.chrono);
    if (look.stasis && !this.stasisOn) {
      this.stasisAge = 0;
      this.stasisX = weaver?.x ?? state.field.x;
      this.stasisZ = weaver?.z ?? state.field.z;
    }
    this.stasisOn = look.stasis;
    if (look.stasis) this.stasisAge += dt;
    else this.enemyClock += dt;
    const target = beam?.threadHero ?? null;
    if (target !== this.beamTarget) {
      this.beamTarget = target;
      this.beamSince = 0;
    } else this.beamSince += dt;

    for (const e of state.entities.list()) {
      let rec = this.recs.get(e.id);
      if (!rec) rec = this.createRec(e, state);
      rec.seen = this.frameNo;
      this.updateRec(rec, e, state, frame, kit, dt, threadedId, threadColor);
    }
    for (const [id, rec] of this.recs) {
      if (rec.seen === this.frameNo) continue;
      if (rec.dying >= 0 && rec.dying < 0.9) {
        this.updateDying(rec, kit, dt);
      } else {
        this.recs.delete(id);
      }
    }
    this.riftScene(state, kit);
    // Seren (docs/phase-5e.md): the crossed blades on every blow she can parry, aimed at her.
    if (this.rosterHeavy) this.parryGlyphs(state, kit);
    this.updateGhosts(kit, dt);
    this.rewindPreview(state, dt);
    this.drawDecoy(state);
    for (const b of this.batches.values()) b.end();
    this.crown.end();
  }

  /**
   * Rewind's preview (the Chronomancer): while Rewind is ready, a faint silver ghost of the
   * threaded hero stands where Rewind would send them (their oldest remembered moment). It
   * hides while they stand where they stood, and shows stronger when they are down and Rewind
   * would stand them back up. ChronoView draws the trail to it from `rewindGhost`.
   */
  private rewindPreview(state: WorldState, dt: number): void {
    const g = this.rewindGhost;
    const e = rewindPreviewHero(state, this.chrono);
    const past = e ? rewindSample(e) : null;
    const rec = e ? this.recs.get(e.id) : undefined;
    g.drawn = false;
    if (e && past && rec) {
      if (g.hero !== e.id || g.alpha < 0.01) {
        g.hero = e.id;
        g.x = past.x;
        g.z = past.z;
        g.yaw = rec.yaw;
      } else {
        g.x = approach(g.x, past.x, 16, dt);
        g.z = approach(g.z, past.z, 16, dt);
      }
      // Facing the way they were going then (the next remembered moment), else as they face now.
      const h = e.hero!;
      const next = h.past[(h.pastAt + 1) % h.past.length]!;
      const mx = next.x - past.x;
      const mz = next.z - past.z;
      const yaw = mx * mx + mz * mz > 1e-4 ? Math.atan2(-mx, -mz) : rec.yaw;
      g.yaw = angleApproach(g.yaw, yaw, 8, dt);
      g.alpha = approach(g.alpha, 1, 6, dt);
      const down = !!e.health?.downed;
      g.revive = approach(g.revive, down ? 1 : 0, 8, dt);
      g.window = down ? reviveWindow(e) : 0;
    } else {
      g.alpha = approach(g.alpha, 0, 8, dt);
      g.revive = approach(g.revive, 0, 8, dt);
      g.window = 0;
      if (g.alpha < 0.01) {
        g.alpha = 0;
        g.hero = -1;
      }
    }
    if (g.hero < 0 || g.alpha <= 0.02) return;
    const r = this.recs.get(g.hero);
    if (!r) return;
    // Hidden while they stand where they stood (it would sit inside them).
    const apart = clamp01((Math.hypot(r.x - g.x, r.z - g.z) - 0.4) / 0.7);
    const show = g.alpha * Math.max(apart, g.revive);
    if (show <= 0.02) return;
    const m = this.compose(g.x, 0, g.z, g.yaw, 0, 0, 1);
    const k = g.revive;
    r.batch.push(
      m,
      0,
      0.62 - 0.4 * show - 0.12 * k,
      0.9,
      0.95 - 0.3 * k,
      CHRONO_SILVER,
      0.75 + 0.55 * k,
      0,
      0,
      1,
    );
    g.drawn = true;
  }

  private compose(
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    roll: number,
    scale: number,
    scaleY = scale,
  ): THREE.Matrix4 {
    this.e.set(pitch, yaw, roll, 'YXZ');
    this.q.setFromEuler(this.e);
    this.p.set(x, y, z);
    this.s.set(scale, scaleY, scale);
    return this.m.compose(this.p, this.q, this.s);
  }

  private updateDying(rec: EntityRec, kit: FxKit, dt: number): void {
    rec.dying += dt;
    const t = clamp01(rec.dying / 0.75);
    rec.flash = Math.max(0, rec.flash - dt * 5);
    const sink = t * t * 0.25;
    // Gone for good while it was still standing back up (Restless Dead: the sim keeps it
    // untouchable then, but a debug clear can take it), it crumbles where it lies.
    const lie = rec.rising;
    const m = this.compose(
      rec.x,
      rec.radius * 0.42 * lie - sink,
      rec.z,
      rec.yaw,
      Math.max(0.15 * t, 1.35 * lie),
      0,
      1 + t * 0.06,
    );
    // (Killed while Stasis held it, it stays cold as it goes. Risen once already (Restless Dead),
    // it stays ashen and crumbles to ash for good.)
    const ash = rec.risen > 0;
    rec.batch.push(
      m,
      rec.flash,
      0.05 + t * 0.95,
      Math.max(ash ? RISEN_DESAT : 0, 0.3 * t),
      0,
      ash ? ASH : rec.accent,
      1,
      0,
      0,
      rec.frost,
    );
    kit.shadows.push(
      rec.x,
      0.015,
      rec.z,
      rec.radius * 1.2,
      0,
      0,
      RING.soft,
      BLACK,
      0.45 * (1 - t),
      0,
      7,
      1,
    );
  }

  private updateRec(
    rec: EntityRec,
    e: ReadonlyEntity,
    state: WorldState,
    frame: FrameInfo,
    kit: FxKit,
    dt: number,
    threadedId: EntityId | null,
    threadColor: THREE.Color,
  ): void {
    if (rec.dying >= 0) {
      rec.x = e.x;
      rec.z = e.z;
      this.updateDying(rec, kit, dt);
      return;
    }
    const alpha = frame.alpha;
    let x = e.px + (e.x - e.px) * alpha;
    let z = e.pz + (e.z - e.pz) * alpha;
    // A charge or a leap (Movement II): drawn from where it stood to where the sim put it.
    let travelK = -1;
    if (rec.travel > 0) {
      rec.travelT += dt;
      const t = clamp01(rec.travelT / rec.travelDur);
      if (t >= 1) rec.travel = 0;
      else {
        travelK = t;
        const ease = rec.travel === 2 ? t : 1 - (1 - t) * (1 - t);
        x = rec.travelFromX + (x - rec.travelFromX) * ease;
        z = rec.travelFromZ + (z - rec.travelFromZ) * ease;
      }
    }
    rec.x = x;
    rec.z = z;
    const h = e.health;
    const time = state.time;

    // Fermata hold: a freeze-frame. The pose stops mid-motion until the hold resolves.
    // The Finale's Grand Silence: a stilled hero takes the same freeze-frame, without its tremor
    // or Fermata's lavender rim unless Fermata holds them too (read only in a Finale fight).
    const stilled =
      this.finaleLive &&
      e.kind === 'hero' &&
      !!h &&
      (hasStatus(h.statuses, 'stilled') || !!this.stilledOverride?.has(e.id));
    // Fermata's own hold keeps working in the silence: its tremor and lavender rim win.
    const fermata = !!e.hero?.hold || (!!h && hasStatus(h.statuses, 'held'));
    const held = fermata || stilled;
    // Stasis (the Chronomancer): every enemy stands still mid-motion; its own clock waits.
    const isEnemy = e.kind === 'enemy';
    const frozen = isEnemy && this.stasisOn;
    const clock = isEnemy ? this.enemyClock : this.now;
    if (isEnemy) {
      const reached =
        frozen &&
        stasisWave(this.stasisAge) >=
          Math.hypot(rec.x - this.stasisX, rec.z - this.stasisZ) - rec.radius;
      rec.frost = approach(rec.frost, reached ? 1 : 0, reached ? 16 : 6, dt);
      if (rec.frost < 0.003) rec.frost = 0;
      rec.slow = approach(rec.slow, slowDanced(state, e) ? 1 : 0, 3, dt);
      if (rec.slow < 0.003) rec.slow = 0;
    }
    // Red Frenzy (Brann, docs/phase-5b.md): he spins as he chases, a whirlwind, until it ends.
    const spin =
      !held && !frozen && !!e.hero && e.hero.soloActive > 0 && e.hero.soloId === 'redFrenzy';
    if (spin) {
      rec.yaw = (rec.yaw + FRENZY_SPIN * dt) % (Math.PI * 2);
      this.drawn5b.spin++;
    } else if (!held && !frozen) rec.yaw = angleApproach(rec.yaw, Math.atan2(-e.fx, -e.fz), 14, dt);
    const speed = held || frozen ? 0 : Math.hypot(e.vx, e.vz);
    rec.walk += dt * speed * (rec.quad ? 3.6 : 2.2);
    const moving = Math.min(1, speed / 2.5);
    let bob = Math.abs(Math.sin(rec.walk * Math.PI)) * 0.07 * moving * (rec.height / 2);
    let pitch = -0.12 * moving;
    let roll = Math.sin(rec.walk * Math.PI) * 0.04 * moving;
    if (rec.quad) {
      // A dog's gait (Movement II): a quicker, deeper bob and a pitch rock, no side sway.
      bob = Math.abs(Math.sin(rec.walk * Math.PI)) * 0.1 * moving * (rec.height / 2);
      pitch = -0.05 * moving + Math.sin(rec.walk * Math.PI * 2) * 0.07 * moving;
      roll = 0;
      this.drawnM2.quadrupeds++;
    } else if (rec.hover) {
      // A cloth body drifting (Movement III): it floats and sways, never a stride.
      bob = (0.1 + 0.05 * Math.sin(clock * 1.7 + rec.id)) * (rec.height / 2);
      pitch = -0.06 * moving;
      roll = Math.sin(clock * 1.1 + rec.id) * 0.035;
      this.drawnM3.hover++;
    }
    let y = bob;
    let scaleY = 1;
    let ox = 0;
    let oz = 0;
    let scale = 1;
    let dissolve = 0;
    let desat = 0;
    let ghost = 0;

    // Attack lunge (Slow Dance: a little slower; Stasis: held mid-swing).
    if (rec.lunge > 0 && !held) {
      const k = Math.sin((1 - rec.lunge) * Math.PI);
      const amt = k * Math.min(0.45, rec.radius * 0.5);
      ox += rec.lungeX * amt;
      oz += rec.lungeZ * amt;
      pitch -= k * 0.12;
      if (!frozen) rec.lunge = Math.max(0, rec.lunge - dt * 5.5 * (1 - 0.15 * rec.slow));
    }
    // Perfect Ward stagger: a violent shake and a recoil back.
    if (rec.stagger > 0) {
      const k = rec.stagger;
      ox += Math.sin(clock * 57) * 0.14 * k;
      oz += Math.cos(clock * 49) * 0.1 * k;
      pitch += 0.28 * k;
      if (!frozen) rec.stagger = Math.max(0, rec.stagger - dt * 1.7);
    }
    // Movement II: a Pounce's crouch (a squash before the leap) and a charge's lean, read from
    // the cast; then the leap's arc and the charge's rush while it is drawn travelling.
    const cast = e.enemy?.cast;
    if (cast && !held) {
      const move = moveOf(cast.attackId);
      if (move) {
        const k = clamp01((time - cast.start) / Math.max(0.01, cast.end - cast.start));
        if (move === 'leap') {
          scaleY *= 1 - 0.26 * k;
          pitch -= 0.14 * k;
          ox += Math.sin(clock * 31) * 0.02 * k;
          this.drawnM2.crouch++;
        } else {
          // Braced, leaning in over the pike, a shudder as it is about to go.
          pitch -= 0.32 * k;
          ox += Math.sin(clock * 37) * 0.025 * k * k;
          this.drawnM2.lean++;
        }
      }
    }
    // The Void Maw (Movement III): its mouth swells through the Inhale's tell, then gulps while
    // its pull holds.
    if (rec.defId === 'void_maw' && !held) {
      const zones = state.field.zones;
      let pulling = false;
      if (zones)
        for (const zn of zones) if (zn.owner === e.id && zn.kind === 'pull') pulling = true;
      if (cast?.attackId === 'maw_inhale') {
        const k = clamp01((time - cast.start) / Math.max(0.01, cast.end - cast.start));
        scale *= 1 + 0.14 * k;
        scaleY *= 1 - 0.18 * k;
        this.drawnM3.mawPulse++;
      } else if (pulling) {
        const g = 0.5 + 0.5 * Math.sin(clock * 7);
        scale *= 1.1 + 0.05 * g;
        scaleY *= 0.85 - 0.08 * g;
        this.drawnM3.mawPulse++;
      }
    }
    if (travelK >= 0) {
      if (rec.travel === 2) {
        y += Math.sin(Math.PI * travelK) * (1.4 + rec.radius * 0.8);
        pitch += 0.35 - 0.7 * travelK;
        scaleY *= 1 + 0.12 * Math.sin(Math.PI * travelK);
        this.drawnM2.leaps++;
      } else {
        pitch -= 0.5;
        this.drawnM2.charges++;
      }
    }
    // The Martyr's flinch: a small recoil back and a shudder.
    if (rec.flinch > 0.01 && !held) {
      const k = Math.min(1, rec.flinch);
      pitch += 0.16 * k * k;
      ox += Math.sin(this.now * 53) * 0.035 * k;
    }
    rec.flinch = Math.max(0, rec.flinch - dt * 3.5);
    rec.flash = Math.max(0, rec.flash - dt * 9);
    rec.goldRim = Math.max(0, rec.goldRim - dt * 1.4);
    rec.rimFlash = Math.max(0, rec.rimFlash - dt * 3);
    rec.chronoFlash = Math.max(0, rec.chronoFlash - dt * 2.6);
    rec.conduit = Math.max(0, rec.conduit - dt * 3.4);

    // Spawning: rise out of the portal. Restless Dead (Dissonance): a risen enemy instead falls
    // back into ash where it was struck down, and stands back up out of it (riseShape).
    const enemy = e.enemy;
    let riseGlow = 0;
    rec.rising = 0;
    if (enemy?.state === 'spawning' && enemy.risen) {
      const r = riseShape(enemy.stateTime, this.riseOut);
      pitch = r.pitch;
      roll = 0;
      y += rec.radius * 0.42 * r.lie;
      dissolve = r.dissolve;
      desat = Math.max(desat, r.desat);
      riseGlow = r.glow;
      rec.rising = Math.max(0.001, r.lie);
      this.drawnDis.rising++;
    } else if (enemy?.state === 'spawning') {
      const s = clamp01(enemy.stateTime / 0.6);
      dissolve = 1 - s;
      y -= (1 - s) * 0.4;
      if (s < 1) rec.flash = Math.max(rec.flash, (1 - s) * 0.6);
    }
    // Risen once (it won't rise again): drained to ash once it stands.
    rec.risen = enemy?.risen ? 1 : 0;
    if (rec.risen > 0 && rec.rising === 0) {
      desat = Math.max(desat, RISEN_DESAT);
      this.drawnDis.risen++;
    }
    if (
      enemy?.state === 'stunned' ||
      (h && (hasStatus(h.statuses, 'stun') || hasStatus(h.statuses, 'stagger')))
    ) {
      roll += Math.sin(clock * 9) * 0.06;
    }

    // Downed / dead heroes lie down and lose their colour.
    const downed = !!h && (h.downed || h.dead);
    rec.lie = approach(rec.lie, downed ? 1 : 0, 10, dt);
    if (rec.lie > 0.001) {
      pitch = pitch * (1 - rec.lie) + (Math.PI / 2) * rec.lie;
      roll *= 1 - rec.lie;
      y += rec.radius * 0.45 * rec.lie;
      desat = 0.85 * rec.lie;
    }
    if (h?.dead && e.kind !== 'enemy') {
      rec.dissolve = approach(rec.dissolve, 1, 1.4, dt);
      dissolve = Math.max(dissolve, rec.dissolve);
    } else rec.dissolve = 0;
    // The Weaver re-forming.
    if (e.weaver && e.weaver.reform > 0) {
      desat = 0.8;
      ghost = 0.55;
      y += 0.05 * Math.sin(this.now * 3);
    }
    // Reel flight arc.
    const reel = e.hero?.reel;
    if (reel && reel.end > reel.start) {
      const t = clamp01((time - reel.start) / (reel.end - reel.start));
      y += Math.sin(Math.PI * t) * 1.5;
      pitch -= 0.4 * Math.sin(Math.PI * t);
    }
    if (held) {
      desat = Math.max(desat, 0.72);
      // A tiny tremor: holding on by a thread (a hero only stilled is simply still).
      if (stilled) this.drawnFinale.stilled++;
      if (fermata) ox += Math.sin(this.now * 41) * 0.015;
    }
    // Glide: lean hard into the dash.
    if (e.weaver && e.weaver.glide > 0) pitch -= 0.35;
    if (rec.kind === 'enemy' && (rec.role === 'boss' || rec.role === 'miniboss')) {
      // Bosses breathe (held while Stasis holds them).
      scale *= 1 + Math.sin(clock * 1.6) * 0.012;
    }
    // The beam song pours into this hero: they visibly swell with it (5% at ×2, 8% all in).
    const poured =
      !!e.hero?.beamFocus &&
      this.beamMask !== 0 &&
      !downed &&
      !held &&
      (rec.beam > 0.5 || this.beamSince >= POUR_TRAVEL * 0.85);
    rec.beam = approach(rec.beam, poured ? 1 : 0, 5, dt);
    if (rec.beam > 0.001) {
      const swell = 0.03 + 0.03 * Math.min(1, this.beamLevel) + (this.beamAllIn ? 0.02 : 0);
      scale *= 1 + swell * rec.beam * (1 + 0.15 * Math.sin(this.now * 5));
    }
    // Seren's Thousand Cuts (docs/phase-5e.md): she vanishes; her afterimages are the ghosts'.
    if (e.hero?.duel && cutting(e)) {
      dissolve = 1;
      this.drawn5e.hidden++;
    }
    // Oro's summons: a burrowing Sapling sinks into the ground; a dormant one stands grey.
    if (e.summon) {
      const rise = ancientRising(state, e);
      if (rise >= 0) {
        // The Ancient through its ground warning: still below, coming up as the ring closes.
        y -= rec.height * (1 - rise);
        dissolve = Math.max(dissolve, 0.9 - 0.5 * rise);
      } else if (burrowing(state, e)) {
        y -= 0.35;
        dissolve = Math.max(dissolve, 0.55);
      }
      if (stillHeld(state, e)) {
        desat = Math.max(desat, 0.75);
        this.drawn5e.dormant++;
      }
    }
    rec.y = y;

    // Rim tint priority: Fermata hold > Save gold > possessed > threaded > hovered > focus >
    // auras > affix. A possessed hero (Movement III) wears an indigo rim over the Thread's: they
    // are to be saved (Chime), never Focused or Empowered.
    let tintStrength = 0;
    const isHero = e.kind === 'hero';
    const auraMask = e.hero?.auraMask ?? 0;
    if (fermata) {
      this.tint.copy(FERMATA);
      tintStrength = 1.1 + 0.35 * Math.sin(this.now * 7);
    } else if (rec.goldRim > 0) {
      this.tint.copy(C.gold);
      tintStrength = 0.5 + rec.goldRim * 2.2;
    } else if (isHero && h && !h.dead && hasStatus(h.statuses, 'possessed')) {
      this.tint.copy(POSSESS);
      tintStrength = 0.85 + 0.3 * Math.sin(this.now * 5);
      this.drawnM3.possessRims++;
    } else if (isHero && e.id === threadedId) {
      // The beam song's colours breathe through the Thread's rim while it pours in.
      this.tint.copy(threadColor);
      if (rec.beam > 0.01) {
        const k = (0.4 + 0.2 * Math.sin(this.now * 4)) * rec.beam;
        this.tint.lerp(this.auraTint(this.beamMask), k);
      }
      tintStrength = 0.5 + rec.rimFlash * 1.5 + 0.25 * Math.min(1, this.beamLevel) * rec.beam;
    } else if (isHero && e.id === frame.hoveredHero) {
      this.tint.setRGB(1, 1, 1);
      tintStrength = 0.45;
    } else if (e.kind === 'enemy' && e.id === state.focusTarget) {
      this.tint.copy(C.gold);
      tintStrength = 0.55 + 0.25 * Math.sin(this.now * 6);
    } else if (e.kind === 'enemy' && e.id === frame.hoveredEnemy) {
      this.tint.setRGB(1, 1, 1);
      tintStrength = 0.5;
    } else if (isHero && auraMask !== 0) {
      this.tint.copy(this.auraTint(auraMask));
      tintStrength = 0.3;
    } else if (e.summon && (e.summon.auraMask ?? 0) !== 0 && e.summon.inField) {
      // A Sapling in your songs takes their tint, as a hero does (Q1).
      this.tint.copy(this.auraTint(e.summon.auraMask!));
      tintStrength = 0.3;
    } else if (rec.defId === STOLEN_VERSE_ID && this.stolenColor) {
      // The Stolen Verse (Movement III): an orb in the stolen aura's colour.
      this.tint.copy(this.stolenColor);
      tintStrength = 0.95 + 0.25 * Math.sin(clock * 4);
      this.drawnM3.verseTint++;
    } else if (rec.affixColor) {
      this.affixTint(rec, clock);
      tintStrength = 0.45 + 0.2 * Math.sin(clock * 3 + rec.id);
    } else if (rec.risen > 0) {
      // Restless Dead: risen once, a pale ash rim (an affix's colour, if any, wins).
      this.tint.copy(ASH);
      tintStrength = 0.32;
    } else if (rec.tier === 'elite') {
      this.tint.copy(C.gold);
      tintStrength = 0.18;
    } else if (isEnemy && rec.role !== 'boss' && rec.role !== 'miniboss' && dissolve < 0.001) {
      // Rank and file: a faint edge in their life bar's red, so a pale chorister or a dark hound
      // stands out from the floor and the pillars before it is hurt (it has no bar till then).
      // Not while it is still forming: the dissolve's edge would glow in the rim's colour.
      this.tint.copy(ENEMY_BAR);
      tintStrength = HOSTILE_RIM;
    } else {
      this.tint.copy(BLACK);
    }
    if (
      isEnemy &&
      e.enemy?.emboldenedUntil !== undefined &&
      emboldenedAt(e, time) &&
      e.id !== state.focusTarget &&
      e.id !== frame.hoveredEnemy
    ) {
      // Emboldened (Movement III): a mirror shimmer through its rim (never gold).
      this.tint.lerp(MIRROR, 0.55 + 0.3 * Math.sin(clock * 6 + rec.id));
      tintStrength = Math.max(tintStrength, 0.6);
    }
    if (isEnemy && rec.frost > 0.01 && e.id !== state.focusTarget && e.id !== frame.hoveredEnemy) {
      // Held by Stasis: a cold, glassy silver-blue edge.
      this.tint.lerp(CHRONO_SILVER, 0.8 * rec.frost);
      tintStrength = Math.max(tintStrength * (1 - 0.4 * rec.frost), 0.42 * rec.frost);
    }
    if (riseGlow > 0.01) {
      // Standing back up out of the ash: a cold grave-light at its edges, brightest where the ash
      // is still eating into it (the dissolve's edge takes the rim's colour).
      this.tint.copy(GRAVE);
      tintStrength = 0.2 + 0.5 * riseGlow;
    }
    if (rec.chronoFlash > 0.01) {
      // The Chronomancer's moment on this hero: a silver rim flash.
      this.tint.lerp(CHRONO_SILVER, Math.min(1, rec.chronoFlash));
      tintStrength = Math.max(tintStrength, 0.4 + 1.5 * Math.min(1, rec.chronoFlash));
    }
    if (rec.kind === 'weaver') {
      // The Martyr: a borne wound flashes her rim crimson; Vigil and Scarred Hide hold one.
      // Eldritch Conduit: a technique paid in Life flickers it blood-violet.
      if (rec.flinch > 0.01) {
        this.tint.copy(FLINCH);
        tintStrength = 0.4 + 1.9 * Math.min(1, rec.flinch);
      } else if (rec.conduit > 0.01) {
        // A quick flicker (steady at Flashes 0), gone in ~0.3 s.
        const wob = 0.38 * clamp01(frame.settings.flashes);
        const f = Math.min(1, rec.conduit) * (1 - wob + wob * Math.sin(this.now * 47));
        this.tint.copy(CONDUIT);
        tintStrength = 0.35 + 1.75 * f;
      } else if (rec.rimHold > 0.01) {
        this.tint.copy(rec.rimHoldColor);
        tintStrength = rec.rimHold;
      } else if (tintStrength === 0) {
        // At rest: her own faint gold, or her robe's trim (stronger on a dark robe).
        this.tint.copy(this.rimAtRest);
        tintStrength = this.rimAtRestStrength;
      }
    }

    const m = this.compose(x + ox, y, z + oz, rec.yaw, pitch, roll, scale, scale * scaleY);
    if (isHero) {
      // The Luminary's Radiance: a hero standing in the field shines (brighten in ~0.15 s,
      // fade out in ~0.5 s, so stepping in and out reads without a pop).
      const target = held ? 0 : shineLevel(shineOf(state, e));
      if (target > 0.05 && rec.shine < 0.05) rec.kindled = 0;
      else rec.kindled += dt;
      rec.shine = approach(rec.shine, target, target > rec.shine ? 9 : 4.5, dt);
      if (rec.shine < (target > 0 ? 0.002 : 0.02)) rec.shine = 0;
      rec.lit = approach(rec.lit, e.hero?.inField && !downed ? 1 : 0, 6, dt);
    } else if (rec.kind === 'weaver') {
      // Prism Covenant (the Astrolabe): a spectral edge on her while she fights at its cap.
      const capped = this.astro.prism && atLifeCap(state);
      rec.prism = approach(rec.prism, capped ? 1 : 0, capped ? 3 : 5, dt);
      if (rec.prism < 0.003) rec.prism = 0;
    }
    rec.batch.push(
      m,
      rec.flash,
      dissolve,
      desat,
      ghost,
      this.tint,
      tintStrength,
      Math.min(1.1, rec.shine) * (1 - desat),
      this.sunrise,
      // Stasis' frost; Slow Dance only cools them a little (no new clutter).
      Math.max(rec.frost, rec.slow * 0.35),
      rec.prism * (1 - desat),
    );

    // Blob shadow (fodder has no shadow-map shadow) and selection rings.
    kit.shadows.push(
      x,
      0.015,
      z,
      rec.radius * 1.25,
      0,
      0,
      RING.soft,
      BLACK,
      0.5 * (1 - dissolve),
      0,
      7,
      1,
    );

    if (rec.tier === 'elite') {
      const cm = this.compose(
        x + ox,
        y + rec.height + 0.22,
        z + oz,
        clock * 0.8,
        0,
        0,
        Math.max(0.8, rec.radius * 1.2),
      );
      this.crown.push(cm, 0, dissolve, 0, 0, C.gold, 0.4);
      // Elite Vanguard: an elite with more than one affix wears a gem for each round its crown.
      const n = rec.affixColors.length;
      if (n > 1 && dissolve < 0.95) {
        const s = Math.max(0.8, rec.radius * 1.2);
        for (let i = 0; i < n; i++) {
          const a = clock * 0.8 + (i * Math.PI * 2) / n;
          kit.sprites.push(
            x + ox + Math.cos(a) * 0.46 * s,
            y + rec.height + 0.3 + 0.03 * Math.sin(clock * 2.4 + i * 2),
            z + oz + Math.sin(a) * 0.46 * s,
            0.15 * s,
            SPRITE.diamond,
            rec.affixColors[i]!,
            0.95 * (1 - dissolve),
          );
        }
        this.drawnDis.gems += n;
      }
      // A Rift affix (Movement III) wears a shaped gem at the crown's peak: scissors (Severing),
      // a rune (Silencing), a mirror (Mimicking), a Doom pip (Doom-touched). Two that sit close
      // in colour are told apart by shape, as Shielded and Volatile are.
      const gems = rec.riftGems;
      if (gems.length > 0 && dissolve < 0.95) {
        const s = Math.max(0.8, rec.radius * 1.2);
        for (let i = 0; i < gems.length; i++) {
          const k = gems.length === 1 ? 0 : i / (gems.length - 1) - 0.5;
          kit.sprites.push(
            x + ox + k * 0.5 * s,
            y + rec.height + 0.62 * s + 0.04 * Math.sin(clock * 2 + i),
            z + oz,
            0.2 * s,
            gems[i]!,
            rec.riftGemColors[i]!,
            0.95 * (1 - dissolve),
            0,
            1,
            1,
          );
        }
        this.drawnM3.gems += gems.length;
      }
    }

    if (isHero) this.heroExtras(rec, e, state, frame, kit, dt, threadedId, threadColor);
    else if (e.kind === 'enemy') this.enemyExtras(rec, e, state, frame, kit, clock);
    else if (e.kind === 'weaver') this.weaverExtras(rec, e, kit, dt);
    else if (e.summon) this.summonExtras(rec, e, state, kit, dt);
    if (h) this.shields(rec, e, state, kit);
    if (h) this.ailments(rec, e, kit, dt);
    if (h && h.statuses.length > 0 && !h.dead) this.crimson(rec, e, kit, dt);
    if (h && !h.dead) this.rift(rec, e, state, kit, dt);
    if (h) rec.lastHp = h.hp;
  }

  private heroExtras(
    rec: EntityRec,
    e: ReadonlyEntity,
    state: WorldState,
    frame: FrameInfo,
    kit: FxKit,
    dt: number,
    threadedId: EntityId | null,
    threadColor: THREE.Color,
  ): void {
    const h = e.health!;
    const hero = e.hero!;
    const x = rec.x;
    const z = rec.z;
    if (h.dead) return;
    const threaded = e.id === threadedId;
    const hovered = e.id === frame.hoveredHero;
    // Brann's rings are his brass: his crimson under him would read as a telegraph (Phase 5b).
    const signal = signalHex(hero.defId, '');
    const own = signal ? color(signal) : rec.color;
    const ringColor = threaded ? threadColor : own;
    const ringAlpha = threaded ? 0.95 : hovered ? 0.8 : 0.38;
    kit.rings.push(
      x,
      0.03,
      z,
      rec.radius * 1.45,
      threaded ? 0.1 : 0.06,
      threaded ? 0.25 : 0.1,
      RING.plain,
      ringColor,
      ringAlpha,
    );
    if (hovered && !threaded) {
      kit.rings.push(
        x,
        0.03,
        z,
        rec.radius * 1.8,
        0.05,
        0.05,
        RING.dashed,
        C.white,
        0.6,
        0,
        7,
        0,
        12,
      );
    }

    // Per-aura rim lights: the ring under the hero splits into one lit arc per aura on them.
    // Phase 3: how they hear it shows in the arc. Field song: solid (Phase 2). The beam song
    // poured in: a thick, glowing arc with a second arc outside. Its echo: thin and dashed.
    if (hero.auraMask !== 0 && !h.downed)
      this.auraRims(kit, x, z, rec.radius, hero.auraMask, hero.beamFocus);

    if (h.downed) {
      if (rec.bleedMax < h.bleedOut) rec.bleedMax = h.bleedOut;
      const bleed = rec.bleedMax > 0 ? h.bleedOut / rec.bleedMax : 0;
      kit.rings.push(
        x,
        0.04,
        z,
        rec.radius * 2.0,
        0.08,
        0.15,
        RING.plain,
        C.lethal,
        0.7,
        -Math.PI / 2,
        bleed * Math.PI * 2,
      );
      if (h.revive > 0) {
        kit.rings.push(
          x,
          0.05,
          z,
          rec.radius * 2.4,
          0.16,
          0.3,
          RING.plain,
          C.heal,
          1,
          -Math.PI / 2,
          h.revive * Math.PI * 2,
        );
        rec.sparkleAcc += dt * 18 * kit.particles.density;
        while (rec.sparkleAcc > 1) {
          rec.sparkleAcc -= 1;
          const a = Math.random() * Math.PI * 2;
          const r = rec.radius * 2.4;
          kit.particles.emit(
            x + Math.cos(a) * r,
            0.1,
            z + Math.sin(a) * r,
            0,
            1.6,
            0,
            0.8,
            0.12,
            C.heal,
            0.9,
            PARTICLE.dot,
            0.5,
          );
        }
      }
    } else {
      rec.bleedMax = 0;
    }

    // Solo charged and waiting for a Cue: a gold pulse and orbiting motes.
    if (hero.solo >= 100 && hero.soloActive <= 0 && !h.downed) {
      const pulse = (this.now * 1.2) % 1;
      kit.rings.push(
        x,
        0.04,
        z,
        rec.radius * (1.4 + pulse * 1.1),
        0.05,
        0.12,
        RING.plain,
        C.amp,
        0.7 * (1 - pulse),
      );
      for (let i = 0; i < 3; i++) {
        const a = this.now * 2.4 + (i * Math.PI * 2) / 3;
        kit.sprites.push(
          x + Math.cos(a) * rec.radius * 1.3,
          rec.height * 0.55 + Math.sin(this.now * 3 + i) * 0.15,
          z + Math.sin(a) * rec.radius * 1.3,
          0.16,
          SPRITE.diamond,
          C.amp,
          0.9,
        );
      }
    }
    // Brann's Blood Rage, Red Frenzy and Bloodletting (absent `blood`: every default hero).
    if (hero.blood && !h.downed) this.blood(rec, e, kit, dt);
    // Seren's duel and Oro's grove (absent `duel` / `grove`: every other hero, docs/phase-5e.md).
    if (hero.duel) this.duel(rec, e, state, kit);
    if (hero.grove) this.grove(rec, e, state, kit);
    // Active Solo: hero-coloured (gold when Cued) column of light (Brann's in his brass).
    if (hero.soloActive > 0) {
      const c = hero.soloCued ? C.amp : own;
      kit.rings.push(x, 0.04, z, rec.radius * 1.7, 0.1, 0.35, RING.dashed, c, 0.85, 0, 7, 0, 8);
      rec.sparkleAcc += dt * 14 * kit.particles.density;
      while (rec.sparkleAcc > 1) {
        rec.sparkleAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        kit.particles.emit(
          x + Math.cos(a) * rec.radius,
          0.2,
          z + Math.sin(a) * rec.radius,
          0,
          2.4,
          0,
          0.7,
          0.14,
          c,
          0.9,
          PARTICLE.spark,
          0.4,
        );
      }
    }
    // Their life over their heads is the overlay's (partyBars.ts, docs/health-ui.md).
    void state;
  }

  /**
   * The per-aura rim arcs (docs/phase-3/vfx.md), for a hero or a summon (docs/phase-5e.md, Q1):
   * one lit arc per aura in `mask` round its feet, how it hears each shown in the arc. Shared, so
   * a covered Sapling reads exactly as a hero does.
   */
  private auraRims(
    kit: FxKit,
    x: number,
    z: number,
    radius: number,
    mask: number,
    beamFocus: boolean,
  ): void {
    const list = this.auraColors(mask);
    const n = list.length;
    const gap = n > 1 ? 0.32 : 0;
    const seg = (Math.PI * 2) / n;
    const spin = this.now * 0.6;
    const auras = CONTENT.auras.length;
    for (let b = 0, j = 0; b < auras && j < n; b++) {
      const bit = 1 << b;
      if ((mask & bit) === 0) continue;
      const c = list[j]!;
      const start = spin + j * seg + gap * 0.5;
      j++;
      const hear = auraHearing(bit, this.beamMask, beamFocus, this.beamFullEcho);
      if (hear === 'fullEcho') {
        // The echo at full strength (Spindle of Fate): a field song's weight, still dashed.
        kit.rings.push(
          x,
          0.032,
          z,
          radius * 1.78,
          0.11,
          0.16,
          RING.dashed,
          c,
          0.95,
          start,
          seg - gap,
          0,
          12,
        );
      } else if (hear === 'echo') {
        kit.rings.push(
          x,
          0.032,
          z,
          radius * 1.78,
          0.06,
          0.06,
          RING.dashed,
          c,
          0.6,
          start,
          seg - gap,
          0,
          22,
        );
      } else if (hear === 'focus') {
        kit.rings.push(x, 0.032, z, radius * 1.78, 0.17, 0.28, RING.plain, c, 1, start, seg - gap);
        kit.rings.push(
          x,
          0.033,
          z,
          radius * 2.08,
          0.045,
          0.1,
          RING.plain,
          c,
          0.75,
          start + 0.08,
          seg - gap - 0.16,
        );
      } else {
        kit.rings.push(
          x,
          0.032,
          z,
          radius * 1.78,
          0.11,
          0.16,
          RING.plain,
          c,
          0.95,
          start,
          seg - gap,
        );
      }
    }
  }

  // ── Seren and Oro (docs/phase-5e.md, Presentation) ────────────────────────────────────

  /**
   * Seren: her ring notched in four (her violet), the crossed blades over her while she stands
   * en garde, the dashed duel tether to her quarry and the duel crown over it, the red notch
   * pulse while overextended, and the faint 14 m reach arc round the Weaver while she is more
   * than 10 m from her.
   */
  private duel(rec: EntityRec, e: ReadonlyEntity, state: WorldState, kit: FxKit): void {
    const h = e.health!;
    if (h.dead || h.downed) return;
    const x = rec.x;
    const z = rec.z;
    const d5 = this.drawn5e;
    // The notches: four short arcs just outside her ring.
    for (let i = 0; i < 4; i++)
      kit.rings.push(
        x,
        0.031,
        z,
        rec.radius * 1.62,
        0.07,
        0.1,
        RING.plain,
        SEREN_VIOLET,
        0.6,
        i * (Math.PI / 2) + Math.PI / 4 - 0.14,
        0.28,
      );
    d5.notched++;
    if (enGarde(e)) {
      // En garde: two blades crossed over her head (a shape, never the Ward's cyan or silver).
      const y = rec.y + rec.height + 0.5 + 0.05 * Math.sin(this.now * 3);
      kit.spritesTop.push(x, y, z, 0.42, SPRITE.needle, SEREN_FLASH, 0.95, 0.75);
      kit.spritesTop.push(x, y, z, 0.42, SPRITE.needle, SEREN_FLASH, 0.95, -0.75);
      kit.sprites.push(x, y, z, 0.6, SPRITE.glow, SEREN_VIOLET, 0.35);
      d5.enGarde++;
    }
    const q = quarryOf(state, e);
    const qr = q ? this.recs.get(q.id) : undefined;
    if (q && qr) {
      const ay = rec.y + rec.height * 0.55;
      kit.beams.push(
        x,
        ay,
        z,
        qr.x,
        qr.height * 0.55,
        qr.z,
        0.08,
        BEAM.dashed,
        SEREN_VIOLET,
        0.75,
        1,
        1,
        -1.4,
      );
      d5.tethers++;
      // The duel crown: three violet points turning over its head.
      const cy = qr.height + 0.55 + (qr.tier === 'elite' ? 0.35 : 0);
      for (let i = 0; i < 3; i++) {
        const a = this.now * 1.4 + (i * Math.PI * 2) / 3;
        kit.spritesTop.push(
          qr.x + Math.cos(a) * 0.32,
          cy,
          qr.z + Math.sin(a) * 0.32,
          0.16,
          SPRITE.diamond,
          SEREN_VIOLET,
          0.95,
        );
      }
      d5.crowns++;
    }
    if (overextendedLook(state, e)) {
      // Overextended: a red notch pulse at her feet (Reel or Rally her).
      const p = 0.5 + 0.5 * Math.sin(this.now * 8);
      for (let i = 0; i < 4; i++)
        kit.rings.push(
          x,
          0.034,
          z,
          rec.radius * (1.9 + 0.25 * p),
          0.1,
          0.18,
          RING.plain,
          C.lethal,
          0.55 + 0.4 * p,
          i * (Math.PI / 2) + Math.PI / 4 - 0.2,
          0.4,
        );
      d5.overextended++;
    }
    if (reachArcShows(state, e)) {
      // The Weaver's reach for her: a faint arc of it round the Weaver, on her side.
      const w = this.recs.get(this.weaverId);
      if (w) {
        const ang = Math.atan2(z - w.z, x - w.x);
        kit.rings.push(
          w.x,
          0.03,
          w.z,
          weaverReach(),
          0.06,
          0.12,
          RING.dashed,
          SEREN_VIOLET,
          0.35,
          ang - 0.5,
          1,
          0,
          14,
        );
        d5.reachArcs++;
      }
    }
  }

  /**
   * Oro: a dashed moss root tether to each of his summons (Rootbond's motes run along it,
   * groveCues.ts), and the closed leaf over him while he tends (Gentle).
   */
  private grove(rec: EntityRec, e: ReadonlyEntity, state: WorldState, kit: FxKit): void {
    const h = e.health!;
    if (h.dead) return;
    const grove = e.hero!.grove!;
    const d5 = this.drawn5e;
    const ids = grove.ancient === null ? grove.saplings : [...grove.saplings, grove.ancient];
    for (const id of ids) {
      const s = state.entities.get(id);
      const sr = this.recs.get(id);
      if (!s?.summon || !sr || s.health?.dead) continue;
      kit.beams.push(
        rec.x,
        0.12,
        rec.z,
        sr.x,
        0.12,
        sr.z,
        0.06,
        BEAM.dashed,
        GROVE_MOSS,
        h.downed ? 0.25 : 0.55,
        1,
        1,
        0.6,
      );
      d5.rootTethers++;
    }
    if (tending(state, e)) {
      const y = rec.y + rec.height + 0.45 + 0.04 * Math.sin(this.now * 2);
      kit.spritesTop.push(rec.x, y, rec.z, 0.26, SPRITE.drop, GROVE_MOSS, 0.95, 0, 1, 0);
      kit.sprites.push(rec.x, y, rec.z, 0.4, SPRITE.glow, GROVE_SEED, 0.25);
      d5.tending++;
    }
  }

  /**
   * One of Oro's summons: its ring in his moss, its aura rims as a hero's (Q1: lit while it
   * stands in your field, the same arcs greyed outside it), the burrow trail after a Rally, the
   * Ancient's ground warning as it rises and its taunt ring while it stands, and the tended
   * sparkle while Oro tends.
   */
  private summonExtras(
    rec: EntityRec,
    e: ReadonlyEntity,
    state: WorldState,
    kit: FxKit,
    dt: number,
  ): void {
    const h = e.health;
    const s = e.summon!;
    if (!h || h.dead) return;
    const d5 = this.drawn5e;
    this.summonIds.push(e.id);
    const x = rec.x;
    const z = rec.z;
    if (s.kind === 'ancient') d5.ancients++;
    else d5.saplings++;
    kit.rings.push(x, 0.03, z, rec.radius * 1.45, 0.06, 0.1, RING.plain, GROVE_MOSS, 0.4);
    const cov = summonCoverage(e);
    if (cov.mask !== 0) {
      if (cov.inField) {
        this.auraRims(kit, x, z, rec.radius, cov.mask, false);
        d5.summonRims++;
      } else {
        // Outside your field: the same arcs, greyed.
        const n = this.auraColors(cov.mask).length;
        const seg = (Math.PI * 2) / n;
        const gap = n > 1 ? 0.32 : 0;
        for (let j = 0; j < n; j++)
          kit.rings.push(
            x,
            0.032,
            z,
            rec.radius * 1.78,
            0.08,
            0.12,
            RING.plain,
            GROVE_OUT,
            0.6,
            j * seg + gap * 0.5,
            seg - gap,
          );
        d5.greyRims++;
      }
    } else if (!cov.inField) {
      // Out of your songs entirely: a grey broken rim (the leaf mark is on its bar).
      kit.rings.push(
        x,
        0.032,
        z,
        rec.radius * 1.78,
        0.06,
        0.1,
        RING.dashed,
        GROVE_OUT,
        0.55,
        0,
        7,
        0,
        8,
      );
      d5.greyRims++;
    }
    if (choirSings(state, e)) {
      // Verdant Choir (Q3): the reach of its pulse, a ring of leaves in Sostenuto's green.
      kit.rings.push(
        x,
        0.035,
        z,
        CHOIR_RADIUS,
        0.16,
        0.12,
        RING.leaf,
        GROVE_CHOIR,
        0.5 + 0.08 * Math.sin(this.now * 2.2 + e.id),
        0,
        7,
        0,
        14,
        e.id * 0.7,
      );
      d5.choirRings++;
    }
    if (s.kind === 'sapling' && burrowing(state, e)) {
      // The burrow trail: earth churned up from where it sank toward where it re-plants.
      rec.smokeAcc += dt * 16 * kit.particles.density;
      while (rec.smokeAcc > 1) {
        rec.smokeAcc -= 1;
        const k = Math.random();
        kit.smoke.emit(
          x + (s.plantX - x) * k,
          0.1,
          z + (s.plantZ - z) * k,
          0,
          0.3,
          0,
          0.7,
          0.35,
          GROVE_BARK,
          0.45,
          PARTICLE.smoke,
          1.2,
          0,
          0.5,
        );
      }
      kit.rings.push(
        s.plantX,
        0.03,
        s.plantZ,
        rec.radius * 1.4,
        0.06,
        0.14,
        RING.dashed,
        GROVE_MOSS,
        0.7,
        0,
        7,
        0,
        6,
        this.now,
      );
      d5.burrows++;
    }
    if (s.kind === 'ancient') {
      const owner = ownerOf(state, e);
      // The ground warning before it rises: a ring of seed light closing in on its rise time
      // (`burrowUntil`, the sim's explicit rise), whatever its stand's length (World Tree).
      const k = ancientRising(state, e);
      if (k >= 0) {
        kit.rings.push(
          x,
          0.035,
          z,
          rec.radius * (3.4 - 2 * k),
          0.12,
          0.22,
          RING.plain,
          GROVE_SEED,
          0.55 + 0.4 * k,
        );
        d5.warnings++;
      } else {
        // Risen: its taunt ring stands while it does.
        kit.rings.push(
          x,
          0.03,
          z,
          ancientTauntRadius(owner),
          0.07,
          0.14,
          RING.dashed,
          GROVE_MOSS,
          0.5,
          0,
          7,
          0.03,
          28,
          this.now * 0.3,
        );
        d5.tauntRings++;
      }
    } else if (tending(state, ownerOf(state, e))) {
      // Tended (+50%): a slow sparkle of seed light over it.
      const a = this.now * 2 + rec.id;
      kit.sprites.push(
        x + Math.cos(a) * 0.3,
        rec.height + 0.15,
        z + Math.sin(a) * 0.3,
        0.12,
        SPRITE.diamond,
        GROVE_SEED,
        0.8,
      );
    }
  }

  /**
   * Seren: crossed blades over her for every blow she can parry aimed at her (a parryable cone
   * whose target is her). Only while she is in the party.
   */
  private parryGlyphs(state: WorldState, kit: FxKit): void {
    if (!duelHero(state)) return;
    for (const t of state.telegraphs) {
      if (!parryGlyph(state, t)) continue;
      const r = this.recs.get(t.target!);
      if (!r) continue;
      const y = r.y + r.height + 0.95;
      kit.spritesTop.push(r.x, y, r.z, 0.34, SPRITE.needle, SEREN_VIOLET, 0.95, 0.75);
      kit.spritesTop.push(r.x, y, r.z, 0.34, SPRITE.needle, SEREN_VIOLET, 0.95, -0.75);
      this.drawn5e.parryGlyphs++;
    }
  }

  /** Oro's root on an enemy: vines up its legs (the stake's look, in his moss) and a ring. */
  private vines(rec: EntityRec, kit: FxKit): void {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 + rec.id;
      kit.sprites.push(
        rec.x + Math.cos(a) * rec.radius * 0.6,
        rec.height * 0.25 + rec.y,
        rec.z + Math.sin(a) * rec.radius * 0.6,
        0.42,
        SPRITE.stake,
        GROVE_VINE,
        0.9,
        Math.PI,
      );
    }
    kit.rings.push(
      rec.x,
      0.035,
      rec.z,
      rec.radius * 1.5,
      0.1,
      0.18,
      RING.dashed,
      GROVE_VINE,
      0.85,
      0,
      7,
      0,
      9,
    );
    this.drawn5e.vines++;
  }

  /**
   * Seren's afterimage where she was (Thousand Cuts' blinks, Feint's step): her own model, a
   * violet ghost fading (gold-edged in a Cued Thousand Cuts).
   */
  afterimage(id: EntityId, x: number, z: number, cued: boolean): void {
    const r = this.recs.get(id);
    if (!r || r.kind !== 'hero') return;
    const g = this.freeGhost();
    if (!g) return;
    g.active = true;
    g.save = false;
    g.chrono = 3;
    g.batch = r.batch;
    g.hero = id;
    g.x = x;
    g.z = z;
    g.yaw = r.yaw;
    g.age = 0;
    g.life = 0.4;
    g.side = cued ? 2 : 1;
    g.radius = r.radius;
  }

  /**
   * Brann (docs/phase-5b.md): Blood Rage as an ember glow in his chest that grows with the life
   * he is missing (the shared `bloodRageBonus`, so it shows the bonus the sim applies), embers
   * rising off him; Red Frenzy's crimson swipe ring that follows him (gold-edged when Cued);
   * Bloodletting's empowered swings left as pips along his axe.
   */
  private blood(rec: EntityRec, e: ReadonlyEntity, kit: FxKit, dt: number): void {
    const hero = e.hero!;
    const b = hero.blood!;
    const x = rec.x;
    const z = rec.z;
    const y = rec.y;
    const def = CONTENT.heroes.find((d) => d.id === hero.defId);
    const cap = Math.max(1e-3, (def && bloodRageOf(def)?.maxBonus) ?? 1);
    const rage = clamp01(bloodRageBonus(CONTENT, e) / cap);
    if (rage > 0.02) {
      const flick = 0.85 + 0.15 * Math.sin(this.now * 11 + rec.id);
      kit.sprites.push(
        x,
        rec.height * 0.6 + y,
        z,
        rec.radius * (1.2 + 1.6 * rage),
        SPRITE.glow,
        EMBER,
        (0.12 + 0.4 * rage) * flick,
      );
      rec.sparkleAcc += dt * (2 + 10 * rage) * kit.particles.density;
      while (rec.sparkleAcc > 1) {
        rec.sparkleAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        kit.particles.emit(
          x + Math.cos(a) * rec.radius * 0.7,
          rec.height * (0.3 + Math.random() * 0.5) + y,
          z + Math.sin(a) * rec.radius * 0.7,
          (Math.random() - 0.5) * 0.4,
          0.9 + Math.random() * 0.8,
          (Math.random() - 0.5) * 0.4,
          0.6,
          0.07,
          EMBER,
          0.9,
          PARTICLE.spark,
          0.3,
        );
      }
      this.drawn5b.rage++;
    }
    // Red Frenzy: a crimson swipe ring turning with him, edged gold when you Cued it.
    if (hero.soloActive > 0 && hero.soloId === 'redFrenzy') {
      const R = def?.solo.radius ?? 3.5;
      const turn = (this.now * FRENZY_SPIN) % (Math.PI * 2);
      for (let i = 0; i < 3; i++)
        kit.rings.push(
          x,
          0.06,
          z,
          R * 0.9,
          0.22,
          0.4,
          RING.swipe,
          FRENZY,
          0.75,
          turn + (i * Math.PI * 2) / 3,
          1.4,
        );
      this.drawn5b.frenzy++;
      if (hero.soloCued) {
        kit.rings.push(x, 0.065, z, R, 0.06, 0.16, RING.plain, C.amp, 0.85);
        this.drawn5b.frenzyGold++;
      }
    }
    // Bloodletting: a pip per empowered swing left, along his axe (his right, low).
    if (b.bloodlet > 0) {
      const n = Math.min(3, Math.ceil(b.bloodlet));
      const fx = -Math.sin(rec.yaw);
      const fz = -Math.cos(rec.yaw);
      // His right hand: forward × up.
      const rx = -fz;
      const rz = fx;
      for (let i = 0; i < n; i++) {
        const k = 0.45 + i * 0.22;
        kit.sprites.push(
          x + rx * rec.radius * 0.75 + fx * 0.3,
          rec.height * k + y,
          z + rz * rec.radius * 0.75 + fz * 0.3,
          0.14,
          SPRITE.drop,
          EMBER,
          0.95,
          0,
          1,
          0.8,
        );
      }
      this.drawn5b.bloodlet += n;
    }
  }

  private enemyExtras(
    rec: EntityRec,
    e: ReadonlyEntity,
    state: WorldState,
    frame: FrameInfo,
    kit: FxKit,
    clock: number,
  ): void {
    const h = e.health;
    const enemy = e.enemy!;
    const x = rec.x;
    const z = rec.z;
    if (e.id === state.focusTarget) {
      kit.rings.push(
        x,
        0.04,
        z,
        rec.radius * 1.6 + 0.2,
        0.09,
        0.2,
        RING.reticle,
        C.amp,
        1,
        0,
        7,
        0.06,
        0,
        this.now,
      );
      kit.spritesTop.push(
        x,
        rec.height + 0.75 + Math.sin(this.now * 4) * 0.08,
        z,
        0.22,
        SPRITE.diamond,
        C.amp,
        1,
      );
    } else if (e.id === frame.hoveredEnemy) {
      kit.rings.push(
        x,
        0.04,
        z,
        rec.radius * 1.5 + 0.15,
        0.06,
        0.1,
        RING.dashed,
        C.white,
        0.75,
        0,
        7,
        0,
        10,
      );
    }
    // Hexed (Lullaby…): a drowsy swirl over the head in the hex's colour, a dashed ring below.
    // Phase 3: a beam-song hex on an enemy attacking the threaded hero (`beamFocus`) hits at
    // focus strength, so it shows heavier: bigger triple swirl, a solid glowing foot ring.
    if (enemy.auraMask !== 0 && !h?.dead && enemy.state !== 'dying') {
      const list = this.auraColors(enemy.auraMask);
      const big = Math.max(1, rec.radius * 1.1);
      const top = rec.height + 0.22 + rec.y;
      const auras = CONTENT.auras.length;
      for (let b = 0, i = 0; b < auras && i < list.length; b++) {
        const bit = 1 << b;
        if ((enemy.auraMask & bit) === 0) continue;
        const c = list[i]!;
        const strong = enemy.beamFocus && (bit & this.beamMask) !== 0;
        const k = strong ? 1.35 : 1;
        const spin = this.now * (strong ? 3 : 2.2) + rec.id * 0.7 + i * 1.3;
        const ty = top + i * 0.14 * k;
        kit.rings.push(
          x,
          ty,
          z,
          0.34 * big * k,
          0.06 * k,
          0.12,
          RING.swipe,
          c,
          strong ? 1 : 0.85,
          spin,
          2.4,
        );
        kit.rings.push(
          x,
          ty + 0.07,
          z,
          0.2 * big * k,
          0.05,
          0.08,
          RING.swipe,
          c,
          0.7,
          spin + Math.PI,
          2.0,
        );
        if (strong) {
          kit.rings.push(x, ty + 0.16, z, 0.48 * big, 0.05, 0.14, RING.swipe, c, 0.8, -spin, 2.2);
          // The hex presses down: a ring dropping from over the head to the feet, again and again.
          const ph = (this.now * 1.3 + rec.id * 0.37) % 1;
          kit.rings.push(
            x,
            (ty + 0.3) * (1 - ph) + 0.05,
            z,
            rec.radius * (1.6 - 0.5 * ph) + 0.1,
            0.06,
            0.16,
            RING.plain,
            c,
            0.9 * Math.sin(Math.PI * ph),
          );
          kit.rings.push(x, 0.03, z, rec.radius * 1.35 + 0.1, 0.09, 0.22, RING.plain, c, 0.85);
          kit.rings.push(
            x,
            0.031,
            z,
            rec.radius * 1.75 + 0.15,
            0.05,
            0.1,
            RING.dashed,
            c,
            0.7,
            0,
            7,
            0,
            10,
            this.now * 0.9,
          );
        } else {
          kit.rings.push(
            x,
            0.03,
            z,
            rec.radius * 1.35 + 0.1,
            0.04,
            0.1,
            RING.dashed,
            c,
            0.45,
            0,
            7,
            0,
            8,
            -this.now * 0.4,
          );
        }
        i++;
      }
    }
    // Controller (Mute) dome of cracked glass.
    if (rec.suppressRadius > 0 && !h?.dead) {
      const R = rec.suppressRadius;
      kit.shells.push(
        x,
        0,
        z,
        R,
        R * 0.45,
        R,
        SHELL.muteDome,
        MUTE_GLASS,
        0.32,
        1,
        0,
        true,
        rec.id * 0.37,
      );
      kit.rings.push(x, 0.03, z, R, 0.07, 0.2, RING.dashed, MUTE_GLASS, 0.55, 0, 7, 0.04, 40);
    }
    // The Crimson Sentinel's guard (Movement II): a brass arc at its feet facing the *sim's*
    // guard direction, the sector it blocks faintly filled; cracked while broken, with a flash.
    const guard = enemy.guard;
    if (guard && rec.guardHalf > 0 && !h?.dead) {
      const broken = guardBrokenAt(guard, state.time);
      if (broken && !rec.guardWasBroken) rec.guardFlash = 1;
      rec.guardWasBroken = broken;
      const arc = guardArc(guard, rec.guardHalf, this.arc);
      const R = rec.radius * 1.9 + 0.35;
      kit.rings.push(
        x,
        0.034,
        z,
        R,
        0.16,
        0.22,
        RING.guard,
        GUARD,
        broken ? 0.4 : 0.9,
        arc.start,
        arc.len,
        broken ? 0 : 0.14,
        broken ? 1 : 0,
      );
      this.drawnM2.guardArcs++;
      if (broken) this.drawnM2.guardBroken++;
      if (rec.guardFlash > 0.01) {
        const f = rec.guardFlash;
        kit.rings.push(x, 0.05, z, R * (1 + 0.5 * (1 - f)), 0.12, 0.3, RING.plain, C.white, f);
        kit.sprites.push(x, rec.height * 0.5, z, rec.radius * 2.4 * f + 0.4, SPRITE.glow, GUARD, f);
        rec.guardFlash = Math.max(0, rec.guardFlash - this.frameDt * 2.5);
      }
    }
    // Caster/support: their focus glows brighter while casting.
    if (enemy.cast) {
      kit.sprites.push(
        x,
        rec.height * 0.75,
        z,
        rec.radius * 1.2,
        SPRITE.glow,
        rec.accent,
        (0.35 + 0.2 * Math.sin(clock * 12)) * (1 - 0.6 * rec.frost),
      );
    }
    if (!h) return;
    // Restless Dead: ash drifting up off a risen enemy (a few motes a second, by quality).
    if (rec.risen > 0 && rec.rising === 0 && !h.dead) {
      rec.smokeAcc += kit.smoke.density * 3 * this.frameDt;
      while (rec.smokeAcc > 1) {
        rec.smokeAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        const rr = rec.radius * (0.3 + Math.random() * 0.6);
        kit.smoke.emit(
          x + Math.cos(a) * rr,
          rec.height * (0.35 + Math.random() * 0.55) + rec.y,
          z + Math.sin(a) * rr,
          (Math.random() - 0.5) * 0.15,
          0.42 + Math.random() * 0.25,
          (Math.random() - 0.5) * 0.15,
          1.3,
          0.11,
          ASH,
          0.85,
          PARTICLE.dot,
          0.4,
          0,
          0.05,
        );
      }
    }
    const showBar =
      h.hp < h.maxHp - 0.5 ||
      enemy.cast !== null ||
      e.id === frame.hoveredEnemy ||
      e.id === state.focusTarget ||
      rec.tier !== 'normal';
    if (showBar) {
      const width =
        rec.role === 'boss'
          ? 104
          : rec.role === 'miniboss'
            ? 84
            : rec.tier === 'elite'
              ? 46
              : rec.role === 'swarm'
                ? 26
                : 36;
      let shield = 0;
      for (const s of h.shields) shield += s.amount;
      const cast = enemy.cast
        ? clamp01(
            (state.time - enemy.cast.start) / Math.max(0.01, enemy.cast.end - enemy.cast.start),
          )
        : -1;
      const flags =
        (rec.tier === 'elite' ? 1 : 0) +
        (rec.role === 'boss' || rec.role === 'miniboss' ? 2 : 0) +
        (enemy.cast?.interruptible ? 4 : 0);
      const top = rec.height + (rec.tier === 'elite' ? 0.65 : 0.4);
      // Restless Dead: a risen enemy's life comes back in ash, filling as it stands back up
      // (`riseOut` is this enemy's pose: updateRec worked it out just before calling this).
      const fill = enemy.risen && enemy.state === 'spawning' ? this.riseOut.fill : 1;
      kit.bars.push(
        x,
        top,
        z,
        width,
        (h.hp / h.maxHp) * fill,
        Math.min(1, shield / h.maxHp),
        cast,
        rec.flash,
        rec.risen > 0 ? ASH : ENEMY_BAR,
        flags,
      );
      // Seren and Oro (docs/phase-5e.md): the heavy pip at the bar's left on a heavy foe (the
      // Hollow Champion): never executed by a kill shot, never held by a summon.
      if (this.rosterHeavy && heavyPip(state, e, true)) {
        kit.spritesTop.push(x, top + 0.2, z, 0.2, SPRITE.seal, C.white, 0.9);
        this.drawn5e.heavyPips++;
      }
    }
    // Oro's root (docs/phase-5e.md): its immunity key exists only once a root has landed.
    if (enemy.rootImmuneUntil !== undefined && !h?.dead && rootedLook(e)) this.vines(rec, kit);
  }

  private weaverExtras(rec: EntityRec, e: ReadonlyEntity, kit: FxKit, dt: number): void {
    const w = e.weaver!;
    const x = rec.x;
    const z = rec.z;
    kit.rings.push(x, 0.03, z, rec.radius * 1.5, 0.07, 0.2, RING.plain, C.gold, 0.6);
    // Resonance: orbiting white-gold segments (one per full segment, the content's 25 of 100).
    const look = this.dis;
    const seg = look.segment > 0 ? look.segment : 25;
    const stars = Math.max(1, Math.round(look.max / seg));
    const step = (Math.PI * 2) / stars;
    const full = Math.floor(w.resonance / seg);
    const partial = (w.resonance % seg) / seg;
    const r = 0.85;
    for (let i = 0; i < stars; i++) {
      const a = this.now * 1.6 + i * step;
      const lit = i < full ? 1 : i === full ? partial * 0.6 : 0.08;
      kit.sprites.push(
        x + Math.cos(a) * r,
        1.25 + Math.sin(this.now * 2 + i) * 0.08,
        z + Math.sin(a) * r,
        i < full ? 0.2 : 0.13,
        i < full ? SPRITE.star : SPRITE.glow,
        C.resonance,
        lit,
      );
    }
    // Silent Cues (Dissonance): a Cue costs more than a segment, so a gold tick on the orbit marks
    // where each Cue's cost falls (lit once it is paid for). At the content's cost there is none.
    const n = cueTicks(look, this.ticks);
    for (let k = 0; k < n; k++) {
      const at = this.ticks[k]!;
      // A star's segment is full at its own place: `at` segments sits `at - 1` steps on from the first.
      const a = this.now * 1.6 + (at - 1) * step;
      const paid = w.resonance + 1e-9 >= at * seg;
      kit.sprites.push(
        x + Math.cos(a) * r,
        1.12,
        z + Math.sin(a) * r,
        paid ? 0.15 : 0.1,
        SPRITE.diamond,
        C.amp,
        paid ? 1 : 0.4,
      );
    }
    this.drawnDis.cueTicks = n;
    // Ribbons: sample the hand's path and trail three flowing ribbons behind.
    this.histTimer += dt;
    const fx = -Math.sin(rec.yaw);
    const fz = -Math.cos(rec.yaw);
    const ax = x - fx * 0.18;
    const az = z - fz * 0.18;
    const hx = this.hist[0];
    const hz = this.hist[2];
    const moved = Math.hypot(ax - hx, az - hz);
    if (this.histCount === 0 || moved > 0.08 || this.histTimer > 1 / 30) {
      this.histTimer = 0;
      this.hist.copyWithin(3, 0, (HIST - 1) * 3);
      this.hist[0] = ax;
      this.hist[1] = rec.y;
      this.hist[2] = az;
      this.histCount = Math.min(HIST, this.histCount + 1);
    }
    // They are the Thread's origin: in its look's filament (the middle one) and glow, if worn.
    weaverRibbons(
      kit,
      this.hist,
      this.histCount,
      rec.yaw,
      this.now,
      this.ribbonInner,
      this.ribbonOuter,
    );
  }

  private shields(rec: EntityRec, e: ReadonlyEntity, state: WorldState, kit: FxKit): void {
    const h = e.health!;
    if (h.dead || h.shields.length === 0) return;
    const x = rec.x;
    const z = rec.z;
    const time = state.time;
    for (const s of h.shields) {
      // A Ward's `appliedAt` waits with the enemies during Stasis (Perfect timing is in their
      // time), so its pop is timed from when render first saw it: a Ward cast in Stasis pops
      // and settles like any other. Every other shield keeps its own clock.
      let age = time - s.appliedAt;
      if (s.kind === 'ward') {
        if (rec.wardRef !== s) {
          rec.wardRef = s;
          rec.wardSeen = Math.min(time, s.appliedAt);
        }
        age = time - rec.wardSeen;
      }
      const pop = age < 0.3 ? 1 - age / 0.3 : 0;
      const left = s.expiresAt - time;
      const fade = left < 0.6 ? clamp01(left / 0.6) : 1;
      const crack = s.max > 0 ? clamp01(1 - s.amount / s.max) : 0;
      const sc = 1 + pop * 0.3;
      const r = rec.radius;
      const hh = rec.height;
      switch (s.kind) {
        case 'ward':
          kit.shells.push(
            x,
            hh * 0.5 + rec.y,
            z,
            r * 1.6 * sc,
            hh * 0.62 * sc,
            r * 1.6 * sc,
            // A Chorale's barrier on a hero you didn't Ward (`plain`, docs/phase-4f.md) only
            // absorbs: it has a barrier's plain shell, not the Ward's hexes (never Perfect).
            s.plain ? SHELL.barrier : SHELL.ward,
            C.shield,
            (s.plain ? 0.85 : 0.95) * fade,
            crack,
            pop,
            false,
            rec.id,
          );
          break;
        case 'dome':
          kit.shells.push(
            x,
            0,
            z,
            r * 2.1 * sc,
            r * 2.4 * sc,
            r * 2.1 * sc,
            SHELL.dome,
            C.dome,
            0.8 * fade,
            crack,
            pop,
            true,
            rec.id,
          );
          break;
        case 'barrier':
          kit.shells.push(
            x,
            hh * 0.5 + rec.y,
            z,
            r * 1.35,
            hh * 0.56,
            r * 1.35,
            SHELL.barrier,
            C.shield,
            0.7 * fade,
            crack,
            pop * 0.3,
            false,
            rec.id,
          );
          break;
        case 'overshield':
          // Overflowing Grace's shield has its own look (AstrolabeView draws it).
          if (s === rec.graceRef || graceMarked(s)) break;
          kit.shells.push(
            x,
            hh * 0.5 + rec.y,
            z,
            r * 1.5 * sc,
            hh * 0.6 * sc,
            r * 1.5 * sc,
            SHELL.overshield,
            C.amp,
            0.6 * fade,
            crack,
            pop * 0.5,
            false,
            rec.id,
          );
          break;
        case 'discord':
          kit.shells.push(
            x,
            hh * 0.5 + rec.y,
            z,
            r * 1.55,
            hh * 0.62,
            r * 1.55,
            SHELL.discord,
            C.discord,
            0.85 * fade,
            crack,
            pop,
            false,
            rec.id,
          );
          break;
        case 'mirror':
          // A Ward copied onto an enemy (Movement III): the Ward's hexes inside out, in mirror
          // silver, never Ward's pale cyan: it is not yours.
          kit.shells.push(
            x,
            hh * 0.5 + rec.y,
            z,
            r * 1.65 * sc,
            hh * 0.64 * sc,
            r * 1.65 * sc,
            SHELL.mirrorWard,
            MIRROR,
            0.95 * fade,
            crack,
            pop,
            false,
            rec.id,
          );
          this.drawnM3.mirrorShells++;
          break;
      }
    }
  }

  /**
   * The Legion's statuses on a hero or the Weaver (docs/phase-5a/vfx-audio.md): bleed's violet
   * pips over the head (glowing from 5, where Chime answers) and its drips, Wound's cracked
   * heart, a latch's violet tether to its Leech, a pin's steel stake and amber ring.
   */
  private crimson(rec: EntityRec, e: ReadonlyEntity, kit: FxKit, dt: number): void {
    const look = this.m2Look;
    if (!crimsonStatuses(e, look)) return;
    const x = rec.x;
    const z = rec.z;
    const top = rec.height + rec.y;
    if (look.bleed > 0) {
      const n = Math.min(look.bleed, MAX_PIPS);
      const hot = look.bleed >= BLEED_CHIME_AT;
      const pulse = hot ? 0.75 + 0.25 * Math.sin(this.now * 8) : 0;
      this.tmpColor.copy(C.ailment);
      if (hot) this.tmpColor.lerp(C.white, 0.3 * pulse);
      for (let i = 0; i < n; i++) {
        pipOffset(i, n, this.pip);
        kit.sprites.push(
          x + this.pip.x,
          top + PIP_LIFT + this.pip.y,
          z,
          hot ? 0.15 : 0.12,
          SPRITE.drop,
          this.tmpColor,
          hot ? 1 : 0.85,
          0,
          1,
          hot ? pulse : 0,
        );
      }
      this.drawnM2.pips += n;
      if (hot) {
        kit.sprites.push(
          x,
          top + PIP_LIFT,
          z,
          0.25 + 0.12 * n,
          SPRITE.glow,
          C.ailment,
          0.3 * pulse,
        );
        this.drawnM2.pipsHot++;
      }
      // Drips: more stacks, more drops falling off them.
      rec.sparkleAcc += dt * (1.5 + look.bleed) * kit.particles.density;
      while (rec.sparkleAcc > 1) {
        rec.sparkleAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = rec.radius * 0.6;
        kit.particles.emit(
          x + Math.cos(a) * r,
          rec.height * (0.4 + Math.random() * 0.4) + rec.y,
          z + Math.sin(a) * r,
          0,
          -0.6,
          0,
          0.7,
          0.09,
          C.ailment,
          0.9,
          PARTICLE.dot,
          0.5,
          -4,
        );
      }
    }
    if (look.wound) {
      const bob = Math.sin(this.now * 3) * 0.04;
      kit.sprites.push(
        x - rec.radius - 0.2,
        top + WOUND_LIFT + bob,
        z,
        WOUND_SIZE,
        SPRITE.wound,
        C.ailment,
        0.95,
      );
      this.drawnM2.wounds++;
    }
    if (look.latchedBy >= 0) {
      const src = this.recs.get(look.latchedBy);
      if (src && src.dying < 0) {
        const ay = src.height * 0.5 + src.y;
        const by = rec.height * 0.5 + rec.y;
        kit.beams.push(src.x, ay, src.z, x, by, z, 0.12, BEAM.dashed, C.ailment, 0.9, 1, 1, -2.2);
        kit.beams.push(src.x, ay, src.z, x, by, z, 0.4, BEAM.glow, C.ailment, 0.35);
        this.drawnM2.tethers++;
      }
    }
    if (look.pinned) {
      kit.sprites.push(
        x + rec.radius * 0.7,
        rec.height * 0.55 + rec.y,
        z,
        0.55,
        SPRITE.stake,
        STAKE,
        0.95,
      );
      kit.rings.push(x, 0.035, z, rec.radius * 1.6, 0.1, 0.18, RING.plain, PIN, 0.9);
      kit.rings.push(x, 0.036, z, rec.radius * 2.0, 0.05, 0.08, RING.dashed, PIN, 0.6, 0, 7, 0, 8);
      this.drawnM2.stakes++;
    }
  }

  /**
   * Movement III on one entity (docs/phase-5c/vfx-audio.md). A possessed hero: a cracked mask
   * over the head, a dashed indigo tether from its Wraith, a lash streaking toward the ally it
   * strikes. Doom: five pips on the bleed arc filling as it stacks, lethal from four. Doomed: a
   * lethal glow. Stitched: a cross-stitched ring at the feet (the pair's sewn tether is drawn
   * once, in `riftScene`). In a pull: drag streaks toward its centre. The Weaver in a rune: a rune
   * lock over her head. An enemy: Emboldened's mirror shimmer, the Spindles' plating, and it is
   * collected for the scene (Spindles, champions). Every read is absent before Movement III.
   */
  private rift(rec: EntityRec, e: ReadonlyEntity, state: WorldState, kit: FxKit, dt: number): void {
    const x = rec.x;
    const z = rec.z;
    const top = rec.height + rec.y;
    const enemy = e.enemy;
    if (enemy) {
      if (isTetherDef(rec.defId)) this.tetherRecs.push(rec);
      else if (rec.defId === CHAMPION_ID) this.championRecs.push(rec);
      if (rec.role === 'boss') this.champHub = rec;
      if (enemy.tethered !== undefined && enemy.tethered > 0) {
        // The Spindles' plating: the boss takes far less while they stand.
        this.hub = rec;
        kit.shells.push(
          x,
          rec.height * 0.5 + rec.y,
          z,
          rec.radius * 1.5,
          rec.height * 0.6,
          rec.radius * 1.5,
          SHELL.mirrorWard,
          SPINDLE,
          0.75,
          0,
          0,
          false,
          rec.id,
        );
        this.drawnM3.plating++;
      }
      if (enemy.emboldenedUntil !== undefined && emboldenedAt(e, state.time)) {
        for (let i = 0; i < 3; i++) {
          const a = this.now * 2.2 + (i * Math.PI * 2) / 3;
          kit.sprites.push(
            x + Math.cos(a) * rec.radius * 1.1,
            rec.height * (0.4 + 0.25 * Math.sin(a * 1.3)) + rec.y,
            z + Math.sin(a) * rec.radius * 1.1,
            0.16,
            SPRITE.mirror,
            MIRROR,
            0.75,
          );
        }
        this.drawnM3.emboldened++;
      }
      return;
    }
    // A pull (the Void Maw's Inhale) drags whoever stands in it: streaks toward its centre.
    const zones = state.field.zones;
    if (zones) {
      const zi = inPull(zones, x, z);
      if (zi >= 0 && !e.health?.downed) {
        const zn = zones[zi]!;
        const dx = zn.x - x;
        const dz = zn.z - z;
        const d = Math.hypot(dx, dz) || 1;
        rec.dragAcc += dt * 14 * kit.particles.density;
        while (rec.dragAcc > 1) {
          rec.dragAcc -= 1;
          const side = (Math.random() - 0.5) * rec.radius * 1.6;
          kit.particles.emit(
            x - (dz / d) * side,
            0.2 + Math.random() * rec.height * 0.7,
            z + (dx / d) * side,
            (dx / d) * 3.2,
            0,
            (dz / d) * 3.2,
            0.35,
            0.09,
            SWIRL,
            0.85,
            PARTICLE.spark,
            0.4,
            0,
          );
        }
        this.drawnM3.drag++;
      }
      if (e.kind === 'weaver' && weaverSilenced(state)) {
        // Silenced in a rune: a rune lock over her head (Ward, Chime and Reel are refused).
        kit.spritesTop.push(
          x,
          top + 0.75 + 0.05 * Math.sin(this.now * 3),
          z,
          0.3,
          SPRITE.rune,
          RUNE,
          0.95,
        );
        this.drawnM3.runeLock++;
      }
    }
    const h = e.health!;
    if (h.statuses.length === 0) return;
    const look = this.m3Look;
    if (!riftStatuses(e, look)) return;
    if (look.possessed) {
      kit.sprites.push(
        x + rec.radius + 0.2,
        top + PIP_LIFT + 0.2 + Math.sin(this.now * 2.6) * 0.04,
        z,
        0.28,
        SPRITE.mask,
        POSSESS,
        0.95,
      );
      this.drawnM3.masks++;
      const src = look.possessedBy >= 0 ? this.recs.get(look.possessedBy) : undefined;
      if (src && src.dying < 0) {
        const ay = src.height * 0.6 + src.y;
        const by = rec.height * 0.6 + rec.y;
        kit.beams.push(src.x, ay, src.z, x, by, z, 0.12, BEAM.dashed, POSSESS, 0.9, 1, 1, -2.4);
        kit.beams.push(src.x, ay, src.z, x, by, z, 0.4, BEAM.glow, POSSESS, 0.3);
        this.drawnM3.possessTethers++;
      }
      // The lash toward the ally it strikes (the sim's own victim rule), every tick.
      const victim = possessionVictim(state, e);
      const vr = victim === null ? undefined : this.recs.get(victim);
      if (vr) {
        if (this.now - rec.streakAt >= LASH_EVERY) rec.streakAt = this.now;
        const t = clamp01((this.now - rec.streakAt) / 0.25);
        if (t < 1) {
          this.tmpColor.copy(POSSESS).lerp(C.white, 0.35);
          kit.beams.push(
            x,
            rec.height * 0.55 + rec.y,
            z,
            vr.x,
            vr.height * 0.55 + vr.y,
            vr.z,
            0.22,
            BEAM.lance,
            this.tmpColor,
            0.9 * (1 - t * 0.5),
            t,
            0.4,
          );
          this.drawnM3.streaks++;
        }
      }
    }
    if (look.doom > 0) {
      const n = Math.min(look.doom, DOOM_AT);
      const hot = look.doom >= DOOM_CHIME_AT;
      const pulse = hot ? 0.7 + 0.3 * Math.sin(this.now * 9) : 0;
      this.tmpColor.copy(hot ? C.lethal : C.ailment);
      for (let i = 0; i < DOOM_AT; i++) {
        doomPipOffset(i, this.pip);
        kit.sprites.push(
          x + this.pip.x,
          top + PIP_LIFT + DOOM_PIP_LIFT + this.pip.y,
          z,
          hot ? 0.14 : 0.12,
          SPRITE.doomPip,
          this.tmpColor,
          i < n ? 1 : 0.55,
          0,
          1,
          i < n ? 1 : 0,
        );
      }
      this.drawnM3.doomPips += n;
      if (hot) {
        kit.sprites.push(
          x,
          top + PIP_LIFT + DOOM_PIP_LIFT,
          z,
          0.6,
          SPRITE.glow,
          C.lethal,
          0.3 * pulse,
        );
        this.drawnM3.doomHot++;
      }
    }
    if (look.doomed) {
      const pulse = 0.6 + 0.4 * Math.sin(this.now * 12);
      kit.sprites.push(
        x,
        rec.height * 0.55 + rec.y,
        z,
        rec.radius * 2.6,
        SPRITE.glow,
        C.lethal,
        0.3 * pulse,
      );
      this.drawnM3.doomed++;
    }
    if (look.stitched) {
      kit.rings.push(
        x,
        0.036,
        z,
        rec.radius * 1.7,
        0.09,
        0.16,
        RING.dashed,
        STITCH,
        0.85,
        0,
        7,
        0,
        10,
      );
      this.drawnM3.rooted++;
    }
  }

  /**
   * Movement III across entities, once a frame: the sewn tether between a stitched pair (the
   * heroes stitched by the same source), the Spindles' tethers to the boss they shield, and the
   * mirror Thread from the Unweaver to its Hollow Champion.
   */
  private riftScene(state: WorldState, kit: FxKit): void {
    const n = stitchedPairs(state, this.pairs);
    for (let i = 0; i < n; i++) {
      const a = this.recs.get(this.pairs[i * 2]!);
      const b = this.recs.get(this.pairs[i * 2 + 1]!);
      if (!a || !b) continue;
      const ay = a.height * 0.45 + a.y;
      const by = b.height * 0.45 + b.y;
      kit.beams.push(a.x, ay, a.z, b.x, by, b.z, 0.34, BEAM.stitch, STITCH, 0.95, 1, 1, 0.4);
      kit.beams.push(a.x, ay, a.z, b.x, by, b.z, 0.7, BEAM.glow, STITCH, 0.22);
      this.drawnM3.sewn++;
    }
    const hub = this.hub;
    if (hub) {
      for (const s of this.tetherRecs) {
        if (s.dying >= 0) continue;
        const sy = s.height * 0.85 + s.y;
        const hy = hub.height * 0.6 + hub.y;
        kit.beams.push(s.x, sy, s.z, hub.x, hy, hub.z, 0.14, BEAM.dashed, SPINDLE, 0.85, 1, 1, 1.6);
        kit.beams.push(s.x, sy, s.z, hub.x, hy, hub.z, 0.45, BEAM.glow, SPINDLE, 0.25);
        this.drawnM3.spindleTethers++;
      }
    }
    const boss = this.champHub;
    if (boss && boss.dying < 0) {
      for (const c of this.championRecs) {
        if (c.dying >= 0) continue;
        const by = boss.height * 0.7 + boss.y;
        const cy = c.height * 0.6 + c.y;
        kit.beams.push(boss.x, by, boss.z, c.x, cy, c.z, 0.16, BEAM.lance, MIRROR, 0.75);
        kit.beams.push(boss.x, by, boss.z, c.x, cy, c.z, 0.6, BEAM.glow, MIRROR, 0.3);
        this.drawnM3.championBeams++;
      }
    }
  }

  private ailments(rec: EntityRec, e: ReadonlyEntity, kit: FxKit, dt: number): void {
    const h = e.health!;
    if (h.dead || h.statuses.length === 0) return;
    let ailing = false;
    let stunned = false;
    let immune = false;
    for (const s of h.statuses) {
      if (AILMENTS.has(s.id)) ailing = true;
      if (s.id === 'stun' || s.id === 'stagger') stunned = true;
      if (s.id === 'immune') immune = true;
    }
    const x = rec.x;
    const z = rec.z;
    if (ailing && rec.kind !== 'enemy') {
      // Violet dripping smoke.
      rec.smokeAcc += dt * 16 * kit.smoke.density;
      while (rec.smokeAcc > 1) {
        rec.smokeAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = rec.radius * 0.7 * Math.random();
        kit.smoke.emit(
          x + Math.cos(a) * r,
          rec.height * (0.5 + Math.random() * 0.5) + rec.y,
          z + Math.sin(a) * r,
          0,
          -0.35,
          0,
          1.1,
          0.35,
          C.ailment,
          0.55,
          PARTICLE.smoke,
          0.8,
          0.15,
          0.25,
        );
      }
    }
    if (stunned) {
      for (let i = 0; i < 3; i++) {
        const a = this.now * 5 + (i * Math.PI * 2) / 3;
        kit.sprites.push(
          x + Math.cos(a) * rec.radius * 0.8,
          rec.height + 0.15 + rec.y,
          z + Math.sin(a) * rec.radius * 0.8,
          0.14,
          SPRITE.star,
          C.goldHot,
          0.9,
        );
      }
    }
    if (immune) {
      this.tmpColor.copy(C.white).lerp(C.ailment, 0.3);
      kit.rings.push(
        x,
        rec.height * 0.5 + rec.y,
        z,
        rec.radius * 1.2,
        0.03,
        0.08,
        RING.dashed,
        this.tmpColor,
        0.5,
        0,
        7,
        0,
        6,
      );
    }
  }

  private updateGhosts(kit: FxKit, dt: number): void {
    for (const g of this.ghosts) {
      if (!g.active || !g.batch) continue;
      g.age += dt;
      if (g.age < 0) continue;
      const t = g.age / g.life;
      if (t >= 1) {
        g.active = false;
        continue;
      }
      if (g.save) {
        this.updateSaveGhost(g, t, kit);
        continue;
      }
      if (g.chrono === 1) {
        // Rewind's afterimage: left behind along the streak, a silver ghost dissolving upward.
        const m = this.compose(g.x, t * 0.12, g.z, g.yaw, 0, 0, 1);
        g.batch.push(m, 0.5 * (1 - t), 0.25 + t * 0.75, 0.9, 0.7, CHRONO_SILVER, 1.1, 0, 0, 1);
        continue;
      }
      if (g.chrono === 2) {
        this.updateUnfall(g, t, kit);
        continue;
      }
      if (g.chrono === 3) {
        // Seren's afterimage: violet, gold-edged when Cued, dissolving where she was.
        const m = this.compose(g.x, 0, g.z, g.yaw, -0.2, 0, 1);
        const edge = g.side === 2 ? C.amp : SEREN_VIOLET;
        g.batch.push(m, 0.6 * (1 - t), 0.2 + t * 0.8, 0.6, 0.6, edge, 1.3);
        this.drawn5e.afterimages++;
        continue;
      }
      this.e.set(-0.35, g.yaw, 0, 'YXZ');
      this.q.setFromEuler(this.e);
      this.p.set(g.x, 0, g.z);
      this.s.set(1, 1, 1);
      this.m.compose(this.p, this.q, this.s);
      g.batch.push(this.m, 0.7 * (1 - t), 0.15 + t * 0.85, 0, 0.55, C.gold, 1.2);
    }
  }

  /**
   * Rewind standing a downed hero up: their fall played backwards. The body lies where it fell,
   * lifts (0–0.45) while running back to where they stood, and dissolves into the hero there.
   */
  private updateUnfall(g: Ghost, t: number, kit: FxKit): void {
    const rise = clamp01(t / 0.7);
    const up = rise * rise * (3 - 2 * rise);
    const run = clamp01((t - 0.08) / 0.62);
    const mv = run * run * (3 - 2 * run);
    const x = g.x + (g.x2 - g.x) * mv;
    const z = g.z + (g.z2 - g.z) * mv;
    const pitch = (Math.PI / 2 - 0.12) * (1 - up);
    const roll = g.side * 0.22 * (1 - up);
    const y = g.radius * 0.35 * (1 - up);
    const m = this.compose(x, y, z, g.yaw, pitch, roll, 1);
    const dissolve = 0.1 + clamp01((t - 0.65) / 0.35) * 0.9;
    g.batch!.push(m, 0.4 * (1 - t), dissolve, 0.85, 0.55, CHRONO_SILVER, 1.4, 0, 0, 1);
    kit.sprites.push(
      x,
      0.5 + up * 0.5,
      z,
      g.radius * 2.4,
      SPRITE.glow,
      CHRONO_SILVER,
      0.4 * (1 - t),
    );
  }

  /** The ghost buckles (0–0.2), topples onto its back (0.2–0.6) and dissolves in gold. */
  private updateSaveGhost(g: Ghost, t: number, kit: FxKit): void {
    const buckle = clamp01(t / 0.2);
    const fallT = clamp01((t - 0.12) / 0.48);
    const fall = fallT * fallT * (3 - 2 * fallT);
    // Knees buckle forward, then it topples onto its back (positive pitch), a little sideways.
    const pitch = fall * (Math.PI / 2 - 0.12) - buckle * 0.2 * (1 - fall);
    const roll = g.side * fall * 0.22;
    const fx = -Math.sin(g.yaw);
    const fz = -Math.cos(g.yaw);
    const slide = fall * 0.35;
    const y =
      -buckle * 0.12 * (1 - fall) + fall * g.radius * 0.35 - clamp01((t - 0.6) / 0.4) * 0.15;
    const m = this.compose(g.x - fx * slide, y, g.z - fz * slide, g.yaw, pitch, roll, 1 + t * 0.04);
    const dissolve = 0.04 + clamp01((t - 0.5) / 0.5) * 0.96;
    const flash = t < 0.15 ? (1 - t / 0.15) * 0.8 : 0;
    g.batch!.push(m, flash, dissolve, 0.7, 0.4, C.gold, 0.7 + (1 - t) * 0.7);
    // A pale glow lingers on the body as it goes down.
    const bx = g.x - fx * slide * 1.8;
    const bz = g.z - fz * slide * 1.8;
    kit.sprites.push(
      bx,
      0.5 + (1 - fall) * 0.5,
      bz,
      g.radius * 2.6,
      SPRITE.glow,
      GHOST_ASH,
      0.45 * (1 - t),
    );
    // Its shadow fades with it; an ashen ring marks where it would have lain.
    kit.shadows.push(
      g.x,
      0.016,
      g.z,
      g.radius * 1.4,
      0,
      0,
      RING.soft,
      BLACK,
      0.4 * (1 - t),
      0,
      7,
      1,
    );
    kit.rings.push(
      g.x - fx * slide * 2,
      0.03,
      g.z - fz * slide * 2,
      g.radius * (1.2 + fall * 0.9),
      0.05,
      0.18,
      RING.plain,
      GHOST_ASH,
      0.55 * fall * (1 - t),
    );
  }

  dispose(): void {
    for (const b of this.batches.values()) b.dispose();
    this.batches.clear();
    this.crown.dispose();
    this.recs.clear();
    this.group.removeFromParent();
  }
}
