/**
 * Phase 8b, the review's Part D, and the owner's choice in Phase 8c (docs/phase-8.md, 8b): the
 * outline shell carries every event cue the body carries at its silhouette. The owner chose the
 * fourth look for the two standing rims, "Red outline, no wash" (artFlag.ts, both constants on): a
 * rank-and-file foe's outline carries its hostile red and its body takes the red at its edge only
 * (a negative strength), and an elite's outline and its crown's carry its gold; neither is marked
 * standing. The Weaver's resting rim is not a hostile rim: always marked standing (on her body, her
 * outline dark lead at rest; her event rims are carried). The shader's gate still keeps a marked
 * rim off the outline, so the earlier looks (a constant off) draw as they did. Driven through the
 * real EntityLayer and sim; the shader's gate is pinned in its source.
 *
 * Re-recorded for Phase 8c: the default (both constants were off), the foe's strength (0.18 on
 * the body became -0.18, the edge-only rim) and the standing marks of the foe, the elite and the
 * crown (true became false). The strengths, colours and shader lines are unchanged.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ChordConfig, Sim } from '../src/sim';
import { EntityLayer } from '../src/render/entities';
import { FxKit } from '../src/render/fx/kit';
import { OWN_LOOK, OWN_RIM, restRim, type WeaverLook } from '../src/render/keepsakeCues';
import {
  HOSTILE_EDGE,
  HOSTILE_OUTLINE,
  HOSTILE_OUTLINE_STRENGTH,
} from '../src/render/models/artFlag';
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

describe('the outline shell and the standing rims (the owner\'s "Red outline, no wash")', () => {
  it('has both owner constants on', () => {
    expect(HOSTILE_EDGE).toBe(true);
    expect(HOSTILE_OUTLINE).toBe(true);
    // The outline's red at the strength the owner saw (measured against the telegraphs at 0.7
    // and 0.45 too, and kept: docs/phase-8.md, 8b).
    expect(HOSTILE_OUTLINE_STRENGTH).toBe(1);
  });

  it('puts the hostile and elite rims on the outline (not standing), as an aura tint is', () => {
    const sim = sandbox({ chords: GUARDIAN });
    const h = harness(sim);
    h.run(2, [spawn('hollow_chorister', -4, -9), spawn('hollow_chorister', 4, -9, true)]);
    h.run(120);
    const enemies = sim.state.entities.list().filter((e) => e.enemy);
    const plain = enemies.find((e) => e.enemy!.tier !== 'elite')!;
    const elite = enemies.find((e) => e.enemy!.tier === 'elite')!;
    expect(plain && elite).toBeTruthy();
    const rim = new THREE.Color();
    // The rank-and-file hostile rim: its life bar's red, edge only on the body (a negative
    // strength: no flat wash), not standing, so the outline carries it: a red outline.
    let x = h.instance(plain.id);
    expect(x.batch.tintOf(x.i, rim)).toBeCloseTo(-0.18, 6);
    expect(rim.getHexString()).toBe('ef4444');
    expect(x.batch.standingOf(x.i)).toBe(false);
    // The elite's gold: on its body as before (0.18) and on its outline too: a gold outline.
    x = h.instance(elite.id);
    expect(x.batch.tintOf(x.i, rim)).toBeCloseTo(0.18, 6);
    expect(rim.getHexString()).toBe(C.gold.getHexString());
    expect(x.batch.standingOf(x.i)).toBe(false);
    // Its crown's gold glow too (the elite's mark: on the crown's outline as well).
    const crown = (h.entities as unknown as { crown: typeof x.batch }).crown;
    expect(crown.pushed).toBe(1);
    expect(crown.tintOf(0, rim)).toBeCloseTo(0.4, 6);
    expect(crown.standingOf(0)).toBe(false);
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
    // The body draws every rim, standing or not (main's line, on the unmarked strength); a
    // negative strength (the hostile rim) is the edge-only rim: almost no flat wash.
    expect(frag).toContain(
      'if (awTintA >= 0.0) totalEmissiveRadiance += vTint.rgb * awTintA * (0.18 + awFres * 1.9);',
    );
    expect(frag).toContain(
      'else totalEmissiveRadiance += vTint.rgb * -awTintA * (0.02 + pow(awFres, 1.6) * 4.0);',
    );
    // The outline adds the rim only when it is not a standing rim (the Weaver's at rest is).
    const shell = frag.slice(frag.indexOf('if (vLead.y > 0.5) {'));
    expect(shell).toMatch(
      /if \(!awStanding\) awShell \+= awTintA >= 0\.0 \? vTint\.rgb \* awTintA/,
    );
    expect(shell.match(/awTintA/g)!.length).toBe(3);
    // The hostile red (the negative strength) on the outline: the body's edge at a fresnel of 1,
    // times its own constant (HOSTILE_OUTLINE_STRENGTH; nothing else is scaled by it).
    expect(shell).toContain(': vTint.rgb * -awTintA * (0.02 + 4.0) * AW_HOSTILE_SHELL;');
    expect(frag).toContain('const float AW_HOSTILE_SHELL = 1.000;');
    expect(frag.match(/AW_HOSTILE_SHELL/g)!.length).toBe(2);
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
