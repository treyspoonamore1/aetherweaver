import * as THREE from 'three';
import type { AnswerTag } from '../sim';

/**
 * World-anchored DOM overlay (docs/plan/05 §5.3): floating numbers, answer glyphs, callouts,
 * off-screen arrows and full-screen spotlight/flash/vignette layers. Updated imperatively
 * every frame from pooled elements — no React, no element creation after construction.
 */

const ICONS: Record<AnswerTag, string> = {
  ward: '<path d="M12 2.5 19.5 6.5V12.5C19.5 17 16.2 20 12 21.5 7.8 20 4.5 17 4.5 12.5V6.5Z"/>',
  chime:
    '<path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l2 2h-15Z"/><circle cx="12" cy="20.6" r="1.4"/><path d="M12 3v2"/>',
  reel: '<path d="M18.5 13a6.6 6.6 0 1 1-2.6-6.1"/><path d="M16 2.8V7.2h4.4"/>',
  focus: '<circle cx="12" cy="12" r="6"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>',
  scatter: '<path d="M2.5 12h7M14.5 12h7M5.5 9l-3 3 3 3M18.5 9l3 3-3 3"/>',
  stack: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/>',
  move: '<path d="M4 12h13M12.5 6.5 18 12l-5.5 5.5"/>',
  dome: '<path d="M3 18.5a9 9 0 0 1 18 0Z"/><path d="M7 18.5a5 5 0 0 1 10 0"/>',
};

const ICON_COLORS: Record<AnswerTag, string> = {
  ward: '#bff6ff',
  chime: '#e3d4ff',
  reel: '#7ff0de',
  focus: '#fcd98a',
  scatter: '#f1f5f9',
  stack: '#f1f5f9',
  move: '#f1f5f9',
  dome: '#fde9b8',
};

const LABELS: Record<AnswerTag, string> = {
  ward: 'Ward',
  chime: 'Chime',
  reel: 'Reel',
  focus: 'Focus',
  scatter: 'Scatter',
  stack: 'Stack',
  move: 'Move',
  dome: 'Dome',
};

function iconSvg(tag: AnswerTag): string {
  return `<span style="display:flex;flex-direction:column;align-items:center;gap:1px;color:${ICON_COLORS[tag]}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[tag]}</svg><span style="font:600 8px/1 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;opacity:.9">${LABELS[tag]}</span></span>`;
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
  chip: HTMLSpanElement;
  active: boolean;
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
  used: boolean;
}

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
      const chip = document.createElement('span');
      chip.style.cssText =
        'margin-left:4px;padding:0 4px;border-radius:4px;background:rgba(251,191,36,0.2);border:1px solid rgba(251,191,36,0.8);color:#fde68a;font-size:0.62em;vertical-align:middle;text-shadow:0 0 6px rgba(251,191,36,0.9);';
      el.append(main, chip);
      this.numbers.push({
        el,
        main,
        chip,
        active: false,
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
      this.badges.push({ el, icons, label, key: '', border: '', used: false });
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
  spawnNumber(x: number, y: number, z: number, color: string, size: number, life = 0.95): number {
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
    n.pop = 1;
    n.drift = (Math.random() - 0.5) * 26;
    n.el.style.display = 'block';
    n.el.style.color = color;
    n.el.style.fontSize = `${Math.round(size)}px`;
    n.chip.style.display = 'none';
    return best;
  }

  setNumber(handle: number, text: string, chip: string | null, size: number, bump: boolean): void {
    const n = this.numbers[handle];
    if (!n) return;
    n.main.textContent = text;
    if (chip) {
      n.chip.textContent = chip;
      n.chip.style.display = 'inline-block';
    } else n.chip.style.display = 'none';
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
    this.arrowCursor = 0;
    this.raidUsed = false;
  }

  badge(
    x: number,
    y: number,
    z: number,
    answers: readonly AnswerTag[],
    key: string,
    border: string,
    label: string,
    scale = 1,
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
    b.el.style.display = 'flex';
    b.el.style.transform = `translate3d(${bx.toFixed(1)}px,${by.toFixed(1)}px,0) translate(-50%,-50%) scale(${scale.toFixed(3)})`;
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
      const ringColor = isDanger ? '#f43f5e' : color;
      a.ring.style.borderColor = ringColor;
      a.ring.style.background = isDanger ? 'rgba(80,6,20,0.85)' : 'rgba(8,10,20,0.75)';
      a.ring.style.boxShadow = isDanger ? '0 0 14px rgba(244,63,94,0.9)' : `0 0 8px ${color}88`;
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
    this.flashStrength = Math.max(
      this.flashStrength * (this.flashT / this.flashDur || 0),
      strength,
    );
    this.flashT = duration;
    this.flashDur = duration;
  }

  danger(): void {
    this.dangerT = 1;
  }

  chroma(): void {
    this.chromaT = 1;
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
      const rise = 46 * (1 - Math.pow(1 - t, 2.2));
      const scale = 1 + n.pop * 0.45;
      const fade = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
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

    if (this.dangerT > 0) {
      this.dangerT = Math.max(0, this.dangerT - dt * 1.1);
      const pulse = Math.sin((1 - this.dangerT) * Math.PI * 3) * 0.5 + 0.5;
      this.dangerEl.style.opacity = (this.dangerT * (0.4 + 0.6 * pulse)).toFixed(3);
    } else if (this.dangerEl.style.opacity !== '0') this.dangerEl.style.opacity = '0';

    if (this.chromaT > 0) {
      this.chromaT = Math.max(0, this.chromaT - dt * 1.6);
      this.chromaEl.style.opacity = this.chromaT.toFixed(3);
    } else if (this.chromaEl.style.opacity !== '0') this.chromaEl.style.opacity = '0';

    const slowOpacity = this.slow.toFixed(2);
    if (this.slowEl.style.opacity !== slowOpacity) this.slowEl.style.opacity = slowOpacity;
  }

  dispose(): void {
    this.resize.disconnect();
    this.root.remove();
  }
}
