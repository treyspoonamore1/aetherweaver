/**
 * Skilled bot: plays the Weaver the way the design intends — positions so the field covers
 * the party, threads by effective HP, times Wards into the Perfect window, Chimes marks late
 * (clutch), Reels heroes out of lethal shapes, revives, Cues Solos into the right moments
 * and fires the Crescendo when the party needs it. Phase 2: heals heroes held by Fermata,
 * answers calls when the answer isn't needed for something more urgent, plants Pedal Point
 * fields under the party and keeps a Unison Chord on the hero it suits.
 */
import { CONTENT } from '../content';
import { Rng } from '../sim/core/rng';
import type { Command, PartySlot, ReadonlyEntity, ThreadMode, WorldState } from '../sim';
import type { Bot } from './types';
import {
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
  type HeroView,
} from './common';

export interface SkilledOptions {
  /** Ticks between decisions (reaction granularity). */
  every: number;
  /** Chance to notice a given opportunity in time (1 = perfect attention). */
  attention: number;
  /** Seconds before answering a hero's call (human reaction). */
  callReaction: number;
}

/** The Solos that guard the party (Bonds' alternates included); the rest deal damage. */
const GUARDING: ReadonlySet<string> = new Set(['aegisWall', 'oathkeeper', 'celestial_sphere']);

export class SkilledBot implements Bot {
  readonly name: string;
  private readonly intent = new Intent();
  private readonly rng: Rng;
  private lastRally = -100;
  private lastFocus = -100;
  private kaelAwaySince: number | null = null;

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
    if (state.tick % this.opts.every !== 0) return out;
    const w = weaverOf(state);
    const wc = w.weaver!;
    if (state.encounter.status !== 'fighting' && state.encounter.status !== 'intro') return out;
    if (w.health!.downed) return out;

    const party = partyOf(state);
    const all = partyOf(state, true);
    const enemies = enemiesOf(state);
    const tech = CONTENT.techniques;
    const now = state.time;
    let acted = false;

    // ── Movement: cover the party with the field, stay out of danger, keep off melee. ──
    const desired = this.position(state, w, party, enemies);
    const danger = threatsOn(state, w).find((t) => t.impact - now < 0.9);
    if (danger) {
      const escape = escapeFrom(danger, w, w.radius + 1.2);
      if (escape) {
        if (danger.impact - now < 0.35 && wc.cooldowns.glide <= 0) {
          out.push({ t: 'glide', x: escape.x - w.x, z: escape.z - w.z });
        }
        this.intent.moveTo(out, w, escape, 0.2);
      } else this.intent.moveTo(out, w, desired);
    } else {
      this.intent.moveTo(out, w, desired);
    }
    const target = centroid(enemies.length > 0 ? enemies : party.map((h) => h.e));
    this.intent.aim(out, target.x, target.z);

    // ── Pedal Point: keep the planted field under the party. ──
    const planted = plantedChord(state);
    if (planted && wc.plantCooldown <= 0 && party.length > 0) {
      const spot = plantSpot(party);
      if (
        dist(spot, planted) > Math.max(1.5, planted.radius * 0.4) &&
        dist(spot, w) <= CONTENT.weaver.plantRange - 0.5
      )
        out.push(plantCommand(spot));
    }

    const held = heldHero(party);
    const calling = caller(party);
    const call = calling?.e.hero!.call ?? null;
    const answerNow = !!call && now - call.start >= this.opts.callReaction;
    // A big hit soon: keep the Ward for its Perfect window rather than spend it on a call.
    const bigHitSoon =
      wc.wardCharges < 2 &&
      party.some((p) =>
        threatsOn(state, p.e).some(
          (t) => t.impact - now < 2.5 && damageOf(t, p.e) > p.e.health!.maxHp * 0.25,
        ),
      );

    // ── Ward: Perfect timing on incoming hits; emergency shields otherwise. ──
    if (wc.wardCharges > 0 && affords(state, 'ward')) {
      const window = tech.ward.perfectWindow;
      let best: { slot: PartySlot; score: number } | null = null;
      for (const h of party) {
        if (dist(h.e, w) > tech.ward.range - 0.3) continue;
        for (const t of threatsOn(state, h.e)) {
          const left = t.impact - now;
          if (left > window - 0.06 || left < 0.04) continue;
          const dmg = damageOf(t, h.e);
          if (dmg < h.e.health!.maxHp * 0.15) continue;
          const lethal = dmg >= h.e.health!.hp + shieldOf(h.e);
          const score = dmg + (lethal ? 5000 : 0);
          if (!best || score > best.score) best = { slot: h.slot, score };
        }
      }
      if (best && this.notice()) {
        out.push({ t: 'tech', id: 'ward', slot: best.slot });
        acted = true;
      } else if (
        answerNow &&
        call!.answer === 'ward' &&
        !bigHitSoon &&
        dist(calling!.e, w) < tech.ward.range - 0.3 &&
        this.notice()
      ) {
        out.push({ t: 'tech', id: 'ward', slot: calling!.slot });
        acted = true;
      } else if (!acted) {
        const low = party.filter(
          (h) => effectiveFraction(h.e) < 0.3 && dist(h.e, w) < tech.ward.range - 0.3,
        );
        const soon = party.some((h) => threatsOn(state, h.e).some((t) => t.impact - now < 1.6));
        if (low.length > 0 && !soon && affords(state, 'ward', 15)) {
          low.sort((a, b) => effectiveFraction(a.e) - effectiveFraction(b.e));
          out.push({ t: 'tech', id: 'ward', slot: low[0]!.slot });
          acted = true;
        }
      }
    }

