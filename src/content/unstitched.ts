import type { ContentInput } from './schema';

/**
 * Movement III: the Unstitched (docs/phase-5c.md, docs/plan/03 §6-§7). Code life is the plan's
 * HP × 2.2, as in Movements I and II; damage is at plan value. The Movement's scale (life ×1.75,
 * damage ×1.05, `unstitchedRun.ts`) is applied by the sim, so it is not folded in here. Every
 * number the text names is a constant below, and every Codex, affix and decree line is built
 * from the numbers it describes.
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
const INHALE_PULL = 2.4;
const INHALE_EVERY = 11;
/** Inside the pull: refreshed while inside, damage a second. */
const VOIDED = { id: 'voided', duration: 0.6, dps: 30 } as const;
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
/** Doom: a stack a hit, up to its ignition, on one timer. */
const DOOM_AT = 5;
const DOOM = {
  id: 'doom',
  duration: 10,
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
const NEEDLE_DAMAGE = 300;
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
const SHEAR_DAMAGE = 900;
const SNIP_DAMAGE = 200;
const SNIP_LOCK = 3;
const SNIP_LINE = 30;
const SPINDLES = 3;
const SPINDLE_DR = 0.8;
const CHAMPION_CLEAVE = 700;

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
    cooldown: 8,
    initialDelay: 3,
    damage: SHEARS_DAMAGE,
    length: SHEARS_LINE,
    width: 1.2,
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
    initialDelay: 5,
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
    cooldown: 15,
    initialDelay: 6,
    damage: DOUBT_DAMAGE,
    range: 30,
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
    cooldown: 12,
    initialDelay: 4,
    damage: 0,
    radius: RUNE_RADIUS,
    range: 30,
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
    initialDelay: 5,
    damage: 0,
    radius: 1.5,
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
    range: 40,
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
    cooldown: 12,
    initialDelay: 5,
    damage: NEEDLE_DAMAGE,
    radius: NEEDLE_RADIUS,
    range: 40,
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
    cooldown: 12,
    initialDelay: 0,
    damage: NEEDLE_DAMAGE,
    radius: NEEDLE_RADIUS,
    range: 40,
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
    cooldown: 12,
    initialDelay: 0,
    damage: NEEDLE_DAMAGE,
    radius: NEEDLE_RADIUS,
    range: 40,
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
    windup: 2.5,
    cooldown: 18,
    initialDelay: 8,
    damage: STITCH_DAMAGE,
    radius: STITCH_REACH,
    range: 40,
    targeting: 'pair',
    answers: ['chime', 'ward', 'reel'],
    linkStatus: 'stitch',
    status: { ...STITCHED },
    decreeLimit: 2,
    decree:
      'Stitch — two heroes are sewn to the floor. Chime breaks the stitch, or frees them both.',
  },
  {
    ...BASE,
    id: 'seamstress_unpick',
    name: 'Unpick',
    kind: 'raid',
    effect: 'damage',
    windup: 2.5,
    cooldown: 22,
    initialDelay: 0,
    damage: 0,
    pctMaxHp: UNPICK_PCT,
    range: 40,
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
    cooldown: 12,
    initialDelay: 0,
    damage: NEEDLE_DAMAGE,
    radius: NEEDLE_RADIUS,
    range: 40,
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
    windup: 1.8,
    cooldown: 14,
    initialDelay: 6,
    damage: SHEAR_DAMAGE,
    radius: 4,
    angleDeg: 110,
    range: 4,
    targeting: 'current',
    answers: ['ward', 'reel', 'dome'],
    decreeLimit: 2,
    decree: 'Shear — the great shears close on the tank. Ward them, or raise Kael’s dome.',
    decreeNoDome: 'Shear — the great shears close on the tank. Ward them, and keep a Reel ready.',
  },
  {
    ...BASE,
    id: 'unweaver_snip',
    name: 'Snip',
    kind: 'beam',
    effect: 'damage',
    windup: 1.6,
    cooldown: 15,
    initialDelay: 8,
    damage: SNIP_DAMAGE,
    length: SNIP_LINE,
    width: 1.4,
    range: 40,
    targeting: 'threadLine',
    answers: ['thread', 'move'],
    fullLength: true,
    cut: { lock: SNIP_LOCK },
    scripted: true,
    decreeLimit: 2,
    decree: `Snip — the shears close across your Thread. Get on your hero’s side of the line, or lose it for ${SNIP_LOCK} s.`,
  },
  {
    ...BASE,
    id: 'unweaver_spindles',
    name: 'Spindles',
    kind: 'burst',
    effect: 'summon',
    windup: 1.5,
    cooldown: 40,
    initialDelay: 10,
    damage: 0,
    range: 40,
    targeting: 'self',
    answers: ['focus'],
    summon: { enemy: 'spindle', count: SPINDLES, maxAlive: SPINDLES },
    decreeLimit: 2,
    decree: `Spindles — while one stands, the Unweaver takes ${pct(SPINDLE_DR)}% less damage. Focus them.`,
  },
  {
    ...BASE,
    id: 'unweaver_steal_verse',
    name: 'Steal Verse',
    kind: 'burst',
    effect: 'script',
    windup: 3,
    cooldown: 40,
    initialDelay: 0,
    damage: 0,
    range: 40,
    targeting: 'self',
    answers: ['focus'],
    // The script spawns the Verse (and mutes the aura it carries) as the cast lands.
    summon: { enemy: 'stolen_verse', count: 1, maxAlive: 1 },
    scripted: true,
    decree:
      'Steal Verse — the Unweaver tears an aura from your song. Focus the Stolen Verse to take it back.',
  },
  {
    ...BASE,
    id: 'unweaver_unravel',
    name: 'Unravel',
    kind: 'raid',
    effect: 'script',
    windup: 2,
    cooldown: 22,
    initialDelay: 0,
    damage: 0,
    range: 40,
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
    windup: 1.5,
    cooldown: 30,
    initialDelay: 0,
    damage: 0,
    range: 40,
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
    windup: 2,
    cooldown: 14,
    initialDelay: 0,
    damage: 0,
    range: 40,
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
    windup: 1.6,
    cooldown: 11,
    initialDelay: 4,
    damage: CHAMPION_CLEAVE,
    radius: 3.4,
    angleDeg: 100,
    range: 3.4,
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
    hp: 990,
    speed: 5.4,
    radius: 0.45,
    height: 1,
    color: VOID_CLOTH,
    accent: '#cfd2e0',
    basic: { kind: 'melee', damage: 40, interval: 1, range: 1.2 },
    preferredRange: 0,
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
    hp: 3080,
    // Stationary: it never moves (the speed is never used).
    speed: 1,
    radius: 1.2,
    height: 1.2,
    color: VOID_CLOTH,
    accent: '#3b2f8f',
    basic: { kind: 'melee', damage: 70, interval: 1.6, range: 2.8 },
    preferredRange: 0,
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
    hp: 1100,
    speed: 3.2,
    radius: 0.5,
    height: 2.4,
    color: VOID_CLOTH,
    accent: '#6a5acd',
    basic: { kind: 'bolt', damage: 40, interval: 2, range: 13 },
    preferredRange: 11,
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
    hp: 1540,
    speed: 2.8,
    radius: 0.5,
    height: 2.2,
    color: VOID_CLOTH,
    accent: '#d9c7a0',
    basic: { kind: 'bolt', damage: 50, interval: 2.2, range: 12 },
    preferredRange: 10,
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
    hp: 1320,
    speed: 3.2,
    radius: 0.5,
    height: 1.9,
    color: VOID_CLOTH,
    accent: '#b8c4d6',
    basic: { kind: 'bolt', damage: 35, interval: 1.6, range: 11 },
    preferredRange: 10,
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
    hp: 1800,
    // Stationary: it never moves (the speed is never used).
    speed: 1,
    radius: 0.5,
    height: 2,
    color: VOID_CLOTH,
    accent: '#e8e3c8',
    basic: { kind: 'bolt', damage: 25, interval: 2, range: 14 },
    preferredRange: 0,
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
    hp: 3000,
    speed: 4.4,
    radius: 0.5,
    height: 1.4,
    color: VOID_CLOTH,
    accent: '#e8e3c8',
    basic: { kind: 'bolt', damage: 20, interval: 2, range: 18 },
    preferredRange: 16,
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
    hp: 12000,
    speed: 3.2,
    radius: 0.8,
    height: 2.6,
    color: VOID_CLOTH,
    accent: '#b8c4d6',
    basic: { kind: 'melee', damage: 100, interval: 1.4, range: 2 },
    preferredRange: 0,
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
    hp: 36000,
    speed: 3,
    radius: 1.3,
    height: 3,
    color: VOID_CLOTH,
    accent: '#e8e3c8',
    basic: { kind: 'melee', damage: 80, interval: 1.5, range: 2.4 },
    preferredRange: 0,
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
    hp: 78000,
    speed: 2.4,
    radius: 1.6,
    height: 4.4,
    color: VOID_CLOTH,
    accent: '#cfd2e0',
    basic: { kind: 'melee', damage: 120, interval: 1.6, range: 2.8 },
    preferredRange: 0,
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
