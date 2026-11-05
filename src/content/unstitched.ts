import type { ContentInput } from './schema';

/**
 * Movement III: the Unstitched (docs/phase-5c.md, docs/plan/03 §6-§7). Code life is the plan's
 * HP × 2.2, as in Movements I and II; damage is at plan value. The Movement's scale (life ×1.75,
 * damage ×1.05, `unstitchedRun.ts`) is applied by the sim, so it is not folded in here. Every
 * number is a named constant below (a 0 means 'none'), and every Codex, affix and decree line is
 * built from the numbers it describes.
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

// ── Rules the sim shares (src/sim/rules3.ts reads these) ─────────────────────────────

/** A possessed hero strikes the nearest ally within the larger of this and its own range (m). */
export const POSSESS_REACH_MIN = 5;
/** A possessed hero strikes every this many seconds, for this share of its basic DPS. */
export const POSSESS_TICK = 0.5;
export const POSSESS_DPS_SHARE = 0.5;
/** The Mimic's beneficiary: the biggest other living enemy within this many metres. */
export const MIMIC_ALLY_RANGE = 12;
/** Emboldened (the Mimic's Empower copy, the Unweaver's Thread): damage dealt ×this. */
export const EMBOLDENED_MULT = 1.25;
/** The Mimic's copies: a Ward's shield (share of max HP) and seconds, Empower's seconds, a Chime's heal. */
export const MIMIC_WARD_PCT = 0.25;
export const MIMIC_WARD_TIME = 6;
export const MIMIC_EMPOWER_TIME = 8;
export const MIMIC_CHIME_HEAL = 0.1;
/** Severing cuts at most once every this many seconds per elite. */
export const SEVER_EVERY = 3;
/** The Unweaver's Spindles stand on a ring this far from its centre (m). */
export const SPINDLE_RING = 9;

// ── The numbers the text names ───────────────────────────────────────────────────────

/** The Shears: their dash's windup, line and damage, and the lock a cut leaves. */
const SHEARS_WINDUP = 1;
const SHEARS_LINE = 14;
const SHEARS_DAMAGE = 120;
const SHEARS_LOCK = 1;
/** The Void Maw's Inhale: its tell, then a pull of this reach, length and speed. */
const INHALE_WINDUP = 1.4;
const INHALE_RADIUS = 8;
const INHALE_TIME = 4;
const INHALE_PULL = 2.8;
const INHALE_EVERY = 11;
/** Inside the pull: refreshed while inside, damage a second. */
const VOIDED = { id: 'voided', duration: 0.6, dps: 36 } as const;
/** The Doubt Wraith's cast, and the possession it leaves. */
const DOUBT_WINDUP = 4;
const DOUBT_DAMAGE = 60;
const POSSESSED = { id: 'possessed', duration: 5 } as const;
/** The Null Priest's rune at the Weaver's feet: its closing circle, reach and length. */
const RUNE_WINDUP = 1.5;
const RUNE_RADIUS = 5;
const RUNE_TIME = 6;
/** The Mimic's mirror cast. */
const MIRROR_WINDUP = 2;
const MIRROR_COOLDOWN = 12;
/** Doom: a stack a hit, up to its ignition, on one timer of this many seconds. */
const DOOM_AT = 5;
const DOOM_TIME = 10;
const DOOM = {
  id: 'doom',
  duration: DOOM_TIME,
  stacks: 1,
  maxStacks: DOOM_AT,
  burst: { at: DOOM_AT, attack: 'doom_burst' },
} as const;
/** Doom's ignition: a mark on the hero for a share of their max HP. */
const DOOM_WINDUP = 1.5;
const DOOM_PCT = 0.4;
/** Chime the Doomed at this many stacks (the bots' and the hints' rule of thumb). */
export const DOOM_CHIME_AT = 4;
/** Severing: the reach around the Thread, and its lock. */
const SEVER = { radius: 2, lock: 1 } as const;
/** Silencing: the Mute's own field, numbers unchanged (field.ts). */
const SILENCE_RADIUS = 7;
/** The Seamstress. */
const NEEDLE_DAMAGE = 345;
const NEEDLE_RADIUS = 2.6;
const NEEDLE_FIRST = 1.4;
const NEEDLE_NEXT = 0.7;
const NEEDLES = 3;
const STITCH_DAMAGE = 60;
/** The Stitch reaches across any arena (its lint: at least the arena's diameter). */
const STITCH_REACH = 40;
const STITCHED = { id: 'stitched', duration: 6 } as const;
const UNPICK_PCT = 0.12;
const UNPICK_LOCK = 1;
const UNPICK_RAIN_AFTER = 1;
/** The Unweaver. */
const SHEAR_DAMAGE = 720;
const SNIP_DAMAGE = 200;
const SNIP_LOCK = 3;
const SNIP_LINE = 30;
const SPINDLES = 3;
const SPINDLE_DR = 0.8;
const CHAMPION_CLEAVE = 700;

