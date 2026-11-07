/**
 * Skilled bot: plays the Weaver the way the design intends — positions so the field covers
 * the party, threads by effective HP, times Wards into the Perfect window, Chimes marks late
 * (clutch), Reels heroes out of lethal shapes, revives, Cues Solos into the right moments
 * and fires the Crescendo when the party needs it. Phase 2: heals heroes held by Fermata,
 * answers calls when the answer isn't needed for something more urgent, plants Pedal Point
 * fields under the party and keeps a Unison Chord on the hero it suits. Movement II
 * (docs/phase-5a.md): Chimes the bleeding at 5+ stacks (and latches and Wounds), Reels heroes
 * out of pins and latches, Scatters for a Blood Pact, Focuses a guarded Sentinel once the pack
 * around it has thinned and Empowers Lyra to break it, keeps both Twin Cleave blows in mind,
 * stands in a Sanctuary pool under the Bloodmoon and Rallies the party into it, and tops up (or
 * Wards) the hero condemned by an Execution. Every one of these is gated on its mechanic being
 * present, so Movement I plays exactly as before.
 *
 * Brann (docs/phase-5b.md, "Bots and harness") is played low but alive: he reads as healthy to
 * the Thread above his floor (25%; 15% with Berserker's Hymn) unless he's falling fast or a
 * lethal hit is on him; below his 40% line he's Perfect-Warded first, Warded freely with Blood
 * Tithe, Warded or Reeled out of an Execution, Cued into Red Frenzy low in a crowd or a boss
 * fight, left out of the Crescendo's average and of the Bloodmoon's Rally (Reeled in instead, a
 * Rally at most every 8 s while he refuses them); with no dome his Ward goes on Twin Cleave's
 * first blow and the Reel waits for the second; Blood and Silk parks an Empowering Thread on
 * him. Every such branch is behind his presence and draws nothing, so a default party's command
 * stream is unchanged (tests/bots/commandSnapshot.test.ts).
 *
 * Movement III (docs/phase-5c.md, "Bots and harness"): it retargets (or steps across) before a
 * Shears dash or a Snip cuts the Thread, keeps the Thread off a hero beside a Severing elite,
 * steps or Glides out of a Null rune (casting nothing the rune refuses), Rallies in an Inhale's
 * tell and Reels (or Rewinds) a hero out of the pull, never by Swap, and Holds for a Bloodlusting
 * Brann no Reel will take out of it; Chimes a possession, a
 * Doubt mark, a Stitch and Doom at 4 in that order after a clutch Dirge; Wards a possession's
 * mark; cracks a Mimic's copy; never Empowers a possessed hero; Empowers through Unravel; and
 * Focuses Spindles, the Stolen Verse, the champion, a Null Priest and a Silencing elite after
 * the interruptible caster. Each is gated on its mechanic and draws nothing, and each can be
 * left off (`SkilledOptions.skip`, tools/verbs.ts).
 */
import { CONTENT, partyHasDome } from '../content';
import { Rng } from '../sim/core/rng';
import { contains } from '../sim/combat/telegraphs';
import { bloodRageBonus, segmentDistSq, weaverSilenced } from '../sim';
import type { Command, PartySlot, ReadonlyEntity, ThreadMode, WorldState } from '../sim';
import type { Bot } from './types';
import {
  BLEED_CHIME_AT,
  Intent,
  caller,
  centroid,
  damageOf,
  modeCommands,
  threadingTo,
  dist,
  effectiveFraction,
  enemiesOf,
  escapeFrom,
  heldHero,
  affords,
  partyOf,
  rewindPick,
  plantCommand,
  plantSpot,
  plantedChord,
  shieldOf,
  statusRemaining,
  threatsOn,
  beamSong,
  defensiveSong,
  weaverOf,
  guardUp,
  hasFollowUp,
  inZone,
  isLatched,
  isPinned,
  laterMovement,
  statusStacks,
  zoneFor,
  bloodOf,
  mendNeed,
  DOOM_CHIME_AT,
  champion,
  closingRunes,
  cutLines,
  cutThreatens,
  doomStacks,
  hazardZones,
  inhaleTell,
  inPullZone,
  isPossessed,
  isStitched,
  walksIntoLanding,
  mimicCasting,
  outOf,
  possessesOnHit,
  rewindSample,
  runeEscape,
  severingReach,
  spindlesUp,
  stolenVerse,
  suppresses,
  unravelUp,
  carriesSilence,
  stationary,
  idleParty,
  nearestStationary,
  StallWatch,
  mirrorWardCasting,
  FINALE_BANK_AT,
  cueOf,
  discordOf,
  SilenceWatch,
  fortissimoLive,
  isFortissimo,
  isSilenceBlow,
  isStilled,
  silenceOf,
  type Circle,
  type BloodView,
  type CueView,
  type DiscordView,
  type HeroView,
  type ReadonlyTelegraph,
} from './common';
import {
  BASSO_OSTINATO,
  CADENZA,
  FINAL_CADENCE,
  HALF_CADENCE,
  LAMENT,
  MEASURE,
} from '../content/crucibleIds';

export interface SkilledOptions {
  /** Ticks between decisions (reaction granularity). */
  every: number;
  /** Chance to notice a given opportunity in time (1 = perfect attention). */
  attention: number;
  /** Seconds before answering a hero's call (human reaction). */
  callReaction: number;
  /**
   * Verb ablation (tools/verbs.ts, docs/phase-5c.md): Movement III rules (and the Finale's,
   * docs/phase-5d.md) to leave off. Absent, every rule plays, so the default options object is
   * unchanged.
   */
  skip?: ReadonlySet<M3Rule | FinaleRule>;
}

/**
 * The Skilled bot's Movement III rules (docs/phase-5c.md, "Bots and harness"), each one a name
 * `SkilledOptions.skip` can turn off. Every one is gated on its mechanic being on the field.
 */
export const M3_RULES = [
  /** Retarget (or step across) before a Shears dash or a Snip cuts the Thread. */
  'cut',
  /** Keep the Thread off a hero beside a Severing elite. */
  'severing',
  /** Step (or Glide) out of a Null rune, and keep the field over the party from outside it. */
  'rune',
  /** Rally in an Inhale's tell, Reel (or Rewind) a hero out of the pull, stand outside it. */
  'maw',
  /** Hold for a Bloodlusting Brann in an Inhale (he won't Rally) when no Reel can take him. */
  'mawHold',
  /** The Chime order: a possessed hero, a doubt mark, a Stitch, Doom at 4+ or a doomed mark. */
  'chimePossessed',
  'chimeDoubt',
  'chimeStitch',
  'chimeDoom',
  /** Ward a possession's target in its Perfect window. */
  'wardPossess',
  /** While a Mimic copies a Ward, only lethal Wards (and a Chime cracks it). */
  'mimicWard',
  /** While a Mimic copies Empower, Mend instead. */
  'mimicEmpower',
  /** Never Empower a possessed hero. */
  'noEmpowerPossessed',
  /** Empower (or Bear) through Unravel. */
  'unravel',
  /** The Focus order after the interruptible caster. */
  'focusSpindle',
  'focusVerse',
  'focusChampion',
  'focusNull',
  'focusSilencing',
  /** With no hero fighting, send them to a stationary enemy out of their sight. */
  'focusStationary',
  /** Focus a Mirror Ward's caster at once, without waiting out the gap between Focuses. */
  'focusMirrorWard',
  /** Hold rather than walk into a Needle Rain circle about to land on a hero beside her. */
  'needles',
] as const;
export type M3Rule = (typeof M3_RULES)[number];

/**
 * The Skilled bot's Finale rules (docs/phase-5d.md, "Bots and harness"), each one a name
 * `SkilledOptions.skip` can turn off. W4 plays them; each is gated on its mechanic.
 */
export const FINALE_RULES = [
  /** Focus (or interrupt) the Cued soloist. */
  'cueFocus',
  /**
   * `cueFocus`'s crowd guard: hold the Focus while more than `CUE_FOCUS_AT` enemies stand. Left
   * off, `cueFocus` Focuses the soloist at any crowd (the guard's own ablation).
   */
  'cueFocusCrowd',
  /** Bank Resonance for the Crescendo as Discord climbs. */
  'bankCrescendo',
  /** Cancel Fortissimo Silence with the Crescendo. */
  'crescendoCancel',
  /** Without a Crescendo: dome, Ward, Bear, Rally and Mend through Fortissimo Silence. */
  'fortissimoGuard',
  /** The Grand Silence's notes: a Perfect Ward a cycle, a Clutch Chime, a Reel-save. */
  'silenceWard',
  'silenceChime',
  'silenceReel',
  /** Keep the Thread on the hero the silence's next blow is aimed at. */
  'silenceThread',
  /** Cue the reignited Solos (after Reignite or the Coda). */
  'reigniteCue',
] as const;
export type FinaleRule = (typeof FINALE_RULES)[number];

/**
 * Focus Movement III's targets only once no more than this many enemies stand (the
 * SENTINEL_FOCUS_AT pattern); Infinity, at once. A tuning lever, measured by tools/verbs.ts.
 */
const M3_FOCUS_AT = {
  focusSpindle: Infinity,
  focusVerse: Infinity,
  focusChampion: Infinity,
  focusNull: 4,
  focusSilencing: 4,
  focusStationary: Infinity,
} as const;
/** Answer a cut line this long before it lands (docs/phase-5c.md); Glide across under 0.4 s. */
const CUT_AHEAD = 0.5;
const CUT_GLIDE = 0.4;
/** A Thread within this many metres of a cut line counts as crossing it (both ends move). */
const CUT_MARGIN = 1;
/** Severing: keep the Thread off a hero within this many metres of the elite's edge. */
const SEVER_KEEP = 3;
/** How far a step out of a rune or a pull goes past its edge. */
const ZONE_MARGIN = 1;
/** A rune that keeps the Weaver this far from the party: re-plant a Pedal Point under them. */
const RUNE_PLANT_AT = 8;
/** Focus the Hollow Champion once it is below this share of its life (a tuning lever). */
const CHAMPION_FOCUS_BELOW = 0.5;
/** The Null Priest: Focused once the pack has thinned. */
const NULL_PRIEST = 'null_priest';

// ── The Finale's levers (docs/phase-5d.md, "Bots and harness"; measured by tools/verbs.ts) ──
/** `cueFocus`'s crowd guard: Focus the soloist only while no more than this many enemies stand. */
const CUE_FOCUS_AT = 4;
/** `crescendoCancel`: the Crescendo this long after Fortissimo Silence's first pulse begins. */
const CANCEL_AFTER = 0.3;
/** `fortissimoGuard`: the dome is Cued once the first pulse is this near (s). */
const FORTISSIMO_DOME_AT = 1.5;
/**
 * `bankCrescendo`: what Resonance a Skilled Weaver earns a second in the Conductor's fight, a
 * planning estimate. Discord that will reach 100 before a Cue's segment comes back at this rate
 * holds the Cues (as does Discord at `FINALE_BANK_AT`).
 */
const FINALE_RESONANCE_RATE = 2;
/** `silenceReel`: the Reel goes this many seconds before the Final Cadence lands. */
const SILENCE_REEL_FROM = 0.4;
const SILENCE_REEL_TO = 0.6;
/** `silenceReel`: a Swap only while the Weaver keeps more than this share of her life. */
const SWAP_ABOVE = 0.25;
/**
 * `silenceReel`: nor a Swap that would take this share of her life or more (behind the barrier
 * and her shields): the plain Reel loop's survival guard. A Martyr's Swap out of a Final Cadence
 * can cost up to 458 of her 720 (docs/phase-5d.md), and a downed Weaver makes no more notes.
 */
const SWAP_TAKES_BELOW = 0.7;
/** The Final Cadence's share of the life of whoever stands in it (docs/phase-5d.md: 115%). */
const CADENCE_DEF = CONTENT.attacks.find((a) => a.id === FINAL_CADENCE);
/** `silenceReel`, the Chronomancer: Rewind a hero who lost this share of their life in its reach. */
const REWIND_UNDO_AT = 0.3;
/** `silenceReel`, with Paradox: Rewind the Final Cadence's target once it lands within this. */
const PARADOX_WITHIN = 1;
/** The Measure's and the Cadence's windups at default assists (docs/phase-5d.md), and the gap
 * from the Measure's impact to the Cadence's begin: the next Final Cadence is foreseen by them. */
const MEASURE_WINDUP = CONTENT.attacks.find((a) => a.id === MEASURE)?.windup ?? 2;
const CADENCE_WINDUP = CONTENT.attacks.find((a) => a.id === FINAL_CADENCE)?.windup ?? 2.5;
const CADENCE_AFTER = 0.5;

