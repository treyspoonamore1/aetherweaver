/**
 * Phase 5d review fixes (presentation): the Finale's label lowercased mid-sentence; a stilled
 * hero's full Solo is not Cue-ready (the sim refuses the Cue); Reignite's "Note 8/8" outlives the
 * barks and revives that land with it; the first-clear card's Dissonance line says what opens it,
 * and counts Skip the unlocks.
 */
import { readFileSync } from 'node:fs';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { ALTO, BASS, CONDUCTOR, SOPRANO, TENOR } from '../src/content/crucibleIds';
import { useSettings } from '../src/app/settings';
import { createSim, type Status } from '../src/sim';
import { evaluateHints } from '../src/ui/hud/hints';
import { finaleCallouts, noteCallout } from '../src/ui/hud/finaleLook';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { finaleSummaryRun } from '../src/ui/lab/mock';
import { fightStarlight } from '../src/ui/screens/starlightModel';
import { movementInSentence, movementLabel } from '../src/ui/screens/routeText';
import { capCallouts, useUi, type Callout, type HudSnapshot } from '../src/ui/store';
import type { RunState } from '../src/meta/types';
import type { SimEvent } from '../src/sim';
import { worldOf } from './sim/helpers';

async function tsx<T>(path: string): Promise<T> {
  return (await import(/* @vite-ignore */ path)) as T;
}
type Props = Record<string, unknown>;
const { CodexView } = await tsx<{ CodexView: FunctionComponent<Props> }>(
  '../src/ui/screens/CodexScreen',
);
const { SummaryView, firstClearLines } = await tsx<{
  SummaryView: FunctionComponent<Props & { run: RunState }>;
  firstClearLines(open: boolean, rank?: number): { title: string; lines: string[] };
}>('../src/ui/screens/SummaryScreen');

describe('the Finale’s label mid-sentence', () => {
  it('the Starlight breakdown and the Codex read “the Finale”', () => {
    expect(movementLabel(4)).toBe('The Finale');
    expect(movementInSentence(4)).toBe('the Finale');
    expect(movementInSentence(2)).toBe('Movement II');
    const pay = fightStarlight({
      kind: 'boss',
      outcome: 'victory',
      starlight: 53,
      wonRun: true,
      movement: 4,
    })!;
    expect(pay.detail).toContain('for the Finale · ×1.5');
    expect(pay.detail).not.toContain('The Finale');
    // Movement II's line is as it was.
    expect(
      fightStarlight({ kind: 'boss', outcome: 'victory', starlight: 30, movement: 2 })!.detail,
    ).toMatch(/for Movement II · ×/);
    const html = renderToStaticMarkup(
      createElement(CodexView, { onBack: () => {}, initialTab: 'enemies', seen: [] }),
    );
    for (const id of [ALTO, BASS, TENOR, SOPRANO, CONDUCTOR])
      expect(html, id).toContain(`data-enemy="${id}"`);
    expect(html).toContain('Met in the Finale.');
    expect(html).not.toContain('Met in The Finale');
  });
});

describe('a stilled hero is not Cue-ready', () => {
  const stillAll = (full: boolean) => {
    const sim = createSim({ seed: 7, encounter: CONDUCTOR });
    for (let i = 0; i < 120; i++) sim.step([]);
    const world = worldOf(sim);
    for (const id of world.party) {
      const e = world.entities.get(id)!;
      e.hero!.solo = full ? 100 : 50;
      (e.health!.statuses as Status[]).push({
        id: 'stilled',
        remaining: 60,
        duration: 60,
        stacks: 1,
        source: null,
      });
    }
    const w = world.entities.get(world.weaverId)!.weaver!;
    w.resonance = 100;
    return { sim, world };
  };
  const fighting = (hud: HudSnapshot): HudSnapshot => ({
    ...hud,
    encounter: { ...hud.encounter, status: 'fighting' },
  });

  it('a full Solo on a stilled frame is not READY, and no hint says to Cue it', async () => {
    const { sim, world } = stillAll(true);
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    for (const h of hud.party) {
      expect(h.stilled).toBe(true);
      expect(h.solo).toBe(100);
      expect(h.soloReady).toBe(false);
    }
    expect(evaluateHints(fighting(hud)).map((x) => x.id)).not.toContain('cue');
    // The frame: no READY, no glowing Cue key.
    const { PartyFrames } = await tsx<{ PartyFrames: FunctionComponent<Props> }>(
      '../src/ui/hud/PartyFrames',
    );
    const frames = renderToStaticMarkup(
      createElement(PartyFrames, { party: hud.party, threadMode: 'mend', barks: [] }),
    );
    expect(frames).not.toContain('READY');
    // The song returns: the same Solos are ready again.
    for (const id of world.party) {
      const list = world.entities.get(id)!.health!.statuses as Status[];
      list.splice(
        list.findIndex((s) => s.id === 'stilled'),
        1,
      );
    }
    const after = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    for (const h of after.party) expect(h.soloReady).toBe(true);
    expect(evaluateHints(fighting(after)).map((x) => x.id)).toContain('cue');
  });

  it('the Empower hint stays quiet in the Grand Silence', () => {
    const { sim } = stillAll(false);
    const hud = fighting(buildHudSnapshot(sim.state, { seed: 7, hovered: null }));
    const healthy: HudSnapshot = {
      ...hud,
      encounter: { ...hud.encounter, elapsed: 200, enemies: 1 },
      weaver: { ...hud.weaver, threadMode: 'mend' },
      party: hud.party.map((h) => ({ ...h, hp: h.maxHp })),
    };
    const boss = healthy.boss!;
    const silent: HudSnapshot = {
      ...healthy,
      boss: { ...boss, silence: { notes: 2, of: 8, sources: [], left: 30, cap: 50 } },
    } as HudSnapshot;
    expect(evaluateHints(healthy).map((x) => x.id)).toContain('empower');
    expect(evaluateHints(silent).map((x) => x.id)).not.toContain('empower');
  });
});