// ── Cadences and shapes the text doesn't name ────────────────────────────────────────
// Each attack's cooldown (`_EVERY`) and first use (`_FROM`, s into the fight), and the windups
// and reaches not given above. A scripted attack's cooldown is its script's cadence.

/** Reach that spans any arena (the widest Rift arena's radius is 22 m). */
const ARENA_REACH = 40;
/** How far the casters cast from. */
const CAST_RANGE = 30;
/** A Decree is announced on its attack's first this many casts (AttackDef.decreeLimit). */
const DECREE_CASTS = 2;
const SHEARS_EVERY = 8;
const SHEARS_FROM = 3;
const SHEARS_WIDTH = 1.2;
const INHALE_FROM = 5;
const DOUBT_EVERY = 18;
const DOUBT_FROM = 6;
const RUNE_EVERY = 12;
const RUNE_FROM = 4;
const MIRROR_FROM = 5;
const MIRROR_RADIUS = 1.5;
const NEEDLE_EVERY = 11.25;
const NEEDLE_FROM = 5;
const STITCH_WINDUP = 2.5;
const STITCH_EVERY = 18;
const STITCH_FROM = 8;
const UNPICK_WINDUP = 2.5;
const UNPICK_EVERY = 18;
const SHEAR_WINDUP = 1.8;
const SHEAR_EVERY = 14;
const SHEAR_FROM = 6;
const SHEAR_REACH = 4;
const SHEAR_ARC = 110;
const SNIP_WINDUP = 1.6;
const SNIP_EVERY = 15;
const SNIP_FROM = 8;
const SNIP_WIDTH = 1.4;
const SPINDLES_WINDUP = 1.5;
const SPINDLES_EVERY = 48;
const SPINDLES_FROM = 10;
const STEAL_WINDUP = 3;
const STEAL_EVERY = 40;
const UNRAVEL_WINDUP = 2;
const UNRAVEL_EVERY = 22;
const WEAVE_WINDUP = 1.5;
const WEAVE_EVERY = 30;
const MIRROR_WARD_WINDUP = 2;
const MIRROR_WARD_EVERY = 14;
const CLEAVE_WINDUP = 1.6;
const CLEAVE_EVERY = 11;
const CLEAVE_FROM = 4;
const CLEAVE_REACH = 3.4;
const CLEAVE_ARC = 100;

/**
 * The Steal Verse Decree, naming the aura taken (`aura`: its display name, e.g. 'Valor'). The
 * attack's own `decree` is the unnamed form; the Unweaver's script announces the named one as the
 * verse is torn out, since only it knows which aura that is.
 */
export function stealVerseDecree(aura?: string): string {
  return `Steal Verse — the Unweaver tears ${aura ?? 'an aura'} from your song. Focus the Stolen Verse to take it back.`;
}

/**
 * Each body: code life, speed (m/s), radius and height (m), the range it keeps from its target
 * (m, 0 = closes in) and its basic attack (damage, seconds between hits, reach in m).
 */
