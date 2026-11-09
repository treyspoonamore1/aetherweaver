/**
 * The Conductor (docs/phase-5f.md): Duets and Trios, the Grand Finale, and the path's Marcato,
 * A Tempo, Reprise, Ensemble, Spotlight and Triad. Everything here runs only on a Conductor run:
 * `world.field.conducting` exists only then (world.ts), and every caller is guarded by it.
 *
 * The pure helpers at the top take the read-only `WorldState` (which `World` satisfies), so the
 * sim, the HUD, render, audio and the bots read one rule. None of them draws RNG.
 */
import { CONTENT } from '../../content';
import { BAR_SECONDS } from '../constants';
import { triadHolds } from '../combat/resonance';
import type {
  ConductingField,
  Entity,
  EntityId,
  LedgerConducting,
  ReadonlyEntity,
  WorldState,
} from '../state';
import type { World } from '../world';
import { startSolo } from './solos';
import { endCrescendo } from './weaver';

export { triadHolds };

// ── Pure helpers (the sim, views and bots) ────────────────────────────────────────────────

/** Float slack for sim-time comparisons (sim time is a sum of tick lengths). */
const EPS = 1e-9;

/**
 * The bar around `time`: downbeats fall at whole multiples of `bar` from sim time 0. `prev` and
 * `next` bracket `time` (`prev` ≤ `time` < `next`), `nearest` is the closer of the two, and
 * `phase` runs 0 to 1 through the bar.
 */
export function beatAt(
  time: number,
  bar: number,
): { prev: number; next: number; nearest: number; phase: number } {
  const k = Math.floor(time / bar);
  const prev = k * bar;
  const next = prev + bar;
  const nearest = time - prev <= next - time ? prev : next;
  const phase = Math.min(1, Math.max(0, (time - prev) / bar));
  return { prev, next, nearest, phase };
}

/** A Tempo is on the path and the sim's time is within its window of a downbeat. */
export function onBeat(state: WorldState): boolean {
  const within = state.mods.beatWindow;
  if (!(within > 0)) return false;
  return Math.abs(state.time - beatAt(state.time, BAR_SECONDS).nearest) <= within + EPS;
}

/**
 * What a Cue costs now: Silent Cues' surcharge alone on the downbeat (A Tempo), else the
 * fight's off-beat cost (`dissonance.cueCost`: the content's 25, or the Conductor's 15, plus the
 * surcharge). Without the Conductor that is exactly today's `cueCost + cueCostBonus`.
 */
export function cueCostNow(state: WorldState): number {
  return onBeat(state) ? state.mods.cueCostBonus : state.dissonance.cueCost;
}

/** What the Crescendo costs this fight: 100, or Maestro's 75. */
export function crescendoCostOf(state: WorldState): number {
  return state.calling?.conducting?.crescendoCost ?? CONTENT.resonance.crescendoCost;
}

/**
 * The open chain, if a Cue now could still join it: within the window of its last Cue
 * (≤ `chainWindow` s, measured in sim time) and fewer than three long.
 */
export function openChain(state: WorldState): { heroes: readonly EntityId[]; at: number } | null {
  const chain = state.field.conducting?.chain;
  if (!chain || chain.heroes.length >= 3) return null;
  if (state.time - chain.at > state.mods.chainWindow + EPS) return null;
  return chain;
}

/**
 * What a Cue of this hero would be now (null without the Conductor): its place in the chain
 * (1 starts one, 2 a Duet, 3 a Trio), its power, its cost and whether it falls on the beat. A
 * hero already in the chain starts a new one. `cue()` uses it, so the HUD's preview is the rule.
 */
export function nextCue(
  state: WorldState,
  heroId: EntityId,
): { link: 1 | 2 | 3; power: number; cost: number; onBeat: boolean } | null {
  if (!state.field.conducting) return null;
  const chain = openChain(state);
  const link: 1 | 2 | 3 =
    chain && !chain.heroes.includes(heroId) ? (chain.heroes.length === 1 ? 2 : 3) : 1;
  const m = state.mods;
  const power = link === 3 ? m.trioPower : link === 2 ? m.duetPower : 1;
  return { link, power, cost: cueCostNow(state), onBeat: onBeat(state) };
}

