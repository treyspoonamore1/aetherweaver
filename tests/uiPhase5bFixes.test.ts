/**
 * Phase 5b fixes (docs/phase-5b.md): Brann's catch-up Bond XP in the fight's result (so the Result
 * and the Summary show what he earned, and his rank-up animates), his downs' recap wording on the
 * Result and the Summary, the Codex opened from Prep, the Loom, the Astrolabe and the Reliquary
 * with the profile's roster, the Execution decree and hint following the live heal cut (Blood
 * Oath), the decree's wording latched when it was announced, the Prep picker's key caps as bound,
 * and a locked silhouette per hero-bound motif in the Codex.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT } from '../src/content';
import { awardedBondXp, bondRank, bondXpForFight, CATCH_UP, emptyBond } from '../src/meta/bonds';
import { heroRoster } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import type { CombatOutcome, DeathRecap, RunState } from '../src/meta/types';
import { createSim } from '../src/sim';
import { emptyLedger } from '../src/sim/world';
import { evaluateHints } from '../src/ui/hud/hints';
import { bossDecreeShown, healBarelyTakes, shownDecree } from '../src/ui/hud/legionLook';
import { decreeParty, decreeShownNow } from '../src/ui/hudBridge';
import { brannHud, brannResultRun, BRANN_PARTIES } from '../src/ui/lab/mock';
import { bondXpRows } from '../src/ui/screens/bondsModel';
import { deathAdviceLine, runDownAdvice } from '../src/ui/screens/resultText';
import { focusKeyLabel, pickerCards } from '../src/ui/screens/rosterModel';
import { useUi } from '../src/ui/store';
import { worldOf } from './sim/helpers';

const { A, B } = BRANN_PARTIES;
const R = CONTENT.bondRules;
const at = (rank: number) => R.ranks[rank - 1]!;
const run = () => useRun.getState().run!;
const profile = () => useProfile.getState().profile;
const execution = CONTENT.attacks.find((a) => a.executeBelow !== undefined)!;
const BRANN_WARD = 'Execution — Brann is condemned. Ward him: your healing barely takes on him.';

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
  useUi.setState({ callouts: [], lastDecree: null });
});

/** A .tsx module's export, at run time (the node test build has no JSX to import statically). */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

/** A won fight for this party, each hero with this much of your support. */
function outcome(party: readonly string[], encounterId: string): CombatOutcome {
  return {
    encounterId,
    outcome: 'victory',
    duration: 40,
    ledger: emptyLedger(),
    party: party.map((heroId, slot) => ({
      slot,
      heroId,
      hp: 100,
      maxHp: 100,
      downed: false,
      dead: false,
      damage: 0,
      amplified: 0,
      supported: 10,
    })),
    withoutYou: null,
  };
}

/** Starts a run with this party and fights its first fight; the result as the store keeps it. */
function fightWith(party: readonly string[]): RunState {
  useRun.getState().newRun(81);
  useRun.getState().setParty([...party]);
  useRun.getState().embark();
  useRun.getState().chooseNode(Run.reachable(run())[0]!.id);
  const encounter = useRun.getState().combatConfig()!.encounter!;
  useRun.getState().finishCombat(
    outcome(
      run().party.map((h) => h.heroId),
      encounter,
    ),
  );
  return run();
}

