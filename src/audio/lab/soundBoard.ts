/** Every sound the lab can trigger, grouped. Shared by the buttons and the offline audit. */
import { CONTENT } from '../../content';
import {
  ALTO,
  BASS,
  BASSO_OSTINATO,
  CADENZA,
  CONDUCTOR,
  DOWNBEAT,
  FORTISSIMO,
  LAMENT,
  SFORZANDO,
  SHATTER_ARIA,
  SOPRANO,
  TENOR,
} from '../../content/crucibleIds';
import type { ConductingField, SimEvent } from '../../sim';
import type { SynthDirector } from '../director';
import type { UiSound, UiSoundDetail } from '../types';
import { dissonanceMax } from '../ui';
import { TRIGGER_EFFECT_KINDS, TRIGGER_KINDS } from '../../render/fillCues';
import type { FakeTelegraph, FakeWorld } from './labState';
import { IDS, ev, nodeWith, type HeroKey, type LabHero } from './labState';

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
    | 'loom'
    /** Phase 5a: the Crimson Legion (its statuses, guard, charges, Tide, Execution, iron). */
    | 'crimson'
    /** Phase 5b: Brann (his voice, his drum and alert, his kit; Brann joins the lab party). */
    | 'brann'
    /** Phase 5e: Seren (her voice, parry and kill shot, her kit; she joins the lab party). */
    | 'seren'
    /** Phase 5e: Oro (his voice, his Saplings and the Ancient; he joins the lab party). */
    | 'oro'
    /**
     * Phase 5f: the Conductor (Duets and Trios, the free Cue, the downbeat, the Grand Finale, the
     * path's Reprise, Marcato, Ensemble, Spotlight and Triad, his Calling's UI voicings).
     */
    | 'conductor'
    /**
     * Phase 5g: the content fill (Razor Silk's bite, Thread the Needle's catch, a trigger firing,
     * one button for each kind of effect).
     */
    | 'fill'
    /**
     * Phase 5g, read from state rather than events: Concert Pitch's Ringing (struck, and struck
     * again while it rings), Spare Strings catching the Thread, Water Clock turning time back.
     */
    | 'fillState'
    /**
     * Phase 5c: the Unstitched (cuts, the Maw, the Wraith, the rune, the Mimic, the Seamstress,
     * Doom, the Unweaver, the Retarget and Empower windups, cloth kills).
     */
    | 'unstitched'
    /**
     * Phase 5d: the Finale (Discord, Fortissimo Silence, the Cues, the Grand Silence and its
     * notes, the Reignite and the Coda, glass kills, the Finale's stinger).
     */
    | 'finale'
    /**
     * Phase 6: Dissonance's last levels (Tyrant's edict and the boss's voice under a borrowed
     * cast; the Postlude's rise, its stems and a pair Cue answering) and the Atlas's UI sounds.
     */
    | 'phase6'
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
  answers: ('ward' | 'chime' | 'reel' | 'focus' | 'scatter' | 'stack' | 'move' | 'dome' | 'mend')[],
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
function talentEv(talent: string, hero: LabHero, x: number, z: number, target: number | null) {
  return ev('talentFired', { hero: IDS[hero], talent, x, z, target });
}

/** Where a hero stands in the lab world. */
function heroAt(w: FakeWorld, hero: LabHero): { x: number; z: number } {
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
    // Phase 5b: Brann's (he joins the lab party for them).
    case 'iron_will':
    case 'deathless':
    case 'berserkers_hymn': {
      withBrann(w);
      const b = heroAt(w, 'brann');
      fire(d, w, talentEv(talent, 'brann', b.x, b.z, null));
      break;
    }
    case 'blood_oath': {
      withBrann(w);
      const b = heroAt(w, 'brann');
      fire(d, w, talentEv(talent, 'brann', b.x + 1.5, b.z + 1, foe));
      break;
    }
    // Phase 5e: Seren's and Oro's (each joins the lab party for theirs).
    case 'riposte_chain':
    case 'bladesong':
    case 'blade_waltz': {
      withHero(w, 'seren');
      const s = heroAt(w, 'seren');
      fire(d, w, talentEv(talent, 'seren', s.x + 1, s.z + 1.5, foe));
      break;
    }
    case 'duellists_honour': {
      withHero(w, 'seren');
      const s = heroAt(w, 'seren');
      fire(d, w, talentEv(talent, 'seren', s.x, s.z, null));
      break;
    }
    case 'thorned_bark':
    case 'old_growth':
    case 'homecoming': {
      withHero(w, 'oro');
      fire(d, w, talentEv(talent, 'oro', 2.5, 5, talent === 'thorned_bark' ? foe : IDS.sapling));
      break;
    }
    case 'world_tree': {
      withHero(w, 'oro');
      const o = heroAt(w, 'oro');
      fire(d, w, talentEv(talent, 'oro', o.x, o.z + 4, null));
      break;
    }
  }
}

/** Phase 5b: Brann joins the lab world (a fourth hero) if he isn't in it; nobody leaves. */
function withBrann(w: FakeWorld): void {
  withHero(w, 'brann');
}

/**
 * Phase 5e: a hero joins the lab world if they aren't in it, as the fourth: a fourth already there
 * (another hero's buttons brought them) gives up the slot. The starters stay.
 */
function withHero(w: FakeWorld, hero: LabHero): void {
  const party = w.heroes();
  if (party.includes(hero)) return;
  w.setParty(party.length < 4 ? [...party, hero] : [...party.slice(0, 3), hero]);
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
  ['iron_will', 'Iron Will: Brann answers a Rally under your Ward (a drum, the bowed A2, a fifth)'],
  ['blood_oath', 'Blood Oath: the overheal rides his swing (a plucked A3, a knock; frequent)'],
  ['deathless', 'Deathless: he can’t die for a few seconds (a drum, his A2 held under its E3)'],
  ['berserkers_hymn', 'Berserker’s Hymn: low, he drives them all on (an open fifth swelling)'],
] as const;

/**
 * Phase 5e: Seren's and Oro's talents and alternate Solos as the sim announces them (the ones that
 * fire at a moment; see TALENT_SOUND_GROUPS). Kept apart
 * from `TALENTS_FIRED` so 'talent-every' (pinned by the Spire and Rift snapshots) is unchanged.
 */
const TALENTS_FIRED_5E = [
  // Seren's, on her struck string and steel.
  ['riposte_chain', 'Riposte Chain: her Ward parries twice (two strikes, C6 then F6)'],
  ['bladesong', 'Bladesong: her counter cuts all round her (F5 A5 C6, a swirl)'],
  ['duellists_honour', 'Duellist’s Honour: a kill shot readies your Ward (C6, the Ward’s D6)'],
  ['blade_waltz', 'Blade Waltz: a blow turned aside, Ward or not (a light clash; frequent)'],
  // Phase 5e: Oro's, on hollow wood.
  ['thorned_bark', 'Thorned Bark: the bark bites back (a scratch, a dry G3; frequent)'],
  ['old_growth', 'Old Growth: a Sapling grows old (a deeper knock, a creak, D3)'],
  ['world_tree', 'World Tree: the Ancient roots again as it falls (a great G1, D2 and G2)'],
  ['homecoming', 'Homecoming: every Sapling home at your front (G3 and D4, a G5)'],
] as const;

/** Bonds UI sounds for each hero, and the shared voicing (no hero). */
const BOND_HEROES = ['kael', 'lyra', 'vexis', 'brann', 'seren', 'oro'] as const;
/** A Bond rank that opens nothing, and one that opens a talent tier (both from the content). */
const PLAIN_RANK =
  [2, 4, 5, 7, 8, 1].find(
    (r) => !CONTENT.bondRules.talentRanks.includes(r) && r !== CONTENT.bondRules.soloRank,
  ) ?? 1;
const TALENT_RANK = CONTENT.bondRules.talentRanks[1] ?? CONTENT.bondRules.talentRanks[0] ?? 1;

/** The alternate Solos' names and heroes (their start buttons). */
const ALT_SOLO_NAME = {
  oathkeeper: 'Oathkeeper',
  hawks_vigil: 'Hawk’s Vigil',
  celestial_sphere: 'Celestial Sphere',
  blood_brother: 'Blood Brother',
  blade_waltz: 'Blade Waltz',
  homecoming: 'Homecoming',
} as const;
const ALT_SOLO_HERO: Record<keyof typeof ALT_SOLO_NAME, LabHero> = {
  oathkeeper: 'kael',
  hawks_vigil: 'lyra',
  celestial_sphere: 'vexis',
  blood_brother: 'brann',
  blade_waltz: 'seren',
  homecoming: 'oro',
};

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

// ── Phase 5a helpers: the Crimson Legion ────────────────────────────────────────────

/** A Movement II status landing on a hero (bleed with its stacks). */
const statusOn = (hero: HeroKey, status: string, duration: number, stacks?: number): SimEvent =>
  ev('statusApplied', {
    target: IDS[hero],
    status: status as never,
    duration,
    ...(stacks === undefined ? {} : { stacks }),
  });

/**
 * A Legion attack's telegraph in the world (so its sound finds its attack id) and its
 * `telegraphStarted`, from the content's own numbers.
 */
function legionTele(w: FakeWorld, id: number, attackId: string, target: HeroKey | null): SimEvent {
  const a = CONTENT.attacks.find((x) => x.id === attackId);
  const windup = a?.windup ?? 1.5;
  const kind = (a?.kind ?? 'burst') as FakeTelegraph['kind'];
  const t = w.addTelegraph(id, windup, {
    kind,
    answers: (a?.answers ?? ['move']) as FakeTelegraph['answers'],
    target: target === null ? null : IDS[target],
    attackId,
    name: a?.name ?? 'Lab',
  });
  return ev('telegraphStarted', {
    telegraph: id,
    owner: t.owner,
    target: t.target,
    name: t.name,
    kind: t.kind,
    shape: t.shape,
    start: t.start,
    impact: t.impact,
    perfectFrom: t.perfectFrom,
    damage: t.damage,
    pctMaxHp: 0,
    answers: t.answers,
    effect: 'damage',
  });
}

const resolved = (
  id: number,
  hero: HeroKey | null,
  outcome: 'hit' | 'dodged' | 'warded' | 'perfect' | 'absorbed' | 'cancelled',
): SimEvent =>
  ev('telegraphResolved', {
    telegraph: id,
    target: hero === null ? null : IDS[hero],
    outcome,
    damage: outcome === 'hit' ? 300 : 0,
  });

/** An attack that moved its caster (Impaling Charge, Pounce). */
const moved = (visual: 'charge' | 'leap', fromX: number, toX: number, travel = 0): SimEvent =>
  ev('attackFired', {
    source: IDS.enemyBase,
    target: IDS.lyra,
    visual,
    fromX,
    fromZ: 8,
    toX,
    toZ: -3,
    travel,
  });

/** The Legion's iron enemies, from the content (their kill buttons). */
const IRON_ENEMIES = CONTENT.enemies.filter((e) => e.material === 'iron');

/**
 * Execution on Lyra, cast for its windup, then its verdict: taking her, sparing her, or landing
 * on her already fallen (the sim's `telegraphResolved.execution`).
 */
