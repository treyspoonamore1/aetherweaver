import * as THREE from 'three';
import type { AnswerTag } from '../sim';
import { VISION_HEX, currentVision, rgba } from './palette';
import { CALLING_HEX } from './callingCues';
import { CHRONO_HEX } from './chronoCues';
import { softenHex, songHex } from './songs';

/** Icons the overlay can draw: telegraph answers, plus the Weaver's Mend and Empower. */
export type GlyphIcon = AnswerTag | 'mend' | 'empower';

/**
 * World-anchored DOM overlay (docs/plan/05 §5.3): floating numbers, answer glyphs, callouts,
 * off-screen arrows and full-screen spotlight/flash/vignette layers. Updated imperatively
 * every frame from pooled elements — no React, no element creation after construction.
 */

const ICONS: Record<GlyphIcon, string> = {
  ward: '<path d="M12 2.5 19.5 6.5V12.5C19.5 17 16.2 20 12 21.5 7.8 20 4.5 17 4.5 12.5V6.5Z"/>',
  chime:
    '<path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l2 2h-15Z"/><circle cx="12" cy="20.6" r="1.4"/><path d="M12 3v2"/>',
  reel: '<path d="M18.5 13a6.6 6.6 0 1 1-2.6-6.1"/><path d="M16 2.8V7.2h4.4"/>',
  focus: '<circle cx="12" cy="12" r="6"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>',
  scatter: '<path d="M2.5 12h7M14.5 12h7M5.5 9l-3 3 3 3M18.5 9l3 3-3 3"/>',
  stack: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/>',
  move: '<path d="M4 12h13M12.5 6.5 18 12l-5.5 5.5"/>',
  dome: '<path d="M3 18.5a9 9 0 0 1 18 0Z"/><path d="M7 18.5a5 5 0 0 1 10 0"/>',
  mend: '<path d="M12 4.5v15M4.5 12h15"/>',
  empower: '<path d="M5 13.5 12 6.5l7 7"/><path d="M5 19 12 12l7 7"/>',
};

const ICON_COLORS: Record<GlyphIcon, string> = {
  ward: '#bff6ff',
  chime: '#e3d4ff',
  reel: '#7ff0de',
  focus: '#fcd98a',
  scatter: '#f1f5f9',
  stack: '#f1f5f9',
  move: '#f1f5f9',
  dome: '#fde9b8',
  mend: '#99f6e4',
  empower: '#fde68a',
};

const LABELS: Record<GlyphIcon, string> = {
  ward: 'Ward',
  chime: 'Chime',
  reel: 'Reel',
  focus: 'Focus',
  scatter: 'Scatter',
  stack: 'Stack',
  move: 'Move',
  dome: 'Dome',
  mend: 'Heal',
  empower: 'Empower',
};

function iconSvg(tag: GlyphIcon): string {
  return `<span style="display:flex;flex-direction:column;align-items:center;gap:1px;color:${ICON_COLORS[tag]}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[tag]}</svg><span style="font:600 8px/1 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;opacity:.9">${LABELS[tag]}</span></span>`;
}

function setChip(el: HTMLSpanElement, text: string | null): void {
  if (text) {
    if (el.textContent !== text) el.textContent = text;
    if (el.style.display !== 'inline-block') el.style.display = 'inline-block';
  } else if (el.style.display !== 'none') el.style.display = 'none';
}

export interface Projected {
  x: number;
  y: number;
  onScreen: boolean;
  behind: boolean;
}

interface NumberItem {
  el: HTMLDivElement;
  main: HTMLSpanElement;
  /** Gold: Empower and Flourishes. */
  chip: HTMLSpanElement;
  /** ♪ song: the auras' part. */
  song: HTMLSpanElement;
  /** ☀ sun: Radiance's part (the Luminary). */
  sun: HTMLSpanElement;
  /** The number's warm glow (a hero who shone), 0 = none; DOM is written on change only. */
  glow: number;
  /** The glow's colour (the Luminary's sun; the Chronomancer's silver on Rewind's number). */
  glowHex: string;
  active: boolean;
  /** Aura heals: a quieter number (lower, slower, no big pop). */
  soft: boolean;
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
  size: number;
  drift: number;
  pop: number;
}

interface CalloutItem {
  el: HTMLDivElement;
  active: boolean;
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
  rise: number;
}

interface BadgeItem {
  el: HTMLDivElement;
  icons: HTMLDivElement;
  label: HTMLSpanElement;
  key: string;
  border: string;
  /** The label's style: 0 plain, 1 the Chronomancer's timer, 2 a timer held by Stasis. */
  tone: number;
  used: boolean;
}

