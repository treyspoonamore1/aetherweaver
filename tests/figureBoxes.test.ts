/**
 * Phase 8c: the boxes `tools/hud-cover.mjs` measures (src/app/figureBoxes.ts) are where the
 * figures really are on the screen.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { figureBoxes, screenBox } from '../src/app/figureBoxes';
import { CameraRig } from '../src/render/camera';
import { createSim } from '../src/sim';

const RECT = { left: 0, top: 0, width: 1280, height: 720 };

function gameCamera(x = 0, z = 0): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(40, 1280 / 720, 0.5, 220);
  camera.updateProjectionMatrix();
  new CameraRig(camera).snapTo(x, z);
  camera.updateMatrixWorld();
  return camera;
}

describe('figure boxes', () => {
  it('a figure at the camera focus stands on the middle of the screen', () => {
    const box = screenBox(gameCamera(3, -2), RECT, 3, -2, 0.5, 1.8);
    expect((box.left + box.right) / 2).toBeCloseTo(640, 0);
    // Its feet are just under the middle (the near edge of its base), its head above it.
    expect(box.bottom).toBeGreaterThan(360);
    expect(box.bottom).toBeLessThan(380);
    expect(box.top).toBeLessThan(320);
  });

  it('a taller, wider figure has a taller, wider box, and one further north sits higher', () => {
    const camera = gameCamera();
    const small = screenBox(camera, RECT, 0, 0, 0.5, 1.8);
    const big = screenBox(camera, RECT, 0, 0, 1.5, 4.2);
    expect(big.right - big.left).toBeGreaterThan((small.right - small.left) * 2);
    expect(big.bottom - big.top).toBeGreaterThan((small.bottom - small.top) * 2);
    const north = screenBox(camera, RECT, 0, -12, 0.5, 1.8);
    expect(north.bottom).toBeLessThan(small.top);
  });

  it('lists the heroes and the Weaver of a fight, and no rank-and-file foe', () => {
    const sim = createSim({ seed: 7, encounter: 'first_light' });
    const boxes = figureBoxes(sim.state, 1, gameCamera(), RECT);
    expect(boxes.filter((b) => b.kind === 'weaver')).toHaveLength(1);
    expect(boxes.filter((b) => b.kind === 'hero')).toHaveLength(sim.state.party.length);
    expect(boxes.every((b) => b.right > b.left && b.bottom > b.top)).toBe(true);
    expect(boxes.some((b) => b.kind === 'boss' || b.kind === 'miniboss')).toBe(false);
  });
});
