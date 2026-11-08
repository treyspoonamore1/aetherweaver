/**
 * Phase 5b, the roster and Brann on screen (docs/phase-5b.md "UI"): Prep's picker and its key
 * numbers, the missing-starter notes, his frame (blood keys only for him, no hurt tier, the raging
 * band, critical below 15% or falling fast), the decree rewrites (no dome; Execution on Brann),
 * the dome glyph, his hints, the Call prompt that names him, the Codex's two-route lock, the Bonds
 * tabs, the Harmony hint, the Cell's texts by roster and party, the Result's recruit and Blood
 * Rage lines, In the Red's sight, and the default party's HUD as it was.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT, partyHasDome, runEventDef } from '../src/content';
import { heroRoster } from '../src/meta/profile';
import { createSim, newBlood } from '../src/sim';
import {
  bloodChips,
  bloodTicks,
  callNamed,
  frameRaging,
  rageLabel,
  ragingBand,
} from '../src/ui/hud/bloodLook';
import { frameLevel, frameState } from '../src/ui/hud/healthModel';
import { evaluateHints } from '../src/ui/hud/hints';
import { shownAnswers, shownDecree, shownDecreeOf } from '../src/ui/hud/legionLook';
import {
  ALLY_KEY,
  allyDef,
  allyOf,
  newAllies,
  noteAllies,
  sightingDef,
} from '../src/ui/hud/sighting';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import {
  BRANN_PARTIES,
  brannCallouts,
  brannHud,
  brannResultRun,
  cellRun,
  mockBondsHud,
  mockHud,
  mockRunBonds,
  mockBonds,
} from '../src/ui/lab/mock';
import { heroTabColumns } from '../src/ui/screens/bondsModel';
import { deedsTally, deedsView } from '../src/ui/screens/deedsModel';
import { choiceInfo } from '../src/ui/screens/interlude';
import { prepParty } from '../src/ui/screens/prepParty';
import {
  bloodLine,
  canonical,
  choiceText,
  freshHeroes,
  harmonyHint,
  isHarmony,
  lockedHeroText,
  lockedHeroes,
  missingStarterNotes,
  needsRow,
  passiveRow,
  pickLegal,
  pickProblem,
  pickerCards,
  recruitLine,
  runBlood,
  togglePick,
} from '../src/ui/screens/rosterModel';
import type { HeroHud, HudSnapshot } from '../src/ui/store';
import { useUi } from '../src/ui/store';
import { worldOf } from './sim/helpers';
import { heroDef } from '../src/content';
import type { EventChoice } from '../src/content/schema';
import { EVERYTHING } from '../src/meta/profile';

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
  useUi.setState({ callouts: [] });
});

const ALL = heroRoster({ recruited: ['brann'] }, false);
const { A, B, C } = BRANN_PARTIES;

/** A .tsx module's export, at run time (the node test build has no JSX to import statically). */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

async function drawFrames(party: HeroHud[]): Promise<string> {
  const PartyFrames = await component<{ party: HeroHud[]; threadMode: 'mend'; barks: [] }>(
    '../src/ui/hud/PartyFrames',
    'PartyFrames',
  );
  return renderToStaticMarkup(createElement(PartyFrames, { party, threadMode: 'mend', barks: [] }));
}

/** A fight with this party, its HUD as the bridge builds it. */
function hudOf(party: readonly string[], encounter = 'first_light'): HudSnapshot {
  const sim = createSim({ seed: 7, encounter, party: [...party] });
  return buildHudSnapshot(sim.state, { seed: 7, hovered: null });
}

