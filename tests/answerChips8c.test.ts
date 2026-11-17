/**
 * Phase 8c (docs/phase-8.md): the telegraphs' answer chips keep off the heroes, the Weaver and a
 * boss, and stay exactly on their telegraph's edge whenever that is clear of them.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Overlay } from '../src/render/overlay';

describe('the answer chips keep off the figures', () => {
  interface Chip {
    used: boolean;
    transform: string;
    opacity: string;
  }
  /** An overlay with no document: the badge pool is faked, the placing is the real code. */
  function overlay(): { o: Overlay; chips: Chip[] } {
    const camera = new THREE.PerspectiveCamera(40, 1280 / 720, 0.5, 220);
    camera.position.set(0, 21.3, 16.6);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const chips: Chip[] = [];
    const badges = Array.from({ length: 4 }, () => {
      const chip: Chip = { used: false, transform: '', opacity: '1' };
      chips.push(chip);
      const style = {
        display: 'none',
        borderColor: '',
        boxShadow: '',
        color: '',
        textShadow: '',
        set transform(v: string) {
          chip.transform = v;
        },
        set opacity(v: string) {
          chip.opacity = v;
        },
      };
      return {
        el: { style },
        icons: { innerHTML: '' },
        label: { textContent: '', style: { display: '', color: '', textShadow: '' } },
        key: '',
        border: '',
        tone: 0,
        faded: false,
        get used() {
          return chip.used;
        },
        set used(v: boolean) {
          chip.used = v;
        },
      };
    });
    const o = Object.create(Overlay.prototype) as Overlay;
    Object.assign(o, {
      camera,
      width: 1280,
      height: 720,
      v: new THREE.Vector3(),
      p: { x: 0, y: 0, onScreen: false, behind: false },
      badges,
      badgeCursor: 0,
      badgeX: new Float32Array(24),
      badgeY: new Float32Array(24),
      clear: new Float32Array(48),
      clearCount: 0,
      badgeAt: { x: 0, y: 0 },
      answerGlyphs: true,
    });
    return { o, chips };
  }
  const centre = (c: Chip): [number, number] => {
    const m = /translate3d\(([-\d.]+)px,([-\d.]+)px/.exec(c.transform)!;
    return [Number(m[1]), Number(m[2])];
  };

  it('a chip that would sit on a hero is drawn beside or under them instead', () => {
    const plain = overlay();
    plain.o.badge(0, 0.1, 0.4, ['ward', 'dome'], 'k', '#fb923c', '1.2');
    const [px, py] = centre(plain.chips[0]!);

    const kept = overlay();
    // A hero stands just where the chip would go.
    kept.o.keepClear(0, 0, 0.56, 2.0);
    kept.o.badge(0, 0.1, 0.4, ['ward', 'dome'], 'k', '#fb923c', '1.2');
    const [x, y] = centre(kept.chips[0]!);
    expect(Math.hypot(x - px, y - py)).toBeGreaterThan(10);
    expect(Math.hypot(x - px, y - py)).toBeLessThanOrEqual(120);
    // Clear of the hero's box: the hero's feet are at the middle of the screen.
    const p = new THREE.Vector3(0, 0, 0).project(
      (kept.o as unknown as { camera: THREE.Camera }).camera,
    );
    const feetY = (-p.y * 0.5 + 0.5) * 720;
    const side = Math.abs(x - 640) > 20 + 50;
    const under = y - 15 >= feetY;
    expect(side || under).toBe(true);
  });

  it('a chip with no free place near stays, and is drawn see-through over the figure', () => {
    const kept = overlay();
    // Twelve giants shoulder to shoulder: nowhere within reach is clear of them.
    for (const x of [-9, -3, 3, 9]) for (const z of [-6, 0, 6]) kept.o.keepClear(x, z, 3.2, 6);
    kept.o.badge(0, 0.1, 0.5, ['ward', 'dome'], 'k', '#fb923c', '1.2');
    const plain = overlay();
    plain.o.badge(0, 0.1, 0.5, ['ward', 'dome'], 'k', '#fb923c', '1.2');
    expect(centre(kept.chips[0]!)).toEqual(centre(plain.chips[0]!));
    expect(kept.chips[0]!.opacity).toBe('0.45');
    expect(plain.chips[0]!.opacity).toBe('1');
  });

  it('a chip clear of every figure stays exactly on its telegraph’s edge', () => {
    const plain = overlay();
    plain.o.badge(6, 0.1, -3, ['ward'], 'k', '#fb923c', '');
    const kept = overlay();
    kept.o.keepClear(0, 0, 0.56, 2.0);
    kept.o.keepClear(-5, 4, 0.56, 2.0);
    kept.o.badge(6, 0.1, -3, ['ward'], 'k', '#fb923c', '');
    expect(centre(kept.chips[0]!)).toEqual(centre(plain.chips[0]!));
  });
});
