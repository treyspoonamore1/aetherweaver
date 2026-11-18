/**
 * Solos on the HUD (docs/solos.md): heroes fire their own, and a Solo is Cued when the Weaver's
 * Thread is on the hero as it fires. Successors to the tests of the Cue's price: the frames'
 * countdown and "will be Cued" state are the sim's `soloDueIn` and `threadCues`, read not copied;
 * nothing on the HUD names a Cue key or a Cue's price; the coach says what the Thread does.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { SOLOS } from '../src/sim/constants';
import {
  soloDueIn,
  threadCues,
  wallWanted,
  type Command,
  type PartySlot,
  type Sim,
} from '../src/sim';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { ANSWER_HINTS, evaluateHints } from '../src/ui/hud/hints';
import { mockHud } from '../src/ui/lab/mock';
import type { HeroHud, HudSnapshot } from '../src/ui/store';
import { EN } from '../src/ui/text';
import { sandbox, stepUntil } from './sim/helpers';

async function tsx<T>(path: string): Promise<T> {
  return (await import(/* @vite-ignore */ path)) as T;
}
type Props = Record<string, unknown>;
const { PartyFrames } = await tsx<{ PartyFrames: FunctionComponent<Props> }>(
  '../src/ui/hud/PartyFrames',
);
const { WeaverBar } = await tsx<{ WeaverBar: FunctionComponent<Props> }>('../src/ui/hud/WeaverBar');
const { KeyHints } = await tsx<{ KeyHints: FunctionComponent<Props> }>('../src/ui/hud/KeyHints');
const { HowToPlay } = await tsx<{ HowToPlay: FunctionComponent<Props> }>('../src/ui/hud/HowToPlay');

const hud = (sim: Sim) => buildHudSnapshot(sim.state, { seed: 7, hovered: null });
const frames = (party: HeroHud[]) =>
  renderToStaticMarkup(createElement(PartyFrames, { party, threadMode: 'mend', barks: [] }));
