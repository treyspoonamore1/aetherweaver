/**
 * Health at a glance (docs/health-ui.md): where the party frames and the Weaver bar sit (moved
 * anywhere in Edit HUD layout, pinned by their nearest corner), what a frame says about a hero's
 * life (the colour of how much is left, the number a healer works from, critical, ailing, out of
 * reach), and the bars over the heroes, drawn by the real render view from a real sim.
 */
import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { CRITICAL, HURT, LIFE_OK, healthBands, healthLevel, raging } from '../src/app/healthLevels';
import { DEFAULT_HUD, DEFAULT_WEAVER_BAR, useSettings } from '../src/app/settings';
import { CONTENT, heroDef } from '../src/content';
import type { Command, Sim } from '../src/sim';
import { EntityLayer } from '../src/render/entities';
import { FxKit } from '../src/render/fx/kit';
import { createModelMaterial } from '../src/render/models/material';
import type { AllyBarView } from '../src/render/overlay';
import { PartyBarsView, TRAIL_DRAIN, TRAIL_HOLD, type AllyBarsMode } from '../src/render/partyBars';
import type { FrameInfo } from '../src/render/types';
import {
  coversTopBand,
  crestBelow,
  frameSide,
  framesPlaceStyle,
  placeFor,
  SNAP,
  TOOLBAR_MARGIN,
  toolbarSpot,
  weaverBarPlaceStyle,
} from '../src/ui/hud/framesLayout';
import { frameLevel, frameState, lifeColor, lifeLabels } from '../src/ui/hud/healthModel';
import { mockHud } from '../src/ui/lab/mock';
import { useUi } from '../src/ui/store';
import { sandbox, worldOf } from './sim/helpers';

beforeEach(() => {
  useSettings.getState().reset();
  useUi.getState().resetCombat();
});

