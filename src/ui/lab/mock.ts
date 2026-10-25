/**
 * Mock data for the UI lab: fabricated HUD snapshots and whole runs, so every screen can be
 * reviewed (and its edge cases hit) without playing. Runs are built by driving the real
 * pure run functions (meta/run.ts) with fake combat outcomes.
 */
import { CONTENT, auraDef, encounterDef, heroDef } from '../../content';
import * as Run from '../../meta/run';
import type { CombatOutcome, RunState } from '../../meta/types';
import type { Ledger } from '../../sim';
import type { Callout, HeroHud, HudSnapshot, TechniqueHud } from '../store';

// ── HUD snapshots ─────────────────────────────────────────────────────────────────────

function techniques(
  over: Partial<Record<'ward' | 'chime' | 'reel' | 'glide', Partial<TechniqueHud>>> = {},
): TechniqueHud[] {
  const t = CONTENT.techniques;
  const base: TechniqueHud[] = [
    {
      key: 'ward',
      name: t.ward.name,
      remaining: 0,
      total: t.ward.cooldown,
      cost: t.ward.cost,
      charges: 1,
      maxCharges: 1,
      affordable: true,
      key0: 'KeyQ',
    },
    {
      key: 'chime',
      name: t.chime.name,
      remaining: 0,
      total: t.chime.cooldown,
      cost: t.chime.cost,
      charges: 1,
      maxCharges: 1,
      affordable: true,
      key0: 'KeyE',
    },
    {
      key: 'reel',
      name: t.reel.name,
      remaining: 0,
      total: t.reel.cooldown,
      cost: t.reel.cost,
      charges: 1,
      maxCharges: 1,
      affordable: true,
      key0: 'KeyF',
    },
    {
      key: 'glide',
      name: t.glide.name,
      remaining: 0,
      total: t.glide.cooldown,
      cost: 0,
      charges: 1,
      maxCharges: 1,
      affordable: true,
      key0: 'Space',
    },
  ];
  return base.map((b) => ({ ...b, ...over[b.key] }));
}

function hero(slot: number, defId: string, over: Partial<HeroHud> = {}): HeroHud {
  const def = heroDef(defId);
  return {
    id: 100 + slot,
    slot,
    defId,
    name: def.name,
    title: def.title,
    role: def.role,
    color: def.color,
    hp: def.maxHp,
    maxHp: def.maxHp,
    shield: 0,
    shields: [],
    incoming: 0,
    lethal: false,
    statuses: [],
    downed: false,
    bleedOut: 0,
    bleedOutMax: 12,
    revive: 0,
    dead: false,
    solo: 40,
    soloReady: false,
    soloActive: false,
    soloName: def.solo.name,
    castName: null,
    castProgress: 0,
    action: 'idle',
    distance: 4,
    inField: true,
    follow: 'follow',
    threaded: false,
    hovered: false,
    ...over,
  };
}

export type HudScenario = 'calm' | 'crisis' | 'downed' | 'boss' | 'resonance' | 'sandbox';