function execution(verdict: 'executed' | 'spared' | 'fallen'): SoundButton {
  const windup = CONTENT.attacks.find((a) => a.id === 'vharun_execution')?.windup ?? 4;
  const taken = verdict === 'executed';
  return {
    id:
      verdict === 'executed'
        ? 'crimson-execution-gong'
        : verdict === 'spared'
          ? 'crimson-execution-spared'
          : 'crimson-execution-fallen',
    label:
      verdict === 'executed'
        ? 'Execution: the drum roll, then the gong (she falls under 40%)'
        : verdict === 'spared'
          ? 'Execution: the drum roll, then the bell (lifted above 40%, spared)'
          : 'Execution: the drum roll, then a muted knell (the Tide took her first)',
    group: 'crimson',
    length: windup + 4,
    fire: (d, w) => {
      w.setDowned('lyra', false);
      w.setHeroHp('lyra', taken ? 0.3 : 0.6);
      fire(
        d,
        w,
        statusOn('lyra', 'condemned', windup),
        legionTele(w, 40, 'vharun_execution', 'lyra'),
      );
    },
    then: [
      {
        delay: windup,
        fire: (d, w) => {
          w.removeTelegraph(40);
          const verdictOf = { ...resolved(40, 'lyra', 'hit'), execution: verdict } as SimEvent;
          if (taken) {
            w.setDowned('lyra', true);
            fire(d, w, ev('allyDowned', { hero: IDS.lyra }), verdictOf);
            w.setDowned('lyra', false);
          } else if (verdict === 'fallen') {
            w.setDowned('lyra', true);
            fire(d, w, { ...verdictOf, outcome: 'dodged', damage: 0 } as SimEvent);
            w.setDowned('lyra', false);
          } else fire(d, w, verdictOf);
          w.setHeroHp('lyra', 1);
        },
      },
    ],
  };
}

// ── Phase 5b helpers: Brann ──────────────────────────────────────────────────────────

/** Brann's life (a share of it) and the drum and alert's frames for `seconds`, then full again. */
function brannLow(
  id: string,
  label: string,
  frac: number,
  set: (w: FakeWorld) => void = () => undefined,
  seconds = 4,
): SoundButton {
  return {
    id,
    label,
    group: 'brann',
    length: seconds + 1,
    fire: (d, w) => {
      withBrann(w);
      w.setHeroHp('brann', frac);
      set(w);
      d.update(w.state, 0.1);
    },
    then: [
      ...frames(0.1, seconds),
      {
        delay: seconds + 0.05,
        fire: (d, w) => {
          w.setHeroHp('brann', 1);
          w.setBleedRate(0);
          w.setIncoming('brann', 0);
          w.mods = undefined;
          w.setThread(null);
          d.update(w.state, 0.1);
        },
      },
    ],
  };
}

/** Brann's attack fired (a leap, or a Frenzy's spin), from where he stands. */
function brannAttack(w: FakeWorld, visual: 'leap' | 'cleave', travel = 0): SimEvent {
  withBrann(w);
  if (!w.entities.has(IDS.enemyBase)) w.setEnemies(3);
  const b = heroAt(w, 'brann');
  return ev('attackFired', {
    source: IDS.brann,
    target: IDS.enemyBase,
    visual,
    fromX: b.x,
    fromZ: b.z,
    toX: visual === 'leap' ? b.x - 4 : b.x + 1,
    toZ: visual === 'leap' ? b.z + 6 : b.z + 1,
    travel,
  });
}

/** Red Frenzy for 5 s (its whirl, a spin each half second, then its end), cued or not. */
function frenzyButton(cued: boolean): SoundButton {
  return {
    id: `brann-frenzy${cued ? '-cued' : ''}`,
    label: `Red Frenzy${cued ? ', cued (lifesteal x3: the A2 joins)' : ''}: 5 s of whirl and spins`,
    group: 'brann',
    length: 7,
    fire: (d, w) => {
      withBrann(w);
      w.setAltSolo('brann', 'redFrenzy', cued);
      if (cued) fire(d, w, ev('cued', { hero: IDS.brann }));
      fire(d, w, ev('soloStarted', { hero: IDS.brann, solo: 'redFrenzy', cued, duration: 5 }));
    },
    then: [
      ...Array.from({ length: 10 }, (_, i) => ({
        delay: Math.round((i + 1) * 0.5 * 1000) / 1000 - 0.25,
        fire: (d: SynthDirector, w: FakeWorld) => fire(d, w, brannAttack(w, 'cleave')),
      })),
      {
        delay: 5,
        fire: (d, w) => {
          w.setAltSolo('brann', null);
          fire(d, w, ev('soloEnded', { hero: IDS.brann }));
        },
      },
    ],
  };
}

const lifestealEv = (amount = 18): SimEvent =>
  ev('healApplied', {
    target: IDS.brann,
    source: IDS.brann,
    amount,
    overheal: 0,
    via: 'lifesteal',
  });

const brannCall = (): SimEvent =>
  ev('callStarted', {
    hero: IDS.brann,
    answer: 'ward',
    ability: 'sunderLeap',
    flourish: 'Red Comet',
    until: 2.8,
    line: 'Ward me — I’m going in!',
  });

// ── Phase 5e helpers: Seren and Oro ─────────────────────────────────────────────────

/** A hit on an entity (a hero's or a Sapling's), as the sim reports it. */
const hitOn = (target: number, amount: number): SimEvent =>
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

/** Seren's attack fired (her Lunge, Feint or a blink), from where she stands. */
function serenAttack(w: FakeWorld, visual: 'lunge' | 'feint' | 'blink', travel = 0): SimEvent {
  withHero(w, 'seren');
  if (!w.entities.has(IDS.enemyBase)) w.setEnemies(3);
  const s = heroAt(w, 'seren');
  return ev('attackFired', {
    source: IDS.seren,
    target: IDS.enemyBase,
    visual,
    fromX: s.x,
    fromZ: s.z,
    toX: visual === 'feint' ? s.x + 2.5 : s.x - 3,
    toZ: visual === 'feint' ? s.z : s.z + 7,
    travel,
  });
}

const serenCall = (): SimEvent =>
  ev('callStarted', {
    hero: IDS.seren,
    answer: 'ward',
    ability: 'lunge',
    flourish: 'Flèche',
    until: 2,
    line: 'Ward me. I’ll meet it.',
  });

const oroCall = (): SimEvent =>
  ev('callStarted', {
    hero: IDS.oro,
    answer: 'chime',
    ability: 'regrowth',
    flourish: 'Spring Rain',
    until: 2.5,
    line: 'A little rain?',
  });

/** Rootbond's Mend spilling onto a Sapling, as the sim sends it (grove.ts: via 'mend' on it). */
const groveHeal = (target: number): SimEvent =>
  ev('healApplied', { target, source: IDS.weaver, amount: 12, overheal: 0, via: 'mend' });

/**
 * Thousand Cuts for 4 s: a blink each half second (eight cuts), cued or not. Cued, two of its
 * kills each buy another cut.
 */
function cutsButton(cued: boolean): SoundButton {
  return {
    id: `seren-cuts${cued ? '-cued' : ''}`,
    label: `Thousand Cuts${cued ? ', cued (every kill buys another cut: a rising run)' : ''}: eight blinks, then she returns`,
    group: 'seren',
    length: 6,
    fire: (d, w) => {
      withHero(w, 'seren');
      w.setAltSolo('seren', 'thousandCuts', cued);
      if (cued) fire(d, w, ev('cued', { hero: IDS.seren }));
      fire(d, w, ev('soloStarted', { hero: IDS.seren, solo: 'thousandCuts', cued, duration: 4 }));
    },
    then: [
      ...Array.from({ length: 8 }, (_, i) => ({
        delay: Math.round((i + 1) * 0.5 * 1000) / 1000 - 0.25,
        fire: (d: SynthDirector, w: FakeWorld) => {
          fire(d, w, serenAttack(w, 'blink'));
          if (i % 3 === 1) {
            const id = w.addEnemy('swarm', 2 * i - 6);
            fire(
              d,
              w,
              ev('enemyKilled', {
                enemy: id,
                defId: 'swarm',
                killer: IDS.seren,
                x: 2 * i - 6,
                z: 5,
              }),
            );
          }
        },
      })),
      {
        delay: 4,
        fire: (d, w) => {
          w.setAltSolo('seren', null);
          fire(d, w, ev('soloEnded', { hero: IDS.seren }));
        },
      },
    ],
  };
}

/** A hero's life (a share of it) and the heartbeat's frames for `seconds`, then full again. */
function lowButton(
  hero: 'seren' | 'oro',
  id: string,
  label: string,
  frac: number,
  set: (w: FakeWorld) => void = () => undefined,
  seconds = 3,
): SoundButton {
  return {
    id,
    label,
    group: hero,
    length: seconds + 1,
    fire: (d, w) => {
      withHero(w, hero);
      w.setHeroHp(hero, frac);
      set(w);
      d.update(w.state, 0.1);
    },
    then: [
      ...frames(0.1, seconds),
      {
        delay: seconds + 0.05,
        fire: (d, w) => {
          w.setHeroHp(hero, 1);
          if (hero === 'oro') for (let i = 0; i < 3; i++) w.setSaplingHp(i, 1);
          d.update(w.state, 0.1);
        },
      },
    ],
  };
}
const serenLow = (id: string, label: string, frac: number, set?: (w: FakeWorld) => void) =>
  lowButton('seren', id, label, frac, set);
const oroLow = (id: string, label: string, frac: number, set?: (w: FakeWorld) => void) =>
  lowButton('oro', id, label, frac, set);

// ── Phase 5c helpers: the Unstitched ────────────────────────────────────────────────

/** The Unstitched's cloth enemies, from the content (their kill buttons). */
const CLOTH_ENEMIES = CONTENT.enemies.filter((e) => e.material === 'cloth');

/**
 * An Unstitched attack's telegraph in the world (so its sound finds its attack id) and its
 * `telegraphStarted`, from the content's own numbers. `owner`: its caster (the Mimic reads its
 * copy from its caster).
 */
function riftTele(
  w: FakeWorld,
  id: number,
  attackId: string,
  target: HeroKey | null,
  owner: number = IDS.enemyBase,
): SimEvent {
  const a = CONTENT.attacks.find((x) => x.id === attackId);
  const windup = a?.windup ?? 1.5;
  const t = w.addTelegraph(id, windup, {
    kind: (a?.kind ?? 'burst') as FakeTelegraph['kind'],
    answers: (a?.answers ?? ['move']) as FakeTelegraph['answers'],
    target: target === null ? null : IDS[target],
    attackId,
    name: a?.name ?? 'Lab',
  });
  t.owner = owner;
  return ev('telegraphStarted', {
    telegraph: id,
    owner,
    target: t.target,
    name: t.name,
    kind: t.kind,
    shape: t.shape,
    start: t.start,
    impact: t.impact,
    perfectFrom: t.perfectFrom,
    damage: t.damage,
    pctMaxHp: 0,
    answers: t.answers,
    effect: 'damage',
  });
}

/** The Thread cut by an enemy (`threadSnapped` with its cause), off Kael. */
const cutOff = (cause: 'shears' | 'severing' | 'snip' | 'unpick', lock: number): SimEvent =>
  ev('threadSnapped', { target: IDS.kael, cause, lock, by: IDS.enemyBase });

/** A Lab telegraph answered first by Retarget or Empower (its windup's style). */
const verbTele = (answers: ('thread' | 'empower' | 'move' | 'focus')[], windup = 1.4): SimEvent =>
  ev('telegraphStarted', {
    telegraph: 1,
    owner: IDS.enemyBase,
    target: IDS.kael,
    name: 'Lab',
    kind: 'beam',
    shape: { kind: 'circle', x: 3, z: 4, r: 3 },
    start: 0,
    impact: windup,
    perfectFrom: windup - 0.35,
    damage: 300,
    pctMaxHp: 0,
    answers,
    effect: 'damage',
  });