describe('Prep: the party picker', () => {
  it('exists only once the roster outgrows a party', () => {
    expect(prepParty(CONTENT.defaultParty)).toBeNull();
    expect(prepParty(['kael', 'lyra'])).toBeNull();
    expect(prepParty(ALL)).toEqual(['kael', 'lyra', 'vexis', 'brann']);
  });

  it('exactly three, in content order; a full pick takes no fourth; unknown ids are ignored', () => {
    expect(togglePick(CONTENT.defaultParty, 'brann', ALL)).toEqual(CONTENT.defaultParty);
    const two = togglePick(CONTENT.defaultParty, 'kael', ALL);
    expect(two).toEqual(['lyra', 'vexis']);
    expect(pickLegal(two, ALL)).toBe(false);
    expect(pickProblem(two)).toBe('Pick 1 more hero');
    const b = togglePick(two, 'brann', ALL);
    expect(b).toEqual(['lyra', 'vexis', 'brann']);
    expect(pickLegal(b, ALL)).toBe(true);
    expect(pickProblem(b)).toBeNull();
    // Brann isn't in a starter roster: he can't be picked there.
    expect(togglePick(two, 'brann', CONTENT.defaultParty)).toEqual(two);
    expect(togglePick(two, 'nobody', ALL)).toEqual(two);
    expect(pickLegal(['kael', 'kael', 'lyra'], ALL)).toBe(false);
    expect(canonical(['brann', 'kael', 'vexis'])).toEqual(['kael', 'vexis', 'brann']);
  });

  it('each chosen card shows the key it will take: party B is 1/2/3 = Lyra/Vexis/Brann', () => {
    const cards = pickerCards(ALL, ['brann', 'vexis', 'lyra']);
    expect(cards.map((c) => [c.heroId, c.key, c.selected, c.full])).toEqual([
      ['kael', null, false, true],
      ['lyra', 1, true, false],
      ['vexis', 2, true, false],
      ['brann', 3, true, false],
    ]);
    expect(cards.map((c) => c.role)).toEqual(['tank', 'ranger', 'arcanist', 'berserker']);
    expect(pickerCards(ALL, C).map((c) => c.key)).toEqual([1, 2, null, 3]);
  });

  it('one note per missing starter; the Kael note warns of Twin Cleave and Execution', () => {
    expect(missingStarterNotes(CONTENT.defaultParty)).toEqual([]);
    const b = missingStarterNotes(B);
    expect(b.map((n) => n.heroId)).toEqual(['kael']);
    expect(b[0]!.text).toMatch(/Twin Cleave and Execution/);
    expect(b[0]!.text).toMatch(/Reel and a Ward/);
    expect(missingStarterNotes(A).map((n) => n.heroId)).toEqual(['lyra']);
    expect(missingStarterNotes(A)[0]!.text).toMatch(/Sunder Leap interrupt/);
    expect(missingStarterNotes(C)[0]!.text).toMatch(/Gravity Well/);
  });

  it('Passive and Needs rows only for a def that has them', () => {
    for (const id of CONTENT.defaultParty) {
      expect(passiveRow(heroDef(id))).toBeNull();
      expect(needsRow(heroDef(id))).toBeNull();
    }
    const p = passiveRow(heroDef('brann'))!;
    expect(p.name).toBe('Blood Rage');
    expect(p.text).toMatch(/\+80% damage/);
    expect(p.text).toMatch(/4\.8% of what it deals/);
    expect(p.text).toMatch(/halved/);
    expect(needsRow(heroDef('brann'))).toMatch(/Fermata holds him/);
  });

  it('a recruit is named once in the Newly unlocked strip', () => {
    expect(freshHeroes([], [])).toEqual([]);
    const fresh = freshHeroes(['brann'], []);
    expect(fresh.map((h) => h.id)).toEqual(['hero.brann']);
    expect(fresh[0]!.name).toBe('Brann, the Bloodsworn');
    expect(freshHeroes(['brann'], ['hero.brann'])).toEqual([]);
  });
});