/** Badge label tones (the Chronomancer's telegraph timers, docs/phase-3e/vfx.md). */
export const BADGE_TONE = { plain: 0, timer: 1, frozen: 2 } as const;

/** A round glyph with a countdown ring: hero calls (gold) and Fermata heal prompts. */
interface BubbleItem {
  el: HTMLDivElement;
  ring: SVGCircleElement;
  disc: SVGCircleElement;
  icon: SVGSVGElement;
  label: HTMLDivElement;
  iconKey: string;
  colorKey: string;
  labelText: string;
  filled: boolean;
  used: boolean;
}

/** The ☀ chip's fill (the Luminary's sunlight, callingCues.CALLING_HEX.sun). */
const SUN_CHIP_HEX = CALLING_HEX.sun;
/** The glow round a number from a hero who shone (CALLING_HEX.sunHot). */
const SUN_GLOW_HEX = CALLING_HEX.sunHot;

const BUBBLE_R = 19;
const BUBBLE_C = 2 * Math.PI * BUBBLE_R;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface ArrowItem {
  el: HTMLDivElement;
  head: HTMLDivElement;
  ring: HTMLDivElement;
  dot: HTMLDivElement;
  color: string;
  danger: boolean;
  used: boolean;
}

function div(parent: HTMLElement, css: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = css;
  parent.appendChild(el);
  return el;
}

export class Overlay {
  readonly root: HTMLDivElement;
  width = 1;
  height = 1;
  private readonly resize: ResizeObserver;
  private readonly v = new THREE.Vector3();
  private readonly numbers: NumberItem[] = [];
  private readonly callouts: CalloutItem[] = [];
  private readonly badges: BadgeItem[] = [];
  private readonly arrows: ArrowItem[] = [];
  private readonly bubbles: BubbleItem[] = [];
  private bubbleCursor = 0;
  private badgeCursor = 0;
  private readonly badgeX = new Float32Array(24);
  private readonly badgeY = new Float32Array(24);
  private arrowCursor = 0;
  // Screen layers.
  private readonly dimEl: HTMLDivElement;
  private readonly flashEl: HTMLDivElement;
  private readonly dangerEl: HTMLDivElement;
  private readonly slowEl: HTMLDivElement;
  private readonly chromaEl: HTMLDivElement;
  private readonly raidEl: HTMLDivElement;
  private readonly raidText: HTMLDivElement;
  private readonly raidEdge: HTMLDivElement;
  /** Stasis (the Chronomancer): a cool, still frame round the screen while time is held. */
  private readonly stasisEl: HTMLDivElement;
  /** Time stopping and resuming: a cool flash (never Sunrise's warm one). */
  private readonly coolFlashEl: HTMLDivElement;
  private stasisShown = '';
  private coolFlashT = 0;
  private coolFlashDur = 0.2;
  private coolFlashStrength = 0;
  private dimT = 0;
  private dimDur = 0.4;
  private dimX = 0;
  private dimY = 0;
  private dimZ = 0;
  private flashT = 0;
  private flashDur = 0.15;
  private flashStrength = 0;
  private dangerT = 0;
  private chromaT = 0;
  private slow = 0;
  private raidUsed = false;
  private raidShown = false;
  private lastRaidText = '';
  /** Settings: full-screen flash strength 0..1 (flash, chromatic pulse, danger pulse). */
  private flashScale = 1;
  private lethalHex = '';
  private vision = '';

