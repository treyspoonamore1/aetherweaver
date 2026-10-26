import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, buildCodeIndex, moveVector, type Action } from '../src/input/actions';
import { effectiveBindings } from '../src/input/bindings';
import { keyLabel } from '../src/input/keyLabel';
import { heroAt, smartTarget } from '../src/input/smartCast';
import { createSim } from '../src/sim';
import { buildHudSnapshot } from '../src/ui/hudBridge';

describe('input', () => {
  it('a key a player gave one action leaves the default that had it (the Martyr’s B)', () => {
    const b = effectiveBindings({ threadMode: ['KeyB'] });
    expect(b.threadMode).toEqual(['KeyB']);
    expect(b.bear).toEqual([]);
    expect(buildCodeIndex(b).get('KeyB')).toBe('threadMode');
    expect(effectiveBindings({}).bear).toEqual(['KeyB']);
  });

  it('maps physical key codes to actions', () => {
    const index = buildCodeIndex(DEFAULT_BINDINGS);
    expect(index.get('KeyW')).toBe('moveUp');
    expect(index.get('ArrowLeft')).toBe('moveLeft');
    expect(index.get('Digit3')).toBe('focus3');
    expect(index.get('Backquote')).toBe('devPanel');
  });

  it('builds normalised move vectors', () => {
    const v = (...actions: Action[]) => moveVector(new Set(actions));
    expect(v('moveUp')).toEqual({ x: 0, z: -1 });
    expect(v('moveUp', 'moveDown')).toEqual({ x: 0, z: 0 });
    const diag = v('moveUp', 'moveRight');
    expect(Math.hypot(diag.x, diag.z)).toBeCloseTo(1, 12);
  });

  it('labels keys without a layout map', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Digit1')).toBe('1');
    expect(keyLabel('Backquote')).toBe('`');
    expect(keyLabel('F3')).toBe('F3');
  });

  it('picks the nearest hero within the pick radius', () => {
    const sim = createSim({ seed: 1 });
    const kael = sim.state.entities.get(sim.state.party[0]!)!;
    expect(heroAt(sim.state, kael.x + 0.5, kael.z)).toBe(kael.id);
    expect(heroAt(sim.state, 18, 18)).toBeNull();
    expect(smartTarget(null, kael.id)).toBe(kael.id);
    expect(smartTarget(7, kael.id)).toBe(7);
  });
});

describe('HUD bridge', () => {
  it('snapshots plain data, including the threaded hero', () => {
    const sim = createSim({ seed: 2 });
    sim.step([{ t: 'thread', slot: 2 }]);
    const hud = buildHudSnapshot(sim.state, { seed: 2, hovered: null });
    expect(hud.party.map((p) => p.name)).toEqual(['Kael', 'Lyra', 'Vexis']);
    expect(hud.party[2]!.threaded).toBe(true);
    expect(hud.weaver.threadSlot).toBe(2);
    expect(hud.tick).toBe(1);
    expect(JSON.parse(JSON.stringify(hud))).toEqual(hud);
  });
});