describe('Brann’s catch-up Bond XP is in the fight’s result', () => {
  it('the result holds the doubled figure, judged on the profile’s Bonds before the award', () => {
    useProfile.getState().awardBonds({ kael: at(4), lyra: at(4), vexis: at(4) });
    useProfile.getState().recruit(['brann']);
    useProfile.getState().awardBonds({ brann: 50 });
    expect(profile().bonds.brann!.xp).toBe(100); // doubled: he trails the starters
    const before = profile().bonds.brann!.xp;
    const r = fightWith(A).lastResult!;
    const raw = bondXpForFight(
      outcome(A, r.encounterId),
      CONTENT.encounters.find((e) => e.id === r.encounterId)!.kind,
    );
    expect(raw.brann).toBeGreaterThan(0);
    expect(r.bondXp.brann).toBe(raw.brann! * CATCH_UP);
    // A starter's is as it was.
    expect(r.bondXp.kael).toBe(raw.kael);
    expect(run().results.at(-1)).toBe(r);
    // The profile got exactly what the result says (not doubled twice).
    expect(profile().bonds.brann!.xp).toBe(before + r.bondXp.brann!);
    // The Result's row starts from the true "before": a rank-up is seen as one.
    const row = bondXpRows(['brann'], r.bondXp, profile().bonds)[0]!;
    expect(row.gained).toBe(r.bondXp.brann);
    expect(row.rankedUp).toBe(bondRank(profile().bonds.brann!.xp) > bondRank(before));
  });

  it('the finding’s case: 50 XP, a 40 XP fight doubled to 80, reaches rank 2 and shows it', () => {
    const bonds = { kael: at(4), lyra: at(4), vexis: at(4), brann: 50 };
    const profileBonds = Object.fromEntries(
      Object.entries(bonds).map(([id, xp]) => [id, { ...emptyBond(), xp }]),
    );
    const awarded = awardedBondXp(profileBonds, { brann: 40, kael: 40 });
    expect(awarded).toEqual({ brann: 80, kael: 40 });
    const after = { ...profileBonds, brann: { ...profileBonds.brann!, xp: 50 + 80 } };
    const row = bondXpRows(['brann'], awarded, after)[0]!;
    expect(row.gained).toBe(80);
    expect(row.rankedUp).toBe(bondRank(130) > bondRank(50));
  });

  it('the default party’s result is the fight’s own figure, unchanged', () => {
    useProfile.getState().awardBonds({ kael: 10 });
    const r = fightWith(CONTENT.defaultParty).lastResult!;
    const raw = bondXpForFight(
      outcome(CONTENT.defaultParty, r.encounterId),
      CONTENT.encounters.find((e) => e.id === r.encounterId)!.kind,
    );
    expect(r.bondXp).toEqual(raw);
    expect(profile().bonds.kael!.xp).toBe(10 + raw.kael!);
  });
});

describe('Brann’s downs name their answer on the Result and the Summary', () => {
  const down = (blood: DeathRecap['blood'], killer = 'Legion Spear'): DeathRecap => ({
    time: 31,
    heroId: 'brann',
    killer,
    recap: [{ time: 30.5, amount: 300, source: killer }],
    readyTechniques: [],
    answers: ['mend', 'ward'],
    ...(blood ? { blood } : {}),
  });

  /** A Result with these deaths in its fight. */
  function withDeaths(deaths: DeathRecap[], party: readonly string[] = B): RunState {
    const r0 = brannResultRun(party);
    const r = { ...r0.lastResult!, deaths };
    return { ...r0, lastResult: r, results: [...r0.results.slice(0, -1), r] };
  }

  it('in place of the generic answers when it has one; generic otherwise', () => {
    const refused = down({ refusedRally: true, healCut: 0.5 });
    expect(deathAdviceLine(refused, B)).toMatch(/wouldn’t Rally below 40%/);
    expect(deathAdviceLine(down({ refusedRally: false, healCut: 0.5 }), B)).toBe(
      'Answers: Mend or Ward',
    );
    const kael = { ...down(undefined), heroId: 'kael' };
    expect(deathAdviceLine(kael, CONTENT.defaultParty)).toBe('Answers: Mend or Ward');
  });

  it('the Result shows it for each of his downs', async () => {
    const ResultView = await component<Record<string, unknown>>(
      '../src/ui/screens/ResultScreen',
      'ResultView',
    );
    const r = withDeaths([
      down({ refusedRally: true, healCut: 0.5 }),
      down({ refusedRally: false, healCut: 0.25 }),
    ]);
    const html = renderToStaticMarkup(
      createElement(ResultView, { run: r, result: r.lastResult!, onContinue: () => {} }),
    );
    expect(html).toMatch(/data-testid="death-answer"[^>]*>He wouldn’t Rally below 40%/);
    expect(html).toMatch(/data-testid="death-answer"[^>]*>Your healing on him was quartered/);
    expect(html).not.toContain('Answers: Mend or Ward');
  });

  it('the Summary lists what his downs asked, once each with a count', async () => {
    const r = withDeaths([
      down({ refusedRally: true, healCut: 0.5 }),
      down({ refusedRally: true, healCut: 0.5 }),
      down({ refusedRally: false, healCut: 0.5 }),
    ]);
    expect(runDownAdvice(r.results, 'brann')).toEqual([
      {
        text: expect.stringMatching(/wouldn’t Rally/) as unknown as string,
        count: 2,
      },
    ]);
    expect(runDownAdvice(r.results, 'lyra')).toEqual([]);
    const SummaryView = await component<Record<string, unknown>>(
      '../src/ui/screens/SummaryScreen',
      'SummaryView',
    );
    const summary = { ...r, phase: 'summary', outcome: 'defeat', pending: null } as RunState;
    const html = renderToStaticMarkup(
      createElement(SummaryView, { run: summary, onNewRun: () => {}, onLoom: () => {} }),
    );
    expect(html).toContain('data-testid="down-advice"');
    expect(html).toMatch(/wouldn’t Rally below 40%/);
    expect(html).toContain('×2');
    const plain = brannResultRun(CONTENT.defaultParty);
    const none = renderToStaticMarkup(
      createElement(SummaryView, {
        run: { ...plain, phase: 'summary', outcome: 'defeat', pending: null },
        onNewRun: () => {},
        onLoom: () => {},
      }),
    );
    expect(none).not.toContain('down-advice');
  });
});

