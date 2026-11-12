/**
 * Phase 8b, the review's Part D (docs/phase-8.md, 8b): the outline shell carries every event cue
 * the body carries at its silhouette, but not the two standing rims (the rank-and-file hostile rim
 * and the elite's gold, with its crown's glow) unless the owner's HOSTILE_OUTLINE says so, nor the
 * Weaver's resting rim (always: her outline stays lead at rest; her event rims are carried). As landed (both owner
 * constants off): a rank-and-file foe's and an elite's outline is dark lead with their rim on the
 * body only, and an aura-covered hero's outline carries the aura tint. Driven through the real
 * EntityLayer and sim; the shader's gate is pinned in its source.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ChordConfig, Sim } from '../src/sim';
import { EntityLayer } from '../src/render/entities';
import { FxKit } from '../src/render/fx/kit';
import { OWN_LOOK, OWN_RIM, restRim, type WeaverLook } from '../src/render/keepsakeCues';
import { HOSTILE_EDGE, HOSTILE_OUTLINE } from '../src/render/models/artFlag';
import { RIM_STANDING, createModelMaterial } from '../src/render/models/material';
import { C } from '../src/render/palette';
import type { FrameInfo } from '../src/render/types';
import { CONTENT } from '../src/content';
import { sandbox, spawn } from './sim/helpers';

/** Fortissimo on the beam, Sostenuto in the field: the heroes stand in an aura. */
const GUARDIAN: ChordConfig[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];

function harness(sim: Sim, look: WeaverLook = { ...OWN_LOOK }) {
  const kit = new FxKit();
  const model = createModelMaterial();
  const entities = new EntityLayer(model);
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const run = (ticks: number, commands: Parameters<Sim['step']>[0] = []) => {
    for (let t = 0; t < ticks; t++) {
      sim.step(t === 0 ? commands : []);
      sim.drainEvents();
      const frame: FrameInfo = {
        realDt: 1 / 60,
        time,
        alpha: 1,
        hoveredHero: null,
        hoveredEnemy: null,
        aim: null,
        settings: { screenShake: 1, flashes: 1, damageNumbers: true, colorVision: 'normal' },
        look,
      } as FrameInfo;
      entities.setLook(look);
      kit.begin(time, cam);
      entities.sync(sim.state, frame, kit, 1 / 60);
      kit.end(1 / 60, 1280, 720, 720, 45);
      time += 1 / 60;
    }
  };
  /** An entity's batch and its instance in it this frame. */
  const instance = (id: number) => {
    const rec = entities.recs.get(id)!;
    let i = 0;
    for (const e of sim.state.entities.list()) {
      if (e.id === id) break;
      if (entities.recs.get(e.id)?.batch === rec.batch) i++;
    }
    return { batch: rec.batch, i };
  };
  return { model, entities, run, instance };
}

