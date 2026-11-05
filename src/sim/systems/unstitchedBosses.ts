/**
 * Movement III's boss scripts (docs/phase-5c.md): the Seamstress's Unpick and the Unweaver's three
 * phases, registered in `BOSS_SCRIPTS` (bossScripts.ts). Everything else they do is data: the
 * Seamstress's Needle Rain and Stitch, the Unweaver's Shear and Spindles, every follow-up and every
 * attack's own Decree (src/content/unstitched.ts), resolved by the generic paths.
 *
 * Their clocks live in the lazy `world.internal.m3`, and their public state in `field.unravel`,
 * `field.stolen` and the champion's `emboldenedUntil`. Nothing here runs for any other boss: the
 * registry's lookup misses for their ids. Every number the content doesn't already hold is a named
 * constant below; the cadences the content does hold (an attack's `cooldown` and `initialDelay`)
 * are read from it.
 *
 * Each script is built by a hoisted function, not held in a `const`, so the registry can be filled
 * whichever module of the enemies ↔ bossScripts ↔ unstitchedBosses cycle loads first.
 */
import { attackDef } from '../../content';
import { SPINDLE_RING, stealVerseDecree } from '../../content/unstitched';
import type { AttackDef } from '../../content/schema';
import { SIM_DT } from '../constants';
import { announceDecree } from '../combat/feedback';
import { addShield, addStatus, DOT_TICK, isActive, killEnemy } from '../combat/health';
import type { AnswerTag } from '../events';
import type { Entity, Telegraph } from '../state';
import type { World } from '../world';
import type { BossScript, ScriptedNext } from './bossScripts';
import { phaseDecree } from './bosses';
import { beginAttack, ensureM2, ensureM3, ringPoint, spawnEnemy } from './enemies';

type M3 = NonNullable<World['internal']['m3']>;

// ── The Seamstress (docs/phase-5c.md, Mini-boss) ─────────────────────────────────────

const UNPICK = 'seamstress_unpick';
/** The Unpick: first this long after phase 2's shift ends; then its cooldown, or this enraged. */
const UNPICK_FIRST = 5;
const UNPICK_EVERY_ENRAGED = 15;

// ── The Unweaver (docs/phase-5c.md, Boss) ────────────────────────────────────────────

const SNIP = 'unweaver_snip';
const SPINDLES = 'unweaver_spindles';
const STEAL = 'unweaver_steal_verse';
const UNRAVEL = 'unweaver_unravel';
const WEAVE = 'unweaver_weave';
const MIRROR_WARD = 'unweaver_mirror_ward';
const STOLEN_VERSE = 'stolen_verse';
const CHAMPION = 'mirror_champion';
/** The Snip: its cooldown (content), this enraged, this in phase 3 (Mirror Weave). */
const SNIP_EVERY_ENRAGED = 10;
const SNIP_EVERY_LATE = 20;
/** Steal Verse: first this long after phase 2's shift ends; the Verse escapes after this long. */
const STEAL_FIRST = 3;
const STEAL_ESCAPE = 30;
/** Unravel: first this long after phase 2's shift; its cooldown, or this enraged; its window. */
const UNRAVEL_FIRST = 6;
const UNRAVEL_EVERY_ENRAGED = 14;
const UNRAVEL_TIME = 5;
/** The Mirror Ward: first this long after phase 3's shift; its cooldown, or this enraged. */
const MIRROR_FIRST = 4;
const MIRROR_EVERY_ENRAGED = 9;
/** The Mirror Ward's shield: a share of the champion's max HP, for this long. */
const MIRROR_WARD_PCT = 0.3;
const MIRROR_WARD_TIME = 5;
/**
 * The boss's Thread on its champion: Emboldened is kept this far ahead while the boss lives, and
 * it heals this share of its max HP a second (in whole-second pulses).
 */
const THREAD_HOLD = 1.5;
const THREAD_HEAL = 0.01;
/**
 * A phase's Decree is announced at its entry (bosses.ts) and again on its signature cast's first
 * this many casts (the Unpick, the Mirror Ward), so it is heard twice even in a fast phase.
 */
const PHASE_DECREE_AGAIN = 1;

// ── The registry's entries ───────────────────────────────────────────────────────────

