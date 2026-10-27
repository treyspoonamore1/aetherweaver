/**
 * The Astrolabe in the sim (docs/phase-4.md): what a tree of allocated nodes does to the mods,
 * and the helpers the HUD, the run layer and the bots share so they agree with the sim: what
 * the songs reserve and what a technique costs. Content stores values in display units
 * (5 = 5%, 0.03 = 0.03 s).
 */
import { CONTENT } from '../content';
import type { AstrolabeNode, Content } from '../content/schema';
import type { ReservePool } from './chords';
import type { Mods } from './mods';
import type { WorldState } from './state';

/** Every effect a node can have. A node with another is a content bug (a test checks). */
export const KNOWN_ASTROLABE_EFFECTS: readonly string[] = [
  'none',
  // Silk
  'thread',
  'spun_silver',
  'mend',
  'second_stitch',
  'overflowing_grace',
  'empower',
  'afterglow',
  'life',
  'sanguine_font',
  // Choir
  'aura_effect',
  'clear_voice',
  'held_note',
  'prism_covenant',
  'reserve',
  'field',
  'unbroken_chorus',
  // Aegis
  'ward',
  'shieldwright',
  'perfect',
  'ringing_parry',
  'shatterproof_halo',
  'tech_cost',
  'tech_cooldown',
  'bell_tower',
  'spirit_regen',
  'eldritch_conduit',
  // Bond
  'hero_life',
  'hero_damage',
  'fellowship',
  'bleed_out',
  'close_ranks',
  'revive_speed',
  'second_wind',
  'solo_charge',
  'cued_solo',
  'ready_answer',
  'ensemble',
  // Bridges
  'resonant_thread',
  'anthem',
  'shield_bearer',
  'lifeguard',
];

/** The tree's nodes that exist, each once, in content order (unknown ids are ignored). */
export function treeNodes(ids: readonly string[], content: Content = CONTENT): AstrolabeNode[] {
  if (ids.length === 0) return [];
  const set = new Set(ids);
  return content.astrolabe.nodes.filter((n) => set.has(n.id));
}

/** The keystones in a tree. */
export function treeKeystones(ids: readonly string[], content: Content = CONTENT): string[] {
  return treeNodes(ids, content)
    .filter((n) => n.kind === 'keystone')
    .map((n) => n.id);
}

/**
 * The songs' reservation from a tree: what the share is multiplied by (Clear Voice and Breath
 * add up to "% less"; Eldritch Conduit multiplies on top), and Sanguine Font's Life.
 */
function treeReserve(nodes: readonly AstrolabeNode[]): {
  mult: number;
  life: boolean;
  lifeMult: number;
} {
  let less = 0;
  let mult = 1;
  let life = false;
  let lifeMult = 1;
  for (const n of nodes) {
    const v = n.values;
    switch (n.effect) {
      case 'clear_voice':
        less += v.reserve ?? 0;
        break;
      case 'reserve':
        less += v.pct ?? 0;
        break;
      case 'eldritch_conduit':
        mult *= 1 - (v.reserve ?? 0) / 100;
        break;
      case 'sanguine_font':
        life = true;
        lifeMult = (v.share ?? 100) / 100;
        break;
    }
  }
  return { mult: Math.max(0, 1 - less / 100) * mult, life, lifeMult };
}

/**
 * What the songs reserve and how much (docs/phase-4.md): the pool (the Calling's, or Life with
 * Sanguine Font) and the multiplier on the songs' share of it. `chordProblems` checks a
 * loadout with both (`opts.pool`, `opts.reserveMult`), as the fight will hold it.
 */
export function songReserve(
  callingReservesLife: boolean,
  ids: readonly string[],
  content: Content = CONTENT,
): { pool: ReservePool; mult: number } {
  const r = treeReserve(treeNodes(ids, content));
  return {
    pool: callingReservesLife || r.life ? 'life' : 'spirit',
    mult: r.mult * (r.life ? r.lifeMult : 1),
  };
}