/** A Mimic in the world with its copy, as the sim's `enemy.mimic` holds it. Returns its id. */
function mimicWith(w: FakeWorld, copy: 'ward' | 'chime' | 'empower'): number {
  const id = w.addEnemy('mimic', 5);
  const e = w.entities.get(id);
  if (e?.enemy) Object.assign(e.enemy, { mimic: { copy } });
  return id;
}

/** A timed zone (`zoneStarted`) of `kind`, `seconds` long, at x. */
const zoneOn = (w: FakeWorld, zone: number, kind: 'pull' | 'null', seconds: number, x = 3) =>
  ev('zoneStarted', {
    zone,
    kind,
    owner: IDS.enemyBase,
    x,
    z: 4,
    r: kind === 'pull' ? 8 : 5,
    until: w.time + seconds,
  });

// ── Phase 5d helpers: the Finale ───────────────────────────────────────────────────

/** What made a Grand Silence note, in the order the lab's phrase turns through them. */
const NOTE_SOURCES = ['perfect', 'clutch', 'reel', 'rewind'] as const;
type LabNoteSource = (typeof NOTE_SOURCES)[number];

/** The Grand Silence begins (its cap far off: the lab ends it). */
const silenceBegins = (w: FakeWorld): SimEvent =>
  ev('silenceBegan', { boss: IDS.enemyBase, until: w.time + 1e6 });

/** The n-th note of the Grand Silence, made by `source` on Kael (a Rewind's names no hero). */
const silenceNote = (n: number, source: LabNoteSource): SimEvent =>
  ev('silenceNote', { n, of: 8, source, hero: source === 'rewind' ? null : IDS.kael });

/** A follow-up that lets the Grand Silence go (combat stopped), so a button leaves no hold. */
const releaseSilence = (delay: number) => ({ delay, fire: (d: SynthDirector) => d.stopCombat() });

/** A Finale attack's telegraph in the world (its sound finds its attack id) and its start. */
function finaleTele(w: FakeWorld, id: number, attackId: string, windup: number): SimEvent {
  const t = w.addTelegraph(id, windup, {
    kind: 'raid',
    answers: ['dome', 'ward'],
    target: null,
    attackId,
    name: attackId.startsWith('fortissimo') ? 'Fortissimo Silence' : 'Downbeat',
  });
  return ev('telegraphStarted', {
    telegraph: id,
    owner: IDS.enemyBase,
    target: t.target,
    name: t.name,
    kind: t.kind,
    shape: t.shape,
    start: t.start,
    impact: t.impact,
    perfectFrom: t.perfectFrom,
    damage: t.damage,
    pctMaxHp: 0,
    answers: t.answers,
    effect: 'damage',
  });
}

/** A Finale telegraph lands. */
const finaleLands = (w: FakeWorld, id: number): SimEvent => {
  w.removeTelegraph(id);
  return ev('telegraphResolved', { telegraph: id, outcome: 'hit', target: null, damage: 600 });
};