describe('his frame', () => {
  it('blood keys only for Brann; the default party gains none', () => {
    const plain = hudOf(CONTENT.defaultParty);
    for (const h of plain.party) {
      expect('blood' in h, h.defId).toBe(false);
      expect('healCut' in h, h.defId).toBe(false);
    }
    const sim = createSim({ seed: 7, encounter: 'first_light', party: [...A] });
    const w = worldOf(sim);
    const brann = w.entities.get(w.party[2]!)!;
    brann.hero!.blood = { ...newBlood(), oathBank: 120, bloodlet: 2 };
    brann.health!.hp = brann.health!.maxHp * 0.3;
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    expect(hud.party.map((h) => h.defId)).toEqual(['kael', 'vexis', 'brann']);
    expect('blood' in hud.party[0]!).toBe(false);
    expect('blood' in hud.party[1]!).toBe(false);
    const b = hud.party[2]!.blood!;
    expect(b.rage).toBeCloseTo(0.7, 5);
    expect(b.bloodlust).toBe(true);
    expect(b).toMatchObject({ deathless: false, oath: 120, tithe: false, fast: false, bled: 2 });
    // His permanent heal cut, through the Movement II hatch.
    expect(hud.party[2]!.healCut).toBe(0.5);
  });

  it('the default party’s HUD is as it was: an explicit default equals the implicit one', () => {
    for (const encounter of ['first_light', 'bellwarden', 'vharun']) {
      const implicit = createSim({ seed: 11, encounter });
      const explicit = createSim({ seed: 11, encounter, party: [...CONTENT.defaultParty] });
      for (let i = 0; i < 300; i++) {
        implicit.step([]);
        explicit.step([]);
      }
      const a = buildHudSnapshot(implicit.state, { seed: 11, hovered: null });
      const b = buildHudSnapshot(explicit.state, { seed: 11, hovered: null });
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      for (const h of a.party) expect(Object.keys(h)).not.toContain('blood');
    }
  });

  it('party B frames are labelled 1/2/3 = Lyra/Vexis/Brann', async () => {
    const hud = hudOf(B);
    expect(hud.party.map((h) => [h.slot, h.defId])).toEqual([
      [0, 'lyra'],
      [1, 'vexis'],
      [2, 'brann'],
    ]);
    const html = await drawFrames(hud.party);
    const keys = [
      ...html.matchAll(/data-testid="frame-key" data-key="([^"]+)" data-hero="([a-z]+)"/g),
    ].map((m) => [m[1], m[2]]);
    expect(keys).toEqual([
      ['1', 'lyra'],
      ['2', 'vexis'],
      ['3', 'brann'],
    ]);
  });

  it('no hurt tier on Brann; raging from 40% to 15%; critical below 15% or falling fast', () => {
    const max = heroDef('brann').maxHp;
    const at = (share: number, fast = false) =>
      ({
        ...brannHud('brann-raging').party[2]!,
        hp: max * share,
        blood: { ...brannHud('brann-raging').party[2]!.blood!, fast },
      }) as HeroHud;
    for (let s = 0.01; s <= 1; s += 0.01) expect(frameLevel(at(s))).not.toBe(1);
    expect(frameLevel(at(0.45))).toBe(0);
    expect(frameRaging(at(0.45))).toBe(false);
    expect(frameRaging(at(0.3))).toBe(true);
    expect(frameState(at(0.3)).critical).toBe(false);
    expect(frameState(at(0.14)).critical).toBe(true);
    expect(frameState(at(0.6, true)).critical).toBe(true);
    expect(frameRaging(at(0.3, true))).toBe(false);
    expect(ragingBand('brann')).toEqual({ top: 0.4, bottom: 0.15 });
    expect(ragingBand('kael')).toBeNull();
    // A default hero keeps the shared ramp: hurt under half, critical under a quarter.
    const kael = mockHud('calm').party[0]!;
    expect(frameLevel({ ...kael, hp: kael.maxHp * 0.4 })).toBe(1);
    expect(frameState({ ...kael, hp: kael.maxHp * 0.2 }).critical).toBe(true);
  });

  it('ticks at 40% and 15%; 30% with the Hymn; 10% with Deathless; none without blood', () => {
    expect(bloodTicks(mockHud('calm').party[0]!)).toEqual([]);
    expect(bloodTicks(brannHud('brann-raging').party[2]!).map((t) => t.at)).toEqual([0.4, 0.15]);
    expect(bloodTicks(brannHud('brann-deathless').party[2]!).map((t) => t.at)).toEqual([
      0.4, 0.3, 0.15, 0.1,
    ]);
  });

  it('his chips: rage, Bloodlust, Bloodletting, Deathless, Oath, Tithe', async () => {
    expect(rageLabel(0.62)).toBe('+62%');
    expect(bloodChips(brannHud('brann-raging').party[2]!).map((c) => c.id)).toEqual([
      'bloodlust',
      'rage',
    ]);
    expect(bloodChips(brannHud('brann-bloodlet').party[2]!).map((c) => c.label)).toContain(
      'Bloodlet ×3',
    );
    expect(bloodChips(brannHud('brann-deathless').party[2]!)[0]!.id).toBe('deathless');
    expect(bloodChips(brannHud('brann-oath').party[2]!).map((c) => c.id)).toEqual([
      'rage',
      'oath',
      'tithe',
    ]);
    expect(bloodChips(mockHud('calm').party[0]!)).toEqual([]);
    const html = await drawFrames(brannHud('brann-raging').party);
    expect(html).toContain('data-testid="blood-bloodlust"');
    expect(html).toContain('data-testid="raging-band"');
    expect(html.match(/data-testid="blood-tick"/g)).toHaveLength(2);
    expect(html).toContain('data-raging="true"');
    expect(html).toContain('data-testid="heal-cut"');
    // The default party's frames draw none of it.
    const plain = await drawFrames(mockHud('calm').party);
    expect(plain).not.toMatch(/blood-|raging-band|data-raging|call-named/);
  });
});