  constructor(
    host: HTMLElement,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.root = div(
      host,
      'position:absolute;inset:0;overflow:hidden;pointer-events:none;contain:strict;font-family:Inter,sans-serif;',
    );
    this.root.dataset.testid = 'vfx-overlay';
    this.width = host.clientWidth || 1;
    this.height = host.clientHeight || 1;
    this.resize = new ResizeObserver(() => {
      this.width = host.clientWidth || 1;
      this.height = host.clientHeight || 1;
    });
    this.resize.observe(host);

    this.dimEl = div(this.root, 'position:absolute;inset:0;opacity:0;');
    this.slowEl = div(
      this.root,
      'position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(40,24,6,0.55) 100%);',
    );
    this.chromaEl = div(
      this.root,
      'position:absolute;inset:0;opacity:0;box-shadow:inset 14px 0 60px rgba(255,60,140,0.45), inset -14px 0 60px rgba(60,220,255,0.45), inset 0 0 140px rgba(255,214,120,0.5);',
    );
    this.dangerEl = div(
      this.root,
      'position:absolute;inset:0;opacity:0;box-shadow:inset 0 0 120px 20px rgba(244,63,94,0.75);',
    );
    this.raidEdge = div(
      this.root,
      'position:absolute;inset:0;opacity:0;box-shadow:inset 0 0 90px 10px rgba(244,63,94,0.6);',
    );
    this.flashEl = div(
      this.root,
      'position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center, rgba(255,248,225,0.9), rgba(255,226,150,0.35) 70%);',
    );
    this.stasisEl = div(
      this.root,
      `position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, ${rgba(CHRONO_HEX.frost, 0.16)} 82%, ${rgba(CHRONO_HEX.silver, 0.34)} 100%);box-shadow:inset 0 0 0 1.5px ${rgba(CHRONO_HEX.silver, 0.45)}, inset 0 0 70px ${rgba(CHRONO_HEX.frost, 0.3)};`,
    );
    this.coolFlashEl = div(
      this.root,
      `position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center, ${rgba(CHRONO_HEX.glass, 0.7)}, ${rgba(CHRONO_HEX.frost, 0.32)} 72%);`,
    );
    this.raidEl = div(
      this.root,
      'position:absolute;left:50%;top:13%;transform:translateX(-50%);display:none;padding:6px 18px;border-radius:999px;background:rgba(20,6,14,0.72);border:1.5px solid rgba(244,63,94,0.9);color:#ffe4e6;font:700 15px/1.1 Cinzel,serif;letter-spacing:.12em;text-transform:uppercase;text-shadow:0 0 10px rgba(244,63,94,0.9);white-space:nowrap;',
    );
    this.raidText = div(this.raidEl, '');

    for (let i = 0; i < 48; i++) {
      const el = div(
        this.root,
        'position:absolute;left:0;top:0;display:none;white-space:nowrap;font-weight:700;font-variant-numeric:tabular-nums;text-shadow:0 1px 0 rgba(0,0,0,0.9),0 0 6px rgba(0,0,0,0.75);will-change:transform,opacity;',
      );
      const main = document.createElement('span');
      // Gold chip: a squared tag. Song chip: a rounded pill led by ♪ (shape + glyph, never
      // colour alone). Colours follow the colour-vision palette (setPalette).
      const chip = document.createElement('span');
      chip.style.cssText =
        'display:none;margin-left:4px;padding:0 4px;border-radius:3px;border:1px solid;font-size:0.62em;vertical-align:middle;';
      const song = document.createElement('span');
      song.style.cssText =
        'display:none;margin-left:3px;padding:0 5px 0 4px;border-radius:999px;border:1px solid;font-size:0.6em;vertical-align:middle;';
      // Sun chip (the Luminary's Radiance): a filled warm pill led by ☀, dark text on light, so
      // it reads apart from the outlined gold and ♪ chips by shape and glyph as well as colour.
      const sun = document.createElement('span');
      sun.style.cssText = `display:none;margin-left:3px;padding:0 5px 0 4px;border-radius:999px;font-size:0.6em;vertical-align:middle;background:${rgba(SUN_CHIP_HEX, 0.92)};color:#3a2606;text-shadow:none;box-shadow:0 0 8px ${rgba(SUN_CHIP_HEX, 0.85)};`;
      el.append(main, chip, song, sun);
      this.numbers.push({
        el,
        main,
        chip,
        song,
        sun,
        glow: 0,
        glowHex: SUN_GLOW_HEX,
        active: false,
        soft: false,
        x: 0,
        y: 0,
        z: 0,
        age: 0,
        life: 1,
        size: 14,
        drift: 0,
        pop: 0,
      });
    }
    for (let i = 0; i < 12; i++) {
      const el = div(
        this.root,
        'position:absolute;left:0;top:0;display:none;white-space:nowrap;font-family:Cinzel,serif;font-weight:700;letter-spacing:.14em;will-change:transform,opacity;',
      );
      this.callouts.push({ el, active: false, x: 0, y: 0, z: 0, age: 0, life: 1, rise: 0 });
    }
    for (let i = 0; i < 20; i++) {
      const el = div(
        this.root,
        'position:absolute;left:0;top:0;display:none;align-items:center;gap:6px;padding:3px 6px 3px 6px;border-radius:9px;background:rgba(8,10,20,0.78);border:1.5px solid #fb923c;box-shadow:0 0 10px rgba(0,0,0,0.5);will-change:transform;',
      );
      const icons = div(el, 'display:flex;gap:6px;align-items:center;');
      const label = document.createElement('span');
      label.style.cssText =
        'font:700 12px/1 Inter,sans-serif;color:#fff;font-variant-numeric:tabular-nums;min-width:22px;text-align:center;';
      el.appendChild(label);
      this.badges.push({ el, icons, label, key: '', border: '', tone: 0, used: false });
    }
    for (let i = 0; i < 10; i++) {
      const el = div(
        this.root,
        'position:absolute;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;display:none;will-change:transform;',
      );
      const ring = div(
        el,
        'position:absolute;inset:3px;border-radius:50%;background:rgba(8,10,20,0.75);border:2px solid #fff;box-shadow:0 0 10px rgba(0,0,0,0.6);',
      );
      const head = div(
        el,
        'position:absolute;left:50%;top:50%;width:0;height:0;margin:-7px 0 0 13px;border-top:7px solid transparent;border-bottom:7px solid transparent;border-left:11px solid #fff;transform-origin:-13px 7px;',
      );
      const dot = div(ring, 'position:absolute;inset:5px;border-radius:50%;background:#fff;');
      this.arrows.push({ el, head, ring, dot, color: '', danger: false, used: false });
    }
    for (let i = 0; i < 8; i++) {
      const el = div(
        this.root,
        'position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;display:none;will-change:transform,opacity;',
      );
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('width', '44');
      svg.setAttribute('height', '44');
      svg.setAttribute('viewBox', '0 0 44 44');
      svg.style.cssText = 'position:absolute;inset:0;overflow:visible;';
      const disc = document.createElementNS(SVG_NS, 'circle');
      disc.setAttribute('cx', '22');
      disc.setAttribute('cy', '22');
      disc.setAttribute('r', String(BUBBLE_R));
      disc.setAttribute('fill', 'rgba(8,10,20,0.82)');
      disc.setAttribute('stroke-width', '1');
      const ring = document.createElementNS(SVG_NS, 'circle');
      ring.setAttribute('cx', '22');
      ring.setAttribute('cy', '22');
      ring.setAttribute('r', String(BUBBLE_R));
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke-width', '3.2');
      ring.setAttribute('stroke-linecap', 'round');
      ring.setAttribute('stroke-dasharray', BUBBLE_C.toFixed(2));
      ring.setAttribute('transform', 'rotate(-90 22 22)');
      svg.append(disc, ring);
      el.appendChild(svg);
      const icon = document.createElementNS(SVG_NS, 'svg');
      icon.setAttribute('width', '22');
      icon.setAttribute('height', '22');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2.4');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('stroke-linejoin', 'round');
      icon.style.cssText = 'position:absolute;left:11px;top:11px;';
      el.appendChild(icon);
      const label = div(
        el,
        'position:absolute;left:50%;top:46px;transform:translateX(-50%);white-space:nowrap;font:700 10px/1 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;text-shadow:0 1px 0 rgba(0,0,0,0.9),0 0 6px rgba(0,0,0,0.8);',
      );
      this.bubbles.push({
        el,
        ring,
        disc,
        icon,
        label,
        iconKey: '',
        colorKey: '',
        labelText: '',
        filled: false,
        used: false,
      });
    }
    this.setPalette();
  }

