/**
 * Phase 5e review fixes, presentation (docs/phase-5e.md): the Codex's Events page hides a
 * Rank-gated recruiting choice below its Rank (as the event screen does); "Unlocked this run"
 * reads in Rank order; a recruit unlock whose hero already joined is no "New" how-to; Oro's third
 * Sapling is mourned by its own name (one name list for barks, HUD and render); Seren's
 * overextended recap answers Anchor and Swap with Rally (as the HUD does); her duel chip's title
 * names a boss quarry with one article; and her chip and the Loom's Bonds badge stay inside their
 * boxes with a long name or a six-hero roster.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useSettings } from '../src/app/settings';
import { CONTENT, SAPLING_NAMES, heroDef } from '../src/content';
import {
  RANK_XP,
  UNLOCKS,
  allowanceFor,
  rankOf,
  unlockAsRecruited,
  unlocksBetween,
} from '../src/meta/profile';
import * as Run from '../src/meta/run';
import type { DeathRecap, EncounterResult } from '../src/meta/types';
import { SAPLING_NAMES as RENDER_NAMES } from '../src/render/groveCues';
import { duelChips, quarryInSentence } from '../src/ui/hud/duelLook';
import { SAPLING_NAMES as HUD_NAMES, saplingName } from '../src/ui/hud/groveLook';
import { serenHud } from '../src/ui/lab/mock';
import { freshUnlocks } from '../src/ui/screens/chordModel';
import { recruitedRankUps, runRank } from '../src/ui/screens/rankText';
import { deathAdviceLine, runDownAdvice } from '../src/ui/screens/resultText';
import type { HeroHud } from '../src/ui/store';

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
});

/** A .tsx module's export, at run time (the node test build has no JSX to import statically). */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

describe('the Codex Events page shows a Rank-gated choice only from its Rank', () => {
  const DEBT = 'Pay a stranger’s debt';
  const FOLLOW = 'Follow the thread';
  async function events(rank: number): Promise<string> {
    const CodexView = await component<Record<string, unknown>>(
      '../src/ui/screens/CodexScreen',
      'CodexView',
    );
    return renderToStaticMarkup(
      createElement(CodexView, {
        onBack: () => {},
        initialTab: 'events',
        allowance: allowanceFor(rank),
        rank,
        roster: CONTENT.defaultParty,
      }),
    );
  }

  it('hidden below Rank 8 and 12 (never shown locked), shown from them', async () => {
    const low = await events(2);
    // Every Movement's events are open (no `seen`), so the altar and the thread are listed.
    expect(low).toContain('data-event="tithe_altar"');
    expect(low).toContain('data-event="loose_thread"');
    expect(low).not.toContain(DEBT);
    expect(low).not.toContain(FOLLOW);
    expect(low).not.toMatch(/\b(she|he) joins your heroes/);
    expect(await events(12)).toMatch(/she joins your heroes/);
    const eight = await events(8);
    expect(eight).toContain(DEBT);
    expect(eight).not.toContain(FOLLOW);
    const twelve = await events(12);
    expect(twelve).toContain(DEBT);
    expect(twelve).toContain(FOLLOW);
  });

  it('the Codex lists exactly the choices the event screen offers', async () => {
    for (const rank of [2, 8, 12]) {
      const html = await events(rank);
      const allowance = allowanceFor(rank);
      for (const ev of CONTENT.events)
        for (const c of ev.choices) {
          if (c.rank === undefined) continue;
          expect(html.includes(`>${c.label}<`), `${ev.id}/${c.id} at Rank ${rank}`).toBe(
            Run.eventChoiceShown(c, allowance),
          );
        }
    }
  });
});

describe('“Unlocked this run” reads in Rank order', () => {
  it('Rank 7 to 12: Seren at Rank 8 before the Rank 9 and 10 unlocks', () => {
    const got = unlocksBetween(RANK_XP[6]!, RANK_XP[11]!).map((u) => `${u.rank}:${u.id}`);
    expect(rankOf(RANK_XP[6]!)).toBe(7);
    expect(rankOf(RANK_XP[11]!)).toBe(12);
    expect(got).toEqual([
      '8:calling.martyr',
      '8:recruit.seren',
      '9:calling.chronomancer',
      '10:reliquary',
      '12:calling.conductor',
      '12:recruit.oro',
    ]);
  });

  it('every span is sorted by Rank and keeps each Rank’s schedule order', () => {
    for (let a = 0; a < RANK_XP.length; a++)
      for (let b = a; b < RANK_XP.length; b++) {
        const got = unlocksBetween(RANK_XP[a]!, RANK_XP[b]!);
        const ranks = got.map((u) => u.rank);
        expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
        for (const r of new Set(ranks))
          expect(got.filter((u) => u.rank === r)).toEqual(UNLOCKS.filter((u) => u.rank === r));
      }
  });

  it('runRank lists them in Rank order too', () => {
    const r = runRank({ xp: RANK_XP[8]! - RANK_XP[6]! }, RANK_XP[8]!);
    expect(r.unlocks.map((u) => u.rank)).toEqual([8, 8, 9]);
  });
});

