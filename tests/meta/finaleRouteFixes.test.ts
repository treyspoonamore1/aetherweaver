/**
 * Phase 5d W3 review fixes: the Finale route's road reaches the screens that read it (Prep's
 * Calling copy, the map's Movement card), `tierPlace` reads a bare `{ map }`'s route off the map,
 * the Finale's card names its boss mid-sentence, and the Dissonance gate's copy says "Finale
 * clear" everywhere (docs/phase-5d.md, "Your answers", question 3).
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { EVERYTHING, EXPEDITION_MOVEMENTS, UNLOCKS } from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import type { RunState } from '../../src/meta/types';
import type { Allowance } from '../../src/meta/profile';
import {
  pathSteps,
  tierWhen,
  tierWhenList,
  type TierPlace,
} from '../../src/ui/screens/callingText';
import { dissonanceUnlockLine } from '../../src/ui/screens/dissonanceModel';
import { movementCard } from '../../src/ui/screens/routeText';

const FINALE_TIERS =
  'after First Light, your fight at step 3, the Bellwarden, and the Hollow Cantor';
const PRELUDE_TIERS = 'after First Light, your fights at steps 4 and 6, and the Bellwarden';

/** A .tsx module's export, at run time (the node test build has no JSX to import statically). */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}
type PickerProps = {
  chosen: string | null;
  allowance: Allowance;
  fresh: ReadonlySet<string>;
  onChoose(id: string | null): void;
  at?: { movements?: number };
  openPath?: string | null;
};
type MapProps = { run: RunState; onChoose(id: string): void; card?: boolean };
type CodexProps = { open: boolean; rank: number };

