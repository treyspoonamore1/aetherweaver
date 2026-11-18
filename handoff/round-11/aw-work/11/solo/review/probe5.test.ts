import { afterEach, beforeEach, describe, it } from 'vitest';
import { useSettings } from '/home/user/aw-work/wt-p11solo-review/src/app/settings';
import { InputController, AUTO_SOLO_KEEP } from '/home/user/aw-work/wt-p11solo-review/src/input/InputController';
import type { Command, PartySlot, Sim } from '/home/user/aw-work/wt-p11solo-review/src/sim';
import { addStatus } from '/home/user/aw-work/wt-p11solo-review/src/sim/combat/health';
import { hero, sandbox, spawn, stepFor, stepUntil, worldOf } from '/home/user/aw-work/wt-p11solo-review/tests/sim/helpers';

const KAEL = 0, LYRA = 1, VEXIS = 2;
function key(type: 'keydown' | 'keyup', code: string): Event { return Object.assign(new Event(type), { code, key: code, repeat: false }); }
function pointer(type: string, clientX: number, clientY: number, button = 0): Event { return Object.assign(new Event(type), { clientX, clientY, button }); }
let win: EventTarget; let canvas: EventTarget; const made: InputController[] = [];
beforeEach(() => { win = new EventTarget(); canvas = new EventTarget(); (globalThis as any).window = win; });
afterEach(() => { for (const m of made.splice(0)) m.dispose(); useSettings.getState().reset(); delete (globalThis as any).window; });
const fight = (slot: PartySlot): Sim => {
  const sim = sandbox();
  const k = hero(sim, KAEL);
  stepFor(sim, 1, [spawn('bell_brute', k.x, k.z - 4), { t: 'thread', slot }]);
  for (const e of worldOf(sim).entities.list()) if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
  stepUntil(sim, () => [KAEL, LYRA, VEXIS].every((s) => hero(sim, s).hero!.targetId !== null));
  return sim;
};
const controller = () => { const i = new InputController(canvas as any, () => false, () => {}, undefined, { sound: () => {}, pads: () => [] }); made.push(i); return i; };

function play(sim: Sim, input: InputController, seconds: number, shares: Record<number, number>, stage: (f: number, sim: Sim) => Command[] = () => [], act: (f: number) => void = () => {}) {
  const log: string[] = [];
  for (let f = -150; f < seconds * 60; f++) {
    for (const s of [KAEL, LYRA, VEXIS]) { const h = worldOf(sim).entities.get(sim.state.party[s]!)!.health!; h.hp = h.maxHp * (shares[s] ?? 1); }
    const beat = ((f % 20) + 20) % 20; // busy: Ward three times a second
    if (beat === 0) win.dispatchEvent(key('keydown', 'KeyQ'));
    if (beat === 2) win.dispatchEvent(key('keyup', 'KeyQ'));
    if (f >= 0) act(f);
    input.updatePointer(sim.state);
    const cmds = input.collect();
    for (const c of cmds) if (c.t === 'thread') log.push(`${(f / 60).toFixed(2)}s thread->${['Kael', 'Lyra', 'Vexis'][c.slot]}`);
    const ev = stepFor(sim, 1, [...cmds, ...(f >= 0 ? stage(f, sim) : [])]);
    for (const e of ev) if (e.type === 'soloStarted') log.push(`${(f / 60).toFixed(2)}s ${['Kael', 'Lyra', 'Vexis'][sim.state.party.indexOf(e.hero)]} fires ${e.cued ? 'Cued' : 'plain'}`);
  }
  log.push(`Thread ends on ${['Kael', 'Lyra', 'Vexis'][worldOf(sim).entities.get(sim.state.weaverId)!.weaver!.threadSlot ?? -1]}`);
  return log;
}

describe('Auto-Thread', () => {
  it('A: goes back off a hero under 60% once her Solo has fired (busy with other keys)', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const sim = fight(KAEL);
    const w = worldOf(sim);
    const log = play(sim, controller(), 4, { [LYRA]: AUTO_SOLO_KEEP - 0.1 }, (f) => { if (f === 0) w.entities.get(w.party[LYRA]!)!.hero!.solo = 100; return []; });
    console.log('A (Lyra at 50% life, the Thread the player left on Kael at full life):\n  ' + log.join('\n  '));
  });
  it('C: a stunned Kael with a full wall', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const sim = fight(VEXIS);
    const w = worldOf(sim);
    const log = play(sim, controller(), 7, {}, (f) => { if (f === 0) { const k = w.entities.get(w.party[KAEL]!)!; k.hero!.solo = 100; addStatus(w, k, 'stun', 6, null); } return []; });
    console.log('C (Kael stunned 6 s with his wall full; the Thread the player left on Vexis):\n  ' + log.join('\n  '));
  });
  it('B0: control, no click', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const sim = fight(VEXIS);
    const w = worldOf(sim);
    const log = play(sim, controller(), 5, {}, (f) => { if (f === 0) w.entities.get(w.party[KAEL]!)!.hero!.solo = 100; return []; });
    console.log('B0 (control: the same with no click):\n  ' + log.join('\n  '));
  });
  it('B: a left click on empty ground while a Solo is being followed', () => {
    useSettings.getState().update((d) => ({ ...d, aids: { autoThread: true } }));
    const sim = fight(VEXIS);
    const w = worldOf(sim);
    const log = play(sim, controller(), 5, {}, (f) => { if (f === 0) w.entities.get(w.party[KAEL]!)!.hero!.solo = 100; return []; }, (f) => { if (f === 60) { canvas.dispatchEvent(pointer('pointerdown', 5, 5, 0)); win.dispatchEvent(pointer('pointerdown', 5, 5, 0)); } if (f === 62) { canvas.dispatchEvent(pointer('pointerup', 5, 5, 0)); win.dispatchEvent(pointer('pointerup', 5, 5, 0)); } });
    console.log('B (Kael\'s wall full at 0 s; a left click on bare ground at 1 s; the Thread the player left on Vexis):\n  ' + log.join('\n  '));
  });
});