describe('where the party frames sit', () => {
  it('by default, bottom left as they always were; moved, by the corner nearest the edges', () => {
    expect(framesPlaceStyle(null)).toEqual({ left: '1rem', bottom: '1.25rem' });
    expect(framesPlaceStyle({ x: 0.1, y: 0.2, corner: 'tl' })).toEqual({
      left: '10.000%',
      top: '20.000%',
    });
    expect(framesPlaceStyle({ x: 0.9, y: 0.8, corner: 'br' })).toEqual({
      right: '10.000%',
      bottom: '20.000%',
    });
    // Centred: their middle pinned to the screen's.
    expect(framesPlaceStyle({ x: 0.5, y: 0.75, corner: 'bc' })).toEqual({
      left: '50.000%',
      transform: 'translateX(-50%)',
      bottom: '25.000%',
    });
  });

  it('dropped frames are kept on screen, snap to the middle, and pin their nearest corner', () => {
    const W = 1000;
    const H = 800;
    const box = { width: 300, height: 200 };
    // Top left quarter: pinned top left at their own top left.
    expect(placeFor({ ...box, left: 50, top: 40 }, W, H)).toEqual({
      x: 0.05,
      y: 0.05,
      corner: 'tl',
    });
    // Bottom right: pinned by their bottom right corner (they grow up and left from it).
    expect(placeFor({ ...box, left: 650, top: 560 }, W, H)).toEqual({
      x: 0.95,
      y: 0.95,
      corner: 'br',
    });
    // Near the middle: snapped to it.
    const near = 500 - 150 + W * SNAP * 0.5;
    expect(placeFor({ ...box, left: near, top: 500 }, W, H)).toEqual({
      x: 0.5,
      y: 0.875,
      corner: 'bc',
    });
    // Dragged off the screen: brought back onto it.
    expect(placeFor({ ...box, left: -400, top: 900 }, W, H)).toEqual({ x: 0, y: 1, corner: 'bl' });
  });

  it('barks and tooltips open toward the middle of the screen', () => {
    const at = (corner: 'tl' | 'tr' | 'bl' | 'br' | 'bc') => ({ x: 0.5, y: 0.5, corner });
    expect(frameSide(DEFAULT_HUD.frames)).toBe('right');
    expect(frameSide({ ...DEFAULT_HUD.frames, at: at('tr') })).toBe('left');
    expect(frameSide({ ...DEFAULT_HUD.frames, orientation: 'horizontal', at: at('bc') })).toBe(
      'above',
    );
    expect(frameSide({ ...DEFAULT_HUD.frames, orientation: 'horizontal', at: at('tl') })).toBe(
      'below',
    );
  });

  it('Edit HUD layout: its drafts show until it ends; leaving the fight closes it', () => {
    const ui = useUi.getState();
    ui.setLayoutEditing(true);
    ui.setFramesDraft({ ...DEFAULT_HUD.frames, scale: 1.2 });
    ui.setWeaverBarDraft({ at: { x: 0.5, y: 0.03, corner: 'tc' }, scale: 0.9 });
    expect(useUi.getState().framesDraft?.scale).toBe(1.2);
    expect(useUi.getState().weaverBarDraft?.scale).toBe(0.9);
    ui.setLayoutEditing(false);
    expect(useUi.getState()).toMatchObject({
      layoutEditing: false,
      framesDraft: null,
      weaverBarDraft: null,
    });
    ui.setLayoutEditing(true);
    ui.setWeaverBarDraft(DEFAULT_WEAVER_BAR);
    ui.resetCombat();
    expect(useUi.getState()).toMatchObject({ layoutEditing: false, weaverBarDraft: null });
  });

  it('the Weaver bar: bottom middle by default, wider or narrower with its size; moved, pinned', () => {
    // Centred, but right of the frames' column on a narrow screen, as it always was.
    expect(weaverBarPlaceStyle(null)).toEqual({
      left: 'max(34rem, calc(50% - 22.000rem))',
      bottom: '1.25rem',
    });
    expect(weaverBarPlaceStyle(null, 1.2).left).toBe('max(34rem, calc(50% - 26.400rem))');
    expect(weaverBarPlaceStyle({ x: 0.5, y: 0.03, corner: 'tc' }, 0.9)).toEqual({
      left: '50.000%',
      transform: 'translateX(-50%)',
      top: '3.000%',
    });
    expect(weaverBarPlaceStyle({ x: 0.97, y: 0.9, corner: 'br' })).toEqual({
      right: '3.000%',
      bottom: '10.000%',
    });
  });

  it('put in the top half of the screen, the bar’s crest (the Thread dial) opens under it', () => {
    expect(crestBelow(null)).toBe(false);
    expect(crestBelow({ x: 0.5, y: 0.03, corner: 'tc' })).toBe(true);
    expect(crestBelow({ x: 0.1, y: 0.45, corner: 'tl' })).toBe(true);
    expect(crestBelow({ x: 0.5, y: 0.98, corner: 'bc' })).toBe(false);
  });

  it('the editor’s toolbar keeps clear of the panels: top middle, else the bottom, else the middle', () => {
    const W = 1280;
    const H = 720;
    const size = { width: 416, height: 260 };
    const corner = { left: 16, top: 400, width: 300, height: 300 };
    expect(toolbarSpot('top', size, [corner, null], W, H)).toBe('top');
    // A panel moved to the top middle: the toolbar goes to the bottom, and stays there.
    const top = { left: 340, top: 20, width: 600, height: 130 };
    expect(toolbarSpot('top', size, [corner, top], W, H)).toBe('bottom');
    expect(toolbarSpot('bottom', size, [corner], W, H)).toBe('bottom');
    // Panels at the top and the bottom middle: the middle of the screen.
    const bottom = { left: 340, top: H - TOOLBAR_MARGIN - 100, width: 600, height: 100 };
    expect(toolbarSpot('top', size, [top, bottom], W, H)).toBe('middle');
    // Nowhere clear: it stays where it is.
    const everywhere = { left: 0, top: 0, width: W, height: H };
    expect(toolbarSpot('bottom', size, [everywhere], W, H)).toBe('bottom');
  });

  it('a panel over the top middle, where boss bars and banners show, is said to cover them', () => {
    const W = 1280;
    // The band: 36 rem wide in the middle (352–928 px at 16 px), 15 rem down.
    const bar = { left: 288, top: 14, width: 704, height: 140 };
    expect(coversTopBand(bar, W, 16)).toBe(true);
    // Lower down, or off to the side: clear.
    expect(coversTopBand({ ...bar, top: 15 * 16 }, W, 16)).toBe(false);
    expect(coversTopBand({ ...bar, left: 940, width: 320 }, W, 16)).toBe(false);
    expect(coversTopBand({ left: 16, top: 60, width: 330, height: 340 }, W, 16)).toBe(false);
    // A larger UI scale widens the band.
    expect(coversTopBand({ left: 16, top: 60, width: 330, height: 340 }, W, 20)).toBe(true);
  });

  it('the layout and the health read-outs are saved settings', () => {
    useSettings.getState().update((s) => ({
      ...s,
      hud: {
        ...s.hud,
        allyBars: 'hurt',
        healthText: 'percent',
        frames: { at: { x: 0.5, y: 0.9, corner: 'bc' }, scale: 1.25, orientation: 'horizontal' },
      },
    }));
    expect(useSettings.getState().settings.hud).toMatchObject({
      allyBars: 'hurt',
      healthText: 'percent',
      frames: { scale: 1.25, orientation: 'horizontal' },
    });
    expect(() =>
      useSettings.getState().update((s) => ({
        ...s,
        hud: { ...s.hud, frames: { ...s.hud.frames, scale: 2 } },
      })),
    ).toThrow();
    // The Weaver bar's place and size, likewise (75–125%).
    useSettings.getState().update((s) => ({
      ...s,
      hud: { ...s.hud, weaverBar: { at: { x: 0.5, y: 0.03, corner: 'tc' }, scale: 0.85 } },
    }));
    expect(useSettings.getState().settings.hud.weaverBar).toEqual({
      at: { x: 0.5, y: 0.03, corner: 'tc' },
      scale: 0.85,
    });
    expect(() =>
      useSettings.getState().update((s) => ({
        ...s,
        hud: { ...s.hud, weaverBar: { ...s.hud.weaverBar, scale: 1.5 } },
      })),
    ).toThrow();
  });
});

