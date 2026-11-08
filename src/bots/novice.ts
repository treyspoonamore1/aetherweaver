/**
 * Novice bot: a first-time player who understands the basics. Threads whoever looks hurt
 * (with a lag), stays near the party, Wards low heroes without timing, Chimes marks when
 * they notice them, never Reels (though with the Chronomancer they may Rewind a hero who just
 * went down), and Cues Solos when they happen to be ready. Movement II (docs/phase-5a.md): they
 * sometimes Chime a hero bleeding at 5+ stacks, Ward or (rarely) Reel a pinned hero, and Scatter
 * for a Blood Pact. Each of those draws only while its mechanic is on the field, so Movement I
 * sees exactly the draws it always did. Movement III (docs/phase-5c.md): now and then she Chimes
 * a possessed or stitched hero or Doom at 4+, steps out of a Null rune once a cast fizzles in
 * it, Rallies in an Inhale's tell and Empowers through Unravel; each draws only while its
 * mechanic is up. With only stationary enemies left (a Void Maw out past the heroes' sight) and
 * nobody fighting, she sooner or later sees them stand idle and Focuses the nearest one: a
 * Maw never comes to the party, so without it the fight never ends. While one of the Unweaver's
 * Spindles stands she now and then Focuses the nearest (its Decree says to; the heroes keep to the
 * boss). Her heal-the-lowest reflex is what the Shears, Unravel and the Mimic punish.
 * With Seren or Oro (docs/phase-5e.md, `NOVICE_ROSTER`) she now and then Wards Seren in a fight,
 * Focuses to wake a tending Oro, and Rallies a Sapling back into the field; each draws only with
 * its hero in the party, just before the Cue's draw. She keeps off a duelling Seren as off Brann.
 */
import { CONTENT } from '../content';
import { Rng } from '../sim/core/rng';
import { rewindCanRevive } from '../sim/systems/rewind';
import { weaverSilenced } from '../sim';
import type { Command, ReadonlyEntity, ThreadMode, WorldState } from '../sim';
import type { Bot } from './types';
import {
  BLEED_CHIME_AT,
  Intent,
  caller,
  damageOf,
  modeCommands,
  threadingTo,
  affords,
  centroid,
  dist,
  enemiesOf,
  heldHero,
  partyOf,
  plantCommand,
  plantSpot,
  plantedChord,
  rewindSample,
  statusRemaining,
  threatsOn,
  weaverOf,
  isPact,
  isPinned,
  statusStacks,
  DOOM_CHIME_AT,
  doomStacks,
  inhaleTell,
  isPossessed,
  isStitched,
  runeEscape,
  unravelUp,
  stationary,
  idleParty,
  StallWatch,
  nearestStationary,
  spindlesUp,
  cueOf,
  SilenceWatch,
  fortissimoLive,
  isCadence,
  isStilled,
  silenceOf,
  duelOf,
  groveOf,
  rallyBringsHome,
  type HeroView,
} from './common';
import { MEASURE } from '../content/crucibleIds';

/** Movement III's chances (docs/phase-5c.md, "Bots and harness"), drawn only with each up. */
const NOVICE_M3 = {
  /** Chime a possessed or stitched hero. */
  free: 0.5,
  /** Chime Doom at `DOOM_CHIME_AT`+ stacks (or its mark). */
  doom: 0.5,
  /** Step out of a Null rune after a cast fizzled in it. */
  leaveRune: 0.3,
  /** Rally in an Inhale's tell. */
  inhaleRally: 0.3,
  /** Switch to Empower under Unravel. */
  unravelEmpower: 0.4,
  /** Focus a stationary enemy (a Void Maw) left standing out of the idle heroes' sight. */
  stationaryFocus: 0.15,
  /** Focus a Spindle while one stands and none is Focused (the Unweaver's Decree: 'Focus them'). */
  spindleFocus: 0.09,
} as const;

/**
 * The Finale's chances (docs/phase-5d.md, "Bots and harness"), each drawn only while its
 * mechanic is up, after every other draw and before the Cue's.
 */
