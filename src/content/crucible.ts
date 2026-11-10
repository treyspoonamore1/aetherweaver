import {
  ALTO,
  BASS,
  BASSO_OSTINATO,
  CADENZA,
  CONDUCTOR,
  CRUCIBLE_ARENA,
  CUE,
  DOWNBEAT,
  FINAL_CADENCE,
  FINALE_MOVEMENT,
  FORTISSIMO,
  GRAND_SILENCE,
  HALF_CADENCE,
  LAMENT,
  MEASURE,
  NOTES_NEEDED,
  RAISE,
  REST,
  SFORZANDO,
  SHATTER_ARIA,
  SOPRANO,
  TENOR,
} from './crucibleIds';
import type { ContentInput } from './schema';

/**
 * The Finale: the Silent Conductor and its mirror-choir (docs/phase-5d.md). Code life is the
 * doc's base; the Finale's scale (life ×1.85, damage ×1.05, `crucibleRun.ts`) and an elite's
 * ×2.2 are applied by the sim, so they are not folded in here. Every id is a constant in
 * `crucibleIds.ts`, every number a named constant below (a 0 means 'none'), and every Codex and
 * Decree line is built from the numbers it describes. Everything here carries `movement: 4`.
 */

const BASE = {
  radius: 0,
  angleDeg: 0,
  length: 0,
  width: 0,
  innerRadius: 0,
  interruptible: false,
} as const;

/** A fraction as a whole percentage, for text. */
const pct = (x: number): number => Math.round(x * 100);

// ── Rules the sim shares (the Conductor's script reads these, docs/phase-5d.md) ──────

/** The ring the choir is Raised on, around the Conductor (m). */
export const CHOIR_RING = 6;
/** A Raised voice's ground warning: it stands this long after its `spawnWarning` (s). */
export const RAISE_WARNING = 1;
/** How many voices may stand at once: in the Overture, then in the Mirror Choir. */
export const CHOIR_CAP = { overture: 2, choir: 3 } as const;
/** The Cue's cadence (s): in the Overture, in the Mirror Choir, and enraged. */
export const CUE_EVERY = { overture: 12, choir: 11, enraged: 7 } as const;
/** A Cue whose Solo can't begin is tried again this long after (s). */
export const CUE_RETRY = 2;
/** At most this many damaging telegraphs live before a Cue waits (and in the silence). */
export const LIVE_CAP = 2;
/** Discord's passive rise (a second) in the Overture and in the Mirror Choir. */
export const DISCORD_RATE = { overture: 0.3, choir: 1 } as const;
/** The last burn's scripted Downbeat and Sforzando cadences (s), after Reignite or the Coda. */
export const BURN_EVERY = { downbeat: 9, sforzando: 12 } as const;
/**
 * The Grand Silence's program, scheduled from impacts (s): the Measure begins this long before
 * the Rest lands, the Cadence this long after the Measure lands, the next cycle this long after
 * the Cadence lands.
 */
export const SILENCE_STEPS = { measureLead: 0.5, cadenceLag: 0.5, nextCycle: 2 } as const;
/** Each note fills this much of every stilled hero's Solo (eight fill it). */
export const SOLO_PER_NOTE = 100 / NOTES_NEEDED;

// ── The numbers the text names ───────────────────────────────────────────────────────