describe('every Codex a screen opens has the profile’s roster', () => {
  it('each <CodexView> under src/ui/screens passes roster', () => {
    const dir = join(__dirname, '../src/ui/screens');
    let sites = 0;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/<CodexView\b([\s\S]*?)\/>/g)) {
        sites++;
        expect(m[1], `${f}: <CodexView> without roster`).toMatch(/\broster=\{/);
      }
    }
    // Prep, the Loom, the Astrolabe, the Reliquary, the Bonds and the Codex itself.
    expect(sites).toBeGreaterThanOrEqual(6);
  });

  it('a recruited Brann opens in the Codex’s Heroes page with the roster', async () => {
    const CodexView = await component<Record<string, unknown>>(
      '../src/ui/screens/CodexScreen',
      'CodexView',
    );
    const roster = heroRoster({ recruited: ['brann'] }, false);
    const html = renderToStaticMarkup(
      createElement(CodexView, { onBack: () => {}, initialTab: 'heroes', roster }),
    );
    expect(html).not.toContain('codex-hero-locked');
    expect(html).toContain('Bloodsworn');
  });
});

describe('Execution follows the live heal cut', () => {
  const look = (healCut?: number) => [
    { defId: 'lyra' },
    { defId: 'vexis' },
    { defId: 'brann', execute: 0.4, ...(healCut !== undefined ? { healCut } : {}) },
  ];

  it('with Blood Oath (no cut) the decree and the hint are the generic ones', () => {
    expect(healBarelyTakes(look()[2])).toBe(false);
    expect(shownDecree(execution.decree!, look())).toBe(execution.decree);
    expect(shownDecree(execution.decree!, look(0.5))).toBe(BRANN_WARD);
    expect(shownDecree(execution.decree!, look(0.25))).toBe(BRANN_WARD);
    // A starter with a cut (a Wound, Bloodmoon) keeps the generic text.
    expect(shownDecree(execution.decree!, [{ defId: 'lyra', execute: 0.4, healCut: 0.5 }])).toBe(
      execution.decree,
    );
    const cut = evaluateHints(brannHud('brann-execution')).find((h) => h.id === 'execution')!;
    expect(cut.text).toMatch(/Ward \{Q\} him: your healing barely takes/);
    const hud = brannHud('brann-execution');
    const oath = {
      ...hud,
      party: hud.party.map((h) => (h.defId === 'brann' ? { ...h, healCut: undefined } : h)),
    };
    const hint = evaluateHints(oath).find((h) => h.id === 'execution')!;
    expect(hint.text).toMatch(/lift them above 40% before it lands, or Ward \{Q\} them/);
  });

  it('the bridge reads the condemned hero’s live cut from the sim', () => {
    const sim = createSim({ seed: 7, encounter: 'vharun', party: [...B] });
    const w = worldOf(sim);
    const brann = w.party.map((id) => w.entities.get(id)!).find((e) => e.hero?.defId === 'brann')!;
    expect(decreeParty(sim.state).find((h) => h.defId === 'brann')!.healCut).toBe(0.5);
    // Not condemned: the generic decree.
    expect(decreeShownNow(sim.state, execution.decree!)).toBe(execution.decree);
    w.telegraphs.push({
      ...(w.telegraphs[0] ?? {}),
      id: 9999,
      target: brann.id,
      executeBelow: 0.4,
      effect: 'damage',
      impact: w.time + 4,
    } as (typeof w.telegraphs)[number]);
    expect(decreeShownNow(sim.state, execution.decree!)).toBe(BRANN_WARD);
  });
});