  /** Re-reads the live colour-vision palette (danger edge, raid edge, arrows, number chips). */
  setPalette(): void {
    const vision = currentVision();
    if (vision === this.vision) return;
    this.vision = vision;
    const amp = VISION_HEX.amp;
    const song = songHex(vision);
    for (const n of this.numbers) {
      const c = n.chip.style;
      c.background = rgba(amp, 0.2);
      c.borderColor = rgba(amp, 0.85);
      c.color = softenHex(amp, 0.45);
      c.textShadow = `0 0 6px ${rgba(amp, 0.9)}`;
      const g = n.song.style;
      g.background = rgba(song, 0.24);
      g.borderColor = rgba(song, 0.95);
      g.color = softenHex(song, 0.2);
      g.textShadow = `0 0 6px ${rgba(song, 0.9)}`;
    }
    const lethal = VISION_HEX.lethal;
    if (lethal === this.lethalHex) return;
    this.lethalHex = lethal;
    this.dangerEl.style.boxShadow = `inset 0 0 120px 20px ${rgba(lethal, 0.75)}`;
    this.raidEdge.style.boxShadow = `inset 0 0 90px 10px ${rgba(lethal, 0.6)}`;
    this.raidEl.style.borderColor = lethal;
    this.raidEl.style.textShadow = `0 0 10px ${rgba(lethal, 0.9)}`;
    for (const a of this.arrows) a.color = '';
  }

  /** Settings: scales every full-screen flash (0 = off … 1 = full). */
  setFlashScale(s: number): void {
    this.flashScale = s < 0 ? 0 : s > 1 ? 1 : s;
    if (this.flashScale === 0) {
      this.flashT = 0;
      this.coolFlashT = 0;
    }
  }

