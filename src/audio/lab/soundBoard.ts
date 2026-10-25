/** Every sound the lab can trigger, grouped. Shared by the buttons and the offline audit. */
import type { SimEvent } from '../../sim';
import type { SynthDirector } from '../director';
import type { UiSound } from '../types';
import type { FakeWorld } from './labState';
import { IDS, ev, type HeroKey } from './labState';

export interface SoundButton {
  id: string;
  label: string;
  group: 'support' | 'phase2' | 'relic' | 'world' | 'ui';
  /** Fires the sound. Receives the director and a world to read/mutate. */
  fire(d: SynthDirector, w: FakeWorld): void;
  /** Follow-up events, `delay` seconds after the first (call then answer, hold then release). */
  then?: { delay: number; fire(d: SynthDirector, w: FakeWorld): void }[];
  /** Seconds an offline render needs (default 4). */
  length?: number;
}

/** Fires a button live: the sound now, then its follow-ups on timers. Returns a cancel(). */
export function fireSound(s: SoundButton, d: SynthDirector, w: FakeWorld): () => void {
  s.fire(d, w);
  const timers = (s.then ?? []).map((f) => window.setTimeout(() => f.fire(d, w), f.delay * 1000));
  return () => timers.forEach((t) => window.clearTimeout(t));
}

const fire = (d: SynthDirector, w: FakeWorld, ...events: SimEvent[]) => d.onEvents(events, w.state);

const tele = (
  answers: ('ward' | 'chime' | 'reel' | 'focus' | 'scatter' | 'stack' | 'move' | 'dome')[],
  kind: 'cleave' | 'beam' | 'burst' | 'donut' | 'mark' | 'link' | 'raid',
  x: number,
  windup = 1.6,
): SimEvent =>
  ev('telegraphStarted', {
    telegraph: 1,
    owner: IDS.enemyBase,
    target: IDS.kael,
    name: 'Lab',
    kind,
    shape: kind === 'mark' ? { kind: 'mark', target: IDS.kael } : { kind: 'circle', x, z: 4, r: 3 },
    start: 0,
    impact: windup,
    perfectFrom: windup - 0.35,
    damage: 300,
    pctMaxHp: 0,
    answers,
    effect: 'damage',
  });

function mend(d: SynthDirector, w: FakeWorld, hero: HeroKey, frac: number) {
  w.setHeroHp(hero, frac);
  fire(
    d,
    w,
    ev('healApplied', {
      target: IDS[hero],
      source: IDS.weaver,
      amount: 60,
      overheal: 0,
      via: 'mend',
    }),
  );
}

const ANSWER_OF = { kael: 'ward', lyra: 'empower', vexis: 'chime' } as const;
const FLOURISH_OF = { kael: 'Bulwark', lyra: 'Heartseeker', vexis: 'Resonant Starbolt' } as const;

const callStarted = (h: HeroKey, answer: 'ward' | 'empower' | 'chime'): SimEvent =>
  ev('callStarted', {
    hero: IDS[h],
    answer,
    ability: 'lab',
    flourish: FLOURISH_OF[h],
    until: 2.8,
    line: 'Lab call',
  });

/** The lab's fake clock sits at t = 0, so `until` is the hold length. */
const holdEvent = (seconds: number): SimEvent =>
  ev('fermataHold', { hero: IDS.kael, until: seconds, attack: 'Requiem', damage: 1400 });

