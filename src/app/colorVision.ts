/**
 * CONTRACT v3 — colour-vision palettes (docs/plan/04 §2, §9). One meaning per colour, always
 * paired with a shape or glyph. These palettes keep the pairs that must never be confused
 * apart under each kind of colour-vision deficiency; tests check them with a simulation.
 * Render (three.js colours) and UI (CSS custom properties) both read from here.
 */
export const COLOR_VISIONS = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'] as const;
export type ColorVision = (typeof COLOR_VISIONS)[number];

export interface VisionPalette {
  heal: string;
  shield: string;
  /** The Weaver's share of damage: gold chips, Empower. */
  amp: string;
  ailment: string;
  /** An ordinary telegraphed threat. */
  threat: string;
  /** A threat that would down someone as things stand. */
  lethal: string;
  mend: string;
  empower: string;
  /** A hero's call for support. */
  call: string;
}

/** Labels for the Settings screen. */
export const COLOR_VISION_LABELS: Record<ColorVision, string> = {
  normal: 'Standard',
  protanopia: 'Protanopia (red-weak)',
  deuteranopia: 'Deuteranopia (green-weak)',
  tritanopia: 'Tritanopia (blue-weak)',
};

const STANDARD: VisionPalette = {
  heal: '#2dd4bf',
  shield: '#a5f3fc',
  amp: '#fbbf24',
  ailment: '#a78bfa',
  threat: '#fb923c',
  lethal: '#f43f5e',
  mend: '#2dd4bf',
  empower: '#fbbf24',
  call: '#fde68a',
};

/** Okabe–Ito based: danger on a light-yellow → dark-vermillion axis, life and Mend in sky blue. */
const RED_GREEN: VisionPalette = {
  heal: '#56b4e9',
  shield: '#c7e9ff',
  amp: '#ffd84d',
  ailment: '#cc79a7',
  threat: '#f0e442',
  lethal: '#c84300',
  mend: '#56b4e9',
  empower: '#e69f00',
  call: '#ffffff',
};

export const VISION_PALETTES: Record<ColorVision, VisionPalette> = {
  normal: STANDARD,
  protanopia: RED_GREEN,
  deuteranopia: RED_GREEN,
  tritanopia: {
    heal: '#009e73',
    shield: '#bde7dd',
    amp: '#ffb3c6',
    ailment: '#8b5cf6',
    threat: '#ff9db5',
    lethal: '#d40000',
    mend: '#009e73',
    empower: '#ff6f91',
    call: '#ffffff',
  },
};

/** Pairs that must stay apart at a glance (ΔE ≥ 20 under the palette's own vision type). */
export const CRITICAL_PAIRS: readonly (readonly [keyof VisionPalette, keyof VisionPalette])[] = [
  ['threat', 'lethal'],
  ['heal', 'lethal'],
  ['heal', 'threat'],
  ['mend', 'empower'],
  ['call', 'lethal'],
];

export function visionPalette(vision: ColorVision): VisionPalette {
  return VISION_PALETTES[vision] ?? STANDARD;
}

/** Sets the palette as the HUD's CSS custom properties (--color-heal, --color-lethal…). */
export function applyVisionCss(vision: ColorVision): void {
  if (typeof document === 'undefined') return;
  const p = visionPalette(vision);
  const root = document.documentElement.style;
  for (const key of Object.keys(p) as (keyof VisionPalette)[]) {
    root.setProperty(`--color-${key}`, p[key]);
  }
}

// ── Simulation (tests and the Settings preview) ───────────────────────────────────────

/** Machado, Oliveira & Fernandes (2009), severity 1, in linear RGB. */
const MATRICES: Record<Exclude<ColorVision, 'normal'>, readonly number[]> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039,
  ],
};

function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function fromLinear(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, v));
}
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function hexOf([r, g, b]: [number, number, number]): string {
  const to = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** How `hex` looks to someone with the given colour vision. */
export function simulateVision(hex: string, vision: ColorVision): string {
  if (vision === 'normal') return hex.toLowerCase();
  const m = MATRICES[vision];
  const [r, g, b] = rgb(hex).map(toLinear) as [number, number, number];
  return hexOf([
    fromLinear(m[0]! * r + m[1]! * g + m[2]! * b),
    fromLinear(m[3]! * r + m[4]! * g + m[5]! * b),
    fromLinear(m[6]! * r + m[7]! * g + m[8]! * b),
  ]);
}

function lab(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map(toLinear) as [number, number, number];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fy = f(y);
  return [116 * fy - 16, 500 * (f(x) - fy), 200 * (fy - f(z))];
}

/** CIE76 colour difference. ≥ 20 reads as a different colour at a glance. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