describe('Reignite’s note banner survives its own frame', () => {
  afterEach(() => useUi.getState().resetCombat());

  it('Note 8/8 stays though revives, barks and captions follow it in the same frame', () => {
    const ui = useUi.getState();
    ui.resetCombat();
    const now = 1000;
    const note = noteCallout(8, 8, 'perfect');
    ui.pushCallout(note.callout, now, note.ttl);
    const bark = (speaker: string, text: string) =>
      ui.pushCallout({ kind: 'bark', speaker, text }, now);
    bark('Lyra', 'Back on my feet!');
    const revived = finaleCallouts(
      { type: 'reignited', time: 0, boss: 9, revived: [2] } as unknown as SimEvent,
      () => 'Lyra',
    );
    for (const c of revived) ui.pushCallout(c.callout, now, c.ttl);
    bark('Kael', 'The song!');
    bark('Lyra', 'I hear it.');
    bark('Vexis', 'Finally.');
    // Two captions besides (Settings → Captions).
    ui.pushCallout({ kind: 'system', text: '[the song returns]' }, now);
    ui.pushCallout({ kind: 'system', text: '[leitmotifs in canon]' }, now);
    const live = useUi.getState().callouts;
    expect(live.filter((c) => c.kind === 'note').map((c) => c.text)).toEqual([note.callout.text]);
    // The stack under it still holds only five.
    expect(live.filter((c) => c.kind !== 'note')).toHaveLength(5);
  });

  it('outside the Finale (no note) the cap is as it was; only the newest note is kept over it', () => {
    let id = 0;
    const c = (kind: Callout['kind']): Callout =>
      ({ id: ++id, kind, text: `${kind}${id}`, expiresAt: 1e9 }) as Callout;
    const plain = Array.from({ length: 8 }, () => c('bark'));
    expect(capCallouts(plain)).toEqual(plain.slice(-5));
    const older = c('note');
    const newer = c('note');
    const all = [older, newer, ...Array.from({ length: 6 }, () => c('bark'))];
    const kept = capCallouts(all);
    expect(kept).toContain(newer);
    expect(kept).not.toContain(older);
    expect(kept).toHaveLength(6);
  });
});

describe('the first-clear card’s Dissonance line', () => {
  afterEach(() => useSettings.getState().update((d) => ({ ...d, unlockAll: false })));

  it('says a Finale clear at the Rank opens it, never that reaching the Rank does', () => {
    const open = CONTENT.dissonanceRules.openRank;
    expect(firstClearLines(false, 12).lines[0]).toBe(
      `Dissonance opens with a Finale clear at Weaver Rank ${open} or above`,
    );
    expect(firstClearLines(false, open).lines[0]).toBe(
      `Dissonance opens with a Finale clear at Weaver Rank ${open} or above: you’re Rank ${open}, so your next one does it`,
    );
    expect(firstClearLines(true, 12).lines[0]).toBe('Dissonance is open');
    for (const l of [firstClearLines(false).lines[0]!, firstClearLines(false, 12).lines[0]!])
      expect(l).not.toMatch(/opens at Weaver Rank/);
    const html = renderToStaticMarkup(
      createElement(SummaryView, {
        run: finaleSummaryRun('victory'),
        onNewRun: () => {},
        onLoom: () => {},
        dissonanceOpen: false,
        loom: { starlight: 0, rank: 12 },
        epilogueStill: true,
      }),
    );
    expect(html).toContain(`Dissonance opens with a Finale clear at Weaver Rank ${open} or above`);
  });

  it('Skip the unlocks opens it on the card, as everywhere else', async () => {
    const { useProfile } = await import('../src/app/profileStore');
    expect(useProfile.getState().profile.dissonance.open).toBe(false);
    expect(useProfile.getState().dissonanceOpen()).toBe(false);
    useSettings.getState().update((d) => ({ ...d, unlockAll: true }));
    expect(useProfile.getState().dissonanceOpen()).toBe(true);
    // The screen asks the store (its flag or Skip the unlocks), not the profile's flag alone.
    // (The node test build renders a store's initial state server-side, so this reads the source.)
    const src = readFileSync(
      new URL('../src/ui/screens/SummaryScreen.tsx', import.meta.url),
      'utf8',
    );
    expect(src).toMatch(/const dissonanceOpen = useProfile\(\(s\) => s\.dissonanceOpen\(\)\);/);
    expect(src).not.toMatch(/s\.profile\.dissonance\.open/);
    const card = (open: boolean) =>
      /data-testid="first-clear"[^>]*data-open="(true|false)"/.exec(
        renderToStaticMarkup(
          createElement(SummaryView, {
            run: finaleSummaryRun('victory'),
            onNewRun: () => {},
            onLoom: () => {},
            dissonanceOpen: open,
            epilogueStill: true,
          }),
        ),
      )?.[1];
    expect(card(true)).toBe('true');
    expect(card(false)).toBe('false');
  });
});
