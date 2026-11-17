/**
 * Phase 8d (docs/phase-8.md, 8d): reward glyphs on the map. A glyph for each reward at the foot of
 * every stop still ahead, in the tooltip's icons and colours, sized with the text, and read out
 * with the stop.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as Run from '../src/meta/run';
import type { MapNode, RunState } from '../src/meta/types';
import { playedRun } from '../src/ui/lab/mock';
import { rewardChips } from '../src/ui/screens/interlude';
import { mapHeader, movementRows } from '../src/ui/screens/routeText';

/** A .tsx module's export, at run time (the node test build has no JSX to import statically). */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

describe('the map shows each stop’s rewards at its foot', () => {
  type MapProps = { run: RunState; onChoose(id: string): void; onAbandon(): void; card?: boolean };
  const map = () => component<MapProps>('../src/ui/screens/MapScreen', 'MapView');
  const noop = () => {};
  const draw = async (run: RunState) =>
    renderToStaticMarkup(
      createElement(await map(), { run, onChoose: noop, onAbandon: noop, card: false }),
    );
  /** Each stop's own markup, by its title, in the map's order. */
  const pills = (html: string) =>
    [...html.matchAll(/<span[^>]*data-testid="node-rewards"[^>]*>(.*?)<\/span>/g)].map((m) => ({
      whole: m[0],
      tones: [...m[1]!.matchAll(/data-reward="(\w+)"/g)].map((x) => x[1]!),
    }));
  const ahead = (run: RunState): MapNode[] => {
    const walked = new Set(run.path);
    return movementRows(run, mapHeader(run).movement)
      .flat()
      .filter((n) => !walked.has(n.id));
  };

  it('a glyph for each reward of every stop ahead; none on a stop walked', async () => {
    for (const run of [playedRun(0), playedRun(2), playedRun(4, 11)]) {
      expect(run.phase).toBe('map');
      const html = await draw(run);
      const expected = ahead(run)
        .map((n) => rewardChips(n.reward).map((c) => c.tone))
        .filter((tones) => tones.length > 0);
      expect(expected.length).toBeGreaterThan(5);
      const got = pills(html).map((p) => p.tones);
      // The map draws its stops row by row (`movementRows`).
      expect(got).toEqual(expected);
    }
    // Walked stops exist in the later runs, and they carry rewards that are no longer shown.
    const run = playedRun(2);
    expect(run.path.length).toBeGreaterThan(1);
    const first = Run.findNode(run, run.path[0]!)!;
    expect(rewardChips(first.reward).length).toBeGreaterThan(0);
  });

  it('the glyphs are the tooltip’s icons in the tooltip’s colours, sized with the text', async () => {
    const html = await draw(playedRun(0));
    const all = pills(html);
    const svgs = all.flatMap((p) => [...p.whole.matchAll(/<svg[^>]*>/g)].map((m) => m[0]));
    expect(svgs.length).toBeGreaterThan(10);
    const COLOR: Record<string, string> = {
      aether: 'var(--color-gold-300)',
      relic: '#fdba74',
      heal: 'var(--color-heal)',
    };
    for (const svg of svgs) {
      // In rem (0.875 rem: 14 px at 100%, 11 at 80%, 21 at 150%), so the UI scale carries them.
      expect(svg).toContain('class="h-3.5 w-3.5"');
      const tone = /data-reward="(\w+)"/.exec(svg)![1]!;
      if (COLOR[tone]) expect(svg, tone).toContain(`style="color:${COLOR[tone]}"`);
    }
    // Decoration for a screen reader: the stop's label says them.
    for (const p of all) expect(p.whole).toContain('aria-hidden="true"');
  });

  it('a stop within reach is read out as before; one ahead now says its rewards too', async () => {
    const run = playedRun(0);
    const html = await draw(run);
    const options = Run.reachable(run);
    expect(options.length).toBeGreaterThan(0);
    const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/’/g, '’');
    for (const n of options) {
      const said = rewardChips(n.reward)
        .map((c) => c.text)
        .join('. ');
      if (said) expect(html, n.id).toContain(attr(` ${said}.`));
    }
    const locked = ahead(run).find(
      (n) => !options.some((o) => o.id === n.id) && rewardChips(n.reward).length > 0,
    )!;
    const said = rewardChips(locked.reward)
      .map((c) => c.text)
      .join('. ');
    expect(html).toContain(attr(`, not reachable yet. ${said}."`));
    // A stop with nothing to give (a merchant) is read as it was.
    expect(html).toMatch(/aria-label="Merchant, Merchant, not reachable yet"/);
  });
});
