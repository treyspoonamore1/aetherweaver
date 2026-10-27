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
export { fieldAuraSlots, reservePool, songReserveOf } from './world';
export {
  KNOWN_ASTROLABE_EFFECTS,
  canPay,
  songReserve,
  techniqueCost,
  treeKeystones,
  treeNodes,
  type CostedTechnique,
} from './astrolabe';
export { auraBit, auraIds, enemyAuraMask, partyAuraMask, type AuraTotals } from './combat/auras';
export { vowHoldsAt } from './combat/telegraphs';
export { rewindCanRevive } from './systems/rewind';
export { underMuteDome } from './systems/field';