describe('a recruit unlock after the hero joined', () => {
  const seren = UNLOCKS.find((u) => u.id === 'recruit.seren')!;

  it('is no “New” how-to once she is recruited', () => {
    const xp = RANK_XP[7]!;
    expect(rankOf(xp)).toBe(8);
    expect(freshUnlocks(xp, []).map((u) => u.id)).toContain('recruit.seren');
    expect(freshUnlocks(xp, [], ['seren']).map((u) => u.id)).not.toContain('recruit.seren');
    // Everything else is as before.
    expect(freshUnlocks(xp, [], ['seren'])).toEqual(
      freshUnlocks(xp, []).filter((u) => u.id !== 'recruit.seren'),
    );
    expect(freshUnlocks(xp, [], ['brann'])).toEqual(freshUnlocks(xp, []));
  });

  it('reads as joined on the rank-up card and the Summary, not how to earn her', () => {
    expect(seren.text).toMatch(/Pay her debt/);
    expect(unlockAsRecruited(seren, undefined)).toBe(seren);
    expect(unlockAsRecruited(seren, ['brann'])).toBe(seren);
    const joined = unlockAsRecruited(seren, ['brann', 'seren']);
    expect(joined.id).toBe('recruit.seren');
    expect(joined.text).toBe(
      'Seren has joined your heroes. Choose your three under Your party in Prep.',
    );
    for (const u of UNLOCKS.filter((x) => x.kind !== 'recruit'))
      expect(unlockAsRecruited(u, ['seren', 'oro'])).toBe(u);
    const r = runRank({ xp: RANK_XP[7]! - RANK_XP[6]! }, RANK_XP[7]!, ['seren']);
    const chip = r.unlocks.find((u) => u.id === 'recruit.seren')!;
    expect(chip.text).toMatch(/has joined your heroes/);
    expect(runRank({ xp: RANK_XP[7]! - RANK_XP[6]! }, RANK_XP[7]!).unlocks).toContainEqual(seren);
  });

  it('the rank-up card reads the profile’s recruits (recorded before the fight recruits her)', () => {
    const pending = [{ rank: 8, unlocks: unlocksBetween(RANK_XP[6]!, RANK_XP[7]!) }];
    const text = (recruited?: string[]) =>
      recruitedRankUps(pending, recruited)[0]!.unlocks.find((u) => u.id === 'recruit.seren')!.text;
    expect(text()).toBe(seren.text);
    expect(text(['brann'])).toBe(seren.text);
    expect(text(['seren'])).toMatch(/^Seren has joined your heroes\./);
    const martyr = (rs: typeof pending) => rs[0]!.unlocks.find((u) => u.id === 'calling.martyr');
    expect(martyr(recruitedRankUps(pending, ['seren']))).toBe(martyr(pending));
  });
});

describe('Oro’s Saplings: one list of names', () => {
  it('his barks, his frame and render name the same three', () => {
    expect(SAPLING_NAMES).toEqual(['Moss', 'Fern', 'Sorrel']);
    expect(HUD_NAMES).toBe(SAPLING_NAMES);
    expect(RENDER_NAMES).toBe(SAPLING_NAMES);
    const lines = heroDef('oro').barks.saplingFelled!;
    // The two he had keep their words; the third (Seedling Swarm's) is mourned by its own name.
    expect(lines).toEqual(['No — not Moss!', 'No — not Fern!', 'No — not Sorrel!']);
    const swarm = CONTENT.talents.find((t) => t.id === 'seedling_swarm');
    const most = Math.max(heroDef('oro').summons!.sapling.count, swarm!.values.count!);
    expect(lines.length).toBeGreaterThanOrEqual(most);
    for (let i = 0; i < lines.length; i++) expect(lines[i]).toContain(saplingName(i));
  });
});