/** The Seamstress's script: the Unpick cadence. Needle Rain and Stitch are data. */
export function seamstressScript(): BossScript {
  return {
    tick: seamstressTick,
    enter: seamstressEnter,
    scriptedNext: seamstressNext,
    stasis: holdClocks,
    cleanup,
  };
}

/** The Unweaver's script: the Snip, Steal Verse, Unravel, the champion and its Mirror Ward. */
export function unweaverScript(): BossScript {
  return {
    update: unweaverUpdate,
    tick: unweaverTick,
    enter: unweaverEnter,
    resolved: unweaverResolved,
    scriptedNext: unweaverNext,
    onAddDeath: unweaverAddDeath,
    onDeath: unweaverDeath,
    summonRing: (attackId) => (attackId === SPINDLES ? SPINDLE_RING : undefined),
    stasis: holdClocks,
    cleanup,
  };
}

// ── Shared ───────────────────────────────────────────────────────────────────────────

/** Every clock a Movement III script keeps in `m3` (Severing's `severAt` waits in stasis.ts). */
const CLOCKS = [
  'nextSnipAt',
  'nextUnravelAt',
  'nextStealAt',
  'nextUnpickAt',
  'nextChampionAt',
  'nextMirrorAt',
] as const;

/** Stasis: every script clock waits (the field keys and the enrage wait in stasis.ts). */
function holdClocks(world: World, dt: number): void {
  const m3 = world.internal.m3;
  if (!m3) return;
  for (const key of CLOCKS) {
    const at = m3[key];
    if (at !== undefined) m3[key] = at + dt;
  }
}

/** The encounter ended: nothing a script made outlives it (director.ts deletes these too). */
function cleanup(world: World): void {
  delete world.internal.m3;
  delete world.field.unravel;
  delete world.field.stolen;
}

function enraged(world: World): boolean {
  return world.internal.boss.enraged;
}

/** Sim time the current phase shift ends (set before a script's `enter` runs). */
function shiftEnd(world: World): number {
  return world.internal.boss.phaseShiftUntil;
}

/** The boss's current target if it can still be hit. */
function currentTarget(world: World, boss: Entity): Entity | null {
  const id = boss.enemy!.targetId;
  const target = id === null ? undefined : world.entities.get(id);
  return isActive(target) ? target : null;
}

/**
 * The phase's Decree again, with its signature cast's first `PHASE_DECREE_AGAIN` casts (counted
 * by that attack's id in `m2.decrees`, beside the attacks' own `decreeLimit` counts).
 */
function phaseDecreeAgain(world: World, boss: Entity, attackId: string): void {
  const decree = phaseDecree(boss.enemy!.defId, boss.enemy!.phase - 1);
  if (!decree) return;
  const decrees = (ensureM2(world).decrees ??= {});
  const n = decrees[attackId] ?? 0;
  if (n >= PHASE_DECREE_AGAIN) return;
  decrees[attackId] = n + 1;
  announce(world, boss, decree.name, decree.text, decree.answers);
}

function announce(
  world: World,
  boss: Entity,
  name: string,
  text: string,
  answers: readonly AnswerTag[],
): void {
  announceDecree(world, {
    type: 'decree',
    tick: world.tick,
    boss: boss.id,
    name,
    text,
    answers: [...answers],
  });
}

/** The soonest of the due-able casts, the first listed on a tie (the order the tick tries). */
function soonest(options: (ScriptedNext | null)[]): ScriptedNext | null {
  let best: ScriptedNext | null = null;
  for (const o of options) if (o && (!best || o.at < best.at - 1e-9)) best = o;
  return best;
}

// ── The Seamstress ───────────────────────────────────────────────────────────────────

/** Phase 2 (Unpicking): the Unpick's clock starts. */
function seamstressEnter(world: World, _boss: Entity, phase: number): void {
  if (phase !== 2) return;
  ensureM3(world).nextUnpickAt = shiftEnd(world) + UNPICK_FIRST;
}

/** The Unpick, on its cadence; its Needle Rain follows as data (`followUp`). */
function seamstressTick(world: World, boss: Entity): void {
  const m3 = world.internal.m3;
  if (!m3 || !due(world, m3.nextUnpickAt)) return;
  const unpick = attackDef(UNPICK);
  if (!beginAttack(world, boss, unpick, currentTarget(world, boss))) return;
  m3.nextUnpickAt = world.time + (enraged(world) ? UNPICK_EVERY_ENRAGED : unpick.cooldown);
  phaseDecreeAgain(world, boss, UNPICK);
}