/** The Conductor's Downbeat: a cleave on the tank. */
const DOWNBEAT_WINDUP = 1.6;
const DOWNBEAT_DAMAGE = 600;
const DOWNBEAT_REACH = 4;
const DOWNBEAT_ARC = 90;
/** Sforzando: a beam at the farthest hero. */
const SFORZANDO_WINDUP = 1.8;
const SFORZANDO_DAMAGE = 320;
const SFORZANDO_LINE = 22;
const SFORZANDO_WIDTH = 1.4;
/** Discord a failed Conductor attack adds, and a failed Solo. */
const DISCORD_BOSS = 5;
const DISCORD_SOLO = 25;
/** Fortissimo Silence: three raid pulses of this share of each hero's life. */
const FORTISSIMO_PCT = 0.4;
const FORTISSIMO_FIRST = 3;
const FORTISSIMO_NEXT = 1.5;
/** The Grand Silence's program. */
const REST_WINDUP = 3.5;
const REST_PCT = 0.5;
const MEASURE_WINDUP = 2;
const MEASURE_PCT = 0.7;
const MEASURE_RADIUS = 2.5;
const CADENCE_WINDUP = 2.5;
const FINAL_CADENCE_PCT = 1.15;
const HALF_CADENCE_PCT = 0.6;
const CADENCE_RADIUS = 2.5;
/** The voices' Solos. */
const SOLO_WINDUP = 2.5;
const LAMENT_PCT = 0.5;
const BASSO_DAMAGE = 1000;
const BASSO_RADIUS = 2.5;
const CADENZA_PCT = 1;
const CADENZA_LINE = 24;
const CADENZA_WIDTH = 1.6;
/**
 * An elite's share of life is ×1.1 (the sim's `beginAttack`, enemies.ts), and every voice is
 * Raised an elite, so a Solo's share is told as it lands (the doc's voice table: 55% and 110%).
 * Exported for the test that pins it to the sim's telegraph.
 */
export const VOICE_PCT_MULT = 1.1;
const ARIA_DAMAGE = 480;
const ARIA_RADIUS = 4.5;
/** Shatter Aria feeds Discord only when it catches this many unanswered heroes. */
const ARIA_QUORUM = 2;

// ── Cadences and shapes the text doesn't name ────────────────────────────────────────
// Each attack's cooldown (`_EVERY`) and first use (`_FROM`, s into the fight). A scripted
// attack's cooldown is its script's cadence (0: none, it is cast on a condition).

/** The Crucible's radius (m). */
const CRUCIBLE_RADIUS = 22;
/**
 * Reach that spans the Crucible: its diameter, so every scripted attack begins wherever its
 * caster and target stand. Wall to wall they are 44 - r1 - r2 apart and `inRange` reaches
 * range + r1 + r2, so 40 falls short whenever the two radii sum under 2 m (a voice and a hero).
 */
const ARENA_REACH = 2 * CRUCIBLE_RADIUS;
/** A Decree is announced on its attack's first this many casts (AttackDef.decreeLimit). */
const DECREE_CASTS = 2;
const DOWNBEAT_EVERY = 9;
const DOWNBEAT_FROM = 5;
const SFORZANDO_EVERY = 12;
const SFORZANDO_FROM = 9;
const CUE_WINDUP = 1.2;
/**
 * Principle 3: every Finale telegraph lasts at least this long (s), whatever shortens it. Short
 * Fuse's Dissonance windup multiplier (×0.8 at rank 2) would otherwise take the Cue to 0.96 s.
 */
export const FINALE_MIN_WINDUP = 1;
const CUE_FROM = 8;
const RAISE_WINDUP = 1.5;
const RAISE_EVERY = 25;
const RAISE_FROM = 3;
const GRAND_SILENCE_WINDUP = 2;
/** One Rest → Measure → Cadence cycle at default assists; each Cadence comes every other. */
const SILENCE_CYCLE = 10;
const CADENCE_EVERY = 20;

// ── Decrees, in the Conductor's voice ────────────────────────────────────────────────