export const NOVICE_M4 = {
  /** Crescendo during Fortissimo Silence, with a full song (about 3 decisions a second). */
  fortissimoCrescendo: 0.35,
  /** Focus the Conductor's Cued soloist. */
  cueFocus: 0.1,
  /** Chime a Rest's Dirge in its last 1.2 s (in the silence it replaces her early Dirge reflex). */
  silenceChime: 0.45,
  /** Ward the target of a Measure or a Cadence (untimed: a Perfect is luck). */
  silenceWard: 0.5,
  /** Reel the target of a Cadence in its last 0.8 s. */
  silenceReel: 0.25,
  /** Cue a ready Solo in the last burn (after Reignite or the Coda). */
  reigniteCue: 0.5,
} as const;
/** A Finale draw `NoviceOptions.skip` can leave off (tools/verbs.ts `--bot novice`). */
export type NoviceM4Rule = keyof typeof NOVICE_M4;
/** The Novice's Finale rules, in `NOVICE_M4`'s order: the ablation's rows. */
export const NOVICE_M4_RULES = Object.keys(NOVICE_M4) as NoviceM4Rule[];

/**
 * Seren's and Oro's chances (docs/phase-5e.md, "Novice"), each drawn only with that hero in the
 * party and its moment up, after every other draw and immediately before the Cue's.
 */
export const NOVICE_ROSTER = {
  /** Ward Seren while she is engaged (an enemy on her) and unwarded. */
  serenWard: 0.3,
  /** Focus the enemy nearest the Weaver while Oro tends with enemies near. */
  oroFocus: 0.15,
  /** Rally while one of Oro's Saplings stands outside the field. */
  saplingRally: 0.2,
} as const;
/** A Seren or Oro draw `NoviceOptions.skip` can leave off (tools/verbs.ts `--bot novice`). */
export type NoviceRosterRule = keyof typeof NOVICE_ROSTER;
/** The Novice's Seren and Oro rules, in `NOVICE_ROSTER`'s order: the ablation's rows. */
export const NOVICE_ROSTER_RULES = Object.keys(NOVICE_ROSTER) as NoviceRosterRule[];
/** `oroFocus`: an enemy this near Oro or the Weaver (m) is near. */
const ORO_NEAR = 10;

/** The Novice's options (all optional; absent, she plays as she always has). */
export interface NoviceOptions {
  /**
   * Verb ablation (tools/verbs.ts `--bot novice`, docs/phase-5d.md "Tuning order" 2): Finale
   * draws to leave off. A rule left off isn't drawn at all, so the draws after it shift.
   */
  skip?: ReadonlySet<NoviceM4Rule | NoviceRosterRule>;
}

/** `silenceChime`: a Rest's Dirge with this little left; `silenceReel`: a Cadence's. */
const REST_CHIME_AT = 1.2;
/** The roles that leave the group for the melee: `noviceAnchor` keeps her off them. */
const CHARGERS: ReadonlySet<string> = new Set(['berserker', 'duelist']);
const CADENCE_REEL_AT = 0.8;

export class NoviceBot implements Bot {
  readonly name = 'novice';
  private readonly intent = new Intent();
  private readonly rng: Rng;
  private nextDecision = 0;
  private rallyAllowed = 0;
  /** Movement III: a technique of hers fizzled in a Null rune last decision; she's leaving it. */
  private fizzled = false;
  private leaving = false;
  /** Movement III: times a party stalled on a stationary enemy out of reach. */
  private readonly stall = new StallWatch();
  /** The Finale: whether this fight's Grand Silence has been seen (the last burn waits on it). */
  private readonly silenceWatch = new SilenceWatch();

  constructor(
    seed: number,
    private readonly opts: NoviceOptions = {},
  ) {
    this.rng = new Rng(seed ^ 0x0b1e);
  }

  /** A Finale (or Seren and Oro) draw is played (not left off by the ablation). */
  private on(rule: NoviceM4Rule | NoviceRosterRule): boolean {
    return this.opts.skip?.has(rule) !== true;
  }