const BODIES = {
  shears: {
    hp: 990,
    speed: 5.4,
    radius: 0.45,
    height: 1,
    keep: 0,
    basic: { kind: 'melee', damage: 40, interval: 1, range: 1.2 },
  },
  // Stationary: it never moves (the speed is never used).
  void_maw: {
    hp: 2600,
    speed: 1,
    radius: 1.2,
    height: 1.2,
    keep: 0,
    basic: { kind: 'melee', damage: 84, interval: 1.6, range: 2.8 },
  },
  doubt_wraith: {
    hp: 1100,
    speed: 3.2,
    radius: 0.5,
    height: 2.4,
    keep: 11,
    basic: { kind: 'bolt', damage: 40, interval: 2, range: 13 },
  },
  null_priest: {
    hp: 1540,
    speed: 2.8,
    radius: 0.5,
    height: 2.2,
    keep: 10,
    basic: { kind: 'bolt', damage: 50, interval: 2.2, range: 12 },
  },
  mimic: {
    hp: 1320,
    speed: 3.2,
    radius: 0.5,
    height: 1.9,
    keep: 10,
    basic: { kind: 'bolt', damage: 35, interval: 1.6, range: 11 },
  },
  // Stationary: it never moves (the speed is never used).
  spindle: {
    hp: 1440,
    speed: 1,
    radius: 0.5,
    height: 2,
    keep: 0,
    basic: { kind: 'bolt', damage: 25, interval: 2, range: 14 },
  },
  stolen_verse: {
    hp: 3000,
    speed: 4.4,
    radius: 0.5,
    height: 1.4,
    keep: 16,
    basic: { kind: 'bolt', damage: 20, interval: 2, range: 18 },
  },
  mirror_champion: {
    hp: 12000,
    speed: 3.2,
    radius: 0.8,
    height: 2.6,
    keep: 0,
    basic: { kind: 'melee', damage: 100, interval: 1.4, range: 2 },
  },
  the_seamstress: {
    hp: 43200,
    speed: 3,
    radius: 1.3,
    height: 3,
    keep: 0,
    basic: { kind: 'melee', damage: 80, interval: 1.5, range: 2.4 },
  },
  the_unweaver: {
    hp: 78000,
    speed: 2.4,
    radius: 1.6,
    height: 4.4,
    keep: 0,
    basic: { kind: 'melee', damage: 120, interval: 1.6, range: 2.8 },
  },
} as const;

/** A body's life, speed and size, in the order an EnemyDef lists them. */
function body(id: keyof typeof BODIES) {
  const b = BODIES[id];
  return { hp: b.hp, speed: b.speed, radius: b.radius, height: b.height };
}