describe('the decree keeps the wording it was announced with', () => {
  it('the boss bar prefers the latched decree over the live rewording', () => {
    const generic = { name: 'Execution', text: execution.decree! };
    const latched = { name: 'Execution', text: BRANN_WARD };
    expect(bossDecreeShown(generic, latched)).toBe(latched);
    expect(bossDecreeShown(null, latched)).toBe(latched);
    expect(bossDecreeShown(generic, null)).toBe(generic);
    const other = { name: 'Twin Cleave', text: 'x' };
    expect(bossDecreeShown(other, latched)).toBe(other);
  });

  it('a latched decree stays in the store, and the banner and the bar show it', async () => {
    useUi
      .getState()
      .pushCallout({ kind: 'decree', text: 'Execution', detail: BRANN_WARD }, 0, 5200);
    expect(useUi.getState().lastDecree).toEqual({ name: 'Execution', text: BRANN_WARD });
    const BossBar = await component<Record<string, unknown>>('../src/ui/hud/BossBar', 'BossBar');
    const hud = brannHud('brann-execution');
    // After Execution resolved: the bridge's live decree reverted to the generic text.
    const boss = { ...hud.boss!, decree: { name: 'Execution', text: execution.decree! } };
    const html = renderToStaticMarkup(
      createElement(BossBar, { boss, decree: useUi.getState().lastDecree }),
    );
    expect(html).toContain('Brann is condemned. Ward him');
    expect(html).not.toContain('the weakest hero is condemned');
    const Callouts = await component<Record<string, unknown>>('../src/ui/hud/Callouts', 'Callouts');
    // The banner, with Brann no longer condemned in the live party.
    const banner = renderToStaticMarkup(
      createElement(Callouts, {
        callouts: useUi.getState().callouts,
        barkSpeakers: [],
        party: B.map((defId) => ({ defId })),
      }),
    );
    expect(banner).toContain('Brann is condemned. Ward him');
  });

  it('the runtime latches the decree from the sim at the moment it is announced', () => {
    const src = readFileSync(join(__dirname, '../src/app/runtime.ts'), 'utf8');
    expect(src).toMatch(/detail: decreeShownNow\(state, event\.text\)/);
  });
});

describe('the Prep picker’s key caps follow the bindings', () => {
  it('its key cap is the frame’s bindingLabel(focusN)', () => {
    expect(focusKeyLabel(1)).toBe('1');
    const cards = pickerCards(heroRoster({ recruited: ['brann'] }, false), B);
    expect(cards.map((c) => c.keyLabel)).toEqual([null, '1', '2', '3']);
    useSettings.getState().update((s) => ({
      ...s,
      bindings: { focus1: ['KeyZ'], focus2: ['KeyX'], focus3: ['KeyV'] },
    }));
    const rebound = pickerCards(heroRoster({ recruited: ['brann'] }, false), B);
    expect(rebound.map((c) => c.keyLabel)).toEqual([null, 'Z', 'X', 'V']);
    // The number stays the slot.
    expect(rebound.map((c) => c.key)).toEqual([null, 1, 2, 3]);
  });
});

describe('the Codex’s Motifs page: a silhouette per motif that waits for a hero', () => {
  it('one locked card per hero-bound motif, with a neutral name and both routes', async () => {
    const CodexView = await component<Record<string, unknown>>(
      '../src/ui/screens/CodexScreen',
      'CodexView',
    );
    const html = renderToStaticMarkup(
      createElement(CodexView, {
        onBack: () => {},
        initialTab: 'motifs',
        roster: CONTENT.defaultParty,
      }),
    );
    const bound = CONTENT.motifs.filter((m) => m.requires.hero === 'brann');
    expect(bound.length).toBeGreaterThan(0);
    expect(html.match(/data-testid="codex-motif-locked"/g)?.length).toBe(bound.length);
    expect(html).toContain('A motif not yet heard');
    expect(html).toContain('or face Vharun');
    for (const m of bound) expect(html).not.toContain(m.name);
    expect(html).not.toMatch(/Brann|Bloodsworn/);
    const open = renderToStaticMarkup(
      createElement(CodexView, {
        onBack: () => {},
        initialTab: 'motifs',
        roster: heroRoster({ recruited: ['brann'] }, false),
      }),
    );
    expect(open).not.toContain('codex-motif-locked');
    for (const m of bound) expect(open).toContain(m.name);
  });
});