  decide(state: WorldState): Command[] {
    const out: Command[] = [];
    // The Finale: watched every tick, so a silence between decisions is still seen (no draws).
    this.silenceWatch.observe(state);
    if (state.tick < this.nextDecision) return out;
    // Reaction time: 250–450 ms between decisions.
    this.nextDecision = state.tick + 15 + this.rng.int(12);
    const w = weaverOf(state);
    const wc = w.weaver!;
    if (state.encounter.status !== 'fighting' && state.encounter.status !== 'intro') return out;
    if (w.health!.downed) return out;
    const party = partyOf(state);
    const all = partyOf(state, true);
    const tech = CONTENT.techniques;
    const now = state.time;

    const enemies = enemiesOf(state);
    // The Finale's Grand Silence (docs/phase-5d.md): null outside it.
    const silence = silenceOf(state);
    // Movement III: a cast fizzled in a Null rune, and now and then she notices and steps out.
    const silenced = weaverSilenced(state);
    if (!silenced) this.fizzled = this.leaving = false;
    else if (this.fizzled && !this.leaving && this.rng.chance(NOVICE_M3.leaveRune))
      this.leaving = true;
    const leave = this.leaving ? runeEscape(state, w) : null;
    // Stay with the party (roughly), step out of things that are obviously about to land.
    const c = centroid(noviceAnchor(party, all).map((h) => h.e));
    const danger = threatsOn(state, w).find((t) => t.impact - now < 0.6);
    if (danger && this.rng.chance(0.5)) {
      this.intent.move(
        out,
        w.x - (danger.shape.kind === 'circle' ? danger.shape.x : c.x),
        w.z - (danger.shape.kind === 'circle' ? danger.shape.z : c.z),
      );
    } else if (leave) this.intent.moveTo(out, w, leave, 0.2);
    else this.intent.moveTo(out, w, c, 2.5);
    const ec = centroid(enemies.length > 0 ? enemies : party.map((h) => h.e));
    this.intent.aim(out, ec.x, ec.z);

    // Pedal Point: re-plant under the party when they've clearly left the field.
    const planted = plantedChord(state);
    if (planted && wc.plantCooldown <= 0 && party.length > 0 && this.rng.chance(0.3)) {
      const spot = plantSpot(party);
      if (dist(spot, planted) > planted.radius * 0.7 && dist(spot, w) < CONTENT.weaver.plantRange)
        out.push(plantCommand(spot));
    }

    // Thread the most hurt hero (raw HP, no forecasting); revive the downed. A hero held by
    // Fermata is the most hurt of all — when they notice.
    const downed = all.find((h) => h.e.health!.downed && !h.e.health!.dead);
    const lowest = [...party].sort(
      (a, b) => a.e.health!.hp / a.e.health!.maxHp - b.e.health!.hp / b.e.health!.maxHp,
    )[0];
    const held = heldHero(party);
    const pick = (held && this.rng.chance(0.6) ? held : null) ?? downed ?? lowest;
    if (pick && wc.threadSlot !== pick.slot && wc.threadLock <= 0 && this.rng.chance(0.7)) {
      out.push({ t: 'thread', slot: pick.slot });
    }
    // Shielded enemies need Empower (the coach hint teaches this); otherwise keep Mending.
    const shielded = enemies.some((e) => e.health!.shields.some((s) => s.kind === 'discord'));
    const healthy = party.every((h) => h.e.health!.hp > h.e.health!.maxHp * 0.6);
    // Sometimes they answer a call (and sometimes they don't notice it).
    const calling = caller(party);
    const call = calling?.e.hero!.call ?? null;
    const answering = !!call && now - call.start > 0.8 && this.rng.chance(0.35);
    const empowerCall = answering && call!.answer === 'empower' && healthy && !downed && !held;
    const wantEmpower = (shielded && healthy && !downed) || empowerCall;
    if (wantEmpower) {
      const to = empowerCall ? calling : party.find((h) => h.defId === 'lyra');
      if (to && wc.threadSlot !== to.slot && wc.threadLock <= 0)
        out.push({ t: 'thread', slot: to.slot });
    }
    // The Martyr's Bear: a big hit coming at the threaded hero, and sometimes she remembers she
    // can take some of it (and forgets, for a moment, to stop).
    let want: ThreadMode = wantEmpower ? 'empower' : 'mend';
    const threaded = party.find((h) => h.slot === threadingTo(out, wc.threadSlot));
    if ((state.calling?.bearShare ?? 0) > 0 && threaded && !wantEmpower) {
      const t = threatsOn(state, threaded.e)[0];
      const scary =
        !!t && t.impact - now < 1.2 && damageOf(t, threaded.e) > threaded.e.health!.hp * 0.5;
      if (wc.threadMode === 'bear' ? scary || this.rng.chance(0.6) : scary && this.rng.chance(0.4))
        want = 'bear';
    }
    // Movement III: Unravel turns her Mend to wounds. Sometimes she notices, and Empowers.
    if (
      want === 'mend' &&
      unravelUp(state) &&
      (wc.threadMode === 'empower' || this.rng.chance(NOVICE_M3.unravelEmpower))
    )
      want = 'empower';
    out.push(...modeCommands(wc.threadMode, want));
    // The Chronomancer's Rewind (in Reel's slot): sometimes they remember it can stand a hero
    // who just went down back up (once a run).
    if (rewindCanRevive(state) && wc.cooldowns.reel <= 0 && affords(state, 'reel')) {
      const fallen = all.find(
        (h) =>
          h.e.health!.downed &&
          !h.e.health!.dead &&
          rewindSample(h.e)?.up &&
          dist(h.e, w) < tech.reel.range - 0.3,
      );
      if (fallen && this.rng.chance(0.3)) out.push({ t: 'tech', id: 'reel', slot: fallen.slot });
    }
    if (answering && call!.answer === 'ward' && wc.wardCharges > 0 && affords(state, 'ward'))
      out.push({ t: 'tech', id: 'ward', slot: calling!.slot });
    if (answering && call!.answer === 'chime' && wc.cooldowns.chime <= 0 && affords(state, 'chime'))
      out.push({ t: 'tech', id: 'chime', point: { x: calling!.e.x, z: calling!.e.z } });
    // A pinned hero: now and then they remember Reel frees them (not in Rewind's slot).
    const pinned = party.find((h) => isPinned(h.e) && dist(h.e, w) < tech.reel.range - 0.3);
    if (
      pinned &&
      !state.calling?.rewind &&
      wc.cooldowns.reel <= 0 &&
      affords(state, 'reel') &&
      this.rng.chance(0.25)
    )
      out.push({ t: 'tech', id: 'reel', slot: pinned.slot });

    // Ward someone who looks low, or (sometimes) whoever has something scary coming.
    if (wc.wardCharges > 0 && affords(state, 'ward')) {
      const low = party.find(
        (h) => h.e.health!.hp < h.e.health!.maxHp * 0.45 && dist(h.e, w) < tech.ward.range,
      );
      const threatened = party.find(
        (h) => threatsOn(state, h.e).length > 0 && dist(h.e, w) < tech.ward.range,
      );
      let target = low ?? (threatened && this.rng.chance(0.4) ? threatened : undefined);
      // A pinned hero looks like they need a Ward (it soaks the pin's damage).
      if (!target && pinned && dist(pinned.e, w) < tech.ward.range && this.rng.chance(0.5))
        target = pinned;
      if (target) out.push({ t: 'tech', id: 'ward', slot: target.slot });
    }

    // Chime a marked hero once they notice the mark.
    if (wc.cooldowns.chime <= 0 && affords(state, 'chime')) {
      let chimed = false;
      // In the Grand Silence her `silenceChime` (below) replaces this early reflex: no draw here.
      const marked = silence ? undefined : party.find((h) => statusRemaining(h.e, 'dirge') < 2.6);
      if (marked && this.rng.chance(0.75)) {
        out.push({ t: 'tech', id: 'chime', point: { x: marked.e.x, z: marked.e.z } });
        chimed = true;
      } else {
        // The bleed counter glows at 5+: they notice it, often.
        const bleeding = party.find((h) => statusStacks(h.e, 'bleed') >= BLEED_CHIME_AT);
        if (bleeding && dist(bleeding.e, w) < tech.chime.range && this.rng.chance(0.6)) {
          out.push({ t: 'tech', id: 'chime', point: { x: bleeding.e.x, z: bleeding.e.z } });
          chimed = true;
        }
      }
      // Movement III: a possessed or stitched hero, or Doom at 4+ (its count glows): now and then.
      const reach = (h: HeroView) => dist(h.e, w) < tech.chime.range;
      const freeing = chimed
        ? undefined
        : party.find((h) => reach(h) && (isPossessed(h.e) || isStitched(h.e)));
      if (freeing && this.rng.chance(NOVICE_M3.free)) {
        out.push({ t: 'tech', id: 'chime', point: { x: freeing.e.x, z: freeing.e.z } });
        chimed = true;
      }
      const doomed =
        chimed || freeing
          ? undefined
          : party.find(
              (h) =>
                reach(h) &&
                (doomStacks(h.e) >= DOOM_CHIME_AT || statusRemaining(h.e, 'doomed') < Infinity),
            );
      if (doomed && this.rng.chance(NOVICE_M3.doom))
        out.push({ t: 'tech', id: 'chime', point: { x: doomed.e.x, z: doomed.e.z } });
    }

    // A Blood Pact: sometimes they Scatter; once it's gone, they call everyone back.
    const pact = state.telegraphs.some(isPact);
    if (pact && state.directive !== 'scatter' && this.rng.chance(0.35))
      out.push({ t: 'directive', kind: 'scatter' });
    else if (!pact && state.directive === 'scatter' && this.rng.chance(0.5))
      out.push({ t: 'directive', kind: 'rally' });

    // Rings: sometimes remember to call everyone in.
    if (
      state.telegraphs.some((t) => t.kind === 'donut') &&
      state.tick >= this.rallyAllowed &&
      this.rng.chance(0.4)
    ) {
      out.push({ t: 'directive', kind: 'rally' });
      this.rallyAllowed = state.tick + 180;
    } else if (
      state.tick >= this.rallyAllowed &&
      inhaleTell(state).length > 0 &&
      this.rng.chance(NOVICE_M3.inhaleRally)
    ) {
      // Movement III: an Inhale's tell, and sometimes she calls them away from it.
      out.push({ t: 'directive', kind: 'rally' });
      this.rallyAllowed = state.tick + 180;
    }

    // Movement III: only stationary enemies left (a Void Maw never comes to the party) and no
    // hero fighting (none with a target, or a ranged hero stalled at her leash out of its range,
    // `StallWatch`): sooner or later she sends them to the nearest one. Draws only then.
    const stalled = this.stall.update(state, now);
    if (
      enemies.length > 0 &&
      enemies.every(stationary) &&
      !out.some((c) => c.t === 'directive') &&
      (idleParty(state) || stalled) &&
      this.rng.chance(NOVICE_M3.stationaryFocus)
    ) {
      const target = nearestStationary(state, enemies);
      if (target && state.focusTarget !== target.id)
        out.push({ t: 'directive', kind: 'focus', target: target.id });
    }

    // Movement III: the Unweaver's Spindles plate it, and its Decree and the boss bar say Focus
    // them. The heroes keep to the boss in front of them, so now and then she sends them to the
    // nearest Spindle. Draws only while one stands and none is Focused.
    const spindles = spindlesUp(enemies);
    if (
      spindles.length > 0 &&
      !out.some((c) => c.t === 'directive') &&
      !spindles.some((e) => e.id === state.focusTarget) &&
      this.rng.chance(NOVICE_M3.spindleFocus)
    ) {
      const target = nearestStationary(state, spindles);
      if (target) out.push({ t: 'directive', kind: 'focus', target: target.id });
    }

    // The Finale (docs/phase-5d.md): each draws only while its mechanic is up.
    this.finale(state, party, w, silence, out);
    // Seren and Oro (docs/phase-5e.md): each draws only with its hero in the party.
    this.roster(state, party, enemies, w, out);

    // Cue whoever is ready, now and then; Crescendo when things look bad. (A hero stilled by
    // the Grand Silence can't take a Cue: never so outside the Finale.)
    if (wc.resonance >= state.dissonance.cueCost && this.rng.chance(0.3)) {
      const ready = party.find(
        (h) => h.e.hero!.solo >= 100 && h.e.hero!.soloActive <= 0 && !isStilled(h.e),
      );
      if (ready) out.push({ t: 'cue', slot: ready.slot });
    }
    if (wc.resonance >= CONTENT.resonance.crescendoCost) {
      const avg =
        party.reduce((s, h) => s + h.e.health!.hp / h.e.health!.maxHp, 0) /
        Math.max(1, party.length);
      if (avg < 0.5) out.push({ t: 'crescendo' });
    }
    // A Ward, Chime or Reel cast inside a Null rune fizzles (Movement III): she may notice.
    if (silenced && out.some((c) => c.t === 'tech')) this.fizzled = true;
    return out;
  }