describe('decrees and answers', () => {
  const requiem = CONTENT.attacks.find(
    (a) => a.decreeNoDome && a.answers.includes('dome') && /Requiem/.test(a.decree ?? ''),
  )!;
  const cleave = CONTENT.attacks.find((a) => a.id === 'vharun_twin_cleave')!;
  const execution = CONTENT.attacks.find((a) => a.executeBelow !== undefined)!;
  // Brann's frame carries his own heal cut (halved) unless Blood Oath lifts it, as the bridge's.
  const party = (ids: readonly string[], condemned?: string) =>
    ids.map((defId) => ({
      defId,
      ...(defId === condemned ? { execute: 0.4 } : {}),
      ...(defId === 'brann' ? { healCut: 0.5 } : {}),
    }));

  it('the dome clause leaves the decree when no party hero has a dome', () => {
    expect(partyHasDome(CONTENT.defaultParty)).toBe(true);
    expect(partyHasDome(B)).toBe(false);
    for (const a of [requiem, cleave]) {
      expect(shownDecree(a.decree!, party(CONTENT.defaultParty))).toBe(a.decree);
      expect(shownDecree(a.decree!, party(A))).toBe(a.decree);
      expect(shownDecree(a.decree!, party(B))).toBe(a.decreeNoDome);
      expect(shownDecree(a.decree!, party(B))).not.toMatch(/dome|Kael/);
    }
    expect(shownDecree('Something else entirely.', party(B))).toBe('Something else entirely.');
  });

  it('Execution on Brann says to Ward him; on anyone else it is as it was', () => {
    expect(shownDecree(execution.decree!, party(B, 'brann'))).toBe(
      'Execution — Brann is condemned. Ward him: your healing barely takes on him.',
    );
    expect(shownDecree(execution.decree!, party(B, 'lyra'))).toBe(execution.decree);
    expect(shownDecree(execution.decree!, party(CONTENT.defaultParty, 'lyra'))).toBe(
      execution.decree,
    );
    const d = { name: 'Execution', text: execution.decree! };
    expect(shownDecreeOf(d, party(CONTENT.defaultParty, 'vexis'))).toBe(d);
  });

  it('the dome answer and glyph only with a dome in the party', async () => {
    expect(shownAnswers(['ward', 'reel', 'dome'], CONTENT.defaultParty)).toEqual([
      'ward',
      'reel',
      'dome',
    ]);
    expect(shownAnswers(['ward', 'reel', 'dome'], B)).toEqual(['ward', 'reel']);
    const AnswerGlyph = await component<{ tag: string; party?: readonly string[] }>(
      '../src/ui/hud/AnswerGlyph',
      'AnswerGlyph',
    );
    expect(renderToStaticMarkup(createElement(AnswerGlyph, { tag: 'dome', party: B }))).toBe('');
    expect(renderToStaticMarkup(createElement(AnswerGlyph, { tag: 'dome', party: A }))).toMatch(
      /Dome/,
    );
    expect(renderToStaticMarkup(createElement(AnswerGlyph, { tag: 'dome' }))).toMatch(/Dome/);
  });

  it('the bridge rewrites the boss bar for party B, and leaves the default party as it was', () => {
    for (const ids of [CONTENT.defaultParty, B]) {
      const sim = createSim({ seed: 7, encounter: 'vharun', party: [...ids] });
      const w = worldOf(sim);
      for (let i = 0; i < 900 && w.encounter.bossId === null; i++) sim.step([]);
      expect(w.encounter.bossId).not.toBeNull();
      w.encounter.decree = { name: 'Twin Cleave', text: cleave.decree!, at: w.time };
      const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
      expect(hud.boss!.decree!.text).toBe(ids === B ? cleave.decreeNoDome : cleave.decree);
    }
  });

  it('the decree banner reads true for the party', async () => {
    const Callouts = await component<{
      callouts: ReturnType<typeof brannCallouts>;
      barkSpeakers: string[];
      party?: readonly { defId: string }[];
    }>('../src/ui/hud/Callouts', 'Callouts');
    const callouts = brannCallouts('brann-cleave');
    const b = renderToStaticMarkup(
      createElement(Callouts, { callouts, barkSpeakers: [], party: party(B) }),
    );
    expect(b).not.toMatch(/dome/);
    const def = renderToStaticMarkup(createElement(Callouts, { callouts, barkSpeakers: [] }));
    expect(def).toMatch(/Kael’s dome/);
  });
});