export function mockHud(scenario: HudScenario): HudSnapshot {
  const w = CONTENT.weaver;
  const base: HudSnapshot = {
    tick: 5400,
    seconds: 90,
    seed: 4242,
    weaver: {
      x: 0,
      z: 0,
      life: 300,
      maxLife: w.maxLife,
      downed: false,
      reform: 0,
      spirit: 38,
      maxSpirit: w.maxSpirit,
      reserved: 55,
      resonance: 38,
      resonanceMax: 100,
      segment: 25,
      crescendoCost: 100,
      crescendo: 0,
      crescendoName: CONTENT.crescendo.name,
      threadMode: 'mend',
      threadSlot: 0,
      threadTension: 0.3,
      threadLock: 0,
      techniques: techniques(),
      auras: ['sostenuto', 'ostinato'].map((id) => {
        const a = auraDef(id);
        return { id, name: a.name, color: a.color, reserve: a.reserve };
      }),
      fieldRadius: 8,
      fieldSuppressed: false,
    },
    party: [
      hero(0, 'kael', { hp: 1180, threaded: true, solo: 72, shield: 140 }),
      hero(1, 'lyra', {
        hp: 760,
        solo: 30,
        castName: 'Piercing Shot',
        castProgress: 0.6,
        action: 'casting',
      }),
      hero(2, 'vexis', { hp: 690, solo: 55 }),
    ],
    boss: null,
    encounter: {
      id: 'tolling_halls',
      name: 'The Tolling Halls',
      kind: 'skirmish',
      status: 'fighting',
      wave: 2,
      waves: 3,
      elapsed: 64,
      par: 90,
      enemies: 9,
    },
    directive: null,
    focusTarget: null,
    entityCount: 40,
    dummyCount: 0,
  };
  switch (scenario) {
    case 'calm':
      return base;
    case 'sandbox':
      return {
        ...base,
        encounter: {
          ...base.encounter,
          id: 'sandbox',
          name: 'Training Grounds',
          kind: 'sandbox',
          wave: 0,
          waves: 0,
          par: 0,
        },
      };
    case 'crisis':
      return {
        ...base,
        weaver: {
          ...base.weaver,
          life: 120,
          spirit: 8,
          threadSlot: 1,
          threadMode: 'empower',
          threadTension: 0.9,
          techniques: techniques({
            ward: { remaining: 3.4, affordable: false },
            chime: { affordable: false },
            reel: { affordable: false },
            glide: { remaining: 1.2 },
          }),
          fieldSuppressed: true,
        },
        party: [
          hero(0, 'kael', {
            hp: 310,
            incoming: 520,
            lethal: true,
            hovered: true,
            statuses: [{ id: 'shaken', remaining: 0, duration: 0 }],
            solo: 100,
            soloReady: true,
          }),
          hero(1, 'lyra', {
            hp: 210,
            threaded: true,
            incoming: 600,
            lethal: true,
            shield: 90,
            shields: [{ kind: 'ward', amount: 90, max: 330 }],
            statuses: [
              { id: 'dirge', remaining: 3.2, duration: 5 },
              { id: 'silence', remaining: 1.1, duration: 2 },
            ],
            inField: false,
          }),
          hero(2, 'vexis', {
            hp: 640,
            incoming: 150,
            castName: 'Starbolt',
            castProgress: 0.35,
            statuses: [{ id: 'immune', remaining: 0.8, duration: 1.5 }],
          }),
        ],
        encounter: { ...base.encounter, elapsed: 112, enemies: 14 },
      };
    case 'downed':
      return {
        ...base,
        weaver: { ...base.weaver, threadSlot: 2 },
        party: [
          hero(0, 'kael', { hp: 0, downed: true, bleedOut: 7.4, revive: 0.45, action: 'downed' }),
          hero(1, 'lyra', { hp: 0, dead: true, downed: false }),
          hero(2, 'vexis', { hp: 320, threaded: true, incoming: 80 }),
        ],
        encounter: { ...base.encounter, elapsed: 131 },
      };
    case 'boss':
      return {
        ...base,
        weaver: { ...base.weaver, resonance: 71, threadMode: 'empower', threadSlot: 0 },
        party: [
          hero(0, 'kael', {
            hp: 1010,
            incoming: 1440,
            lethal: false,
            shield: 400,
            shields: [{ kind: 'dome', amount: 400, max: 640 }],
            solo: 100,
            soloReady: true,
          }),
          hero(1, 'lyra', { hp: 700, incoming: 740, lethal: true }),
          hero(2, 'vexis', {
            hp: 610,
            incoming: 666,
            lethal: true,
            statuses: [{ id: 'resound', remaining: 6, duration: 8 }],
          }),
        ],
        boss: {
          id: 7,
          name: 'The Hollow Cantor',
          hp: 21000,
          maxHp: 75000,
          shield: 3000,
          phase: 3,
          phases: 3,
          cast: { name: 'Requiem', progress: 0.55, answers: ['dome', 'ward'] },
          enrageIn: 24,
          decree: {
            name: 'Requiem',
            text: 'Every hero will lose 90% of their life. Cue Kael’s dome, or Ward and heal.',
          },
        },
        encounter: {
          id: 'hollow_cantor',
          name: 'The Hollow Cantor',
          kind: 'boss',
          status: 'fighting',
          wave: 1,
          waves: 1,
          elapsed: 247,
          par: 240,
          enemies: 3,
        },
      };
    case 'resonance':
      return {
        ...base,
        weaver: {
          ...base.weaver,
          resonance: 100,
          spirit: 72,
          reserved: 25,
          auras: base.weaver.auras.slice(0, 1),
          threadMode: 'empower',
          techniques: techniques({ ward: { charges: 2, maxCharges: 2 } }),
        },
        party: [
          hero(0, 'kael', { hp: 1560, solo: 100, soloReady: true, threaded: true }),
          hero(1, 'lyra', { hp: 820, solo: 100, soloReady: true }),
          hero(2, 'vexis', { hp: 740, solo: 100, soloActive: true }),
        ],
        encounter: { ...base.encounter, elapsed: 40, enemies: 5 },
      };
  }
}