  /**
   * Seren's and Oro's draws (`NOVICE_ROSTER`, docs/phase-5e.md): a Ward on an engaged, unwarded
   * Seren; a Focus that wakes a tending Oro; a Rally for a Sapling outside the field. Each draws
   * only with its hero standing and its moment up (no draw at all without Seren or Oro).
   */
  private roster(
    state: WorldState,
    party: readonly HeroView[],
    enemies: readonly ReadonlyEntity[],
    w: ReadonlyEntity,
    out: Command[],
  ): void {
    const duel = duelOf(state, party);
    const grove = groveOf(state, party);
    if (!duel && !grove) return;
    const wc = w.weaver!;
    const tech = CONTENT.techniques;
    const has = (t: Command['t'], id?: string) =>
      out.some((c) => c.t === t && (id === undefined || (c.t === 'tech' && c.id === id)));
    if (duel && this.on('serenWard')) {
      const e = duel.seren.e;
      const engaged = enemies.some((m) => m.enemy!.targetId === e.id && dist(m, e) < 4);
      if (
        engaged &&
        !duel.armed &&
        dist(e, w) < tech.ward.range &&
        wc.wardCharges > 0 &&
        affords(state, 'ward') &&
        !has('tech', 'ward') &&
        this.rng.chance(NOVICE_ROSTER.serenWard)
      )
        out.push({ t: 'tech', id: 'ward', slot: duel.seren.slot });
    }
    if (grove && this.on('oroFocus') && grove.tending && !has('directive')) {
      const near = enemies.filter(
        (m) => !stationary(m) && (dist(m, grove.oro.e) < ORO_NEAR || dist(m, w) < ORO_NEAR),
      );
      if (near.length > 0 && this.rng.chance(NOVICE_ROSTER.oroFocus)) {
        let target = near[0]!;
        for (const m of near) if (dist(m, w) < dist(target, w)) target = m;
        out.push({ t: 'directive', kind: 'focus', target: target.id });
      }
    }
    if (
      grove &&
      this.on('saplingRally') &&
      grove.outside.length > 0 &&
      !state.field.suppressed &&
      !has('directive') &&
      state.tick >= this.rallyAllowed &&
      // No Rally where no re-plant lands in a field (`rallyBringsHome`).
      rallyBringsHome(state, grove, grove.outside) &&
      this.rng.chance(NOVICE_ROSTER.saplingRally)
    ) {
      out.push({ t: 'directive', kind: 'rally' });
      this.rallyAllowed = state.tick + 180;
    }
  }