  project(x: number, y: number, z: number, out: Projected): Projected {
    this.v.set(x, y, z).project(this.camera);
    out.behind = this.v.z > 1;
    out.x = (this.v.x * 0.5 + 0.5) * this.width;
    out.y = (-this.v.y * 0.5 + 0.5) * this.height;
    out.onScreen =
      !out.behind && out.x >= 0 && out.x <= this.width && out.y >= 0 && out.y <= this.height;
    return out;
  }

  private readonly p: Projected = { x: 0, y: 0, onScreen: false, behind: false };

  // ── Floating numbers ───────────────────────────────────────────────────────────────

  /** Starts a number; returns a handle the caller can keep updating (aggregation). */
  spawnNumber(
    x: number,
    y: number,
    z: number,
    color: string,
    size: number,
    life = 0.95,
    soft = false,
  ): number {
    let best = 0;
    let bestAge = -1;
    for (let i = 0; i < this.numbers.length; i++) {
      const n = this.numbers[i]!;
      if (!n.active) {
        best = i;
        break;
      }
      if (n.age > bestAge) {
        bestAge = n.age;
        best = i;
      }
    }
    const n = this.numbers[best]!;
    n.active = true;
    n.x = x;
    n.y = y;
    n.z = z;
    n.age = 0;
    n.life = life;
    n.size = size;
    n.soft = soft;
    n.pop = soft ? 0.3 : 1;
    n.drift = (Math.random() - 0.5) * (soft ? 12 : 26);
    n.el.style.display = 'block';
    n.el.style.color = color;
    n.el.style.fontSize = `${Math.round(size)}px`;
    n.el.style.fontWeight = soft ? '600' : '700';
    n.chip.style.display = 'none';
    n.song.style.display = 'none';
    n.sun.style.display = 'none';
    if (n.glow !== 0) {
      n.glow = 0;
      n.main.style.textShadow = '';
    }
    return best;
  }

  /**
   * Updates a number. `chip` is the gold chip (Empower, Flourishes), `song` the ♪ chip (the
   * auras' part), `sun` the ☀ chip (Radiance); any may be null. `glow` (0..1) makes the number
   * itself glow warm: the hit came from a hero who shone. `glowHex` colours that glow (the
   * Chronomancer's Rewind glows silver). DOM writes only happen on change.
   */
  setNumber(
    handle: number,
    text: string,
    chip: string | null,
    size: number,
    bump: boolean,
    song: string | null = null,
    sun: string | null = null,
    glow = 0,
    glowHex: string = SUN_GLOW_HEX,
  ): void {
    const n = this.numbers[handle];
    if (!n) return;
    n.main.textContent = text;
    setChip(n.chip, chip);
    setChip(n.song, song);
    setChip(n.sun, sun);
    // A hero who shone: the number itself glows warm (stepped, so DOM writes stay rare).
    const g = glow <= 0 ? 0 : glow >= 0.75 ? 2 : 1;
    if (g !== n.glow || (g !== 0 && glowHex !== n.glowHex)) {
      n.glow = g;
      n.glowHex = glowHex;
      n.main.style.textShadow =
        g === 0
          ? ''
          : `0 1px 0 rgba(0,0,0,0.9),0 0 5px ${rgba(glowHex, 0.95)},0 0 ${g === 2 ? 16 : 11}px ${rgba(glowHex, g === 2 ? 0.9 : 0.65)}`;
    }
    if (Math.abs(size - n.size) > 0.5) {
      n.size = size;
      n.el.style.fontSize = `${Math.round(size)}px`;
    }
    if (bump) {
      n.pop = 1;
      n.age = Math.min(n.age, 0.15);
    }
  }

  numberAlive(handle: number): boolean {
    return this.numbers[handle]?.active ?? false;
  }

  // ── Callouts (PERFECT, SAVED, CLUTCH…) ─────────────────────────────────────────────

  callout(
    x: number,
    y: number,
    z: number,
    text: string,
    color: string,
    size: number,
    life = 1.2,
    glow = 'rgba(245,215,142,0.9)',
  ): void {
    let c = this.callouts.find((k) => !k.active);
    if (!c) c = this.callouts.reduce((a, b) => (a.age > b.age ? a : b));
    c.active = true;
    c.x = x;
    c.y = y;
    c.z = z;
    c.age = 0;
    c.life = life;
    c.rise = 0;
    c.el.textContent = text;
    c.el.style.display = 'block';
    c.el.style.color = color;
    c.el.style.fontSize = `${size}px`;
    c.el.style.textShadow = `0 0 12px ${glow}, 0 0 3px ${glow}, 0 2px 0 rgba(0,0,0,0.85)`;
  }

  // ── Telegraph answer badges (immediate mode) ───────────────────────────────────────