function seamstressNext(world: World): ScriptedNext | null {
  const at = world.internal.m3?.nextUnpickAt;
  return at === undefined ? null : { attackId: UNPICK, at };
}

// ── The Unweaver ─────────────────────────────────────────────────────────────────────

/**
 * Every tick it stands, whatever it is doing: Unravel's window and a stolen verse run out on
 * time, and in phase 3 its Thread holds its champion.
 */
function unweaverUpdate(world: World, boss: Entity): void {
  const f = world.field;
  if (f.unravel && world.time >= f.unravel.until - 1e-9) closeUnravel(world);
  if (f.stolen && world.time >= f.stolen.until - 1e-9) returnVerse(world, 'expired');
  if (boss.enemy!.phase >= 3) holdChampion(world, boss);
}

/** Its scripted casts, one at a time, in this order when several are due. */
function unweaverTick(world: World, boss: Entity): void {
  const c = boss.enemy!;
  // The Snip's clock starts as it notices the party (as its `initialDelay` would); its state
  // waits for that, or for a phase that makes it.
  const m3 = world.internal.m3 ?? (c.engaged ? ensureM3(world) : undefined);
  if (!m3) return;
  if (c.engaged) m3.nextSnipAt ??= world.time + attackDef(SNIP).initialDelay;
  if (c.phase === 2) {
    if (due(world, m3.nextStealAt) && beginSteal(world, boss, m3)) return;
    if (due(world, m3.nextUnravelAt) && !world.field.unravel) {
      if (beginAttack(world, boss, attackDef(UNRAVEL), null)) {
        m3.nextUnravelAt =
          world.time + (enraged(world) ? UNRAVEL_EVERY_ENRAGED : attackDef(UNRAVEL).cooldown);
        return;
      }
    }
  } else if (c.phase >= 3) {
    if (m3.champion === undefined && due(world, m3.nextChampionAt) && beginWeave(world, boss, m3))
      return;
    if (championOf(world, m3) && due(world, m3.nextMirrorAt)) {
      if (beginAttack(world, boss, attackDef(MIRROR_WARD), null)) {
        m3.nextMirrorAt =
          world.time + (enraged(world) ? MIRROR_EVERY_ENRAGED : attackDef(MIRROR_WARD).cooldown);
        phaseDecreeAgain(world, boss, MIRROR_WARD);
        return;
      }
    }
  }
  if (due(world, m3.nextSnipAt) && beginAttack(world, boss, attackDef(SNIP), null))
    m3.nextSnipAt = world.time + snipEvery(world, boss);
}

function due(world: World, at: number | undefined): boolean {
  return at !== undefined && world.time >= at - 1e-9;
}

/** The Snip's cadence: its cooldown, slower in phase 3, quickest enraged. */
function snipEvery(world: World, boss: Entity): number {
  if (enraged(world)) return SNIP_EVERY_ENRAGED;
  return boss.enemy!.phase >= 3 ? SNIP_EVERY_LATE : attackDef(SNIP).cooldown;
}

function unweaverEnter(world: World, boss: Entity, phase: number): void {
  const m3 = ensureM3(world);
  if (phase === 2) {
    // Steal Verse and Unravel begin; the Snip goes on.
    m3.nextStealAt = shiftEnd(world) + STEAL_FIRST;
    m3.nextUnravelAt = shiftEnd(world) + UNRAVEL_FIRST;
  } else if (phase === 3) {
    // Mirror Weave: Unravel stops and the stolen verse comes back at once...
    returnVerse(world, 'phase');
    closeUnravel(world);
    delete m3.nextStealAt;
    delete m3.nextUnravelAt;
    // ...and the champion is woven now, through the shift (as Vharun casts his Bloodmoon).
    m3.nextMirrorAt = shiftEnd(world) + MIRROR_FIRST;
    m3.nextChampionAt = world.time;
    beginWeave(world, boss, m3);
  }
}

/** A `script` cast landed: Steal Verse, Unravel or the Mirror Ward. */
function unweaverResolved(world: World, boss: Entity, t: Telegraph): void {
  if (t.attackId === STEAL) stealVerse(world, boss);
  else if (t.attackId === UNRAVEL) openUnravel(world, boss);
  else if (t.attackId === MIRROR_WARD) mirrorWard(world, boss);
}