/** Folds a tree into the mods. Applied last: the tree builds on what the run gave. */
export function applyAstrolabe(m: Mods, ids: readonly string[], content: Content): void {
  const nodes = treeNodes(ids, content);
  if (nodes.length === 0) return;
  // "% more" from the travel nodes adds up within the tree, then multiplies the run's.
  let thread = 0;
  let mend = 0;
  let empower = 0;
  let life = 0;
  let auraEffect = 0;
  let field = 0;
  let ward = 0;
  let techCost = 0;
  let techCooldown = 0;
  let spiritRegen = 0;
  let heroLife = 0;
  let heroDamage = 0;
  let bleedOut = 0;
  let revive = 0;
  let solo = 0;
  let cued = 0;
  for (const n of nodes) {
    const v = n.values;
    const pct = v.pct ?? 0;
    switch (n.effect) {
      case 'thread':
        thread += pct;
        break;
      case 'spun_silver':
        m.threadRangeBonus += v.range ?? 0;
        thread += pct;
        break;
      case 'mend':
        mend += pct;
        break;
      case 'second_stitch':
        m.mendLowBonus += pct / 100;
        m.mendLowBelow = Math.max(m.mendLowBelow, (v.below ?? 0) / 100);
        break;
      case 'overflowing_grace':
        m.graceShieldPct = (v.cap ?? 0) / 100;
        m.graceShieldDuration = v.seconds ?? 0;
        m.wardBarrierMult *= 1 - (v.ward ?? 0) / 100;
        break;
      case 'empower':
        empower += pct;
        break;
      case 'afterglow':
        m.empowerLinger = Math.max(m.empowerLinger, v.seconds ?? 0);
        break;
      case 'life':
        life += pct;
        break;
      case 'sanguine_font':
        // The Life it reserves instead (and how much) is `treeReserve`'s.
        m.lifeReserve = true;
        m.covenantPct += (v.mend ?? 0) / 100;
        m.spiritRegenMult *= 1 - (v.regen ?? 0) / 100;
        break;
      case 'aura_effect':
      case 'clear_voice':
        auraEffect += pct;
        break;
      case 'held_note':
        m.encoreBonus += v.seconds ?? 0;
        break;
      case 'prism_covenant': {
        const potency = 1 + (v.thread ?? 0) / 100;
        m.lifeCapPct = Math.min(m.lifeCapPct, (v.cap ?? 100) / 100);
        m.auraEffectMult *= 1 + (v.aura ?? 0) / 100;
        m.mendMult *= potency;
        m.empowerMult *= potency;
        break;
      }
      case 'field':
        field += pct;
        break;
      case 'unbroken_chorus': {
        const potency = 1 - (v.thread ?? 0) / 100;
        m.unsuppressible = true;
        m.auraPerExtra = pct / 100;
        m.mendMult *= potency;
        m.empowerMult *= potency;
        break;
      }
      case 'ward':
        ward += pct;
        break;
      case 'shieldwright':
        ward += pct;
        m.wardCooldownCut += v.seconds ?? 0;
        break;
      case 'perfect':
        m.perfectWindowBonus += v.seconds ?? 0;
        break;
      case 'ringing_parry':
        m.staggerMult *= 1 + pct / 100;
        m.perfectResonance += v.resonance ?? 0;
        break;
      case 'shatterproof_halo':
        m.wardHitCap = (v.cap ?? 0) / 100;
        m.wardDurationMult *= 1 - (v.duration ?? 0) / 100;
        break;
      case 'tech_cost':
        techCost += pct;
        break;
      case 'tech_cooldown':
        techCooldown += pct;
        break;
      case 'bell_tower':
        m.chimeRadiusMult *= 1 + (v.radius ?? 0) / 100;
        m.chimeHealMult *= 1 + (v.heal ?? 0) / 100;
        break;
      case 'spirit_regen':
        spiritRegen += pct;
        break;
      case 'eldritch_conduit':
        // Its lighter songs are `treeReserve`'s.
        m.techniquesCostLife = true;
        break;
      case 'hero_life':
        heroLife += pct;
        break;
      case 'hero_damage':
        heroDamage += pct;
        break;
      case 'fellowship':
        heroLife += v.life ?? 0;
        heroDamage += v.damage ?? 0;
        break;
      case 'bleed_out':
        bleedOut += pct;
        break;
      case 'close_ranks':
        m.closeRanks = pct / 100;
        m.closeRanksRadius = v.radius ?? 0;
        break;
      case 'revive_speed':
        revive += pct;
        break;
      case 'second_wind':
        m.reviveHpPct = (v.life ?? 30) / 100;
        m.reviveInvulnerable = Math.max(m.reviveInvulnerable, v.seconds ?? 0);
        break;
      case 'solo_charge':
        solo += pct;
        break;
      case 'cued_solo':
        cued += pct;
        break;
      case 'ready_answer':
        m.responseBonus += v.resonance ?? 0;
        break;
      case 'ensemble':
        // The same as the Canon motif's charge, and adds to it.
        m.canon += pct;
        break;
      case 'resonant_thread':
        m.beamFocusMult *= 1 + pct / 100;
        break;
      case 'anthem':
        m.inFieldDamage += pct / 100;
        break;
      case 'shield_bearer':
        m.wardedDamage += pct / 100;
        break;
      case 'lifeguard':
        m.mendWarded += pct / 100;
        break;
      default:
        // 'none' (the centre). An unknown effect is a content bug: a test checks every node.
        break;
    }
  }
  m.mendMult *= 1 + (thread + mend) / 100;
  m.empowerMult *= 1 + (thread + empower) / 100;
  m.lifeMult *= 1 + life / 100;
  m.auraEffectMult *= 1 + auraEffect / 100;
  m.fieldRadiusMult *= 1 + field / 100;
  m.wardBarrierMult *= 1 + ward / 100;
  m.techCostMult *= Math.max(0, 1 - techCost / 100);
  m.techCooldownMult *= Math.max(0.1, 1 - techCooldown / 100);
  m.spiritRegenMult *= 1 + spiritRegen / 100;
  m.heroLifeMult *= 1 + heroLife / 100;
  m.partyDamageMult *= 1 + heroDamage / 100;
  m.bleedOutMult *= 1 + bleedOut / 100;
  m.reviveSpeedMult *= 1 + revive / 100;
  m.soloChargeMult *= 1 + solo / 100;
  m.cuedSoloDurationMult *= 1 + cued / 100;
  const r = treeReserve(nodes);
  m.reserveMult *= r.mult;
  if (r.life) m.lifeReserveMult *= r.lifeMult;
}

