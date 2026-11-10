/**
 * Phase 5g presentation follow-ups (UI): Concert Pitch's Ringing on the HUD. The snapshot carries
 * its seconds left (`ringing`) only while `field.ringing` is ahead of the sim; the trigger chips
 * row (an existing component, under the relic bar) heads with a chip naming Concert Pitch from
 * content, a bell and the seconds left, in the Harmony's category colour; nothing without it.
 * Also the UI lab's view of it.
 */
import { createElement, type FunctionComponent, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { createSim } from '../src/sim';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import {
  RINGING_SOURCE,
  ringingChip,
  ringingOf,
  triggerSource,
  type TriggerSource,
} from '../src/ui/hud/triggers';
import { worldOf } from './sim/helpers';

async function tsx<T>(path: string): Promise<T> {
  return (await import(/* @vite-ignore */ path)) as T;
}
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

const concertPitch = () => CONTENT.motifs.find((m) => m.id === RINGING_SOURCE)!;

describe('the snapshot’s Ringing', () => {
  it('ringingOf: the seconds left while the end time is ahead; nothing otherwise', () => {
    expect(ringingOf(undefined, 3)).toEqual({});
    expect(ringingOf(3, 3)).toEqual({});
    expect(ringingOf(2, 3)).toEqual({});
    expect(ringingOf(5.5, 3)).toEqual({ ringing: 2.5 });
  });

  it('buildHudSnapshot carries it only while it rings, and never without Concert Pitch', () => {
    const plain = createSim({ seed: 3, encounter: 'first_light' });
    expect('ringing' in buildHudSnapshot(plain.state, { seed: 3, hovered: null })).toBe(false);
    const sim = createSim({
      seed: 3,
      encounter: 'first_light',
      motifs: [{ id: RINGING_SOURCE, level: 1 }],
    });
    const w = worldOf(sim);
    expect('ringing' in buildHudSnapshot(sim.state, { seed: 3, hovered: null })).toBe(false);
    w.field.ringing = w.time + 2.5;
    expect(buildHudSnapshot(sim.state, { seed: 3, hovered: null }).ringing).toBeCloseTo(2.5, 9);
    w.field.ringing = w.time;
    expect('ringing' in buildHudSnapshot(sim.state, { seed: 3, hovered: null })).toBe(false);
  });
});

describe('the Ringing chip', () => {
  it('names Concert Pitch from content with the seconds left, rounded up to tenths', () => {
    const name = concertPitch().name;
    expect(ringingChip(undefined)).toBe(null);
    expect(ringingChip(0)).toBe(null);
    const c = ringingChip(2.41)!;
    expect(c.source).toMatchObject({ id: RINGING_SOURCE, name, kind: 'motif' });
    expect(c.seconds).toBe(2.5);
    expect(c.text).toBe(`${name} 2.5 s`);
    expect(ringingChip(0.01)!.text).toBe(`${name} 0.1 s`);
    expect(ringingChip(4)!.text).toBe(`${name} 4.0 s`);
    expect(c.label).toContain('2.5 seconds left');
    // Without Concert Pitch in content: no chip.
    expect(ringingChip(2, { motifs: [], relics: [], boons: [] })).toBe(null);
  });

  it('heads the trigger chips row: a bell, the text, the category colour; nothing without it', async () => {
    const TriggerChips = await component<Record<string, unknown>>(
      '../src/ui/hud/TriggerChips',
      'TriggerChips',
    );
    const { triggerColor } = await tsx<{ triggerColor(s: TriggerSource): string }>(
      '../src/ui/hud/TriggerChips',
    );
    const { CATEGORY } = await tsx<{
      CATEGORY: Readonly<Record<string, { icon: string; color: string }>>;
    }>('../src/ui/kit/Chip');
    const html = renderToStaticMarkup(createElement(TriggerChips, { seconds: 10, ringing: 3.04 }));
    expect(html).toContain('data-testid="ringing-chip"');
    expect(html).toContain(`${concertPitch().name} 3.1 s`);
    expect(html).toContain('data-seconds="3.1"');
    // The colour is Concert Pitch's category's (an existing colour, not a new one).
    const colour = triggerColor(triggerSource(RINGING_SOURCE)!);
    expect(colour).toBe(CATEGORY[concertPitch().category]!.color);
    expect(html).toContain(`color:${colour}`);
    // The trigger chips still follow it.
    const both = renderToStaticMarkup(
      createElement(TriggerChips, {
        seconds: 10,
        ringing: 1,
        shown: [
          {
            source: triggerSource('clean_strike')!,
            count: 2,
            at: 10,
            since: 9,
          },
        ],
      }),
    );
    expect(both.indexOf('ringing-chip')).toBeLessThan(both.indexOf('data-trigger="clean_strike"'));
    expect(renderToStaticMarkup(createElement(TriggerChips, { seconds: 10 }))).toBe('');
    expect(renderToStaticMarkup(createElement(TriggerChips, { seconds: 10, ringing: 0 }))).toBe('');
  });

  it('the HUD shows it from the snapshot under the relic bar, and nothing without the key', async () => {
    const { mockHud, mockCallouts } = await import('../src/ui/lab/mock');
    const HudView = await component<Record<string, unknown>>('../src/ui/hud/Hud', 'HudView');
    const hud = mockHud('calm');
    const ringing = renderToStaticMarkup(
      createElement(HudView, {
        hud: { ...hud, ringing: 2 },
        callouts: mockCallouts('calm'),
        decree: null,
      }),
    );
    expect(ringing).toContain('data-testid="ringing-chip"');
    expect(ringing).toContain('data-testid="trigger-chips"');
    const plain = renderToStaticMarkup(createElement(HudView, { hud, callouts: [], decree: null }));
    expect(plain).not.toContain('ringing-chip');
    expect(plain).not.toContain('trigger-chips');
  });
});

describe('the UI lab', () => {
  it('has a view of the Ringing chip and the fill’s relic tiles, and it renders them', async () => {
    const { FILL_VIEWS } = await tsx<{
      FILL_VIEWS: { id: string; group: string; render(): ReactNode }[];
    }>('../src/ui/lab/fillLab');
    const v = FILL_VIEWS.find((x) => x.id === 'fill-hud-ringing')!;
    expect(v.group).toBe('Fill (5g)');
    const html = renderToStaticMarkup(createElement(() => v.render() as never));
    expect(html).toContain('data-testid="ringing-chip"');
    for (const id of ['spare_strings', 'water_clock'])
      expect(html, id).toContain(CONTENT.relics.find((r) => r.id === id)!.name);
  });
});