/** The power of this hero's running Solo (a Duet's, a Trio's, a Finale turn's); exactly 1 without. */
export function cuePowerOf(state: WorldState, heroId: EntityId): number {
  const solos = state.field.conducting?.solos;
  if (!solos) return 1;
  for (const s of solos) if (s.hero === heroId) return s.power;
  return 1;
}

/** Spotlight's Empower potency on this hero while their Cued Solo lasts (0 without). */
export function spotlit(state: WorldState, heroId: EntityId): number {
  const solos = state.field.conducting?.solos;
  if (!solos) return 0;
  for (const s of solos) if (s.hero === heroId) return s.spotlight ? state.mods.spotlightMult : 0;
  return 0;
}

/** Why a hero can't take a Finale turn now: lost (the turn is dropped) or waiting (kept). */
export type FinaleTurnBlock = 'down' | 'possessed' | 'stilled' | 'wait' | null;
type TurnBlock = FinaleTurnBlock;

function statusOn(e: ReadonlyEntity, id: string): boolean {
  const statuses = e.health?.statuses;
  if (!statuses) return false;
  for (const s of statuses) if (s.id === id) return true;
  return false;
}

/**
 * Whether a hero can take a Finale turn now (docs/phase-5f.md, "Grand Finale"): free means able
 * to take a Cue, charge aside. Downed, dead, possessed or stilled loses the turn; mid-Solo, held
 * by Fermata or being Reeled waits. Stunned heroes are free, as for a Cue.
 */
function turnBlock(e: ReadonlyEntity | undefined): TurnBlock {
  const h = e?.hero;
  const health = e?.health;
  if (!e || !h || !health || health.dead || health.downed) return 'down';
  if (statusOn(e, 'possessed')) return 'possessed';
  if (statusOn(e, 'stilled')) return 'stilled';
  if (h.soloActive > 0 || h.hold !== null || h.reel !== null) return 'wait';
  return null;
}

/**
 * `turnBlock` for the views: what stops this hero taking a Finale turn now. `'down'`,
 * `'possessed'` and `'stilled'` lose the turn at the next due tick; `'wait'` keeps it; null is
 * free. The same rule the Finale itself runs.
 */
export function finaleTurnBlock(state: WorldState, heroId: EntityId): FinaleTurnBlock {
  return turnBlock(state.entities.get(heroId));
}

/** Whether Marcato's hold is on this hero now (false without Marcato). */
export function marcatoOn(state: WorldState, heroId: EntityId): boolean {
  const held = state.field.conducting?.marcato;
  return !!held && state.time < held.until - EPS && held.heroes.includes(heroId);
}

/**
 * Seconds until a Directive would fire Marcato again: 0 when it's ready, null without Marcato.
 * The rule `marcato()` applies.
 */
export function marcatoReadyIn(state: WorldState): number | null {
  const c = state.field.conducting;
  if (!c || !(state.mods.marcatoPct > 0)) return null;
  if (!c.marcato || state.time + EPS >= c.marcato.readyAt) return 0;
  return c.marcato.readyAt - state.time;
}

/** Ensemble's bonus now: 5% for each hero in the streak, up to 15% (0 without Ensemble). */
export function ensembleBonus(state: WorldState): number {
  const streak = state.field.conducting?.streak;
  if (!streak || streak.length === 0) return 0;
  return Math.min(state.mods.ensembleMax, state.mods.ensemblePct * streak.length);
}

/** The power of the Finale's next Solo: the ramp once for every Solo it has played. */
function rampAfter(ramp: number, fired: number): number {
  // Repeated products, not `**`: exponentiation is implementation-approximated in JS engines.
  let p = 1;
  for (let i = 0; i < fired; i++) p *= ramp;
  return p;
}

/**
 * The Grand Finale while it plays (null otherwise): the queue left, the hero the next turn goes
 * to as the sim will pick it (null if every hero left is waiting or will lose the turn), the
 * next Solo's power and the turns played.
 */