/** The phase Decrees (the PHASES row announces them; the script again on a phase's first Cue). */
export const CONDUCTOR_DECREES = {
  overture:
    'The Overture — the Conductor Cues its choir. Interrupt the soloist, or answer its Solo. Every blow you leave unanswered feeds its Discord.',
  mirrorChoir:
    'Mirror Choir — every voice of your party, sung back at you. Discord swells: hold your Crescendo before it fills.',
  grandSilence:
    'Grand Silence — the music stops and your heroes freeze. Only your Perfect Wards, Clutch Chimes and Reel-saves are heard. Eight notes rebuild the song.',
  /** The Grand Silence's Decree for a Chronomancer, whose Reel slot casts Rewind (question 8). */
  grandSilenceRewind:
    'Grand Silence — the music stops and your heroes freeze. Only your Perfect Wards, Clutch Chimes and Rewinds that undo a blow are heard. Eight notes rebuild the song.',
  /** The phase banners' second lines. */
  mirrorChoirLine: 'Hear how they strain.',
  grandSilenceLine: 'Hush.',
} as const;

const FORTISSIMO_TOTAL = pct(FORTISSIMO_PCT * FORTISSIMO.length);
const FORTISSIMO_SPAN = FORTISSIMO_NEXT * (FORTISSIMO.length - 1);

/** Each Solo's Decree, naming its target (the script builds it as the Solo begins). */
export function soloDecree(solo: string, hero?: string): string {
  const who = hero ?? 'a hero';
  switch (solo) {
    case LAMENT:
      return `Lament — the Alto’s Solo marks ${who}. Chime it away (in its last second, a Clutch), or interrupt the Alto.`;
    case BASSO_OSTINATO:
      return `Basso Ostinato — the Bass’s Solo on ${who}. Ward on the beat, or interrupt it.`;
    case CADENZA:
      return `Cadenza — the Tenor’s Solo cuts a line to ${who}: more than their life. Reel them out, step aside, or interrupt it.`;
    case SHATTER_ARIA:
      return `Shatter Aria — the Soprano’s Solo shatters a crowd around ${who}. Scatter so it catches one, or interrupt it.`;
    default:
      return `${solo} — a Solo on ${who}.`;
  }
}

/**
 * Each body: code life, speed (m/s), radius and height (m), the range it keeps from its target
 * (m, 0 = closes in) and its basic attack (damage, seconds between hits, reach in m).
 */
const BODIES = {
  the_silent_conductor: {
    hp: 40000,
    speed: 2.2,
    radius: 1.5,
    height: 4.8,
    keep: 0,
    basic: { kind: 'melee', damage: 110, interval: 1.6, range: 3 },
  },
  mirror_alto: {
    hp: 1200,
    speed: 3.2,
    radius: 0.55,
    height: 2.2,
    keep: 9,
    basic: { kind: 'bolt', damage: 45, interval: 1.8, range: 10 },
  },
  mirror_bass: {
    hp: 1800,
    speed: 3.2,
    radius: 0.65,
    height: 2.4,
    keep: 0,
    basic: { kind: 'melee', damage: 90, interval: 1.8, range: 2 },
  },
  mirror_tenor: {
    hp: 1200,
    speed: 3.2,
    radius: 0.6,
    height: 2.3,
    keep: 0,
    basic: { kind: 'melee', damage: 90, interval: 1.8, range: 2 },
  },
  mirror_soprano: {
    hp: 1200,
    speed: 3.2,
    radius: 0.5,
    height: 2.1,
    keep: 9,
    basic: { kind: 'bolt', damage: 45, interval: 1.8, range: 10 },
  },
} as const;

/** A body's life, speed and size, in the order an EnemyDef lists them. */
function body(id: keyof typeof BODIES) {
  const b = BODIES[id];
  return { hp: b.hp, speed: b.speed, radius: b.radius, height: b.height };
}

