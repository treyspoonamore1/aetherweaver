/**
 * CONTRACT v4 — the Weaver's profile (docs/plan/02 §9, docs/phase-3.md): what carries over
 * between runs. Every fight earns Weaver XP; XP sets the Weaver's Rank; each Rank unlocks part
 * of the build layer, one piece at a time, so a new player meets the beam song first and the
 * rest as they learn. Pure: the app wraps it in a store (app/profileStore.ts).
 *
 * Settings → "Skip the unlocks" gives everything at once (`EVERYTHING`).
 */
import { CONTENT } from '../content';
import { canonicalChords, type ChordLoadout } from '../sim';
import type { EncounterResult, Grade } from './types';

export const PROFILE_VERSION = 1;

export interface Profile {
  version: typeof PROFILE_VERSION;
  /** Weaver XP earned across every run. The Rank follows from it (`rankOf`). */
  xp: number;
  /** Unlocks whose introduction the player has seen; Prep marks the others "New". */
  introduced: string[];
  /** The Chords used last, so the next run starts with them if they're still allowed. */
  lastChords: ChordLoadout[];
  runs: number;
  wins: number;
}

export function newProfile(): Profile {
  return { version: PROFILE_VERSION, xp: 0, introduced: [], lastChords: [], runs: 0, wins: 0 };
}

// ── Ranks ─────────────────────────────────────────────────────────────────────────────

/** Total XP needed for each Rank: RANK_XP[r - 1] reaches Rank r. */
export const RANK_XP: readonly number[] = [0, 40, 200, 450, 800, 1250];
/** The highest Rank for now (the Loom adds more in Phase 4; XP keeps counting). */
export const MAX_RANK = RANK_XP.length;

export function rankOf(xp: number): number {
  let rank = 1;
  while (rank < MAX_RANK && xp >= RANK_XP[rank]!) rank++;
  return rank;
}

/** Progress through the current Rank: `span` is null at the top Rank. */
export function rankProgress(xp: number): { rank: number; into: number; span: number | null } {
  const rank = rankOf(xp);
  const floor = RANK_XP[rank - 1]!;
  const next = RANK_XP[rank];
  return { rank, into: xp - floor, span: next === undefined ? null : next - floor };
}

// ── Unlocks ───────────────────────────────────────────────────────────────────────────

export type UnlockKind = 'song' | 'aura' | 'ornament' | 'ornamentSlot';

export interface Unlock {
  /** Stable id: "song.field", "aura.ostinato", "ornament.unison", "ornamentSlot.2". */
  id: string;
  rank: number;
  kind: UnlockKind;
  /** The aura or ornament id, the song ('beam' | 'field'), or the slot count ("1", "2"). */
  target: string;
  name: string;
  /** One or two sentences introducing it (rank-up card, Prep). */
  text: string;
}

function aura(rank: number, id: string, text: string): Unlock {
  const def = CONTENT.auras.find((a) => a.id === id)!;
  return { id: `aura.${id}`, rank, kind: 'aura', target: id, name: def.name, text };
}

function ornament(rank: number, id: string, text: string): Unlock {
  const def = CONTENT.ornaments.find((o) => o.id === id)!;
  return { id: `ornament.${id}`, rank, kind: 'ornament', target: id, name: def.name, text };
}