describe('his hints', () => {
  const ids = (hud: HudSnapshot) => evaluateHints(hud).map((h) => h.id);

  it('hurt, he wants a Ward, never the hurt hints', () => {
    const hud = brannHud('brann-raging');
    expect(ids(hud)).toContain('brannLow');
    expect(evaluateHints(hud).find((h) => h.id === 'brannLow')!.text).toMatch(
      /fights harder hurt — Ward \{Q\} him, don’t Mend him/,
    );
    expect(ids(hud)).not.toContain('hurt');
    expect(ids(hud)).not.toContain('hurt-mode');
  });

  it('a Rally he refuses; a Fermata hold on him', () => {
    const rally = evaluateHints(brannHud('brann-rally')).find((h) => h.id === 'brannRally')!;
    expect(rally.text).toMatch(/won’t Rally below 40%/);
    expect(rally.text).toMatch(/Reel/);
    const held = ids(brannHud('brann-held'));
    expect(held).toContain('brannHold');
    expect(held.indexOf('brannHold')).toBeLessThan(held.indexOf('hold'));
    expect(evaluateHints(brannHud('brann-held')).find((h) => h.id === 'brannHold')!.text).toMatch(
      /even halved/,
    );
  });

  it('Execution on Brann asks for a Ward', () => {
    const e = evaluateHints(brannHud('brann-execution')).find((h) => h.id === 'execution')!;
    expect(e.text).toMatch(/Brann is condemned — Ward \{Q\} him/);
    const lyra = evaluateHints(legionExecution()).find((h) => h.id === 'execution')!;
    expect(lyra.text).toMatch(/lift them above 40%/);
  });

  it('the default party gets none of them', () => {
    for (const s of ['calm', 'crisis', 'downed', 'boss', 'fermata'] as const)
      for (const id of ids(mockHud(s))) expect(id.startsWith('brann'), `${s} ${id}`).toBe(false);
  });
});

/** The Movement II mock's Execution on Lyra (the default party). */
function legionExecution(): HudSnapshot {
  const hud = mockHud('calm');
  return {
    ...hud,
    party: hud.party.map((h) => (h.defId === 'lyra' ? { ...h, hp: 260, execute: 0.4 } : h)),
    boss: brannHud('brann-execution').boss && {
      ...brannHud('brann-execution').boss!,
      executeTarget: 'Lyra',
    },
  };
}

describe('the Call prompt names the hero', () => {
  it('Brann always; the default party never; a shared answer names both', async () => {
    const calls = brannHud('brann-calls').party;
    expect(callNamed(calls[0]!, calls)).toBe(true);
    expect(callNamed(calls[2]!, calls)).toBe(true);
    // Without Kael's Ward call, Brann's still names him.
    expect(callNamed(calls[2]!, calls.slice(1))).toBe(true);
    const plain = mockHud('calls').party;
    for (const h of plain) expect(callNamed(h, plain), h.defId).toBe(false);
    const html = await drawFrames(calls);
    expect(html.match(/data-testid="call-named"/g)).toHaveLength(2);
    expect(html).toContain('>Brann:<');
  });
});

