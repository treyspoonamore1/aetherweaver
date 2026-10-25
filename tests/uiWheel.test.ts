import { describe, expect, it } from 'vitest';
import {
  WHEEL_DEAD_ZONE,
  WHEEL_SPOKES,
  wheelChoice,
  wheelSpoke,
  type WheelSpoke,
} from '../src/input/wheel';

/** Pointer offset at `deg` clockwise from straight up, `r` pixels out (screen space). */
function at(deg: number, r = 80): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [Math.sin(rad) * r, -Math.cos(rad) * r];
}

describe('Directive wheel geometry', () => {
  it('has four spokes, clockwise from the top', () => {
    expect(WHEEL_SPOKES.map((s) => s.id)).toEqual(['focus', 'rally', 'hold', 'scatter']);
    expect(WHEEL_SPOKES.map((s) => s.angle)).toEqual([0, 90, 180, 270]);
  });

  it('picks the spoke the pointer points at', () => {
    expect(wheelSpoke(0, -80)).toBe('focus');
    expect(wheelSpoke(80, 0)).toBe('rally');
    expect(wheelSpoke(0, 80)).toBe('hold');
    expect(wheelSpoke(-80, 0)).toBe('scatter');
  });

  it('gives each spoke the 90° sector centred on it', () => {
    const cases: [number, WheelSpoke][] = [
      [-44, 'focus'],
      [44, 'focus'],
      [46, 'rally'],
      [134, 'rally'],
      [136, 'hold'],
      [224, 'hold'],
      [226, 'scatter'],
      [314, 'scatter'],
      [316, 'focus'],
      [359, 'focus'],
    ];
    for (const [deg, spoke] of cases) expect(wheelSpoke(...at(deg)), `${deg}°`).toBe(spoke);
  });

  it('breaks exact diagonals clockwise', () => {
    expect(wheelSpoke(50, -50)).toBe('rally');
    expect(wheelSpoke(50, 50)).toBe('hold');
    expect(wheelSpoke(-50, 50)).toBe('scatter');
    expect(wheelSpoke(-50, -50)).toBe('focus');
  });

  it('returns nothing inside the dead zone (release there cancels)', () => {
    expect(wheelSpoke(0, 0)).toBeNull();
    expect(wheelSpoke(...at(90, WHEEL_DEAD_ZONE - 1))).toBeNull();
    expect(wheelSpoke(...at(90, WHEEL_DEAD_ZONE + 1))).toBe('rally');
    expect(wheelSpoke(30, 0, 40)).toBeNull();
    expect(wheelSpoke(Number.NaN, 10)).toBeNull();
  });

  it('a disabled spoke picks nothing', () => {
    const noFocus = new Set<WheelSpoke>(['focus']);
    expect(wheelChoice(0, -80, noFocus)).toBeNull();
    expect(wheelChoice(80, 0, noFocus)).toBe('rally');
    expect(wheelChoice(0, -80, new Set())).toBe('focus');
  });
});