/** Focus a guarded Sentinel once no more than this many enemies stand (the pack first). */
const SENTINEL_FOCUS_AT = 3;

/** The Solos that guard the party (Bonds' alternates included); the rest deal damage. */
const GUARDING: ReadonlySet<string> = new Set(['aegisWall', 'oathkeeper', 'celestial_sphere']);

/** Brann's Solo (docs/phase-5b.md): Cued low and in a crowd, its lifesteal ×3 heals him. */
const RED_FRENZY = 'redFrenzy';
/** While Brann refuses Rallies (Bloodlust), the bot calls one at most this often, in seconds. */
const LUSTING_RALLY_GAP = 8;
/** Blood and Silk's line (src/sim/systems/thread.ts): Empower him below it and it rings. */
const SILK_BELOW = 0.3;
/** How far past his floor a Mend on Brann lifts him before the Thread moves on. */
const BRANN_LIFT = 0.1;

export class SkilledBot implements Bot {
  readonly name: string;
  private readonly intent = new Intent();
  private readonly rng: Rng;
  private lastRally = -100;
  private lastFocus = -100;
  private kaelAwaySince: number | null = null;
  /** The Hold this bot called for a Bloodlusting Brann in an Inhale (Movement III only). */
  private mawHeld = false;
  private mawHeldAt = 0;
  /** Movement III: times a party stalled on a stationary enemy out of reach (`focusStationary`). */
  private readonly stall = new StallWatch();
  /**
   * The Finale: the last Cadence of the Grand Silence seen (by telegraph id), so the next one is
   * known to be the other (Final, Half, Final…). Null outside the silence.
   */
  private lastCadence: { id: number; final: boolean } | null = null;
  /** The Finale: whether this fight's Grand Silence has been seen (the last burn waits on it). */
  private readonly silenceWatch = new SilenceWatch();

  constructor(
    seed: number,
    private readonly opts: SkilledOptions = { every: 4, attention: 1, callReaction: 0.4 },
    name = 'skilled',
  ) {
    this.rng = new Rng(seed ^ 0x5eed);
    this.name = name;
  }

