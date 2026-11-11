/**
 * Phase 7 W3b (docs/phase-7.md, *W3a and W3b*; W1's requests 1 and 2): HUD text names the
 * player's own Mend ⇄ Empower and wheel mouse roles and Cue modifier, and the Martyr's live Bear
 * key, and is byte-identical to before with the default settings.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, useSettings } from '../src/app/settings';
import { CONTENT } from '../src/content';
import { writeInput } from '../src/input/inputMap';
import { createSim } from '../src/sim';
import { evaluateHints } from '../src/ui/hud/hints';
import { cueModifierMark, withLiveKey } from '../src/ui/hud/labels';
import { switchKeyLabel } from '../src/ui/hud/threadMode';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import type { HudSnapshot } from '../src/ui/store';

type Props = Record<string, unknown>;
async function tsx<T>(path: string): Promise<T> {
  return (await import(/* @vite-ignore */ path)) as T;
}

afterEach(() => useSettings.setState({ settings: DEFAULT_SETTINGS }));

function rebind(): void {
  useSettings.getState().update((d) =>
    writeInput(d, {
      mouse: { thread: 'Mouse0', mode: 'Mouse3', wheel: 'Mouse4' },
      cueModifier: 'Control',
    }),
  );
}

/** A calm fight: everyone full, the Thread in Mend, so the Empower hint shows. */
function healthy(): HudSnapshot {
  const sim = createSim({ seed: 7, encounter: 'sandbox', debug: true });
  const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
  return {
    ...hud,
    encounter: { ...hud.encounter, kind: 'skirmish', status: 'fighting', elapsed: 200, enemies: 1 },
    weaver: { ...hud.weaver, threadMode: 'mend' },
    party: hud.party.map((h) => ({ ...h, hp: h.maxHp })),
  };
}

const empowerHint = () => evaluateHints(healthy()).find((h) => h.id === 'empower')?.text;

describe('live input names in HUD text', () => {
  it('default settings: the words are as before', () => {
    expect(empowerHint()).toBe(
      'Everyone is healthy — press {RMB} to switch the Thread to Empower and add damage',
    );
    expect(switchKeyLabel()).toBe('RMB');
    expect(cueModifierMark()).toBe('⇧');
  });

  it('a rebound Mend ⇄ Empower role and Cue modifier are named in hints and the key hints', async () => {
    rebind();
    expect(empowerHint()).toBe(
      'Everyone is healthy — press {Mouse 4} to switch the Thread to Empower and add damage',
    );
    expect(switchKeyLabel()).toBe('Mouse 4');
    expect(cueModifierMark()).toBe('Ctrl+');
    const { KeyHints } = await tsx<{ KeyHints: FunctionComponent<Props> }>(
      '../src/ui/hud/KeyHints',
    );
    const html = renderToStaticMarkup(createElement(KeyHints, {}));
    expect(html).toContain('Ctrl+1–4');
    expect(html).toContain('/ Mouse 5');
    expect(html).not.toContain('RMB');
    expect(html).not.toContain('MMB');
    expect(html).not.toContain('⇧');
  });

  it('the key hints read as before with the defaults', async () => {
    const { KeyHints } = await tsx<{ KeyHints: FunctionComponent<Props> }>(
      '../src/ui/hud/KeyHints',
    );
    const html = renderToStaticMarkup(createElement(KeyHints, {}));
    expect(html).toContain('>RMB<');
    expect(html).toContain('⇧1–4');
    expect(html).toContain('/ MMB click');
  });

  it('the Martyr’s passive shows the live Bear key only once it moves off B', async () => {
    const martyr = CONTENT.callings.find((c) => c.id === 'martyr')!;
    const { CallingPassive } = await tsx<{ CallingPassive: FunctionComponent<Props> }>(
      '../src/ui/screens/CallingParts',
    );
    const before = renderToStaticMarkup(createElement(CallingPassive, { def: martyr }));
    expect(before).not.toContain('live-key');
    expect(withLiveKey('Bear (B)', 'bear', 'B')).toBe('Bear (B)');
    useSettings.getState().update((d) => ({ ...d, bindings: { bear: ['KeyN'] } }));
    const after = renderToStaticMarkup(createElement(CallingPassive, { def: martyr }));
    expect(after).toContain('data-testid="live-key"');
    expect(after).toContain('>N<');
    expect(withLiveKey('Bear (B)', 'bear', 'B')).toBe('Bear (B) · Your key: N');
  });
});
