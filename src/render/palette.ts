import * as THREE from 'three';

/**
 * Semantic VFX colours (docs/plan/04 §2). One meaning per colour, always paired with a shape.
 * Mirrors the CSS tokens in src/index.css.
 */
export const PALETTE = {
  heal: '#2dd4bf',
  shield: '#a5f3fc',
  amp: '#fbbf24',
  gold: '#f5d78e',
  goldHot: '#fff1c4',
  ailment: '#a78bfa',
  threat: '#fb923c',
  lethal: '#f43f5e',
  resonance: '#fff4d6',
  weaver: '#f6e7c1',
  mend: '#2dd4bf',
  empower: '#fbbf24',
  dome: '#bff7ff',
  discord: '#f472b6',
  white: '#ffffff',
} as const;

export type PaletteKey = keyof typeof PALETTE;

const cache = new Map<string, THREE.Color>();

/** A shared, read-only THREE.Color for a hex string. Never mutate the result. */
export function color(hex: string): THREE.Color {
  let c = cache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    cache.set(hex, c);
  }
  return c;
}

export const C = {
  heal: color(PALETTE.heal),
  shield: color(PALETTE.shield),
  amp: color(PALETTE.amp),
  gold: color(PALETTE.gold),
  goldHot: color(PALETTE.goldHot),
  ailment: color(PALETTE.ailment),
  threat: color(PALETTE.threat),
  lethal: color(PALETTE.lethal),
  resonance: color(PALETTE.resonance),
  weaver: color(PALETTE.weaver),
  dome: color(PALETTE.dome),
  discord: color(PALETTE.discord),
  white: color(PALETTE.white),
} as const;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Frame-rate independent exponential approach. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/** Deterministic-enough hash noise for visuals (never used by the sim). */
export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