  /**
   * The Finale's draws (`NOVICE_M4`, docs/phase-5d.md): a Crescendo in Fortissimo Silence, a Focus
   * on the Cued soloist, the Grand Silence's Chime, Ward and Reel, and the last burn's Cues. Each
   * draws only while its mechanic is up, so outside the Silent Conductor's fight nothing is drawn.
   */
  private finale(
    state: WorldState,
    party: readonly HeroView[],
    w: ReadonlyEntity,
    silence: ReturnType<typeof silenceOf>,
    out: Command[],
  ): void {
    const wc = w.weaver!;
    const tech = CONTENT.techniques;
    const now = state.time;
    const has = (t: Command['t'], id?: string) =>
      out.some((c) => c.t === t && (id === undefined || (c.t === 'tech' && c.id === id)));
    // Fortissimo Silence: with a full song, now and then she sees the Crescendo cancels it.
    if (
      this.on('fortissimoCrescendo') &&
      fortissimoLive(state) &&
      wc.resonance >= CONTENT.resonance.crescendoCost &&
      wc.crescendo <= 0 &&
      !has('crescendo') &&
      this.rng.chance(NOVICE_M4.fortissimoCrescendo)
    )
      out.push({ t: 'crescendo' });
    // A Cue: now and then she Focuses the voice the baton points at.
    const cue = cueOf(state);
    const soloist = cue ? state.entities.get(cue.soloist) : undefined;
    if (
      this.on('cueFocus') &&
      cue &&
      soloist?.health &&
      !soloist.health.dead &&
      state.focusTarget !== cue.soloist &&
      !has('directive') &&
      this.rng.chance(NOVICE_M4.cueFocus)
    )
      out.push({ t: 'directive', kind: 'focus', target: cue.soloist });
    if (silence) {
      const reach = (h: HeroView, range: number) => dist(h.e, w) < range;
      // A Rest's Dirge in its last 1.2 s: sometimes the Chime lands in its clutch.
      const rest = party.find(
        (h) => statusRemaining(h.e, 'dirge') <= REST_CHIME_AT && reach(h, tech.chime.range),
      );
      if (
        this.on('silenceChime') &&
        rest &&
        wc.cooldowns.chime <= 0 &&
        affords(state, 'chime') &&
        !has('tech', 'chime') &&
        this.rng.chance(NOVICE_M4.silenceChime)
      )
        out.push({ t: 'tech', id: 'chime', point: { x: rest.e.x, z: rest.e.z } });
      // A Measure or a Cadence on a hero: she Wards them, when she happens to (no timing).
      const struck = party.find(
        (h) =>
          reach(h, tech.ward.range) &&
          threatsOn(state, h.e).some((t) => t.attackId === MEASURE || isCadence(t)),
      );
      if (
        this.on('silenceWard') &&
        struck &&
        wc.wardCharges > 0 &&
        affords(state, 'ward') &&
        !has('tech', 'ward') &&
        this.rng.chance(NOVICE_M4.silenceWard)
      )
        out.push({ t: 'tech', id: 'ward', slot: struck.slot });
      // A Cadence about to land: now and then she Reels its hero out (not in Rewind's slot).
      const cadenced = party.find(
        (h) =>
          !h.e.hero!.reel &&
          reach(h, tech.reel.range - 0.3) &&
          threatsOn(state, h.e).some((t) => isCadence(t) && t.impact - now <= CADENCE_REEL_AT),
      );
      if (
        this.on('silenceReel') &&
        cadenced &&
        !state.calling?.rewind &&
        wc.cooldowns.reel <= 0 &&
        affords(state, 'reel') &&
        !has('tech', 'reel') &&
        this.rng.chance(NOVICE_M4.silenceReel)
      )
        out.push({ t: 'tech', id: 'reel', slot: cadenced.slot });
    }
    // The last burn: the reignited Solos are hers to Cue.
    if (
      this.on('reigniteCue') &&
      this.silenceWatch.burn(state) &&
      wc.resonance >= state.dissonance.cueCost &&
      !has('cue')
    ) {
      const ready = party.find((h) => h.e.hero!.solo >= 100 && h.e.hero!.soloActive <= 0);
      if (ready && this.rng.chance(NOVICE_M4.reigniteCue)) out.push({ t: 'cue', slot: ready.slot });
    }
  }
}

/**
 * Who a Novice stays near: the standing party. With Brann (docs/phase-5b.md), who always charges
 * into the melee, she stays where she would with the default party instead: on the others, two
 * parts back line to one part front (with Kael and one ranger, the ranger counts twice), so his
 * charge doesn't pull her into the cleaves aimed at Kael. Seren (docs/phase-5e.md), who leaves
 * the group to duel, is left out the same way. Oro's summons are never in it (they aren't in
 * the party). Without Brann or Seren it is the party, as before (no new draw either way).
 */
function noviceAnchor(party: readonly HeroView[], all: readonly HeroView[]): readonly HeroView[] {
  if (!all.some((h) => CHARGERS.has(h.role))) return party;
  const rest = party.filter((h) => !CHARGERS.has(h.role));
  if (rest.length === 0) return party;
  const back = rest.filter((h) => h.role !== 'tank');
  return back.length === 1 ? [...rest, back[0]!] : rest;
}