function unweaverNext(world: World, boss: Entity): ScriptedNext | null {
  const m3 = world.internal.m3;
  if (!m3) return null;
  const c = boss.enemy!;
  const at = (attackId: string, when: number | undefined): ScriptedNext | null =>
    when === undefined ? null : { attackId, at: when };
  const snip = at(SNIP, m3.nextSnipAt);
  if (c.phase === 2)
    return soonest([
      stealTarget(world) ? at(STEAL, m3.nextStealAt) : null,
      world.field.unravel ? null : at(UNRAVEL, m3.nextUnravelAt),
      snip,
    ]);
  if (c.phase >= 3)
    return soonest([
      m3.champion === undefined ? at(WEAVE, m3.nextChampionAt) : null,
      championOf(world, m3) ? at(MIRROR_WARD, m3.nextMirrorAt) : null,
      snip,
    ]);
  return snip;
}

/** An add fell: the Stolen Verse pours its aura back; the champion is re-woven later. */
function unweaverAddDeath(world: World, _boss: Entity, add: Entity): void {
  const stolen = world.field.stolen;
  if (stolen && stolen.add === add.id) returnVerse(world, 'killed');
  if (add.enemy?.defId === CHAMPION) {
    const m3 = ensureM3(world);
    delete m3.champion;
    m3.nextChampionAt = world.time + attackDef(WEAVE).cooldown;
  }
}

// ── Steal Verse ──────────────────────────────────────────────────────────────────────

/**
 * The aura Steal Verse takes: the field song's first, else the beam song's; null with neither
 * (or with no Weaver, in the 'without you' re-run). A content read: no draw.
 */
function stealTarget(world: World): { chord: number; aura: number; id: string } | null {
  if (world.config.absent) return null;
  for (const role of ['field', 'beam'] as const) {
    const chord = world.field.chords.find((c) => c.role === role && c.auras.length > 0);
    if (chord) return { chord: chord.index, aura: 0, id: chord.auras[0]! };
  }
  return null;
}

function auraName(world: World, id: string): string {
  return world.content.auras.find((a) => a.id === id)?.name ?? id;
}

/**
 * Begins Steal Verse, announcing the Decree that names the aura it will take (in place of the
 * attack's unnamed one). With no aura to take the cast is skipped, and tried again a cooldown on.
 */
function beginSteal(world: World, boss: Entity, m3: M3): boolean {
  const target = stealTarget(world);
  const steal = attackDef(STEAL);
  if (!target || world.field.stolen) {
    m3.nextStealAt = world.time + steal.cooldown;
    return false;
  }
  const { decree: _unnamed, ...quiet } = steal;
  if (!beginAttack(world, boss, quiet as AttackDef, null)) return false;
  // The next one is due 40 s after this verse comes back (`returnVerse`).
  delete m3.nextStealAt;
  announce(world, boss, steal.name, stealVerseDecree(auraName(world, target.id)), steal.answers);
  return true;
}

/** Steal Verse lands: the aura is muted and the Stolen Verse runs with it. */
function stealVerse(world: World, boss: Entity): void {
  const target = stealTarget(world);
  if (!target || world.field.stolen) {
    if (boss.enemy!.phase === 2)
      ensureM3(world).nextStealAt = world.time + attackDef(STEAL).cooldown;
    return;
  }
  const p = { x: 0, z: 0 };
  ringPoint(world, boss.x, boss.z, 3 + boss.radius, 0, 1, p);
  const add = spawnEnemy(world, STOLEN_VERSE, p.x, p.z);
  const until = world.time + STEAL_ESCAPE;
  world.field.stolen = { chord: target.chord, aura: target.aura, add: add.id, until };
  world.events.push({ type: 'verseStolen', tick: world.tick, aura: target.id, add: add.id, until });
}

/**
 * It fell: Unravel closes and the stolen verse comes back (the Verse goes) at once, so neither
 * outlives it where no fight's end follows to clear them (a sandbox's encounter never ends).
 */
function unweaverDeath(world: World): void {
  closeUnravel(world);
  returnVerse(world, 'boss');
}

/**
 * The stolen aura comes back: the Verse fell, it escaped (its time ran out: it goes), phase 3
 * began or the Unweaver fell (it goes too). In phase 2 the next theft is due a cooldown later.
 */