describe('the outline shell and the standing rims (as landed)', () => {
  it('lands with both owner constants off', () => {
    expect(HOSTILE_EDGE).toBe(false);
    expect(HOSTILE_OUTLINE).toBe(false);
  });

  it('marks the hostile and elite rims as standing (body only), and an aura tint not', () => {
    const sim = sandbox({ chords: GUARDIAN });
    const h = harness(sim);
    h.run(2, [spawn('hollow_chorister', -4, -9), spawn('hollow_chorister', 4, -9, true)]);
    h.run(120);
    const enemies = sim.state.entities.list().filter((e) => e.enemy);
    const plain = enemies.find((e) => e.enemy!.tier !== 'elite')!;
    const elite = enemies.find((e) => e.enemy!.tier === 'elite')!;
    expect(plain && elite).toBeTruthy();
    const rim = new THREE.Color();
    // The rank-and-file hostile rim: on the body (0.18), standing, so never on the outline.
    let x = h.instance(plain.id);
    expect(x.batch.tintOf(x.i, rim)).toBeCloseTo(0.18, 6);
    expect(x.batch.standingOf(x.i)).toBe(true);
    // The elite's gold: the same.
    x = h.instance(elite.id);
    expect(x.batch.tintOf(x.i, rim)).toBeCloseTo(0.18, 6);
    expect(rim.getHexString()).toBe(C.gold.getHexString());
    expect(x.batch.standingOf(x.i)).toBe(true);
    // Its crown's gold glow too (the elite's mark, on its body only).
    const crown = (h.entities as unknown as { crown: typeof x.batch }).crown;
    expect(crown.pushed).toBe(1);
    expect(crown.tintOf(0, rim)).toBeCloseTo(0.4, 6);
    expect(crown.standingOf(0)).toBe(true);
    // An aura-covered hero: its aura tint is an event cue, carried by the outline too.
    const hero = sim.state.entities.get(sim.state.party[0]!)!;
    expect(hero.hero!.auraMask).not.toBe(0);
    x = h.instance(hero.id);
    expect(x.batch.tintOf(x.i, rim)).toBeCloseTo(0.3, 6);
    expect(x.batch.standingOf(x.i)).toBe(false);
  });

  it('draws no rim tint on the outline for a standing rim, and the rim otherwise (shader)', () => {
    const { material } = createModelMaterial();
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(shader as never, null as never);
    const frag = shader.fragmentShader.replace(/\s+/g, ' ');
    // A standing rim is marked by RIM_STANDING added to its strength's size, and unmarked.
    expect(RIM_STANDING).toBe(16);
    expect(frag).toContain('bool awStanding = abs(vTint.a) > 8.0;');
    expect(frag).toContain(
      'float awTintA = awStanding ? vTint.a - sign(vTint.a) * 16.0 : vTint.a;',
    );
    // The body draws every rim, standing or not (main's line, on the unmarked strength).
    expect(frag).toContain(
      'if (awTintA >= 0.0) totalEmissiveRadiance += vTint.rgb * awTintA * (0.18 + awFres * 1.9);',
    );
    // The outline adds the rim only when it is not a standing rim.
    const shell = frag.slice(frag.indexOf('if (vLead.y > 0.5) {'));
    expect(shell).toMatch(
      /if \(!awStanding\) awShell \+= awTintA >= 0\.0 \? vTint\.rgb \* awTintA/,
    );
    expect(shell.match(/awTintA/g)!.length).toBe(3);
  });

  it("keeps the Weaver's resting rim off her outline, her own and a dark robe's; a flinch is not", () => {
    // The darkest robe: its resting rim is the strongest (restRim).
    const dark = [...CONTENT.cosmetics.robes].sort(
      (a, b) => restRim(b.id).strength - restRim(a.id).strength,
    )[0]!;
    expect(restRim(dark.id).strength).toBeGreaterThan(OWN_RIM.strength + 0.05);
    for (const [look, strength] of [
      [{ ...OWN_LOOK }, OWN_RIM.strength],
      [{ ...OWN_LOOK, robe: dark.id }, restRim(dark.id).strength],
    ] as const) {
      const sim = sandbox();
      const h = harness(sim, look);
      h.run(3);
      const x = h.instance(sim.state.weaverId);
      const rim = new THREE.Color();
      expect(x.batch.tintOf(x.i, rim), look.robe ?? 'own').toBeCloseTo(strength, 5);
      expect(x.batch.standingOf(x.i), look.robe ?? 'own').toBe(true);
    }
    // A borne wound's flinch (the Martyr) is an event rim: carried by her outline.
    const sim = sandbox();
    const h = harness(sim);
    h.run(2);
    h.entities.recs.get(sim.state.weaverId)!.flinch = 1;
    h.run(1);
    const x = h.instance(sim.state.weaverId);
    expect(x.batch.tintOf(x.i, new THREE.Color())).toBeGreaterThan(1);
    expect(x.batch.standingOf(x.i)).toBe(false);
  });
});