  beginFrame(): void {
    this.badgeCursor = 0;
    this.bubbleCursor = 0;
    this.arrowCursor = 0;
    this.raidUsed = false;
  }

  badge(
    x: number,
    y: number,
    z: number,
    answers: readonly GlyphIcon[],
    key: string,
    border: string,
    label: string,
    scale = 1,
    tone: number = BADGE_TONE.plain,
  ): void {
    const b = this.badges[this.badgeCursor];
    if (!b) return;
    const p = this.project(x, y, z, this.p);
    if (p.behind) return;
    // Nudge overlapping badges apart (simple stacking, newest moves).
    const bx = p.x;
    let by = p.y;
    for (let tries = 0; tries < 4; tries++) {
      let hit = false;
      for (let i = 0; i < this.badgeCursor; i++) {
        if (Math.abs(this.badgeX[i]! - bx) < 92 && Math.abs(this.badgeY[i]! - by) < 34) {
          by = this.badgeY[i]! + 36;
          hit = true;
        }
      }
      if (!hit) break;
    }
    this.badgeX[this.badgeCursor] = bx;
    this.badgeY[this.badgeCursor] = by;
    this.badgeCursor++;
    b.used = true;
    if (b.key !== key) {
      b.key = key;
      b.icons.innerHTML = answers.map(iconSvg).join('');
    }
    if (b.border !== border) {
      b.border = border;
      b.el.style.borderColor = border;
      b.el.style.boxShadow = `0 0 12px ${border}66, 0 0 0 1px rgba(0,0,0,0.5)`;
    }
    if (b.label.textContent !== label) {
      b.label.textContent = label;
      b.label.style.display = label ? 'inline' : 'none';
    }
    if (b.tone !== tone) {
      // The Chronomancer's timers: silver; held by Stasis, a cold glow (docs/phase-3e/vfx.md).
      b.tone = tone;
      const ls = b.label.style;
      ls.color =
        tone === BADGE_TONE.frozen
          ? CHRONO_HEX.silver
          : tone === BADGE_TONE.timer
            ? CHRONO_HEX.glass
            : '#fff';
      ls.textShadow =
        tone === BADGE_TONE.frozen
          ? `0 0 3px ${rgba(CHRONO_HEX.glass, 0.9)}, 0 0 9px ${rgba(CHRONO_HEX.silver, 0.95)}`
          : tone === BADGE_TONE.timer
            ? `0 0 6px ${rgba(CHRONO_HEX.silver, 0.6)}`
            : '';
    }
    b.el.style.display = 'flex';
    b.el.style.transform = `translate3d(${bx.toFixed(1)}px,${by.toFixed(1)}px,0) translate(-50%,-50%) scale(${scale.toFixed(3)})`;
  }

  // ── Glyph bubbles (immediate mode): calls, Fermata heal prompts ────────────────────

  /**
   * A round glyph over a world point: `icon` inside, a countdown ring (`remain` 0..1 of the
   * ring still lit), a short label under it. `filled` = answered (solid disc in `hex`).
   * `offsetX` shifts it in screen pixels (two bubbles over one hero).
   */
  bubble(
    x: number,
    y: number,
    z: number,
    icon: GlyphIcon,
    label: string,
    hex: string,
    remain: number,
    scale: number,
    alpha: number,
    filled: boolean,
    offsetX = 0,
  ): void {
    const b = this.bubbles[this.bubbleCursor];
    if (!b || alpha <= 0.01) return;
    const p = this.project(x, y, z, this.p);
    if (p.behind) return;
    this.bubbleCursor++;
    b.used = true;
    if (b.iconKey !== icon) {
      b.iconKey = icon;
      b.icon.innerHTML = ICONS[icon];
    }
    if (b.colorKey !== hex || b.filled !== filled) {
      b.colorKey = hex;
      b.filled = filled;
      b.ring.setAttribute('stroke', hex);
      b.disc.setAttribute('stroke', hex);
      b.disc.setAttribute('fill', filled ? rgba(hex, 0.92) : 'rgba(8,10,20,0.82)');
      b.icon.style.color = filled ? '#0b0d18' : hex;
      b.label.style.color = hex;
      b.el.style.filter = `drop-shadow(0 0 8px ${rgba(hex, 0.75)})`;
    }
    if (b.labelText !== label) {
      b.labelText = label;
      b.label.textContent = label;
    }
    const r = remain < 0 ? 0 : remain > 1 ? 1 : remain;
    b.ring.setAttribute('stroke-dashoffset', (BUBBLE_C * (1 - r)).toFixed(2));
    b.el.style.display = 'block';
    b.el.style.opacity = alpha.toFixed(3);
    b.el.style.transform = `translate3d(${(p.x + offsetX).toFixed(1)}px,${p.y.toFixed(1)}px,0) scale(${scale.toFixed(3)})`;
  }