  decide(state: WorldState): Command[] {
    const out: Command[] = [];
    // The Finale: watched every tick, so a silence between decisions is still seen (no draws).
    this.silenceWatch.observe(state);
    if (state.tick % this.opts.every !== 0) return out;
    const w = weaverOf(state);
    const wc = w.weaver!;
    if (state.encounter.status !== 'fighting' && state.encounter.status !== 'intro') return out;
    // A Hold this bot called for Brann in an Inhale is let go even while she is down: left in
    // place, it would pin the party for the rest of the fight (false before Movement III).
    if (w.health!.downed) return this.mawHeld ? this.letGoOfHold(state.time) : out;

    const party = partyOf(state);
    const all = partyOf(state, true);
    const enemies = enemiesOf(state);
    const tech = CONTENT.techniques;
    const now = state.time;
    let acted = false;
    // Movement III: a party stalled on a stationary enemy it can't reach (false before it).
    const stalled = this.stall.update(state, now);
    // Brann (docs/phase-5b.md): every branch below that reads him is behind `blood`, which is
    // null for a party without a Blood Rage hero, so a default party plays exactly as before.
    const blood = bloodOf(state, party);
    /** Brann is in the party, up or down. */
    const withBrann = blood !== null || all.some((h) => h.e.hero!.blood !== undefined);

    // Movement III (docs/phase-5c.md): each is null, false or empty without its mechanic.
    // Inside a Null rune the sim refuses Ward, Chime and Reel: none is cast (or counted) there.
    const silenced = weaverSilenced(state);
    const cut = this.on('cut') ? cutAnswer(state, party, w, now) : null;

    // The Finale (docs/phase-5d.md): each is null or false outside the Silent Conductor's fight.
    const discord = discordOf(state);
    const fortissimo = fortissimoLive(state);
    const silence = silenceOf(state);
    const cue = cueOf(state);
    const burn = this.silenceWatch.burn(state);
    const crescendoReady = wc.resonance >= CONTENT.resonance.crescendoCost && wc.crescendo <= 0;
    /** Fortissimo Silence with no Crescendo to cancel it: dome, Ward, Bear, Rally and Mend. */
    const guardFortissimo = fortissimo !== null && !crescendoReady && this.on('fortissimoGuard');
    if (silence) this.seeCadence(state);
    else this.lastCadence = null;

    // ── Movement: cover the party with the field, stay out of danger, keep off melee. ──
    const desired = this.position(state, w, party, enemies);
    const step = this.m3Step(state, w, cut, now, desired);
    const danger = threatsOn(state, w).find((t) => t.impact - now < 0.9);
    if (danger) {
      const escape = escapeFrom(danger, w, w.radius + 1.2);
      if (escape) {
        // Skate (a variant) glides while it has a charge, its cooldown ticking for the next.
        const glide = wc.variants.glide === 'skate' ? wc.glideCharges > 0 : wc.cooldowns.glide <= 0;
        if (danger.impact - now < 0.35 && glide) {
          out.push({ t: 'glide', x: escape.x - w.x, z: escape.z - w.z });
        }
        this.intent.moveTo(out, w, escape, 0.2);
      } else this.intent.moveTo(out, w, desired);
    } else if (step) {
      // Out of a rune or a pull, or across a cut line: Glide is never refused.
      const glide = wc.variants.glide === 'skate' ? wc.glideCharges > 0 : wc.cooldowns.glide <= 0;
      if (step.glide && glide) out.push({ t: 'glide', x: step.x - w.x, z: step.z - w.z });
      this.intent.moveTo(out, w, step, 0.2);
    } else {
      // Movement III: hold rather than follow a hero into the Needle Rain about to land on them.
      const hold = this.on('needles') && walksIntoLanding(state, w, desired) !== null;
      this.intent.moveTo(out, w, hold ? w : desired);
    }
    const target = centroid(enemies.length > 0 ? enemies : party.map((h) => h.e));
    this.intent.aim(out, target.x, target.z);

    // ── Pedal Point: keep the planted field under the party. ──
    const planted = plantedChord(state);
    if (planted && wc.plantCooldown <= 0 && party.length > 0) {
      const spot = plantSpot(party);
      // A Null rune keeps her 8+ m from the party: the field goes under them, wherever it drifted.
      const forced = step?.rune === true && dist(spot, w) >= RUNE_PLANT_AT;
      if (
        dist(spot, planted) > (forced ? ZONE_MARGIN : Math.max(1.5, planted.radius * 0.4)) &&
        dist(spot, w) <= CONTENT.weaver.plantRange - 0.5
      )
        out.push(plantCommand(spot));
    }

    const held = heldHero(party);
    // A Fermata hold on Brann needs only one Mend tick (any heal saves, even halved): once it
    // landed, he needs nothing more of the Thread or the Chime.
    const holding = blood
      ? (party.find(
          (h) => h.e.hero!.hold && !(h.slot === blood.hero.slot && h.e.hero!.hold.savedBy),
        ) ?? null)
      : held;
    const calling = caller(party);
    const call = calling?.e.hero!.call ?? null;
    const answerNow = !!call && now - call.start >= this.opts.callReaction;
    // A big hit soon: keep the Ward for its Perfect window rather than spend it on a call.
    // Twin Cleave's first blow counts its second too: it lands 1.2 s after the first.
    const bigHitSoon =
      wc.wardCharges < 2 &&
      (party.some((p) =>
        threatsOn(state, p.e).some(
          (t) => t.impact - now < 2.5 && damageOf(t, p.e) > p.e.health!.maxHp * 0.25,
        ),
      ) ||
        state.telegraphs.some((t) => t.impact - now < 2.5 && hasFollowUp(t)));

    // A Mimic copying a Ward (Movement III): only a lethal hit is worth a Ward it would copy.
    const mimics = mimicCasting(enemies);
    const mimicWard = this.on('mimicWard') && mimics.some((m) => m.copy === 'ward');
    const wardPossess = this.on('wardPossess');

    // ── Ward: Perfect timing on incoming hits; emergency shields otherwise. ──
    const wardReady = !silenced && wc.wardCharges > 0 && affords(state, 'ward');
    if (wardReady && silence && this.on('silenceWard')) {
      // The Grand Silence (docs/phase-5d.md): the one Ward a cycle, planned and Perfect (a note).
      const pick = this.silenceWard(state, party, w, now);
      if (pick && this.notice()) {
        out.push({ t: 'tech', id: 'ward', slot: pick.slot });
        acted = true;
      }
    } else if (wardReady) {
      const window = tech.ward.perfectWindow;
      // Brann (docs/phase-5b.md): his Perfect due within 1.5 s holds the last charge for him.
      const holdFor = blood ? brannPerfectDue(state, blood, w) : false;
      let best: { slot: PartySlot; score: number } | null = null;
      for (const h of party) {
        if (dist(h.e, w) > tech.ward.range - 0.3) continue;
        for (const t of threatsOn(state, h.e)) {
          const left = t.impact - now;
          if (left > window - 0.06 || left < 0.04) continue;
          const dmg = damageOf(t, h.e);
          const lethal = dmg >= h.e.health!.hp + shieldOf(h.e);
          // Fortissimo Silence with no Crescendo (the Finale): the lowest of the party first,
          // whatever the pulse's size; a Ward that already answers it isn't replaced.
          if (guardFortissimo && isFortissimo(t)) {
            if (wardCovers(h.e, t, dmg, lethal)) continue;
            const score = (lethal ? 2e6 : 0) + (1 - effectiveFraction(h.e)) * 1e4;
            if (!best || score > best.score) best = { slot: h.slot, score };
            continue;
          }
          // An Execution is small but lethal below its line: Ward it whatever its size. So is a
          // possession's mark (Movement III): a full Ward blocks it.
          if (
            dmg < h.e.health!.maxHp * 0.15 &&
            !(lethal && t.executeBelow !== undefined) &&
            !(wardPossess && possessesOnHit(t))
          )
            continue;
          if (mimicWard && !lethal) continue;
          let score: number;
          if (!blood) score = dmg + (lethal ? 5000 : 0);
          else {
            const isBrann = h.slot === blood.hero.slot;
            // The Ward he holds already answers it: another would only replace it.
            if (isBrann && wardCovers(h.e, t, dmg, lethal)) continue;
            // His Perfect is due: only a lethal hit elsewhere takes the last charge first.
            if (holdFor && !isBrann && !lethal && wc.wardCharges < 2) continue;
            // A lethal hit first (whoever's; Brann's among them), then Brann's, then the biggest:
            // his priority never outranks a hit that would kill someone else.
            const first = isBrann && brannFirst(state, blood, t);
            score = ((lethal ? 2 : 0) + (first ? 1 : 0)) * 1e6 + dmg;
          }
          if (!best || score > best.score) best = { slot: h.slot, score };
        }
      }
      if (best && this.notice()) {
        out.push({ t: 'tech', id: 'ward', slot: best.slot });
        acted = true;
      } else if (
        blood &&
        !best &&
        !mimicWard &&
        brannWard(state, blood, w, perfectPending(state, party, blood, w, wc.wardCharges))
      ) {
        out.push({ t: 'tech', id: 'ward', slot: blood.hero.slot });
        acted = true;
      } else if (
        answerNow &&
        call!.answer === 'ward' &&
        !bigHitSoon &&
        dist(calling!.e, w) < tech.ward.range - 0.3 &&
        !mimicWard &&
        this.notice()
      ) {
        out.push({ t: 'tech', id: 'ward', slot: calling!.slot });
        acted = true;
      } else if (!acted && !mimicWard) {
        // Brann reads by his Mend need: low on purpose isn't an emergency.
        const need = (h: HeroView) => (blood ? mendNeed(h, blood) : effectiveFraction(h.e));
        const low = party.filter((h) => need(h) < 0.3 && dist(h.e, w) < tech.ward.range - 0.3);
        const soon = party.some((h) => threatsOn(state, h.e).some((t) => t.impact - now < 1.6));
        if (low.length > 0 && !soon && affords(state, 'ward', 15)) {
          low.sort((a, b) => need(a) - need(b));
          out.push({ t: 'tech', id: 'ward', slot: low[0]!.slot });
          acted = true;
        }
      }
    }

    // ── Chime: cleanse marks late (clutch), or anyone silenced/stunned. ──
    if (silence && this.on('silenceChime')) {
      // The Grand Silence (docs/phase-5d.md): only the clutch on a Rest's Dirge (a note), and
      // first, whatever else this decision did; never an early Chime the next Rest would miss.
      if (!silenced && wc.cooldowns.chime <= 0 && affords(state, 'chime')) {
        const pick = party.find((h) => clutchDue(h.e) && dist(h.e, w) < tech.chime.range);
        if (pick && this.notice()) {
          out.push({ t: 'tech', id: 'chime', point: { x: pick.e.x, z: pick.e.z } });
          acted = true;
        }
      }
    } else if (!acted && !silenced && wc.cooldowns.chime <= 0 && affords(state, 'chime')) {
      let pick: HeroView | null = null;
      let clutch = false;
      for (const h of party) {
        const dirge = statusRemaining(h.e, 'dirge');
        const flight = tech.chime.flight + 0.1;
        if (
          dirge !== Infinity &&
          dirge < tech.chime.clutchWindow + flight - 0.05 &&
          dirge > flight
        ) {
          pick = h;
          clutch = true;
          break;
        }
        if (statusRemaining(h.e, 'silence') < Infinity || statusRemaining(h.e, 'stun') < Infinity)
          pick = h;
      }
      // Movement III, after a clutch Dirge (docs/phase-5c.md, the Chime order): null without one.
      if (!clutch) pick = this.chimeM3(party, w) ?? pick;
      // Movement II: the cluster with the most bleed, a latched hero, or a Wounded one who's low.
      pick ??= chimeCluster(party, w, tech.chime.range, tech.chime.radius);
      if (pick && dist(pick.e, w) < tech.chime.range && this.notice()) {
        out.push({ t: 'tech', id: 'chime', point: { x: pick.e.x, z: pick.e.z } });
        acted = true;
      } else if (!pick && holding && dist(holding.e, w) < tech.chime.range && this.notice()) {
        // A Chime heals a held hero too.
        out.push({ t: 'tech', id: 'chime', point: { x: holding.e.x, z: holding.e.z } });
        acted = true;
      } else if (
        !pick &&
        answerNow &&
        call!.answer === 'chime' &&
        dist(calling!.e, w) < tech.chime.range &&
        // Keep the Chime for a Dirge that's coming.
        !party.some((h) => statusRemaining(h.e, 'dirge') < 6) &&
        this.notice()
      ) {
        out.push({ t: 'tech', id: 'chime', point: { x: calling!.e.x, z: calling!.e.z } });
        acted = true;
      } else if (!pick && mimicWard && affords(state, 'chime', 15)) {
        // A Mimic copying her Ward: a Chime now is her last technique, and the mirror cracks.
        const near = party
          .filter((h) => dist(h.e, w) < tech.chime.range)
          .sort((a, b) => effectiveFraction(a.e) - effectiveFraction(b.e))[0];
        if (near) {
          out.push({ t: 'tech', id: 'chime', point: { x: near.e.x, z: near.e.z } });
          acted = true;
        }
      }
    }

    // ── Rewind (the Chronomancer, in Reel's slot): stand back up a hero who just went down, or
    // give back a big blow to one still in danger. ──
    if (state.calling?.rewind) {
      if (!acted && !silenced && wc.cooldowns.reel <= 0 && affords(state, 'reel')) {
        // Movement III: else a hero an Inhale dragged in, back to where they stood (null without).
        // The Grand Silence first (docs/phase-5d.md): undo a blow, or with Paradox cancel the
        // Final Cadence (her Reel-save note). Null outside it.
        const pick =
          (silence && this.on('silenceReel')
            ? silenceRewind(state, party, w, tech.reel.range)
            : null) ??
          rewindPick(state, all, w, tech.reel.range) ??
          (this.on('maw') ? pulledIn(state, party, w, tech.reel.range) : null);
        if (pick && this.notice()) out.push({ t: 'tech', id: 'reel', slot: pick.slot });
      }
    } else if (!acted && !silenced && wc.cooldowns.reel <= 0 && affords(state, 'reel')) {
      // ── Reel frees a pinned or latched hero (Movement II), ahead of the generic Reel. ──
      // Never a Swap onto a hero pinned inside a Void Maw's pull or tell (Movement III): it would
      // put the Weaver where they stood, inside it (false with no Inhale on the field).
      const swapIntoMaw =
        w.weaver!.variants.reel === 'swap' && this.on('maw')
          ? (h: HeroView) => inMaw(state, h.e)
          : undefined;
      const freeing = reelToFree(party, w, tech.reel.range, swapIntoMaw);
      if (freeing && this.notice()) {
        out.push({ t: 'tech', id: 'reel', slot: freeing.slot });
        acted = true;
      }
      // Movement III: a hero out of an Inhale's pull, to the Weaver outside it (never by Swap,
      // which would put her where they stood). Null with no pull on the field.
      const outOfMaw =
        !acted && this.on('maw')
          ? mawReel(state, party, w, tech.reel.range, blood, this.mawHeld)
          : null;
      if (outOfMaw) {
        out.push({ t: 'tech', id: 'reel', slot: outOfMaw.slot });
        acted = true;
      }
      // Brann: out of an Execution no Ward answers, or in from outside every Bloodmoon pool
      // when he won't Rally (not while Twin Cleave's second blow still wants the Reel).
      if (!acted && blood && brannReel(state, blood, w, twinCleavePending(state, blood))) {
        out.push({ t: 'tech', id: 'reel', slot: blood.hero.slot });
        acted = true;
      }
      // With no dome, the Reel waits for Twin Cleave's second blow on Brann.
      const reserve = !!blood && !acted && twinCleaveOn(state, blood);
      // The Grand Silence (docs/phase-5d.md): the Reel is kept for the Final Cadence's save (a
      // note), never spent on a lesser blow the plain loop below would answer.
      const silenceLoop = silence !== null && this.on('silenceReel');
      if (silenceLoop && !acted && !reserve) {
        const pick = silenceReelPick(state, party, w, tech.reel.range, now, target);
        if (pick && this.notice()) {
          // Turned away from the blow first when the usual aim would land them back inside it.
          if (pick.aim) this.intent.aim(out, pick.aim.x, pick.aim.z);
          out.push({ t: 'tech', id: 'reel', slot: pick.h.slot });
          acted = true;
        }
      }
      // ── Reel: pull a hero out of a big hit they won't escape (beams, rings). ──
      for (const h of acted || reserve || silenceLoop ? [] : party) {
        if (h.e.hero!.action === 'dodging' || h.e.hero!.reel) continue;
        if (dist(h.e, w) > tech.reel.range - 0.3) continue;
        const t = threatsOn(state, h.e).find(
          (x) => x.kind !== 'mark' && x.kind !== 'raid' && x.kind !== 'link',
        );
        if (!t) continue;
        const left = t.impact - now;
        const dmg = damageOf(t, h.e);
        // Swap (a variant, docs/phase-4f.md) puts the Weaver where they stood: only if she can
        // take it, behind the barrier it gives her.
        if (w.weaver!.variants.reel === 'swap' && dmg >= w.health!.hp * 0.7 + swapBarrier(h.e))
          continue;
        // Nor into a Void Maw's pull (Movement III): Swap is no answer to it.
        if (w.weaver!.variants.reel === 'swap' && this.on('maw') && inMaw(state, h.e)) continue;
        const warded = (h.e.health!.shields.find((s) => s.kind === 'ward')?.amount ?? 0) >= dmg;
        if (
          left < 0.75 &&
          left > 0.15 &&
          dmg > h.e.health!.maxHp * 0.3 &&
          !warded &&
          this.notice()
        ) {
          out.push({ t: 'tech', id: 'reel', slot: h.slot });
          break;
        }
      }
    }

    // ── Thread: revive the downed, then mend by effective HP, else Empower a damage dealer. ──
    const downed = all.filter((h) => h.e.health!.downed && !h.e.health!.dead);
    let threadTo: HeroView | null = null;
    let mend = true;
    const beam = beamSong(state);
    // A revive under way keeps the thread unless the condemned hero is right at the line: the
    // revive decays off the thread, so a flip-flop around line + 0.1 would waste the wind-up.
    const reviving = downed.some((h) => h.slot === wc.threadSlot && h.e.health!.revive > 0);
    const condemnedAny = executionTarget(state, party, reviving ? 0.03 : 0.1);
    // An Execution on Brann is answered with a Ward or a Reel, never a Mend his cut halves.
    const condemned = blood && condemnedAny?.slot === blood.hero.slot ? null : condemnedAny;

    // A guard or a discord shield up in Movement II: Lyra's Empowered shots break them.
    const breakers =
      laterMovement(state) &&
      enemies.some((e) => guardUp(state, e) || e.health!.shields.some((s) => s.kind === 'discord'));
    if (holding) {
      threadTo = holding;
    } else if (condemned) {
      // An Execution is coming: lift them above its line (the Ward scorer covers the rest).
      threadTo = condemned;
    } else if (downed.length > 0) {
      downed.sort((a, b) => a.e.health!.bleedOut - b.e.health!.bleedOut);
      threadTo = downed[0]!;
      // With Brann in the party two heroes often fall together: a revive under way is seen
      // through, rather than swapped each decision for the other's shorter bleed-out.
      const winding = withBrann
        ? downed.find((h) => h.slot === wc.threadSlot && h.e.health!.revive > 0)
        : undefined;
      if (winding) threadTo = winding;
    } else if (blood) {
      const pick = brannThread(state, party, blood, wc.threadSlot, breakers, calling, answerNow);
      threadTo = pick.to;
      mend = pick.mend;
    } else if (party.length > 0) {
      const sorted = [...party].sort((a, b) => effectiveFraction(a.e) - effectiveFraction(b.e));
      const lowest = sorted[0]!;
      const current =
        wc.threadSlot === null ? null : (party.find((h) => h.slot === wc.threadSlot) ?? null);
      const calm = party.every((h) => h.e.health!.incoming < h.e.health!.hp * 0.3);
      if (answerNow && call!.answer === 'empower' && effectiveFraction(lowest.e) > 0.5 && calm) {
        // Lyra asks for Empower: give it to her while nobody is in trouble.
        mend = false;
        threadTo = calling;
      } else if (
        breakers &&
        effectiveFraction(lowest.e) > 0.6 &&
        calm &&
        party.some((h) => h.defId === 'lyra')
      ) {
        mend = false;
        threadTo = party.find((h) => h.defId === 'lyra')!;
      } else if (effectiveFraction(lowest.e) > 0.85 && calm) {
        const tank = party.find((h) => h.role === 'tank');
        if (beam && defensiveSong(beam) && tank && tank.e.health!.incoming > 0) {
          // A defensive beam song stays on a tank under fire. It flows in both modes, and a
          // healthy tank needs no Mend, so Empower them.
          mend = false;
          threadTo = tank;
        } else {
          mend = false;
          threadTo =
            party.find((h) => h.defId === 'lyra') ?? party.find((h) => h.role !== 'tank') ?? lowest;
        }
      } else if (
        !current ||
        effectiveFraction(lowest.e) < effectiveFraction(current.e) - 0.12 ||
        effectiveFraction(current.e) > 0.92
      ) {
        threadTo = lowest;
      } else threadTo = current;
    }
    // ── The Finale (docs/phase-5d.md): while the heroes are stilled, and through Fortissimo
    // Silence with no Crescendo, Mend (never Empower) whoever needs it most: the hero the next
    // blow is aimed at reads lowest. A hold, an Execution and a revive keep the Thread. ──
    if (
      ((silence && this.on('silenceThread')) || guardFortissimo) &&
      !holding &&
      !condemned &&
      downed.length === 0 &&
      party.length > 0
    ) {
      const need = (h: HeroView) => (blood ? mendNeed(h, blood) : effectiveFraction(h.e));
      const lowest = [...party].sort((a, b) => need(a) - need(b))[0]!;
      const current = party.find((h) => h.slot === wc.threadSlot);
      // The same hysteresis as the plain Thread, so it doesn't swing between two hurt heroes.
      threadTo =
        current && need(current) < need(lowest) + 0.12 && need(current) <= 0.92 ? current : lowest;
      mend = true;
    }
    // ── Movement III (docs/phase-5c.md): each step leaves the pick alone without its mechanic. ──
    // Severing: not the hero beside the elite, unless they're the only one hurt.
    if (threadTo && !holding && !condemned && downed.length === 0 && this.on('severing'))
      threadTo = awayFromSevering(enemies, party, threadTo);
    // Never Empower a possessed hero: another, or Mend them.
    if (threadTo && !mend && isPossessed(threadTo.e) && this.on('noEmpowerPossessed')) {
      const other = empowerable(party, w, wc.threadRange);
      if (other) threadTo = other;
      else mend = true;
    }
    // A cut line about to land: onto a hero whose Thread it misses (the one it's on, if it
    // misses that), never onto one whose Thread it would cut.
    if (cut && (!threadTo || cutThreatens(state, cut.t, threadTo.slot, CUT_MARGIN)))
      threadTo = cut.to ?? (cut.threatened ? threadTo : (cut.hero ?? threadTo));
    if (
      threadTo &&
      wc.threadLock <= 0 &&
      wc.threadSlot !== threadTo.slot &&
      dist(threadTo.e, w) < wc.threadRange - 0.5
    ) {
      out.push({ t: 'thread', slot: threadTo.slot });
    }
    // The Martyr's Bear: just before a big hit on the threaded hero that no shield will stop,
    // take part of it, if she has the life to spare; then back to the Thread's work.
    let want: ThreadMode = mend ? 'mend' : 'empower';
    const share = state.calling?.bearShare ?? 0;
    const bearFor = party.find((h) => h.slot === threadingTo(out, wc.threadSlot));
    if (share > 0 && bearFor && !bearFor.e.health!.downed && !held) {
      const t = threatsOn(state, bearFor.e)[0];
      if (t && t.impact - now < 1) {
        const he = bearFor.e.health!;
        const me = w.health!;
        const through = Math.max(0, damageOf(t, bearFor.e) - shieldOf(bearFor.e));
        // Fortissimo Silence with no Crescendo (the Finale): Bear every pulse on the lowest.
        const pulse = guardFortissimo && isFortissimo(t) && through > 0;
        if ((through > he.hp * 0.6 || pulse) && through * share < me.hp - me.maxHp * 0.3)
          want = 'bear';
      }
    }
    // Movement III: Unravel turns Mend to wounds, so Empower through it (the Martyr's Bear too);
    // under Stasis Mend heals as ever. Else a Mimic copying Empower: Mend, and it cracks.
    const unravel = unravelUp(state) !== null && !state.field.stasis && this.on('unravel');
    if (unravel && want === 'mend') want = share > 0 ? 'bear' : 'empower';
    else if (
      !unravel &&
      want === 'empower' &&
      this.on('mimicEmpower') &&
      mimics.some((m) => m.copy === 'empower')
    )
      want = 'mend';
    out.push(...modeCommands(wc.threadMode, want));

    // ── Cues and the Crescendo. ──
    const segment = state.dissonance.cueCost;
    const raid = state.telegraphs.find((t) => t.kind === 'raid');
    const bossFight = state.encounter.bossId !== null;
    const crescendoCost = CONTENT.resonance.crescendoCost;
    // The Finale (docs/phase-5d.md): Discord will meet Fortissimo Silence before Resonance spent
    // now could come back, so hold the Cues and the Crescendo for its cancel. False without it.
    const bank =
      discord !== null &&
      fortissimo === null &&
      this.on('bankCrescendo') &&
      banking(discord, wc.resonance, segment, crescendoCost);
    // Fortissimo Silence with the Crescendo to cancel it: no Cue spends the Resonance it needs
    // (commands run in order, so a Cue sent beside it would leave it short).
    const cancelling = crescendoReady && fortissimo !== null && this.on('crescendoCancel');
    if (!cancelling && wc.resonance >= segment && burn && this.on('reigniteCue')) {
      // The last burn (after Reignite or the Coda): every ready Solo, damage Solos first.
      const ready = party.filter(
        (h) => h.e.hero!.solo >= 100 && h.e.hero!.soloActive <= 0 && !isStilled(h.e),
      );
      const pick = ready.find((h) => !GUARDING.has(h.e.hero!.soloId)) ?? ready[0];
      if (pick) out.push({ t: 'cue', slot: pick.slot });
    } else if (!cancelling && wc.resonance >= segment) {
      for (const h of party) {
        const c = h.e.hero!;
        if (c.solo < 100 || c.soloActive > 0) continue;
        // Stilled by the Grand Silence: a Cue is refused (never so outside the Finale).
        if (isStilled(h.e)) continue;
        let go: boolean;
        // A Solo that guards the party waits for a raid or a big hit; one that deals damage, a pack.
        if (blood && c.soloId === RED_FRENZY && h.slot === blood.hero.slot) {
          // Red Frenzy Cued is lifesteal ×3: the heal his cut can't touch, low and in a crowd.
          const r = CONTENT.heroes.find((d) => d.id === h.defId)?.solo.radius ?? 0;
          const near = enemies.filter((e) => dist(e, h.e) <= r + e.radius).length;
          go = blood.low && (near >= 2 || bossFight);
        } else if (GUARDING.has(c.soloId)) {
          const bigHit = party.some((p) =>
            threatsOn(state, p.e).some(
              (t) => t.impact - now < 1.2 && damageOf(t, p.e) > p.e.health!.hp * 0.6,
            ),
          );
          go = (!!raid && raid.impact - now < 1.5) || (bigHit && wc.wardCharges === 0);
          // Without a boss, a dome when the party is low is still good.
          if (!bossFight && party.filter((p) => effectiveFraction(p.e) < 0.45).length >= 2)
            go = true;
        } else {
          go = enemies.length >= 4 || bossFight;
          if (bossFight && raid) go = false;
        }
        // The Finale: banking, no damage Cue, and a dome only if a full song remains after it;
        // Fortissimo Silence with no Crescendo, the dome before its first pulse.
        if (bank)
          go = GUARDING.has(c.soloId) && go && wc.resonance - segment >= crescendoCost - 1e-9;
        if (
          guardFortissimo &&
          fortissimo !== null &&
          GUARDING.has(c.soloId) &&
          fortissimo.pulse === 1 &&
          fortissimo.impact - now < FORTISSIMO_DOME_AT
        )
          go = true;
        // Save one segment for the Requiem dome in boss phase 3 (in the Finale's phases 1-2 it
        // yields to `bankCrescendo`, which keeps a whole song instead).
        if (
          go &&
          !GUARDING.has(c.soloId) &&
          bossFight &&
          wc.resonance < segment * 2 &&
          this.guardReady(party) &&
          !(discord !== null && this.on('bankCrescendo'))
        )
          go = false;
        if (go) {
          out.push({ t: 'cue', slot: h.slot });
          break;
        }
      }
    }
    if (cancelling && fortissimo) {
      // Fortissimo Silence (the Finale): any Calling's Crescendo cancels it, a breath after the
      // first pulse begins (or at once, on a later pulse).
      if (
        fortissimo.pulse > 1 ||
        fortissimo.start === null ||
        now >= fortissimo.start + CANCEL_AFTER
      )
        out.push({ t: 'crescendo' });
    } else if (wc.resonance >= CONTENT.resonance.crescendoCost && wc.crescendo <= 0 && !bank) {
      // Brann sits low on purpose: he's left out of the party's average.
      const counted =
        blood && party.length > 1 ? party.filter((h) => h.slot !== blood.hero.slot) : party;
      const avg =
        counted.reduce((s, h) => s + h.e.health!.hp / h.e.health!.maxHp, 0) /
        Math.max(1, counted.length);
      if (avg < 0.6 || (raid && raid.impact - now < 2.5) || downed.length > 0)
        out.push({ t: 'crescendo' });
    }

    // ── Directives: scatter for links, stack (rally) for rings, then back to normal. ──
    const link = state.telegraphs.find((t) => t.kind === 'link');
    const ring = state.telegraphs.find((t) => t.kind === 'donut');
    // Brann refusing Rallies (Bloodlust): one at most every 8 s, and he isn't one to call in.
    const lusting = !!blood?.lusting;
    const gap = (s: number) => (lusting ? Math.max(s, LUSTING_RALLY_GAP) : s);
    if (link && state.directive !== 'scatter') out.push({ t: 'directive', kind: 'scatter' });
    else if (ring && !link && now - this.lastRally > gap(2)) {
      out.push({ t: 'directive', kind: 'rally' });
      this.lastRally = now;
    } else if (!link && state.directive === 'scatter') {
      if (!blood) out.push({ t: 'directive', kind: 'rally' });
      else if (!lusting || now - this.lastRally > LUSTING_RALLY_GAP) {
        out.push({ t: 'directive', kind: 'rally' });
        this.lastRally = now;
      }
    } else if (!link && !ring && state.field.sanctuary && now - this.lastRally > gap(4)) {
      // The Bloodmoon: from inside a pool, call everyone outside every pool in to her.
      const pools = state.field.sanctuary.pools;
      const outside = (h: HeroView) =>
        !inZone(pools, h.e) && !(lusting && blood!.hero.slot === h.slot);
      if (inZone(pools, w) && party.some(blood ? outside : (h) => !inZone(pools, h.e))) {
        out.push({ t: 'directive', kind: 'rally' });
        this.lastRally = now;
      }
    } else if (!link && !ring && now - this.lastRally > gap(2) && this.on('maw')) {
      // An Inhale in its tell (Movement III): from outside it, Rally the 2+ heroes in it to her.
      // (A Bloodlusting Brann won't come: his Reel waits for him, or the Hold (`mawHold`) when
      // no Reel will take him, and the Rally its 8 s.)
      const tells = inhaleTell(state);
      if (
        tells.length > 0 &&
        !inCircles(tells, w) &&
        party.filter((h) => inCircles(tells, h.e)).length >= 2
      ) {
        out.push({ t: 'directive', kind: 'rally' });
        this.lastRally = now;
      }
    }

    // Fortissimo Silence with no Crescendo (the Finale): Rally the party into her reach, so her
    // Ward finds whoever is lowest in each pulse's window.
    if (
      guardFortissimo &&
      !out.some((c) => c.t === 'directive') &&
      now - this.lastRally > gap(2) &&
      party.some((h) => dist(h.e, w) > tech.ward.range - 0.3)
    ) {
      out.push({ t: 'directive', kind: 'rally' });
      this.lastRally = now;
    }

    // Movement III: Hold for a Bloodlusting Brann in an Inhale, and let go of it after.
    if (this.on('mawHold')) this.mawHold(state, w, blood, now, out);

    // ── Focus interruptible casters / Mutes; rally a wandering tank. ──
    // Movement III: a Spindle fell under the Focus and another stands: on to it at once, rather
    // than let the party drift back to the plated boss for the rest of the 4 s (false before it).
    const nextSpindle =
      state.focusTarget === null && this.on('focusSpindle') && spindlesUp(enemies).length > 0;
    if (now - this.lastFocus > 4 || nextSpindle) {
      const caster =
        enemies.find((e) => e.enemy!.cast?.interruptible) ??
        // The Finale's Cued soloist (docs/phase-5d.md): undefined without a live Cue.
        this.cueFocusTarget(state, enemies, w, cue) ??
        // Movement III's targets (docs/phase-5c.md): undefined unless one is on the field.
        this.m3FocusTarget(state, enemies, stalled) ??
        // A Mute. A Silencing elite carries a Mute's field too, but it waits for its own
        // crowd-guarded step above (`focusSilencing`): sent at once into a full pack, the tank
        // left the Weaver to it (measured: frayed_court won 72-84%, 1.0-1.3 downs a fight;
        // guarded, 98-100% and 0.1). No affix suppresses before Movement III, so it's the Mute.
        enemies.find((e) => suppresses(state, e) && !carriesSilence(e)) ??
        // A Crimson Sentinel's guard: Focus sends the party round its flanks, once the pack
        // around it has thinned (focused on the wall, the party lets the hounds bleed it out).
        (enemies.length <= SENTINEL_FOCUS_AT ? enemies.find((e) => guardUp(state, e)) : undefined);
      if (caster && state.focusTarget !== caster.id) {
        out.push({ t: 'directive', kind: 'focus', target: caster.id });
        this.lastFocus = now;
      }
    } else {
      // The Unweaver's Mirror Ward (Movement III) is 2 s: it can't wait out the 4 s between
      // Focuses. Null with no Mirror Ward cast. Nor can a Cued soloist in the Finale (its Cue and
      // Solo take 3.7 s): undefined without a live Cue.
      const pick =
        (this.on('focusMirrorWard') ? mirrorWardCasting(enemies) : null) ??
        this.cueFocusTarget(state, enemies, w, cue);
      if (pick && state.focusTarget !== pick.id) {
        out.push({ t: 'directive', kind: 'focus', target: pick.id });
        this.lastFocus = now;
      }
    }
    const kael = party.find((h) => h.role === 'tank');
    if (kael) {
      const away = dist(kael.e, w) > state.field.radius + 4;
      if (away) this.kaelAwaySince ??= now;
      else this.kaelAwaySince = null;
      if (
        this.kaelAwaySince !== null &&
        now - this.kaelAwaySince > 2.5 &&
        now - this.lastRally > 10
      ) {
        out.push({ t: 'directive', kind: 'rally' });
        this.lastRally = now;
        this.kaelAwaySince = null;
      }
    }
    return out;
  }

