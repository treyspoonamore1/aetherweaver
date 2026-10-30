import {
  CONTENT,
  auraDef,
  callingDef,
  encounterDef,
  enemyDef,
  heroDef,
  ornamentDef,
} from '../content';
import { liveBindings } from '../input/bindings';
import {
  auraIds,
  canPay,
  reservePool,
  resolveChord,
  rewindCanRevive,
  songReserveOf,
  techniqueCost,
  vowHoldsAt,
  type EntityId,
  type ReadonlyEntity,
  type TechniqueKey,
  type WorldState,
} from '../sim';
import { dissonancePoints, parMult } from '../meta/dissonance';
import { relicHuds } from './hud/relics';
import { callingHud, lifeMarksOf, masteryCooldown, shineOf, stasisSeconds } from './hud/calling';
import { treeAfterglow, treeBleedOutMult, treeGrace } from './screens/astrolabeModel';
import {
  foreseenAll,
  foreseenOn,
  landsOn,
  masteryResets,
  rewindPreview,
  type Foreseen,
} from './hud/chrono';
import { REWIND_NAME, crescendoName, rewindSeconds } from './screens/callingText';
import { soloView } from './screens/bondsModel';
import { slotCost, variantHud } from './screens/variantsModel';
import { techniqueIcon } from './kit/variantLook';
import type { AuraHud, BossHud, ChordHud, HeroHud, HudSnapshot, TechniqueHud } from './store';

const TECHNIQUE_KEYS: readonly TechniqueKey[] = ['ward', 'chime', 'reel', 'glide'];
const BLEED_OUT = 12;
const BOSS_PHASES: Record<string, number> = { the_bellwarden: 2, the_hollow_cantor: 3 };

/** Fermata hold: time left to heal them. */
function heldOf(e: ReadonlyEntity, now: number): HeroHud['held'] {
  const hold = e.hero?.hold;
  if (!hold) return null;
  const status = e.health?.statuses.find((s) => s.id === 'held');
  return {
    remaining: Math.max(0, hold.until - now),
    total: Math.max(0.01, status?.duration ?? hold.until - now),
  };
}

function totalShield(e: ReadonlyEntity): number {
  let total = 0;
  for (const s of e.health?.shields ?? []) total += s.amount;
  return total;
}

/**
 * The Crescendo's full length for its ring, from content: Sunrise's, the Martyr's Vow (`vow`)
 * or Stasis (`stasis`, Eternal Moment's seconds added).
 */
function crescendoTotal(calling: { id: string; path: string[]; crescendo: string } | null): number {
  if (calling?.crescendo === 'stasis') return stasisSeconds(calling.id, calling.path);
  if (calling?.crescendo === 'vow')
    return callingDef(calling.id).values.vow ?? CONTENT.crescendo.duration;
  return CONTENT.crescendo.duration;
}

/**
 * Builds the HUD snapshot from sim state: plain numbers and strings only, so React never
 * holds references into the live simulation. Called at 15 Hz by the runtime.
 */
