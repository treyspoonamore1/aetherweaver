/**
 * The Thread dial (docs/thread-dial.md): the Thread's mode as one big glyph over the Weaver bar,
 * Mend ⇄ Empower (and Bear on the Martyr's runs). Its words and states are a pure model over the
 * HUD snapshot (`threadDialView`); the look is shared with the bar's Thread row and the frames.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettings } from '../src/app/settings';
import { VISION_PALETTES } from '../src/app/colorVision';
import { rejectCallouts } from '../src/ui/hud/buzz';
import { switchKeyLabel, threadDialView, threadModeLook } from '../src/ui/hud/threadMode';
import { callingLook } from '../src/ui/kit/callingLook';
import { mockHud } from '../src/ui/lab/mock';
import type { Callout, WeaverHud } from '../src/ui/store';

const calm = mockHud('calm');
const kael = calm.party[0]!;
const weaver = (patch: Partial<WeaverHud>): WeaverHud => ({ ...calm.weaver, ...patch });

beforeEach(() => {
  useSettings.getState().reset();
});

describe('the Thread dial', () => {
  it('Mend and Empower: the mode, its glyph, what it does to whom and the key that switches', () => {
    const mend = threadDialView(weaver({ threadMode: 'mend' }), kael);
    expect(mend).toMatchObject({ mode: 'mend', state: 'live', plate: 'Mend', switchKey: 'RMB' });
    expect(mend.look.icon).toBe('mend');
    expect(mend.says).toBe('Mend: your Thread heals Kael. RMB switches to Empower.');
    const empower = threadDialView(weaver({ threadMode: 'empower' }), kael);
    expect(empower).toMatchObject({ mode: 'empower', state: 'live', plate: 'Empower' });
    expect(empower.look.icon).toBe('empower');
    expect(empower.says).toBe('Empower: Kael hits harder. RMB switches to Mend.');
    // No Bear key off the Martyr's runs.
    expect(mend.bearKey).toBeNull();
  });

  it('Bear (the Martyr): its share on the plate, its key, and the mode it goes back to', () => {
    const bear = threadDialView(
      weaver({ threadMode: 'bear', bearShare: 0.35, lastMode: 'empower' }),
      kael,
    );
    expect(bear).toMatchObject({ mode: 'bear', plate: 'Bear 35%', bearKey: 'B' });
    expect(bear.look.icon).toBe('bear');
    expect(bear.says).toBe(
      'Bear: you take 35% of what Kael would lose. B again goes back to Empower.',
    );
    // On her run, in Mend, the dial still shows Bear's key.
    expect(threadDialView(weaver({ threadMode: 'mend', bearShare: 0.35 }), kael).bearKey).toBe('B');
  });

  it('dims for a Thread on no one, snapped, or slack while the Weaver is down', () => {
    const idle = threadDialView(weaver({ threadSlot: null }), null);
    expect(idle.state).toBe('idle');
    expect(idle.says).toMatch(/^Mend, on no one: press 1–3 or click a hero/);
    const snapped = threadDialView(weaver({ threadMode: 'empower', threadLock: 2.4 }), kael);
    expect(snapped).toMatchObject({ state: 'snapped', plate: 'Snapped', mode: 'empower' });
    expect(snapped.says).toBe('The Thread snapped: it can attach again in 2.4 s');
    // Down outranks snapped.
    expect(threadDialView(weaver({ downed: true, threadLock: 1 }), kael).state).toBe('down');
  });

  it('names the switch key the player bound (the right mouse button always works too)', () => {
    expect(switchKeyLabel()).toBe('RMB');
    useSettings.getState().update((s) => ({ ...s, bindings: { threadMode: ['KeyX'] } }));
    expect(switchKeyLabel()).toBe('X');
    expect(threadDialView(weaver({ threadMode: 'mend' }), kael).says).toContain(
      'X switches to Empower',
    );
  });

  it('one look for the dial, the bar and the frames: the Thread’s own colours, live per vision', () => {
    expect(threadModeLook('mend').color).toBe('var(--color-mend)');
    expect(threadModeLook('empower').color).toBe('var(--color-empower)');
    expect(threadModeLook('bear').color).toBe(callingLook('martyr').color);
    // The stylesheet's defaults are the standard palette's (colour vision rewrites them).
    const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
    expect(css).toContain(`--color-mend: ${VISION_PALETTES.normal.mend};`);
    expect(css).toContain(`--color-empower: ${VISION_PALETTES.normal.empower};`);
  });

  it('the rejections beside it are the latest two', () => {
    const c = (id: number, kind: Callout['kind']): Callout =>
      ({ id, kind, text: `${kind} ${id}`, expiresAt: 0 }) as Callout;
    const shown = rejectCallouts([c(1, 'reject'), c(2, 'bark'), c(3, 'reject'), c(4, 'reject')]);
    expect(shown.map((x) => x.id)).toEqual([3, 4]);
  });
});