/** The Conductor's attacks, its scripted casts, the Grand Silence's program and the Solos. */
export const CRUCIBLE_ATTACKS: ContentInput['attacks'] = [
  // ── The Conductor: on the picker in phases 1-2, begun by the script in the last burn ──
  {
    ...BASE,
    id: DOWNBEAT,
    name: 'Downbeat',
    kind: 'cleave',
    effect: 'damage',
    windup: DOWNBEAT_WINDUP,
    cooldown: DOWNBEAT_EVERY,
    initialDelay: DOWNBEAT_FROM,
    damage: DOWNBEAT_DAMAGE,
    radius: DOWNBEAT_REACH,
    angleDeg: DOWNBEAT_ARC,
    range: DOWNBEAT_REACH,
    targeting: 'current',
    answers: ['ward', 'dome'],
    decreeLimit: DECREE_CASTS,
    decree: 'Downbeat — the baton falls on the tank. Ward them, or raise Kael’s dome.',
    decreeNoDome: 'Downbeat — the baton falls on the tank. Ward them on the beat.',
    discord: DISCORD_BOSS,
  },
  {
    ...BASE,
    id: SFORZANDO,
    name: 'Sforzando',
    kind: 'beam',
    effect: 'damage',
    windup: SFORZANDO_WINDUP,
    cooldown: SFORZANDO_EVERY,
    initialDelay: SFORZANDO_FROM,
    damage: SFORZANDO_DAMAGE,
    length: SFORZANDO_LINE,
    width: SFORZANDO_WIDTH,
    range: ARENA_REACH,
    targeting: 'farthest',
    answers: ['move', 'reel'],
    discord: DISCORD_BOSS,
  },
  // ── Its scripted casts ───────────────────────────────────────────────────────────────
  {
    ...BASE,
    id: CUE,
    name: 'Cue',
    kind: 'burst',
    effect: 'script',
    windup: CUE_WINDUP,
    cooldown: CUE_EVERY.overture,
    initialDelay: CUE_FROM,
    damage: 0,
    range: ARENA_REACH,
    targeting: 'self',
    answers: ['focus'],
    scripted: true,
  },
  {
    ...BASE,
    id: RAISE,
    name: 'Raise the Choir',
    kind: 'burst',
    effect: 'script',
    windup: RAISE_WINDUP,
    cooldown: RAISE_EVERY,
    initialDelay: RAISE_FROM,
    damage: 0,
    range: ARENA_REACH,
    targeting: 'self',
    answers: ['focus'],
    scripted: true,
  },
  {
    ...BASE,
    id: FORTISSIMO[0],
    name: 'Fortissimo Silence',
    kind: 'raid',
    effect: 'damage',
    windup: FORTISSIMO_FIRST,
    cooldown: 0,
    initialDelay: 0,
    damage: 0,
    pctMaxHp: FORTISSIMO_PCT,
    range: ARENA_REACH,
    targeting: 'allHeroes',
    answers: ['crescendo', 'dome', 'ward'],
    followUp: { attack: FORTISSIMO[1], delay: 0 },
    scripted: true,
    decree: `Fortissimo Silence — every hero loses ${FORTISSIMO_TOTAL}% of their life over ${FORTISSIMO_SPAN} s. Crescendo to cancel it, or dome, Ward and heal.`,
    decreeNoDome: `Fortissimo Silence — ${FORTISSIMO_TOTAL}% of every hero’s life over ${FORTISSIMO_SPAN} s. No dome: keep 100 Resonance and cancel it with your Crescendo; Ward the one you can’t lose.`,
  },
  {
    ...BASE,
    id: FORTISSIMO[1],
    name: 'Fortissimo Silence',
    kind: 'raid',
    effect: 'damage',
    windup: FORTISSIMO_NEXT,
    cooldown: 0,
    initialDelay: 0,
    damage: 0,
    pctMaxHp: FORTISSIMO_PCT,
    range: ARENA_REACH,
    targeting: 'allHeroes',
    answers: ['crescendo', 'dome', 'ward'],
    followUp: { attack: FORTISSIMO[2], delay: 0 },
    scripted: true,
  },
  {
    ...BASE,
    id: FORTISSIMO[2],
    name: 'Fortissimo Silence',
    kind: 'raid',
    effect: 'damage',
    windup: FORTISSIMO_NEXT,
    cooldown: 0,
    initialDelay: 0,
    damage: 0,
    pctMaxHp: FORTISSIMO_PCT,
    range: ARENA_REACH,
    targeting: 'allHeroes',
    answers: ['crescendo', 'dome', 'ward'],
    scripted: true,
  },
  {
    ...BASE,
    id: GRAND_SILENCE,
    name: 'Grand Silence',
    kind: 'burst',
    effect: 'script',
    windup: GRAND_SILENCE_WINDUP,
    cooldown: 0,
    initialDelay: 0,
    damage: 0,
    range: ARENA_REACH,
    targeting: 'self',
    answers: ['ward', 'chime', 'reel'],
    scripted: true,
  },
  // ── The Grand Silence's program: aimed, so a Reel pulls a frozen hero out; no Discord ──
  {
    ...BASE,
    id: REST,
    name: 'Rest',
    kind: 'mark',
    effect: 'damage',
    windup: REST_WINDUP,
    cooldown: SILENCE_CYCLE,
    initialDelay: 0,
    damage: 0,
    pctMaxHp: REST_PCT,
    range: ARENA_REACH,
    targeting: 'randomNonTank',
    answers: ['chime', 'ward'],
    scripted: true,
    discord: 0,
  },
  {
    ...BASE,
    id: MEASURE,
    name: 'Measure',
    kind: 'burst',
    effect: 'damage',
    windup: MEASURE_WINDUP,
    cooldown: SILENCE_CYCLE,
    initialDelay: 0,
    damage: 0,
    pctMaxHp: MEASURE_PCT,
    radius: MEASURE_RADIUS,
    range: ARENA_REACH,
    targeting: 'current',
    answers: ['ward'],
    centre: 'target',
    scripted: true,
    discord: 0,
  },
  {
    ...BASE,
    id: FINAL_CADENCE,
    name: 'Final Cadence',
    kind: 'burst',
    effect: 'damage',
    windup: CADENCE_WINDUP,
    cooldown: CADENCE_EVERY,
    initialDelay: 0,
    damage: 0,
    pctMaxHp: FINAL_CADENCE_PCT,
    radius: CADENCE_RADIUS,
    range: ARENA_REACH,
    targeting: 'lowestHp',
    answers: ['reel', 'ward'],
    centre: 'target',
    scripted: true,
    discord: 0,
  },
  {
    ...BASE,
    id: HALF_CADENCE,
    name: 'Half Cadence',
    kind: 'burst',
    effect: 'damage',
    windup: CADENCE_WINDUP,
    cooldown: CADENCE_EVERY,
    initialDelay: 0,
    damage: 0,
    pctMaxHp: HALF_CADENCE_PCT,
    radius: CADENCE_RADIUS,
    range: ARENA_REACH,
    targeting: 'lowestHp',
    answers: ['ward', 'reel'],
    centre: 'target',
    scripted: true,
    discord: 0,
  },
  // ── The mirror-choir's Solos: begun by a Cue, each one verb ──────────────────────────
  {
    ...BASE,
    id: LAMENT,
    name: 'Lament',
    kind: 'mark',
    effect: 'damage',
    windup: SOLO_WINDUP,
    cooldown: CUE_EVERY.overture,
    initialDelay: 0,
    damage: 0,
    pctMaxHp: LAMENT_PCT,
    range: ARENA_REACH,
    targeting: 'randomNonTank',
    answers: ['chime', 'ward', 'focus'],
    interruptible: true,
    scripted: true,
    decreeLimit: DECREE_CASTS,
    decree: soloDecree(LAMENT),
    discord: DISCORD_SOLO,
  },
  {
    ...BASE,
    id: BASSO_OSTINATO,
    name: 'Basso Ostinato',
    kind: 'burst',
    effect: 'damage',
    windup: SOLO_WINDUP,
    cooldown: CUE_EVERY.overture,
    initialDelay: 0,
    damage: BASSO_DAMAGE,
    radius: BASSO_RADIUS,
    range: ARENA_REACH,
    targeting: 'current',
    answers: ['ward', 'dome', 'focus'],
    interruptible: true,
    centre: 'target',
    scripted: true,
    decreeLimit: DECREE_CASTS,
    decree: soloDecree(BASSO_OSTINATO),
    discord: DISCORD_SOLO,
  },
  {
    ...BASE,
    id: CADENZA,
    name: 'Cadenza',
    kind: 'beam',
    effect: 'damage',
    windup: SOLO_WINDUP,
    cooldown: CUE_EVERY.overture,
    initialDelay: 0,
    damage: 0,
    pctMaxHp: CADENZA_PCT,
    length: CADENZA_LINE,
    width: CADENZA_WIDTH,
    range: ARENA_REACH,
    targeting: 'farthest',
    answers: ['reel', 'move', 'focus'],
    interruptible: true,
    scripted: true,
    decreeLimit: DECREE_CASTS,
    decree: soloDecree(CADENZA),
    discord: DISCORD_SOLO,
  },
  {
    ...BASE,
    id: SHATTER_ARIA,
    name: 'Shatter Aria',
    kind: 'burst',
    effect: 'damage',
    windup: SOLO_WINDUP,
    cooldown: CUE_EVERY.overture,
    initialDelay: 0,
    damage: ARIA_DAMAGE,
    radius: ARIA_RADIUS,
    range: ARENA_REACH,
    targeting: 'current',
    answers: ['scatter', 'move', 'ward', 'focus'],
    interruptible: true,
    centre: 'target',
    scripted: true,
    decreeLimit: DECREE_CASTS,
    decree: soloDecree(SHATTER_ARIA),
    discord: DISCORD_SOLO,
    discordQuorum: ARIA_QUORUM,
  },
];