export function mockCallouts(scenario: HudScenario): Callout[] {
  const far = performance.now() + 1e9;
  const c = (
    id: number,
    kind: Callout['kind'],
    text: string,
    extra: Partial<Callout> = {},
  ): Callout => ({ id, kind, text, expiresAt: far, ...extra });
  switch (scenario) {
    case 'calm':
      return [
        c(1, 'bark', 'That was close. Thank you.', {
          speaker: 'Kael',
          color: heroDef('kael').color,
        }),
        c(2, 'wave', 'Wave 2 of 3'),
      ];
    case 'crisis':
      return [
        c(1, 'perfect', 'Perfect Ward', { detail: 'Kael · 520 negated', color: '#f5d78e' }),
        c(2, 'reject', 'Ward: not enough Spirit'),
        c(3, 'bark', 'I’m hit — help!', { speaker: 'Lyra', color: heroDef('lyra').color }),
      ];
    case 'downed':
      return [c(1, 'system', 'Kael is down — Mend them back up!', { color: '#fca5a5' })];
    case 'boss':
      return [
        c(1, 'decree', 'Requiem', {
          detail: 'Every hero will lose 90% of their life. Cue Kael’s dome, or Ward and heal.',
          color: '#e9d5ff',
        }),
        c(2, 'save', 'Saved Vexis', { detail: 'Toll · 1,140 prevented', color: '#f5d78e' }),
      ];
    case 'resonance':
      return [
        c(1, 'perfect', 'Crescendo — Sunrise', { color: '#fde68a' }),
        c(2, 'solo', 'Cue: Vexis', { color: heroDef('vexis').color }),
      ];
    case 'sandbox':
      return [];
  }
}

// ── Fake combats and whole runs ───────────────────────────────────────────────────────

function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A believable CombatOutcome for the pending node, deterministic per run state. */
export function fakeOutcome(
  run: RunState,
  victory: boolean,
  opts: { deaths?: number } = {},
): CombatOutcome {
  const node = Run.findNode(run, run.pending ?? '');
  const encId = node?.encounterId ?? 'first_light';
  const enc = encounterDef(encId);
  const rnd = lcg(run.seed + run.encounters * 977);
  const duration = enc.par > 0 ? enc.par * (victory ? 0.8 + rnd() * 0.5 : 0.6) : 80;
  const n = run.party.length;
  const maxHp = run.party.map((p) => heroDef(p.heroId).maxHp);
  const hp = run.party.map((p, i) => p.hpPct * maxHp[i]!);
  const timeline: Ledger['timeline'] = [];
  const markers: Ledger['markers'] = [];
  const kinds: Ledger['markers'][number]['kind'][] = [
    'perfect',
    'cleanse',
    'save',
    'reel',
    'cue',
    'perfect',
    'cleanse',
  ];
  const deaths: Ledger['deaths'] = [];
  const dead = new Set<number>();
  const deathCount = opts.deaths ?? (victory ? 0 : 1);
  for (let t = 0; t <= duration; t += 0.5) {
    for (let i = 0; i < n; i++) {
      if (dead.has(i)) {
        hp[i] = 0;
        continue;
      }
      const drop = rnd() < 0.012 ? maxHp[i]! * (0.1 + rnd() * 0.3) : 0;
      const heal = maxHp[i]! * 0.008 * (0.5 + rnd());
      hp[i] = Math.max(maxHp[i]! * 0.08, Math.min(maxHp[i]!, hp[i]! - drop + heal));
    }
    if (deathCount > dead.size && t > duration * (0.5 + 0.2 * dead.size)) {
      const slot = (1 + dead.size) % n;
      dead.add(slot);
      hp[slot] = 0;
      markers.push({ time: t, kind: 'down', slot });
      deaths.push({
        time: t,
        hero: 100 + slot,
        heroDefId: run.party[slot]!.heroId,
        killer: 'Glass Lance',
        recap: [
          { time: t - 3.2, amount: 180, source: 'Hollow Chorister' },
          { time: t - 1.9, amount: 240, source: 'Bell Brute' },
          { time: t - 0.1, amount: 600, source: 'Glass Lance' },
        ],
        readyTechniques: ['ward', 'reel'],
      });
    }
    if (rnd() < 0.09)
      markers.push({
        time: t,
        kind: kinds[Math.floor(rnd() * kinds.length)]!,
        slot: Math.floor(rnd() * n),
      });
    timeline.push({ time: t, hp: hp.map((h, i) => h / maxHp[i]!) });
  }
  const scale = 0.7 + rnd() * 0.8;
  const ledger: Ledger = {
    healing: 4200 * scale,
    overheal: 900 * scale,
    shielded: 2100 * scale,
    negated: 1300 * scale,
    amplified: 5800 * scale,
    partyDamage: 24000 * scale,
    perfects: markers.filter((m) => m.kind === 'perfect').length,
    saves: markers
      .filter((m) => m.kind === 'save')
      .map((m, i) => ({
        time: m.time,
        hero: 100 + (m.slot ?? 0),
        heroDefId: run.party[m.slot ?? 0]!.heroId,
        cause: (['ward', 'reel', 'chime', 'mend', 'dome'] as const)[i % 5]!,
        prevented: 600 + i * 240,
        attack: ['Toll Cleave', 'Glass Lance', 'Dirge'][i % 3]!,
      })),
    cleanses: markers.filter((m) => m.kind === 'cleanse').length,
    clutchCleanses: 1,
    reels: markers.filter((m) => m.kind === 'reel').length,
    cues: markers.filter((m) => m.kind === 'cue').length,
    crescendos: node?.kind === 'boss' || node?.kind === 'miniboss' ? 1 : 0,
    downs: dead.size + (victory ? 1 : 0),
    deaths,
    telegraphsAimed: 18,
    telegraphsAnswered: victory ? 14 : 9,
    timeline,
    markers,
  };
  return {
    encounterId: encId,
    outcome: victory ? 'victory' : 'defeat',
    duration,
    ledger,
    party: run.party.map((p, i) => ({
      slot: i,
      heroId: p.heroId,
      hp: hp[i]!,
      maxHp: maxHp[i]!,
      downed: false,
      dead: dead.has(i),
      damage: [9000, 8200, 6800][i % 3]! * scale,
      amplified: [800, 2900, 2100][i % 3]! * scale,
    })),
  };
}