  /** A guarding Solo (Kael's dome, or an alternate that guards) is nearly ready. */
  private guardReady(party: HeroView[]): boolean {
    return party.some((h) => GUARDING.has(h.e.hero!.soloId) && h.e.hero!.solo >= 80);
  }

  private notice(): boolean {
    return this.opts.attention >= 1 || this.rng.chance(this.opts.attention);
  }

  /**
   * Void Maw (docs/phase-5c.md, Skilled table): 'Hold for a bloodlusting Brann'. Bloodlusting,
   * Brann refuses the Rally but obeys Hold (docs/phase-5b.md), and a held hero walks back to
   * where he was told to stand against the pull's 2.4 m/s. So when he stands in an Inhale (in
   * its tell or laid) and no Reel will take him out of it (Swap, the Chronomancer's Rewind, the
   * Reel not ready by the pull, out of reach, or the Weaver silenced), the party Holds, unless a
   * Rally is under way for the others, the Weaver stands in it herself, he is already within
   * `MAW_HOLD_FROM` of its centre, or a mobile enemy is within `MAW_HOLD_PACK` of him (held, he
   * would stay in that pack: measured over 24 seeds of maw_hollow with parties A and B, plain,
   * Swap and Chronomancer, the pack gate makes the rule neutral where without it party A lost
   * 2-5 more fights). The Hold is let go (a Rally, the only way back to follow) once no Inhale
   * is in its tell or laid, after `MAW_HOLD_MAX` s at most, or as soon as the Weaver is down,
   * a Focus called meanwhile notwithstanding (it leaves the heroes held; only another Rally or a
   * Scatter lets go of it for her). Before Movement III, and without a Bloodlusting Brann, it returns at once and pushes nothing.
   */
  private mawHold(
    state: WorldState,
    w: ReadonlyEntity,
    blood: BloodView | null,
    now: number,
    out: Command[],
  ): void {
    if (!this.mawHeld && !blood?.lusting) return;
    if (out.some((c) => c.t === 'directive')) return;
    const tells = inhaleTell(state);
    const pulls: Circle[] = hazardZones(state).filter((z) => z.kind === 'pull');
    if (this.mawHeld) {
      // Another directive let go of it (a Rally or a Scatter sets every hero's follow). A Focus
      // only changes `state.directive` and leaves them held: the Hold is still hers to let go.
      const held = state.party.some((id) => state.entities.get(id)?.hero?.follow === 'hold');
      if (!held) this.mawHeld = false;
      else if ((tells.length === 0 && pulls.length === 0) || now - this.mawHeldAt > MAW_HOLD_MAX)
        out.push(...this.letGoOfHold(now));
      return;
    }
    const circles: Circle[] = [...tells, ...pulls];
    if (circles.length === 0 || state.directive === 'hold' || now - this.lastRally < 3) return;
    // From inside it, the Weaver's own way out comes first (she never stands in it).
    if (inCircles(circles, w)) return;
    const brann = blood!.hero;
    if (brann.e.hero!.reel) return;
    // Only where the drag would take him somewhere: not already at the Maw's mouth.
    if (!circles.some((c) => dist(c, brann.e) <= c.r && dist(c, brann.e) > MAW_HOLD_FROM)) return;
    if (mawReelReady(state, w, brann, tells, pulls, now)) return;
    // Nor with a pack on him: held, he'd stay in it (measured: the drag out of it is no worse).
    if (enemiesOf(state).some((e) => !stationary(e) && dist(e, brann.e) < MAW_HOLD_PACK)) return;
    out.push({ t: 'directive', kind: 'hold' });
    this.mawHeld = true;
    this.mawHeldAt = now;
  }