/** Movement III specials. Scripted ones only start from a boss script, a payload or a follow-up. */
export const UNSTITCHED_ATTACKS: ContentInput['attacks'] = [
  // ── The Unstitched ───────────────────────────────────────────────────────────────────
  {
    ...BASE,
    id: 'shears_dash',
    name: 'Shearing Dash',
    kind: 'beam',
    effect: 'damage',
    windup: SHEARS_WINDUP,
    cooldown: SHEARS_EVERY,
    initialDelay: SHEARS_FROM,
    damage: SHEARS_DAMAGE,
    length: SHEARS_LINE,
    width: SHEARS_WIDTH,
    range: SHEARS_LINE,
    targeting: 'threadLine',
    answers: ['thread', 'focus', 'move'],
    move: 'charge',
    fullLength: true,
    cut: { lock: SHEARS_LOCK },
  },
  {
    ...BASE,
    id: 'maw_inhale',
    name: 'Inhale',
    kind: 'burst',
    effect: 'zone',
    windup: INHALE_WINDUP,
    cooldown: INHALE_EVERY,
    initialDelay: INHALE_FROM,
    damage: 0,
    radius: INHALE_RADIUS,
    range: INHALE_RADIUS,
    targeting: 'self',
    answers: ['stack', 'reel', 'move'],
    zone: {
      kind: 'pull',
      radius: INHALE_RADIUS,
      duration: INHALE_TIME,
      at: 'caster',
      pullSpeed: INHALE_PULL,
      status: { ...VOIDED },
    },
  },
  {
    ...BASE,
    id: 'wraith_doubt',
    name: 'Doubt',
    kind: 'mark',
    effect: 'damage',
    windup: DOUBT_WINDUP,
    cooldown: DOUBT_EVERY,
    initialDelay: DOUBT_FROM,
    damage: DOUBT_DAMAGE,
    range: CAST_RANGE,
    targeting: 'randomNonTank',
    answers: ['focus', 'chime', 'ward'],
    interruptible: true,
    markStatus: 'doubt',
    status: { ...POSSESSED },
  },
  {
    ...BASE,
    id: 'null_rune',
    name: 'Null Rune',
    kind: 'burst',
    effect: 'zone',
    windup: RUNE_WINDUP,
    cooldown: RUNE_EVERY,
    initialDelay: RUNE_FROM,
    damage: 0,
    radius: RUNE_RADIUS,
    range: CAST_RANGE,
    targeting: 'self',
    answers: ['move'],
    centre: 'weaver',
    zone: { kind: 'null', radius: RUNE_RADIUS, duration: RUNE_TIME, at: 'target' },
  },
  {
    ...BASE,
    id: 'mimic_mirror',
    name: 'Mirror',
    kind: 'burst',
    effect: 'mimic',
    windup: MIRROR_WINDUP,
    cooldown: MIRROR_COOLDOWN,
    initialDelay: MIRROR_FROM,
    damage: 0,
    radius: MIRROR_RADIUS,
    range: MIMIC_ALLY_RANGE,
    targeting: 'allyEnemy',
    answers: ['focus'],
    interruptible: true,
  },
  // Doom's ignition: started only by Doom-touched's payload (never in any enemy's specials).
  {
    ...BASE,
    id: 'doom_burst',
    name: 'Doom',
    kind: 'mark',
    effect: 'damage',
    windup: DOOM_WINDUP,
    cooldown: 0,
    initialDelay: 0,
    damage: 0,
    pctMaxHp: DOOM_PCT,
    range: ARENA_REACH,
    targeting: 'current',
    answers: ['chime', 'ward', 'focus'],
    markStatus: 'doomed',
    scripted: true,
  },
  // ── The Seamstress (mini-boss) ───────────────────────────────────────────────────────
  {
    ...BASE,
    id: 'seamstress_needles',
    name: 'Needle Rain',
    kind: 'burst',
    effect: 'damage',
    windup: NEEDLE_FIRST,
    cooldown: NEEDLE_EVERY,
    initialDelay: NEEDLE_FROM,
    damage: NEEDLE_DAMAGE,
    radius: NEEDLE_RADIUS,
    range: ARENA_REACH,
    targeting: 'randomHero',
    answers: ['move', 'ward', 'reel'],
    centre: 'target',
    followUp: { attack: 'seamstress_needles_2', delay: 0 },
  },
  {
    ...BASE,
    id: 'seamstress_needles_2',
    name: 'Needle Rain',
    kind: 'burst',
    effect: 'damage',
    windup: NEEDLE_NEXT,
    cooldown: NEEDLE_EVERY,
    initialDelay: 0,
    damage: NEEDLE_DAMAGE,
    radius: NEEDLE_RADIUS,
    range: ARENA_REACH,
    targeting: 'randomHero',
    answers: ['move', 'ward', 'reel'],
    centre: 'target',
    followUp: { attack: 'seamstress_needles_3', delay: 0 },
    scripted: true,
  },
  {
    ...BASE,
    id: 'seamstress_needles_3',
    name: 'Needle Rain',
    kind: 'burst',
    effect: 'damage',
    windup: NEEDLE_NEXT,
    cooldown: NEEDLE_EVERY,
    initialDelay: 0,
    damage: NEEDLE_DAMAGE,
    radius: NEEDLE_RADIUS,
    range: ARENA_REACH,
    targeting: 'randomHero',
    answers: ['move', 'ward', 'reel'],
    centre: 'target',
    scripted: true,
  },
  {
    ...BASE,
    id: 'seamstress_stitch',
    name: 'Stitch',
    kind: 'link',
    effect: 'damage',
    windup: STITCH_WINDUP,
    cooldown: STITCH_EVERY,
    initialDelay: STITCH_FROM,
    damage: STITCH_DAMAGE,
    radius: STITCH_REACH,
    range: ARENA_REACH,
    targeting: 'pair',
    answers: ['chime', 'ward', 'reel'],
    linkStatus: 'stitch',
    status: { ...STITCHED },
    decreeLimit: DECREE_CASTS,
    decree:
      'Stitch — two heroes are sewn to the floor. Chime the stitch as it winds up; once it holds, Reel one free. A Ward on one keeps that hero loose.',
  },
  {
    ...BASE,
    id: 'seamstress_unpick',
    name: 'Unpick',
    kind: 'raid',
    effect: 'damage',
    windup: UNPICK_WINDUP,
    cooldown: UNPICK_EVERY,
    initialDelay: 0,
    damage: 0,
    pctMaxHp: UNPICK_PCT,
    range: ARENA_REACH,
    targeting: 'allHeroes',
    answers: ['ward', 'thread'],
    cut: { lock: UNPICK_LOCK, always: true },
    followUp: { attack: 'seamstress_unpick_rain', delay: UNPICK_RAIN_AFTER },
    scripted: true,
  },
  // The Unpick's Needle Rain: the first needle again, started only by the Unpick's follow-up.
  {
    ...BASE,
    id: 'seamstress_unpick_rain',
    name: 'Needle Rain',
    kind: 'burst',
    effect: 'damage',
    windup: NEEDLE_FIRST,
    cooldown: NEEDLE_EVERY,
    initialDelay: 0,
    damage: NEEDLE_DAMAGE,
    radius: NEEDLE_RADIUS,
    range: ARENA_REACH,
    targeting: 'randomHero',
    answers: ['move', 'ward', 'reel'],
    centre: 'target',
    followUp: { attack: 'seamstress_needles_2', delay: 0 },
    scripted: true,
  },
  // ── The Unweaver (boss) ──────────────────────────────────────────────────────────────
  {
    ...BASE,
    id: 'unweaver_shear',
    name: 'Shear',
    kind: 'cleave',
    effect: 'damage',
    windup: SHEAR_WINDUP,
    cooldown: SHEAR_EVERY,
    initialDelay: SHEAR_FROM,
    damage: SHEAR_DAMAGE,
    radius: SHEAR_REACH,
    angleDeg: SHEAR_ARC,
    range: SHEAR_REACH,
    targeting: 'current',
    answers: ['ward', 'reel', 'dome'],
    decreeLimit: DECREE_CASTS,
    decree: 'Shear — the great shears close on the tank. Ward them, or raise Kael’s dome.',
    decreeNoDome: 'Shear — the great shears close on the tank. Ward them, and keep a Reel ready.',
  },
  {
    ...BASE,
    id: 'unweaver_snip',
    name: 'Snip',
    kind: 'beam',
    effect: 'damage',
    windup: SNIP_WINDUP,
    cooldown: SNIP_EVERY,
    initialDelay: SNIP_FROM,
    damage: SNIP_DAMAGE,
    length: SNIP_LINE,
    width: SNIP_WIDTH,
    range: ARENA_REACH,
    targeting: 'threadLine',
    answers: ['thread', 'move'],
    fullLength: true,
    cut: { lock: SNIP_LOCK },
    scripted: true,
    decreeLimit: DECREE_CASTS,
    decree: `Snip — the shears close across your Thread. Get on your hero’s side of the line, or lose it for ${SNIP_LOCK} s.`,
  },
  {
    ...BASE,
    id: 'unweaver_spindles',
    name: 'Spindles',
    kind: 'burst',
    effect: 'summon',
    windup: SPINDLES_WINDUP,
    cooldown: SPINDLES_EVERY,
    initialDelay: SPINDLES_FROM,
    damage: 0,
    range: ARENA_REACH,
    targeting: 'self',
    answers: ['focus'],
    summon: { enemy: 'spindle', count: SPINDLES, maxAlive: SPINDLES },
    decreeLimit: DECREE_CASTS,
    decree: `Spindles — while one stands, the Unweaver takes ${pct(SPINDLE_DR)}% less damage. Focus them.`,
  },
  {
    ...BASE,
    id: 'unweaver_steal_verse',
    name: 'Steal Verse',
    kind: 'burst',
    effect: 'script',
    windup: STEAL_WINDUP,
    cooldown: STEAL_EVERY,
    initialDelay: 0,
    damage: 0,
    range: ARENA_REACH,
    targeting: 'self',
    answers: ['focus'],
    // The script spawns the Verse (and mutes the aura it carries) as the cast lands.
    summon: { enemy: 'stolen_verse', count: 1, maxAlive: 1 },
    scripted: true,
    // The generic text; the Unweaver's script announces the one naming the stolen aura.
    decree: stealVerseDecree(),
  },
  {
    ...BASE,
    id: 'unweaver_unravel',
    name: 'Unravel',
    kind: 'raid',
    effect: 'script',
    windup: UNRAVEL_WINDUP,
    cooldown: UNRAVEL_EVERY,
    initialDelay: 0,
    damage: 0,
    range: ARENA_REACH,
    targeting: 'allHeroes',
    answers: ['empower'],
    scripted: true,
    decree: 'Unravel — your Thread turns: Mend wounds. Switch to Empower until it passes.',
  },
  {
    ...BASE,
    id: 'unweaver_weave',
    name: 'Mirror Weave',
    kind: 'burst',
    effect: 'summon',
    windup: WEAVE_WINDUP,
    cooldown: WEAVE_EVERY,
    initialDelay: 0,
    damage: 0,
    range: ARENA_REACH,
    targeting: 'self',
    answers: ['focus'],
    summon: { enemy: 'mirror_champion', count: 1, maxAlive: 1 },
    scripted: true,
  },
  {
    ...BASE,
    id: 'unweaver_mirror_ward',
    name: 'Mirror Ward',
    kind: 'burst',
    effect: 'script',
    windup: MIRROR_WARD_WINDUP,
    cooldown: MIRROR_WARD_EVERY,
    initialDelay: 0,
    damage: 0,
    range: ARENA_REACH,
    targeting: 'self',
    answers: ['focus'],
    interruptible: true,
    scripted: true,
  },
  // ── Adds ─────────────────────────────────────────────────────────────────────────────
  {
    ...BASE,
    id: 'champion_cleave',
    name: 'Hollow Cleave',
    kind: 'cleave',
    effect: 'damage',
    windup: CLEAVE_WINDUP,
    cooldown: CLEAVE_EVERY,
    initialDelay: CLEAVE_FROM,
    damage: CHAMPION_CLEAVE,
    radius: CLEAVE_REACH,
    angleDeg: CLEAVE_ARC,
    range: CLEAVE_REACH,
    targeting: 'current',
    answers: ['ward', 'reel', 'move'],
  },
];

