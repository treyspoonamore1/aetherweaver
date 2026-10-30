/**
 * Phase 4e UI: Bonds (docs/phase-4e.md, docs/phase-4e/ui.md). The Bonds screen, Prep's row, the
 * Result's and Summary's Bond XP and rank-up cards, the Respite's scenes, the HUD's Solo and the
 * Codex's page are pure models over content (`CONTENT.talents`, `talentText`, `CONTENT.altSolos`,
 * `altSoloText`, the heroes' own Solos, `CONTENT.scenes`, `CONTENT.bondRules`) and meta
 * (`bondRank`, `bondProgress`, `tierRank`, `soloRank`, `talentChoices`, `altSoloOf`, `rankOpens`,
 * `sceneWaiting`, `sceneXp`); the choices, the scenes and the fight also run through the real
 * stores and a real sim. Every number is checked against the function it comes from, so Bonds
 * can be tuned without leaving the screens behind.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT, altSoloText, heroDef, talentText } from '../src/content';
import {
  altSoloOf,
  bondProgress,
  bondRank,
  bondedHeroes,
  bondsConfig,
  emptyBond,
  rankOpens,
  runBonds,
  sceneWaiting,
  sceneXp,
  soloRank,
  talentChoices,
  tierRank,
  type Bond,
} from '../src/meta/bonds';
import * as Run from '../src/meta/run';
import type { CombatOutcome, EncounterResult } from '../src/meta/types';
import { createSim } from '../src/sim';
import { emptyLedger } from '../src/sim/world';
import { evaluateHints } from '../src/ui/hud/hints';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { BOND_LOOK, heroInk, lighten } from '../src/ui/kit/bondLook';
import { PATHS } from '../src/ui/kit/iconPaths';
import {
  bondXpAt,
  labSetSolo,
  labSetTalent,
  mockBonds,
  mockBondsHud,
  mockHud,
  mockRunBonds,
} from '../src/ui/lab/mock';
import {
  bondCardShows,
  bondGain,
  bondPage,
  bondProgressView,
  bondRankUpTitle,
  bondRankUpView,
  bondRanks,
  bondRulesLines,
  bondXpRows,
  bondsIntroLines,
  bondsOpen,
  fightBondXp,
  heroBondTip,
  nextOpening,
  opensAt,
  prepBondViews,
  rankRows,
  runBondXp,
  sceneChoices,
  sceneRows,
  sceneXpLine,
  soloChoiceView,
  soloView,
  talentAnnounce,
  talentClick,
  tierViews,
} from '../src/ui/screens/bondsModel';
import { toastsBlocked } from '../src/ui/screens/deedsModel';

const R = CONTENT.bondRules;
const HEROES = bondedHeroes();
const TOP = R.ranks.length;
const skipUnlocks = (on: boolean) =>
  useSettings.getState().update((s) => ({ ...s, unlockAll: on }));
const profile = () => useProfile.getState().profile;
const run = () => useRun.getState().run!;
/** A hero's Bond with this much XP and nothing else. */
const withXp = (xp: number): Bond => ({ ...emptyBond(), xp });
/** XP that reaches `rank` exactly. */
const at = (rank: number) => R.ranks[rank - 1]!;