export function finaleView(
  state: WorldState,
): { queue: EntityId[]; next: EntityId | null; power: number; fired: number } | null {
  const finale = state.field.conducting?.finale;
  if (!finale) return null;
  let next: EntityId | null = null;
  for (const id of finale.queue) {
    if (turnBlock(state.entities.get(id)) === null) {
      next = id;
      break;
    }
  }
  return {
    queue: [...finale.queue],
    next,
    power: rampAfter(state.mods.finaleRamp, finale.fired),
    fired: finale.fired,
  };
}

// ── The fight's state (world.ts) ──────────────────────────────────────────────────────────

/** `field.conducting` for a new Conductor fight; Ensemble's streak only with Ensemble. */
export function newConductingField(ensemble: boolean): ConductingField {
  return { solos: [], ...(ensemble ? { streak: [] } : {}) };
}

export function newLedgerConducting(): LedgerConducting {
  return {
    duets: 0,
    trios: 0,
    freeCues: 0,
    saved: 0,
    finales: 0,
    finaleSolos: 0,
    finaleLost: 0,
    reprised: 0,
    marcatos: 0,
  };
}

// ── The sim's side (each called behind `if (world.field.conducting)`) ───────────────────

function standing(e: Entity | undefined): e is Entity {
  return !!e?.health && !e.health.dead && !e.health.downed;
}

/** Sets (or clears) a hero's running-Solo entry. */
function setEntry(
  c: ConductingField,
  hero: EntityId,
  entry: ConductingField['solos'][number] | null,
): void {
  const i = c.solos.findIndex((s) => s.hero === hero);
  if (i >= 0) c.solos.splice(i, 1);
  if (entry) c.solos.push(entry);
}

/**
 * techniques.ts `cue()`, after `cued` and before `startSolo`: the Cue joins or starts the chain,
 * the Solo's power (and Spotlight) is recorded for its sites, Ensemble's streak moves, and the
 * fight's tallies grow. `cost` is what the Cue was paid.
 */
export function conductCue(world: World, hero: Entity, cost: number): void {
  const c = world.field.conducting!;
  const next = nextCue(world, hero.id)!;
  const m = world.mods;
  if (next.link === 1) c.chain = { heroes: [hero.id], at: world.time };
  else {
    c.chain!.heroes.push(hero.id);
    c.chain!.at = world.time;
  }
  const spotlight = m.spotlightMult > 0;
  setEntry(
    c,
    hero.id,
    next.power !== 1 || spotlight
      ? { hero: hero.id, power: next.power, ...(spotlight ? { spotlight: true as const } : {}) }
      : null,
  );
  if (c.streak) {
    if (c.streak.includes(hero.id)) c.streak = [hero.id];
    else c.streak.push(hero.id);
    world.events.push({
      type: 'ensemble',
      tick: world.tick,
      heroes: [...c.streak],
      bonus: ensembleBonus(world),
    });
  }
  const l = world.ledger.conducting!;
  if (next.link === 2) l.duets++;
  if (next.link === 3) l.trios++;
  // Free only if it cost nothing: Silent Cues' surcharge still applies on the beat.
  if (next.onBeat && cost === 0) l.freeCues++;
  l.saved += world.content.resonance.cueCost + m.cueCostBonus - cost;
  world.events.push({
    type: 'cueChained',
    tick: world.tick,
    hero: hero.id,
    link: next.link,
    power: next.power,
    cost,
    onBeat: next.onBeat,
    // A Trio closes the chain: no Cue can join it, so its time to join ends now.
    until: next.link === 3 ? world.time : world.time + m.chainWindow,
  });
}

/**
 * techniques.ts `cue()`, after Canon: the tick a Trio's Cue lands, Reprise charges every hero
 * standing (a hero mid-Solo banks it), once a chain.
 */