/** Void-cloth bodies with bone seams (docs/phase-5c.md, Palette). */
const VOID_CLOTH = '#2a2547';

/** Movement III: the Unstitched (docs/plan/03 §6), their adds and their two bosses. */
export const UNSTITCHED_ENEMIES: ContentInput['enemies'] = [
  {
    id: 'shears',
    name: 'Shears',
    role: 'swarm',
    ...body('shears'),
    color: VOID_CLOTH,
    accent: '#cfd2e0',
    basic: { ...BODIES.shears.basic },
    preferredRange: BODIES.shears.keep,
    specials: ['shears_dash'],
    suppressRadius: 0,
    codex: `Living scissors. After a ${SHEARS_WINDUP} s crouch they dash ${SHEARS_LINE} m through the middle of your Thread, dealing ${SHEARS_DAMAGE} to anyone on the line, and cut it if the line still crosses it: no Thread for ${SHEARS_LOCK} s. Thread a hero on your side of the line, or step across it. Focus them.`,
    material: 'cloth',
    movement: 3,
  },
  {
    id: 'void_maw',
    name: 'Void Maw',
    role: 'brute',
    ...body('void_maw'),
    color: VOID_CLOTH,
    accent: '#3b2f8f',
    basic: { ...BODIES.void_maw.basic },
    preferredRange: BODIES.void_maw.keep,
    specials: ['maw_inhale'],
    suppressRadius: 0,
    codex: `A mouth torn in the floor. Every ${INHALE_EVERY} s it Inhales: after a ${INHALE_WINDUP} s tell, everyone within ${INHALE_RADIUS} m is dragged toward it at ${INHALE_PULL} m/s for ${INHALE_TIME} s, taking ${VOIDED.dps} damage a second. Rally the party to you during the tell, or Reel a hero out.`,
    material: 'cloth',
    movement: 3,
    stationary: true,
  },
  {
    id: 'doubt_wraith',
    name: 'Doubt Wraith',
    role: 'caster',
    ...body('doubt_wraith'),
    color: VOID_CLOTH,
    accent: '#6a5acd',
    basic: { ...BODIES.doubt_wraith.basic },
    preferredRange: BODIES.doubt_wraith.keep,
    specials: ['wraith_doubt'],
    suppressRadius: 0,
    codex: `A hollow hood that whispers. Its ${DOUBT_WINDUP} s Doubt possesses a hero for ${POSSESSED.duration} s: they turn on the nearest ally within reach. Focus the Wraith to interrupt it, Chime the marked hero to cancel it, or Ward them. Chime frees a possessed hero.`,
    material: 'cloth',
    movement: 3,
  },
  {
    id: 'null_priest',
    name: 'Null Priest',
    role: 'caster',
    ...body('null_priest'),
    color: VOID_CLOTH,
    accent: '#d9c7a0',
    basic: { ...BODIES.null_priest.basic },
    preferredRange: BODIES.null_priest.keep,
    specials: ['null_rune'],
    suppressRadius: 0,
    codex: `It writes a rune at your feet. ${RUNE_WINDUP} s later it closes into a ${RUNE_RADIUS} m ring for ${RUNE_TIME} s, and inside it your Ward, Chime and Reel won’t answer. Glide always will: step or Glide out.`,
    material: 'cloth',
    movement: 3,
  },
  {
    id: 'mimic',
    name: 'Mimic',
    role: 'caster',
    ...body('mimic'),
    color: VOID_CLOTH,
    accent: '#b8c4d6',
    basic: { ...BODIES.mimic.basic },
    preferredRange: BODIES.mimic.keep,
    specials: ['mimic_mirror'],
    suppressRadius: 0,
    codex: `A faceted mirror. Over a ${MIRROR_WINDUP} s cast it copies your Empower, or else your last Ward or Chime, onto the biggest enemy within ${MIMIC_ALLY_RANGE} m. Change what you cast before it ends and the mirror cracks. Focus it to interrupt.`,
    material: 'cloth',
    movement: 3,
  },
  // ── Adds ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'spindle',
    name: 'Spindle',
    role: 'support',
    ...body('spindle'),
    color: VOID_CLOTH,
    accent: '#e8e3c8',
    basic: { ...BODIES.spindle.basic },
    preferredRange: BODIES.spindle.keep,
    specials: [],
    suppressRadius: 0,
    codex: `A spindle of the Unweaver’s crown. While one stands, the Unweaver takes ${pct(SPINDLE_DR)}% less damage. Focus them.`,
    material: 'cloth',
    movement: 3,
    stationary: true,
    tether: { dr: SPINDLE_DR },
  },
  {
    id: 'stolen_verse',
    name: 'Stolen Verse',
    role: 'caster',
    ...body('stolen_verse'),
    color: VOID_CLOTH,
    accent: '#e8e3c8',
    basic: { ...BODIES.stolen_verse.basic },
    preferredRange: BODIES.stolen_verse.keep,
    specials: [],
    suppressRadius: 0,
    codex:
      'One of your auras, torn out of your song and running. Focus it: when it falls, the aura pours back.',
    material: 'cloth',
    movement: 3,
  },
  {
    id: 'mirror_champion',
    name: 'Hollow Champion',
    role: 'brute',
    ...body('mirror_champion'),
    color: VOID_CLOTH,
    accent: '#b8c4d6',
    basic: { ...BODIES.mirror_champion.basic },
    preferredRange: BODIES.mirror_champion.keep,
    specials: ['champion_cleave'],
    suppressRadius: 0,
    codex: `The Unweaver’s mirror of your tank, Threaded by it: it deals ${pct(EMBOLDENED_MULT - 1)}% more damage while the Unweaver lives, and its cleave hits for ${CHAMPION_CLEAVE}. Interrupt the Mirror Ward, and Focus the champion.`,
    material: 'cloth',
    movement: 3,
  },
  // ── Bosses ───────────────────────────────────────────────────────────────────────────
  {
    id: 'the_seamstress',
    name: 'The Seamstress',
    role: 'miniboss',
    ...body('the_seamstress'),
    color: VOID_CLOTH,
    accent: '#e8e3c8',
    basic: { ...BODIES.the_seamstress.basic },
    preferredRange: BODIES.the_seamstress.keep,
    specials: [
      'seamstress_needles',
      'seamstress_needles_2',
      'seamstress_needles_3',
      'seamstress_stitch',
      'seamstress_unpick',
      'seamstress_unpick_rain',
    ],
    suppressRadius: 0,
    codex: `A many-armed tailor with needle fingers. Her Needle Rain falls in ${NEEDLES} circles, ${NEEDLE_DAMAGE} each; her Stitch sews two heroes to the floor for ${STITCHED.duration} s, and a Chime breaks it; and below half her life she Unpicks your Thread, ${pct(UNPICK_PCT)}% of everyone’s life with it.`,
    material: 'cloth',
    movement: 3,
  },
  {
    id: 'the_unweaver',
    name: 'The Unweaver',
    role: 'boss',
    ...body('the_unweaver'),
    color: VOID_CLOTH,
    accent: '#cfd2e0',
    basic: { ...BODIES.the_unweaver.basic },
    preferredRange: BODIES.the_unweaver.keep,
    specials: [
      'unweaver_shear',
      'unweaver_snip',
      'unweaver_spindles',
      'unweaver_steal_verse',
      'unweaver_unravel',
      'unweaver_weave',
      'unweaver_mirror_ward',
    ],
    suppressRadius: 0,
    codex: `Hooded, with giant shears and a crown of spindles, it unmakes what you weave. Its Snip cuts your Thread for ${SNIP_LOCK} s, its Spindles shield it, it steals a verse of your song and turns your Mend to wounds, and at the last it weaves a champion of its own.`,
    material: 'cloth',
    movement: 3,
  },
];

