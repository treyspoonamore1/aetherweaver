import * as THREE from 'three';
import { visionPalette, type ColorVision, type VisionPalette } from '../app/colorVision';
import { auraDef } from '../content';

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

/**
 * Semantic colours. The colour-vision ones (heal, shield, amp, ailment, threat, lethal, mend,
 * empower, call) are *live*: `applyVision` rewrites them in place, so every batch and shader
 * uniform that holds them switches palette on the next frame. Never mutate them elsewhere.
 */
export const C = {
  heal: new THREE.Color(PALETTE.heal),
  shield: new THREE.Color(PALETTE.shield),
  amp: new THREE.Color(PALETTE.amp),
  gold: color(PALETTE.gold),
  goldHot: color(PALETTE.goldHot),
  ailment: new THREE.Color(PALETTE.ailment),
  threat: new THREE.Color(PALETTE.threat),
  lethal: new THREE.Color(PALETTE.lethal),
  resonance: color(PALETTE.resonance),
  weaver: color(PALETTE.weaver),
  mend: new THREE.Color(PALETTE.mend),
  empower: new THREE.Color(PALETTE.empower),
  /** A hero's call for support: gold = opportunity (never the threat amber / lethal red). */
  call: new THREE.Color('#fde68a'),
  dome: color(PALETTE.dome),
  discord: color(PALETTE.discord),
  white: color(PALETTE.white),
} as const;

/** The live palette as hex strings, for DOM layers (badges, arrows, numbers). */
export const VISION_HEX: VisionPalette = { ...visionPalette('normal') };

let applied: ColorVision = 'normal';

/** Switches the live semantic colours to a colour-vision palette. Returns true if it changed. */
export function applyVision(vision: ColorVision): boolean {
  if (vision === applied) return false;
  applied = vision;
  const p = visionPalette(vision);
  Object.assign(VISION_HEX, p);
  C.heal.set(p.heal);
  C.shield.set(p.shield);
  C.amp.set(p.amp);
  C.ailment.set(p.ailment);
  C.threat.set(p.threat);
  C.lethal.set(p.lethal);
  C.mend.set(p.mend);
  C.empower.set(p.empower);
  C.call.set(p.call);
  return true;
}

export function currentVision(): ColorVision {
  return applied;
}

/** An aura's signature colour (gold for unknown ids). Shared; never mutate. */
export function auraColor(id: string): THREE.Color {
  let c = cache.get(`aura:${id}`);
  if (!c) {
    let hex: string = PALETTE.gold;
    try {
      hex = auraDef(id).color;
    } catch {
      // unknown aura: gold
    }
    c = color(hex);
    cache.set(`aura:${id}`, c);
  }
  return c;
}

/** "#rrggbb" + alpha → "rgba(...)" for DOM shadows. */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

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