describe('the New ally card', () => {
  it('once, for a recruit in his first fight; never for the starters', () => {
    expect(allyOf('kael')).toBeNull();
    expect(allyOf('brann')!.lines.join(' ')).toMatch(/halved.*Ward him.*Fermata still saves him/);
    expect(newAllies(CONTENT.defaultParty, [])).toEqual([]);
    expect(newAllies(A, [])).toEqual(['brann']);
    expect(newAllies(A, [`${ALLY_KEY}brann`])).toEqual([]);
    expect(noteAllies(A, 0)).toEqual(['brann']);
    expect(useProfile.getState().profile.introduced).toContain('ally:brann');
    const c = useUi.getState().callouts.find((x) => x.key === 'ally:brann')!;
    expect(allyDef(c)).toBe('brann');
    expect(sightingDef(c)).toBeNull();
    expect(noteAllies(A, 1)).toEqual([]);
  });
});

describe('the Codex', () => {
  it('a hero outside the roster is a silhouette with both routes', async () => {
    expect(lockedHeroText('brann')).toBe(
      'Free him from the Legion’s cell in Movement II, or face Vharun.',
    );
    expect(lockedHeroText('kael')).toBeNull();
    expect(lockedHeroes(CONTENT.defaultParty)).toEqual(['brann', 'seren', 'oro']);
    // Every hero recruited: no silhouette (Brann alone still leaves Seren and Oro locked).
    const everyone = CONTENT.heroes.map((h) => h.id);
    expect(lockedHeroes(ALL)).toEqual(['seren', 'oro']);
    expect(lockedHeroes(everyone)).toEqual([]);
    const CodexView = await component<{
      onBack(): void;
      initialTab: string;
      roster?: readonly string[];
      allowance?: typeof EVERYTHING;
    }>('../src/ui/screens/CodexScreen', 'CodexView');
    for (const tab of ['heroes', 'calls']) {
      const locked = renderToStaticMarkup(
        createElement(CodexView, {
          onBack: () => {},
          initialTab: tab,
          roster: CONTENT.defaultParty,
        }),
      );
      expect(locked).toContain('data-testid="codex-hero-locked"');
      expect(locked).toContain('or face Vharun');
      expect(locked).not.toContain('Bloodsworn');
      const open = renderToStaticMarkup(
        createElement(CodexView, { onBack: () => {}, initialTab: tab, roster: everyone }),
      );
      expect(open).not.toContain('codex-hero-locked');
      expect(open).toContain('Brann');
    }
    const heroes = renderToStaticMarkup(
      createElement(CodexView, { onBack: () => {}, initialTab: 'heroes', roster: everyone }),
    );
    expect(heroes).toContain('data-testid="codex-passive-brann"');
    expect(heroes).toContain('data-testid="codex-needs-brann"');
    expect(heroes).not.toContain('codex-passive-kael');
    const motifs = renderToStaticMarkup(
      createElement(CodexView, {
        onBack: () => {},
        initialTab: 'motifs',
        roster: CONTENT.defaultParty,
      }),
    );
    expect(motifs).toContain('data-testid="codex-motif-locked"');
    expect(motifs).toContain('Waits for a hero not yet met');
    expect(motifs).not.toContain('Blood Tithe');
  });
});

describe('Bonds tabs and the Harmony', () => {
  it('the tabs grid is sized by count', () => {
    expect(heroTabColumns(3)).toBe('sm:grid-cols-3');
    expect(heroTabColumns(4)).toBe('sm:grid-cols-4');
  });

  it('a Harmony wears its ribbon; its prerequisites say what they would enable', () => {
    expect(isHarmony('blood_and_silk')).toBe(true);
    expect(isHarmony('blood_tithe')).toBe(false);
    expect(harmonyHint('blood_tithe', A)).toBe('Harmony: with Taut Release → Blood and Silk');
    expect(harmonyHint('taut_release', B)).toBe('Harmony: with Blood Tithe → Blood and Silk');
    expect(harmonyHint('taut_release', CONTENT.defaultParty)).toBeNull();
    expect(harmonyHint('relay_weave', A)).toBeNull();
  });

  it('mockBondsHud fights with the scenario’s own party', () => {
    const hud = mockBondsHud('calm', mockRunBonds(mockBonds(4)));
    expect(hud.party.map((h) => h.defId)).toEqual(CONTENT.defaultParty);
  });
});