  /** Lets go of the Hold `mawHold` called: a Rally, the only way back to follow. */
  private letGoOfHold(now: number): Command[] {
    this.mawHeld = false;
    this.lastRally = now;
    return [{ t: 'directive', kind: 'rally' }];
  }

  /** The circles the Weaver keeps out of (Movement III's runes and Inhales); empty before it. */
  private avoided(state: WorldState): Circle[] {
    const out: Circle[] = [];
    const rune = this.on('rune');
    const maw = this.on('maw');
    for (const z of hazardZones(state))
      if (z.kind === 'null' ? rune : maw) out.push({ x: z.x, z: z.z, r: z.r });
    if (rune) out.push(...closingRunes(state));
    if (maw) out.push(...inhaleTell(state));
    return out;
  }

  /** A Movement III (or Finale) rule plays unless the ablation skips it (tools/verbs.ts). */
  private on(rule: M3Rule | FinaleRule): boolean {
    return this.opts.skip?.has(rule) !== true;
  }

  // ── The Finale (docs/phase-5d.md, "Bots and harness"): read only with its mechanic up ──

  /** Notes the Grand Silence's latest Cadence, so the next one is known to be the other. */
  private seeCadence(state: WorldState): void {
    for (const t of state.telegraphs) {
      if (t.attackId !== FINAL_CADENCE && t.attackId !== HALF_CADENCE) continue;
      if (this.lastCadence && t.id <= this.lastCadence.id) continue;
      this.lastCadence = { id: t.id, final: t.attackId === FINAL_CADENCE };
    }
  }

  /**
   * `silenceWard`: the Grand Silence's one Ward a cycle, in its Perfect window (a note). It goes
   * on the Final Cadence when the Reel won't take it, else on the Measure; never on a Rest (the
   * Chime's clutch); on the Half Cadence when a charge is left for it. The 15% filter and the
   * big-hit reserve don't apply to the program's blows. With two charges nothing is kept back.
   */
  private silenceWard(
    state: WorldState,
    party: readonly HeroView[],
    w: ReadonlyEntity,
    now: number,
  ): HeroView | null {
    const wc = w.weaver!;
    const range = CONTENT.techniques.ward.range - 0.3;
    let best: { h: HeroView; score: number } | null = null;
    for (const h of party) {
      if (dist(h.e, w) > range) continue;
      for (const t of threatsOn(state, h.e)) {
        const left = t.impact - now;
        // Its own Perfect window (the Chronomancer's wider one included).
        if (now < t.perfectFrom + 0.06 || left < 0.04) continue;
        const dmg = damageOf(t, h.e);
        const lethal = dmg >= h.e.health!.hp + shieldOf(h.e);
        if (wardCovers(h.e, t, dmg, lethal)) continue;
        if (!isSilenceBlow(t)) {
          // Anything else still live: the usual filter.
          if (!lethal && dmg < h.e.health!.maxHp * 0.15) continue;
        } else if (t.kind === 'mark') continue;
        else if (
          t.attackId === FINAL_CADENCE &&
          this.reelTakes(state, w, t.impact, { t, hero: h.e })
        )
          continue;
        else if (t.attackId === MEASURE && wc.wardCharges < 2 && this.cadenceWantsWard(state, w, t))
          continue;
        const score = dmg + (lethal ? 5000 : 0);
        if (!best || score > best.score) best = { h, score };
      }
    }
    return best?.h ?? null;
  }

  /**
   * The Ward is kept off this Measure: the cycle's Cadence will be the Final (the program
   * alternates, opening on one) and the Reel won't be ready to take it.
   */
  private cadenceWantsWard(
    state: WorldState,
    w: ReadonlyEntity,
    measure: ReadonlyTelegraph,
  ): boolean {
    if (this.lastCadence !== null && this.lastCadence.final) return false;
    // Every windup multiplier stretches the program in proportion (docs/phase-5d.md).
    const k = (measure.impact - measure.start) / MEASURE_WINDUP;
    const impact = measure.impact + (CADENCE_AFTER + CADENCE_WINDUP) * k;
    return !this.reelTakes(state, w, impact);
  }

  /**
   * `silenceReel` will take a Final Cadence landing at `impact`: a Reel (never Anchor; Swap only
   * above 25% of her life, and only one she survives) or, with Paradox, the Chronomancer's
   * Rewind, ready by its moment. With the Cadence `on` its hero, Swap's cost is that blow's;
   * before it begins, the cost is foreseen behind the smallest barrier of the standing party.
   */
  private reelTakes(
    state: WorldState,
    w: ReadonlyEntity,
    impact: number,
    on?: { t: ReadonlyTelegraph; hero: ReadonlyEntity },
  ): boolean {
    if (!this.on('silenceReel') || weaverSilenced(state)) return false;
    const wc = w.weaver!;
    const rewind = !!state.calling?.rewind;
    if (rewind) {
      if (!state.mods.paradox) return false;
    } else if (wc.variants.reel === 'anchor') return false;
    else if (wc.variants.reel === 'swap') {
      if (w.health!.hp <= w.health!.maxHp * SWAP_ABOVE) return false;
      if (on) {
        if (!swapSurvives(w, on.hero, damageOf(on.t, w))) return false;
      } else {
        const toWeaver =
          (CADENCE_DEF?.damage ?? 0) + (CADENCE_DEF?.pctMaxHp ?? 1.15) * w.health!.maxHp;
        const party = partyOf(state);
        if (party.length === 0 || party.some((h) => !swapSurvives(w, h.e, toWeaver))) return false;
      }
    }
    // A plain Reel or a Swap that can't land them outside the blow doesn't take it.
    if (!rewind && on && !reelOutAim(state, w, on.hero, on.t, { x: wc.aimX, z: wc.aimZ }))
      return false;
    const by = impact - state.time - (rewind ? 0.15 : SILENCE_REEL_FROM);
    return wc.cooldowns.reel <= by && affords(state, 'reel');
  }

  /**
   * `cueFocus`: the Cued soloist, while a Cue (or its Solo) is live, no technique that answers
   * its Solo will be ready, and no more than `CUE_FOCUS_AT` enemies stand (`cueFocusCrowd`, its
   * crowd guard, ablatable on its own). Undefined otherwise.
   */
  private cueFocusTarget(
    state: WorldState,
    enemies: readonly ReadonlyEntity[],
    w: ReadonlyEntity,
    cue: CueView | null,
  ): ReadonlyEntity | undefined {
    if (!cue || !this.on('cueFocus')) return undefined;
    if (this.on('cueFocusCrowd') && enemies.length > CUE_FOCUS_AT) return undefined;
    const e = enemies.find((x) => x.id === cue.soloist);
    if (!e || soloAnswerReady(state, w, cue)) return undefined;
    return e;
  }

  /**
   * Where the Weaver steps this decision for Movement III, if anywhere (docs/phase-5c.md): out of
   * a Null rune (laid, or closing: Gliding out of a laid one at once, or a closing one at the
   * last moment), out of an Inhale (laid, or in its tell), or across a cut line to her hero's
   * side. Null without any of them.
   */
  private m3Step(
    state: WorldState,
    w: ReadonlyEntity,
    cut: CutAnswer | null,
    now: number,
    desired: { x: number; z: number },
  ): { x: number; z: number; glide: boolean; rune: boolean } | null {
    if (this.on('rune')) {
      const out = runeEscape(state, w, ZONE_MARGIN);
      if (out) {
        const closing = closingRunes(state).some((c) => dist(c, w) <= c.r && c.impact - now < 0.35);
        return { ...out, glide: weaverSilenced(state) || closing, rune: true };
      }
    }
    if (this.on('maw')) {
      const pulls = hazardZones(state).filter((z) => z.kind === 'pull');
      const pull = pulls.find((z) => dist(z, w) <= z.r);
      if (pull) return { ...outOf(pull, w, ZONE_MARGIN), glide: true, rune: false };
      const tell = inhaleTell(state).find((c) => dist(c, w) <= c.r);
      if (tell)
        return { ...outOf(tell, w, ZONE_MARGIN), glide: tell.impact - now < 0.35, rune: false };
    }
    if (cut?.step) return { ...cut.step, glide: cut.t.impact - now < CUT_GLIDE, rune: false };
    // The Thread clears the line: she holds her ground rather than walk it across.
    if (cut && !cut.threatened && cut.hero && crossesFrom(cut.t, desired, cut.hero.e))
      return { x: w.x, z: w.z, glide: false, rune: false };
    return null;
  }