/** The mirror-choir's voices, with the Solo each is Cued for (docs/phase-5d.md). */
const CUED_VOICES: readonly { voice: string; solo: string; name: string }[] = [
  { voice: ALTO, solo: LAMENT, name: 'the Alto (Lament: Lyra’s motif, mirrored)' },
  { voice: BASS, solo: BASSO_OSTINATO, name: 'the Bass (Basso Ostinato: Brann’s, mirrored)' },
  { voice: TENOR, solo: CADENZA, name: 'the Tenor (Cadenza: Kael’s, mirrored)' },
  { voice: SOPRANO, solo: SHATTER_ARIA, name: 'the Soprano (Shatter Aria: Vexis’s, mirrored)' },
];

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
      // Phase 5c: the Rift's relics (awake only in Movement III fights).
      ['sacrificial_lamb', 'Sacrificial Lamb (another takes the blow)', 'kael', false],
      ['knotted_cord', 'Knotted Cord (a cut knotted short)', 'lyra', false],
      ['stillwater_bell', 'Stillwater Bell (the Chime refunded)', null, false],
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
  ...[...TALENTS_FIRED, ...TALENTS_FIRED_5E].map(([talent, label]): SoundButton => ({
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
  ...(
    [
      'oathkeeper',
      'hawks_vigil',
      'celestial_sphere',
      'blood_brother',
      'blade_waltz',
      'homecoming',
    ] as const
  ).flatMap((solo) =>
    [false, true].map((cued): SoundButton => ({
      id: `altsolo-${solo}${cued ? '-cued' : ''}`,
      label: `${ALT_SOLO_NAME[solo]} starts${cued ? ', cued (with the Cue’s leitmotif)' : ''}`,
      group: 'bonds',
      length: 3,
      fire: (d, w) => {
        const hero = ALT_SOLO_HERO[solo];
        withHero(w, hero);
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
    length: 13,
    fire: (d, w) => {
      w.setSphere('lyra', 1);
      talentAct(d, w, TALENTS_FIRED[0][0]);
    },
    then: [
      ...TALENTS_FIRED.slice(1).map(([talent], i) => ({
        delay: Math.round((i + 1) * 0.6 * 1000) / 1000,
        fire: (d: SynthDirector, w: FakeWorld) => talentAct(d, w, talent),
      })),
      {
        delay: Math.round(TALENTS_FIRED.length * 0.6 * 1000) / 1000,
        fire: (_d: SynthDirector, w: FakeWorld) => bondsRestore(w),
      },
    ],
  },
  {
    id: 'talent-every-5e',
    label: 'Phase 5e: every one of Seren’s and Oro’s talents in turn, 0.6 s apart',
    group: 'bonds',
    length: Math.ceil(TALENTS_FIRED_5E.length * 0.6) + 2,
    fire: (d, w) => talentAct(d, w, TALENTS_FIRED_5E[0][0]),
    then: [
      ...TALENTS_FIRED_5E.slice(1).map(([talent], i) => ({
        delay: Math.round((i + 1) * 0.6 * 1000) / 1000,
        fire: (d: SynthDirector, w: FakeWorld) => talentAct(d, w, talent),
      })),
      {
        delay: Math.round(TALENTS_FIRED_5E.length * 0.6 * 1000) / 1000,
        fire: (_d: SynthDirector, w: FakeWorld) => bondsRestore(w),
      },
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
  // ── Phase 5a: the Crimson Legion ───────────────────────────────────────────────
  ...[1, 5, 8].map((n): SoundButton => ({
    id: `crimson-bleed-${n}`,
    label: `Bleed ×${n} (a wet pluck, a step up per stack${n >= 5 ? '; the Chime glint' : ''})`,
    group: 'crimson',
    length: 1.5,
    fire: (d, w) => fire(d, w, statusOn('kael', 'bleed', 6, n)),
  })),
  {
    id: 'crimson-bleed-pack',
    label: 'Bleed: a pack biting, 1→8 in 0.4 s (gated: a few ticks, not eight)',
    group: 'crimson',
    length: 2,
    fire: (d, w) => fire(d, w, statusOn('kael', 'bleed', 6, 1)),
    then: [2, 3, 4, 5, 6, 7, 8].map((n, i) => ({
      delay: 0.05 * (i + 1),
      fire: (d: SynthDirector, w: FakeWorld) => fire(d, w, statusOn('kael', 'bleed', 6, n)),
    })),
  },
  {
    id: 'crimson-pinned',
    label: 'Pinned (the stake, its chain)',
    group: 'crimson',
    length: 1.5,
    fire: (d, w) => fire(d, w, statusOn('lyra', 'pinned', 4)),
  },
  {
    id: 'crimson-latched',
    label: 'Latched (a suck)',
    group: 'crimson',
    length: 1.5,
    fire: (d, w) => fire(d, w, statusOn('vexis', 'latched', 8)),
  },
  {
    id: 'crimson-wound',
    label: 'Wound (a muffled thud)',
    group: 'crimson',
    length: 1.5,
    fire: (d, w) => fire(d, w, statusOn('kael', 'wound', 4)),
  },
  {
    id: 'crimson-pact',
    label: 'Blood Pact (two hearts, one sound)',
    group: 'crimson',
    length: 1.5,
    fire: (d, w) => fire(d, w, statusOn('lyra', 'pact', 6), statusOn('vexis', 'pact', 6)),
  },
  {
    id: 'crimson-freed',
    label: 'Freed by a Reel (the chain snaps)',
    group: 'crimson',
    length: 1.5,
    fire: (d, w) =>
      fire(
        d,
        w,
        statusOn('lyra', 'pinned', 4),
        ev('statusRemoved', { target: IDS.lyra, status: 'pinned', reason: 'freed' }),
      ),
  },
  ...[2, 8].map((n): SoundButton => ({
    id: `crimson-release-${n}`,
    label: `Chime release: ${n} bleed stacks cleared`,
    group: 'crimson',
    length: 2.5,
    fire: (d, w) => fire(d, w, statusOn('kael', 'bleed', 6, n)),
    then: [
      {
        delay: 0.4,
        fire: (d, w) =>
          fire(
            d,
            w,
            ev('cleansed', { target: IDS.kael, removed: 1, clutch: false }),
            ev('statusRemoved', { target: IDS.kael, status: 'bleed', reason: 'cleansed' }),
          ),
      },
    ],
  })),
  {
    id: 'crimson-guard-block',
    label: 'Sentinel guard: a blocked hit (a dull clank, gated)',
    group: 'crimson',
    length: 1.5,
    fire: (d, w) => {
      const id = w.addEnemy('crimson_sentinel', 4);
      fire(d, w, ev('guardBlocked', { enemy: id, source: IDS.lyra }));
    },
  },
  {
    id: 'crimson-guard-break',
    label: 'Sentinel guard broken (a shatter)',
    group: 'crimson',
    length: 2,
    fire: (d, w) => {
      const id = w.addEnemy('crimson_sentinel', 4);
      fire(d, w, ev('guardBroken', { enemy: id }));
    },
  },
  {
    id: 'crimson-charge',
    label: 'Impaling Charge (a charge’s whoosh)',
    group: 'crimson',
    length: 1.5,
    fire: (d, w) => fire(d, w, moved('charge', 8, -6)),
  },
  {
    id: 'crimson-pounce',
    label: 'Pounce (the leap and its landing)',
    group: 'crimson',
    length: 1.5,
    fire: (d, w) => fire(d, w, moved('leap', -6, 3, 0.4)),
  },
  {
    id: 'crimson-tide',
    label: 'Crimson Tide (its windup, then the wave breaks, front then back)',
    group: 'crimson',
    length: 6,
    fire: (d, w) => fire(d, w, legionTele(w, 41, 'vharun_crimson_tide', 'kael')),
    then: [
      {
        delay: 1.6,
        fire: (d, w) => {
          w.removeTelegraph(41);
          fire(
            d,
            w,
            resolved(41, 'kael', 'hit'),
            legionTele(w, 42, 'vharun_crimson_tide_back', 'kael'),
          );
        },
      },
      {
        delay: 3.2,
        fire: (d, w) => {
          w.removeTelegraph(42);
          fire(d, w, resolved(42, null, 'dodged'));
        },
      },
    ],
  },
  {
    id: 'crimson-pack-call',
    label: 'Pack Call (the Matriarch’s howl stinger)',
    group: 'crimson',
    length: 3,
    fire: (d, w) => fire(d, w, legionTele(w, 43, 'gorehound_pack_call', null)),
    then: [{ delay: 1.2, fire: (_d, w) => w.removeTelegraph(43) }],
  },
  execution('executed'),
  execution('spared'),
  execution('fallen'),
  ...IRON_ENEMIES.map((e): SoundButton => ({
    id: `kill-iron-${e.id}`,
    label: `Kill ${e.name} (iron)`,
    group: 'crimson',
    length: e.role === 'boss' || e.role === 'miniboss' ? 4 : 2,
    fire: (d, w) => {
      const id = w.addEnemy(e.id, e.role === 'swarm' ? -6 : 6);
      fire(
        d,
        w,
        ev('enemyKilled', {
          enemy: id,
          defId: e.id,
          killer: null,
          x: e.role === 'swarm' ? -6 : 6,
          z: 5,
        }),
      );
    },
  })),
  // ── Phase 5c: the Unstitched ───────────────────────────────────────────────────
  ...(
    [
      ['shears', 1, 'Shears cut the Thread (a clean cut, a short fray)'],
      ['severing', 1, 'A Severing elite cuts the Thread (lighter)'],
      ['snip', 3, 'Snip (the great shears, the Thread’s chord cut short, a thud)'],
      ['unpick', 1, 'Unpick (a ripple of snaps)'],
    ] as const
  ).map(([cause, lock, label]): SoundButton => ({
    id: `unstitched-cut-${cause}`,
    label,
    group: 'unstitched',
    length: 2,
    fire: (d, w) => fire(d, w, cutOff(cause, lock)),
  })),
  {
    id: 'unstitched-strand',
    label: 'Guard Strand turns a cut aside (a ping off a taut strand)',
    group: 'unstitched',
    length: 1.5,
    fire: (d, w) =>
      fire(d, w, ev('cutResolved', { telegraph: 1, cause: 'shears', result: 'strand' })),
  },
  {
    id: 'unstitched-strand-bolt',
    label: 'Guard Strand destroys a bolt crossing the Thread',
    group: 'unstitched',
    length: 1.5,
    fire: (d, w) => fire(d, w, ev('strandBlocked', { source: IDS.enemyBase, x: 2, z: 1 })),
  },
  {
    id: 'unstitched-shears',
    label: 'Shearing Dash (the Retarget windup, then the shhk as it lands)',
    group: 'unstitched',
    length: 3,
    fire: (d, w) => fire(d, w, riftTele(w, 50, 'shears_dash', 'kael')),
    then: [
      {
        delay: 1,
        fire: (d, w) => {
          w.removeTelegraph(50);
          fire(d, w, resolved(50, 'kael', 'hit'), cutOff('shears', 1));
        },
      },
    ],
  },
  {
    id: 'unstitched-maw',
    label: 'Void Maw: Inhale (the tell, then the whoosh and the gated sub drone for 4 s)',
    group: 'unstitched',
    length: 7,
    fire: (d, w) => fire(d, w, riftTele(w, 51, 'maw_inhale', null)),
    then: [
      {
        delay: 1.4,
        fire: (d, w) => {
          w.removeTelegraph(51);
          fire(d, w, resolved(51, null, 'dodged'), zoneOn(w, 1, 'pull', 4));
        },
      },
      { delay: 5.4, fire: (d, w) => fire(d, w, ev('zoneEnded', { zone: 1, kind: 'pull' })) },
    ],
  },
  {
    id: 'unstitched-wraith',
    label: 'Doubt Wraith: Doubt (a whisper across the 4 s cast, then the possession on E–F, B–C)',
    group: 'unstitched',
    length: 6,
    fire: (d, w) =>
      fire(d, w, statusOn('lyra', 'doubt', 4), riftTele(w, 52, 'wraith_doubt', 'lyra')),
    then: [
      {
        delay: 4,
        fire: (d, w) => {
          w.removeTelegraph(52);
          fire(
            d,
            w,
            resolved(52, 'lyra', 'hit'),
            statusOn('lyra', 'possessed', 5),
            ev('possessed', { hero: IDS.lyra, source: IDS.enemyBase }),
          );
        },
      },
    ],
  },
  ...(['chime', 'reel'] as const).map((by): SoundButton => ({
    id: `unstitched-freed-${by}`,
    label:
      by === 'chime'
        ? 'Freed of a possession by a Chime (glass)'
        : 'Freed of a Stitch by a Reel (a thread’s snap)',
    group: 'unstitched',
    length: 1.5,
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('freed', {
          hero: IDS.lyra,
          status: by === 'chime' ? 'possessed' : 'stitched',
          by,
        }),
      ),
  })),
  {
    id: 'unstitched-rune',
    label: 'Null rune (its hum for 6 s; a Ward refused inside it, muffled)',
    group: 'unstitched',
    length: 7,
    fire: (d, w) => fire(d, w, zoneOn(w, 2, 'null', 6, 0)),
    then: [
      {
        delay: 1.5,
        fire: (d, w) =>
          fire(d, w, ev('techniqueRejected', { technique: 'ward', reason: 'silenced' })),
      },
      { delay: 6, fire: (d, w) => fire(d, w, ev('zoneEnded', { zone: 2, kind: 'null' })) },
    ],
  },
  {
    id: 'unstitched-silenced',
    label: 'A technique refused in a rune (muffled; not the cooldown buzz)',
    group: 'unstitched',
    length: 1,
    fire: (d, w) => fire(d, w, ev('techniqueRejected', { technique: 'chime', reason: 'silenced' })),
  },
  ...(['ward', 'chime', 'empower'] as const).map((copy): SoundButton => ({
    id: `unstitched-mimic-${copy}`,
    label: `Mimic: Mirror, copying your ${copy === 'empower' ? 'Empower' : copy === 'ward' ? 'Ward' : 'Chime'} (your sound, mirrored)`,
    group: 'unstitched',
    length: 3,
    fire: (d, w) => fire(d, w, riftTele(w, 53, 'mimic_mirror', null, mimicWith(w, copy))),
    then: [{ delay: 2, fire: (_d, w) => w.removeTelegraph(53) }],
  })),
  {
    id: 'unstitched-crack',
    label: 'The mirror cracks (a glass shatter)',
    group: 'unstitched',
    length: 2,
    fire: (d, w) => fire(d, w, ev('mirrorCracked', { enemy: mimicWith(w, 'ward'), copy: 'ward' })),
  },
  {
    id: 'unstitched-needles',
    label: 'Needle Rain (a patter of needles over its windup)',
    group: 'unstitched',
    length: 2.5,
    fire: (d, w) => fire(d, w, riftTele(w, 54, 'seamstress_needles', 'vexis')),
    then: [{ delay: 1.4, fire: (_d, w) => w.removeTelegraph(54) }],
  },
  {
    id: 'unstitched-stitched',
    label: 'Stitch pulled tight on two heroes (one sound)',
    group: 'unstitched',
    length: 1.5,
    fire: (d, w) => fire(d, w, statusOn('kael', 'stitched', 6), statusOn('lyra', 'stitched', 6)),
  },
  ...[1, 3, 4, 5].map((n): SoundButton => ({
    id: `unstitched-doom-${n}`,
    label: `Doom ×${n} (a tick a step up per stack${n >= 4 ? '; the Chime glint' : ''})`,
    group: 'unstitched',
    length: 1.5,
    fire: (d, w) => fire(d, w, statusOn('kael', 'doom', 10, n)),
  })),
  {
    id: 'unstitched-doomed',
    label: 'Doom ignites (the fuse, a thud, a dark bell)',
    group: 'unstitched',
    length: 2.5,
    fire: (d, w) => fire(d, w, statusOn('kael', 'doomed', 1.5)),
  },
  {
    id: 'unstitched-spindles',
    label: 'Spindles: the drone while they hold, a hit cut down, then the last one falls',
    group: 'unstitched',
    length: 5,
    fire: (d, w) => fire(d, w, ev('tethered', { enemy: IDS.enemyBase, count: 3 })),
    then: [
      {
        delay: 1.5,
        fire: (d, w) => fire(d, w, ev('spindled', { enemy: IDS.enemyBase, source: IDS.kael })),
      },
      {
        delay: 3.5,
        fire: (d, w) => fire(d, w, ev('tethered', { enemy: IDS.enemyBase, count: 0 })),
      },
    ],
  },
  {
    id: 'unstitched-steal',
    label: 'Steal Verse (the aura drawn out of the song), then given back',
    group: 'unstitched',
    length: 4,
    fire: (d, w) =>
      fire(d, w, ev('verseStolen', { aura: 'lab', add: IDS.enemyBase + 1, until: w.time + 30 })),
    then: [
      {
        delay: 2,
        fire: (d, w) => fire(d, w, ev('verseReturned', { aura: 'lab', reason: 'killed' })),
      },
    ],
  },
  {
    id: 'unstitched-unravel',
    label: 'Unravel opens (Mend turned over), then closes',
    group: 'unstitched',
    length: 3.5,
    fire: (d, w) => fire(d, w, ev('unravelled', { active: true, until: w.time + 5 })),
    then: [
      {
        delay: 2,
        fire: (d, w) => fire(d, w, ev('unravelled', { active: false, until: w.time })),
      },
    ],
  },
  {
    id: 'unstitched-mirror-ward',
    label: 'Mirror Ward on the champion (the Ward’s glass, inverted)',
    group: 'unstitched',
    length: 2,
    fire: (d, w) => fire(d, w, ev('mirrorWard', { enemy: IDS.enemyBase, amount: 600 })),
  },
  {
    id: 'unstitched-windup-thread',
    label: 'Windup answered by Retarget (the Thread drawn taut)',
    group: 'unstitched',
    length: 2,
    fire: (d, w) => fire(d, w, verbTele(['thread', 'move'])),
  },
  {
    id: 'unstitched-windup-empower',
    label: 'Windup answered by Empower (a swell turned over)',
    group: 'unstitched',
    length: 2,
    fire: (d, w) => fire(d, w, verbTele(['empower'], 1.6)),
  },
  ...CLOTH_ENEMIES.map((e): SoundButton => ({
    id: `kill-cloth-${e.id}`,
    label: `Kill ${e.name} (cloth: it tears)`,
    group: 'unstitched',
    length: e.role === 'boss' || e.role === 'miniboss' ? 4 : 2,
    fire: (d, w) => {
      const x = e.role === 'swarm' ? -6 : 6;
      const id = w.addEnemy(e.id, x);
      fire(d, w, ev('enemyKilled', { enemy: id, defId: e.id, killer: null, x, z: 5 }));
    },
  })),
  // ── Phase 5d: the Finale (the Silent Conductor, its mirror-choir, the Grand Silence) ──
  {
    id: 'finale-discord',
    label: 'Discord fed: a telegraph left unanswered (a soft half-step tick, E–F)',
    group: 'finale',
    length: 1.5,
    fire: (d, w) =>
      fire(d, w, ev('discordRose', { boss: IDS.enemyBase, telegraph: 1, amount: 20, value: 60 })),
  },
  {
    id: 'finale-rise',
    label: 'Discord swelling in the Mirror Choir (a pad note rising under the stems)',
    group: 'finale',
    length: 5,
    fire: (d) => d.sfxEngine()?.discordRise(85),
  },
  {
    id: 'finale-fortissimo',
    label: 'Fortissimo Silence: one pulse (a rising tutti, cut to nothing as it lands)',
    group: 'finale',
    length: 3,
    fire: (d, w) => fire(d, w, finaleTele(w, 41, FORTISSIMO[0], 1.5)),
    then: [{ delay: 1.5, fire: (d, w) => fire(d, w, finaleLands(w, 41)) }],
  },
  {
    id: 'finale-fortissimo-chain',
    label: 'Fortissimo Silence: its three pulses',
    group: 'finale',
    length: 6,
    fire: (d, w) => fire(d, w, finaleTele(w, 41, FORTISSIMO[0], 1.5)),
    then: [
      {
        delay: 1.5,
        fire: (d, w) => fire(d, w, finaleLands(w, 41), finaleTele(w, 42, FORTISSIMO[1], 1.5)),
      },
      {
        delay: 3,
        fire: (d, w) => fire(d, w, finaleLands(w, 42), finaleTele(w, 43, FORTISSIMO[2], 1.5)),
      },
      { delay: 4.5, fire: (d, w) => fire(d, w, finaleLands(w, 43)) },
    ],
  },
  {
    id: 'finale-fortissimo-cancel',
    label: 'Fortissimo Silence cancelled by your Crescendo (the tutti resolves into the song)',
    group: 'finale',
    length: 3.5,
    fire: (d, w) => fire(d, w, finaleTele(w, 41, FORTISSIMO[0], 1.5)),
    then: [
      {
        delay: 0.8,
        fire: (d, w) => {
          w.removeTelegraph(41);
          fire(
            d,
            w,
            ev('fortissimoCancelled', { boss: IDS.enemyBase, by: 'crescendo' }),
            ev('telegraphResolved', {
              telegraph: 41,
              outcome: 'cancelled',
              target: null,
              damage: 0,
            }),
          );
        },
      },
    ],
  },
  {
    id: 'finale-baton',
    label: 'The Conductor’s Downbeat (a baton’s stroke over its windup)',
    group: 'finale',
    length: 2,
    fire: (d, w) => fire(d, w, finaleTele(w, 44, DOWNBEAT, 1.4)),
  },
  ...CUED_VOICES.map((c): SoundButton => ({
    id: `finale-cue-${c.voice}`,
    label: `The Conductor Cues ${c.name}`,
    group: 'finale',
    length: 3,
    fire: (d, w) =>
      fire(
        d,
        w,
        ev('enemyCued', { boss: IDS.enemyBase, soloist: IDS.enemyBase + 1, solo: c.solo }),
      ),
  })),
  {
    id: 'finale-silence',
    label: 'The Grand Silence begins (the music stops: a baton’s cut-off)',
    group: 'finale',
    length: 3,
    fire: (d, w) => fire(d, w, silenceBegins(w)),
    then: [releaseSilence(2.8)],
  },
  ...NOTE_SOURCES.map((source): SoundButton => ({
    id: `finale-note-${source}`,
    label: `A note in the silence: the third (F4), made by ${
      source === 'perfect'
        ? 'a Perfect Ward (glass)'
        : source === 'clutch'
          ? 'a clutch Chime (a bell)'
          : source === 'reel'
            ? 'a Reel-save (a whoosh and a pluck)'
            : 'a Rewind that undid a blow (a reversed bell)'
    }`,
    group: 'finale',
    length: 3,
    fire: (d, w) => fire(d, w, silenceBegins(w), silenceNote(3, source)),
    then: [releaseSilence(2.8)],
  })),
  {
    id: 'finale-phrase',
    label: 'The eight notes: D4 up to D5, the song rebuilt stem by stem, then the Reignite',
    group: 'finale',
    length: 9,
    fire: (d, w) => fire(d, w, silenceBegins(w)),
    then: [
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
        delay: 0.2 + (n - 1) * 0.7,
        fire: (d: SynthDirector, w: FakeWorld) =>
          fire(d, w, silenceNote(n, NOTE_SOURCES[(n - 1) % 4] as LabNoteSource)),
      })),
      {
        delay: 5.6,
        fire: (d, w) => fire(d, w, ev('reignited', { boss: IDS.enemyBase, revived: [] })),
      },
    ],
  },
  {
    id: 'finale-silence-duck',
    label: 'A Perfect Ward in the silence (heard; its duck can’t reopen the music)',
    group: 'finale',
    length: 3,
    fire: (d, w) =>
      fire(
        d,
        w,
        silenceBegins(w),
        ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 400 }),
      ),
    then: [releaseSilence(2.8)],
  },
  {
    id: 'finale-reignite',
    label: 'Reignite: each party hero’s leitmotif in canon as they unfreeze',
    group: 'finale',
    length: 4,
    fire: (d, w) => fire(d, w, ev('reignited', { boss: IDS.enemyBase, revived: [] })),
  },
  {
    id: 'finale-coda',
    label: 'The Coda: the cap runs out (the music comes back without the song)',
    group: 'finale',
    length: 4,
    fire: (d, w) => fire(d, w, silenceBegins(w), silenceNote(1, 'perfect')),
    then: [
      {
        delay: 1,
        fire: (d, w) => fire(d, w, ev('silenceBroken', { boss: IDS.enemyBase, notes: 1 })),
      },
    ],
  },
  ...CUED_VOICES.map((c): SoundButton => ({
    id: `kill-glass-${c.voice}`,
    label: `Kill ${c.name.split(' (')[0]} (glass: it shatters into rising notes)`,
    group: 'finale',
    length: 2,
    fire: (d, w) => {
      const id = w.addEnemy('caster', 6);
      const e = w.entities.get(id);
      if (e?.enemy) Object.assign(e.enemy, { tier: 'elite', defId: c.voice });
      fire(d, w, ev('enemyKilled', { enemy: id, defId: c.voice, killer: null, x: 6, z: 5 }));
    },
  })),
  {
    id: 'kill-glass-boss',
    label: 'A glass boss’s death (the biggest shatter)',
    group: 'finale',
    length: 3,
    fire: (d) => d.sfxEngine()?.glassKill(3),
  },
  {
    id: 'finale-stinger',
    label:
      'The Finale’s stinger: the run’s last victory (every party leitmotif in canon, home on D)',
    group: 'finale',
    length: 9,
    fire: (d) => d.musicEngine()?.stingerOnBar('finale'),
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
      'atelierBuy',
      'atelierRefused',
      'keepsakeWear',
      'stationLit',
      'stationIntro',
      'starlightCount',
      'drillPerfect',
      'drillEarly',
      'drillLate',
      'drillMiss',
      'drillStreak',
      'drillBest',
      'atlasStar',
      'atlasConstellation',
      'runVerified',
      'runMismatch',
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
            s === 'bondRankUp' ||
            s === 'stationLit' ||
            s === 'drillBest'
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
  // ── Phase 4g: the Loom, its keepsakes and the Perfect-Ward trainer ──
  {
    id: 'loom-buy',
    label: 'atelierBuy: a keepsake bought at the Atelier (Starlight spent)',
    group: 'loom',
    length: 2,
    fire: (d) => d.playUi('atelierBuy'),
  },
  {
    id: 'loom-refused',
    label: 'atelierRefused: not enough Starlight (or locked)',
    group: 'loom',
    fire: (d) => d.playUi('atelierRefused'),
  },
  {
    id: 'loom-buy-compare',
    label: "Compare: the merchant's buy and cantAfford, then the Atelier's",
    group: 'loom',
    length: 4,
    fire: (d) => d.playUi('buy'),
    then: [
      { delay: 0.9, fire: (d) => d.playUi('cantAfford') },
      { delay: 1.8, fire: (d) => d.playUi('atelierBuy') },
      { delay: 2.9, fire: (d) => d.playUi('atelierRefused') },
    ],
  },
  ...(
    [
      [CONTENT.cosmetics.robes[0]?.id, 'a robe (it rustles and settles)'],
      [CONTENT.cosmetics.threads[0]?.id, 'a Thread look (it is plucked)'],
      [CONTENT.cosmetics.titles[0]?.id, 'a title (it rings)'],
    ] as const
  ).map(([keepsake, what], i): SoundButton => ({
    id: `loom-wear-${i}`,
    label: `keepsakeWear: ${what} (${keepsake ?? 'none'})`,
    group: 'loom',
    fire: (d) => d.playUi('keepsakeWear', null, { keepsake }),
  })),
  {
    id: 'loom-lit',
    label: 'stationLit: the hub opens with a station newly lit',
    group: 'loom',
    length: 3,
    fire: (d) => d.playUi('stationLit'),
  },
  {
    id: 'loom-intro',
    label: "stationIntro: a station's intro opens",
    group: 'loom',
    length: 2,
    fire: (d) => d.playUi('stationIntro'),
  },
  ...[3, 10, 20, 45].map((amount): SoundButton => ({
    id: `loom-count-${amount}`,
    label: `starlightCount: +${amount} Starlight counted on the Result`,
    group: 'loom',
    length: 2,
    fire: (d) => d.playUi('starlightCount', null, { amount }),
  })),
  {
    id: 'loom-count-ticks',
    label: 'starlightCount: called on every step of a count-up (20 in 0.6 s: gated, two voices)',
    group: 'loom',
    length: 2,
    fire: (d) => d.playUi('starlightCount', null, { amount: 1 }),
    then: Array.from({ length: 19 }, (_, i) => ({
      delay: Math.round((i + 1) * 0.03 * 1000) / 1000,
      fire: (d: SynthDirector) => d.playUi('starlightCount', null, { amount: i + 2 }),
    })),
  },
  {
    id: 'drill-perfect',
    label: 'drillPerfect: a try judged Perfect',
    group: 'loom',
    fire: (d) => d.playUi('drillPerfect'),
  },
  ...[40, 180, 400].flatMap((ms): SoundButton[] => [
    {
      id: `drill-early-${ms}`,
      label: `drillEarly: early by ${ms} ms (it slides up into the note)`,
      group: 'loom',
      fire: (d) => d.playUi('drillEarly', null, { ms }),
    },
    {
      id: `drill-late-${ms}`,
      label: `drillLate: late by ${ms} ms (the note sags after it)`,
      group: 'loom',
      fire: (d) => d.playUi('drillLate', null, { ms }),
    },
  ]),
  {
    id: 'drill-miss',
    label: 'drillMiss: no Ward reached them',
    group: 'loom',
    fire: (d) => d.playUi('drillMiss'),
  },
  ...[5, 10, 25].map((streak): SoundButton => ({
    id: `drill-streak-${streak}`,
    label: `drillStreak: ${streak} Perfects in a row`,
    group: 'loom',
    length: 3,
    fire: (d) => d.playUi('drillStreak', null, { streak }),
  })),
  {
    id: 'drill-best',
    label: 'drillBest: a new best streak',
    group: 'loom',
    length: 3,
    fire: (d) => d.playUi('drillBest'),
  },
  {
    id: 'drill-run',
    label: 'The trainer: early, late, then five Perfects (the milestone, a new best), then a miss',
    group: 'loom',
    length: 9,
    fire: (d) => d.playUi('drillEarly', null, { ms: 120 }),
    then: [
      { delay: 1, fire: (d: SynthDirector) => d.playUi('drillLate', null, { ms: 60 }) },
      ...[2, 3, 4, 5, 6].map((delay) => ({
        delay,
        fire: (d: SynthDirector) => d.playUi('drillPerfect'),
      })),
      { delay: 6.25, fire: (d: SynthDirector) => d.playUi('drillStreak', null, { streak: 5 }) },
      { delay: 6.9, fire: (d: SynthDirector) => d.playUi('drillBest') },
      { delay: 8, fire: (d: SynthDirector) => d.playUi('drillMiss') },
    ],
  },
  // ── Phase 5b: Brann, the Bloodsworn (he joins the lab party for these) ──────────────
  {
    id: 'brann-cue',
    label: 'Cue Brann: his leitmotif (A2 C3 D3 E3, low bowed strings and a drum)',
    group: 'brann',
    length: 3,
    fire: (d, w) => {
      withBrann(w);
      fire(d, w, ev('cued', { hero: IDS.brann }));
    },
  },
  {
    id: 'brann-call',
    label: 'Brann calls (question only): A2 C3 D3 F3 … E3',
    group: 'brann',
    length: 4,
    fire: (d, w) => {
      withBrann(w);
      fire(d, w, brannCall());
    },
  },
  {
    id: 'brann-call-answer',
    label: 'Brann calls → your Ward answers (to D3), and Red Comet lands',
    group: 'brann',
    length: 6,
    fire: (d, w) => {
      withBrann(w);
      fire(d, w, brannCall());
    },
    then: [
      {
        delay: 1.6,
        fire: (d, w) =>
          fire(
            d,
            w,
            ev('callAnswered', {
              hero: IDS.brann,
              answer: 'ward',
              flourish: 'Red Comet',
              after: 1.6,
            }),
          ),
      },
      {
        delay: 1.9,
        fire: (d, w) => {
          fire(d, w, brannAttack(w, 'leap', 0.45));
          fire(
            d,
            w,
            ev('flourish', { hero: IDS.brann, name: 'Red Comet', x: 2, z: 3, radius: 4.5 }),
          );
        },
      },
    ],
  },
  {
    id: 'brann-flourish',
    label: 'Flourish: Red Comet (the fall, the war drum’s slam, his A2 and E3)',
    group: 'brann',
    length: 3,
    fire: (d, w) => {
      withBrann(w);
      fire(d, w, ev('flourish', { hero: IDS.brann, name: 'Red Comet', x: 2, z: 3, radius: 4.5 }));
    },
  },
  {
    id: 'brann-leap',
    label: 'Sunder Leap (the bow drawn as he rises, the slam where he lands)',
    group: 'brann',
    length: 2,
    fire: (d, w) => fire(d, w, brannAttack(w, 'leap', 0.45)),
  },
  {
    id: 'brann-hit',
    label: 'Brann takes a hit (his own thump, on E2)',
    group: 'brann',
    fire: (d, w) => {
      withBrann(w);
      fire(
        d,
        w,
        ev('damageTaken', {
          target: IDS.brann,
          source: IDS.enemyBase,
          amount: 160,
          absorbed: 0,
          amplified: 0,
          aura: 0,
          radiance: 0,
          eclipse: 0,
          crit: false,
          telegraph: null,
          hit: 'hit',
        }),
      );
    },
  },
  {
    id: 'brann-bloodletting',
    label: 'Bloodletting: he spends his own life (a hiss, a low E2 pluck)',
    group: 'brann',
    length: 2,
    fire: (d, w) => {
      withBrann(w);
      fire(d, w, ev('lifeSpent', { hero: IDS.brann, amount: 125 }));
    },
  },
  frenzyButton(false),
  frenzyButton(true),
  {
    id: 'brann-lifesteal',
    label: 'Lifesteal: his axe drinks (a small sip, E3 to A3)',
    group: 'brann',
    fire: (d, w) => {
      withBrann(w);
      fire(d, w, lifestealEv());
    },
  },
  {
    id: 'brann-lifesteal-burst',
    label: 'Lifesteal: 20 in a second (the gate holds: one sip a quarter second)',
    group: 'brann',
    length: 2,
    fire: (d, w) => {
      withBrann(w);
      fire(d, w, lifestealEv());
    },
    then: Array.from({ length: 19 }, (_, i) => ({
      delay: Math.round((i + 1) * 0.05 * 1000) / 1000,
      fire: (d: SynthDirector, w: FakeWorld) => fire(d, w, lifestealEv()),
    })),
  },
  {
    id: 'brann-refused',
    label: 'Bloodlust: he refuses your Rally (two war-drum strokes and a growl)',
    group: 'brann',
    length: 2,
    fire: (d, w) => {
      withBrann(w);
      fire(d, w, ev('bloodlust', { hero: IDS.brann }));
    },
  },
  {
    id: 'brann-tithe',
    label: 'Blood Tithe: the Ward on him broke and paid you back (your chime, his A2 under it)',
    group: 'brann',
    length: 2,
    fire: (d, w) => {
      withBrann(w);
      fire(d, w, ev('titheRefund', { target: IDS.brann, spirit: 10, life: 0 }));
    },
  },
  brannLow('brann-drum-raging', 'His war drum at 35% (raging: slow, no alarm)', 0.35),
  brannLow('brann-drum-deep', 'His war drum at 18% (quicker, still no alarm)', 0.18),
  brannLow('brann-critical', 'Brann at 10% (below his 15% line: the alert, then the drum)', 0.1),
  brannLow('brann-falling-fast', 'Brann at 30% falling fast (the alert)', 0.3, (w) =>
    w.setBleedRate(400),
  ),
  brannLow('brann-lethal', 'Brann at 30% with a lethal hit coming (the alert)', 0.3, (w) =>
    w.setIncoming('brann', 1000),
  ),
  brannLow(
    'brann-silk',
    'Blood and Silk: Empowering him under 30% (the Thread ticks once a second)',
    0.2,
    (w) => {
      w.mods = { bloodAndSilk: 3 };
      w.setThread('brann', 'empower');
    },
    3.2,
  ),
  // ── Phase 5e: Seren, the Riposte (she joins the lab party for these) ───────────────
  {
    id: 'seren-cue',
    label: 'Cue Seren: her leitmotif (F4 A4 G4 C5, quick and dotted, a struck string and steel)',
    group: 'seren',
    length: 3,
    fire: (d, w) => {
      withHero(w, 'seren');
      fire(d, w, ev('cued', { hero: IDS.seren }));
    },
  },
  {
    id: 'seren-call',
    label: 'Seren calls (question only): F4 A4 G4 … E5',
    group: 'seren',
    length: 4,
    fire: (d, w) => {
      withHero(w, 'seren');
      fire(d, w, serenCall());
    },
  },
  {
    id: 'seren-call-answer',
    label: 'Seren calls → your Ward answers (to D5), and Flèche lands',
    group: 'seren',
    length: 6,
    fire: (d, w) => {
      withHero(w, 'seren');
      fire(d, w, serenCall());
    },
    then: [
      {
        delay: 1.4,
        fire: (d, w) =>
          fire(
            d,
            w,
            ev('callAnswered', {
              hero: IDS.seren,
              answer: 'ward',
              after: 1.4,
              flourish: 'Flèche',
            }),
          ),
      },
      {
        delay: 1.9,
        fire: (d, w) => {
          fire(d, w, serenAttack(w, 'lunge', 0.2));
          fire(d, w, ev('flourish', { hero: IDS.seren, name: 'Flèche', x: 2, z: 3, radius: 0 }));
        },
      },
    ],
  },
  {
    id: 'seren-flourish',
    label: 'Flèche: the running thrust (air torn, her F5 and C6 struck, a stun’s knock)',
    group: 'seren',
    length: 3,
    fire: (d, w) => {
      withHero(w, 'seren');
      fire(d, w, ev('flourish', { hero: IDS.seren, name: 'Flèche', x: 2, z: 3, radius: 0 }));
    },
  },
  {
    id: 'seren-hit',
    label: 'Seren takes a hit (her own thump, on C3)',
    group: 'seren',
    fire: (d, w) => {
      withHero(w, 'seren');
      fire(d, w, hitOn(IDS.seren, 140));
    },
  },
  {
    id: 'seren-parry',
    label: 'Parry: Warded, a blow turned aside (steel on steel, C6 over F5)',
    group: 'seren',
    length: 2,
    fire: (d, w) => {
      withHero(w, 'seren');
      fire(d, w, ev('parried', { hero: IDS.seren, attacker: IDS.enemyBase, negated: 240 }));
    },
  },
  {
    id: 'seren-parry-counter',
    label: 'Parry → counter: the blow turned aside, then her cut answering it threefold',
    group: 'seren',
    length: 2,
    fire: (d, w) => {
      withHero(w, 'seren');
      fire(d, w, ev('parried', { hero: IDS.seren, attacker: IDS.enemyBase, negated: 240 }));
    },
    then: [
      {
        delay: 0.02,
        fire: (d, w) =>
          fire(d, w, ev('parryCountered', { hero: IDS.seren, target: IDS.enemyBase, amount: 180 })),
      },
    ],
  },
  {
    id: 'seren-parry-burst',
    label: 'Parry: 20 in a second (the gate holds: at most two at once)',
    group: 'seren',
    length: 2,
    fire: (d, w) => {
      withHero(w, 'seren');
      fire(d, w, ev('parried', { hero: IDS.seren, attacker: IDS.enemyBase, negated: 240 }));
    },
    then: Array.from({ length: 19 }, (_, i) => ({
      delay: Math.round((i + 1) * 0.05 * 1000) / 1000,
      fire: (d: SynthDirector, w: FakeWorld) =>
        fire(d, w, ev('parried', { hero: IDS.seren, attacker: IDS.enemyBase, negated: 240 })),
    })),
  },
  ...([true, false] as const).map((executed): SoundButton => ({
    id: `seren-killshot${executed ? '' : '-heavy'}`,
    label: executed
      ? 'Kill shot: a Perfect Ward on her, and the foe falls (under the Perfect’s chord)'
      : 'Kill shot on a heavy foe: struck six times over, not executed (a heavier knock)',
    group: 'seren',
    length: 3,
    fire: (d, w) => {
      withHero(w, 'seren');
      if (!w.entities.has(IDS.enemyBase)) w.setEnemies(3);
      fire(d, w, ev('perfectWard', { target: IDS.seren, telegraph: 1, negated: 300 }));
    },
    then: [
      {
        delay: 0.02,
        fire: (d, w) =>
          fire(
            d,
            w,
            ev('killShot', {
              hero: IDS.seren,
              target: IDS.enemyBase,
              executed,
              amount: executed ? 900 : 1080,
            }),
          ),
      },
    ],
  })),
  {
    id: 'seren-killshot-lost',
    label: 'Kill shot lost: she was stilled when it came (only a muted pluck)',
    group: 'seren',
    length: 2,
    fire: (d, w) => {
      withHero(w, 'seren');
      fire(
        d,
        w,
        ev('killShot', {
          hero: IDS.seren,
          target: IDS.enemyBase,
          executed: false,
          amount: 0,
          lost: 'disabled',
        }),
      );
    },
  },
  {
    id: 'seren-lunge',
    label: 'Lunge: the dash and the thrust (a rush of air, her F5 on landing)',
    group: 'seren',
    length: 2,
    fire: (d, w) => fire(d, w, serenAttack(w, 'lunge', 0.2)),
  },
  {
    id: 'seren-feint',
    label: 'Feint: a light step to the flank and a flick (A4 then F5)',
    group: 'seren',
    length: 2,
    fire: (d, w) => fire(d, w, serenAttack(w, 'feint', 0.15)),
  },
  {
    id: 'seren-showboat',
    label: 'Showboat: she picks her duel (a salute, F5 then C6)',
    group: 'seren',
    length: 2,
    fire: (d, w) => {
      withHero(w, 'seren');
      if (!w.entities.has(IDS.enemyBase)) w.setEnemies(3);
      fire(d, w, ev('duelChosen', { hero: IDS.seren, target: IDS.enemyBase }));
    },
  },
  cutsButton(false),
  cutsButton(true),
  serenLow('seren-heartbeat', 'Seren at 20%: her heartbeat, a light tick of steel', 0.2),
  // ── Phase 5e: Oro, the Grovekeeper (he joins the lab party, his Saplings with him) ──
  {
    id: 'oro-cue',
    label: 'Cue Oro: his leitmotif (G3 A3 B3 E4, slow, hollow wood and leaves)',
    group: 'oro',
    length: 4,
    fire: (d, w) => {
      withHero(w, 'oro');
      fire(d, w, ev('cued', { hero: IDS.oro }));
    },
  },
  {
    id: 'oro-call',
    label: 'Oro calls (question only): G3 A3 B3 … C4',
    group: 'oro',
    length: 4,
    fire: (d, w) => {
      withHero(w, 'oro');
      fire(d, w, oroCall());
    },
  },
  {
    id: 'oro-call-answer',
    label: 'Oro calls → your Chime answers (to D4), and Spring Rain falls',
    group: 'oro',
    length: 6,
    fire: (d, w) => {
      withHero(w, 'oro');
      fire(d, w, oroCall());
    },
    then: [
      {
        delay: 1.8,
        fire: (d, w) =>
          fire(
            d,
            w,
            ev('callAnswered', {
              hero: IDS.oro,
              answer: 'chime',
              after: 1.8,
              flourish: 'Spring Rain',
            }),
          ),
      },
      {
        delay: 2.3,
        fire: (d, w) =>
          fire(d, w, ev('flourish', { hero: IDS.oro, name: 'Spring Rain', x: 0, z: 4, radius: 0 })),
      },
    ],
  },
  {
    id: 'oro-flourish',
    label: 'Spring Rain: rain on leaves, his G3 and D4 on hollow wood',
    group: 'oro',
    length: 3,
    fire: (d, w) => {
      withHero(w, 'oro');
      fire(d, w, ev('flourish', { hero: IDS.oro, name: 'Spring Rain', x: 0, z: 4, radius: 0 }));
    },
  },
  {
    id: 'oro-hit',
    label: 'Oro takes a hit (his own thump, on F2)',
    group: 'oro',
    fire: (d, w) => {
      withHero(w, 'oro');
      fire(d, w, hitOn(IDS.oro, 140));
    },
  },
  {
    id: 'oro-sprout',
    label: 'A Sapling sprouts (a soft knock, D4 then G4, a leaf’s breath)',
    group: 'oro',
    length: 2,
    fire: (d, w) => {
      withHero(w, 'oro');
      fire(d, w, ev('summonSpawned', { owner: IDS.oro, summon: IDS.sapling, kind: 'sapling' }));
    },
  },
  {
    id: 'oro-sapling-hurt',
    label: 'Saplings struck: 20 blows in a second (a dull tock; heavily gated)',
    group: 'oro',
    length: 2,
    fire: (d, w) => {
      withHero(w, 'oro');
      fire(d, w, hitOn(IDS.sapling, 30));
    },
    then: Array.from({ length: 19 }, (_, i) => ({
      delay: Math.round((i + 1) * 0.05 * 1000) / 1000,
      fire: (d: SynthDirector, w: FakeWorld) => fire(d, w, hitOn(IDS.sapling + (i % 2), 30)),
    })),
  },
  {
    id: 'oro-sapling-fell',
    label: 'A Sapling felled (the wood cracks, D4 falling to G3)',
    group: 'oro',
    length: 2,
    fire: (d, w) => {
      withHero(w, 'oro');
      fire(d, w, ev('summonFell', { owner: IDS.oro, summon: IDS.sapling, kind: 'sapling' }));
    },
  },
  {
    id: 'oro-rootbond',
    label: 'Rootbond: your Mend on Oro reaches his Saplings (sap rising, G3 to D4; gated)',
    group: 'oro',
    length: 2,
    fire: (d, w) => {
      withHero(w, 'oro');
      fire(d, w, groveHeal(IDS.sapling), groveHeal(IDS.sapling + 1));
    },
    then: Array.from({ length: 9 }, (_, i) => ({
      delay: Math.round((i + 1) * 0.1 * 1000) / 1000,
      fire: (d: SynthDirector, w: FakeWorld) => fire(d, w, groveHeal(IDS.sapling + (i % 2))),
    })),
  },
  {
    id: 'oro-burrow',
    label: 'Rally: his Saplings burrow and re-plant at your front (earth, a G2 knock)',
    group: 'oro',
    length: 2,
    fire: (d, w) => {
      withHero(w, 'oro');
      w.setBurrow(0, w.time + 0.8);
      w.setBurrow(1, w.time + 0.8);
      d.update(w.state, 0.1);
    },
    then: [
      {
        delay: 1,
        fire: (_d, w) => {
          w.setBurrow(0, undefined);
          w.setBurrow(1, undefined);
        },
      },
    ],
  },
  ...([false, true] as const).map((cued): SoundButton => ({
    id: `oro-wildgrowth${cued ? '-cued' : ''}`,
    label: `Wildgrowth${cued ? ', cued (with the Cue’s leitmotif)' : ''}: the ground warns, the Ancient rises and roots, then withers`,
    group: 'oro',
    length: 10,
    fire: (d, w) => {
      withHero(w, 'oro');
      if (!w.entities.has(IDS.enemyBase)) w.setEnemies(3);
      if (cued) fire(d, w, ev('cued', { hero: IDS.oro }));
      fire(d, w, ev('soloStarted', { hero: IDS.oro, solo: 'wildgrowth', cued, duration: 8 }));
    },
    then: [
      {
        delay: 1,
        fire: (d, w) => {
          w.setAncient(true);
          fire(
            d,
            w,
            ev('summonSpawned', { owner: IDS.oro, summon: IDS.ancient, kind: 'ancient' }),
            ...[0, 1, 2].map((i) => ev('rooted', { target: IDS.enemyBase + i, seconds: 1.5 })),
          );
        },
      },
      {
        delay: 9,
        fire: (d, w) => {
          fire(d, w, ev('summonFell', { owner: IDS.oro, summon: IDS.ancient, kind: 'ancient' }));
          w.setAncient(false);
        },
      },
    ],
  })),
  {
    id: 'oro-bramble-root',
    label: 'Bramble: the lesser enemies rooted (roots creaking up, a dark G2)',
    group: 'oro',
    length: 2,
    fire: (d, w) => {
      withHero(w, 'oro');
      if (!w.entities.has(IDS.enemyBase)) w.setEnemies(3);
      fire(d, w, ...[0, 1].map((i) => ev('rooted', { target: IDS.enemyBase + i, seconds: 1.5 })));
    },
  },
  {
    id: 'oro-gentle',
    label: 'Gentle: with no Focus, he won’t raise a hand (two soft knocks falling)',
    group: 'oro',
    length: 2,
    fire: (d, w) => {
      withHero(w, 'oro');
      fire(d, w, ev('gentleRefused', { hero: IDS.oro }));
    },
  },
  oroLow('oro-heartbeat', 'Oro at 20%: his heartbeat, a wooden knock', 0.2),
  oroLow(
    'oro-saplings-low',
    'His Saplings at 10% (a summon has no heartbeat and no alert: silence)',
    1,
    (w) => {
      w.setSaplingHp(0, 0.1);
      w.setSaplingHp(1, 0.1);
    },
  ),
  // ── Phase 5f: the Conductor ────────────────────────────────────────────────────
  ...conductorSounds(),
  ...fillSounds(),
  ...fillStateSounds(),
  // ── Phase 6: Tyrant, the Postlude, the Atlas ───────────────────────────────────
  ...phase6Sounds(),
];

/**
 * Phase 5f: the lab world's `field.conducting` for one button (a chain, a running Solo, Triad),
 * cleared after it so no other button hears it.
 */
function withConducting(
  w: FakeWorld,
  field: Omit<ConductingField, 'solos'> & {
    solos?: ConductingField['solos'];
  },
  fn: () => void,
): void {
  w.conducting = { solos: [], ...field };
  try {
    fn();
  } finally {
    w.conducting = undefined;
  }
}

const cued = (hero: number) => ev('cued', { hero });
const chained = (hero: number, link: 1 | 2 | 3, onBeat = false) =>
  ev('cueChained', {
    hero,
    link,
    power: link === 3 ? 1.5 : link === 2 ? 1.25 : 1,
    cost: onBeat ? 0 : 15,
    onBeat,
    until: 3,
  });

/** Phase 5f: a Grand Finale of `turns` turns, a second apart, then its end (and the Crescendo's). */
function finaleButton(id: string, label: string, turns: number): SoundButton {
  const party = [IDS.kael, IDS.lyra, IDS.vexis];
  return {
    id,
    label,
    group: 'conductor',
    length: turns + 4,
    fire: (d, w) => fire(d, w, ev('crescendoStart', { calling: 'Grand Finale', duration: 12 })),
    then: [
      ...Array.from({ length: turns }, (_, i) => ({
        delay: Math.round((0.1 + i) * 100) / 100,
        fire: (d: SynthDirector, w: FakeWorld) => {
          const hero = party[i % 3]!;
          fire(
            d,
            w,
            ev('soloStarted', { hero, solo: 'galeBarrage', cued: true, duration: 3 }),
            ev('finaleTurn', { hero, turn: i + 1, power: 1.2 ** i, pass: i < 3 ? 1 : 2 }),
          );
        },
      })),
      {
        delay: Math.round((turns + 0.4) * 100) / 100,
        fire: (d: SynthDirector, w: FakeWorld) =>
          fire(d, w, ev('finaleEnded', { fired: turns, lost: 0 }), ev('crescendoEnd', {})),
      },
    ],
  };
}

function conductorSounds(): SoundButton[] {
  return [
    {
      id: 'conduct-duet',
      label: 'Duet: Lyra Cued 1 s after Kael (her phrase, answered a third above in his horn)',
      group: 'conductor',
      length: 3,
      fire: (d, w) =>
        withConducting(w, { chain: { heroes: [IDS.kael, IDS.lyra], at: w.time } }, () =>
          fire(d, w, cued(IDS.lyra), chained(IDS.lyra, 2)),
        ),
    },
    {
      id: 'conduct-trio',
      label: 'Trio: Vexis Cued after Kael and Lyra (their D, A and B swell, resolving on the bar)',
      group: 'conductor',
      length: 6,
      fire: (d, w) =>
        withConducting(w, { chain: { heroes: [IDS.kael, IDS.lyra, IDS.vexis], at: w.time } }, () =>
          fire(d, w, cued(IDS.vexis), chained(IDS.vexis, 3)),
        ),
    },
    {
      id: 'conduct-free',
      label: 'A free Cue on the downbeat (A Tempo): a bright glass chime on Lyra’s phrase',
      group: 'conductor',
      length: 2.5,
      fire: (d, w) =>
        withConducting(w, { chain: { heroes: [IDS.lyra], at: w.time } }, () =>
          fire(d, w, cued(IDS.lyra), chained(IDS.lyra, 1, true)),
        ),
    },
    {
      id: 'conduct-tick',
      label: 'The downbeat (A Tempo): a soft baton tick, four bars',
      group: 'conductor',
      length: 3,
      fire: (d) => d.sfxEngine()?.conduct.downbeat(),
      then: [0.68, 1.36, 2.04].map((delay) => ({
        delay,
        fire: (d: SynthDirector) => d.sfxEngine()?.conduct.downbeat(),
      })),
    },
    finaleButton(
      'conduct-finale',
      'Grand Finale: two baton taps, Kael, Lyra, Vexis a second apart, each a degree higher, then the cadence on D',
      3,
    ),
    finaleButton(
      'conduct-maestro',
      'Grand Finale with Maestro: every hero twice, still rising (six turns), then the cadence',
      6,
    ),
    {
      id: 'conduct-lost',
      label: 'A Finale turn lost (Vexis down): a muted string',
      group: 'conductor',
      length: 1.5,
      fire: (d, w) => fire(d, w, ev('finaleTurnLost', { hero: IDS.vexis, reason: 'down' })),
    },
    {
      id: 'conduct-cadence',
      label: 'The Finale ends: the cadence on D and the shimmer (every Solo full)',
      group: 'conductor',
      length: 4,
      fire: (d, w) => fire(d, w, ev('finaleEnded', { fired: 3, lost: 0 })),
    },
    {
      id: 'conduct-reprise',
      label: 'Reprise: the Trio’s chord again, plucked an octave up',
      group: 'conductor',
      length: 2.5,
      fire: (d, w) =>
        fire(d, w, ev('reprised', { charge: 30, heroes: [IDS.kael, IDS.lyra, IDS.vexis] })),
    },
    {
      id: 'conduct-marcato',
      label: 'Marcato given: a short accented chord stab',
      group: 'conductor',
      length: 1.5,
      fire: (d, w) =>
        fire(
          d,
          w,
          ev('marcato', { heroes: [IDS.kael, IDS.lyra, IDS.vexis], until: 4, readyAt: 8 }),
        ),
    },
    {
      id: 'conduct-ensemble',
      label: 'Ensemble: Kael, Lyra, Vexis Cued in a row (a held chord gaining a note each)',
      group: 'conductor',
      length: 4,
      fire: (d, w) => fire(d, w, ev('ensemble', { heroes: [IDS.kael], bonus: 0.05 })),
      then: [
        {
          delay: 0.8,
          fire: (d, w) => fire(d, w, ev('ensemble', { heroes: [IDS.kael, IDS.lyra], bonus: 0.1 })),
        },
        {
          delay: 1.6,
          fire: (d, w) =>
            fire(d, w, ev('ensemble', { heroes: [IDS.kael, IDS.lyra, IDS.vexis], bonus: 0.15 })),
        },
      ],
    },
    {
      id: 'conduct-spotlight',
      label: 'Spotlight: a held high note under Lyra’s Cued Solo (3 s)',
      group: 'conductor',
      length: 4.5,
      fire: (d, w) =>
        withConducting(w, { solos: [{ hero: IDS.lyra, power: 1, spotlight: true }] }, () =>
          fire(
            d,
            w,
            ev('soloStarted', { hero: IDS.lyra, solo: 'galeBarrage', cued: true, duration: 3 }),
          ),
        ),
      then: [
        {
          delay: 3,
          fire: (d, w) => fire(d, w, ev('soloEnded', { hero: IDS.lyra })),
        },
      ],
    },
    {
      id: 'conduct-triad',
      label: 'Triad holds the meter: a soft sustained D minor triad (4 s), then it lets go',
      group: 'conductor',
      length: 6,
      fire: (d, w) => fire(d, w, ev('triad', { on: true })),
      then: [{ delay: 4, fire: (d, w) => fire(d, w, ev('triad', { on: false })) }],
    },
    ...(
      [
        ['callingSelect', 'Chosen in Prep'],
        ['callingReveal', 'Its path opens'],
        ['callingPick', 'A pick taken'],
      ] as const
    ).map(([s, label]): SoundButton => ({
      id: `conduct-ui-${s}`,
      label: `UI: ${label} (the Conductor's ${s}: baton taps, then a chord)`,
      group: 'conductor',
      length: 3,
      fire: (d) => d.playUi(s, 'conductor'),
    })),
  ];
}

/**
 * Phase 5g: the fill's sounds the audio reads from state (no event carries them), played as their
 * read would play them: Concert Pitch's Ringing struck, then struck again while it still rings;
 * Spare Strings; Water Clock.
 */
function fillStateSounds(): SoundButton[] {
  return [
    {
      id: 'fillstate-ringing',
      label:
        'Concert Pitch rings out after a Perfect Ward (a soft handbell on D5, glass D6 over it)',
      group: 'fillState',
      length: 3,
      fire: (d) => d.sfxEngine()?.fill.ringing(),
    },
    {
      id: 'fillstate-ringing-restrike',
      label:
        'Concert Pitch: a second Perfect while it still rings (the bell, then a softer re-strike)',
      group: 'fillState',
      length: 3.5,
      fire: (d) => d.sfxEngine()?.fill.ringing(),
      then: [{ delay: 1.2, fire: (d) => d.sfxEngine()?.fill.ringing(true) }],
    },
    {
      id: 'fillstate-spare',
      label:
        'Spare Strings catches the Thread as it snaps at range (a knot, a plucked fourth A4 D5)',
      group: 'fillState',
      length: 1.5,
      fire: (d) => d.sfxEngine()?.fill.spare(),
    },
    {
      id: 'fillstate-clock',
      label: 'Water Clock turns time back for a hero who went down (glass D6 C6 A5, a handbell D5)',
      group: 'fillState',
      length: 2.5,
      fire: (d) => d.sfxEngine()?.fill.clock(),
    },
  ];
}

/**
 * Phase 5g (docs/phase-5g.md, W9): the content fill. Razor Silk's bite is played as its tick
 * would (the lab world has no Thread); the catch and each trigger kind go through the director as
 * their events, a trigger kind's from the first entry of the doc's tables that applies it.
 */
function fillSounds(): SoundButton[] {
  const sourceOf = (kind: string) =>
    Object.keys(TRIGGER_KINDS).find((id) => TRIGGER_KINDS[id] === kind) ?? kind;
  return [
    {
      id: 'fill-razor',
      label: 'Razor Silk bites what the Thread touches (each 0.5 s tick: a blade’s zing)',
      group: 'fill',
      length: 1.5,
      fire: (d) => d.sfxEngine()?.fill.razor(),
    },
    {
      id: 'fill-needle',
      label: 'Thread the Needle catches a hit on Lyra (the Thread drawn through, A5 to D6)',
      group: 'fill',
      length: 1.5,
      fire: (d, w) => fire(d, w, ev('needled', { hero: IDS.lyra, telegraph: 1, negated: 60 })),
    },
    ...TRIGGER_EFFECT_KINDS.map((kind): SoundButton => ({
      id: `fill-trigger-${kind}`,
      label: `A trigger fires: ${kind} (${sourceOf(kind)}, on Kael)`,
      group: 'fill',
      length: 1.5,
      fire: (d, w) =>
        fire(d, w, ev('motifTriggered', { source: sourceOf(kind), target: IDS.kael })),
    })),
    {
      id: 'fill-trigger-generic',
      label: 'A trigger fires from a source nothing names (the generic glass ping)',
      group: 'fill',
      length: 1.5,
      fire: (d, w) => fire(d, w, ev('motifTriggered', { source: 'unnamed_source' })),
    },
  ];
}

/**
 * Phase 6 (docs/phase-6.md): Tyrant's edict and the boss's voice under a cast of its borrowed
 * attack (one boss of each material: the attack's own sound is the foe's, as for any cast of it),
 * the Postlude's rise (the music's stems reopening as it rises when the Crucible plays), its stems
 * after the rise and once enraged, a pair Cue's two voices answering, and the Atlas's UI sounds.
 */
function phase6Sounds(): SoundButton[] {
  const tyrantCast =
    (boss: string, from: string, attack: string, windup = 1.6) =>
    (d: SynthDirector, w: FakeWorld) => {
      const id = w.addTyrant(boss, from, attack, 2);
      const t = w.addTelegraph(700, windup, { attackId: attack, name: attack });
      t.owner = id;
      fire(
        d,
        w,
        ev('telegraphStarted', {
          telegraph: 700,
          owner: id,
          target: IDS.kael,
          name: attack,
          kind: t.kind,
          shape: t.shape,
          start: t.start,
          impact: t.impact,
          perfectFrom: t.perfectFrom,
          damage: t.damage,
          pctMaxHp: 0,
          answers: t.answers,
          effect: 'damage',
        }),
      );
    };
  const casts: [string, string, string, string][] = [
    ['the_bellwarden', 'glass_lancer', 'lancer_lance', 'porcelain: a low bell'],
    ['vharun_crimson_warden', 'leech', 'leech_latch', 'iron: an anvil’s thump'],
    ['the_unweaver', 'null_priest', 'null_rune', 'cloth: a bowed string'],
    [CONDUCTOR, CONDUCTOR, SFORZANDO, 'glass: low glass'],
  ];
  return [
    {
      id: 'p6-edict',
      label:
        'Tyrant: the edict (a boss takes up a road foe’s attack: a horn fifth, a struck crown)',
      group: 'phase6',
      length: 2.5,
      fire: (d, w) =>
        fire(
          d,
          w,
          ev('tyrantEdict', {
            boss: w.addTyrant('the_bellwarden', 'glass_lancer', 'lancer_lance', 2),
            phase: 1,
            attack: 'lancer_lance',
            from: 'glass_lancer',
          }),
        ),
    },
    ...casts.map(([boss, from, attack, label]): SoundButton => ({
      id: `p6-tyrant-${boss}`,
      label: `Tyrant: ${boss} casts ${attack} (the foe’s sound, under the boss’s voice, ${label})`,
      group: 'phase6',
      length: 3,
      fire: tyrantCast(boss, from, attack),
    })),
    {
      id: 'p6-postlude-rise',
      label:
        'The Postlude: the Conductor rises (the shatter drawn back in, eight glass notes D4-D5 as the rings re-light, the choir on D)',
      group: 'phase6',
      length: 6,
      fire: (d, w) => {
        w.setPostlude(3);
        fire(
          d,
          w,
          ev('postludeRose', { boss: w.addTyrant(CONDUCTOR, CONDUCTOR, 'none', 0), hp: 300 }),
        );
      },
    },
    {
      id: 'p6-postlude-stems',
      label:
        'The Postlude, risen (with the Crucible playing: the whole choir, the melody sung in pairs); press "No Postlude" to end it',
      group: 'phase6',
      length: 8,
      fire: (_d, w) => w.setPostlude(0),
    },
    {
      id: 'p6-postlude-enraged',
      label: 'The Postlude, enraged after 90 s (the top layer too)',
      group: 'phase6',
      length: 8,
      fire: (_d, w) => w.setPostlude(0, true),
    },
    {
      id: 'p6-postlude-off',
      label: 'No Postlude',
      group: 'phase6',
      length: 1,
      fire: (_d, w) => w.setPostlude(null),
    },
    {
      id: 'p6-postlude-pair',
      label:
        'The Postlude: a pair Cue (the Alto’s mirrored phrase, the Bass answering a third higher)',
      group: 'phase6',
      length: 4,
      fire: (d, w) =>
        fire(
          d,
          w,
          ev('postludePair', { voices: [w.addStanding(ALTO, -6), w.addStanding(BASS, 6)] }),
        ),
    },
    ...([1, 2, 3] as const).map((n): SoundButton => ({
      id: `p6-atlas-star-${n}`,
      label: `UI: atlasStar, the Echo’s ${n === 1 ? 'first' : n === 2 ? 'second' : 'third'} star lit`,
      group: 'phase6',
      length: 2,
      fire: (d) => d.playUi('atlasStar', null, { stars: n }),
    })),
    {
      id: 'p6-atlas-constellation',
      label: 'UI: atlasConstellation, a constellation completed',
      group: 'phase6',
      length: 3,
      fire: (d) => d.playUi('atlasConstellation'),
    },
    {
      id: 'p6-run-verified',
      label: 'UI: runVerified, a shared run verified on this device',
      group: 'phase6',
      length: 2,
      fire: (d) => d.playUi('runVerified'),
    },
    {
      id: 'p6-run-mismatch',
      label: 'UI: runMismatch, a shared run that didn’t match',
      group: 'phase6',
      length: 2,
      fire: (d) => d.playUi('runMismatch'),
    },
  ];
}