export function buildHudSnapshot(
  state: WorldState,
  opts: { seed: number; hovered: EntityId | null },
): HudSnapshot {
  const weaverEntity = state.entities.get(state.weaverId);
  const w = weaverEntity?.weaver;
  const wh = weaverEntity?.health;
  const tech = CONTENT.techniques;

  const sunrise = state.field.crescendo;
  const vow = state.field.vow;
  // The Chronomancer (Phase 3e): Stasis holds every enemy; Rewind takes Reel's slot.
  const stasis = state.field.stasis;
  // Martyr's Vow holds every hero at 1 life: nothing that lands before it ends is lethal.
  const vowCovers =
    vow && state.telegraphs.every((t) => t.effect !== 'damage' || vowHoldsAt(state, t.impact));
  const calling = state.calling
    ? {
        id: state.calling.id,
        path: [...state.calling.path],
        radiancePerAura: state.calling.radiancePerAura,
        sunriseMult: state.calling.sunriseMult,
        sovereign: state.calling.sovereign,
        crescendo: state.calling.crescendo,
        bearShare: state.calling.bearShare,
        rewind: state.calling.rewind,
        foresight: state.calling.foresight,
      }
    : null;
  const rewinds = !!calling?.rewind;
  const reelTech = tech.reel;
  // What a technique costs now, and whether it can be paid, are the sim's own (`techniqueCost`,
  // `canPay`): the Astrolabe's Economy, Stasis's discount, Eldritch Conduit's Life.
  const rewindReady =
    rewinds &&
    !(wh?.downed ?? true) &&
    ((w?.cooldowns.reel ?? 0) <= 0.05 || stasis) &&
    canPay(state, 'reel');
  // The Astrolabe (Phase 4): the tree this fight.
  const tree = state.astrolabe.nodes;
  const afterglowTotal = treeAfterglow(tree);
  const grace = treeGrace(tree);
  const graceCap = (grace?.values.cap ?? 0) / 100;
  // F Rewinds the hovered hero, else the threaded one (the input's smart-cast).
  const hoveredSlot = opts.hovered === null ? -1 : state.party.indexOf(opts.hovered);
  const rewindSlot = hoveredSlot >= 0 ? hoveredSlot : (w?.threadSlot ?? null);
  const paradox = !!calling?.path.includes('paradox');
  // Rewind stands a hero back up once a run (the sim's `rewindCanRevive`).
  const canRevive = rewinds && rewindCanRevive(state);
  const foreseen: Foreseen[] = calling && calling.foresight > 0 ? foreseenAll(state) : [];
  const timers = !!state.calling?.timers;
  // The Martyr (Phase 3d): her whole Life, what her songs hold, Bear on the threaded hero.
  const lifeTotal = w?.maxLife ?? wh?.maxHp ?? 0;
  const bearing = w?.threadMode === 'bear' && (calling?.bearShare ?? 0) > 0;
  const lifeMarks = calling ? lifeMarksOf(calling.path, wh?.hp ?? 0, lifeTotal) : [];

  const party: HeroHud[] = [];
  state.party.forEach((id, slot) => {
    const e = state.entities.get(id);
    const hero = e?.hero;
    const h = e?.health;
    if (!e || !hero || !h) return;
    const def = heroDef(hero.defId);
    const shield = totalShield(e);
    const up = !h.dead && !h.downed;
    // Afterglow: Empower lingers on a hero the Thread left (the threaded one has the real thing).
    const glow = hero.afterglowUntil - state.time;
    const empowering = w?.threadSlot === slot && w.threadMode === 'empower';
    // Overflowing Grace: Mend's overheal as a shield on the hero, the one the sim marks `grace`.
    const graceShield = grace ? h.shields.find((s) => s.grace && s.amount > 0) : undefined;
    // Bonds (Phase 4e): the Solo they brought, their own or the alternate.
    const soloDef = soloView(def.id, hero.soloId);
    party.push({
      id,
      slot,
      defId: def.id,
      name: def.name,
      title: def.title,
      role: def.role,
      color: def.color,
      hp: h.hp,
      maxHp: h.maxHp,
      shield,
      shields: h.shields.map((s) => ({ kind: s.kind, amount: s.amount, max: s.max })),
      incoming: h.incoming,
      lethal: !vowCovers && h.incoming > 0 && h.incoming >= h.hp + shield,
      statuses: h.statuses.map((s) => ({
        id: s.id,
        remaining: s.remaining >= 1e8 ? 0 : s.remaining,
        duration: s.duration >= 1e8 ? 0 : s.duration,
      })),
      downed: h.downed && !h.dead,
      bleedOut: h.bleedOut,
      // Grit (the Astrolabe) lets them bleed out slower.
      bleedOutMax: BLEED_OUT * treeBleedOutMult(tree),
      revive: h.revive,
      dead: h.dead,
      solo: hero.solo,
      soloReady: hero.solo >= 100 && hero.soloActive <= 0,
      soloActive: hero.soloActive > 0,
      soloId: soloDef.id,
      soloName: soloDef.name,
      soloText: soloDef.text,
      soloCued: soloDef.cued,
      soloAlt: soloDef.alt,
      talents: [...hero.talents],
      castName: hero.castName,
      castProgress: hero.castProgress,
      action: hero.action,
      distance: weaverEntity ? Math.hypot(e.x - weaverEntity.x, e.z - weaverEntity.z) : 0,
      inField: hero.inField,
      auras: auraIds(CONTENT, hero.auraMask),
      call: hero.call
        ? {
            answer: hero.call.answer,
            remaining: Math.max(0, hero.call.end - state.time),
            total: Math.max(0.01, hero.call.end - hero.call.start),
            flourish: def.call.flourish.name,
            answered: hero.call.answered,
          }
        : null,
      held: heldOf(e, state.time),
      follow: hero.follow,
      threaded: w?.threadSlot === slot,
      beamFocus: hero.beamFocus,
      radiance: h.dead || h.downed ? 0 : shineOf(hero, calling, sunrise),
      borne: bearing && w?.threadSlot === slot && !h.dead && !h.downed ? calling!.bearShare : 0,
      vow: vow && !h.dead && !h.downed,
      rewind: rewinds
        ? rewindPreview(state, e, {
            target: rewindSlot === slot,
            inRange: weaverEntity
              ? Math.hypot(e.x - weaverEntity.x, e.z - weaverEntity.z) <= reelTech.range
              : false,
            paradox,
            canRevive,
          })
        : null,
      foreseen: h.dead ? [] : foreseenOn(foreseen, id),
      lands: timers && !h.dead && !h.downed ? landsOn(state, e) : null,
      afterglow:
        afterglowTotal > 0 && glow > 0 && up && !empowering
          ? { remaining: glow, total: Math.max(afterglowTotal, glow) }
          : null,
      grace:
        graceShield && up
          ? {
              amount: graceShield.amount,
              remaining: Math.max(0, graceShield.expiresAt - state.time),
              cap: h.maxHp * graceCap,
            }
          : null,
      hovered: opts.hovered === id,
    });
  });

  const bindings = liveBindings();
  // Skate (Phase 4f): Glide's slot runs on its charges (`glideCharges`), each back after its
  // cooldown: it's ready while one is left, whatever the cooldown says.
  const glideCharges = w?.variants.glide === 'skate' || (w?.maxGlideCharges ?? 1) > 1;
  const techniques: TechniqueHud[] = TECHNIQUE_KEYS.map((key) => {
    const rewind = key === 'reel' && rewinds;
    // Technique variants (Phase 4f): the slot's own, unless Rewind takes Reel's slot.
    const variant = rewind ? null : variantHud(w?.variants[key]);
    // Glide is free; the others cost what the sim says (a variant's own cost included), from
    // the pool it says.
    const cost = key === 'glide' ? null : techniqueCost(state, key);
    const charges =
      key === 'ward'
        ? (w?.wardCharges ?? 0)
        : key === 'glide' && glideCharges
          ? (w?.glideCharges ?? 0)
          : (w?.cooldowns[key] ?? 0) > 0
            ? 0
            : 1;
    const maxCharges =
      key === 'ward'
        ? (w?.maxWardCharges ?? 1)
        : key === 'glide' && glideCharges
          ? (w?.maxGlideCharges ?? 1)
          : 1;
    return {
      key,
      name: rewind ? REWIND_NAME : (variant?.name ?? tech[key].name),
      remaining: w?.cooldowns[key] ?? 0,
      total: w?.cooldownTotals[key] ?? 0,
      cost: cost?.amount ?? 0,
      charges,
      maxCharges,
      affordable: key === 'glide' ? true : canPay(state, key),
      key0: bindings[key][0] ?? '',
      icon: rewind ? 'rewind' : techniqueIcon(key, variant?.id ?? null),
      free: stasis,
      // As `techniqueCost` prices it: the slot's variant's own cost, if it has one.
      baseCost:
        key === 'glide' ? 0 : (slotCost(key, w?.variants[key]) ?? 0) * state.astrolabe.techCostMult,
      pool: cost?.pool ?? 'spirit',
      variant,
    };
  });

  let boss: BossHud | null = null;
  let enemies = 0;
  let dummyCount = 0;
  for (const e of state.entities.list()) {
    if (e.kind === 'dummy') dummyCount++;
    if (e.enemy && e.health && !e.health.dead) enemies++;
  }
  const bossEntity =
    state.encounter.bossId === null ? undefined : state.entities.get(state.encounter.bossId);
  if (bossEntity?.enemy && bossEntity.health) {
    const def = enemyDef(bossEntity.enemy.defId);
    const cast = bossEntity.enemy.cast;
    const telegraph =
      cast?.telegraph == null ? undefined : state.telegraphs.find((t) => t.id === cast.telegraph);
    boss = {
      id: bossEntity.id,
      name: def.name,
      hp: bossEntity.health.hp,
      maxHp: bossEntity.health.maxHp,
      shield: totalShield(bossEntity),
      phase: bossEntity.enemy.phase,
      phases: BOSS_PHASES[def.id] ?? 1,
      cast: cast
        ? {
            name: cast.name,
            progress: Math.min(
              1,
              (state.time - cast.start) / Math.max(0.01, cast.end - cast.start),
            ),
            answers: telegraph ? [...telegraph.answers] : [],
          }
        : null,
      enrageIn:
        state.encounter.enrageAt === null
          ? null
          : Math.max(0, state.encounter.enrageAt - state.time),
      decree:
        state.encounter.decree && state.time - state.encounter.decree.at < 10
          ? { name: state.encounter.decree.name, text: state.encounter.decree.text }
          : null,
      foreseen: bossForeseen(state, foreseen, bossEntity.id),
    };
  }

  // What the songs reserve from (the Martyr's or Sanguine Font's Life), and the tree's share of
  // it (Clear Voice, Breath, Eldritch Conduit, Sanguine Font): what each aura really holds.
  const songCalling = state.calling
    ? { id: state.calling.id, path: [...state.calling.path] }
    : null;
  // The carried relics' "songs reserve % less" too (the Reliquary, docs/phase-4c.md).
  const songs = songReserveOf(songCalling, tree, CONTENT, state.astrolabe.passives);
  const chords: ChordHud[] = state.field.chords.map((c) => {
    const folded = resolveChord({ auras: [...c.auras], ornaments: [...c.ornaments] }, c.index);
    const auras: AuraHud[] = c.auras.map((id) => {
      const def = auraDef(id);
      return {
        id,
        name: def.name,
        color: def.color,
        reserve: def.reserve * folded.reserveMult * songs.mult,
      };
    });
    const slot = c.threadHero === null ? -1 : state.party.indexOf(c.threadHero);
    return {
      index: c.index,
      role: c.role,
      auras,
      ornaments: c.ornaments.map((id) => {
        const def = ornamentDef(id);
        return { id, name: def.name, color: def.color };
      }),
      anchor: c.anchor,
      radius: c.radius,
      focus: c.focus,
      echo: c.echo,
      threadSlot: slot >= 0 ? slot : null,
    };
  });
  const l = state.ledger;
  const contribution = {
    auras: { healing: l.auras.healing, shielded: l.auras.shielded, amplified: l.auras.amplified },
    thread: { healing: l.thread.healing, amplified: l.thread.amplified },
    total: l.healing + l.shielded + l.negated + l.amplified,
  };

  const enc = state.encounter;
  const encDef = encounterDef(enc.id);
  const resonance = CONTENT.resonance;
  return {
    tick: state.tick,
    seconds: state.time,
    seed: opts.seed,
    weaver: {
      x: weaverEntity?.x ?? 0,
      z: weaverEntity?.z ?? 0,
      life: wh?.hp ?? 0,
      maxLife: wh?.maxHp ?? 0,
      lifeTotal,
      reservedLife: w?.reservedLife ?? 0,
      pool: reservePool(songCalling, CONTENT, tree),
      lifeMarks,
      lifeCap: state.astrolabe.lifeCapPct < 1 && wh ? wh.maxHp * state.astrolabe.lifeCapPct : null,
      downed: wh?.downed ?? false,
      reform: w?.reform ?? 0,
      spirit: w?.spirit ?? 0,
      maxSpirit: w?.maxSpirit ?? 0,
      reserved: w?.reservedSpirit ?? 0,
      resonance: w?.resonance ?? 0,
      resonanceMax: resonance.max,
      segment: resonance.segment,
      // Silent Cues (Phase 4d) raises it: the fight's own.
      cueCost: state.dissonance.cueCost,
      crescendoCost: resonance.crescendoCost,
      crescendo: w?.crescendo ?? 0,
      // Sunrise is the Weaver's own; the Vow and Stasis are the Calling's (content `crescendoName`).
      crescendoName: crescendoName(
        calling && calling.crescendo !== 'sunrise' ? callingDef(calling.id) : null,
      ),
      threadMode: w?.threadMode ?? 'mend',
      lastMode: w?.lastMode ?? 'mend',
      bearShare: calling?.bearShare ?? 0,
      vow,
      stasis,
      crescendoTotal: crescendoTotal(calling),
      rewind: rewinds
        ? { seconds: rewindSeconds(calling!.id), range: reelTech.range, ready: rewindReady }
        : null,
      mastery: masteryHud(calling?.path ?? [], w, state.time),
      threadSlot: w?.threadSlot ?? null,
      threadTension: w?.threadTension ?? 0,
      threadLock: w?.threadLock ?? 0,
      techniques,
      auras: chords.flatMap((c) => c.auras),
      chords,
      fieldRadius: state.field.radius,
      fieldSuppressed: state.field.suppressed,
      plant: state.field.chords.some((c) => c.anchor === 'planted')
        ? {
            remaining: w?.plantCooldown ?? 0,
            total: CONTENT.weaver.plantCooldown,
            key0: bindings.plant[0] ?? '',
          }
        : null,
    },
    party,
    boss,
    encounter: {
      id: enc.id,
      name: enc.name,
      kind: enc.kind,
      status: enc.status,
      wave: enc.wave,
      waves: enc.waves,
      elapsed: enc.status === 'intro' ? 0 : (enc.endedAt ?? state.time) - enc.startedAt,
      // As the run grades it (Phase 4d): Dissonance's extra life lengthens the par.
      par: Math.round(encDef.par * parMult(state.dissonance.levels, encDef.kind)),
      enemies,
    },
    directive: state.directive,
    focusTarget: state.focusTarget,
    contribution,
    relics: relicHuds({
      relics: state.relics,
      time: state.time,
      ledger: { perfects: l.perfects, downs: l.downs },
    }),
    calling: callingHud(
      calling,
      sunrise,
      { vow, bearing, undyingReady: w?.undying ?? false, marks: lifeMarks },
      {
        stasis,
        masteryIn: Math.max(0, (w?.masteryAt ?? 0) - state.time),
        revive: rewinds ? (canRevive ? 'ready' : 'spent') : null,
      },
    ),
    astrolabe:
      tree.length > 0 ? { stars: tree.length, keystones: [...state.astrolabe.keystones] } : null,
    // Dissonance (Phase 4d): the levels in force, and Blind Score for the hints and the boss bar.
    dissonance:
      state.dissonance.levels.length > 0
        ? {
            levels: state.dissonance.levels.map((l) => ({ id: l.id, rank: l.rank })),
            points: dissonancePoints(state.dissonance.levels),
            blindScore: state.dissonance.blindScore,
          }
        : null,
    entityCount: state.entities.count,
    dummyCount,
  };
}