export const SOUNDS: SoundButton[] = [
  // ── Support ────────────────────────────────────────────────────────────────────
  ...[0.1, 0.3, 0.5, 0.7, 0.95].map((f): SoundButton => ({
    id: `mend-${Math.round(f * 100)}`,
    label: `Mend ${Math.round(f * 100)}% HP`,
    group: 'support',
    fire: (d, w) => mend(d, w, 'kael', f),
  })),
  {
    id: 'ward',
    label: 'Ward',
    group: 'support',
    fire: (d, w) =>
      fire(d, w, ev('techniqueCast', { technique: 'ward', target: IDS.kael, x: 0, z: 0 })),
  },
  {
    id: 'perfect',
    label: 'Perfect Ward',
    group: 'support',
    fire: (d, w) => fire(d, w, ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 400 })),
  },
  {
    id: 'save',
    label: 'Save',
    group: 'support',
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('save', {
          target: IDS.kael,
          cause: 'ward',
          counterfactualDamage: 1140,
          attack: 'Requiem',
        }),
      ),
  },
  {
    id: 'chime-launch',
    label: 'Chime launch',
    group: 'support',
    fire: (d, w) =>
      fire(d, w, ev('chimeLaunched', { chime: 1, fromX: 0, fromZ: 0, x: 4, z: 0, landsAt: 0.25 })),
  },
  {
    id: 'chime-land',
    label: 'Chime land',
    group: 'support',
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('chimeLanded', { chime: 1, x: 4, z: 0, radius: 4, cleansed: 2, clutch: false }),
      ),
  },
  {
    id: 'chime-clutch',
    label: 'Chime (clutch)',
    group: 'support',
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('chimeLanded', { chime: 1, x: -4, z: 0, radius: 4, cleansed: 2, clutch: true }),
      ),
  },
  {
    id: 'reel',
    label: 'Reel',
    group: 'support',
    fire: (d, w) =>
      fire(d, w, ev('reeled', { target: IDS.lyra, fromX: 9, fromZ: 0, toX: 1, toZ: 0 })),
  },
  {
    id: 'glide',
    label: 'Glide',
    group: 'support',
    fire: (d, w) => fire(d, w, ev('glided', { fromX: 0, fromZ: 0, toX: 5, toZ: 1 })),
  },
  ...(['kael', 'lyra', 'vexis'] as const).map((h): SoundButton => ({
    id: `attach-${h}`,
    label: `Thread → ${h}`,
    group: 'support',
    fire: (d, w) => fire(d, w, ev('threadAttached', { hero: IDS[h], slot: 0 })),
  })),
  {
    id: 'taut',
    label: 'Thread taut',
    group: 'support',
    fire: (d, w) => fire(d, w, ev('threadTaut', { target: IDS.kael, tension: 0.8 })),
  },
  {
    id: 'snap',
    label: 'Thread snap',
    group: 'support',
    fire: (d, w) => fire(d, w, ev('threadSnapped', { target: IDS.kael })),
  },
  ...(['kael', 'lyra', 'vexis'] as const).map((h): SoundButton => ({
    id: `cue-${h}`,
    label: `Cue ${h}`,
    group: 'support',
    fire: (d, w) => fire(d, w, ev('cued', { hero: IDS[h] })),
  })),
  ...[25, 50, 75, 100].map((total): SoundButton => ({
    id: `res-${total}`,
    label: `Resonance ${total}`,
    group: 'support',
    fire: (d, w) => fire(d, w, ev('resonanceGained', { amount: 5, reason: 'lab', total })),
  })),
  {
    id: 'crescendo',
    label: 'Crescendo',
    group: 'support',
    fire: (d, w) => {
      w.setCrescendo(true);
      fire(d, w, ev('crescendoStart', { calling: 'Lab', duration: 8 }));
    },
  },
  {
    id: 'reject',
    label: 'Rejected',
    group: 'support',
    fire: (d, w) => fire(d, w, ev('techniqueRejected', { technique: 'ward', reason: 'cooldown' })),
  },
  // ── Phase 2: Call and Response, Fermata, Chords ─────────────────────────────
  ...(['kael', 'lyra', 'vexis'] as const).map((h): SoundButton => {
    const answer = ANSWER_OF[h];
    return {
      id: `call-${h}`,
      label: `Call ${h} (question only)`,
      group: 'phase2',
      length: 4,
      fire: (d, w) => fire(d, w, callStarted(h, answer)),
    };
  }),
  ...(['kael', 'lyra', 'vexis'] as const).map((h): SoundButton => {
    const answer = ANSWER_OF[h];
    return {
      id: `call-answer-${h}`,
      label: `Call → answer: ${h} (${answer})`,
      group: 'phase2',
      length: 6,
      fire: (d, w) => fire(d, w, callStarted(h, answer)),
      then: [
        {
          delay: 1.6,
          fire: (d, w) =>
            fire(
              d,
              w,
              ev('callAnswered', { hero: IDS[h], answer, flourish: FLOURISH_OF[h], after: 1.6 }),
            ),
        },
      ],
    };
  }),
  {
    id: 'call-quick',
    label: 'Call → quick answer (Lyra)',
    group: 'phase2',
    length: 5,
    fire: (d, w) => fire(d, w, callStarted('lyra', 'empower')),
    then: [
      {
        delay: 0.5,
        fire: (d, w) =>
          fire(
            d,
            w,
            ev('callAnswered', {
              hero: IDS.lyra,
              answer: 'empower',
              flourish: 'Heartseeker',
              after: 0.5,
            }),
          ),
      },
    ],
  },
  ...(['kael', 'vexis'] as const).map((h): SoundButton => ({
    id: `call-missed-${h}`,
    label: `Call → missed: ${h}`,
    group: 'phase2',
    length: 6,
    fire: (d, w) => fire(d, w, callStarted(h, ANSWER_OF[h])),
    then: [
      {
        delay: 2.5,
        fire: (d, w) => fire(d, w, ev('callEnded', { hero: IDS[h], reason: 'missed' })),
      },
    ],
  })),
  {
    id: 'call-cancelled',
    label: 'Call → cancelled (Kael)',
    group: 'phase2',
    length: 4,
    fire: (d, w) => fire(d, w, callStarted('kael', 'ward')),
    then: [
      {
        delay: 0.9,
        fire: (d, w) => fire(d, w, ev('callEnded', { hero: IDS.kael, reason: 'cancelled' })),
      },
    ],
  },
  ...(
    [
      ['kael', 'Bulwark'],
      ['lyra', 'Heartseeker'],
      ['vexis', 'Resonant Starbolt'],
    ] as const
  ).map(([h, name]): SoundButton => ({
    id: `flourish-${h}`,
    label: `Flourish: ${name}`,
    group: 'phase2',
    fire: (d, w) =>
      fire(d, w, ev('flourish', { hero: IDS[h], name, x: h === 'kael' ? -3 : 3, z: 0, radius: 6 })),
  })),
  {
    id: 'hold-saved',
    label: 'Fermata hold → saved',
    group: 'phase2',
    length: 6,
    fire: (d, w) => fire(d, w, holdEvent(2.2)),
    then: [
      {
        delay: 2.0,
        fire: (d, w) => {
          fire(d, w, ev('fermataReleased', { hero: IDS.kael, saved: true }));
          fire(
            d,
            w,
            ev('save', {
              target: IDS.kael,
              cause: 'fermata',
              counterfactualDamage: 1400,
              attack: 'Requiem',
            }),
          );
        },
      },
    ],
  },
  {
    id: 'hold-lost',
    label: 'Fermata hold → not saved',
    group: 'phase2',
    length: 6,
    fire: (d, w) => fire(d, w, holdEvent(2.2)),
    then: [
      {
        delay: 2.2,
        fire: (d, w) => fire(d, w, ev('fermataReleased', { hero: IDS.kael, saved: false })),
      },
    ],
  },
  ...[3, 4, 5, 6].map((auras): SoundButton => ({
    id: `chorus-${auras}`,
    label: `Chorus Pulse (${auras} auras)`,
    group: 'phase2',
    length: 5,
    fire: (d, w) => fire(d, w, ev('chorusPulse', { hero: IDS.kael, auras, reached: 3 })),
  })),
  {
    id: 'plant',
    label: 'Pedal Point planted',
    group: 'phase2',
    fire: (d, w) => fire(d, w, ev('fieldPlanted', { chord: 0, fromX: 0, fromZ: 0, x: -5, z: 2 })),
  },
  ...([2, 3] as const).map((focus): SoundButton => ({
    id: `beam-pour-${focus}`,
    label: `Beam pour (beam song x${focus}${focus === 3 ? ', Unison' : ''})`,
    group: 'phase2',
    fire: (d, w) => {
      w.setChords(false, focus);
      d.update(w.state, 0.016);
      fire(d, w, ev('threadAttached', { hero: IDS.lyra, slot: 1 }));
    },
  })),
  {
    id: 'save-ghost',
    label: 'Save (with ghost swell)',
    group: 'phase2',
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('save', {
          target: IDS.lyra,
          cause: 'ward',
          counterfactualDamage: 900,
          attack: 'Requiem',
        }),
      ),
  },
  // ── World ──────────────────────────────────────────────────────────────────────
  {
    id: 'wave',
    label: 'Wave start',
    group: 'world',
    fire: (d, w) => fire(d, w, ev('waveStarted', { wave: 2, waves: 3 })),
  },
  {
    id: 'decree',
    label: 'Decree',
    group: 'world',
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('decree', { boss: IDS.enemyBase, name: 'Silent Verse', text: '', answers: ['stack'] }),
      ),
  },
  {
    id: 'phase',
    label: 'Boss phase',
    group: 'world',
    fire: (d, w) => fire(d, w, ev('phaseChanged', { boss: IDS.enemyBase, phase: 2 })),
  },
  ...['swarm', 'brute', 'caster', 'sniper', 'controller', 'support', 'miniboss', 'boss'].map(
    (role): SoundButton => ({
      id: `kill-${role}`,
      label: `Kill ${role}`,
      group: 'world',
      fire: (d, w) => {
        const id = w.addEnemy(role, role === 'swarm' ? -6 : 6);
        fire(
          d,
          w,
          ev('enemyKilled', {
            enemy: id,
            defId: role,
            killer: null,
            x: role === 'swarm' ? -6 : 6,
            z: 5,
          }),
        );
      },
    }),
  ),
  {
    id: 'hit-small',
    label: 'Hero hit (small)',
    group: 'world',
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('damageTaken', {
          target: IDS.kael,
          source: null,
          amount: 60,
          absorbed: 0,
          amplified: 0,
          aura: 0,
          crit: false,
          telegraph: null,
          hit: 'hit',
        }),
      ),
  },
  {
    id: 'hit-big',
    label: 'Hero hit (big)',
    group: 'world',
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('damageTaken', {
          target: IDS.lyra,
          source: null,
          amount: 380,
          absorbed: 0,
          amplified: 0,
          aura: 0,
          crit: true,
          telegraph: 1,
          hit: 'hit',
        }),
      ),
  },
  {
    id: 'down',
    label: 'Hero downed',
    group: 'world',
    fire: (d, w) => fire(d, w, ev('allyDowned', { hero: IDS.vexis })),
  },
  {
    id: 'out',
    label: 'Hero out',
    group: 'world',
    fire: (d, w) => fire(d, w, ev('allyOut', { hero: IDS.vexis })),
  },
  {
    id: 'revived',
    label: 'Revived',
    group: 'world',
    fire: (d, w) => fire(d, w, ev('revived', { hero: IDS.vexis })),
  },
  {
    id: 'tele-ward-l',
    label: 'Tank-buster (L)',
    group: 'world',
    fire: (d, w) => fire(d, w, tele(['ward', 'dome'], 'burst', -12)),
  },
  {
    id: 'tele-mark-r',
    label: 'Mark / chime (R)',
    group: 'world',
    fire: (d, w) => fire(d, w, tele(['chime', 'ward'], 'mark', 12)),
  },
  {
    id: 'tele-area',
    label: 'Area: move (C)',
    group: 'world',
    fire: (d, w) => fire(d, w, tele(['move', 'reel'], 'burst', 0)),
  },
  {
    id: 'tele-scatter',
    label: 'Area: scatter (R)',
    group: 'world',
    fire: (d, w) => fire(d, w, tele(['scatter'], 'link', 9)),
  },
  // ── Phase 3b: relics ───────────────────────────────────────────────────────────
  ...(
    [
      ['silver_thimble', 'Silver Thimble (shield stitched)', 'lyra', false],
      ['lantern_of_the_lost', 'Lantern of the Lost (+ ally down)', 'kael', false],
      ['martyrs_veil', "Martyr's Veil (+ Save)", 'kael', false],
      ['cracked_metronome', 'Cracked Metronome (+ Perfect Ward)', 'kael', true],
      ['tuning_fork', 'Tuning Fork (+ Perfect Ward)', 'kael', true],
      ['glass_halo', 'Glass Halo (+ Perfect Ward)', 'kael', true],
      ['cantors_hymnal', "Cantor's Hymnal (fight opens)", null, false],
    ] as const
  ).map(([relic, label, hero, perfect]): SoundButton => ({
    id: `relic-${relic}`,
    label,
    group: 'relic',
    length: 4,
    fire: (d, w) => {
      if (relic === 'lantern_of_the_lost') fire(d, w, ev('allyDowned', { hero: IDS.vexis }));
      // The sim pushes the relic's event just before the Perfect Ward's.
      fire(d, w, ev('relicTriggered', { relic, hero: hero === null ? null : IDS[hero] }));
      if (perfect) fire(d, w, ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 400 }));
      if (relic === 'martyrs_veil')
        fire(
          d,
          w,
          ev('save', {
            target: IDS.kael,
            cause: 'martyr',
            counterfactualDamage: 900,
            attack: 'Requiem',
          }),
        );
    },
  })),
  {
    id: 'relic-all-perfect',
    label: 'Perfect Ward with Metronome + Fork + Halo',
    group: 'relic',
    length: 4,
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('relicTriggered', { relic: 'cracked_metronome', hero: IDS.kael }),
        ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 400 }),
        ev('relicTriggered', { relic: 'tuning_fork', hero: IDS.kael }),
        ev('relicTriggered', { relic: 'glass_halo', hero: IDS.kael }),
      ),
  },
  {
    id: 'relic-thimble-burst',
    label: 'Silver Thimble burst (20 in 1 s)',
    group: 'relic',
    length: 3,
    fire: (d, w) => {
      for (let i = 0; i < 20; i++)
        fire(d, w, ev('relicTriggered', { relic: 'silver_thimble', hero: IDS.lyra }));
    },
    then: [0.25, 0.5, 0.75, 1].map((delay) => ({
      delay,
      fire: (d: SynthDirector, w: FakeWorld) =>
        fire(d, w, ev('relicTriggered', { relic: 'silver_thimble', hero: IDS.lyra })),
    })),
  },
  {
    id: 'relic-glide-locked',
    label: 'Glide refused (Heavy Score curse)',
    group: 'relic',
    fire: (d, w) => fire(d, w, ev('techniqueRejected', { technique: 'glide', reason: 'locked' })),
  },
  {
    id: 'relic-generic-reject',
    label: 'Generic reject (compare)',
    group: 'relic',
    fire: (d, w) => fire(d, w, ev('techniqueRejected', { technique: 'glide', reason: 'cooldown' })),
  },
  // ── UI ─────────────────────────────────────────────────────────────────────────
  ...(
    [
      'hover',
      'click',
      'confirm',
      'back',
      'pick',
      'node',
      'error',
      'reward',
      'wheelOpen',
      'wheelPick',
      'reveal',
      'rankUp',
      'unlock',
      'buy',
      'cantAfford',
      'forge',
      'eventOpen',
      'gambleWin',
      'gambleLose',
      'relicReveal',
      'relicPick',
      'curseLifted',
      'aether',
    ] as UiSound[]
  ).map((s): SoundButton => ({
    id: `ui-${s}`,
    label: s,
    group: 'ui',
    length:
      s === 'reveal' ? 5 : s === 'rankUp' || s === 'forge' || s === 'eventOpen' ? 3 : undefined,
    fire: (d) => d.playUi(s),
  })),
];
