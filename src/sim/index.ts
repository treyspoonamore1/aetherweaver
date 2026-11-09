/** Public surface of the simulation. Other layers import from here. */
export {
  createSim,
  type AssistConfig,
  type ChordConfig,
  type PartyMemberConfig,
  type ResolvedSimConfig,
  type Sim,
  type SimConfig,
  type SimSnapshot,
} from './api';
export * from './chords';
export * from './commands';
export * from './counterfactual';
export * from './constants';
export type * from './events';
export * from './replay';
export type * from './state';
export { FixedStepper } from './core/fixedStep';
export {
  fieldAuraSlots,
  reservePool,
  resolveMovement,
  songReserveOf,
  type MovementScale,
} from './world';
export {
  KNOWN_ASTROLABE_EFFECTS,
  canPay,
  songReserve,
  techniqueCost,
  treeKeystones,
  treeNodes,
  type CostedTechnique,
  type Passive,
} from './astrolabe';
export { auraBit, auraIds, enemyAuraMask, partyAuraMask, type AuraTotals } from './combat/auras';
export { linkStatusOf, markStatusOf, vowHoldsAt } from './combat/telegraphs';
export {
  DOT_ANSWERS,
  DOT_TICK,
  dotName,
  healReceivedMult,
  inSanctuary,
  isAilment,
} from './combat/health';
export { bossPhaseTable } from './systems/bosses';
// Movement III's shared rules (docs/phase-5c.md): the sim, bots, render and UI read the same ones.
export {
  cutWouldLand,
  enemyDamageMult,
  fightMovement,
  isRooted,
  mimicBeneficiary,
  mimicCopyOf,
  possessionVictim,
  relicAwake,
  specialsOf,
  suppressRadiusOf,
  threadSegment,
  weaverSilenced,
  type MimicCopy,
  type Segment,
} from './rules3';
export { segmentDistSq, segmentsCross } from './core/dmath';
export { rewindCanRevive } from './systems/rewind';
export { underMuteDome } from './systems/field';
export {
  bloodRageBonus,
  bloodlusting,
  deathlessActive,
  fallingFast,
  isWeaverVia,
  newBlood,
  weaverHealCut,
} from './systems/blood';
// Seren's and Oro's shared rules (docs/phase-5e.md): the sim, bots, render and UI read the same.
export {
  duelTarget,
  heavy,
  lungeTarget,
  newDuel,
  overextended,
  parryArmed,
  parryable,
} from './systems/duel';
export {
  gentle,
  groveCallReady,
  isSummon,
  newGrove,
  replantInField,
  saplingInField,
  summonsOf,
} from './systems/grove';
// The Conductor's shared rules (docs/phase-5f.md): the sim, the HUD, render, audio and the bots
// read the same ones.
export {
  beatAt,
  crescendoCostOf,
  cuePowerOf,
  cueCostNow,
  ensembleBonus,
  finaleTurnBlock,
  finaleView,
  marcatoOn,
  marcatoReadyIn,
  nextCue,
  onBeat,
  openChain,
  spotlit,
  triadHolds,
} from './systems/conducting';
export type { FinaleTurnBlock } from './systems/conducting';