/** HTML to plain text, entities and tags gone, whitespace collapsed. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,:;])/g, '$1');
}

describe('tierPlace reads a map’s route', () => {
  it('a bare { map } reads its route off the map, as the map itself does', () => {
    for (const seed of [1, 7, 23]) {
      const finale = Run.generateMap(seed, 4);
      expect(tierWhenList(4, { map: finale })).toBe(tierWhenList(4, finale));
      expect(tierWhenList(4, { map: finale })).toBe(FINALE_TIERS);
      expect(tierWhen(3, { map: finale })).toBe('after the Hollow Cantor');
      // A saved I-III map keeps CALLING_ROWS, with or without the wrapper.
      const three = Run.generateMap(seed, 3);
      expect(tierWhenList(4, { map: three })).toBe(tierWhenList(4, three));
      expect(tierWhen(3, { map: three })).toBe('after the Bellwarden');
    }
    // A route given beside the map still wins, and no argument is the Prelude's, as before.
    expect(tierWhenList(4, { map: Run.generateMap(7, 4), movements: 4 })).toBe(FINALE_TIERS);
    expect(tierWhenList(4)).toBe(PRELUDE_TIERS);
  });
});

describe('Prep’s Calling copy follows the road', () => {
  const picker = async (at?: { movements?: number }) =>
    text(
      renderToStaticMarkup(
        createElement(
          await component<PickerProps>('../../src/ui/screens/CallingPicker', 'CallingPicker'),
          {
            chosen: null,
            allowance: EVERYTHING,
            fresh: new Set<string>(),
            onChoose: () => {},
            ...(at ? { at } : {}),
          },
        ),
      ),
    );

  it('the Finale route’s Prep gives its tiers; the Prelude’s and I-III’s keep theirs', async () => {
    const tiers = CONTENT.callings[0]!.tiers.length;
    expect(tiers).toBe(4);
    expect(await picker({ movements: EXPEDITION_MOVEMENTS })).toContain(
      `${tiers} picks, one of two each, ${FINALE_TIERS}.`,
    );
    for (const at of [undefined, { movements: 1 }, { movements: undefined }, { movements: 3 }])
      expect(await picker(at)).toContain(`${tiers} picks, one of two each, ${PRELUDE_TIERS}.`);
  });
});

describe('Prep’s Calling path dialog follows the road (review fix)', () => {
  const FINALE_WHEN = [
    'after First Light',
    'after your fight at step 3',
    'after the Bellwarden',
    'after the Hollow Cantor',
  ];
  const PRELUDE_WHEN = [
    'after First Light',
    'after your fight at step 4',
    'after your fight at step 6',
    'after the Bellwarden',
  ];
  const blank = (id: string) => ({ id, path: [null, null, null, null] });

  it('pathSteps takes the route as it takes a map', () => {
    for (const def of CONTENT.callings) {
      const when = (map?: TierPlace) => pathSteps(blank(def.id), { map }).map((s) => s.when);
      expect(when({ movements: EXPEDITION_MOVEMENTS })).toEqual(FINALE_WHEN);
      expect(when(Run.generateMap(5, EXPEDITION_MOVEMENTS))).toEqual(FINALE_WHEN);
      for (const at of [undefined, { movements: 1 }, { movements: 3 }])
        expect(when(at)).toEqual(PRELUDE_WHEN);
    }
  });

  const dialog = async (at?: { movements?: number }) =>
    text(
      renderToStaticMarkup(
        createElement(
          await component<PickerProps>('../../src/ui/screens/CallingPicker', 'CallingPicker'),
          {
            chosen: null,
            allowance: EVERYTHING,
            fresh: new Set<string>(),
            onChoose: () => {},
            openPath: CONTENT.callings[0]!.id,
            ...(at ? { at } : {}),
          },
        ),
      ),
    );
  const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  it('the dialog beside the Finale route’s cards gives the same tiers as the cards', async () => {
    const html = await dialog({ movements: EXPEDITION_MOVEMENTS });
    expect(html).toContain(`picks, one of two each, ${FINALE_TIERS}.`);
    for (const [i, w] of FINALE_WHEN.entries())
      expect(html).toContain(`Tier ${['I', 'II', 'III', 'IV'][i]} ${label(w)}`);
    expect(html).not.toContain('After your fight at step 4');
    expect(html).not.toContain('After your fight at step 6');
  });

  it('the Prelude’s and I-III’s dialog keeps its tiers', async () => {
    for (const at of [undefined, { movements: 1 }, { movements: 3 }]) {
      const html = await dialog(at);
      for (const [i, w] of PRELUDE_WHEN.entries())
        expect(html).toContain(`Tier ${['I', 'II', 'III', 'IV'][i]} ${label(w)}`);
    }
  });
});

describe('the map’s Movement card follows the road', () => {
  /** An Expedition on `movements`' route, Movement I walked: Movement II's first row is next. */
  function intoMovementII(movements: number): RunState {
    const run = Run.newRun(11, undefined, [], [], [], [], undefined, movements);
    const rows = run.map.rows;
    const last = rows.findLast((r) => (r[0]?.movement ?? 1) === 1)!;
    return { ...run, phase: 'map', path: [last[0]!.id], pending: null };
  }
  const card = async (run: RunState) => {
    const MapView = await component<MapProps>('../../src/ui/screens/MapScreen', 'MapView');
    return text(
      renderToStaticMarkup(createElement(MapView, { run, onChoose: () => {}, card: true })),
    );
  };

  it('Movement II’s card counts the stops its route plays', async () => {
    expect(await card(intoMovementII(4))).toContain(
      'The Crimson Ascent: 6 stops to Vharun, the Crimson Warden.',
    );
    expect(await card(intoMovementII(3))).toContain(
      'The Crimson Ascent: 7 stops to Vharun, the Crimson Warden.',
    );
  });

  it('the Finale’s card names the Conductor mid-sentence; the numbered cards keep theirs', () => {
    expect(movementCard(4).text).toBe('The Celestial Crucible: 1 stop to the Silent Conductor.');
    expect(movementCard(4, 4).text).toBe(movementCard(4).text);
    expect(movementCard(3).text).toBe('The Unravelling Descent: 6 stops to The Unweaver.');
  });
});

describe('the Dissonance gate’s copy says the Finale clear opens it', () => {
  const rank = CONTENT.dissonanceRules.openRank;

  it('the rank-up card’s line', () => {
    const line = dissonanceUnlockLine(UNLOCKS.find((u) => u.kind === 'dissonance')!)!;
    expect(line).toContain(`Once your Finale clear at Rank ${rank} or above opens it`);
    expect(line).not.toMatch(/your win/);
  });

  it('the Codex page, closed and open', async () => {
    const DissonanceCodexPage = await component<CodexProps>(
      '../../src/ui/screens/DissonanceCodex',
      'DissonanceCodexPage',
    );
    const closed = text(
      renderToStaticMarkup(createElement(DissonanceCodexPage, { open: false, rank: 1 })),
    );
    expect(closed).toContain(`A Finale clear at Rank ${rank}`);
    expect(closed).not.toMatch(/A win at Rank/);
    const open = text(
      renderToStaticMarkup(createElement(DissonanceCodexPage, { open: true, rank })),
    );
    expect(open).toContain(`Your first Finale clear at Weaver Rank ${rank} or above opens it`);
    expect(open).not.toMatch(/first win at Weaver Rank/);
  });
});