/** Temporal Mastery on the Weaver bar: ready or recovering, and what a Glide would bring back. */
function masteryHud(
  path: readonly string[],
  w: ReadonlyEntity['weaver'],
  now: number,
): HudSnapshot['weaver']['mastery'] {
  const total = masteryCooldown(path);
  if (total === null || !w) return null;
  const remaining = Math.max(0, Math.min(total, w.masteryAt - now));
  return {
    ready: remaining <= 0.05,
    remaining,
    total,
    resets: masteryResets({
      lastTechnique: w.lastTechnique,
      wardCharges: w.wardCharges,
      maxWardCharges: w.maxWardCharges,
      cooldowns: w.cooldowns,
    }),
  };
}

/** Foresight on the boss bar: the boss's next attack, and the hero it picked. */
function bossForeseen(
  state: WorldState,
  foreseen: readonly Foreseen[],
  bossId: EntityId,
): BossHud['foreseen'] {
  const f = foreseen.find((x) => x.enemy === bossId);
  if (!f) return null;
  // A link picks two heroes; the frames mark both, so the bar names both.
  const names = f.targets.flatMap((id) => {
    const hero = state.entities.get(id)?.hero;
    return hero ? [heroDef(hero.defId).name] : [];
  });
  return { name: f.name, in: f.in, target: names.length > 0 ? names.join(' & ') : null };
}