describe('Seren overextended: the recap’s answer follows the Reel variant', () => {
  const down = {
    heroId: 'seren',
    killer: 'Gorehound',
    duel: { warded: false, parryable: false, overextended: true, far: false },
  } satisfies Pick<DeathRecap, 'heroId' | 'killer' | 'duel'>;
  const P = ['kael', 'vexis', 'seren'];
  const REEL = 'Reel or Rally her out of the pack, or Cue Thousand Cuts.';
  const RALLY = 'Rally her out of the pack, or Cue Thousand Cuts.';

  it('the plain Reel (and an unknown variant) still Reels; Anchor and Swap Rally', () => {
    expect(Run.downAdvice(down, P)).toBe(REEL);
    expect(Run.downAdvice(down, P, null, null)).toBe(REEL);
    expect(Run.downAdvice(down, P, 'martyr', null)).toBe(REEL);
    expect(Run.downAdvice(down, P, null, 'anchor')).toBe(RALLY);
    expect(Run.downAdvice(down, P, 'luminary', 'swap')).toBe(RALLY);
    // The Chronomancer's line stands whatever the slot (Rewind is in Reel's place).
    expect(Run.downAdvice(down, P, 'chronomancer', 'anchor')).toBe(
      'Rally her, or Rewind as the pack closes.',
    );
    // Her other downs, and every other hero's, ignore the variant.
    expect(
      Run.downAdvice(
        { ...down, duel: { ...down.duel, overextended: false, far: true } },
        P,
        null,
        'anchor',
      ),
    ).toBe('Reel or Ward the beam on her.');
    expect(Run.downAdvice({ heroId: 'lyra', killer: 'Bell Brute' }, P, null, 'swap')).toBeNull();
  });

  it('the Result and Summary lines pass the run’s variant through', () => {
    const d = { ...down, answers: [] } as unknown as DeathRecap;
    expect(deathAdviceLine(d, P, null, 'anchor')).toBe(RALLY);
    expect(deathAdviceLine(d, P, null)).toBe(REEL);
    const results = [{ deaths: [d], heroes: P.map((heroId) => ({ heroId })) }] as unknown as Pick<
      EncounterResult,
      'deaths' | 'heroes'
    >[];
    expect(runDownAdvice(results, 'seren', null, 'swap')).toEqual([{ text: RALLY, count: 1 }]);
    expect(runDownAdvice(results, 'seren', null)).toEqual([{ text: REEL, count: 1 }]);
  });
});

/** Seren duelling `quarryName`. */
function duelling(quarryName: string): HeroHud {
  const h = serenHud('seren-duel').party.find((x) => x.defId === 'seren')!;
  return { ...h, duel: { ...h.duel!, quarryName } };
}
const KEYS = { reel: 'F', rally: 'C', rallyHome: false };

describe('her duel chip names its quarry with one article', () => {
  it('a boss named “The …”, a boss with an epithet, and a common foe', () => {
    expect(quarryInSentence('The Bellwarden')).toBe('the Bellwarden');
    expect(quarryInSentence('Vharun, the Crimson Warden')).toBe('Vharun, the Crimson Warden');
    expect(quarryInSentence('Bell Brute')).toBe('the Bell Brute');
    const title = (name: string) => duelChips(duelling(name), KEYS).find((c) => c.id === 'duel')!;
    for (const boss of CONTENT.enemies.filter((e) => e.role === 'boss' || e.role === 'miniboss')) {
      const c = title(boss.name);
      expect(c.title, boss.id).not.toMatch(/\bthe The\b/);
      expect(c.label).toBe(`Duelling ${boss.name}`);
    }
    expect(title('The Silent Conductor').title).toMatch(
      /^Showboat: Seren duels the Silent Conductor,/,
    );
    expect(title('Vharun, the Crimson Warden').title).toMatch(
      /^Showboat: Seren duels Vharun, the Crimson Warden,/,
    );
    expect(title('Bell Brute').title).toMatch(/^Showboat: Seren duels the Bell Brute,/);
  });
});

describe('long chips and badges stay inside their boxes', () => {
  it('her duel chip can shrink: its label truncates inside the frame’s column', async () => {
    const PartyFrames = await component<Record<string, unknown>>(
      '../src/ui/hud/PartyFrames',
      'PartyFrames',
    );
    const hud = serenHud('seren-duel');
    const party = hud.party.map((h) =>
      h.defId === 'seren' ? duelling('Vharun, the Crimson Warden') : h,
    );
    const html = renderToStaticMarkup(
      createElement(PartyFrames, { party, threadMode: hud.weaver.threadMode, barks: [] }),
    );
    const at = html.indexOf('data-testid="duel-duel"');
    expect(at).toBeGreaterThan(-1);
    const open = html.slice(html.lastIndexOf('<span', at), at);
    expect(open).toMatch(/\bmax-w-full\b/);
    const chip = html.slice(at, html.indexOf('</span></span>', at));
    expect(chip).toContain('<span class="min-w-0 truncate">Duelling Vharun, the Crimson Warden');
    expect(chip).toMatch(/class="shrink-0"/);
  });

  it('the Loom’s Bonds badge wraps a six-hero roster, each hero whole', async () => {
    const StationBadge = await component<Record<string, unknown>>(
      '../src/ui/screens/LoomParts',
      'StationBadge',
    );
    const six = ['kael', 'lyra', 'vexis', 'brann', 'seren', 'oro'];
    const html = renderToStaticMarkup(
      createElement(StationBadge, {
        view: { id: 'bonds', name: 'Bonds', open: true, fresh: false, line: '', badge: 'x' },
        reliquary: { shards: 0, tears: 0 },
        bonds: {},
        heroes: six,
      }),
    );
    const outer = html.slice(0, html.indexOf('>'));
    expect(outer).toContain('data-testid="station-badge"');
    expect(outer).toMatch(/\bflex-wrap\b/);
    expect(outer).toMatch(/\bmax-w-full\b/);
    expect(outer).not.toMatch(/whitespace-nowrap/);
    for (const id of six) expect(html).toContain(`>${heroDef(id).name}<`);
    expect(html.match(/class="flex items-center gap-1 whitespace-nowrap"/g)).toHaveLength(6);
  });
});