/** The unlock schedule, in order. Everything not listed here is never locked. */
export const UNLOCKS: readonly Unlock[] = [
  {
    id: 'song.beam',
    rank: 1,
    kind: 'song',
    target: 'beam',
    name: 'The beam song',
    text: 'Your first Chord rides the Thread: the hero you thread hears it at double strength, and everyone else near you hears an echo.',
  },
  aura(1, 'sostenuto', 'Regeneration. On the beam, it keeps your threaded hero standing.'),
  aura(1, 'fortissimo', 'Might. On the beam, it turns your threaded hero into a weapon.'),
  aura(1, 'allegro', 'Haste. More attacks, and every extra hit counts as yours.'),
  {
    id: 'song.field',
    rank: 2,
    kind: 'song',
    target: 'field',
    name: 'The field song',
    text: 'A second Chord that surrounds you: everyone near you hears it at full strength. Make one ally a monster with the beam, and the whole party stronger with the field.',
  },
  aura(2, 'ostinato', 'Barrier. Heroes carry a shield that refills after a few seconds unhit.'),
  {
    id: 'ornamentSlot.1',
    rank: 3,
    kind: 'ornamentSlot',
    target: '1',
    name: 'Ornaments',
    text: 'Each song gets an ornament slot. An ornament changes both auras in its song.',
  },
  ornament(3, 'grace_note', 'Its auras cost less Spirit: room for one more.'),
  ornament(3, 'reverb', 'A wider field, for a party that spreads out.'),
  aura(4, 'lullaby', 'A hex: enemies in it slow down, and their wind-ups take longer.'),
  ornament(4, 'pedal_point', 'Plant a field where you want it (V) and roam free.'),
  aura(5, 'fermata', 'A lethal hit holds a hero at 1 life for a moment. Heal them in time.'),
  ornament(5, 'unison', 'All in: the beam song pours into one hero at triple strength.'),
  {
    id: 'ornamentSlot.2',
    rank: 6,
    kind: 'ornamentSlot',
    target: '2',
    name: 'A second ornament slot',
    text: 'Each song can now carry two ornaments.',
  },
];

/** Unlocks reached between two XP totals (for the rank-up card). */
export function unlocksBetween(xpBefore: number, xpAfter: number): Unlock[] {
  const from = rankOf(xpBefore);
  const to = rankOf(xpAfter);
  return UNLOCKS.filter((u) => u.rank > from && u.rank <= to);
}

/** What a profile allows in Prep and at Retune. */
export interface Allowance {
  /** Songs available: 1 = the beam song only, 2 = the beam and the field song. */
  songs: number;
  auras: ReadonlySet<string>;
  ornaments: ReadonlySet<string>;
  /** Ornament slots per song (0–2). */
  ornamentSlots: number;
  /** Everything is open (Skip the unlocks). */
  all: boolean;
}

export const EVERYTHING: Allowance = {
  songs: CONTENT.weaver.chords,
  auras: new Set(CONTENT.auras.map((a) => a.id)),
  ornaments: new Set(CONTENT.ornaments.map((o) => o.id)),
  ornamentSlots: CONTENT.weaver.ornamentSlots,
  all: true,
};

export function allowanceFor(rank: number): Allowance {
  const open = UNLOCKS.filter((u) => u.rank <= rank);
  const locked = (kind: UnlockKind) =>
    new Set(UNLOCKS.filter((u) => u.kind === kind).map((u) => u.target));
  const lockedAuras = locked('aura');
  const lockedOrnaments = locked('ornament');
  const of = (kind: UnlockKind) => open.filter((u) => u.kind === kind).map((u) => u.target);
  return {
    songs: of('song').length,
    auras: new Set([
      ...CONTENT.auras.map((a) => a.id).filter((id) => !lockedAuras.has(id)),
      ...of('aura'),
    ]),
    ornaments: new Set([
      ...CONTENT.ornaments.map((o) => o.id).filter((id) => !lockedOrnaments.has(id)),
      ...of('ornament'),
    ]),
    ornamentSlots: Math.max(0, ...of('ornamentSlot').map(Number)),
    all: false,
  };
}

/** The Rank at which something unlocks (1 if it's never locked). */
export function unlockRank(kind: UnlockKind, target: string): number {
  return UNLOCKS.find((u) => u.kind === kind && u.target === target)?.rank ?? 1;
}

/**
 * Sentences for whatever a loadout uses that the allowance doesn't open yet ("Ostinato unlocks
 * at Rank 2."). Empty means allowed. Legality (slots, Spirit…) is the sim's `chordProblems`.
 */