describe('a hero’s life on their frame', () => {
  it('one ramp, frames and bars alike: healthy, hurt under half, critical under a quarter', () => {
    expect([HURT, CRITICAL]).toEqual([0.5, 0.25]);
    expect(healthLevel(1600, 1600)).toBe(0);
    expect(healthLevel(799, 1600)).toBe(1);
    expect(healthLevel(399, 1600)).toBe(2);
    expect(lifeColor(0)).toBe(LIFE_OK);
    expect(lifeColor(1)).toBe('var(--color-threat)');
    expect(lifeColor(2)).toBe('var(--color-lethal)');
  });

  it('the default heroes keep the shared ramp, whatever their def or a fall (docs/phase-5b.md)', () => {
    expect(healthBands()).toEqual({ hurt: 0.5, critical: 0.25 });
    for (const id of CONTENT.defaultParty) {
      expect(healthBands(id), id).toEqual({ hurt: 0.5, critical: 0.25 });
      for (const hp of [1600, 801, 799, 401, 399, 1])
        for (const fast of [undefined, false, true])
          expect(healthLevel(hp, 1600, id, fast), `${id} ${hp} ${fast}`).toBe(
            healthLevel(hp, 1600),
          );
      expect(raging(500, 1600, id)).toBe(false);
    }
  });

  it('Brann: no hurt tier, a raging band from 40% to 15%, critical below 15% or falling fast', () => {
    expect(healthBands('brann')).toEqual({ hurt: 0, critical: 0.15, raging: 0.4 });
    const max = 1250;
    expect(healthLevel(max, max, 'brann')).toBe(0);
    expect(healthLevel(max * 0.3, max, 'brann')).toBe(0);
    expect(healthLevel(max * 0.16, max, 'brann')).toBe(0);
    expect(healthLevel(max * 0.14, max, 'brann')).toBe(2);
    expect(healthLevel(max * 0.9, max, 'brann', true)).toBe(2);
    for (let hp = 0; hp <= max; hp += 25) expect(healthLevel(hp, max, 'brann')).not.toBe(1);
    expect(raging(max * 0.41, max, 'brann')).toBe(false);
    expect(raging(max * 0.39, max, 'brann')).toBe(true);
    expect(raging(max * 0.15, max, 'brann')).toBe(true);
    expect(raging(max * 0.14, max, 'brann')).toBe(false);
    expect(raging(max * 0.3, max)).toBe(false);
  });

  it('the frame reads each hero’s own bands: the starters’ ramp, Brann’s with falling fast (W6)', () => {
    const [kael, lyra, vexis] = mockHud('calm').party;
    for (const h of [kael!, lyra!, vexis!])
      for (const share of [1, 0.6, 0.49, 0.3, 0.24, 0.1])
        expect(frameLevel({ ...h, hp: h.maxHp * share }), `${h.defId} ${share}`).toBe(
          healthLevel(h.maxHp * share, h.maxHp),
        );
    const max = heroDef('brann').maxHp;
    const brann = { ...kael!, id: 9, defId: 'brann', maxHp: max };
    const blood = { rage: 0, bloodlust: false, deathless: false, oath: 0, tithe: false, bled: 0 };
    expect(frameLevel({ ...brann, hp: max * 0.3, blood: { ...blood, fast: false } })).toBe(0);
    expect(frameState({ ...brann, hp: max * 0.3, blood: { ...blood, fast: false } }).critical).toBe(
      false,
    );
    expect(frameLevel({ ...brann, hp: max * 0.3, blood: { ...blood, fast: true } })).toBe(2);
    expect(frameLevel({ ...brann, hp: max * 0.12 })).toBe(2);
  });

  it('the number a healer works from: life missing by default, or the percent, or life left', () => {
    expect(lifeLabels(1180, 1600, 'missing')).toEqual({ big: '−420', percent: '74%' });
    expect(lifeLabels(1600, 1600, 'missing').big).toBe('');
    expect(lifeLabels(1180, 1600, 'percent')).toEqual({ big: '74%', percent: null });
    expect(lifeLabels(1180, 1600, 'current')).toEqual({ big: '1,180', percent: '74%' });
  });

  it('the whole frame: critical, an ailment Chime would cleanse, out of reach', () => {
    const kael = mockHud('calm').party[0]!;
    const near = { ...kael, distance: 3, statuses: [] };
    expect(frameState(near)).toEqual({ critical: false, ailing: false, far: false });
    expect(frameState({ ...near, hp: near.maxHp * 0.2 }).critical).toBe(true);
    const dirge = { id: 'dirge' as const, remaining: 3, duration: 5 };
    expect(frameState({ ...near, statuses: [dirge] }).ailing).toBe(true);
    // Shaken isn't an ailment (Chime doesn't cleanse it); Blind Score names no answer.
    expect(frameState({ ...near, statuses: [{ ...dirge, id: 'shaken' }] }).ailing).toBe(false);
    expect(frameState({ ...near, statuses: [dirge] }, true).ailing).toBe(false);
    const reach = CONTENT.techniques.ward.range;
    expect(frameState({ ...near, distance: reach + 0.5 }).far).toBe(true);
    // Down or out, nothing glows.
    expect(frameState({ ...near, hp: 0, downed: true }).critical).toBe(false);
  });
});