    // ── Chime: cleanse marks late (clutch), or anyone silenced/stunned. ──
    if (!acted && wc.cooldowns.chime <= 0 && affords(state, 'chime')) {
      let pick: HeroView | null = null;
      for (const h of party) {
        const dirge = statusRemaining(h.e, 'dirge');
        const flight = tech.chime.flight + 0.1;
        if (
          dirge !== Infinity &&
          dirge < tech.chime.clutchWindow + flight - 0.05 &&
          dirge > flight
        ) {
          pick = h;
          break;
        }
        if (statusRemaining(h.e, 'silence') < Infinity || statusRemaining(h.e, 'stun') < Infinity)
          pick = h;
      }
      if (pick && dist(pick.e, w) < tech.chime.range && this.notice()) {
        out.push({ t: 'tech', id: 'chime', point: { x: pick.e.x, z: pick.e.z } });
        acted = true;
      } else if (!pick && held && dist(held.e, w) < tech.chime.range && this.notice()) {
        // A Chime heals a held hero too.
        out.push({ t: 'tech', id: 'chime', point: { x: held.e.x, z: held.e.z } });
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
      }
    }

    // ── Rewind (the Chronomancer, in Reel's slot): stand back up a hero who just went down, or
    // give back a big blow to one still in danger. ──
    if (state.calling?.rewind) {
      if (!acted && wc.cooldowns.reel <= 0 && affords(state, 'reel')) {
        const pick = rewindPick(state, all, w, tech.reel.range);
        if (pick && this.notice()) out.push({ t: 'tech', id: 'reel', slot: pick.slot });
      }
    } else if (!acted && wc.cooldowns.reel <= 0 && affords(state, 'reel')) {
      // ── Reel: pull a hero out of a big hit they won't escape (beams, rings). ──
      for (const h of party) {
        if (h.e.hero!.action === 'dodging' || h.e.hero!.reel) continue;
        if (dist(h.e, w) > tech.reel.range - 0.3) continue;
        const t = threatsOn(state, h.e).find(
          (x) => x.kind !== 'mark' && x.kind !== 'raid' && x.kind !== 'link',
        );
        if (!t) continue;
        const left = t.impact - now;
        const dmg = damageOf(t, h.e);
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
    if (held) {
      threadTo = held;
    } else if (downed.length > 0) {
      downed.sort((a, b) => a.e.health!.bleedOut - b.e.health!.bleedOut);
      threadTo = downed[0]!;
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
        if (through > he.hp * 0.6 && through * share < me.hp - me.maxHp * 0.3) want = 'bear';
      }
    }
    out.push(...modeCommands(wc.threadMode, want));

    // ── Cues and the Crescendo. ──
    const segment = state.dissonance.cueCost;
    const raid = state.telegraphs.find((t) => t.kind === 'raid');
    const bossFight = state.encounter.bossId !== null;
    if (wc.resonance >= segment) {
      for (const h of party) {
        const c = h.e.hero!;
        if (c.solo < 100 || c.soloActive > 0) continue;
        let go: boolean;
        // A Solo that guards the party waits for a raid or a big hit; one that deals damage, a pack.
        if (GUARDING.has(c.soloId)) {
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
        // Save one segment for the Requiem dome in boss phase 3.
        if (
          go &&
          !GUARDING.has(c.soloId) &&
          bossFight &&
          wc.resonance < segment * 2 &&
          this.guardReady(party)
        )
          go = false;
        if (go) {
          out.push({ t: 'cue', slot: h.slot });
          break;
        }
      }
    }
    if (wc.resonance >= CONTENT.resonance.crescendoCost && wc.crescendo <= 0) {
      const avg =
        party.reduce((s, h) => s + h.e.health!.hp / h.e.health!.maxHp, 0) /
        Math.max(1, party.length);
      if (avg < 0.6 || (raid && raid.impact - now < 2.5) || downed.length > 0)
        out.push({ t: 'crescendo' });
    }

    // ── Directives: scatter for links, stack (rally) for rings, then back to normal. ──
    const link = state.telegraphs.find((t) => t.kind === 'link');
    const ring = state.telegraphs.find((t) => t.kind === 'donut');
    if (link && state.directive !== 'scatter') out.push({ t: 'directive', kind: 'scatter' });
    else if (ring && !link && now - this.lastRally > 2) {
      out.push({ t: 'directive', kind: 'rally' });
      this.lastRally = now;
    } else if (!link && state.directive === 'scatter') out.push({ t: 'directive', kind: 'rally' });

    // ── Focus interruptible casters / Mutes; rally a wandering tank. ──
    if (now - this.lastFocus > 4) {
      const caster =
        enemies.find((e) => e.enemy!.cast?.interruptible) ??
        enemies.find((e) => e.enemy!.defId === 'mute');
      if (caster && state.focusTarget !== caster.id) {
        out.push({ t: 'directive', kind: 'focus', target: caster.id });
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
    // Hymn circles: stand in the one nearest the party.
    if (state.field.hymnCircles.length > 0) {
      let best = state.field.hymnCircles[0]!;
      for (const h of state.field.hymnCircles) if (dist(h, c) < dist(best, c)) best = h;
      x = best.x;
      z = best.z;
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