export function lockedProblems(chords: readonly ChordLoadout[], allowance: Allowance): string[] {
  if (allowance.all) return [];
  const problems: string[] = [];
  const canon = canonicalChords(chords);
  canon.forEach((chord, i) => {
    const used = chord.auras.length > 0 || chord.ornaments.length > 0;
    if (used && i >= allowance.songs) {
      const u = UNLOCKS.find((x) => x.kind === 'song' && x.target === (i === 0 ? 'beam' : 'field'));
      problems.push(`${u?.name ?? 'That song'} unlocks at Rank ${u?.rank ?? '?'}.`);
    }
    if (chord.ornaments.length > allowance.ornamentSlots) {
      const need = allowance.ornamentSlots + 1;
      problems.push(
        need === 1
          ? `Ornaments unlock at Rank ${unlockRank('ornamentSlot', '1')}.`
          : `A second ornament slot unlocks at Rank ${unlockRank('ornamentSlot', String(need))}.`,
      );
    }
    for (const id of chord.auras)
      if (!allowance.auras.has(id))
        problems.push(
          `${CONTENT.auras.find((a) => a.id === id)?.name ?? id} unlocks at Rank ${unlockRank('aura', id)}.`,
        );
    for (const id of chord.ornaments)
      if (!allowance.ornaments.has(id))
        problems.push(
          `${CONTENT.ornaments.find((o) => o.id === id)?.name ?? id} unlocks at Rank ${unlockRank('ornament', id)}.`,
        );
  });
  return [...new Set(problems)];
}

// ── Weaver XP ─────────────────────────────────────────────────────────────────────────

/** XP for winning each kind of fight (a loss earns 40% of it: you still learned something). */
export const FIGHT_XP: Readonly<Record<EncounterResult['kind'], number>> = {
  sandbox: 0,
  skirmish: 20,
  elite: 35,
  miniboss: 50,
  boss: 80,
};
export const LOSS_XP = 0.4;
export const GRADE_XP: Readonly<Record<Grade, number>> = { S: 1.5, A: 1.3, B: 1.15, C: 1, D: 1 };
/** Bonus for finishing a run in victory. */
export const RUN_WIN_XP = 100;

export interface XpLine {
  label: string;
  xp: number;
}

/** The XP one fight earns, line by line. `wonRun`: this victory finished the run. */
export function xpForFight(
  result: Pick<EncounterResult, 'kind' | 'outcome' | 'grade' | 'name'>,
  wonRun: boolean,
): { total: number; lines: XpLine[] } {
  const base = FIGHT_XP[result.kind];
  const lines: XpLine[] = [];
  if (result.outcome === 'victory') {
    lines.push({ label: result.name, xp: base });
    const bonus = Math.round(base * (GRADE_XP[result.grade] - 1));
    if (bonus > 0) lines.push({ label: `Grade ${result.grade}`, xp: bonus });
    if (wonRun) lines.push({ label: 'Run complete', xp: RUN_WIN_XP });
  } else if (base > 0) {
    lines.push({ label: `${result.name} (lost)`, xp: Math.round(base * LOSS_XP) });
  }
  return { total: lines.reduce((s, l) => s + l.xp, 0), lines };
}

/** Adds XP; reports the Ranks and unlocks it reached. */
export function awardXp(
  profile: Profile,
  amount: number,
): { profile: Profile; ranks: number[]; unlocks: Unlock[] } {
  const xp = profile.xp + Math.max(0, Math.round(amount));
  const before = rankOf(profile.xp);
  const after = rankOf(xp);
  const ranks: number[] = [];
  for (let r = before + 1; r <= after; r++) ranks.push(r);
  return { profile: { ...profile, xp }, ranks, unlocks: unlocksBetween(profile.xp, xp) };
}