  /**
   * Movement III's Chime picks in order (docs/phase-5c.md): a possessed hero (frees them), a
   * Doubt Wraith's mark (cancels its cast), a Stitch in its windup or a stitched hero, then a
   * doomed mark or Doom at `DOOM_CHIME_AT`+. Within Chime range; null when none of them is up.
   */
  private chimeM3(party: readonly HeroView[], w: ReadonlyEntity): HeroView | null {
    const chime = CONTENT.techniques.chime;
    const flight = chime.flight + 0.1;
    const near = party.filter((h) => dist(h.e, w) < chime.range);
    /** A status the Chime lands in time to cleanse (its remaining time beats the flight). */
    const live = (h: HeroView, id: string) => {
      const left = statusRemaining(h.e, id);
      return left !== Infinity && left > flight;
    };
    const steps: [M3Rule, (h: HeroView) => boolean][] = [
      ['chimePossessed', (h) => isPossessed(h.e)],
      ['chimeDoubt', (h) => live(h, 'doubt')],
      ['chimeStitch', (h) => live(h, 'stitch') || isStitched(h.e)],
      ['chimeDoom', (h) => live(h, 'doomed') || doomStacks(h.e) >= DOOM_CHIME_AT],
    ];
    for (const [rule, wants] of steps) {
      if (!this.on(rule)) continue;
      const pick = near.find(wants);
      if (pick) return pick;
    }
    return null;
  }

  /**
   * Movement III's Focus, after the interruptible caster (docs/phase-5c.md): a Spindle, the
   * Stolen Verse, the Hollow Champion, a Null Priest, then a Silencing elite, each once the pack
   * is down to its `M3_FOCUS_AT`. Undefined without any of them on the field.
   */
  private m3FocusTarget(
    state: WorldState,
    enemies: readonly ReadonlyEntity[],
    stalled: boolean,
  ): ReadonlyEntity | undefined {
    const n = enemies.length;
    const steps: [keyof typeof M3_FOCUS_AT, () => ReadonlyEntity | null | undefined][] = [
      ['focusSpindle', () => nearestTo(spindlesUp(enemies), weaverOf(state))],
      ['focusVerse', () => stolenVerse(state)],
      // The champion only once it's worn down: burning the boss is quicker until then (and its
      // Mirror Ward is still interrupted at once, `focusMirrorWard`).
      ['focusChampion', () => worn(champion(enemies), CHAMPION_FOCUS_BELOW)],
      ['focusNull', () => enemies.find((e) => e.enemy!.defId === NULL_PRIEST)],
      ['focusSilencing', () => enemies.find(carriesSilence)],
      // A stationary enemy (a Void Maw, a Spindle) never comes to the party, and the heroes only
      // look 18-20 m out: with nobody fighting and only stationary enemies left, send them to
      // the nearest one. Nobody fighting includes a ranged hero who targets it from her leash,
      // out of range (`StallWatch`). Not while a mobile pack is still on its way: idle at a
      // fight's start, the party would march on the Maw and leave the pack to the Weaver
      // (measured: maw_hollow lost 2 of 24 and took 0.7 more downs a fight).
      [
        'focusStationary',
        () =>
          (idleParty(state) && enemies.every(stationary)) || stalled
            ? nearestStationary(state, enemies)
            : null,
      ],
    ];
    for (const [rule, find] of steps) {
      if (!this.on(rule) || n > M3_FOCUS_AT[rule]) continue;
      const e = find();
      if (e) return e;
    }
    return undefined;
  }

  /** Where the Weaver wants to stand: covering the party, a little behind the frontline. */
  private position(
    state: WorldState,
    w: ReadonlyEntity,
    party: HeroView[],
    enemies: ReadonlyEntity[],
  ): { x: number; z: number } {
    if (party.length === 0) return { x: w.x, z: w.z };
    const pts = party.map((h) => h.e);
    const c = centroid(pts);
    let x = c.x;
    let z = c.z;
    if (enemies.length > 0) {
      const ec = centroid(enemies);
      const dx = c.x - ec.x;
      const dz = c.z - ec.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      x += (dx / d) * 1.5;
      z += (dz / d) * 1.5;
    }
    // Hymn circles, or the Bloodmoon's Sanctuary pools: stand in the one nearest the party.
    const zones = zoneFor(state);
    if (zones.length > 0) {
      let best = zones[0]!;
      for (const h of zones) if (dist(h, c) < dist(best, c)) best = h;
      x = best.x;
      z = best.z;
    }
    // Movement III: never in a Null rune or an Inhale, laid or in its tell (none before it).
    for (const c of this.avoided(state)) {
      if (dist(c, { x, z }) > c.r + ZONE_MARGIN * 0.5) continue;
      const p = outOf(c, { x, z }, ZONE_MARGIN);
      x = p.x;
      z = p.z;
    }
    // Keep away from enemies that are on the Weaver.
    for (const e of enemies) {
      if (e.enemy!.targetId !== w.id) continue;
      const d = dist(e, { x, z });
      if (d < 3.5) {
        const dx = x - e.x;
        const dz = z - e.z;
        const m = Math.sqrt(dx * dx + dz * dz) || 1;
        x = e.x + (dx / m) * 4;
        z = e.z + (dz / m) * 4;
      }
    }
    const r = state.arenaRadius - 1.5;
    const m = Math.sqrt(x * x + z * z);
    if (m > r) {
      x = (x / m) * r;
      z = (z / m) * r;
    }
    return { x, z };
  }
}

/** The barrier Swap gives the Weaver for this hero (docs/phase-4f.md): a share of their life. */
function swapBarrier(hero: ReadonlyEntity): number {
  const pct = CONTENT.techniqueVariants.find((v) => v.id === 'swap')?.values.pct ?? 0;
  return hero.health!.maxHp * (pct / 100);
}

/**
 * The Grand Silence's Swap guard: Swapping in for `hero`, the Weaver takes `toWeaver` (the blow
 * as it lands on her) less the barrier and her shields, and that leaves her well clear.
 */
function swapSurvives(w: ReadonlyEntity, hero: ReadonlyEntity, toWeaver: number): boolean {
  return toWeaver - swapBarrier(hero) - shieldOf(w) < w.health!.hp * SWAP_TAKES_BELOW;
}

/**
 * Where a Chime does the most Movement II good (docs/phase-5a.md): on the hero whose 4 m takes in
 * the most bleed among heroes at 5+ stacks, a latch, or a Wound on someone below 60%. Null when
 * nobody needs one, as always in Movement I.
 */
function chimeCluster(
  party: readonly HeroView[],
  w: ReadonlyEntity,
  range: number,
  radius: number,
): HeroView | null {
  const need = (h: HeroView): number => {
    const e = h.e;
    const stacks = statusStacks(e, 'bleed');
    let n = stacks >= BLEED_CHIME_AT ? stacks : 0;
    if (isLatched(e)) n += BLEED_CHIME_AT + 1;
    if (statusRemaining(e, 'wound') < Infinity && e.health!.hp < e.health!.maxHp * 0.6)
      n += BLEED_CHIME_AT;
    return n;
  };
  let best: HeroView | null = null;
  let score = 0;
  for (const h of party) {
    if (need(h) === 0 || dist(h.e, w) >= range) continue;
    let s = 0;
    for (const o of party) if (dist(o.e, h.e) <= radius + o.e.radius) s += need(o);
    if (s > score) {
      best = h;
      score = s;
    }
  }
  return best;
}

/**
 * A pinned or latched hero to Reel free (docs/phase-5a.md P4), the most hurt first, but none
 * `exclude` names (a Swap into a Void Maw); null when nobody is held (always in Movement I) or
 * the hold is about to end on its own.
 */
function reelToFree(
  party: readonly HeroView[],
  w: ReadonlyEntity,
  range: number,
  exclude?: (h: HeroView) => boolean,
): HeroView | null {
  let best: HeroView | null = null;
  for (const h of party) {
    if (h.e.hero!.reel || h.e.hero!.action === 'dodging') continue;
    if (exclude?.(h)) continue;
    if (dist(h.e, w) > range - 0.3) continue;
    const held =
      (isPinned(h.e) && statusRemaining(h.e, 'pinned') > 0.6) ||
      (isLatched(h.e) && statusRemaining(h.e, 'latched') > 1);
    if (!held) continue;
    if (!best || effectiveFraction(h.e) < effectiveFraction(best.e)) best = h;
  }
  return best;
}

/**
 * The hero an Execution has condemned while they're below its line or within `margin` above it:
 * Mend them up. Above that the thread is free for everyone else, a downed hero's revive first.
 * Null with no Execution cast, as always in Movement I.
 */
function executionTarget(
  state: WorldState,
  party: readonly HeroView[],
  margin = 0.1,
): HeroView | null {
  for (const t of state.telegraphs) {
    if (t.executeBelow === undefined || t.target === null) continue;
    const h = party.find((p) => p.e.id === t.target);
    if (h && h.e.health!.hp < h.e.health!.maxHp * (t.executeBelow + margin)) return h;
  }
  return null;
}

// ── Movement III (docs/phase-5c.md, "Bots and harness"): read only with its mechanic up ──

/** How the bot answers a cut line about to land across the Thread. */
interface CutAnswer {
  t: ReadonlyTelegraph;
  /** The most urgent hero whose Thread it would miss (the Thread is free to move), or null. */
  to: HeroView | null;
  /** Else where the Weaver steps: across the line, to her threaded hero's side. */
  step: { x: number; z: number } | null;
  /** The Thread, as it stands, is in the line's way (with `CUT_MARGIN` to spare). */
  threatened: boolean;
  /** Her threaded hero now (null with no Thread). */
  hero: HeroView | null;
}

/**
 * The soonest Shears dash or Snip, landing within `CUT_AHEAD` s. If it would cut the Thread as
 * things stand: retarget to the most urgent hero in reach whose Thread it misses, or else step
 * across the line to her hero's side. If it wouldn't, the Thread stays where it is and she
 * doesn't walk across it. Null when no cut line is that close (always before Movement III).
 */
function cutAnswer(
  state: WorldState,
  party: readonly HeroView[],
  w: ReadonlyEntity,
  now: number,
): CutAnswer | null {
  const wc = w.weaver!;
  const t = cutLines(state)[0];
  if (!t || t.impact - now > CUT_AHEAD) return null;
  const hero = party.find((h) => h.slot === wc.threadSlot) ?? null;
  if (!cutThreatens(state, t, wc.threadSlot, CUT_MARGIN))
    return { t, to: null, step: null, threatened: false, hero };
  let to: HeroView | null = null;
  if (wc.threadLock <= 0)
    for (const h of party) {
      if (h.slot === wc.threadSlot || dist(h.e, w) >= wc.threadRange - 0.5) continue;
      if (cutThreatens(state, t, h.slot, CUT_MARGIN)) continue;
      if (!to || effectiveFraction(h.e) < effectiveFraction(to.e)) to = h;
    }
  if (to) return { t, to, step: null, threatened: true, hero };
  return { t, to: null, step: hero ? acrossLine(t, w, hero.e) : null, threatened: true, hero };
}

/**
 * Would the Weaver standing at `p` put the Thread to `hero` across the cut line `t` (with
 * `CUT_MARGIN` to spare)? Where she means to walk while a cut is about to land.
 */
function crossesFrom(
  t: ReadonlyTelegraph,
  p: { x: number; z: number },
  hero: ReadonlyEntity,
): boolean {
  const s = t.shape;
  if (s.kind !== 'line') return false;
  const half = s.width / 2 + CUT_MARGIN;
  return segmentDistSq(s.x, s.z, s.toX, s.toZ, p.x, p.z, hero.x, hero.z) <= half * half;
}

/** A point beside the line `t`, on `hero`'s side of it, level with the Weaver. */
function acrossLine(
  t: ReadonlyTelegraph,
  w: ReadonlyEntity,
  hero: ReadonlyEntity,
): { x: number; z: number } | null {
  const s = t.shape;
  if (s.kind !== 'line') return null;
  const lx = s.toX - s.x;
  const lz = s.toZ - s.z;
  const l = Math.sqrt(lx * lx + lz * lz) || 1;
  const nx = -lz / l;
  const nz = lx / l;
  const side = (hero.x - s.x) * nx + (hero.z - s.z) * nz >= 0 ? 1 : -1;
  const along = ((w.x - s.x) * lx + (w.z - s.z) * lz) / l;
  const off = s.width / 2 + w.radius + CUT_MARGIN;
  return {
    x: s.x + (lx / l) * along + nx * side * off,
    z: s.z + (lz / l) * along + nz * side * off,
  };
}

/** A hero below this effective life is hurt, for Severing's "the only hurt hero". */
const SEVER_HURT = 0.85;