/** Movement III's affixes. Its elites may roll them only from Movement III on. */
export const UNSTITCHED_AFFIXES: ContentInput['affixes'] = [
  {
    id: 'severing',
    name: 'Severing',
    description: `A hit it lands while your Thread passes within ${SEVER.radius} m cuts it for ${SEVER.lock} s, at most once every ${SEVER_EVERY} s.`,
    color: '#f8fafc',
    movement: 3,
    cut: { ...SEVER },
    answers: ['thread'],
  },
  {
    id: 'silencing',
    name: 'Silencing',
    description: `It carries a Mute’s field: within ${SILENCE_RADIUS} m your auras reach less far and do less. Focus it.`,
    color: '#2563eb',
    movement: 3,
    suppressRadius: SILENCE_RADIUS,
    answers: ['focus'],
  },
  {
    id: 'mimicking',
    name: 'Mimicking',
    description: `It casts the Mimic’s mirror every ${MIRROR_COOLDOWN} s. Focus it, or vary your techniques.`,
    color: '#e0e7ff',
    movement: 3,
    specials: ['mimic_mirror'],
    answers: ['focus'],
  },
  {
    id: 'doom_touched',
    name: 'Doom-touched',
    description: `Its hits on a hero stack Doom. At ${DOOM_AT} stacks it ignites: ${DOOM_WINDUP} s later, ${pct(DOOM_PCT)}% of their life. Chime before ${DOOM_AT}, or Ward the blast.`,
    color: '#5b21b6',
    movement: 3,
    onHit: { ...DOOM },
    answers: ['chime', 'ward', 'focus'],
  },
];
