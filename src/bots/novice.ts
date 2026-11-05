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
 * mechanic is up. Her heal-the-lowest reflex is what the Shears, Unravel and the Mimic punish.
 */
import { CONTENT } from '../content';
import { Rng } from '../sim/core/rng';
import { rewindCanRevive } from '../sim/systems/rewind';
import { weaverSilenced } from '../sim';
import type { Command, ThreadMode, WorldState } from '../sim';
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
  type HeroView,
} from './common';

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
} as const;

export class NoviceBot implements Bot {
  readonly name = 'novice';
  private readonly intent = new Intent();
  private readonly rng: Rng;
  private nextDecision = 0;
  private rallyAllowed = 0;
  /** Movement III: a technique of hers fizzled in a Null rune last decision; she's leaving it. */
  private fizzled = false;
  private leaving = false;

  constructor(seed: number) {
    this.rng = new Rng(seed ^ 0x0b1e);
  }

  decide(state: WorldState): Command[] {
    const out: Command[] = [];
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
      const marked = party.find((h) => statusRemaining(h.e, 'dirge') < 2.6);
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

    // Cue whoever is ready, now and then; Crescendo when things look bad.
    if (wc.resonance >= state.dissonance.cueCost && this.rng.chance(0.3)) {
      const ready = party.find((h) => h.e.hero!.solo >= 100 && h.e.hero!.soloActive <= 0);
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
}

/**
 * Who a Novice stays near: the standing party. With Brann (docs/phase-5b.md), who always charges
 * into the melee, she stays where she would with the default party instead: on the others, two
 * parts back line to one part front (with Kael and one ranger, the ranger counts twice), so his
 * charge doesn't pull her into the cleaves aimed at Kael. Without Brann it is the party, as before
 * (no new draw either way).
 */
function noviceAnchor(party: readonly HeroView[], all: readonly HeroView[]): readonly HeroView[] {
  if (!all.some((h) => h.role === 'berserker')) return party;
  const rest = party.filter((h) => h.role !== 'berserker');
  if (rest.length === 0) return party;
  const back = rest.filter((h) => h.role !== 'tank');
  return back.length === 1 ? [...rest, back[0]!] : rest;
}