/**
 * Severing: the Thread stays off a hero within `SEVER_KEEP` m of a Severing elite's edge,
 * unless they are the only hurt hero; it goes to the most hurt of the others instead. `to`
 * itself without a Severing elite on the field.
 */
function awayFromSevering(
  enemies: readonly ReadonlyEntity[],
  party: readonly HeroView[],
  to: HeroView,
): HeroView {
  const severing = enemies.filter((e) => severingReach(e) !== null);
  if (severing.length === 0) return to;
  const near = (h: HeroView) => severing.some((e) => dist(e, h.e) <= SEVER_KEEP + e.radius);
  if (!near(to)) return to;
  const others = party
    .filter((h) => h.slot !== to.slot && !near(h))
    .sort((a, b) => effectiveFraction(a.e) - effectiveFraction(b.e));
  const hurt = (h: HeroView) => effectiveFraction(h.e) < SEVER_HURT;
  if (others.length === 0 || (hurt(to) && !others.some(hurt))) return to;
  return others[0]!;
}

/** A hero to Empower who isn't possessed, in Thread reach: Lyra first, then a non-tank. */
function empowerable(
  party: readonly HeroView[],
  w: ReadonlyEntity,
  range: number,
): HeroView | null {
  const ok = (h: HeroView) => !isPossessed(h.e) && dist(h.e, w) < range - 0.5;
  return (
    party.find((h) => h.defId === 'lyra' && ok(h)) ??
    party.find((h) => h.role !== 'tank' && ok(h)) ??
    null
  );
}

/** The one of `es` nearest `p` (the first on a tie); null when there is none. */
function nearestTo(
  es: readonly ReadonlyEntity[],
  p: { x: number; z: number },
): ReadonlyEntity | null {
  let best: ReadonlyEntity | null = null;
  for (const e of es) if (!best || dist(e, p) < dist(best, p)) best = e;
  return best;
}

/** `e` while its life is below `below` of its max; else null. */
function worn(e: ReadonlyEntity | null, below: number): ReadonlyEntity | null {
  return e && e.health!.hp < e.health!.maxHp * below ? e : null;
}

function inCircles(circles: readonly Circle[], p: { x: number; z: number }): boolean {
  return circles.some((c) => dist(c, p) <= c.r);
}

/** Inside an Inhale's pull, or its tell (where the pull will be). */
function inMaw(state: WorldState, p: { x: number; z: number }): boolean {
  return inPullZone(state, p) || inCircles(inhaleTell(state), p);
}

/**
 * `mawHold`: Hold only for a Brann further than this from the Inhale's centre (nearer, the drag
 * has nowhere to take him), and never for longer than the tell and the pull (1.4 + 4 s).
 */
const MAW_HOLD_FROM = 4;
const MAW_HOLD_MAX = 6;
/** `mawHold`: no Hold with a mobile enemy this near Brann (a tuning lever, tools/verbs.ts). */
const MAW_HOLD_PACK = 4;

/** Reel a hero out of an Inhale's pull only below this effective life (the melee stay put). */
const MAW_REEL_BELOW = 0.75;

/**
 * A hero to Reel out of an Inhale's pull to the Weaver standing outside it: a Bloodlusting
 * Brann (he won't answer a Rally) first, else the most hurt below `MAW_REEL_BELOW`. Never with
 * Swap, which would put her where they stood, nor a Brann held for it (`brannHeld`). Null
 * with no pull on the field.
 */
function mawReel(
  state: WorldState,
  party: readonly HeroView[],
  w: ReadonlyEntity,
  range: number,
  blood: BloodView | null,
  brannHeld = false,
): HeroView | null {
  const pulls: Circle[] = hazardZones(state).filter((z) => z.kind === 'pull');
  if (pulls.length === 0 || w.weaver!.variants.reel === 'swap' || inCircles(pulls, w)) return null;
  const inside = party.filter(
    (h) =>
      !h.e.hero!.reel &&
      h.e.hero!.action !== 'dodging' &&
      statusRemaining(h.e, 'anchored') === Infinity &&
      dist(h.e, w) <= range - 0.3 &&
      inCircles(pulls, h.e) &&
      // A Brann held for this Inhale (`mawHold`) stays: Reeled, he'd walk back to his spot.
      !(brannHeld && h.slot === blood?.hero.slot),
  );
  if (blood?.lusting) {
    const brann = inside.find((h) => h.slot === blood.hero.slot);
    if (brann) return brann;
  }
  let best: HeroView | null = null;
  for (const h of inside)
    if (
      effectiveFraction(h.e) < MAW_REEL_BELOW &&
      (!best || effectiveFraction(h.e) < effectiveFraction(best.e))
    )
      best = h;
  return best;
}

/**
 * A plain Reel (not Swap, not the Chronomancer's Rewind) will take `h` out of an Inhale: the
 * Weaver stands outside it, unsilenced, with `h` in reach, and the Reel is ready by the time
 * the pull is laid (at once, if it is laid already).
 */
function mawReelReady(
  state: WorldState,
  w: ReadonlyEntity,
  h: HeroView,
  tells: readonly (Circle & { impact: number })[],
  pulls: readonly Circle[],
  now: number,
): boolean {
  const wc = w.weaver!;
  if (wc.variants.reel === 'swap' || state.calling?.rewind) return false;
  if (weaverSilenced(state) || !affords(state, 'reel')) return false;
  if (inCircles(tells, w) || inCircles(pulls, w)) return false;
  if (dist(h.e, w) > CONTENT.techniques.reel.range - 0.3) return false;
  const by = pulls.length > 0 ? 0 : Math.max(0, Math.min(...tells.map((t) => t.impact)) - now);
  return wc.cooldowns.reel <= by + 0.25;
}

/**
 * The Chronomancer's Rewind for an Inhale: a hero inside its pull who stood outside it when
 * Rewind's reach began (they were dragged in), the most hurt first. Null with no pull.
 */
function pulledIn(
  state: WorldState,
  party: readonly HeroView[],
  w: ReadonlyEntity,
  range: number,
): HeroView | null {
  const pulls: Circle[] = hazardZones(state).filter((z) => z.kind === 'pull');
  if (pulls.length === 0) return null;
  let best: HeroView | null = null;
  for (const h of party) {
    const past = rewindSample(h.e);
    if (!past || dist(h.e, w) > range - 0.3) continue;
    if (!inCircles(pulls, h.e) || inCircles(pulls, past)) continue;
    if (!best || effectiveFraction(h.e) < effectiveFraction(best.e)) best = h;
  }
  return best;
}

// ── Brann (docs/phase-5b.md, "Bots and harness"): read only with a Blood Rage hero up ─────

/** Brann holds one of the Weaver's Wards. */
function warded(e: ReadonlyEntity): boolean {
  return e.health!.shields.some((s) => s.kind === 'ward');
}

/** The Execution condemning Brann (below its line, or within 0.1 of it), if one is cast. */
function executionOn(state: WorldState, blood: BloodView) {
  const e = blood.hero.e;
  return (
    state.telegraphs.find(
      (t) =>
        t.executeBelow !== undefined &&
        t.target === e.id &&
        e.health!.hp < e.health!.maxHp * (t.executeBelow + 0.1),
    ) ?? null
  );
}

/** The party has no dome (no Kael): Twin Cleave and Execution find Brann. */
function noDome(state: WorldState): boolean {
  const ids = state.party.map((id) => state.entities.get(id)?.hero?.defId ?? '');
  return !partyHasDome(ids);
}

/** With no dome, Twin Cleave's first blow is on its way to Brann (its second follows). */
function twinCleaveOn(state: WorldState, blood: BloodView): boolean {
  return (
    noDome(state) &&
    threatsOn(state, blood.hero.e).some((t) => hasFollowUp(t) && t.impact - state.time < 2.5)
  );
}

/** The blows that follow a first one onto the same hero: Twin Cleave's second. */
const SECOND_BLOWS: ReadonlySet<string> = new Set(
  CONTENT.attacks.flatMap((a) => (a.followUp && !a.followUp.reverse ? [a.followUp.attack] : [])),
);

/**
 * With no dome, Twin Cleave is on Brann: its first blow on the way, or its second (which the
 * Reel is kept for) still to land.
 */
function twinCleavePending(state: WorldState, blood: BloodView): boolean {
  return (
    noDome(state) &&
    threatsOn(state, blood.hero.e).some(
      (t) => SECOND_BLOWS.has(t.attackId) || (hasFollowUp(t) && t.impact - state.time < 2.5),
    )
  );
}

/** How far ahead the bot keeps a Ward for a Perfect (docs/phase-5b.md, "Bots and harness"). */
const PERFECT_AHEAD = 1.5;

/**
 * A hit the Perfect scorer Wards: 15% of the hero's life, an Execution that would kill, or
 * (Movement III) a possession's mark, which a full Ward blocks.
 */
function wardWorthy(e: ReadonlyEntity, t: ReadonlyTelegraph, dmg: number): boolean {
  const h = e.health!;
  return (
    dmg >= h.maxHp * 0.15 ||
    (t.executeBelow !== undefined && dmg >= h.hp + shieldOf(e)) ||
    possessesOnHit(t)
  );
}

/**
 * The Ward a hero holds already answers this hit: it lasts until the hit lands and either went
 * on inside its Perfect window (it will be Perfect), takes all of it, or leaves them alive
 * through an Execution (which spares them). A second Ward would only replace it (`addShield`
 * keeps one of each kind).
 */
function wardCovers(
  e: ReadonlyEntity,
  t: ReadonlyTelegraph,
  dmg: number,
  lethal: boolean,
): boolean {
  const ward = e.health!.shields.find((s) => s.kind === 'ward');
  if (!ward || ward.expiresAt < t.impact) return false;
  if (ward.appliedAt >= t.perfectFrom - 1e-9) return true;
  return ward.amount >= dmg || (t.executeBelow !== undefined && !lethal);
}

/**
 * A hit on Brann the Ward goes to first (after a lethal one on anyone): below his line, or, with
 * no dome, Twin Cleave's first blow (his Ward before it; the Reel waits for the second).
 */
function brannFirst(state: WorldState, blood: BloodView, t: ReadonlyTelegraph): boolean {
  return blood.low || (hasFollowUp(t) && noDome(state));
}

/**
 * A hit on Brann that his Perfect Ward goes first to lands within 1.5 s, while he's in reach and
 * the Ward he holds doesn't already answer it: the scorer keeps the last charge for it.
 */
function brannPerfectDue(state: WorldState, blood: BloodView, w: ReadonlyEntity): boolean {
  const e = blood.hero.e;
  const ward = CONTENT.techniques.ward;
  if (dist(e, w) > ward.range - 0.3) return false;
  return threatsOn(state, e).some((t) => {
    const left = t.impact - state.time;
    if (left < 0.04 || left > PERFECT_AHEAD) return false;
    const dmg = damageOf(t, e);
    const lethal = dmg >= e.health!.hp + shieldOf(e);
    return wardWorthy(e, t, dmg) && brannFirst(state, blood, t) && !wardCovers(e, t, dmg, lethal);
  });
}

/**
 * A Perfect is pending within 1.5 s that a Ward cast now would take the charge from: on Brann
 * himself (a Ward now would be replaced in his window), or on anyone else in reach while only
 * one charge is held.
 */
function perfectPending(
  state: WorldState,
  party: readonly HeroView[],
  blood: BloodView,
  w: ReadonlyEntity,
  charges: number,
): boolean {
  const range = CONTENT.techniques.ward.range - 0.3;
  return party.some((h) => {
    const isBrann = h.slot === blood.hero.slot;
    if ((!isBrann && charges >= 2) || dist(h.e, w) > range) return false;
    return threatsOn(state, h.e).some((t) => {
      const left = t.impact - state.time;
      if (left < 0.04 || left > PERFECT_AHEAD) return false;
      const dmg = damageOf(t, h.e);
      return wardWorthy(h.e, t, dmg) && !(isBrann && wardCovers(h.e, t, dmg, false));
    });
  });
}

/**
 * A Ward on Brann outside the Perfect scorer (which already puts him first below his line, and
 * Wards Twin Cleave's first blow on him when there's no dome), when he holds none and is in
 * reach: an Execution condemns him (it spares a Warded hero); with Blood Tithe, whenever he's
 * below his line and no Perfect is `pending` within 1.5 s to want the charge.
 */
