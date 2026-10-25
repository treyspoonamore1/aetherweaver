import { CONTENT, auraDef, encounterDef, enemyDef, heroDef, ornamentDef } from '../content';
import { liveBindings } from '../input/bindings';
import {
  auraIds,
  resolveChord,
  type EntityId,
  type ReadonlyEntity,
  type TechniqueKey,
  type WorldState,
} from '../sim';
import { relicHuds } from './hud/relics';
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

  const party: HeroHud[] = [];
  state.party.forEach((id, slot) => {
    const e = state.entities.get(id);
    const hero = e?.hero;
    const h = e?.health;
    if (!e || !hero || !h) return;
    const def = heroDef(hero.defId);
    const shield = totalShield(e);
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
      lethal: h.incoming > 0 && h.incoming >= h.hp + shield,
      statuses: h.statuses.map((s) => ({
        id: s.id,
        remaining: s.remaining >= 1e8 ? 0 : s.remaining,
        duration: s.duration >= 1e8 ? 0 : s.duration,
      })),
      downed: h.downed && !h.dead,
      bleedOut: h.bleedOut,
      bleedOutMax: BLEED_OUT,
      revive: h.revive,
      dead: h.dead,
      solo: hero.solo,
      soloReady: hero.solo >= 100 && hero.soloActive <= 0,
      soloActive: hero.soloActive > 0,
      soloName: def.solo.name,
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
      hovered: opts.hovered === id,
    });
  });

  const bindings = liveBindings();
  const techniques: TechniqueHud[] = TECHNIQUE_KEYS.map((key) => {
    const free = w?.spirit ?? 0;
    const cost = key === 'glide' ? 0 : tech[key].cost;
    const charges = key === 'ward' ? (w?.wardCharges ?? 0) : (w?.cooldowns[key] ?? 0) > 0 ? 0 : 1;
    const maxCharges = key === 'ward' ? (w?.maxWardCharges ?? 1) : 1;
    return {
      key,
      name: tech[key].name,
      remaining: w?.cooldowns[key] ?? 0,
      total: w?.cooldownTotals[key] ?? 0,
      cost,
      charges,
      maxCharges,
      affordable: free + 1e-9 >= cost,
      key0: bindings[key][0] ?? '',
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
    };
  }

  const chords: ChordHud[] = state.field.chords.map((c) => {
    const folded = resolveChord({ auras: [...c.auras], ornaments: [...c.ornaments] }, c.index);
    const auras: AuraHud[] = c.auras.map((id) => {
      const def = auraDef(id);
      return { id, name: def.name, color: def.color, reserve: def.reserve * folded.reserveMult };
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
      downed: wh?.downed ?? false,
      reform: w?.reform ?? 0,
      spirit: w?.spirit ?? 0,
      maxSpirit: w?.maxSpirit ?? 0,
      reserved: w?.reservedSpirit ?? 0,
      resonance: w?.resonance ?? 0,
      resonanceMax: resonance.max,
      segment: resonance.segment,
      crescendoCost: resonance.crescendoCost,
      crescendo: w?.crescendo ?? 0,
      crescendoName: CONTENT.crescendo.name,
      threadMode: w?.threadMode ?? 'mend',
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
      par: encDef.par,
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
    entityCount: state.entities.count,
    dummyCount,
  };
}
