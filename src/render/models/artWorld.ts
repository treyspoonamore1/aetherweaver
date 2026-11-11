import type { ArenaLook } from '../crimsonCues';
import { ART_PASS } from './artFlag';
import type { ModelMaterial } from './material';

/**
 * The art pass's stained-glass figures in each world (artPass.ts). In the Reliquary the dark lead
 * round a figure parts it from the warm stone. On the three dark worlds' floors (Phase 8a's lit
 * Spire, Rift and Crucible) dark lead vanishes, so there the lead "catches the light": the outline
 * is pewter, and the glass gives back a little of its own colour (`lift`) so a dark robe does not
 * sink into the floor.
 *
 * The pewter (#9a9a7c) is ≥ 23 ΔE from every semantic colour in every colour vision (measured with
 * src/app/colorVision.ts against the palette, its vision palettes and the Weaver's): not gold, not
 * Mend, not Ward, not threat or lethal. Only the models' own outline and self-light change; the
 * arena, its lights, every aura, ring, rim and ornament are untouched (the hostile rim and the
 * aura rims are drawn on the body, inside the outline).
 */
export interface ArtWorld {
  edge: string;
  edgeMix: number;
  lift: number;
  /** How much brighter the lit panes burn. */
  panes: number;
}

const LEAD: ArtWorld = { edge: '#15131c', edgeMix: 0, lift: 0, panes: 1 };
const PEWTER = '#9a9a7c';

export const ART_WORLD: Record<ArenaLook, ArtWorld> = {
  warm: LEAD,
  cool: LEAD,
  crimson: { edge: PEWTER, edgeMix: 0.25, lift: 0.14, panes: 1.4 },
  abyss: { edge: PEWTER, edgeMix: 0.25, lift: 0.14, panes: 1.4 },
  crucible: { edge: PEWTER, edgeMix: 0.25, lift: 0.14, panes: 1.4 },
};

/** Fits the model material's outline and lift to the world an arena belongs to (art pass only). */
export function applyArtWorld(model: ModelMaterial, look: ArenaLook): void {
  const u = model.uniforms;
  if (!ART_PASS || !u.uEdge || !u.uEdgeMix || !u.uLift || !u.uPaneBoost) return;
  const w = ART_WORLD[look];
  u.uEdge.value.set(w.edge);
  u.uEdgeMix.value = w.edgeMix;
  u.uLift.value = w.lift;
  u.uPaneBoost.value = w.panes;
}