function returnVerse(world: World, reason: 'killed' | 'expired' | 'phase' | 'boss'): void {
  const stolen = world.field.stolen;
  if (!stolen) return;
  const aura = world.field.chords.find((c) => c.index === stolen.chord)?.auras[stolen.aura] ?? '';
  delete world.field.stolen;
  world.events.push({ type: 'verseReturned', tick: world.tick, aura, reason });
  const bossId = world.encounter.bossId;
  const boss = bossId === null ? undefined : world.entities.get(bossId);
  if ((reason === 'killed' || reason === 'expired') && boss?.enemy?.phase === 2)
    ensureM3(world).nextStealAt = world.time + attackDef(STEAL).cooldown;
  if (reason === 'killed') return;
  const add = world.entities.get(stolen.add);
  if (add?.enemy && add.health && !add.health.dead) killEnemy(world, add, null);
}

// ── Unravel ──────────────────────────────────────────────────────────────────────────

/** Unravel lands: for `UNRAVEL_TIME` s Mend wounds (thread.ts). Nothing without a Weaver. */
function openUnravel(world: World, boss: Entity): void {
  if (world.config.absent) return;
  const until = world.time + UNRAVEL_TIME;
  world.field.unravel = { until, source: boss.id, acc: 0, tickIn: DOT_TICK };
  world.events.push({ type: 'unravelled', tick: world.tick, active: true, until });
}

function closeUnravel(world: World): void {
  if (!world.field.unravel) return;
  delete world.field.unravel;
  world.events.push({ type: 'unravelled', tick: world.tick, active: false, until: world.time });
}

// ── Mirror Weave ─────────────────────────────────────────────────────────────────────

/**
 * Weaves the champion (a summon). Until it stands, `nextChampionAt` is pushed a cooldown on, so
 * a weave that never lands is tried again then; the champion's arrival clears it.
 */
function beginWeave(world: World, boss: Entity, m3: M3): boolean {
  const weave = attackDef(WEAVE);
  if (!beginAttack(world, boss, weave, null)) return false;
  m3.nextChampionAt = world.time + weave.cooldown;
  return true;
}

/** The champion while it stands (null otherwise). */
function championOf(world: World, m3: M3): Entity | null {
  const id = m3.champion;
  const e = id === undefined ? undefined : world.entities.get(id);
  return e?.enemy && isActive(e) ? e : null;
}

/**
 * Phase 3, every tick: a newly woven champion is taken up, and the boss's Thread holds it:
 * Emboldened (×1.25 damage) kept ahead while the boss lives, and a heal every whole second.
 */
function holdChampion(world: World, boss: Entity): void {
  const m3 = ensureM3(world);
  let champ = championOf(world, m3);
  const fresh = !champ && m3.champion === undefined;
  if (fresh) {
    for (const e of world.entities.list())
      if (e.enemy?.defId === CHAMPION && isActive(e)) {
        champ = e;
        break;
      }
    if (!champ) return;
    m3.champion = champ.id;
    delete m3.nextChampionAt;
  }
  if (!champ) return;
  champ.enemy!.emboldenedUntil = world.time + THREAD_HOLD;
  const dt = SIM_DT * world.timeScale;
  const pulse = Math.floor(world.time + 1e-9) > Math.floor(world.time - dt + 1e-9);
  if (fresh || pulse) addStatus(world, champ, 'emboldened', THREAD_HOLD, boss.id);
  if (!pulse) return;
  const h = champ.health!;
  const healed = Math.min(h.maxHp - h.hp, h.maxHp * THREAD_HEAL);
  if (healed <= 0) return;
  h.hp += healed;
  world.events.push({
    type: 'healApplied',
    tick: world.tick,
    target: champ.id,
    source: boss.id,
    amount: healed,
    overheal: 0,
    via: 'other',
  });
}

/** The Mirror Ward lands (it wasn't interrupted): the champion is shielded. */
function mirrorWard(world: World, _boss: Entity): void {
  const m3 = world.internal.m3;
  const champ = m3 ? championOf(world, m3) : null;
  if (!champ) return;
  const amount = champ.health!.maxHp * MIRROR_WARD_PCT;
  if (!addShield(world, champ, 'mirror', amount, MIRROR_WARD_TIME, false)) return;
  world.events.push({ type: 'mirrorWard', tick: world.tick, enemy: champ.id, amount });
}