/** The techniques with a cost (Rewind is paid in Reel's slot, at Reel's cost). */
export type CostedTechnique = 'ward' | 'chime' | 'reel';

/**
 * What a technique costs right now and from which pool (docs/phase-4.md): the tree's Economy,
 * Stasis's discount and Eldritch Conduit's Life included. The sim's own `spend` agrees.
 */
export function techniqueCost(
  state: WorldState,
  technique: CostedTechnique,
  content: Content = CONTENT,
): { amount: number; pool: 'spirit' | 'life' } {
  let amount = content.techniques[technique].cost * state.astrolabe.techCostMult;
  if (state.field.stasis) amount *= state.calling?.stasisCostMult ?? 1;
  return { amount, pool: state.astrolabe.techniquesCostLife ? 'life' : 'spirit' };
}

/**
 * Can the Weaver pay for a technique now? Spirit as always; Life (Eldritch Conduit) only if it
 * leaves her standing. Cooldowns, charges and range are the caller's to check.
 */
export function canPay(
  state: WorldState,
  technique: CostedTechnique,
  content: Content = CONTENT,
): boolean {
  const weaver = state.entities.get(state.weaverId);
  const w = weaver?.weaver;
  if (!w || !weaver.health) return false;
  const cost = techniqueCost(state, technique, content);
  return cost.pool === 'life'
    ? weaver.health.hp - cost.amount >= 1 - 1e-9
    : w.spirit + 1e-9 >= cost.amount;
}
