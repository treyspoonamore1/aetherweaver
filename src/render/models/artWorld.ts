import type { ArenaLook } from '../crimsonCues';
import type { ModelMaterial } from './material';

/**
 * The art pass's stained-glass figures in each world (artPass, models/art). The figures look the
 * same in every world (the orchestrator's call: the outline stays lead everywhere). On the three
 * dark worlds' floors (Phase 8a's lit Spire, Rift and Crucible) only the darkest cut glass (parts
 * with panes: Vexis's night robe, Kael's darker plates) gives back a little of its own colour, so it
 * does not sink into the floor; plain dark cloth (a foe's hood or cassock) stays dark so its
 * hostile rim reads, and bright glass is untouched (nothing greys). The lit panes burn a little
 * brighter there. Tried and dropped (docs/art-style.md): a pewter outline on the dark floors.
 */
export interface ArtWorld {
  /** The dark cut glass's lift (0: none). */
  lift: number;
  /** How much brighter the lit panes burn. */
  panes: number;
}

const PLAIN: ArtWorld = { lift: 0, panes: 1 };
const DARK: ArtWorld = { lift: 0.14, panes: 1.4 };

export const ART_WORLD: Record<ArenaLook, ArtWorld> = {
  warm: PLAIN,
  cool: PLAIN,
  crimson: DARK,
  abyss: DARK,
  crucible: DARK,
};

/** Fits the model material's lift to the world an arena belongs to (art pass only). */
export function applyArtWorld(model: ModelMaterial, look: ArenaLook): void {
  const u = model.uniforms;
  if (!u.uLift || !u.uPaneBoost) return;
  const w = ART_WORLD[look];
  u.uLift.value = w.lift;
  u.uPaneBoost.value = w.panes;
}
