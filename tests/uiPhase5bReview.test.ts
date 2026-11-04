/**
 * Phase 5b: regressions for the integration review (docs/phase-5b.md). Turning "Skip the unlocks"
 * off (or resuming) with an unrecruited hero picked in Prep falls back to the default party; a
 * Bond scene pays the XP its screens show (no catch-up); Bloodletting's drop reads as a drain on
 * his frame, never as a hit; and the Cell's choice says the prisoner joins until he's truly
 * recruited, whatever "Skip the unlocks" says. His frame goes critical with a lethal hit coming
 * (no ember fill), and draws Blood and Silk's 30% line as the bar over his head does.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT } from '../src/content';
import { sceneXp } from '../src/meta/bonds';
import { heroRoster } from '../src/meta/profile';
import { bloodTicks, frameRaging, lifeDrop } from '../src/ui/hud/bloodLook';
import { frameLevel } from '../src/ui/hud/healthModel';
import { runBondXp, sceneXpLine } from '../src/ui/screens/bondsModel';
import { heroDef } from '../src/content';
import { choiceRoster, choiceText, healCutStackText } from '../src/ui/screens/rosterModel';

const R = CONTENT.bondRules;
const at = (rank: number) => R.ranks[rank - 1]!;
const party = () => useRun.getState().run!.party.map((h) => h.heroId);
const unlockAll = (on: boolean) => useSettings.getState().update((s) => ({ ...s, unlockAll: on }));

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('a Prep party follows the roster when Skip the unlocks goes off', () => {
  it('turning it off in Prep falls back to the default party (and its Bonds)', () => {
    unlockAll(true);
    useRun.getState().newRun(81);
    useRun.getState().setParty(['kael', 'lyra', 'brann']);
    expect(party()).toEqual(['kael', 'lyra', 'brann']);
    unlockAll(false);
    expect(useProfile.getState().roster()).toEqual(['kael', 'lyra', 'vexis']);
    expect(useRun.getState().run!.phase).toBe('prep');
    expect(party()).toEqual(CONTENT.defaultParty);
    expect(useRun.getState().run!.bonds.every((b) => b.heroId !== 'brann')).toBe(true);
    // What Prep shows is what embarks.
    useRun.getState().embark();
    expect(party()).toEqual(CONTENT.defaultParty);
  });

  it('a recruited hero stays picked', () => {
    useProfile.getState().recruit(['brann']);
    unlockAll(true);
    useRun.getState().newRun(81);
    useRun.getState().setParty(['kael', 'lyra', 'brann']);
    unlockAll(false);
    expect(party()).toEqual(['kael', 'lyra', 'brann']);
  });

  it('a saved Prep resumed after the setting went off is re-fitted', () => {
    unlockAll(true);
    useRun.getState().newRun(81);
    useRun.getState().setParty(['kael', 'lyra', 'brann']);
    // The app closes with the run saved; the setting is off when it opens again.
    useRun.setState({ run: null });
    unlockAll(false);
    expect(useRun.getState().resume()).toBe(true);
    expect(party()).toEqual(CONTENT.defaultParty);
  });
});

describe('a Bond scene pays what its screens show', () => {
  it('a late recruit behind the starters gets the scene’s own XP, not doubled', () => {
    useProfile.getState().awardBonds({ kael: at(8), lyra: at(8), vexis: at(8) });
    useProfile.getState().recruit(['brann']);
    useProfile.getState().awardBonds({ brann: at(2) }, false);
    const scene = CONTENT.scenes
      .filter((s) => s.hero === 'brann')
      .sort((a, b) => a.rank - b.rank)[0]!;
    const before = useProfile.getState().profile.bonds.brann!.xp;
    useProfile.getState().seeScene(scene.id, 0);
    const gained = useProfile.getState().profile.bonds.brann!.xp - before;
    expect(gained).toBe(sceneXp(scene));
    expect(sceneXpLine(scene)).toContain(String(sceneXp(scene)));
    // The Summary's run total counts the same figure.
    expect(runBondXp({ results: [], scenes: [scene.id] }).brann).toBe(gained);
  });
});

describe('Bloodletting on his frame is a drain, not a hit', () => {
  it('the life he spent is not a hit; more than it is', () => {
    expect(lifeDrop(1000, 850, 0, 150)).toEqual({ hit: false, bled: 150 });
    expect(lifeDrop(1000, 700, 0, 150)).toEqual({ hit: true, bled: 150 });
    // A plain hit, and every default hero (no spent): a hit, as before.
    expect(lifeDrop(1000, 850, 150, 150)).toEqual({ hit: true, bled: 0 });
    expect(lifeDrop(1000, 850, 0, 0)).toEqual({ hit: true, bled: 0 });
    // A heal: neither.
    expect(lifeDrop(850, 900, 150, 150)).toEqual({ hit: false, bled: 0 });
  });
});

describe('the Cell’s choice under Skip the unlocks', () => {
  const free = CONTENT.events
    .find((e) => e.id === 'bloodsworn_cell')!
    .choices.find((c) => c.id === 'free')!;

  it('says the prisoner joins until he is really recruited', () => {
    // Skip the unlocks' roster has him; the choice's roster doesn't.
    expect(heroRoster({}, true)).toContain('brann');
    expect(choiceRoster(undefined)).toEqual(['kael', 'lyra', 'vexis']);
    expect(choiceText(free, CONTENT.defaultParty, choiceRoster(undefined))).toBe(free.text);
    expect(free.text).toMatch(/joins/);
    // Recruited, the copy stays true.
    expect(choiceText(free, CONTENT.defaultParty, choiceRoster(['brann']))).toBe(
      free.recruitedText,
    );
  });
});

describe('his frame’s alarms match the bar over his head', () => {
  const brann = (over: Record<string, unknown> = {}) => ({
    hp: 350,
    maxHp: 1000,
    defId: 'brann',
    lethal: false,
    talents: [] as string[],
    blood: {
      rage: 0.6,
      bloodlust: true,
      deathless: false,
      oath: 0,
      tithe: false,
      fast: false,
      bled: 0,
    },
    ...over,
  });

  it('a lethal hit coming makes him critical, with no ember fill', () => {
    expect(frameLevel(brann())).toBe(0);
    expect(frameRaging(brann())).toBe(true);
    expect(frameLevel(brann({ lethal: true }))).toBe(2);
    expect(frameRaging(brann({ lethal: true }))).toBe(false);
    // A starter's frame keeps the shared ramp, lethal or not.
    const kael = { hp: 350, maxHp: 1000, defId: 'kael', lethal: true };
    expect(frameLevel(kael)).toBe(1);
  });

  it('Blood and Silk draws the 30% line, as the Hymn does; one line for both', () => {
    const at = (h: ReturnType<typeof brann>) => bloodTicks(h).map((t) => t.at);
    expect(at(brann())).not.toContain(0.3);
    const silk = brann({ blood: { ...brann().blood, silk: true } });
    expect(at(silk)).toContain(0.3);
    const both = brann({ blood: { ...brann().blood, silk: true }, talents: ['berserkers_hymn'] });
    expect(at(both).filter((x) => x === 0.3)).toHaveLength(1);
    expect(bloodTicks(both).find((t) => t.at === 0.3)!.title).toMatch(/Hymn.*Blood and Silk/);
  });
});

describe('the Codex says how his healing cut stacks', () => {
  it('a quarter with a Wound or outside the pools, an eighth with both; none for a starter', () => {
    const text = healCutStackText(heroDef('brann'))!;
    expect(text).toMatch(/a quarter/);
    expect(text).toMatch(/an eighth/);
    for (const id of CONTENT.defaultParty) expect(healCutStackText(heroDef(id))).toBeNull();
  });

  it('the Codex hero page shows it under his passive', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const path = '../src/ui/screens/CodexScreen';
    const mod = (await import(/* @vite-ignore */ path)) as Record<
      string,
      (p: Record<string, unknown>) => null
    >;
    const html = renderToStaticMarkup(
      createElement(mod.CodexView!, {
        onBack: () => {},
        initialTab: 'heroes',
        roster: CONTENT.heroes.map((h) => h.id),
      }),
    );
    expect(html).toContain('data-testid="codex-heal-stack-brann"');
    expect(html).not.toContain('codex-heal-stack-kael');
  });
});