/** WCAG contrast of two colours (#rrggbb). */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** `color-mix(in srgb, a share, b)`, as the cards and chips draw their tints. */
function mix(a: string, share: number, b: string): string {
  const ch = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [ch(a), ch(b)];
  return `#${x
    .map((v, i) => Math.round(v * share + y[i]! * (1 - share)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

const INK_900 = '#0a1022';
const INK_800 = '#111a33';

/** A won skirmish's outcome, with your support of each hero (by slot). */
function outcome(support: number[]): CombatOutcome {
  return {
    encounterId: 'first_light',
    outcome: 'victory',
    duration: 40,
    ledger: emptyLedger(),
    party: CONTENT.defaultParty.map((heroId, slot) => ({
      slot,
      heroId,
      hp: 100,
      maxHp: 100,
      downed: false,
      dead: false,
      damage: 0,
      amplified: 0,
      supported: support[slot] ?? 0,
    })),
    withoutYou: null,
  };
}

/** Every XP worth checking: each rank's edge, just before and a third of the way in. */
function xps(): number[] {
  const out = new Set<number>([0, 1]);
  R.ranks.forEach((xp, i) => {
    out.add(xp);
    if (xp > 0) out.add(xp - 1);
    const next = R.ranks[i + 1];
    if (next !== undefined) out.add(Math.round(xp + (next - xp) / 3));
  });
  out.add(R.ranks.at(-1)! + 500);
  return [...out].sort((a, b) => a - b);
}

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('the Bonds screen’s numbers are the meta’s', () => {
  it('rank, progress and the track at every XP', () => {
    for (const h of HEROES)
      for (const xp of xps()) {
        const page = bondPage(h, withXp(xp), false);
        const p = bondProgress(xp);
        expect(page.progress.rank, `${h} ${xp}`).toBe(bondRank(xp));
        expect(page.progress.into).toBe(p.into);
        expect(page.progress.span).toBe(p.span);
        expect(page.progress.text).toBe(
          p.span === null
            ? `${xp.toLocaleString('en-US')} Bond XP · the highest rank`
            : `${p.into.toLocaleString('en-US')} / ${p.span.toLocaleString('en-US')} Bond XP to rank ${p.rank + 1}`,
        );
        // The track: every rank, reached up to the hero's, each with what it opens.
        expect(page.track.map((s) => s.xp)).toEqual(R.ranks);
        expect(page.track.filter((s) => s.reached).length).toBe(bondRank(xp));
        for (const s of page.track) {
          const o = rankOpens(h, s.rank);
          expect(s.opens.filter((x) => x.kind === 'tier').length).toBe(o.tier === null ? 0 : 1);
          expect(s.opens.some((x) => x.kind === 'solo')).toBe(o.solo);
          expect(s.opens.filter((x) => x.kind === 'scene').map((x) => x.id)).toEqual(
            o.scenes.map((sc) => sc.id),
          );
        }
      }
  });

  it('the next opening is the first rank ahead that opens something', () => {
    for (const h of HEROES)
      for (let rank = 1; rank <= TOP; rank++) {
        const next = nextOpening(h, rank);
        const want = R.ranks.map((_, i) => i + 1).find((r) => r > rank && opensAt(h, r).length > 0);
        expect(next?.rank ?? null, `${h} ${rank}`).toBe(want ?? null);
        const page = bondPage(h, withXp(at(rank)), false);
        expect(page.next === null).toBe(want === undefined);
        if (want) expect(page.next).toContain(`Rank ${want} opens`);
      }
  });

  it('each tier holds content’s two talents, with their texts', () => {
    for (const h of HEROES) {
      const tiers = tierViews(h, withXp(0), false);
      expect(tiers.map((t) => t.rank)).toEqual(R.talentRanks);
      for (const t of tiers) {
        expect(t.rank).toBe(tierRank(t.tier));
        const defs = talentChoices(h, t.tier);
        expect(t.talents.map((x) => x.id)).toEqual(defs.map((d) => d.id));
        expect(t.talents.map((x) => x.text)).toEqual(defs.map((d) => talentText(d)));
        expect(t.talents.map((x) => x.name)).toEqual(defs.map((d) => d.name));
      }
    }
  });
});

describe('locked and open tiers', () => {
  it('a tier opens at its rank; a locked one names it; Skip the unlocks opens them all', () => {
    for (const h of HEROES)
      for (let rank = 1; rank <= TOP; rank++) {
        const bond = withXp(at(rank));
        for (const t of tierViews(h, bond, false)) {
          const open = rank >= tierRank(t.tier);
          expect(t.open, `${h} rank ${rank} tier ${t.tier}`).toBe(open);
          expect(t.reached).toBe(open);
          expect(t.lockLine).toBe(open ? null : `Opens at Bond rank ${tierRank(t.tier)}.`);
          expect(t.note).toBeNull();
        }
        for (const t of tierViews(h, bond, true)) {
          expect(t.open).toBe(true);
          expect(t.lockLine).toBeNull();
          expect(t.note === null).toBe(rank >= tierRank(t.tier));
        }
      }
  });

  it('a click chooses in an open tier, clears the chosen one, and says why a locked one won’t', () => {
    const h = HEROES[0]!;
    const [a, b] = talentChoices(h, 1);
    let tier = tierViews(h, withXp(at(tierRank(1))), false)[0]!;
    expect(talentClick(tier, a!.id)).toEqual({ kind: 'choose', id: a!.id });
    tier = tierViews(h, { ...withXp(at(tierRank(1))), talents: [a!.id, null, null] }, false)[0]!;
    expect(tier.chosen).toBe(a!.id);
    expect(tier.talents.map((t) => t.chosen)).toEqual([true, false]);
    expect(talentClick(tier, a!.id)).toEqual({ kind: 'clear', id: null });
    expect(talentClick(tier, b!.id)).toEqual({ kind: 'choose', id: b!.id });
    const locked = tierViews(h, withXp(0), false)[0]!;
    expect(talentClick(locked, a!.id)).toEqual({
      kind: 'locked',
      reason: `Opens at Bond rank ${tierRank(1)}.`,
    });
    expect(talentAnnounce(h, 1, a!.id)).toBe(`${heroDef(h).name}: ${a!.name}, tier I.`);
    expect(talentAnnounce(h, 1, null)).toBe(`${heroDef(h).name}: no talent in tier I.`);
  });

  it('what the screen asks for is what the profile store keeps, and the run in Prep follows', () => {
    useRun.getState().newRun(7);
    const h = HEROES[1]!;
    const [a] = talentChoices(h, 1);
    // Rank 1: the store refuses a locked tier, as the screen says.
    const locked = tierViews(h, profile().bonds[h] ?? emptyBond(), false)[0]!;
    expect(talentClick(locked, a!.id).kind).toBe('locked');
    useProfile.getState().setTalent(h, 1, a!.id);
    expect(profile().bonds[h]?.talents[0] ?? null).toBeNull();
    // At the tier's rank, it keeps it; the run in Prep plays it; the lab's rules agree.
    useProfile.getState().awardBonds({ [h]: at(tierRank(1)) });
    const open = tierViews(h, profile().bonds[h]!, false)[0]!;
    const click = talentClick(open, a!.id);
    expect(click).toEqual({ kind: 'choose', id: a!.id });
    useProfile.getState().setTalent(h, 1, a!.id);
    expect(profile().bonds[h]!.talents[0]).toBe(a!.id);
    expect(run().bonds.find((b) => b.heroId === h)?.talents).toEqual([a!.id]);
    expect(labSetTalent({ [h]: withXp(0) }, h, 1, a!.id, false)[h]!.talents[0]).toBeNull();
    expect(labSetTalent({ [h]: withXp(at(tierRank(1))) }, h, 1, a!.id, false)[h]!.talents[0]).toBe(
      a!.id,
    );
    // Prep's row shows it, with the hero's rank.
    const row = prepBondViews(
      run().party.map((p) => p.heroId),
      run().bonds,
      profile().bonds,
      false,
    ).find((v) => v.heroId === h)!;
    expect(row.rank).toBe(bondRank(profile().bonds[h]!.xp));
    expect(row.talents.map((t) => t.id)).toEqual([a!.id]);
    expect(row.solo.id).toBe(heroDef(h).solo.id);
    expect(row.empty).toBeNull();
  });
});

describe('the Solo choice', () => {
  it('their own and the alternate, with content’s lines; open at the Solo’s rank', () => {
    for (const h of HEROES) {
      const alt = altSoloOf(h)!;
      for (let rank = 1; rank <= TOP; rank++) {
        const v = soloChoiceView(h, withXp(at(rank)), false)!;
        expect(v.rank).toBe(soloRank());
        expect(v.open).toBe(rank >= soloRank());
        expect(v.lockLine).toBe(rank >= soloRank() ? null : `Opens at Bond rank ${soloRank()}.`);
        expect(soloChoiceView(h, withXp(at(rank)), true)!.open).toBe(true);
      }
      const v = soloChoiceView(h, { ...withXp(at(TOP)), solo: 'alt' }, false)!;
      expect(v.chosen).toBe('alt');
      const [own, other] = v.options;
      expect(own!.solo).toMatchObject({
        id: heroDef(h).solo.id,
        name: heroDef(h).solo.name,
        text: heroDef(h).solo.description,
        cued: heroDef(h).solo.cuedDescription,
        alt: false,
      });
      expect(other!.solo).toMatchObject({
        id: alt.id,
        name: alt.name,
        ...altSoloText(alt),
        alt: true,
      });
      expect(soloView(h, alt.id).cued).toBe(altSoloText(alt).cued);
      // Another hero's alternate isn't theirs: their own.
      const others = HEROES.filter((o) => o !== h).map((o) => altSoloOf(o)!.id);
      for (const id of others) expect(soloView(h, id).id).toBe(heroDef(h).solo.id);
    }
  });

  it('the store and the lab keep the alternate only from its rank (or Skip the unlocks)', () => {
    const h = HEROES[2]!;
    useProfile.getState().setSolo(h, 'alt');
    expect(profile().bonds[h]?.solo ?? 'default').toBe('default');
    expect(labSetSolo({}, h, 'alt', false)[h]?.solo ?? 'default').toBe('default');
    skipUnlocks(true);
    useProfile.getState().setSolo(h, 'alt');
    expect(profile().bonds[h]!.solo).toBe('alt');
    expect(labSetSolo({}, h, 'alt', true)[h]!.solo).toBe('alt');
  });
});

describe('scenes', () => {
  it('seen (with the reply), waiting for a Respite, queued behind it, or locked at its rank', () => {
    for (const h of HEROES) {
      const scenes = CONTENT.scenes.filter((s) => s.hero === h).sort((a, b) => a.rank - b.rank);
      const [first, second] = scenes;
      // Below the first: both locked, naming their ranks.
      let rows = sceneRows(h, withXp(0));
      expect(rows.map((r) => r.state)).toEqual(
        scenes.map((s) => (s.rank <= 1 ? 'waiting' : 'locked')),
      );
      expect(rows[1]!.line).toBe(`Opens at Bond rank ${second!.rank}.`);
      // Both reached, none seen: the first waits (the one a Respite offers), the second queues.
      const both = withXp(at(second!.rank));
      rows = sceneRows(h, both);
      expect(rows.map((r) => r.state)).toEqual(['waiting', 'queued']);
      expect(sceneWaiting(h, both)?.id).toBe(first!.id);
      expect(rows[0]!.xp).toBe(sceneXp(first!));
      expect(rows[0]!.line).toContain(`+${sceneXp(first!)} Bond XP`);
      expect(rows[1]!.line).toContain(first!.title);
      // The first seen with its second reply: the second waits.
      rows = sceneRows(h, { ...both, seen: { [first!.id]: 1 } });
      expect(rows[0]).toMatchObject({
        state: 'seen',
        reply: 1,
        replyText: first!.replies[1]!.text,
      });
      expect(rows[1]!.state).toBe('waiting');
    }
  });

  it('a Respite offers each waiting scene as a choice (keys 4, 5) that pays its Bond XP', () => {
    const [k, l] = HEROES;
    useRun.getState().newRun(7);
    useRun.getState().embark();
    const firstOf = (h: string) =>
      CONTENT.scenes.filter((s) => s.hero === h).sort((a, b) => a.rank - b.rank)[0]!;
    useProfile.getState().awardBonds({ [k!]: at(firstOf(k!).rank), [l!]: at(firstOf(l!).rank) });
    useRun.setState({ run: { ...run(), phase: 'respite' } });
    const waiting = useRun.getState().scenesWaiting();
    expect(waiting.map((s) => s.id)).toEqual([firstOf(k!).id, firstOf(l!).id]);
    const choices = sceneChoices(waiting);
    expect(choices.map((c) => c.key)).toEqual(['4', '5']);
    expect(choices.map((c) => c.xp)).toEqual(waiting.map((s) => sceneXp(s)));
    expect(choices[0]!.title).toBe(`Sit with ${heroDef(k!).name}`);
    expect(choices[0]!.lines).toContain(
      `+${sceneXp(waiting[0]!)} Bond XP with ${heroDef(k!).name}.`,
    );
    expect(choices[0]!.lines).toContain('No healing and no motif.');
    // Choosing it: the scene, then its Bond XP and the map.
    const before = profile().bonds[k!]!.xp;
    useRun.getState().bondScene(choices[0]!.sceneId);
    expect(run().phase).toBe('scene');
    expect(run().scene).toEqual({ heroId: k, sceneId: choices[0]!.sceneId });
    expect(sceneXpLine(waiting[0]!)).toBe(
      `+${sceneXp(waiting[0]!)} Bond XP with ${heroDef(k!).name}`,
    );
    useRun.getState().endScene(0);
    expect(run().phase).toBe('map');
    expect(profile().bonds[k!]!.xp).toBe(before + sceneXp(waiting[0]!));
    expect(profile().bonds[k!]!.seen).toEqual({ [choices[0]!.sceneId]: 0 });
  });

  it('no scene waiting: no fourth choice', () => {
    useRun.getState().newRun(7);
    useRun.getState().embark();
    useRun.setState({ run: { ...run(), phase: 'respite' } });
    expect(sceneChoices(useRun.getState().scenesWaiting())).toEqual([]);
  });
});

describe('Results, the Summary and rank-ups', () => {
  it('a fight’s Bond XP is the result’s, against the Bonds now', () => {
    useRun.getState().newRun(7);
    useRun.getState().embark();
    const node = Run.reachable(run()).find((n) => n.encounterId)!;
    useRun.getState().chooseNode(node.id);
    useRun.getState().finishCombat({ ...outcome([300, 0, 100]), encounterId: node.encounterId! });
    const r = run().lastResult!;
    const rows = bondXpRows(
      run().party.map((p) => p.heroId),
      fightBondXp(r),
      profile().bonds,
    );
    expect(rows.map((x) => x.heroId)).toEqual(HEROES);
    for (const row of rows) {
      expect(row.gained).toBe(r.bondXp[row.heroId]);
      expect(row.rank).toBe(bondRank(profile().bonds[row.heroId]!.xp));
      expect(row.progress).toBe(bondProgressView(profile().bonds[row.heroId]!.xp).text);
    }
    // More support, more Bond XP: the bars show it.
    expect(rows[0]!.gained).toBeGreaterThan(rows[1]!.gained);
    // A result from before Bonds has none.
    expect(bondXpRows(HEROES, fightBondXp({ bondXp: {} } as EncounterResult), {})).toEqual([]);
  });

  it('the run’s total adds up its fights’ and scenes’, and the bar knows a rank-up', () => {
    const results = [
      { bondXp: { kael: 20, lyra: 12 } },
      { bondXp: { kael: 30, vexis: 9 } },
      { bondXp: {} },
    ] as unknown as EncounterResult[];
    expect(runBondXp({ results, scenes: [] })).toEqual({ kael: 50, lyra: 12, vexis: 9 });
    // A scene played at a Respite pays its hero too.
    const scene = CONTENT.scenes.find((s) => s.hero === 'lyra')!;
    expect(runBondXp({ results, scenes: [scene.id] }).lyra).toBe(12 + sceneXp(scene));
    const g = bondGain(at(3) + 10, 30);
    expect(g).toMatchObject({ rank: 3, rankedUp: true, before: 0 });
    expect(g.after).toBeCloseTo(10 / (at(4) - at(3)));
    const same = bondGain(at(3) + 40, 20);
    expect(same.rankedUp).toBe(false);
    expect(same.before).toBeCloseTo(20 / (at(4) - at(3)));
    // At the top, the bar is full; reaching it is a rank-up like any other.
    expect(bondGain(at(TOP) + 50, 10)).toMatchObject({ before: 1, after: 1, rank: TOP });
    expect(bondGain(at(TOP) + 5, 10)).toMatchObject({ before: 0, after: 1, rankedUp: true });
  });

  it('a rank-up card says what the rank opened, from content', () => {
    for (const h of HEROES)
      for (let rank = 2; rank <= TOP; rank++) {
        const v = bondRankUpView({ heroId: h, rank }, withXp(at(rank)));
        const o = rankOpens(h, rank);
        expect(v.name).toBe(heroDef(h).name);
        const kinds = v.opens.map((x) => x.kind);
        expect(kinds.includes('tier')).toBe(o.tier !== null);
        expect(kinds.includes('solo')).toBe(o.solo);
        expect(kinds.filter((x) => x === 'scene').length).toBe(o.scenes.length);
        if (o.tier !== null) {
          const text = v.opens.find((x) => x.kind === 'tier')!.text;
          for (const t of talentChoices(h, o.tier)) expect(text).toContain(t.name);
        }
        if (o.solo) {
          const alt = altSoloOf(h)!;
          const solo = v.opens.find((x) => x.kind === 'solo')!;
          expect(solo.title).toBe(alt.name);
          expect(solo.detail).toBe(`${altSoloText(alt).text} ${altSoloText(alt).cued}`);
        }
        for (const s of o.scenes)
          expect(v.opens.find((x) => x.title === `“${s.title}”`)!.text).toContain(
            `+${sceneXp(s)} Bond XP`,
          );
        if (kinds.length === 1 && kinds[0] === 'none') {
          const next = nextOpening(h, rank);
          expect(v.opens[0]!.text).toContain(next ? `Rank ${next.rank} opens` : 'Nothing new');
        }
      }
    // A later scene waits behind an earlier one not yet seen.
    const h = HEROES[0]!;
    const [first, second] = CONTENT.scenes
      .filter((s) => s.hero === h)
      .sort((a, b) => a.rank - b.rank);
    const behind = bondRankUpView({ heroId: h, rank: second!.rank }, withXp(at(second!.rank)));
    expect(behind.opens.find((x) => x.kind === 'scene')!.text).toContain(`after “${first!.title}”`);
    expect(bondRankUpTitle([{ heroId: h, rank: 3 }])).toContain(heroDef(h).name);
    expect(
      bondRankUpTitle([
        { heroId: h, rank: 3 },
        { heroId: HEROES[1]!, rank: 2 },
      ]),
    ).toBe('Bonds deepen');
  });

  it('the first rank-up introduces Bonds with content’s ranks and names', () => {
    const lines = bondsIntroLines().join(' ');
    for (const h of HEROES) expect(lines).toContain(heroDef(h).name);
    for (const r of R.talentRanks) expect(lines).toContain(String(r));
    expect(lines).toContain(`rank ${R.soloRank}`);
    for (const r of new Set(CONTENT.scenes.map((s) => s.rank))) expect(lines).toContain(String(r));
    expect(lines).toContain('Bonds screen');
  });

  it('the card shows after the Weaver’s, on the Result, the Summary and the map; the toasts wait', () => {
    const at4 = (over: Partial<Parameters<typeof bondCardShows>[0]>) =>
      bondCardShows({ notices: 1, rankUps: 0, screen: 'run', phase: 'result', ...over });
    expect(at4({})).toBe(true);
    expect(at4({ phase: 'summary' })).toBe(true);
    expect(at4({ phase: 'map' })).toBe(true);
    expect(at4({ rankUps: 1 })).toBe(false);
    expect(at4({ notices: 0 })).toBe(false);
    expect(at4({ phase: 'combat' })).toBe(false);
    expect(at4({ screen: 'title' })).toBe(false);
    // The Deed toasts wait while it's up, as for the Weaver's card.
    expect(toastsBlocked({ rankUps: at4({}) ? 1 : 0, screen: 'run', phase: 'result' })).toBe(true);
  });

  it('the store’s rank-ups are the cards’ notices', () => {
    const h = HEROES[0]!;
    useProfile.getState().awardBonds({ [h]: at(3) });
    const notices = useProfile.getState().bondNotices;
    expect(notices).toEqual([
      { heroId: h, rank: 2 },
      { heroId: h, rank: 3 },
    ]);
    const views = notices.map((n) => bondRankUpView(n, profile().bonds[h]));
    expect(views.map((v) => v.opens.map((x) => x.kind))).toEqual([
      rankOpens(h, 2).scenes.length > 0 ? ['scene'] : ['none'],
      rankOpens(h, 3).tier !== null ? ['tier'] : ['none'],
    ]);
  });
});

describe('opening', () => {
  it('Bonds open with a hero’s first rank-up, or Skip the unlocks', () => {
    expect(bondsOpen({}, false)).toBe(false);
    expect(bondsOpen({ [HEROES[0]!]: withXp(at(2) - 1) }, false)).toBe(false);
    expect(bondsOpen({ [HEROES[0]!]: withXp(at(2)) }, false)).toBe(true);
    expect(bondsOpen({}, true)).toBe(true);
    expect(bondRanks({ [HEROES[1]!]: withXp(at(4)) })).toEqual(
      Object.fromEntries(HEROES.map((h) => [h, h === HEROES[1] ? 4 : 1])),
    );
  });

  it('Prep’s row before any tier opens says from which rank', () => {
    const v = prepBondViews(CONTENT.defaultParty, [], {}, false);
    expect(v.map((x) => x.heroId)).toEqual(HEROES);
    for (const x of v) {
      expect(x.rank).toBe(1);
      expect(x.openTiers).toBe(0);
      expect(x.empty).toBe(`Talents from Bond rank ${tierRank(1)}`);
      expect(x.solo.id).toBe(heroDef(x.heroId).solo.id);
    }
    const open = prepBondViews(CONTENT.defaultParty, [], {}, true);
    for (const x of open) expect(x.empty).toBe('No talent chosen');
  });
});

describe('in a fight', () => {
  it('the HUD names each hero’s actual Solo, alternate included, and their talents', () => {
    const bonds = mockBonds(TOP);
    const chosen = mockRunBonds(bonds);
    const config = bondsConfig(chosen);
    const hud = buildHudSnapshot(createSim({ seed: 7, bonds: config }).state, {
      seed: 7,
      hovered: null,
    });
    for (const h of hud.party) {
      const alt = altSoloOf(h.defId)!;
      const lines = altSoloText(alt);
      expect(h.soloId).toBe(alt.id);
      expect(h.soloName).toBe(alt.name);
      expect(h.soloText).toBe(lines.text);
      expect(h.soloCued).toBe(lines.cued);
      expect(h.soloAlt).toBe(true);
      expect(h.talents).toEqual(chosen.find((b) => b.heroId === h.defId)!.talents);
      // The frame's tooltip.
      const tip = heroBondTip(h.defId, h.talents, h.soloId, TOP);
      expect(tip.solo.name).toBe(alt.name);
      expect(tip.talents.map((t) => t.id)).toEqual(h.talents);
      expect(tip.talents.map((t) => t.text)).toEqual(
        h.talents.map((id) => talentText(CONTENT.talents.find((t) => t.id === id)!)),
      );
    }
    // Without Bonds: their own Solos, no talents.
    const plain = buildHudSnapshot(createSim({ seed: 7 }).state, { seed: 7, hovered: null });
    for (const h of plain.party) {
      expect(h.soloName).toBe(heroDef(h.defId).solo.name);
      expect(h.soloAlt).toBe(false);
      expect(h.talents).toEqual([]);
    }
  });

  it('the Cue hint names the alternate Solo', () => {
    const vexis = HEROES[2]!;
    const alt = altSoloOf(vexis)!;
    const base = mockBondsHud('calm', [{ heroId: vexis, talents: [], solo: alt.id }], (h) =>
      h.defId === vexis ? { solo: 100, soloReady: true } : {},
    );
    const hud = { ...base, weaver: { ...base.weaver, resonance: base.weaver.cueCost } };
    const cue = evaluateHints(hud).find((x) => x.id === 'cue');
    expect(cue?.text).toContain(alt.name);
    const own = evaluateHints({
      ...mockHud('calm'),
      weaver: hud.weaver,
      party: mockHud('calm').party.map((h) =>
        h.defId === vexis ? { ...h, solo: 100, soloReady: true } : h,
      ),
    }).find((x) => x.id === 'cue');
    expect(own?.text).toContain(heroDef(vexis).solo.name);
  });
});

describe('the Codex', () => {
  it('Bond XP’s rules and the ranks come from content', () => {
    const lines = bondRulesLines();
    expect(lines.fight).toContain(`earns ${R.base} Bond XP`);
    expect(lines.fight).toContain(`a share of ${R.pool} more`);
    for (const m of Object.values(R.kinds)) expect(lines.weights).toContain(`×${m}`);
    expect(lines.weights).toContain(`${Math.round(R.loss * 100)}%`);
    expect(lines.scene).toContain(`${Math.round(R.scene * 100)}%`);
    const rows = rankRows();
    expect(rows.map((r) => r.xp)).toEqual(R.ranks);
    rows.forEach((r, i) => {
      expect(r.step).toBe(i === 0 ? 0 : R.ranks[i]! - R.ranks[i - 1]!);
      const tier = R.talentRanks.indexOf(r.rank);
      expect(r.opens.some((x) => x.startsWith('Talents'))).toBe(tier >= 0);
      expect(r.opens.includes('The alternate Solo')).toBe(r.rank === R.soloRank);
      const scenes = CONTENT.scenes.filter((s) => s.rank === r.rank);
      if (scenes.length > 0)
        expect(r.opens.find((x) => x.startsWith('A scene'))).toContain(String(sceneXp(scenes[0]!)));
    });
  });
});

describe('looks and the lab', () => {
  it('the Bonds’ rose and every hero’s ink read on the dark panels and their tints', () => {
    for (const ground of [INK_900, INK_800]) {
      expect(contrast(BOND_LOOK.color, ground)).toBeGreaterThanOrEqual(4.5);
      for (const h of HEROES) {
        const ink = heroInk(h);
        expect(contrast(ink, ground), h).toBeGreaterThanOrEqual(4.5);
        // On the chosen card's tint of the hero's colour (16%) and a chip's (12%).
        for (const share of [0.12, 0.16])
          expect(contrast(ink, mix(heroDef(h).color, share, ground)), h).toBeGreaterThanOrEqual(
            4.5,
          );
      }
    }
    for (const share of [0.06, 0.14])
      expect(
        contrast(BOND_LOOK.color, mix(BOND_LOOK.color, share, INK_900)),
      ).toBeGreaterThanOrEqual(4.5);
    expect(lighten('#000000', 0.5)).toBe('#808080');
    expect(PATHS.bond && PATHS.talent && PATHS.scene).toBeTruthy();
  });

  it('the lab’s Bonds sit at their ranks, with what those ranks open', () => {
    for (let rank = 1; rank <= TOP; rank++) {
      const bonds = mockBonds(rank);
      for (const h of HEROES) {
        const b = bonds[h]!;
        expect(bondRank(b.xp), `${h} ${rank}`).toBe(rank);
        expect(b.xp).toBe(bondXpAt(rank, 0.35));
        expect(tierViews(h, b, false).every((t) => (t.chosen !== null) === t.open)).toBe(true);
        expect(b.solo === 'alt').toBe(rank >= soloRank());
      }
      // What a run would play from them is the meta's.
      expect(mockRunBonds(bonds)).toEqual(runBonds(bonds, CONTENT.defaultParty, false));
    }
  });
});
