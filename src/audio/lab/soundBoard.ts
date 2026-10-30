/** Every sound the lab can trigger, grouped. Shared by the buttons and the offline audit. */
import { CONTENT } from '../../content';
import type { SimEvent } from '../../sim';
import type { SynthDirector } from '../director';
import type { UiSound, UiSoundDetail } from '../types';
import { dissonanceMax } from '../ui';
import type { FakeTelegraph, FakeWorld } from './labState';
import { IDS, ev, nodeWith, type HeroKey } from './labState';

export interface SoundButton {
  id: string;
  label: string;
  group:
    | 'support'
    | 'phase2'
    | 'relic'
    | 'calling'
    | 'martyr'
    | 'chrono'
    | 'astrolabe'
    | 'bonds'
    | 'variants'
    | 'world'
    | 'ui';
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

/** A hero's hit on an enemy with `share` of it Radiance's (amount 100, so radiance = share x). */
function radiantHit(w: FakeWorld, hero: HeroKey, share: number, enemy = IDS.enemyBase): SimEvent {
  if (!w.entities.has(enemy)) w.setEnemies(3);
  return ev('damageTaken', {
    target: enemy,
    source: IDS[hero],
    amount: 100,
    absorbed: 0,
    amplified: share * 100,
    aura: 0,
    radiance: share * 100,
    eclipse: 0,
    crit: false,
    telegraph: null,
    hit: 'hit',
  });
}

/** One twentieth of a burst: five radiant hits spread over the three heroes. */
function radiantBurst(d: SynthDirector, w: FakeWorld, step: number): void {
  const heroes = ['kael', 'lyra', 'vexis'] as const;
  for (let i = 0; i < 5; i++)
    fire(d, w, radiantHit(w, heroes[(step + i) % 3] as HeroKey, 0.12 + 0.02 * (i % 3)));
}

const borneEv = (
  hero: HeroKey,
  amount: number,
  via: 'bear' | 'shared' | 'vow' = 'bear',
): SimEvent => ev('borne', { hero: IDS[hero], amount, via });

/** One tenth of a borne burst: ten events a 10 ms apart over the three heroes (100 in a second). */
function borneBurst(d: SynthDirector, w: FakeWorld, step: number): void {
  const heroes = ['kael', 'lyra', 'vexis'] as const;
  for (let i = 0; i < 10; i++)
    fire(d, w, borneEv(heroes[(step + i) % 3] as HeroKey, 30 + 10 * (i % 3)));
}

function shieldOn(hero: HeroKey, amount: number): SimEvent {
  return ev('shieldApplied', { target: IDS[hero], shield: 'overshield', amount, fromWeaver: true });
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

// ── Phase 4e helpers ───────────────────────────────────────────────────────────────

/** A talent (or alternate Solo) acting, as the sim announces it: `talentFired`. */
function talentEv(talent: string, hero: HeroKey, x: number, z: number, target: number | null) {
  return ev('talentFired', { hero: IDS[hero], talent, x, z, target });
}

/** Where a hero stands in the lab world. */
function heroAt(w: FakeWorld, hero: HeroKey): { x: number; z: number } {
  const e = w.state.entities.get(IDS[hero]);
  return { x: e?.x ?? 0, z: e?.z ?? -3 };
}

/** One of each talent's `talentFired` as the sim sends it, with the lab world set for it. */
function talentAct(d: SynthDirector, w: FakeWorld, talent: string): void {
  if (!w.entities.has(IDS.enemyBase)) w.setEnemies(3);
  const k = heroAt(w, 'kael');
  const l = heroAt(w, 'lyra');
  const v = heroAt(w, 'vexis');
  const foe = IDS.enemyBase;
  switch (talent) {
    case 'steady_vanguard':
    case 'vanguards_roar':
      fire(d, w, talentEv(talent, 'kael', 6, 8, foe));
      break;
    case 'riposte_bash':
      fire(d, w, talentEv(talent, 'kael', k.x + 1.5, k.z - 1, foe));
      break;
    case 'unbreakable':
    case 'shieldbearer':
      fire(d, w, talentEv(talent, 'kael', k.x, k.z, null));
      break;
    case 'wind_step':
      fire(d, w, talentEv(talent, 'lyra', l.x, l.z, null));
      break;
    case 'hawks_vigil':
      fire(d, w, talentEv(talent, 'lyra', -6, 6, foe));
      break;
    case 'starthread':
      fire(d, w, talentEv(talent, 'vexis', k.x, k.z, foe));
      break;
    case 'event_horizon':
      fire(d, w, talentEv(talent, 'vexis', 2, 3, null));
      break;
    case 'supernova':
      fire(d, w, talentEv(talent, 'vexis', 4, 7, foe));
      break;
    case 'constellation':
      fire(d, w, talentEv(talent, 'vexis', k.x, k.z, IDS.kael));
      break;
    case 'arcane_ward':
      fire(d, w, talentEv(talent, 'vexis', v.x + 4, v.z + 3, foe));
      break;
    case 'oathkeeper':
      fire(d, w, talentEv(talent, 'kael', l.x, l.z, IDS.lyra));
      break;
    case 'celestial_sphere':
      fire(d, w, talentEv(talent, 'vexis', l.x, l.z, IDS.lyra));
      break;
  }
}

/** Every talent and alternate Solo the sim announces (`talentFired`). */
const TALENTS_FIRED = [
  ['steady_vanguard', 'Steady Vanguard: Kael charges your Focus (a firm horn, A2 to D3)'],
  ['vanguards_roar', 'Vanguard’s Roar: everything near his quarry turns on him (brass bellow)'],
  ['riposte_bash', 'Riposte Bash: a Perfect Ward on him bashes the attacker (a counter-clang)'],
  ['unbreakable', 'Unbreakable: he stands through a downing blow (deep bell, horn fifth)'],
  ['shieldbearer', 'Shieldbearer: Aegis Wall shields the heroes beside him (brass, a glint each)'],
  ['wind_step', 'Wind Step: Lyra steps out of an attack (a gust, a flute E5 to A5)'],
  ['hawks_vigil', 'Hawk’s Vigil: a shot at an attacker (a tight pluck; frequent)'],
  ['starthread', 'Starthread: Starbolt along the Thread (glass B5 then F6)'],
  ['event_horizon', 'Event Horizon: the Well drags them into your field (sucked down, F2 knock)'],
  ['supernova', 'Supernova: Starfall ends in a nova (gather, then the burst)'],
  ['constellation', 'Constellation: a Cue leaves a star (a twinkle, D6 A6 E7)'],
  ['arcane_ward', 'Arcane Ward: Vexis blinks toward you (glass drawn in, a ping on F6)'],
  ['oathkeeper', 'Oathkeeper: a hit on Lyra lands on Kael (a muted knock; frequent)'],
  ['celestial_sphere', 'Celestial Sphere: it swallows a hit (a glass pop; frequent)'],
] as const;

/** Bonds UI sounds for each hero, and the shared voicing (no hero). */
const BOND_HEROES = ['kael', 'lyra', 'vexis'] as const;
/** A Bond rank that opens nothing, and one that opens a talent tier (both from the content). */
const PLAIN_RANK =
  [2, 4, 5, 7, 8, 1].find(
    (r) => !CONTENT.bondRules.talentRanks.includes(r) && r !== CONTENT.bondRules.soloRank,
  ) ?? 1;
const TALENT_RANK = CONTENT.bondRules.talentRanks[1] ?? CONTENT.bondRules.talentRanks[0] ?? 1;

/** The lab world back as it was (no alternate Solo, no sphere, the heroes in their places). */
function bondsRestore(w: FakeWorld): void {
  for (const h of BOND_HEROES) {
    w.setAltSolo(h, null);
    w.setSphere(h, 0);
  }
  w.moveHero('kael', -3, -3);
  w.moveHero('lyra', 0, -3);
  w.moveHero('vexis', 3, -3);
}

// ── Phase 4f helpers ───────────────────────────────────────────────────────────────

type Slot = 'ward' | 'chime' | 'reel' | 'glide';
/** A variant's number (content), so the lab follows the lead's tuning. */
const variantValue = (id: string, key: string): number =>
  CONTENT.techniqueVariants.find((v) => v.id === id)?.values[key] ?? 0;
const slotOf = (id: string): Slot =>
  CONTENT.techniqueVariants.find((v) => v.id === id)?.slot ?? 'ward';
/** Every variant, in the content's order, with what its button says. */
const VARIANT_BUTTONS = [
  [
    'chorale',
    'Chorale: a burst of barriers on every hero near (glass sung by a choir, a voice each)',
  ],
  ['aegis_link', 'Aegis Link: two heroes linked (two plucks a fifth apart, humming as one)'],
  ['purge', 'Purge cast: the Chime launched, what it will cleanse drawn up into it'],
  ['absolve', 'Absolve cast: the Chime launched on a warm handbell (its guard as it lands)'],
  ['swap', 'Swap: you and the hero trade places (cords crossing, fifth then root)'],
  ['anchor', 'Anchor: the hero held fast (a deep drop, a low bell, a chain)'],
  ['phase_step', 'Phase Step: a blink of 8 m and your decoy (folding glass, its shimmer)'],
  ['skate', 'Skate: a dash on a charge (a quick breath, a blade, a pluck)'],
] as const;

/** The lab world's techniques back to their defaults. */
function variantsRestore(w: FakeWorld): void {
  for (const s of ['ward', 'chime', 'reel', 'glide'] as const) w.setVariant(s, null);
}

/** A variant's cast as the sim reports it: the cast and its own events (a Chime's land later). */
function variantCast(w: FakeWorld, id: string): SimEvent[] {
  const slot = slotOf(id);
  w.setVariant(slot, id);
  const l = { x: 0, z: -3 };
  const cast = (technique: Slot, target: number | null, x: number, z: number) =>
    ev('techniqueCast', { technique, target, x, z, variant: id });
  switch (id) {
    case 'chorale':
      return [
        ...[IDS.kael, IDS.lyra, IDS.vexis].map((target) =>
          ev('shieldApplied', { target, shield: 'ward', amount: 280, fromWeaver: true }),
        ),
        cast('ward', IDS.lyra, l.x, l.z),
        ev('chorale', {
          x: l.x,
          z: l.z,
          radius: variantValue('chorale', 'radius'),
          targets: [IDS.kael, IDS.lyra, IDS.vexis],
        }),
      ];
    case 'aegis_link':
      return [
        cast('ward', IDS.kael, -3, -3),
        ev('linked', {
          a: IDS.kael,
          b: IDS.lyra,
          weaver: false,
          until: w.time + variantValue('aegis_link', 'seconds'),
        }),
      ];
    case 'purge':
    case 'absolve':
      return [
        cast('chime', null, l.x, l.z),
        ev('chimeLaunched', { chime: 1, fromX: 0, fromZ: 0, x: l.x, z: l.z, landsAt: 0.25 }),
      ];
    case 'swap':
      return [
        cast('reel', IDS.lyra, l.x, l.z),
        ev('shieldApplied', { target: IDS.weaver, shield: 'ward', amount: 180, fromWeaver: false }),
        ev('swapped', { hero: IDS.lyra, fromX: l.x, fromZ: l.z, toX: 0, toZ: 0 }),
      ];
    case 'anchor':
      return [
        cast('reel', IDS.kael, -3, -3),
        ev('statusApplied', {
          target: IDS.kael,
          status: 'anchored',
          duration: variantValue('anchor', 'seconds'),
        }),
      ];
    case 'phase_step': {
      const m = variantValue('phase_step', 'metres');
      return [
        cast('glide', null, m, 0),
        ev('phaseStep', {
          fromX: 0,
          fromZ: 0,
          toX: m,
          toZ: 0,
          until: w.time + variantValue('phase_step', 'seconds'),
        }),
      ];
    }
    case 'skate': {
      const m = variantValue('skate', 'metres');
      w.setGlideCharges(w.weaverData().glideCharges - 1);
      return [cast('glide', null, m, 0), ev('glided', { fromX: 0, fromZ: 0, toX: m, toZ: 0 })];
    }
    default:
      return [];
  }
}

/** A Chime variant lands (its flight later): Purge bursts at three enemies; Absolve guards. */
function variantLand(w: FakeWorld, id: string): SimEvent[] {
  const landed = ev('chimeLanded', {
    chime: 1,
    x: 0,
    z: -3,
    radius: 4,
    cleansed: 1,
    clutch: false,
  });
  if (id === 'purge') {
    if (!w.entities.has(IDS.enemyBase)) w.setEnemies(3);
    return [
      ev('cleansed', { target: IDS.lyra, removed: 1, clutch: false }),
      ev('purged', {
        hero: IDS.lyra,
        x: 0,
        z: -3,
        radius: variantValue('purge', 'radius'),
        hit: [IDS.enemyBase, IDS.enemyBase + 1, IDS.enemyBase + 2],
      }),
      landed,
    ];
  }
  if (id === 'absolve')
    return [
      ...[IDS.kael, IDS.lyra].map((target) =>
        ev('statusApplied', {
          target,
          status: 'absolved',
          duration: variantValue('absolve', 'seconds'),
        }),
      ),
      landed,
    ];
  return [];
}

/** A variant's whole cast: its events now, a Chime's landing 0.25 s on. */
function variantButton(id: string, label: string, after = 1.2): SoundButton {
  const chime = slotOf(id) === 'chime';
  return {
    id: `variant-${id}`,
    label,
    group: 'variants',
    length: id === 'phase_step' ? 3.5 : 2.5,
    fire: (d, w) => fire(d, w, ...variantCast(w, id)),
    then: [
      ...(chime
        ? [
            {
              delay: 0.25,
              fire: (d: SynthDirector, w: FakeWorld) => fire(d, w, ...variantLand(w, id)),
            },
          ]
        : []),
      { delay: after, fire: (_d: SynthDirector, w: FakeWorld) => variantsRestore(w) },
    ],
  };
}

/** A hit shared along the Link: the hero struck, and the other's share (one source). */
function sharedHit(): SimEvent[] {
  const hit = (target: number, amount: number) =>
    ev('damageTaken', {
      target,
      source: IDS.enemyBase,
      amount,
      absorbed: 0,
      amplified: 0,
      aura: 0,
      radiance: 0,
      eclipse: 0,
      crit: false,
      telegraph: null,
      hit: 'hit',
    });
  return [hit(IDS.lyra, 60), hit(IDS.kael, 60)];
}

// ── Phase 4d helpers ───────────────────────────────────────────────────────────────

/** Restless Dead: an enemy of `role` at x has just risen; its `enemyRose`, as the sim sends it. */
function rose(w: FakeWorld, role: string, defId: string, x: number): SimEvent {
  const id = w.addRisen(role, x);
  return ev('enemyRose', { enemy: id, defId, x, z: 5, hp: 30 });
}

/** A Dissonance toggle in Prep: the run's total after it, and before it. */
const toggle = (total: number, from: number) => (d: SynthDirector) =>
  d.playUi('dissonanceToggle', null, { total, from } satisfies UiSoundDetail);

// ── Phase 3e helpers ───────────────────────────────────────────────────────────────
type Follow = { delay: number; fire(d: SynthDirector, w: FakeWorld): void };

/**
 * Follow-ups every `step` seconds from `from` to `to`: the frames between (the sim clock moving
 * on, and the director's per-frame update, which an offline render has no loop for).
 */
function frames(
  from: number,
  to: number,
  each: (d: SynthDirector, w: FakeWorld) => void = tickFrame,
  step = 0.1,
): Follow[] {
  const out: Follow[] = [];
  for (let i = 0; from + i * step <= to + 1e-9; i++)
    out.push({ delay: Math.round((from + i * step) * 1000) / 1000, fire: each });
  return out;
}

/** One lab frame of 0.1 s: the clock moves (telegraphs wait in Stasis) and the director looks. */
function tickFrame(d: SynthDirector, w: FakeWorld): void {
  w.advance(0.1);
  d.update(w.state, 0.1);
}

/** A state telegraph's start event, with the same id and times. */
function startedEv(t: FakeTelegraph): SimEvent {
  return ev('telegraphStarted', {
    telegraph: t.id,
    owner: t.owner,
    target: t.target,
    name: t.name,
    kind: t.kind,
    shape: t.shape,
    start: t.start,
    impact: t.impact,
    perfectFrom: t.perfectFrom,
    damage: t.damage,
    pctMaxHp: t.pctMaxHp,
    answers: t.answers,
    effect: t.effect,
  });
}

/** Stasis comes up as the sim brings it: the field's flag and the Crescendo clock, then the event. */
function stasisOn(d: SynthDirector, w: FakeWorld, seconds: number): void {
  w.setStasis(true, seconds);
  fire(d, w, ev('crescendoStart', { calling: 'Stasis', duration: seconds }));
}

function stasisOff(d: SynthDirector, w: FakeWorld): void {
  w.setStasis(false);
  fire(d, w, ev('crescendoEnd', {}));
}

/** A Stasis of `seconds`, its frames, and its end. */
function stasisButton(id: string, label: string, seconds: number): SoundButton {
  return {
    id,
    label,
    group: 'chrono',
    length: seconds + 3,
    fire: (d, w) => stasisOn(d, w, seconds),
    then: [
      ...frames(0.1, seconds),
      { delay: Math.round((seconds + 0.05) * 100) / 100, fire: stasisOff },
    ],
  };
}

/**
 * A Rewind as the sim reports it: the life it gave back, the cast in Reel's slot, then where the
 * hero went (and, for a revive, the `revived` and the save before them).
 */
function rewindEvents(
  hero: HeroKey,
  from: [number, number],
  to: [number, number],
  restored: number,
  revived = false,
): SimEvent[] {
  const target = IDS[hero];
  const out: SimEvent[] = [];
  if (revived) out.push(ev('revived', { hero: target }));
  if (restored > 0)
    out.push(
      ev('healApplied', {
        target,
        source: IDS.weaver,
        amount: restored,
        overheal: 0,
        via: 'rewind',
      }),
    );
  if (revived)
    out.push(
      ev('save', { target, cause: 'rewind', counterfactualDamage: restored, attack: 'a fall' }),
      ev('timeScaleChanged', { scale: 0.35, duration: 15, reason: 'save' }),
    );
  out.push(
    ev('techniqueCast', { technique: 'rewind', target, x: to[0], z: to[1] }),
    ev('rewound', {
      target,
      fromX: from[0],
      fromZ: from[1],
      toX: to[0],
      toZ: to[1],
      restored,
      revived,
    }),
  );
  return out;
}

/** One tenth of a Foresight burst: ten enemies foresee an attack each (100 in a second). */
function foresightBurst(d: SynthDirector, w: FakeWorld, step: number): void {
  const heroes = [IDS.kael, IDS.lyra, IDS.vexis];
  for (let i = 0; i < 10; i++)
    fire(
      d,
      w,
      ev('foreseen', {
        enemy: IDS.enemyBase + i,
        attack: 'lab',
        name: 'Lab',
        target: heroes[(step + i) % 3] as number,
        at: w.time + 1,
      }),
    );
}

// ── Phase 4 helpers ────────────────────────────────────────────────────────────────

/** A value of the content's node with this effect (so the lab follows the lead's tuning). */
const nodeValue = (effect: string, key: string): number =>
  CONTENT.astrolabe.nodes.find((n) => n.effect === effect)?.values[key] ?? 0;

/** The fake fight carries a tree of the nodes with these effects. */
const tree = (w: FakeWorld, ...effects: string[]) => w.setAstrolabe(effects.map(nodeWith));

/** The last follow-up of a Phase 4 button: the lab world as it was. */
const restore = (delay: number): Follow => ({
  delay,
  fire: (_d, w) => {
    w.setAstrolabe([]);
    w.setWard('kael', 0);
    w.setWeaverHp(1);
    for (const h of ['kael', 'lyra', 'vexis'] as const) w.setAfterglow(h, 0);
  },
});

/** A Ward on a hero of 1000 life, as the content builds it (before the tree's multipliers). */
const wardMax = () =>
  CONTENT.techniques.ward.barrierPct * 1000 + CONTENT.techniques.ward.barrierFlat;

/**
 * Shatterproof Halo: Kael's Ward takes a hit half again its barrier and holds, having lost the
 * most it can (the node's cap), as the state reports it after the hit.
 */
function haloHit(d: SynthDirector, w: FakeWorld): void {
  const max = wardMax();
  const cap = nodeValue('shatterproof_halo', 'cap') / 100;
  w.setWard('kael', max * (1 - cap), max);
  fire(
    d,
    w,
    ev('damageTaken', {
      target: IDS.kael,
      source: IDS.enemyBase,
      amount: 0,
      absorbed: max * 1.5,
      amplified: 0,
      aura: 0,
      radiance: 0,
      eclipse: 0,
      crit: false,
      telegraph: 1,
      hit: 'hit',
    }),
  );
}

/** A technique cast as the sim reports it: the cast, and its own event (Chime and Reel). */
function castEvents(technique: 'ward' | 'chime' | 'reel'): SimEvent[] {
  if (technique === 'ward')
    return [ev('techniqueCast', { technique, target: IDS.kael, x: -3, z: -3 })];
  if (technique === 'chime')
    return [
      ev('techniqueCast', { technique, target: null, x: 4, z: 0 }),
      ev('chimeLaunched', { chime: 1, fromX: 0, fromZ: 0, x: 4, z: 0, landsAt: 0.25 }),
    ];
  return [
    ev('techniqueCast', { technique, target: IDS.lyra, x: 9, z: 0 }),
    ev('reeled', { target: IDS.lyra, fromX: 9, fromZ: 0, toX: 1, toZ: 0 }),
  ];
}

/** One twentieth of the Phase 4 burst: every keystone's sound asked for at once. */
function astroBurst(d: SynthDirector, w: FakeWorld, step: number): void {
  const heroes = [IDS.kael, IDS.lyra, IDS.vexis];
  const grace = nodeValue('overflowing_grace', 'cap') * 10;
  fire(
    d,
    w,
    ...heroes.map((hero) => ev('graceShield', { hero, amount: grace })),
    ...castEvents((['ward', 'chime', 'reel'] as const)[step % 3]),
    ev('techniqueRejected', { technique: 'ward', reason: 'life' }),
    ev('revived', { hero: heroes[step % 3] as number }),
  );
  haloHit(d, w);
  w.setAfterglow(
    (['kael', 'lyra', 'vexis'] as const)[(step + 1) % 3],
    nodeValue('afterglow', 'seconds'),
  );
  fire(
    d,
    w,
    ev('threadAttached', { hero: heroes[step % 3] as number, slot: (step % 3) as 0 | 1 | 2 }),
  );
}

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
  // ── Phase 4d: Restless Dead ──
  {
    id: 'rise-swarm',
    label: 'Restless Dead: a chorister rises again (hollow, wrong)',
    group: 'world',
    length: 2,
    fire: (d, w) => fire(d, w, rose(w, 'swarm', 'hollow_chorister', -6)),
  },
  {
    id: 'rise-brute',
    label: 'Restless Dead: a brute rises again (an octave down)',
    group: 'world',
    length: 2,
    fire: (d, w) => fire(d, w, rose(w, 'brute', 'bell_brute', 6)),
  },
  {
    id: 'rise-then-kill',
    label: 'Restless Dead: a chorister rises, then dies for good 1.5 s later',
    group: 'world',
    length: 3,
    fire: (d, w) => fire(d, w, rose(w, 'swarm', 'hollow_chorister', -6)),
    then: [
      {
        delay: 1.5,
        fire: (d, w) => {
          const id = w.addEnemy('swarm', -6);
          fire(
            d,
            w,
            ev('enemyKilled', { enemy: id, defId: 'hollow_chorister', killer: null, x: -6, z: 5 }),
          );
        },
      },
    ],
  },
  {
    id: 'rise-burst',
    label: 'Restless Dead: eight rise from one blow, four more over a second (the gate holds)',
    group: 'world',
    length: 3,
    fire: (d, w) =>
      fire(
        d,
        w,
        ...Array.from({ length: 8 }, (_, i) => rose(w, 'swarm', 'hollow_chorister', -8 + i * 2)),
      ),
    then: Array.from({ length: 4 }, (_, i) => ({
      delay: Math.round((i + 1) * 0.25 * 1000) / 1000,
      fire: (d: SynthDirector, w: FakeWorld) =>
        fire(d, w, rose(w, 'swarm', 'hollow_chorister', 4 - i * 3)),
    })),
  },
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
          radiance: 0,
          eclipse: 0,
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
          radiance: 0,
          eclipse: 0,
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
  {
    id: 'tele-blind',
    label: 'Blind Score: the tank-buster (a Ward) winds up as the swell, not its brass',
    group: 'world',
    fire: (d, w) => {
      w.setBlindScore(true);
      fire(d, w, tele(['ward', 'dome'], 'burst', -12));
      w.setBlindScore(false);
    },
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
  // ── Phase 3c: the Luminary ─────────────────────────────────────────────────────
  {
    id: 'calling-radiant-hit',
    label: 'Radiant hit (single, Lyra)',
    group: 'calling',
    length: 3,
    fire: (d, w) => fire(d, w, radiantHit(w, 'lyra', 0.12)),
  },
  {
    id: 'calling-radiant-big',
    label: 'Radiant hit (big share, Vexis)',
    group: 'calling',
    length: 3,
    fire: (d, w) => fire(d, w, radiantHit(w, 'vexis', 0.35)),
  },
  {
    id: 'calling-radiant-burst',
    label: 'Radiant burst (100 hits in 1 s)',
    group: 'calling',
    length: 4,
    fire: (d, w) => radiantBurst(d, w, 0),
    then: Array.from({ length: 20 }, (_, i) => ({
      delay: (i + 1) * 0.05,
      fire: (d: SynthDirector, w: FakeWorld) => radiantBurst(d, w, i + 1),
    })),
  },
  {
    id: 'calling-radiant-sunrise',
    label: 'Radiant burst in Sunrise',
    group: 'calling',
    length: 4,
    fire: (d, w) => {
      w.setCalling('luminary');
      w.setCrescendo(true);
      radiantBurst(d, w, 0);
    },
    then: Array.from({ length: 20 }, (_, i) => ({
      delay: (i + 1) * 0.05,
      fire: (d: SynthDirector, w: FakeWorld) => radiantBurst(d, w, i + 1),
    })),
  },
  {
    id: 'calling-dawnward',
    label: 'Dawnward (Kael steps into the light)',
    group: 'calling',
    length: 3,
    fire: (d, w) =>
      fire(d, w, shieldOn('kael', 60), ev('dawnward', { hero: IDS.kael, amount: 60 })),
  },
  {
    id: 'calling-dawnward-party',
    label: 'Dawnward (all three, 0.15 s apart)',
    group: 'calling',
    length: 3,
    fire: (d, w) =>
      fire(d, w, shieldOn('kael', 60), ev('dawnward', { hero: IDS.kael, amount: 60 })),
    then: (['lyra', 'vexis'] as const).map((h, i) => ({
      delay: 0.15 * (i + 1),
      fire: (d: SynthDirector, w: FakeWorld) =>
        fire(d, w, shieldOn(h, 60), ev('dawnward', { hero: IDS[h], amount: 60 })),
    })),
  },
  {
    id: 'calling-sunrise-plain',
    label: 'Sunrise (no Calling, compare)',
    group: 'calling',
    length: 6,
    fire: (d, w) => {
      w.setCalling(null);
      w.setCrescendo(true);
      fire(d, w, ev('crescendoStart', { calling: 'Lab', duration: 8 }));
    },
  },
  {
    id: 'calling-sunrise-luminary',
    label: "The Luminary's Sunrise",
    group: 'calling',
    length: 6,
    fire: (d, w) => {
      w.setCalling('luminary');
      w.setCrescendo(true);
      fire(d, w, ev('crescendoStart', { calling: 'Lab', duration: 8 }));
    },
  },
  {
    id: 'calling-sunrise-eclipse',
    label: "The Luminary's Sunrise with Eclipse",
    group: 'calling',
    length: 6,
    fire: (d, w) => {
      w.setCalling('luminary', ['haloed', 'dawnward', 'third_voice', 'eclipse']);
      w.setCrescendo(true);
      fire(d, w, ev('crescendoStart', { calling: 'Lab', duration: 8 }));
    },
  },
  // ── Phase 3d: the Martyr ───────────────────────────────────────────────────────
  {
    id: 'martyr-bear-on',
    label: 'Bear on (she takes up the burden)',
    group: 'martyr',
    length: 3,
    fire: (d, w) => {
      w.setCalling('martyr');
      fire(d, w, ev('threadModeChanged', { mode: 'bear' }));
    },
  },
  {
    id: 'martyr-bear-off',
    label: 'Bear off (back to Mend)',
    group: 'martyr',
    length: 4.5,
    fire: (d, w) => {
      w.setCalling('martyr');
      fire(d, w, ev('threadModeChanged', { mode: 'bear' }));
    },
    then: [
      {
        delay: 2.2,
        fire: (d, w) => fire(d, w, ev('threadModeChanged', { mode: 'mend' })),
      },
    ],
  },
  {
    id: 'martyr-mode-mend',
    label: 'Mend / Empower toggle (compare)',
    group: 'martyr',
    length: 2,
    fire: (d, w) => fire(d, w, ev('threadModeChanged', { mode: 'empower' })),
  },
  {
    id: 'martyr-borne',
    label: 'Borne (one hit on Kael)',
    group: 'martyr',
    length: 2,
    fire: (d, w) => fire(d, w, borneEv('kael', 60)),
  },
  {
    id: 'martyr-borne-big',
    label: 'Borne (a big one on Vexis)',
    group: 'martyr',
    length: 2,
    fire: (d, w) => fire(d, w, borneEv('vexis', 140)),
  },
  {
    id: 'martyr-borne-burst',
    label: 'Borne burst (100 in 1 s)',
    group: 'martyr',
    length: 4,
    fire: (d, w) => borneBurst(d, w, 0),
    then: Array.from({ length: 10 }, (_, i) => ({
      delay: (i + 1) * 0.1,
      fire: (d: SynthDirector, w: FakeWorld) => borneBurst(d, w, i + 1),
    })),
  },
  {
    id: 'martyr-borne-shared',
    label: 'Borne, Shared Wounds (quieter)',
    group: 'martyr',
    length: 2,
    fire: (d, w) => fire(d, w, borneEv('lyra', 60, 'shared')),
  },
  {
    id: 'martyr-vow',
    label: "Martyr's Vow",
    group: 'martyr',
    length: 7,
    fire: (d, w) => {
      w.setCalling('martyr');
      w.setVow(true);
      fire(d, w, ev('crescendoStart', { calling: 'Martyr’s Vow', duration: 5 }));
    },
    then: [
      {
        delay: 5,
        fire: (d, w) => {
          w.setVow(false);
          fire(d, w, ev('crescendoEnd', {}));
        },
      },
    ],
  },
  {
    id: 'martyr-vow-held',
    label: 'Vow holds Kael at 1 life',
    group: 'martyr',
    length: 4,
    fire: (d, w) => {
      w.setCalling('martyr');
      w.setVow(true);
      w.setHeroHp('kael', 0);
      fire(
        d,
        w,
        ev('save', {
          target: IDS.kael,
          cause: 'vow',
          counterfactualDamage: 700,
          attack: 'Requiem',
        }),
      );
    },
  },
  {
    id: 'martyr-bear-save',
    label: 'Bear makes a hit survivable',
    group: 'martyr',
    length: 4,
    fire: (d, w) => {
      w.setCalling('martyr');
      fire(
        d,
        w,
        ev('save', {
          target: IDS.lyra,
          cause: 'bear',
          counterfactualDamage: 500,
          attack: 'Requiem',
        }),
      );
    },
  },
  {
    id: 'martyr-save-compare',
    label: 'Ordinary save (compare)',
    group: 'martyr',
    length: 4,
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('save', {
          target: IDS.kael,
          cause: 'ward',
          counterfactualDamage: 500,
          attack: 'Requiem',
        }),
      ),
  },
  {
    id: 'martyr-undying',
    label: 'Undying Devotion',
    group: 'martyr',
    length: 6,
    fire: (d, w) => {
      w.setCalling('martyr');
      fire(d, w, ev('undying', {}));
    },
  },
  {
    id: 'martyr-self-heal',
    label: 'Self heal (Blood Font, nearly silent)',
    group: 'martyr',
    length: 3,
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('healApplied', {
          target: IDS.weaver,
          source: IDS.weaver,
          amount: 8,
          overheal: 0,
          via: 'self',
        }),
      ),
  },
  // ── Phase 3e: the Chronomancer ─────────────────────────────────────────────────
  {
    id: 'chrono-rewind',
    label: 'Rewind (Kael, a short step back)',
    group: 'chrono',
    length: 3,
    fire: (d, w) => fire(d, w, ...rewindEvents('kael', [-3, -3], [-1, -5], 80)),
  },
  {
    id: 'chrono-rewind-far',
    label: 'Rewind (Vexis, a long way, much life back)',
    group: 'chrono',
    length: 3,
    fire: (d, w) => fire(d, w, ...rewindEvents('vexis', [9, 2], [2, -3], 420)),
  },
  {
    id: 'chrono-rewind-revive',
    label: 'Rewind stands Lyra back up (then the save)',
    group: 'chrono',
    length: 5,
    fire: (d, w) => fire(d, w, ...rewindEvents('lyra', [6, 4], [1, -2], 380, true)),
  },
  {
    id: 'chrono-reel-compare',
    label: 'Reel (compare)',
    group: 'chrono',
    fire: (d, w) =>
      fire(d, w, ev('reeled', { target: IDS.lyra, fromX: 9, fromZ: 0, toX: 1, toZ: 0 })),
  },
  {
    id: 'chrono-revive-compare',
    label: 'Ordinary revive and save (compare)',
    group: 'chrono',
    length: 4,
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('revived', { hero: IDS.lyra }),
        ev('save', { target: IDS.lyra, cause: 'ward', counterfactualDamage: 380, attack: 'Lab' }),
      ),
  },
  {
    id: 'chrono-rewind-reject',
    label: 'Rewind refused (down too long)',
    group: 'chrono',
    fire: (d, w) => fire(d, w, ev('techniqueRejected', { technique: 'rewind', reason: 'target' })),
  },
  {
    id: 'chrono-rewind-spam',
    label: 'Rewind spam (12 in 1 s, as Stasis allows)',
    group: 'chrono',
    length: 3,
    fire: (d, w) => fire(d, w, ...rewindEvents('kael', [-3, -3], [-1, -5], 40)),
    then: Array.from({ length: 11 }, (_, i) => ({
      delay: Math.round((i + 1) * 0.085 * 1000) / 1000,
      fire: (d: SynthDirector, w: FakeWorld) =>
        fire(
          d,
          w,
          ...rewindEvents((['lyra', 'vexis', 'kael'] as const)[i % 3], [2, 1], [0, -3], 40),
        ),
    })),
  },
  stasisButton('chrono-stasis', 'Stasis (3 s: time stops, then resumes)', 3),
  stasisButton('chrono-stasis-eternal', 'Stasis with Eternal Moment (5 s)', 5),
  {
    id: 'chrono-stasis-windups',
    label: 'Stasis over two windups (they freeze, then resume and land late)',
    group: 'chrono',
    length: 7,
    fire: (d, w) => {
      const a = w.addTelegraph(901, 2.4, { x: -8 });
      const b = w.addTelegraph(902, 2.0, {
        kind: 'mark',
        answers: ['chime', 'ward'],
        target: IDS.lyra,
      });
      fire(d, w, startedEv(a), startedEv(b));
    },
    then: [
      ...frames(0.1, 0.8),
      { delay: 0.9, fire: (d, w) => stasisOn(d, w, 3) },
      ...frames(1.0, 3.9),
      { delay: 3.95, fire: stasisOff },
      ...frames(4.0, 5.6),
      {
        delay: 5.7,
        fire: (_d, w) => {
          w.removeTelegraph(901);
          w.removeTelegraph(902);
        },
      },
    ],
  },
  {
    id: 'chrono-sunrise-compare',
    label: 'Sunrise (no Calling, compare)',
    group: 'chrono',
    length: 7,
    fire: (d, w) => {
      w.setCalling(null);
      w.setCrescendo(true);
      fire(d, w, ev('crescendoStart', { calling: 'Sunrise', duration: 8 }));
    },
    then: [
      {
        delay: 5,
        fire: (d, w) => {
          w.setCrescendo(false);
          fire(d, w, ev('crescendoEnd', {}));
        },
      },
    ],
  },
  {
    id: 'chrono-vow-compare',
    label: "Martyr's Vow (compare)",
    group: 'chrono',
    length: 8,
    fire: (d, w) => {
      w.setCalling('martyr');
      w.setVow(true);
      fire(d, w, ev('crescendoStart', { calling: 'Martyr’s Vow', duration: 5 }));
    },
    then: [
      {
        delay: 5,
        fire: (d, w) => {
          w.setVow(false);
          fire(d, w, ev('crescendoEnd', {}));
          w.setCalling(null);
        },
      },
    ],
  },
  {
    id: 'chrono-foresight',
    label: 'Foresight glimpse (an attack on Lyra, a second early)',
    group: 'chrono',
    length: 2,
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('foreseen', {
          enemy: IDS.enemyBase,
          attack: 'lab',
          name: 'Lab',
          target: IDS.lyra,
          at: w.time + 1,
        }),
      ),
  },
  {
    id: 'chrono-foresight-burst',
    label: 'Foresight burst (100 in 1 s)',
    group: 'chrono',
    length: 3,
    fire: (d, w) => foresightBurst(d, w, 0),
    then: Array.from({ length: 9 }, (_, i) => ({
      delay: Math.round((i + 1) * 0.1 * 1000) / 1000,
      fire: (d: SynthDirector, w: FakeWorld) => foresightBurst(d, w, i + 1),
    })),
  },
  {
    id: 'chrono-final-tick',
    label: 'Final-second tick (a lethal 2.5 s tank-buster, timers on)',
    group: 'chrono',
    length: 4,
    fire: (d, w) => {
      w.setCalling('chronomancer');
      fire(d, w, startedEv(w.addTelegraph(911, 2.5, { x: -6, severity: 'lethal' })));
    },
    then: [
      ...frames(0.1, 2.6),
      {
        delay: 2.7,
        fire: (_d, w) => {
          w.removeTelegraph(911);
          w.setCalling(null);
        },
      },
    ],
  },
  {
    id: 'chrono-echo-ward',
    label: 'Echo Ward (a Perfect Ward, then its echo a second later)',
    group: 'chrono',
    length: 4,
    fire: (d, w) => fire(d, w, ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 400 })),
    then: [
      {
        delay: 1,
        fire: (d, w) => fire(d, w, ev('echoWard', { target: IDS.kael, amount: 120 })),
      },
    ],
  },
  {
    id: 'chrono-mastery',
    label: 'Temporal Mastery (Glide resets the Ward)',
    group: 'chrono',
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('temporalMastery', { technique: 'ward' }),
        ev('techniqueCast', { technique: 'glide', target: null, x: 5, z: 1 }),
        ev('glided', { fromX: 0, fromZ: 0, toX: 5, toZ: 1 }),
      ),
  },
  {
    id: 'chrono-paradox',
    label: 'Paradox (Rewind undoes two attacks on Kael)',
    group: 'chrono',
    length: 4,
    fire: (d, w) =>
      fire(
        d,
        w,
        startedEv(w.addTelegraph(921, 2.2, { x: -4 })),
        startedEv(w.addTelegraph(922, 2.0, { kind: 'mark', answers: ['chime', 'ward'] })),
      ),
    then: [
      {
        delay: 0.7,
        fire: (d, w) => {
          w.removeTelegraph(921);
          w.removeTelegraph(922);
          const undone = (id: number) => [
            ev('telegraphResolved', {
              telegraph: id,
              target: null,
              outcome: 'cancelled',
              damage: 0,
            }),
            ev('telegraphEnded', { telegraph: id }),
          ];
          fire(
            d,
            w,
            ...undone(921),
            ...undone(922),
            ...rewindEvents('kael', [-4, 4], [-1, -3], 90),
            ev('paradox', { target: IDS.kael, cancelled: 2 }),
          );
        },
      },
    ],
  },
  {
    id: 'chrono-borrowed',
    label: "Borrowed Time (Rewind fills Lyra's Solo)",
    group: 'chrono',
    length: 3,
    fire: (d, w) => {
      w.setCalling('chronomancer', ['quickened', 'borrowed_time']);
      w.setSolo('lyra', 50);
      fire(d, w, ...rewindEvents('lyra', [5, 2], [2, -2], 150));
    },
    then: [{ delay: 1.5, fire: (_d, w) => w.setCalling(null) }],
  },
  {
    id: 'chrono-eternal',
    label: 'Eternal Moment (a Perfect from a Ward cast in Stasis)',
    group: 'chrono',
    length: 4,
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 400 }),
        ev('resonanceGained', { amount: 5, reason: 'perfect ward', total: 35 }),
        ev('resonanceGained', { amount: 10, reason: 'eternal moment', total: 45 }),
      ),
  },
  ...(
    [
      ['callingSelect', 'Chosen in Prep'],
      ['callingReveal', 'Its path opens'],
      ['callingPick', 'A pick taken'],
    ] as const
  ).map(([s, label]): SoundButton => ({
    id: `chrono-ui-${s}`,
    label: `UI: ${label} (the Chronomancer's ${s})`,
    group: 'chrono',
    length: 3,
    fire: (d) => d.playUi(s, 'chronomancer'),
  })),
  // ── Phase 4: the Astrolabe ─────────────────────────────────────────────────────
  ...(
    [
      ['starHover', 'Star hovered (a soft glint; each hover the next star)'],
      ['starTake', 'Travel node taken'],
      ['starNotable', 'Notable taken'],
      ['starKeystone', 'Keystone taken'],
      ['starPath', 'A path taken (several nodes at once)'],
      ['starRefund', 'A node given back'],
      ['starRespec', 'Respec (everything given back)'],
    ] as const
  ).map(([s, label]): SoundButton => ({
    id: `ui-${s}`,
    label: `UI: ${label}`,
    group: 'astrolabe',
    length: s === 'starKeystone' || s === 'starRespec' ? 4 : 3,
    fire: (d) => d.playUi(s),
  })),
  {
    id: 'astro-hover-sweep',
    label: 'UI: hover sweep (24 stars in 0.6 s: about a dozen glints)',
    group: 'astrolabe',
    length: 2,
    fire: (d) => d.playUi('starHover'),
    then: Array.from({ length: 23 }, (_, i) => ({
      delay: Math.round((i + 1) * 0.025 * 1000) / 1000,
      fire: (d: SynthDirector) => d.playUi('starHover'),
    })),
  },
  {
    id: 'astro-path-keystone',
    label: 'UI: a path to a keystone (the run, then the keystone)',
    group: 'astrolabe',
    length: 4,
    fire: (d) => d.playUi('starPath'),
    then: [{ delay: 0.2, fire: (d) => d.playUi('starKeystone') }],
  },
  {
    id: 'astro-take-refund',
    label: 'UI: take a node, then give it back',
    group: 'astrolabe',
    length: 2,
    fire: (d) => d.playUi('starTake'),
    then: [{ delay: 0.6, fire: (d) => d.playUi('starRefund') }],
  },
  ...(
    [
      ['cantAfford', 'not enough points'],
      ['unlock', 'unlock'],
      ['rankUp', 'Rank up'],
    ] as const
  ).map(([s, label]): SoundButton => ({
    id: `astro-ui-${s}`,
    label: `UI: ${label} (${s}, compare)`,
    group: 'astrolabe',
    length: s === 'rankUp' ? 3 : 2,
    fire: (d) => d.playUi(s),
  })),
  {
    id: 'astro-unbroken',
    label: 'Unbroken Chorus: she walks under a Mute’s dome and her songs hold',
    group: 'astrolabe',
    length: 3,
    fire: (d, w) => {
      tree(w, 'unbroken_chorus');
      w.addMute(0, 2);
      d.update(w.state, 1 / 60);
    },
    then: [
      {
        delay: 0.1,
        fire: (d, w) => {
          w.removeMutes();
          d.update(w.state, 1 / 60);
        },
      },
      restore(0.2),
    ],
  },
  {
    id: 'astro-grace',
    label: 'Overflowing Grace: Mend runs over into a shield on Lyra',
    group: 'astrolabe',
    length: 2,
    fire: (d, w) => {
      tree(w, 'overflowing_grace');
      const amount = nodeValue('overflowing_grace', 'cap') * 10;
      fire(d, w, ev('graceShield', { hero: IDS.lyra, amount }));
    },
    then: [restore(0.1)],
  },
  {
    id: 'astro-grace-party',
    label: 'Overflowing Grace on all three at once (one chime), then 0.3 s apart',
    group: 'astrolabe',
    length: 3,
    fire: (d, w) => {
      tree(w, 'overflowing_grace');
      const amount = nodeValue('overflowing_grace', 'cap') * 5;
      fire(
        d,
        w,
        ...[IDS.kael, IDS.lyra, IDS.vexis].map((hero) => ev('graceShield', { hero, amount })),
      );
    },
    then: [
      ...[IDS.lyra, IDS.vexis].map((hero, i) => ({
        delay: 0.3 * (i + 1),
        fire: (d: SynthDirector, w: FakeWorld) =>
          fire(
            d,
            w,
            ev('graceShield', { hero, amount: nodeValue('overflowing_grace', 'cap') * 5 }),
          ),
      })),
      restore(0.7),
    ],
  },
  ...(['ward', 'reel', 'chime'] as const).map((t): SoundButton => ({
    id: `astro-conduit-${t}`,
    label:
      t === 'chime'
        ? 'Eldritch Conduit: a Chime paid in Life, with little left (a second beat)'
        : `Eldritch Conduit: a ${t === 'ward' ? 'Ward on Kael' : 'Reel of Lyra'} paid in Life`,
    group: 'astrolabe',
    length: 3,
    fire: (d, w) => {
      tree(w, 'eldritch_conduit');
      if (t === 'chime') w.setWeaverHp(0.22);
      fire(d, w, ...castEvents(t));
    },
    then: [restore(0.1)],
  })),
  {
    id: 'astro-conduit-compare',
    label: 'The same Ward paid in Spirit (compare)',
    group: 'astrolabe',
    length: 3,
    fire: (d, w) => fire(d, w, ...castEvents('ward')),
  },
  {
    id: 'astro-reject-life',
    label: 'Refused: paying in Life would down her',
    group: 'astrolabe',
    fire: (d, w) => fire(d, w, ev('techniqueRejected', { technique: 'ward', reason: 'life' })),
  },
  {
    id: 'astro-reject-spirit',
    label: 'Refused for Spirit (compare)',
    group: 'astrolabe',
    fire: (d, w) => fire(d, w, ev('techniqueRejected', { technique: 'ward', reason: 'spirit' })),
  },
  {
    id: 'astro-reject-rewind-life',
    label: 'Rewind refused for Life (the clockwork "no", in blood)',
    group: 'astrolabe',
    fire: (d, w) => fire(d, w, ev('techniqueRejected', { technique: 'rewind', reason: 'life' })),
  },
  {
    id: 'astro-halo',
    label: "Shatterproof Halo: Kael's Ward holds a hit that would have broken it",
    group: 'astrolabe',
    length: 3,
    fire: (d, w) => {
      tree(w, 'shatterproof_halo');
      haloHit(d, w);
    },
    then: [restore(0.1)],
  },
  {
    id: 'astro-halo-compare',
    label: 'The same hit breaks a Ward without it (compare)',
    group: 'astrolabe',
    length: 3,
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('damageTaken', {
          target: IDS.kael,
          source: IDS.enemyBase,
          amount: wardMax() * 0.5,
          absorbed: wardMax(),
          amplified: 0,
          aura: 0,
          radiance: 0,
          eclipse: 0,
          crit: false,
          telegraph: 1,
          hit: 'hit',
        }),
        ev('shieldBroken', { target: IDS.kael, shield: 'ward' }),
      ),
  },
  {
    id: 'astro-afterglow',
    label: 'Afterglow: the Thread leaves an Empowered Lyra for Kael (a fading tail)',
    group: 'astrolabe',
    length: 5,
    fire: (d, w) => {
      tree(w, 'afterglow');
      w.setAfterglow('lyra', nodeValue('afterglow', 'seconds'));
      fire(d, w, ev('threadAttached', { hero: IDS.kael, slot: 0 }));
    },
    then: [restore(0.1)],
  },
  {
    id: 'astro-afterglow-back',
    label: 'Afterglow let go: the Thread comes back to Lyra a second later',
    group: 'astrolabe',
    length: 3,
    fire: (d, w) => {
      tree(w, 'afterglow');
      w.setAfterglow('lyra', nodeValue('afterglow', 'seconds'));
      fire(d, w, ev('threadAttached', { hero: IDS.kael, slot: 0 }));
    },
    then: [
      { delay: 1, fire: (d, w) => fire(d, w, ev('threadAttached', { hero: IDS.lyra, slot: 1 })) },
      restore(1.1),
    ],
  },
  {
    id: 'astro-second-wind',
    label: 'Second Wind: Mend revives Vexis (a touch fuller, untouchable a moment)',
    group: 'astrolabe',
    length: 4,
    fire: (d, w) => {
      tree(w, 'second_wind');
      fire(d, w, ev('revived', { hero: IDS.vexis }));
    },
    then: [restore(0.1)],
  },
  {
    id: 'astro-revive-compare',
    label: 'Ordinary revive (compare)',
    group: 'astrolabe',
    length: 3,
    fire: (d, w) => fire(d, w, ev('revived', { hero: IDS.vexis })),
  },
  {
    id: 'astro-burst',
    label: 'Every keystone at once, 20 times in 1 s (the gates hold)',
    group: 'astrolabe',
    length: 5,
    fire: (d, w) => {
      tree(
        w,
        'overflowing_grace',
        'shatterproof_halo',
        'eldritch_conduit',
        'afterglow',
        'second_wind',
      );
      astroBurst(d, w, 0);
    },
    then: [
      ...Array.from({ length: 19 }, (_, i) => ({
        delay: Math.round((i + 1) * 0.05 * 1000) / 1000,
        fire: (d: SynthDirector, w: FakeWorld) => astroBurst(d, w, i + 1),
      })),
      restore(1),
    ],
  },
  // ── Phase 4e: Bonds in the fight ─────────────────────────────────────────────────
  ...TALENTS_FIRED.map(([talent, label]): SoundButton => ({
    id: `talent-${talent}`,
    label,
    group: 'bonds',
    length: talent === 'supernova' || talent === 'unbreakable' ? 3 : 2,
    fire: (d, w) => {
      if (talent === 'celestial_sphere') w.setSphere('lyra', 1);
      talentAct(d, w, talent);
    },
    then: [{ delay: 0.05, fire: (_d, w) => bondsRestore(w) }],
  })),
  {
    id: 'talent-vigil-cued',
    label: 'Hawk’s Vigil, cued: a shot that marks (the pluck and a small glass E6)',
    group: 'bonds',
    length: 2,
    fire: (d, w) => {
      w.setAltSolo('lyra', 'hawks_vigil', true);
      talentAct(d, w, 'hawks_vigil');
    },
    then: [{ delay: 0.05, fire: (_d, w) => bondsRestore(w) }],
  },
  {
    id: 'talent-sphere-last',
    label: 'Celestial Sphere: its last hit swallowed, it shatters (a fuller pop, falling)',
    group: 'bonds',
    length: 2,
    fire: (d, w) => {
      w.setSphere('lyra', 0);
      talentAct(d, w, 'celestial_sphere');
    },
  },
  {
    id: 'talent-shieldbearer-alone',
    label: 'Shieldbearer with no one beside Kael (the brass, no glints)',
    group: 'bonds',
    length: 2,
    fire: (d, w) => {
      w.moveHero('lyra', -16, -3);
      w.moveHero('vexis', 16, -3);
      talentAct(d, w, 'shieldbearer');
    },
    then: [{ delay: 0.05, fire: (_d, w) => bondsRestore(w) }],
  },
  {
    id: 'talent-riposte-perfect',
    label: 'Riposte Bash with its Perfect Ward (the clang a beat after the ring)',
    group: 'bonds',
    length: 3,
    fire: (d, w) => {
      fire(d, w, ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 560 }));
      talentAct(d, w, 'riposte_bash');
    },
  },
  ...(['oathkeeper', 'hawks_vigil', 'celestial_sphere'] as const).flatMap((solo) =>
    [false, true].map((cued): SoundButton => ({
      id: `altsolo-${solo}${cued ? '-cued' : ''}`,
      label: `${solo === 'oathkeeper' ? 'Oathkeeper' : solo === 'hawks_vigil' ? 'Hawk’s Vigil' : 'Celestial Sphere'} starts${cued ? ', cued (with the Cue’s leitmotif)' : ''}`,
      group: 'bonds',
      length: 3,
      fire: (d, w) => {
        const hero: HeroKey =
          solo === 'oathkeeper' ? 'kael' : solo === 'hawks_vigil' ? 'lyra' : 'vexis';
        if (cued) fire(d, w, ev('cued', { hero: IDS[hero] }));
        fire(d, w, ev('soloStarted', { hero: IDS[hero], solo, cued, duration: cued ? 6 : 5 }));
      },
    })),
  ),
  {
    id: 'talent-vigil-burst',
    label: 'Hawk’s Vigil: 20 shots in a second (the gate holds: light)',
    group: 'bonds',
    length: 2,
    fire: (d, w) => talentAct(d, w, 'hawks_vigil'),
    then: Array.from({ length: 19 }, (_, i) => ({
      delay: Math.round((i + 1) * 0.05 * 1000) / 1000,
      fire: (d: SynthDirector, w: FakeWorld) => talentAct(d, w, 'hawks_vigil'),
    })),
  },
  {
    id: 'talent-oath-burst',
    label: 'Oathkeeper: 20 hits taken for others in a second (the gate holds: light)',
    group: 'bonds',
    length: 2,
    fire: (d, w) => talentAct(d, w, 'oathkeeper'),
    then: Array.from({ length: 19 }, (_, i) => ({
      delay: Math.round((i + 1) * 0.05 * 1000) / 1000,
      fire: (d: SynthDirector, w: FakeWorld) => talentAct(d, w, 'oathkeeper'),
    })),
  },
  {
    id: 'talent-every',
    label: 'Every talent in turn, 0.6 s apart (each in its own group and voice)',
    group: 'bonds',
    length: 10,
    fire: (d, w) => {
      w.setSphere('lyra', 1);
      talentAct(d, w, TALENTS_FIRED[0][0]);
    },
    then: [
      ...TALENTS_FIRED.slice(1).map(([talent], i) => ({
        delay: Math.round((i + 1) * 0.6 * 1000) / 1000,
        fire: (d: SynthDirector, w: FakeWorld) => talentAct(d, w, talent),
      })),
      { delay: 8.6, fire: (_d: SynthDirector, w: FakeWorld) => bondsRestore(w) },
    ],
  },
  // ── Phase 4f: technique variants ─────────────────────────────────────────────────
  ...VARIANT_BUTTONS.map(([id, label]) => variantButton(id, label)),
  {
    id: 'variant-chorale-perfect',
    label: 'Chorale: three of its barriers Perfect against one attack (the chord over the Perfect)',
    group: 'variants',
    length: 3,
    fire: (d, w) => {
      w.setVariant('ward', 'chorale');
      fire(
        d,
        w,
        ...[IDS.kael, IDS.lyra, IDS.vexis].map((target) =>
          ev('perfectWard', { target, telegraph: 1, negated: 480 }),
        ),
      );
    },
    then: [{ delay: 1.5, fire: (_d, w) => variantsRestore(w) }],
  },
  {
    id: 'variant-chorale-lone',
    label: 'Chorale: one barrier Perfect alone (the ordinary Perfect, no chord)',
    group: 'variants',
    length: 3,
    fire: (d, w) => {
      w.setVariant('ward', 'chorale');
      fire(d, w, ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 480 }));
    },
    then: [{ delay: 1.5, fire: (_d, w) => variantsRestore(w) }],
  },
  {
    id: 'variant-link-perfect',
    label: 'Aegis Link, then its Perfect: you join it (a third voice after the strike)',
    group: 'variants',
    length: 3.5,
    fire: (d, w) => fire(d, w, ...variantCast(w, 'aegis_link')),
    then: [
      {
        delay: 0.7,
        fire: (d, w) =>
          fire(
            d,
            w,
            ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 560 }),
            ev('linked', {
              a: IDS.kael,
              b: IDS.lyra,
              weaver: true,
              until: w.time + variantValue('aegis_link', 'seconds'),
            }),
          ),
      },
      { delay: 2, fire: (_d, w) => variantsRestore(w) },
    ],
  },
  {
    id: 'variant-link-share',
    label: 'Aegis Link: a hit shared between the two (a low pluck, a muffled knock; light)',
    group: 'variants',
    length: 2.5,
    fire: (d, w) => fire(d, w, ...variantCast(w, 'aegis_link')),
    then: [
      { delay: 0.6, fire: (d, w) => fire(d, w, ...sharedHit()) },
      { delay: 1.2, fire: (_d, w) => variantsRestore(w) },
    ],
  },
  {
    id: 'variant-share-burst',
    label: 'Aegis Link: 20 hits shared in a second (the gate holds: light)',
    group: 'variants',
    length: 2.5,
    fire: (d, w) => fire(d, w, ...variantCast(w, 'aegis_link')),
    then: [
      ...Array.from({ length: 20 }, (_, i) => ({
        delay: Math.round((0.3 + i * 0.05) * 1000) / 1000,
        fire: (d: SynthDirector, w: FakeWorld) => fire(d, w, ...sharedHit()),
      })),
      { delay: 1.4, fire: (_d: SynthDirector, w: FakeWorld) => variantsRestore(w) },
    ],
  },
  {
    id: 'variant-purge-burst',
    label: 'Purge’s burst alone, at three enemies (noise thrown out, three glass falling)',
    group: 'variants',
    length: 2,
    fire: (d, w) => fire(d, w, ...variantLand(w, 'purge').filter((e) => e.type === 'purged')),
  },
  {
    id: 'variant-purge-none',
    label: 'Purge’s burst with no enemy near (the throw, one glass)',
    group: 'variants',
    length: 2,
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('purged', {
          hero: IDS.lyra,
          x: 0,
          z: -3,
          radius: variantValue('purge', 'radius'),
          hit: [],
        }),
      ),
  },
  {
    id: 'variant-skate-twice',
    label: 'Skate: both charges, one after the other (the pluck climbs)',
    group: 'variants',
    length: 2,
    fire: (d, w) => {
      w.setVariant('glide', 'skate');
      fire(d, w, ...variantCast(w, 'skate'));
    },
    then: [
      { delay: 0.3, fire: (d, w) => fire(d, w, ...variantCast(w, 'skate')) },
      { delay: 1, fire: (_d, w) => variantsRestore(w) },
    ],
  },
  {
    id: 'variant-every',
    label: 'Every variant in turn, 0.7 s apart (each in its own group, in her voice)',
    group: 'variants',
    length: 8,
    fire: (d, w) => fire(d, w, ...variantCast(w, VARIANT_BUTTONS[0][0])),
    then: [
      ...VARIANT_BUTTONS.slice(1).flatMap(([id], i) => {
        const at = Math.round((i + 1) * 0.7 * 1000) / 1000;
        const out = [
          {
            delay: at,
            fire: (d: SynthDirector, w: FakeWorld) => {
              variantsRestore(w);
              fire(d, w, ...variantCast(w, id));
            },
          },
        ];
        if (slotOf(id) === 'chime')
          out.push({
            delay: Math.round((at + 0.25) * 1000) / 1000,
            fire: (d: SynthDirector, w: FakeWorld) => fire(d, w, ...variantLand(w, id)),
          });
        return out;
      }),
      { delay: 6.5, fire: (_d: SynthDirector, w: FakeWorld) => variantsRestore(w) },
    ],
  },
  ...(['ward', 'chime', 'reel', 'glide'] as const).map((slot): SoundButton => {
    const id = CONTENT.techniqueVariants.find((v) => v.slot === slot)?.id ?? slot;
    return {
      id: `variant-pick-${slot}`,
      label: `variantPick: a ${slot} variant chosen in Prep (${id})`,
      group: 'ui',
      fire: (d) => d.playUi('variantPick', null, { variant: id }),
    };
  }),
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
      'callingSelect',
      'callingReveal',
      'callingPick',
      'deed',
      'deedStar',
      'enshrine',
      'inscribe',
      'inscribeFine',
      'retune',
      'ascend',
      'ascendMiss',
      'fracture',
      'dissonate',
      'dissonant',
      'empowered',
      'cursedRelic',
      'shattered',
      'release',
      'carry',
      'dissonanceToggle',
      'dissonanceOpen',
      'dissonanceBest',
      'bondRankUp',
      'talentPick',
      'soloPick',
      'sceneStart',
      'sceneReply',
      'variantPick',
    ] as UiSound[]
  ).map((s): SoundButton => ({
    id: `ui-${s}`,
    label: s,
    group: 'ui',
    length:
      s === 'reveal'
        ? 5
        : s === 'rankUp' ||
            s === 'forge' ||
            s === 'eventOpen' ||
            s === 'dissonanceBest' ||
            s === 'bondRankUp'
          ? 3
          : s === 'dissonanceOpen' || s === 'sceneStart'
            ? 4
            : undefined,
    fire: (d) => d.playUi(s),
  })),
  // ── Phase 4e: Bonds' UI sounds, for each hero ──
  ...BOND_HEROES.flatMap((hero): SoundButton[] => [
    {
      id: `bond-rank-${hero}`,
      label: `bondRankUp: ${hero}'s Bond grew (rank ${PLAIN_RANK}: their theme, warm)`,
      group: 'ui',
      length: 3,
      fire: (d) => d.playUi('bondRankUp', null, { hero, rank: PLAIN_RANK }),
    },
    {
      id: `bond-rank-${hero}-talent`,
      label: `bondRankUp: ${hero} reaches a talent rank (${TALENT_RANK}: a second glass note)`,
      group: 'ui',
      length: 3,
      fire: (d) => d.playUi('bondRankUp', null, { hero, rank: TALENT_RANK }),
    },
    {
      id: `bond-talent-${hero}`,
      label: `talentPick: one of ${hero}'s talents chosen`,
      group: 'ui',
      fire: (d) => d.playUi('talentPick', null, { hero }),
    },
    {
      id: `bond-solo-${hero}`,
      label: `soloPick: ${hero}'s Solo chosen`,
      group: 'ui',
      length: 2,
      fire: (d) => d.playUi('soloPick', null, { hero }),
    },
    {
      id: `bond-scene-${hero}`,
      label: `sceneStart: a scene with ${hero} begins (the fire, a held breath)`,
      group: 'ui',
      length: 4,
      fire: (d) => d.playUi('sceneStart', null, { hero }),
    },
    {
      id: `bond-reply-${hero}`,
      label: `sceneReply: a reply to ${hero}`,
      group: 'ui',
      fire: (d) => d.playUi('sceneReply', null, { hero }),
    },
  ]),
  // ── Phase 4d: Dissonance in Prep and at the Summary ──
  {
    id: 'dis-toggle-low',
    label: 'dissonanceToggle: a level on, the total 2',
    group: 'ui',
    length: 2,
    fire: toggle(2, 0),
  },
  {
    id: 'dis-toggle-mid',
    label: 'dissonanceToggle: a level on, the total half the most',
    group: 'ui',
    length: 2,
    fire: (d) => toggle(Math.round(dissonanceMax() / 2), Math.round(dissonanceMax() / 2) - 3)(d),
  },
  {
    id: 'dis-toggle-max',
    label: 'dissonanceToggle: the last level on (the most)',
    group: 'ui',
    length: 2,
    fire: (d) => toggle(dissonanceMax(), dissonanceMax() - 2)(d),
  },
  {
    id: 'dis-toggle-off',
    label: 'dissonanceToggle: a level taken off (12 from 15: the tension eases)',
    group: 'ui',
    length: 2,
    fire: toggle(12, 15),
  },
  {
    id: 'dis-toggle-climb',
    label: 'dissonanceToggle: level after level, up to the most (the tension rising)',
    group: 'ui',
    length: 4,
    fire: toggle(3, 0),
    then: [0.4, 0.8, 1.2, 1.6, 2.0].map((delay, i) => ({
      delay,
      fire: (d: SynthDirector) => {
        const max = dissonanceMax();
        const total = Math.round((max * (i + 2)) / 6);
        toggle(total, Math.round((max * (i + 1)) / 6))(d);
      },
    })),
  },
  {
    id: 'dis-best-max',
    label: 'dissonanceBest: a new best at the most (its star rings highest)',
    group: 'ui',
    length: 3,
    fire: (d) => d.playUi('dissonanceBest', null, { total: dissonanceMax() }),
  },
];