const brute: Command = { t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', x: 0, z: -5 } };
/** A sandbox fight with the party engaged on a Bell Brute. */
function fight(config: Parameters<typeof sandbox>[0] = {}) {
  const sim = sandbox(config);
  const st = sim.state;
  sim.step([brute]);
  stepUntil(sim, () => st.party.every((id) => st.entities.get(id)!.hero!.targetId !== null));
  const hero = (slot: number) => st.entities.get(st.party[slot]!)!;
  const setSolo = (slot: number, solo: number) => {
    (hero(slot).hero as { solo: number }).solo = solo;
  };
  return { sim, st, hero, setSolo };
}
/** The words of a message as the voice guide counts them (a placeholder is one word). */
const words = (text: string) =>
  text
    .replace(/\{\{?\w+\}?\}/g, 'X')
    .split(/\s+/)
    .filter((w) => /\w/.test(w)).length;

describe('the frames read the sim’s tell (soloDueIn) and Cue (threadCues)', () => {
  it('through a fight every frame’s countdown and Cued state are the sim’s own', () => {
    const { sim, st, hero } = fight();
    let coming = 0;
    let cued = 0;
    let now = 0;
    for (let tick = 0; tick < 60 * 45; tick++) {
      // The Thread wanders: on Lyra, on Vexis, on nobody's Solo.
      const commands: Command[] =
        tick % 240 === 0 ? [{ t: 'thread', slot: ((tick / 240) % 3) as PartySlot }] : [];
      if (tick % 600 === 0) commands.push(brute);
      sim.step(commands);
      if (tick % 4) continue;
      const h = hud(sim);
      for (let slot = 0; slot < 3; slot++) {
        const e = hero(slot);
        const f = h.party[slot]!;
        const idle = e.hero!.solo >= 100 && e.hero!.targetId === null;
        const due = idle ? null : soloDueIn(st, e);
        expect(f.soloIn ?? null).toBe(due);
        if (due === null) {
          expect(f.willCue).toBe(false);
          continue;
        }
        coming++;
        expect(f.willCue).toBe(threadCues(st, e));
        expect(f.soloNow).toBe(e.hero!.solo >= 100);
        expect(f.soloLoose === true).toBe(e.hero!.soloId === 'aegisWall');
        if (f.willCue) cued++;
        if (f.soloNow) now++;
        // The tell is at most its seconds of charge, the wait, the gap and nothing more.
        expect(due).toBeLessThanOrEqual(SOLOS.tell + SOLOS.kaelHold + SOLOS.gap + 1e-9);
      }
    }
    expect(coming).toBeGreaterThan(20);
    expect(cued).toBeGreaterThan(0);
    expect(now).toBeGreaterThan(0);
  });

  it('full with no one to fight, nothing is coming: the wait has not begun', () => {
    const sim = sandbox();
    sim.step([{ t: 'debug', op: { op: 'chargeSolos' } }]);
    sim.step([]);
    for (const f of hud(sim).party) {
      expect(f.solo).toBe(100);
      expect(f.soloReady).toBe(true);
      expect(f.soloIn).toBeNull();
    }
    expect(frames(hud(sim).party)).not.toContain('data-testid="solo-strip"');
  });

  it('the strip’s four states: coming, now, Cued, and Silent Cues’ hold', () => {
    const { sim, st, hero, setSolo } = fight();
    // Coming: the last seconds of charge, the Thread elsewhere. Quiet: the Solo's name and seconds.
    setSolo(1, 95);
    sim.step([]);
    let lyra = hud(sim).party[1]!;
    expect(lyra).toMatchObject({ soloNow: false, willCue: false });
    let html = frames([lyra]);
    expect(html).toContain('data-testid="solo-strip"');
    expect(html).toContain('data-state="coming"');
    expect(html).toContain(lyra.soloName);
    expect(html).not.toContain('Thread to Cue');
    expect(html).toMatch(new RegExp(`data-testid="solo-in">${lyra.soloIn!.toFixed(1)}<`));
    // Now: full, the wait running. Loud: "Thread to Cue".
    setSolo(1, 100);
    sim.step([]);
    lyra = hud(sim).party[1]!;
    expect(lyra).toMatchObject({ soloNow: true, willCue: false });
    expect(lyra.soloIn!).toBeLessThanOrEqual(SOLOS.wait + SOLOS.gap);
    html = frames([lyra]);
    expect(html).toContain('data-state="now"');
    expect(html).toContain('Thread to Cue');
    expect(html).toContain('anim-glow');
    // The Thread on her: Cued, at either stage. A filled strip, a tick, the word.
    sim.step([{ t: 'thread', slot: 1 }]);
    lyra = hud(sim).party[1]!;
    expect(threadCues(st, hero(1))).toBe(true);
    expect(lyra.willCue).toBe(true);
    html = frames([lyra]);
    expect(html).toContain('data-state="cued"');
    expect(html).toMatch(/data-testid="solo-say">Cued</);
    expect(html).not.toContain('Thread to Cue');
    expect(html).toContain('data-cued="true"');
    // And she fires Cued on the sim's own tick.
    let fired: boolean | null = null;
    for (let i = 0; i < 120 && fired === null; i++) {
      sim.step([]);
      for (const e of sim.drainEvents()) if (e.type === 'soloStarted') fired = e.cued;
    }
    expect(fired).toBe(true);
    expect(frames([hud(sim).party[1]!])).not.toContain('data-testid="solo-strip"');
    // Hold (Silent Cues): the Thread on them, not yet long enough.
    const held = { ...lyra, willCue: false, cueHold: 0.6 };
    html = frames([held]);
    expect(html).toContain('data-state="hold"');
    expect(html).toContain('Hold 0.6 s');
  });

  it('a screen reader hears each state once, in a sentence, and never the seconds', () => {
    const lyra = mockHud('resonance').party.find((h) => h.defId === 'lyra')!;
    /** The strip's one live region: its text, and everything else the strip draws. */
    const read = (h: HeroHud) => {
      const html = frames([h]);
      const strip = /<div[^>]*data-testid="solo-strip".*?<\/span><\/div>/.exec(html)![0];
      const live = [...strip.matchAll(/role="status"[^>]*>([^<]*)</g)].map((m) => m[1]!);
      return { strip, live };
    };
    const coming = { ...lyra, soloNow: false, willCue: false, soloIn: 2.4 };
    const states: [string, HeroHud, string][] = [
      ['coming', coming, `Lyra’s ${lyra.soloName} is coming.`],
      [
        'now',
        { ...coming, soloNow: true, soloIn: 0.8 },
        `Lyra’s ${lyra.soloName} is full. Thread them to Cue it.`,
      ],
      [
        'hold',
        { ...coming, soloNow: true, soloIn: 0.8, cueHold: 0.6 },
        `Lyra’s ${lyra.soloName} is coming. Hold your Thread on them to Cue it.`,
      ],
      [
        'cued',
        { ...coming, soloNow: true, soloIn: 0.8, willCue: true },
        `Lyra’s ${lyra.soloName} is coming, Cued. Your Thread is on them.`,
      ],
    ];
    const heard = new Set<string>();
    for (const [state, h, sentence] of states) {
      const { strip, live } = read(h);
      expect(strip, state).toContain(`data-state="${state}"`);
      // One live region, holding the sentence and no number.
      expect(live, state).toEqual([sentence]);
      expect(sentence, state).not.toMatch(/\d/);
      // The strip itself is no live region and carries no label that counts.
      expect(strip.slice(0, strip.indexOf('>')), state).not.toMatch(/role=|aria-label=/);
      // The seconds are drawn, inside the part hidden from a screen reader.
      const drawn = strip.slice(strip.indexOf('aria-hidden'));
      expect(strip, state).toContain('<span class="contents" aria-hidden="true">');
      expect(drawn, state).toContain(`data-testid="solo-in">${h.soloIn!.toFixed(1)}<`);
      // Half a second later, in the same state: the same words, so nothing is said again.
      const later = { ...h, soloIn: h.soloIn! - 0.5, ...(h.cueHold ? { cueHold: 0.1 } : {}) };
      expect(read(later).live, state).toEqual([sentence]);
      heard.add(sentence);
    }
    // Each state is its own sentence: a change of state is a change of words.
    expect(heard.size).toBe(states.length);
    // On a Conductor run the Duet or Trio is said with it.
    const duet = { ...coming, cue: { link: 2 as const, power: 1.25, label: 'Duet' } };
    expect(read(duet).live).toEqual([`Lyra’s ${lyra.soloName} is coming. Cued, it is a Duet.`]);
  });

  it('a count that has run out shows no seconds: a standing 0.0 says nothing', () => {
    const lyra = mockHud('resonance').party.find((h) => h.defId === 'lyra')!;
    expect(frames([{ ...lyra, soloIn: 0.6 }])).toContain('data-testid="solo-in"');
    const held = frames([{ ...lyra, soloIn: 0 }]);
    expect(held).toContain('data-testid="solo-strip"');
    expect(held).toContain('Thread to Cue');
    expect(held).not.toContain('data-testid="solo-in"');
  });

  it('Kael’s strip shows no seconds: he may raise his wall sooner', () => {
    const { sim, setSolo } = fight();
    setSolo(0, 100);
    sim.step([]);
    const kael = hud(sim).party[0]!;
    expect(kael.soloIn).not.toBeNull();
    expect(kael.soloLoose).toBe(true);
    const html = frames([kael]);
    expect(html).toContain('data-testid="solo-strip"');
    expect(html).not.toContain('data-testid="solo-in"');
    expect(html).toContain('Thread to Cue');
  });

  it('a downed, possessed or stilled hero has no tell', () => {
    const { sim, hero, setSolo } = fight();
    setSolo(1, 100);
    sim.step([]);
    expect(hud(sim).party[1]!.soloIn).not.toBeNull();
    const statuses = hero(1).health!.statuses as unknown as Record<string, unknown>[];
    for (const id of ['possessed', 'stilled']) {
      statuses.push({ id, remaining: 9, duration: 9, stacks: 1, source: null });
      expect(hud(sim).party[1]!.soloIn, id).toBeNull();
      statuses.pop();
    }
    expect(hud(sim).party[1]!.soloIn).not.toBeNull();
  });
});

describe('nothing on the HUD names a Cue key or a Cue’s price', () => {
  const scenarios = ['calm', 'crisis', 'boss', 'resonance', 'calls'] as const;

  it('the frames: no AUTO tag, no key cap for a Cue, in any state', () => {
    for (const s of scenarios) {
      const html = frames(mockHud(s).party);
      expect(html, s).not.toContain('AUTO');
      expect(html, s).not.toMatch(/⇧|Shift/);
      expect(html, s).not.toMatch(/Cue \w+ now|fires on its own/);
    }
    // The one key a frame shows is the key that threads its hero.
    const html = frames(mockHud('resonance').party);
    expect(html.match(/data-testid="frame-key"/g)).toHaveLength(3);
  });

  it('the meter: no Cue ticks, no "Cue 25", no "enough for" in its label', () => {
    for (const s of scenarios) {
      const html = renderToStaticMarkup(createElement(WeaverBar, { hud: mockHud(s) }));
      expect(html, s).not.toContain('cue-tick');
      expect(html, s).not.toContain('cue-cost');
      expect(html, s).not.toContain('data-cue-cost');
      expect(html, s).not.toMatch(/Cue \d|Enough for|A Cue costs/);
    }
    const w: object = mockHud('calm').weaver;
    expect('cueCost' in w).toBe(false);
    expect('cueBase' in w).toBe(false);
  });

  it('the key reminders and the primer: no Cue row, no Cue key', () => {
    const keys = renderToStaticMarkup(createElement(KeyHints, { always: true }));
    expect(keys).not.toMatch(/Cue/);
    expect(keys).toContain('Thread a hero');
    for (const props of [{}, { cue: { hold: 1 } }, { conduct: { chainWindow: 4 } }]) {
      const html = renderToStaticMarkup(createElement(HowToPlay, { onClose: () => {}, ...props }));
      expect(html).not.toMatch(/costs|segment|Spend|⇧|Shift/);
      // "Cued" is explained once, in the same words everywhere.
      expect(html).toMatch(/with your Thread on them|your Thread was on them/);
    }
  });

  it('no HUD or screen message speaks of a Cue key, a Cue’s cost or hero autonomy', () => {
    const bad =
      /Cue key|Cue modifier|to Cue it \(costs|A Cue costs|Cues? cost|free Cue|Free Cue|autonomy/i;
    const hits = Object.entries(EN)
      .filter(([k]) => /^(hud|screens|common)\./.test(k))
      .filter(([, v]) => bad.test(v as string))
      .map(([k]) => k);
    expect(hits).toEqual([]);
  });
});

describe('the coach says what the Thread does', () => {
  const fighting = (h: HudSnapshot) =>
    evaluateHints({ ...h, encounter: { ...h.encounter, kind: 'skirmish', status: 'fighting' } });

  it('a Solo coming with the Thread elsewhere: Thread them, by their own key', () => {
    const base = mockHud('calm');
    const coming = (over: Partial<HeroHud>) => ({
      ...base,
      party: base.party.map((h) =>
        h.defId === 'lyra'
          ? {
              ...h,
              solo: 100,
              soloReady: true,
              soloIn: 0.7,
              soloNow: true,
              threaded: false,
              ...over,
            }
          : { ...h, threaded: false },
      ),
    });
    const hint = fighting(coming({ willCue: false })).find((x) => x.id === 'solo')!;
    const lyra = base.party.find((h) => h.defId === 'lyra')!;
    expect(hint.text).toBe(
      `Lyra’s ${lyra.soloName} is coming. Thread them {${lyra.slot + 1}} to Cue it: the stronger form`,
    );
    // The voice guide's ceiling for a coach hint: 18 words in up to 2 sentences.
    expect(words(hint.text)).toBeLessThanOrEqual(18);
    // The Thread on her (it will be Cued), or holding under Silent Cues: nothing to add.
    expect(fighting(coming({ willCue: true, threaded: true })).map((x) => x.id)).not.toContain(
      'solo',
    );
    expect(fighting(coming({ willCue: false, cueHold: 0.5 })).map((x) => x.id)).not.toContain(
      'solo',
    );
    // No Solo coming: no hint, however full the meter.
    const none = { ...base, weaver: { ...base.weaver, resonance: 100 } };
    expect(fighting(none).map((x) => x.id)).not.toContain('solo');
    expect(fighting(none).map((x) => x.id)).not.toContain('cue');
  });

  it('a hit coming for the party with Kael’s wall full: Thread him for the dome', () => {
    const base = mockHud('calm');
    const stage = (kael: Partial<HeroHud>) => ({
      ...base,
      party: base.party.map((h) =>
        h.defId === 'kael'
          ? { ...h, solo: 100, soloReady: true, threaded: false, wallWanted: true, ...kael }
          : { ...h, threaded: false, incoming: 300 },
      ),
    });
    const hint = fighting(stage({})).find((x) => x.id === 'dome')!;
    expect(hint.text).toBe(
      'A hit is coming for the party. Thread Kael {1}: Cued, his wall shields everyone',
    );
    expect(words(hint.text)).toBeLessThanOrEqual(18);
    // The sim says when (`wallWanted`); damage on its way to two heroes is not enough by itself.
    expect(fighting(stage({ wallWanted: false })).map((x) => x.id)).not.toContain('dome');
    // The Thread already on him says nothing.
    expect(fighting(stage({ threaded: true, willCue: true })).map((x) => x.id)).not.toContain(
      'dome',
    );
  });

  it('the dome lesson shows exactly when threading Kael would raise his wall: the sim’s own rule', () => {
    const hinted = (sim: Sim) =>
      fighting(hud(sim))
        .map((x) => x.id)
        .includes('dome');
    /** Kael's wall alone full, the Thread on Lyra, then a burst over the party. */
    const stage = (impact: number, r: number, share: number) => {
      const { sim, st, hero, setSolo } = fight();
      setSolo(0, 100);
      sim.step([{ t: 'thread', slot: 1 }]);
      const kael = hero(0);
      const w = st as unknown as { telegraphs: unknown[]; time: number; weaverId: number };
      w.telegraphs.push({
        id: 9100,
        owner: w.weaverId,
        target: null,
        attackId: 'test_burst',
        name: 'Test Burst',
        kind: 'burst',
        shape: { kind: 'circle', x: kael.x, z: kael.z, r },
        start: w.time,
        impact: w.time + impact,
        perfectFrom: w.time + impact - 0.35,
        damage: 0,
        pctMaxHp: share,
        effect: 'damage',
        answers: [],
        severity: 'normal',
      });
      for (const id of st.party) {
        const h = st.entities.get(id)!.health! as { hp: number; maxHp: number };
        h.hp = h.maxHp;
      }
      sim.step([]);
      sim.drainEvents();
      return { sim, st, kael };
    };
    // A burst over everyone, four tenths of their life, a second off: the lesson shows, and
    // doing what it says raises the wall on the next tick, Cued.
    const due = stage(1, 30, 0.4);
    expect(wallWanted(due.st, due.kael)).toBe(true);
    expect(hud(due.sim).party[0]!.wallWanted).toBe(true);
    expect(hinted(due.sim)).toBe(true);
    due.sim.step([{ t: 'thread', slot: 0 }]);
    due.sim.step([]);
    const raised = due.sim.drainEvents().filter((e) => e.type === 'soloStarted');
    expect(raised).toHaveLength(1);
    expect(raised[0]).toMatchObject({ hero: due.kael.id, solo: 'aegisWall', cued: true });
    // The same hit further off than the rule's 1.5 s: damage is on its way to all three, which
    // the coach's old copy of the rule took for enough. He would not raise it: no lesson.
    const far = stage(SOLOS.partyHit + 1.5, 30, 0.4);
    expect(hud(far.sim).party.filter((h) => h.incoming > 0).length).toBeGreaterThan(1);
    expect(wallWanted(far.st, far.kael)).toBe(false);
    expect(hinted(far.sim)).toBe(false);
    far.sim.step([{ t: 'thread', slot: 0 }]);
    far.sim.step([]);
    expect(far.sim.drainEvents().filter((e) => e.type === 'soloStarted')).toEqual([]);
    // A scratch on everyone (a twentieth of their life) is no hit on the party either.
    const scratch = stage(1, 30, 0.05);
    expect(hinted(scratch.sim)).toBe(false);
    // His alternate Solo raises no dome.
    const other = stage(1, 30, 0.4);
    (other.kael.hero as { soloId: string }).soloId = 'oathkeeper';
    expect(wallWanted(other.st, other.kael)).toBe(false);
    expect(hinted(other.sim)).toBe(false);
    // It names an answer, so Blind Score hides it.
    expect(ANSWER_HINTS.has('dome')).toBe(true);
  });

  it('every Solo, Cue and Resonance hint is within the voice guide’s 18 words', () => {
    const keys = [
      'hud.hints.aHitIsComingFor',
      'hud.hints.soloIsComing',
      'hud.hints.threadForALink',
      'hud.hints.solosBeginOnThe',
      'hud.hints.solosBeginOnThe2',
      'hud.hints.resonanceIsFullPress',
      'hud.hints.playsEverySoloRising',
      'hud.hints.everySoloYouLet',
      'hud.hints.yourCrescendoCancelsIt',
      'hud.hints.holdResonanceYourCrescendo',
      'hud.hints.yourHeroesCanT',
      'hud.hints.everyEnemyWaitsYour',
    ] as const;
    for (const k of keys) {
      const text = EN[k] as string;
      expect(words(text), k).toBeLessThanOrEqual(18);
      expect(text, k).not.toContain('—');
    }
  });
});

describe('the Codex states Resonance as the meter gains it', () => {
  it('the gains shown are the content’s at the content’s scale', async () => {
    const { CodexView } = await tsx<{ CodexView: FunctionComponent<Props> }>(
      '../src/ui/screens/CodexScreen',
    );
    const html = renderToStaticMarkup(
      createElement(CodexView, { onBack: () => {}, initialTab: 'weaver', seen: [] }),
    );
    const r = CONTENT.resonance;
    const shown = (n: number) => String(Number((n * r.gainScale).toFixed(1)));
    expect(html).toContain(`Perfect Ward +${shown(r.gains.perfectWard)}`);
    expect(html).toContain(`Save +${shown(r.gains.save)}`);
    expect(html).toContain(`Answered call +${shown(r.gains.response)}`);
    // The Solos entry: heroes fire their own, Cued by the Thread, and the sim's own seconds.
    expect(html).toContain('A Solo fired with your Thread on them is Cued: the stronger form.');
    expect(html).toContain(`Fires ${SOLOS.wait} s after it fills`);
    expect(html).toContain(`Kael holds his wall up to ${SOLOS.kaelHold} s`);
    expect(html).not.toMatch(/spends one segment|a Cue costs/i);
  });
});

describe('an old replay is refused in one plain sentence', () => {
  it('the weekly panel shows the check’s own sentence under a Claimed flag, never a mismatch', async () => {
    const { verifyRunReplay, RUN_REPLAY_FORMAT } = await tsx<{
      verifyRunReplay: (file: unknown) => { status: string; message: string; refused?: string };
      RUN_REPLAY_FORMAT: string;
    }>('../src/meta/runReplay');
    const { OLD_REPLAY_LINE } = await tsx<{ OLD_REPLAY_LINE: string }>('../src/sim/replay');
    const { weeklyPanelFrom, weeklyPanelView } = await tsx<{
      weeklyPanelFrom: (weeks: undefined, now: number, opts: Props) => unknown;
      weeklyPanelView: (input: unknown) => { result: { word: string; message: string } | null };
    }>('../src/ui/screens/atlasModel');
    // The sentence has one home (src/sim/replay.ts): the check answers with it, and the panel
    // shows a check's message as it is.
    const result = verifyRunReplay({ format: RUN_REPLAY_FORMAT, version: 1 });
    expect(result).toMatchObject({ status: 'claimed', refused: 'oldReplay' });
    expect(result.message).toBe(OLD_REPLAY_LINE);
    expect(OLD_REPLAY_LINE).toBe(
      'This replay is from an earlier version. It can’t be played back.',
    );
    const shown = weeklyPanelView(
      weeklyPanelFrom(undefined, Date.UTC(2026, 10, 18), {
        result: { status: result.status, message: result.message },
        canBegin: true,
      }),
    ).result;
    expect(shown).toMatchObject({ word: 'Claimed', message: OLD_REPLAY_LINE });
    // No screen text holds a second copy of it.
    expect(Object.values(EN).filter((v) => v.includes('earlier version'))).toEqual([]);
  });
});