function brannWard(
  state: WorldState,
  blood: BloodView,
  w: ReadonlyEntity,
  pending: boolean,
): boolean {
  const e = blood.hero.e;
  const tech = CONTENT.techniques.ward;
  if (warded(e) || dist(e, w) > tech.range - 0.3) return false;
  const now = state.time;
  const exec = executionOn(state, blood);
  // The Ward lasts its duration: cast it so it's still up when the Execution lands.
  if (exec && exec.impact - now < tech.duration - 0.5) return true;
  return state.mods.bloodTithe > 0 && blood.low && !pending;
}

/**
 * A Reel for Brann: out of an Execution at its last moment when no Ward is on him (the pull's
 * flight dodges it), or, Bloodlusting under the Bloodmoon, in from outside every pool to the
 * Weaver standing in one (he won't answer a Rally) unless the Reel is `kept` for Twin Cleave's
 * second blow.
 */
function brannReel(state: WorldState, blood: BloodView, w: ReadonlyEntity, kept: boolean): boolean {
  const e = blood.hero.e;
  const reel = CONTENT.techniques.reel;
  if (e.hero!.reel || e.hero!.action === 'dodging' || dist(e, w) > reel.range - 0.3) return false;
  const exec = executionOn(state, blood);
  if (exec && !warded(e)) {
    const left = exec.impact - state.time;
    if (left < reel.flight - 0.05 && left > 0.05) return true;
  }
  if (kept) return false;
  const pools = state.field.sanctuary?.pools;
  return !!pools && blood.lusting && inZone(pools, w) && !inZone(pools, e);
}

/** The damage a hero's attack deals a second now (Blood Rage included): who breaks shields. */
function damageRate(h: HeroView): number {
  const def = CONTENT.heroes.find((d) => d.id === h.defId)!;
  return (def.attack.damage / def.attack.interval) * (1 + bloodRageBonus(CONTENT, h.e));
}

/**
 * The Thread with Brann in the party: the default rules, read by each hero's Mend need (Brann
 * is healthy while he holds his floor), with Blood and Silk's parking (Empower him below 30%
 * while nobody else is below half) and, without Lyra, the hardest hitter who isn't the tank to
 * break discord shields.
 */
function brannThread(
  state: WorldState,
  party: readonly HeroView[],
  blood: BloodView,
  threadSlot: PartySlot | null,
  breakers: boolean,
  calling: HeroView | null,
  answerNow: boolean,
): { to: HeroView | null; mend: boolean } {
  if (party.length === 0) return { to: null, mend: true };
  const brann = blood.hero;
  // Being Mended up to his floor, he's lifted a little past it before the Thread moves on, so
  // it doesn't swing between him and the rest as hits come and go.
  const mending =
    threadSlot === brann.slot && state.entities.get(state.weaverId)?.weaver?.threadMode === 'mend';
  const lift = mending && effectiveFraction(brann.e) < blood.floor + BRANN_LIFT;
  const need = (h: HeroView) =>
    lift && h.slot === brann.slot ? effectiveFraction(h.e) : mendNeed(h, blood);
  const sorted = [...party].sort((a, b) => need(a) - need(b));
  const lowest = sorted[0]!;
  const current = threadSlot === null ? null : (party.find((h) => h.slot === threadSlot) ?? null);
  // Brann healthy at his floor isn't in trouble, however much is coming at him.
  const calm = party.every(
    (h) => (h.slot === brann.slot && need(h) === 1) || h.e.health!.incoming < h.e.health!.hp * 0.3,
  );
  const call = calling?.e.hero!.call ?? null;
  const bh = brann.e.health!;
  if (
    state.mods.bloodAndSilk > 0 &&
    bh.hp < bh.maxHp * SILK_BELOW &&
    !blood.fast &&
    !blood.lethal &&
    party.every((h) => h.slot === brann.slot || h.e.health!.hp >= h.e.health!.maxHp * 0.5)
  )
    return { to: brann, mend: false };
  if (answerNow && call?.answer === 'empower' && need(lowest) > 0.5 && calm)
    return { to: calling, mend: false };
  const lyra = party.find((h) => h.defId === 'lyra');
  if (breakers && need(lowest) > 0.6 && calm) {
    if (lyra) return { to: lyra, mend: false };
    // No Lyra: a discord shield breaks under any Empowered hero; a guard wants Focus and flank.
    const discord = state.entities
      .list()
      .some((e) => e.enemy && e.health?.shields.some((s) => s.kind === 'discord'));
    const strikers = party.filter((h) => h.role !== 'tank');
    if (discord && strikers.length > 0) {
      const top = strikers.reduce((a, b) => (damageRate(b) > damageRate(a) ? b : a));
      return { to: top, mend: false };
    }
  }
  if (need(lowest) > 0.85 && calm) {
    const tank = party.find((h) => h.role === 'tank');
    const beam = beamSong(state);
    if (beam && defensiveSong(beam) && tank && tank.e.health!.incoming > 0)
      return { to: tank, mend: false };
    return { to: lyra ?? party.find((h) => h.role !== 'tank') ?? lowest, mend: false };
  }
  if (!current || need(lowest) < need(current) - 0.12 || need(current) > 0.92)
    return { to: lowest, mend: true };
  return { to: current, mend: true };
}

// ── The Finale (docs/phase-5d.md, "Bots and harness"): read only with its mechanic up ─────

/** How far inside the clutch window the silence's Chime aims to land (s). */
const CLUTCH_MARGIN = 0.1;

/**
 * A Dirge on `e` the Chime would cleanse inside its clutch window (its last second): cast once
 * the Chime's flight would land it at least `CLUTCH_MARGIN` s inside the window, since the
 * silence's fixed cycle meets the 4-tick decision grid at the same phase every Rest.
 */
function clutchDue(e: ReadonlyEntity): boolean {
  const chime = CONTENT.techniques.chime;
  const dirge = statusRemaining(e, 'dirge');
  return (
    dirge !== Infinity &&
    dirge < chime.clutchWindow + chime.flight - CLUTCH_MARGIN &&
    dirge > chime.flight + 0.1
  );
}

/**
 * `bankCrescendo`: Discord at `FINALE_BANK_AT`, or due at 100 before the segment a Cue would
 * spend could come back at `FINALE_RESONANCE_RATE` with the song still to fill.
 */
function banking(d: DiscordView, resonance: number, segment: number, cost: number): boolean {
  if (d.value >= FINALE_BANK_AT) return true;
  const short = cost - Math.max(0, resonance - segment);
  return d.eta <= short / FINALE_RESONANCE_RATE;
}

/**
 * `cueFocus`: a technique that answers the Cued Solo will be ready before it lands: a Chime for
 * Lament (its clutch), a Ward for Basso Ostinato, a Reel (or Rewind; never Anchor) for the
 * Cadenza. Shatter Aria has none (Scatter, or the Focus).
 */
function soloAnswerReady(state: WorldState, w: ReadonlyEntity, cue: CueView): boolean {
  if (weaverSilenced(state)) return false;
  const wc = w.weaver!;
  const left = cue.impact - state.time;
  if (cue.solo === LAMENT)
    return (
      wc.cooldowns.chime <= left - CONTENT.techniques.chime.clutchWindow - 0.2 &&
      affords(state, 'chime')
    );
  if (cue.solo === BASSO_OSTINATO)
    return (wc.wardCharges > 0 || wc.cooldowns.ward <= left - 0.4) && affords(state, 'ward');
  if (cue.solo === CADENZA)
    return (
      wc.variants.reel !== 'anchor' && wc.cooldowns.reel <= left - 0.7 && affords(state, 'reel')
    );
  return false;
}

/**
 * Where a Reel of `hero` out of `t` must aim: `aim` when it lands them outside the shape (a plain
 * Reel lands them `landing` m from the Weaver toward her aim; a Swap, where she stands), else a
 * point straight away from the shape's centre if that does; null when no Reel takes them out.
 */
function reelOutAim(
  state: WorldState,
  w: ReadonlyEntity,
  hero: ReadonlyEntity,
  t: ReadonlyTelegraph,
  aim: { x: number; z: number },
): { x: number; z: number } | null {
  const outside = (x: number, z: number) => !contains(state, t, { ...hero, x, z });
  if (w.weaver!.variants.reel === 'swap') return outside(w.x, w.z) ? aim : null;
  const landing = CONTENT.techniques.reel.landing;
  const lands = (to: { x: number; z: number }) => {
    const dx = to.x - w.x;
    const dz = to.z - w.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    // Under 0.1 m the sim lands them along her heading: unknown here, so not trusted.
    return d >= 0.1 && outside(w.x + (dx / d) * landing, w.z + (dz / d) * landing);
  };
  if (lands(aim)) return aim;
  const s = t.shape;
  const cx = s.kind === 'circle' || s.kind === 'donut' || s.kind === 'cone' ? s.x : hero.x;
  const cz = s.kind === 'circle' || s.kind === 'donut' || s.kind === 'cone' ? s.z : hero.z;
  const dx = w.x - cx;
  const dz = w.z - cz;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 0.1) return null;
  const away = { x: w.x + (dx / d) * 5, z: w.z + (dz / d) * 5 };
  return lands(away) ? away : null;
}

/**
 * `silenceReel`: the hero to Reel out of a Grand Silence blow 0.4-0.6 s before it lands, unless
 * a Ward holds for it: the Final Cadence's target (its save is the note), else one a lesser blow
 * would kill. Never with Anchor; a Swap only while the Weaver keeps 25% of her life. A mark (the
 * Rest) follows the hero, so isn't Reeled from. Never one the Reel would land back inside the
 * blow: with `aim` (this decision's) it would, the Reel is aimed away first. Null with none.
 */
function silenceReelPick(
  state: WorldState,
  party: readonly HeroView[],
  w: ReadonlyEntity,
  range: number,
  now: number,
  aim: { x: number; z: number },
): { h: HeroView; aim: { x: number; z: number } | null } | null {
  const wc = w.weaver!;
  if (wc.variants.reel === 'anchor') return null;
  if (wc.variants.reel === 'swap' && w.health!.hp <= w.health!.maxHp * SWAP_ABOVE) return null;
  let best: { h: HeroView; score: number; aim: { x: number; z: number } } | null = null;
  for (const h of party) {
    if (h.e.hero!.reel || dist(h.e, w) > range - 0.3) continue;
    for (const t of threatsOn(state, h.e)) {
      if (!isSilenceBlow(t) || t.kind === 'mark') continue;
      const left = t.impact - now;
      if (left < SILENCE_REEL_FROM || left > SILENCE_REEL_TO) continue;
      if (h.e.health!.shields.some((s) => s.kind === 'ward' && s.expiresAt >= t.impact)) continue;
      const dmg = damageOf(t, h.e);
      const final = t.attackId === FINAL_CADENCE;
      if (!final && dmg < h.e.health!.hp + shieldOf(h.e)) continue;
      // Swap: only a blow she lives through (the plain Reel loop's guard).
      if (wc.variants.reel === 'swap' && !swapSurvives(w, h.e, damageOf(t, w))) continue;
      const to = reelOutAim(state, w, h.e, t, aim);
      if (!to) continue;
      const score = (final ? 1e6 : 0) + dmg;
      if (!best || score > best.score) best = { h, score, aim: to };
    }
  }
  if (!best) return null;
  return { h: best.h, aim: best.aim === aim ? null : best.aim };
}

/**
 * The Chronomancer's Rewind in the Grand Silence, her Reel-save note (docs/phase-5d.md, question
 * 8): with Paradox, the hero a live Final Cadence is aimed at, within `PARADOX_WITHIN` s of its
 * landing (it is cancelled); else the hero a blow took `REWIND_UNDO_AT`+ of their life from
 * within Rewind's reach (it comes back), the most first. A frozen hero can't be stepped out of a
 * shape (they haven't moved). Null with neither.
 */
function silenceRewind(
  state: WorldState,
  party: readonly HeroView[],
  w: ReadonlyEntity,
  range: number,
): HeroView | null {
  const now = state.time;
  const near = party.filter((h) => dist(h.e, w) <= range - 0.3);
  if (state.mods.paradox) {
    for (const h of near) {
      const aimed = state.telegraphs.some(
        (t) =>
          t.attackId === FINAL_CADENCE &&
          t.target === h.e.id &&
          t.impact - now <= PARADOX_WITHIN &&
          t.impact - now > 0.05,
      );
      if (aimed) return h;
    }
  }
  let best: HeroView | null = null;
  let back = 0;
  for (const h of near) {
    const past = rewindSample(h.e);
    if (!past) continue;
    const hp = h.e.health!;
    const b = (past.hp - hp.hp) / hp.maxHp;
    if (b >= REWIND_UNDO_AT && b > back) {
      best = h;
      back = b;
    }
  }
  return best;
}