export function freshRun(seed = 7): RunState {
  return Run.newRun(seed);
}

/** Plays `fights` combats (always taking the first option and first motif) and stops on the map. */
export function playedRun(fights: number, seed = 7): RunState {
  let run = Run.embark(Run.newRun(seed));
  let played = 0;
  while (played < fights && run.phase === 'map') {
    const next = Run.reachable(run)[0];
    if (!next) break;
    run = Run.chooseNode(run, next.id);
    if (run.phase === 'combat') {
      run = Run.finishCombat(run, fakeOutcome(run, true));
      played++;
      run = Run.continueFromResult(run);
    }
    if (run.phase === 'draft') run = Run.pickDraft(run, 0);
    else if (run.phase === 'respite') run = Run.respite(run, 'rest');
  }
  return run;
}

export function victoryRun(seed = 7): RunState {
  let run = playedRun(6, seed);
  // The last steps: Bellwarden is done by now; fight the Cantor.
  if (run.phase === 'map') {
    const next = Run.reachable(run)[0];
    if (next) run = Run.chooseNode(run, next.id);
    if (run.phase === 'combat') {
      run = Run.finishCombat(run, fakeOutcome(run, true));
      run = Run.continueFromResult(run);
    }
  }
  return run;
}

export function resultRun(victory: boolean, deaths = 0): RunState {
  let run = playedRun(2);
  const next = Run.reachable(run)[0];
  if (next) run = Run.chooseNode(run, next.id);
  if (run.phase === 'combat') run = Run.finishCombat(run, fakeOutcome(run, victory, { deaths }));
  return run;
}

export function draftRun(): RunState {
  const run = playedRun(2);
  const owned = run.motifs[0];
  // Guarantee an upgrade, a new rare and an epic whatever the seed gave us.
  const upgrade = owned
    ? { motifId: owned.id, level: owned.level + 1, upgrade: true }
    : { motifId: 'relay_weave', level: 1, upgrade: false };
  const rare = CONTENT.motifs.find(
    (m) =>
      m.rarity === 'rare' &&
      m.id !== upgrade.motifId &&
      (!m.requires.aura || run.auras.includes(m.requires.aura)) &&
      !run.motifs.some((o) => o.id === m.id),
  );
  const epic = CONTENT.motifs.find(
    (m) =>
      m.rarity === 'epic' &&
      (!m.requires.aura || run.auras.includes(m.requires.aura)) &&
      !run.motifs.some((o) => o.id === m.id),
  );
  const options = [
    upgrade,
    rare && { motifId: rare.id, level: 1, upgrade: false },
    epic && { motifId: epic.id, level: 1, upgrade: false },
  ].filter((o): o is { motifId: string; level: number; upgrade: boolean } => !!o);
  return { ...run, phase: 'draft', draft: { reason: 'elite', options, rerollsLeft: 1 } };
}

export function respiteRun(): RunState {
  const run = playedRun(3);
  return {
    ...run,
    phase: 'respite',
    party: run.party.map((p, i) => ({ ...p, hpPct: [0.35, 0.6, 0.45][i] ?? 0.5, shaken: i === 1 })),
  };
}

export function summaryRun(outcome: 'victory' | 'defeat' | 'abandoned'): RunState {
  const run = outcome === 'victory' ? victoryRun() : playedRun(outcome === 'defeat' ? 4 : 3);
  return { ...run, phase: 'summary', outcome, pending: null };
}
