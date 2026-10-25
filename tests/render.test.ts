import type * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { visionPalette } from '../src/app/colorVision';
import { CONTENT } from '../src/content';
import { C, VISION_HEX, applyVision, auraColor, color } from '../src/render/palette';

const hex = (c: THREE.Color) => `#${c.getHexString()}`;

describe('render palette (Phase 2)', () => {
  afterEach(() => {
    applyVision('normal');
  });

  it('switches the live semantic colours with the colour-vision setting', () => {
    applyVision('normal');
    expect(hex(C.lethal)).toBe(visionPalette('normal').lethal);
    expect(applyVision('deuteranopia')).toBe(true);
    const p = visionPalette('deuteranopia');
    for (const key of ['heal', 'threat', 'lethal', 'mend', 'empower', 'call'] as const) {
      expect(hex(C[key])).toBe(p[key]);
      expect(VISION_HEX[key]).toBe(p[key]);
    }
    // Re-applying the same palette is a no-op (no per-frame work).
    expect(applyVision('deuteranopia')).toBe(false);
  });

  it('never mutates the shared colour cache', () => {
    const teal = color('#2dd4bf');
    applyVision('tritanopia');
    expect(hex(teal)).toBe('#2dd4bf');
    expect(hex(C.heal)).toBe(visionPalette('tritanopia').heal);
  });

  it('colours every aura with its content colour', () => {
    for (const a of CONTENT.auras) expect(hex(auraColor(a.id))).toBe(a.color.toLowerCase());
    expect(hex(auraColor('nope'))).toBe('#f5d78e');
  });
});