describe('the Cell, the Result and the Summary', () => {
  const cell = runEventDef('bloodsworn_cell');
  const free = cell.choices.find((c) => c.id === 'free')! as EventChoice;
  const leave = cell.choices.find((c) => c.id === 'leave')! as EventChoice;

  it('the Cell’s text by roster and party', () => {
    expect(choiceText(free, CONTENT.defaultParty)).toBe(free.text);
    expect(choiceText(free, CONTENT.defaultParty, CONTENT.defaultParty)).toBe(free.text);
    expect(choiceText(free, CONTENT.defaultParty, ALL)).toBe(free.recruitedText);
    expect(choiceText(free, A, ALL)).toBe(free.partyText);
    expect(choiceText(leave, A, ALL)).toBe(leave.text);
    expect(choiceInfo(cellRun(), cell.id, free).text).toBe(free.text);
    expect(choiceInfo(cellRun(), cell.id, free, ALL).text).toBe(free.recruitedText);
    expect(choiceInfo(cellRun(A), cell.id, free, ALL).text).toBe(free.partyText);
  });

  it('the recruit line by route', () => {
    expect(recruitLine('brann', 'legion_vanguard')).toBe(
      'Brann, the Bloodsworn, will fight beside you from your next run.',
    );
    expect(recruitLine('brann', 'vharun')).toBe(
      'In the chaos of your stand against Vharun, the prisoner slipped his chain. He’ll find you before your next run.',
    );
  });

  it('Brann’s Blood Rage line, from heroes[i].blood', () => {
    expect(
      bloodLine('brann', {
        lifesteal: 1240,
        lowTime: 62,
        low30Time: 20,
        aliveTime: 100,
        peakAfterLow: 0.4,
        spent: 125,
      }),
    ).toBe('Under 40%: 62% of the fight · Lifesteal 1,240 · Your healing on him: halved');
    const run = brannResultRun();
    const b = run.lastResult!.heroes.find((h) => h.heroId === 'brann')!.blood!;
    expect(runBlood(run, 'brann')).toEqual(b);
    expect(runBlood(run, 'kael')).toBeNull();
    expect(bloodLine('brann', b, true, true)).toMatch(/of the run .*full \(Blood Oath\)$/);
  });

  it('the Result shows the recruit once, and Brann’s line', async () => {
    const ResultView = await component<Record<string, unknown>>(
      '../src/ui/screens/ResultScreen',
      'ResultView',
    );
    const run = brannResultRun();
    const html = renderToStaticMarkup(
      createElement(ResultView, {
        run,
        result: run.lastResult!,
        onContinue: () => {},
        recruits: ['brann'],
      }),
    );
    expect(html).toContain('data-testid="result-recruit"');
    expect(html).toContain('will fight beside you from your next run');
    expect(html).toContain('data-testid="blood-line"');
    const plain = brannResultRun(CONTENT.defaultParty);
    const none = renderToStaticMarkup(
      createElement(ResultView, { run: plain, result: plain.lastResult!, onContinue: () => {} }),
    );
    expect(none).not.toMatch(/result-recruit|blood-line/);
  });
});

describe('In the Red, in sight with the roster', () => {
  const seen = CONTENT.enemies.map((e) => e.id);
  const held = { earned: [], best: {} };
  const open = { allowance: EVERYTHING, astrolabe: true };

  it('shows only once Brann is in the roster', () => {
    const ids = (roster?: readonly string[]) =>
      [
        ...deedsView(held, open, seen, roster).ladder,
        ...deedsView(held, open, seen, roster).badges,
      ].map((d) => d.id);
    expect(ids()).not.toContain('in_the_red');
    expect(ids(CONTENT.defaultParty)).not.toContain('in_the_red');
    expect(ids(ALL)).toContain('in_the_red');
    expect(deedsTally([], seen, ALL).total).toBe(deedsTally([], seen).total + 1);
  });
});