  // ── Off-screen arrows (immediate mode) ─────────────────────────────────────────────

  /** Shows an edge arrow if (x, z) is off-screen. Returns true if one was drawn. */
  edgeArrow(x: number, y: number, z: number, color: string, danger: number): boolean {
    const p = this.project(x, y, z, this.p);
    if (p.onScreen) return false;
    const a = this.arrows[this.arrowCursor];
    if (!a) return false;
    this.arrowCursor++;
    a.used = true;
    const cx = this.width / 2;
    const cy = this.height / 2;
    let dx = p.x - cx;
    let dy = p.y - cy;
    if (p.behind) {
      dx = -dx;
      dy = -dy;
    }
    const m = 30;
    const sx = (cx - m) / Math.max(1e-3, Math.abs(dx));
    const sy = (cy - m) / Math.max(1e-3, Math.abs(dy));
    const s = Math.min(sx, sy);
    const ex = cx + dx * s;
    const ey = cy + dy * s;
    const ang = Math.atan2(dy, dx);
    const pulse = danger > 0 ? 1 + 0.15 * Math.sin(performance.now() / 70) * danger : 1;
    a.el.style.display = 'block';
    a.el.style.transform = `translate3d(${ex.toFixed(1)}px,${ey.toFixed(1)}px,0) scale(${pulse.toFixed(3)})`;
    a.head.style.transform = `rotate(${ang.toFixed(3)}rad)`;
    const isDanger = danger > 0;
    if (a.color !== color || a.danger !== isDanger) {
      a.color = color;
      a.danger = isDanger;
      const ringColor = isDanger ? this.lethalHex : color;
      a.ring.style.borderColor = ringColor;
      a.ring.style.background = isDanger ? 'rgba(80,6,20,0.85)' : 'rgba(8,10,20,0.75)';
      a.ring.style.boxShadow = isDanger
        ? `0 0 14px ${rgba(this.lethalHex, 0.9)}`
        : `0 0 8px ${color}88`;
      a.head.style.borderLeftColor = ringColor;
      a.dot.style.background = color;
    }
    return true;
  }

  raid(text: string, intensity: number): void {
    this.raidUsed = true;
    if (text !== this.lastRaidText) {
      this.raidText.textContent = text;
      this.lastRaidText = text;
    }
    if (!this.raidShown) {
      this.raidEl.style.display = 'block';
      this.raidShown = true;
    }
    this.raidEdge.style.opacity = (0.35 + 0.45 * intensity).toFixed(3);
  }

  // ── Screen effects ─────────────────────────────────────────────────────────────────

  spotlight(x: number, y: number, z: number, duration = 0.4): void {
    this.dimX = x;
    this.dimY = y;
    this.dimZ = z;
    this.dimT = duration;
    this.dimDur = duration;
  }

  flash(strength: number, duration = 0.16): void {
    strength *= this.flashScale;
    if (strength <= 0.001) return;
    this.flashStrength = Math.max(
      this.flashStrength * (this.flashT / this.flashDur || 0),
      strength,
    );
    this.flashT = duration;
    this.flashDur = duration;
  }

  /** Time stopping or resuming (the Chronomancer's Stasis): a cool flash, scaled by Flashes. */
  coolFlash(strength: number, duration = 0.22): void {
    strength *= this.flashScale;
    if (strength <= 0.001) return;
    this.coolFlashStrength = Math.max(
      this.coolFlashStrength * (this.coolFlashT / this.coolFlashDur || 0),
      strength,
    );
    this.coolFlashT = duration;
    this.coolFlashDur = duration;
  }

  /**
   * Stasis is up (0..1): a cool, still frame round the screen. A steady state, not a flash: it
   * stays faint and is written only when it changes.
   */
  setStasis(v: number): void {
    const o = (v <= 0.005 ? 0 : Math.min(1, v) * 0.85).toFixed(2);
    if (o === this.stasisShown) return;
    this.stasisShown = o;
    this.stasisEl.style.opacity = o;
  }

  danger(): void {
    if (this.flashScale > 0) this.dangerT = 1;
  }

  chroma(): void {
    if (this.flashScale > 0) this.chromaT = 1;
  }

  setSlowmo(v: number): void {
    this.slow = v;
  }