export function reprise(world: World): void {
  const c = world.field.conducting!;
  const charge = world.mods.repriseCharge;
  const chain = c.chain;
  if (!(charge > 0) || !chain || chain.heroes.length < 3 || chain.reprised) return;
  chain.reprised = true;
  const heroes: EntityId[] = [];
  let given = 0;
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (!standing(e) || !e.hero) continue;
    const before = e.hero.solo;
    e.hero.solo = Math.min(100, before + charge);
    given += e.hero.solo - before;
    heroes.push(id);
    if (before < 100 && e.hero.solo >= 100 && e.hero.soloActive <= 0)
      world.events.push({ type: 'soloReady', tick: world.tick, hero: id });
  }
  world.ledger.conducting!.reprised += given;
  world.events.push({ type: 'reprised', tick: world.tick, charge, heroes });
}

/** commands.ts `applyDirective`, after the acknowledgements: Marcato, if it's ready. */
export function marcato(world: World): void {
  const c = world.field.conducting!;
  const m = world.mods;
  if (!(m.marcatoPct > 0)) return;
  if (c.marcato && world.time + EPS < c.marcato.readyAt) return;
  const heroes = world.party.filter((id) => standing(world.entities.get(id)));
  if (heroes.length === 0) return;
  const until = world.time + m.marcatoSeconds;
  const readyAt = world.time + m.marcatoCooldown;
  c.marcato = { heroes, until, readyAt };
  world.ledger.conducting!.marcatos++;
  world.events.push({ type: 'marcato', tick: world.tick, heroes: [...heroes], until, readyAt });
}

/**
 * health.ts `dealDamage`: what the Conductor multiplies a hero's or a summon's hit on an enemy
 * by. The Cue bonus (`cuePower`, carried by the hit) times the Calling's group: Marcato and
 * Ensemble added together, on the heroes' own hits only.
 */
export function conductingMult(world: World, source: Entity, cuePower: number | undefined): number {
  let more = 0;
  if (source.hero) {
    if (marcatoOn(world, source.id)) more += world.mods.marcatoPct;
    more += ensembleBonus(world);
  }
  return (cuePower ?? 1) * (1 + more);
}

/** No `cuePower`: what a hit at power 1 spreads (no key). */
export const NO_CUE: { readonly cuePower?: number } = Object.freeze({});

/** The `cuePower` a Solo's hit carries: absent at power 1, so no hit gains the key. */
export function cueHit(world: World, heroId: EntityId): { readonly cuePower?: number } {
  const power = cuePowerOf(world, heroId);
  return power !== 1 ? { cuePower: power } : NO_CUE;
}

/** solos.ts `finishSolo`, last: the Solo's power and Spotlight end with it. */
export function soloDone(world: World, hero: Entity): void {
  setEntry(world.field.conducting!, hero.id, null);
  // A full charge banked while it played (the Finale's end, Reprise) is ready now.
  if (hero.hero && hero.hero.solo >= 100)
    world.events.push({ type: 'soloReady', tick: world.tick, hero: hero.id });
}

/** techniques.ts `crescendo()`: the Grand Finale begins (its first turn is taken this tick). */
export function startFinale(world: World): void {
  const c = world.field.conducting!;
  const queue: EntityId[] = [];
  for (let pass = 0; pass < world.mods.finaleTurns; pass++) queue.push(...world.party);
  c.finale = { queue, fired: 0, nextAt: world.time, lost: 0 };
  world.ledger.conducting!.finales++;
}

/** A Finale turn is lost: dropped from the queue. */
function loseTurn(
  world: World,
  index: number,
  reason: 'down' | 'possessed' | 'stilled' | 'time',
): void {
  const finale = world.field.conducting!.finale!;
  const [hero] = finale.queue.splice(index, 1);
  finale.lost++;
  world.ledger.conducting!.finaleLost++;
  world.events.push({ type: 'finaleTurnLost', tick: world.tick, hero: hero!, reason });
}

