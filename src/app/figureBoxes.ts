/**
 * Where each boss, hero and the Weaver is drawn on the screen, as a box in CSS pixels: what
 * `tools/hud-cover.mjs` lays against the HUD's panels to measure how much of a figure is hidden
 * (docs/phase-8.md, 8c). Read-only; reached through the test hook (`__AW__.figures()`).
 */
import * as THREE from 'three';
import { enemyDef } from '../content';
import { HERO_DRAWN } from '../render/models/artFlag';
import type { WorldState } from '../sim';
import type { FigureBox } from './testHookTypes';

export type { FigureBox };

const corner = new THREE.Vector3();

/** The screen box of an upright cylinder of `radius` and `height` standing at (x, z). */
export function screenBox(
  camera: THREE.Camera,
  rect: { left: number; top: number; width: number; height: number },
  x: number,
  z: number,
  radius: number,
  height: number,
): { left: number; top: number; right: number; bottom: number } {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < 8; i++) {
    corner.set(x + (i & 1 ? radius : -radius), i & 2 ? height : 0, z + (i & 4 ? radius : -radius));
    corner.project(camera);
    const sx = rect.left + (corner.x * 0.5 + 0.5) * rect.width;
    const sy = rect.top + (-corner.y * 0.5 + 0.5) * rect.height;
    left = Math.min(left, sx);
    right = Math.max(right, sx);
    top = Math.min(top, sy);
    bottom = Math.max(bottom, sy);
  }
  return { left, top, right, bottom };
}

/**
 * Every living boss and miniboss, every hero still in the fight and the Weaver, at the
 * interpolation `alpha` the frame was drawn with.
 */
export function figureBoxes(
  state: WorldState,
  alpha: number,
  camera: THREE.Camera,
  rect: { left: number; top: number; width: number; height: number },
): FigureBox[] {
  camera.updateMatrixWorld();
  const out: FigureBox[] = [];
  for (const e of state.entities.list()) {
    if (e.health?.dead) continue;
    let kind: FigureBox['kind'];
    let name: string;
    let drawn = 1;
    if (e.kind === 'weaver') {
      kind = 'weaver';
      name = 'weaver';
      drawn = HERO_DRAWN;
    } else if (e.hero) {
      kind = 'hero';
      name = e.hero.defId;
      drawn = HERO_DRAWN;
    } else if (e.enemy) {
      const role = enemyDef(e.enemy.defId).role;
      if (role !== 'boss' && role !== 'miniboss') continue;
      kind = role;
      name = e.enemy.defId;
    } else continue;
    const x = e.px + (e.x - e.px) * alpha;
    const z = e.pz + (e.z - e.pz) * alpha;
    out.push({
      id: e.id,
      kind,
      name,
      x,
      z,
      ...screenBox(camera, rect, x, z, e.radius * drawn, e.height * drawn),
    });
  }
  return out;
}