/** Ash-grey ribbons on a night robe; faceted glass for the choir, a tint stripe a voice. */
const ASH_ROBE = '#2e2a3a';
const ASH = '#9aa0aa';
const GLASS = '#aab6c8';

/** The Silent Conductor and its four glass voices. */
export const CRUCIBLE_ENEMIES: ContentInput['enemies'] = [
  // ── The mirror-choir (boss adds, Raised by the Conductor's script) ───────────────────
  {
    id: ALTO,
    name: 'Mirror Alto',
    role: 'caster',
    ...body(ALTO),
    color: GLASS,
    accent: '#34d399',
    basic: { ...BODIES.mirror_alto.basic },
    preferredRange: BODIES.mirror_alto.keep,
    specials: [LAMENT],
    suppressRadius: 0,
    codex: `A glass chorister singing Lyra’s line back, inverted. Cued, its Lament marks a hero for ${SOLO_WINDUP} s, then takes ${pct(LAMENT_PCT * VOICE_PCT_MULT)}% of their life. Chime the mark away (in its last second, a Clutch), Ward it, or interrupt the Alto.`,
    material: 'glass',
    movement: FINALE_MOVEMENT,
  },
  {
    id: BASS,
    name: 'Mirror Bass',
    role: 'brute',
    ...body(BASS),
    color: GLASS,
    accent: '#b91c1c',
    basic: { ...BODIES.mirror_bass.basic },
    preferredRange: BODIES.mirror_bass.keep,
    specials: [BASSO_OSTINATO],
    suppressRadius: 0,
    codex: `A glass chorister singing Brann’s line back, inverted. Cued, its Basso Ostinato rings a ${BASSO_RADIUS} m circle on its target for ${BASSO_DAMAGE} after ${SOLO_WINDUP} s. Ward on the beat, raise the dome, or interrupt the Bass.`,
    material: 'glass',
    movement: FINALE_MOVEMENT,
  },
  {
    id: TENOR,
    name: 'Mirror Tenor',
    role: 'brute',
    ...body(TENOR),
    color: GLASS,
    accent: '#5b8def',
    basic: { ...BODIES.mirror_tenor.basic },
    preferredRange: BODIES.mirror_tenor.keep,
    specials: [CADENZA],
    suppressRadius: 0,
    codex: `A glass chorister singing Kael’s line back, inverted. Cued, its Cadenza cuts a ${CADENZA_LINE} m line to the farthest hero for ${pct(CADENZA_PCT * VOICE_PCT_MULT)}% of their life. Reel them out, step aside, or interrupt the Tenor.`,
    material: 'glass',
    movement: FINALE_MOVEMENT,
  },
  {
    id: SOPRANO,
    name: 'Mirror Soprano',
    role: 'caster',
    ...body(SOPRANO),
    color: GLASS,
    accent: '#a78bfa',
    basic: { ...BODIES.mirror_soprano.basic },
    preferredRange: BODIES.mirror_soprano.keep,
    specials: [SHATTER_ARIA],
    suppressRadius: 0,
    codex: `A glass chorister singing Vexis’s line back, inverted. Cued, its Shatter Aria shatters a ${ARIA_RADIUS} m circle around its target for ${ARIA_DAMAGE} each. Scatter so it catches one, or interrupt the Soprano.`,
    material: 'glass',
    movement: FINALE_MOVEMENT,
  },
  // ── The boss ─────────────────────────────────────────────────────────────────────────
  {
    id: CONDUCTOR,
    name: 'The Silent Conductor',
    role: 'boss',
    ...body(CONDUCTOR),
    color: ASH_ROBE,
    accent: ASH,
    basic: { ...BODIES.the_silent_conductor.basic },
    preferredRange: BODIES.the_silent_conductor.keep,
    specials: [
      DOWNBEAT,
      SFORZANDO,
      CUE,
      RAISE,
      ...FORTISSIMO,
      GRAND_SILENCE,
      REST,
      MEASURE,
      FINAL_CADENCE,
      HALF_CADENCE,
    ],
    suppressRadius: 0,
    codex:
      'The first Weaver. It held the song longer than anyone, and believes the world has earned its rest. Its baton Cues a mirror-choir that sings your heroes’ Solos back at you; every blow you leave unanswered feeds its Discord, and at the last it stops the music.',
    material: 'glass',
    movement: FINALE_MOVEMENT,
  },
];