describe('the bars over the heroes', () => {
  const SETTINGS: FrameInfo['settings'] = {
    screenShake: 1,
    flashes: 1,
    damageNumbers: true,
    colorVision: 'normal',
  };

  function harness(sim: Sim = sandbox()) {
    const kit = new FxKit();
    const entities = new EntityLayer(createModelMaterial());
    const bars = new PartyBarsView(entities);
    const drawn: { y: number; bar: AllyBarView }[] = [];
    const sink = {
      allyBar: (_x: number, y: number, _z: number, bar: AllyBarView) => void drawn.push({ y, bar }),
    };
    const cam = new THREE.Vector3(0, 22, 18);
    let time = 0;
    const tick = (mode: AllyBarsMode = 'always', commands: Command[] = []) => {
      sim.step(commands);
      sim.drainEvents();
      const frame: FrameInfo = {
        realDt: 1 / 60,
        time,
        alpha: 1,
        hoveredHero: null,
        hoveredEnemy: null,
        aim: null,
        settings: SETTINGS,
      };
      kit.begin(time, cam);
      entities.sync(sim.state, frame, kit, 1 / 60);
      drawn.length = 0;
      bars.sync(sim.state, sink, 1 / 60, time, mode);
      kit.end(1 / 60, 1280, 720, 720, 45);
      time += 1 / 60;
    };
    const run = (frames: number, mode: AllyBarsMode = 'always') => {
      for (let i = 0; i < frames; i++) tick(mode);
    };
    const hero = (slot: number) => worldOf(sim).entities.get(sim.state.party[slot]!)!;
    return { sim, bars, drawn, tick, run, hero };
  }

  it('always: the whole party, keys 1–3 on tags in their colours, healthy at full life', () => {
    const h = harness();
    h.run(5);
    expect(h.drawn.map((d) => d.bar.key)).toEqual(['1', '2', '3']);
    for (const [slot, d] of h.drawn.entries()) {
      expect(d.bar).toMatchObject({ hp: 1, trail: 1, level: 0, lethal: false, dim: false });
      expect(d.bar.keyHex).toBe(heroDef(h.hero(slot).hero!.defId).color);
    }
  });

  it('a hit leaves a white trail that holds, then drains to the life left', () => {
    const h = harness();
    h.run(5);
    const kael = h.hero(0);
    kael.health!.hp = kael.health!.maxHp * 0.4;
    h.run(1);
    const hit = h.bars.drawn[0]!;
    expect(hit).toMatchObject({ level: 1 });
    expect(hit.hp).toBeCloseTo(0.4, 2);
    expect(hit.trail).toBeCloseTo(1, 5);
    h.run(Math.floor(TRAIL_HOLD * 60) - 2);
    expect(h.bars.drawn[0]!.trail).toBeCloseTo(1, 5);
    h.run(Math.ceil((0.6 / TRAIL_DRAIN) * 60) + 4);
    expect(h.bars.drawn[0]!.trail).toBeCloseTo(h.bars.drawn[0]!.hp, 5);
  });

  it('under a quarter: critical, glowing; out of the Weaver’s reach: faded', () => {
    const h = harness();
    h.run(2);
    const lyra = h.hero(1);
    lyra.health!.hp = lyra.health!.maxHp * 0.2;
    h.run(1);
    expect(h.bars.drawn[1]).toMatchObject({ level: 2 });
    expect(h.bars.drawn[1]!.pulse).toBeGreaterThan(0);
    const reach = CONTENT.techniques.ward.range;
    h.tick('always', [
      { t: 'debug', op: { op: 'teleportWeaver', x: lyra.x + reach + 3, z: lyra.z } },
    ]);
    h.run(2);
    expect(h.bars.drawn[1]!.dim).toBe(true);
  });

  it('when hurt: only the hurt heroes; off: none', () => {
    const h = harness();
    h.run(3, 'hurt');
    expect(h.drawn).toHaveLength(0);
    const vexis = h.hero(2);
    vexis.health!.hp -= 50;
    h.run(1, 'hurt');
    expect(h.drawn.map((d) => d.bar.key)).toEqual(['3']);
    h.run(1, 'off');
    expect(h.drawn).toHaveLength(0);
  });
});