/** One Finale turn, if one is due: lost heroes dropped, the first free hero plays. */
function finaleTurn(world: World): void {
  const c = world.field.conducting!;
  const finale = c.finale!;
  if (world.time + EPS < finale.nextAt) return;
  let i = 0;
  while (i < finale.queue.length) {
    const id = finale.queue[i]!;
    const e = world.entities.get(id);
    const block = turnBlock(e);
    if (block === 'wait') {
      i++;
      continue;
    }
    if (block !== null) {
      loseTurn(world, i, block);
      continue;
    }
    const hero = e!;
    // Its pass: a hero with two turns left is on their first (Maestro's queue holds each twice).
    let left = 0;
    for (const q of finale.queue) if (q === id) left++;
    const pass = (world.mods.finaleTurns - left + 1 === 2 ? 2 : 1) as 1 | 2;
    finale.queue.splice(i, 1);
    const power = rampAfter(world.mods.finaleRamp, finale.fired);
    setEntry(c, id, { hero: id, power, finale: true });
    finale.fired++;
    finale.nextAt = world.time + world.mods.finaleGap;
    world.ledger.conducting!.finaleSolos++;
    startSolo(world, hero, true);
    world.events.push({
      type: 'finaleTurn',
      tick: world.tick,
      hero: id,
      turn: finale.fired,
      power,
      pass,
    });
    break;
  }
  if (finale.queue.length === 0) {
    weaverCrescendoOver(world);
    endCrescendo(world);
  }
}

function weaverCrescendoOver(world: World): void {
  const w = world.entities.get(world.weaverId)?.weaver;
  if (w) w.crescendo = 0;
}

/**
 * weaver.ts `endCrescendo`, first: the Finale ends (early, its queue played, or at its wait).
 * Turns still waiting are lost; every hero who isn't dead has a full Solo (a hero mid-Solo
 * carries it, ready when that Solo ends); `finaleEnded` before `crescendoEnd`.
 * Once the encounter is won or lost the Finale just stops: it goes with no event, no lost turn
 * and no Solo fill (the Crescendo itself runs out as every Calling's does, with `crescendoEnd`).
 */
export function finishFinale(world: World): void {
  const c = world.field.conducting!;
  if (encounterOver(world)) {
    delete c.finale;
    return;
  }
  const finale = c.finale!;
  while (finale.queue.length > 0) loseTurn(world, 0, 'time');
  for (const id of world.party) {
    const e = world.entities.get(id);
    const h = e?.hero;
    if (!h || !e.health || e.health.dead) continue;
    const before = h.solo;
    h.solo = 100;
    // A downed hero keeps the charge but isn't ready to play it.
    if (before < 100 && h.soloActive <= 0 && !e.health.downed)
      world.events.push({ type: 'soloReady', tick: world.tick, hero: id });
  }
  world.events.push({
    type: 'finaleEnded',
    tick: world.tick,
    fired: finale.fired,
    lost: finale.lost,
  });
  delete c.finale;
}

function encounterOver(world: World): boolean {
  const status = world.encounter.status;
  return status === 'victory' || status === 'defeat';
}

/**
 * api.ts, right after `updateWeaver`: the chain's window closes, Marcato's hold ends, Triad
 * holds or lets go, stale Solo entries go, and at most one Finale turn plays.
 * A Finale still playing when the encounter is won or lost is dropped silently (`finishFinale`).
 */
export function updateConducting(world: World): void {
  const c = world.field.conducting;
  if (!c) return;
  const m = world.mods;
  if (c.chain && world.time - c.chain.at > m.chainWindow + EPS) delete c.chain;
  if (c.marcato && c.marcato.heroes.length > 0 && world.time >= c.marcato.until - EPS)
    c.marcato.heroes = [];
  if (m.triadCount > 0) {
    const holds = triadHolds(world);
    if (holds !== (c.triad === true)) {
      if (holds) c.triad = true;
      else delete c.triad;
      world.events.push({ type: 'triad', tick: world.tick, on: holds });
    }
  }
  // A Solo cut short by a down never reached `finishSolo`: its entry goes with it.
  for (let i = c.solos.length - 1; i >= 0; i--) {
    const e = world.entities.get(c.solos[i]!.hero);
    if (!e?.hero || e.hero.soloActive <= 0) c.solos.splice(i, 1);
  }
  if (c.finale) {
    if (encounterOver(world)) finishFinale(world);
    else finaleTurn(world);
  }
}