/** The Celestial Crucible's arena: open obsidian glass, no pillars, so every line reads. */
export const CRUCIBLE_ARENAS: ContentInput['arenas'] = [
  {
    id: CRUCIBLE_ARENA,
    name: 'The Celestial Crucible',
    radius: CRUCIBLE_RADIUS,
    obstacles: [],
    theme: { floor: '#16141f', line: '#5a5470', accent: '#3a3350', fog: '#0b0a14' },
    biome: 'celestial_crucible',
  },
];

// ── Phase 6 (docs/phase-6.md): True Dissonance's Postlude and Tyrant's closing attacks ──────

/**
 * The Postlude (True Dissonance): the Conductor rises from its fall with `life` of its life,
 * untouchable for `rise` s; `voices` of its choir are Raised again and Cued in pairs every
 * `cueEvery` s, the second `pairGap` s after the first; Discord swells at `discordRate` a second.
 * After `enrageAfter` s of it, the pairs come every `enragedCueEvery` s and Discord swells
 * × `enragedDiscord`. The level's text reads `life` (as a percentage, `dissonance.ts`).
 */
export const POSTLUDE = {
  life: 0.3,
  rise: 3,
  voices: 2,
  cueEvery: 14,
  pairGap: 1.5,
  discordRate: 1.5,
  enrageAfter: 90,
  enragedCueEvery: 10,
  enragedDiscord: 2,
} as const;

/** Tyrant: the last burn's (and the Postlude's) Downbeat and Sforzando cadences (s). */
export const TYRANT_BURN = { downbeat: 7, sforzando: 9 } as const;

/** The Postlude's Decree: what's coming, then its answer (Principle 4). */
export const POSTLUDE_DECREE =
  'Postlude — The Conductor will not let the song end, and its choir sings in pairs. Answer both voices, and silence its Fortissimo with your Crescendo.';