  update(dt: number): void {
    // Numbers: pop, rise and fade.
    for (const n of this.numbers) {
      if (!n.active) continue;
      n.age += dt;
      if (n.age >= n.life) {
        n.active = false;
        n.el.style.display = 'none';
        continue;
      }
      const p = this.project(n.x, n.y, n.z, this.p);
      if (p.behind) {
        n.el.style.opacity = '0';
        continue;
      }
      const t = n.age / n.life;
      n.pop = Math.max(0, n.pop - dt * 7);
      const rise = (n.soft ? 26 : 46) * (1 - Math.pow(1 - t, 2.2));
      const scale = 1 + n.pop * 0.45;
      const fade = (t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1) * (n.soft ? 0.82 : 1);
      n.el.style.opacity = fade.toFixed(3);
      n.el.style.transform = `translate3d(${(p.x + n.drift * t).toFixed(1)}px,${(p.y - rise).toFixed(1)}px,0) translate(-50%,-50%) scale(${scale.toFixed(3)})`;
    }
    for (const c of this.callouts) {
      if (!c.active) continue;
      c.age += dt;
      if (c.age >= c.life) {
        c.active = false;
        c.el.style.display = 'none';
        continue;
      }
      const p = this.project(c.x, c.y, c.z, this.p);
      const t = c.age / c.life;
      const punch = t < 0.12 ? 1.6 - (t / 0.12) * 0.6 : 1;
      const rise = 28 * t;
      const fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : Math.min(1, t * 10);
      c.el.style.opacity = fade.toFixed(3);
      c.el.style.transform = `translate3d(${p.x.toFixed(1)}px,${(p.y - rise).toFixed(1)}px,0) translate(-50%,-50%) scale(${punch.toFixed(3)})`;
    }
    for (let i = this.badgeCursor; i < this.badges.length; i++) {
      const b = this.badges[i]!;
      if (b.used) {
        b.used = false;
        b.el.style.display = 'none';
      }
    }
    for (let i = this.bubbleCursor; i < this.bubbles.length; i++) {
      const b = this.bubbles[i]!;
      if (b.used) {
        b.used = false;
        b.el.style.display = 'none';
      }
    }
    for (let i = this.arrowCursor; i < this.arrows.length; i++) {
      const a = this.arrows[i]!;
      if (a.used) {
        a.used = false;
        a.el.style.display = 'none';
      }
    }
    if (!this.raidUsed && this.raidShown) {
      this.raidShown = false;
      this.raidEl.style.display = 'none';
      this.raidEdge.style.opacity = '0';
    }

    if (this.dimT > 0) {
      this.dimT = Math.max(0, this.dimT - dt);
      const p = this.project(this.dimX, this.dimY, this.dimZ, this.p);
      const t = this.dimT / this.dimDur;
      const env = t > 0.8 ? (1 - t) / 0.2 : t / 0.8;
      this.dimEl.style.opacity = env.toFixed(3);
      this.dimEl.style.background = `radial-gradient(circle at ${p.x.toFixed(0)}px ${p.y.toFixed(0)}px, rgba(0,0,0,0) 70px, rgba(4,6,14,0.34) 220px)`;
    } else if (this.dimEl.style.opacity !== '0') this.dimEl.style.opacity = '0';

    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt);
      this.flashEl.style.opacity = ((this.flashT / this.flashDur) * this.flashStrength).toFixed(3);
    } else if (this.flashEl.style.opacity !== '0') this.flashEl.style.opacity = '0';

    if (this.coolFlashT > 0) {
      this.coolFlashT = Math.max(0, this.coolFlashT - dt);
      this.coolFlashEl.style.opacity = (
        (this.coolFlashT / this.coolFlashDur) *
        this.coolFlashStrength
      ).toFixed(3);
    } else if (this.coolFlashEl.style.opacity !== '0') this.coolFlashEl.style.opacity = '0';

    if (this.dangerT > 0) {
      this.dangerT = Math.max(0, this.dangerT - dt * 1.1);
      const pulse = Math.sin((1 - this.dangerT) * Math.PI * 3) * 0.5 + 0.5;
      this.dangerEl.style.opacity = (this.dangerT * (0.4 + 0.6 * pulse) * this.flashScale).toFixed(
        3,
      );
    } else if (this.dangerEl.style.opacity !== '0') this.dangerEl.style.opacity = '0';

    if (this.chromaT > 0) {
      this.chromaT = Math.max(0, this.chromaT - dt * 1.6);
      this.chromaEl.style.opacity = (this.chromaT * this.flashScale).toFixed(3);
    } else if (this.chromaEl.style.opacity !== '0') this.chromaEl.style.opacity = '0';

    const slowOpacity = this.slow.toFixed(2);
    if (this.slowEl.style.opacity !== slowOpacity) this.slowEl.style.opacity = slowOpacity;
  }

  dispose(): void {
    this.resize.disconnect();
    this.root.remove();
  }
}
