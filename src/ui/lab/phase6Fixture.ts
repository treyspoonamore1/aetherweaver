/**
 * Phase 6 UI fixtures (docs/phase-6.md), for the lab and `tests/uiPhase6.test.ts`: Atlas
 * profiles at several stages, This Week's Song's panel in each of its states, a Summary's Atlas
 * record, and the doc's fourteen Deeds shaped by the schema (until they land in content). Every
 * id and number that content holds is read from content; the weekly's scores, codes and names
 * are the weekly model's to give and are made up here.
 */
import { CONTENT, type DeedDef, type WeeklyEntry } from '../../content';
import { STARS_PER_ECHO, recordStars, type AtlasRecord } from '../../meta/atlas';
import type { ProfileAtlas, WeeklyCode, WeeklyStatus } from '../../meta/profile';
import type { WeeklyPanelInput, WeeklyRowInput } from '../screens/atlasModel';

const echoes = () => CONTENT.echoes;

/** An Atlas with these stars lit (by Echo index, in the Atlas's order) and bests. */
export function atlasWith(
  stars: readonly number[],
  best?: readonly (number | null)[],
): ProfileAtlas {
  const out: ProfileAtlas = { stars: {}, best: {} };
  echoes().forEach((e, i) => {
    const s = stars[i] ?? 0;
    if (s > 0) out.stars[e.id] = s;
    const b = best?.[i] ?? (s >= 3 ? 20 : s >= 2 ? 10 : s >= 1 ? 0 : null);
    if (s > 0 && b !== null) out.best[e.id] = b;
  });
  return out;
}

export type AtlasStage = 'none' | 'partway' | 'constellation' | 'whole';

/** The Atlas at a stage: nothing lit; a few stars; the first constellation whole; every star. */
export function atlasAt(stage: AtlasStage): ProfileAtlas | undefined {
  const n = echoes().length;
  const first = echoes().filter((e) => e.constellation === CONTENT.constellations[0]?.id).length;
  switch (stage) {
    case 'none':
      return undefined;
    case 'partway':
      return atlasWith([2, 1, 0, 3, 0, 0, 1], [12, 4, null, 24, null, null, 0]);
    case 'constellation':
      return atlasWith([...Array(first).fill(STARS_PER_ECHO), 1, 2], undefined);
    case 'whole':
      return atlasWith(Array(n).fill(STARS_PER_ECHO));
  }
}

/** A Summary's record: an Echo cleared at `points`, from the Atlas `before`. */
export function atlasRecordFor(
  echoIndex: number,
  points: number,
  before: ProfileAtlas | undefined,
): AtlasRecord {
  const echo = echoes()[echoIndex]!;
  // Levels worth `points` (or as near under it as content's ranks allow), in content order.
  const levels: { id: string; rank: number }[] = [];
  let left = points;
  for (const d of CONTENT.dissonance) {
    const rank = Math.min(d.ranks, Math.floor(left / d.points));
    if (rank < 1) continue;
    levels.push({ id: d.id, rank });
    left -= rank * d.points;
  }
  return recordStars({ atlas: before }, { echo: echo.id, outcome: 'victory', dissonance: levels });
}

// ── This Week's Song ───────────────────────────────────────────────────────────────────

/** A share-code-shaped string (the lab's only: the weekly model makes real ones). */
function fakeCode(i: number): string {
  const a = 'K7Q2M9TXRB4HNC6DPW3VJ8EAZ5GF1Y0S';
  let s = 'AW1';
  for (let g = 0; g < 7; g++) {
    s += '-';
    for (let k = 0; k < 4; k++) s += a[(i * 7 + g * 5 + k * 3) % a.length];
  }
  return s;
}

function row(
  i: number,
  status: WeeklyStatus,
  score: number | null,
  minutes: number,
  over: Partial<WeeklyCode> = {},
  won = true,
): WeeklyRowInput {
  return {
    entry: { code: fakeCode(i), status, ...over },
    score,
    seconds: score === null ? null : minutes * 60,
    won: score === null ? null : won,
    fightsWon: score === null ? null : won ? 15 : 9,
  };
}

/** The board's rows, best first, each of the four statuses among them. */
export function weeklyRows(): WeeklyRowInput[] {
  return [
    row(1, 'verified', 3880, 33, { name: 'Mara' }),
    row(2, 'verified', 3210, 31, { mine: true }),
    row(3, 'otherVersion', 3105, 36, { name: 'Ilse' }),
    row(4, 'claimed', 2990, 29, { name: 'Tomas' }),
    row(5, 'mismatch', 2950, 34, { name: 'Dev' }),
    row(6, 'verified', 1420, 21, { name: 'Ana' }, false),
    row(7, 'mismatch', null, 0, { name: 'A typo' }),
  ];
}

export type WeeklyState =
  'board' | 'empty' | 'verifying' | 'verified' | 'otherVersion' | 'claimed' | 'mismatch';

/** The week's entry: the rotation's first, or one built from content while the rotation is empty. */
export function weeklyEntryFixture(): WeeklyEntry {
  return (
    CONTENT.weekly[0] ?? {
      route: 'expedition',
      calling: CONTENT.callings.find((c) => c.id === 'chronomancer')?.id ?? null,
      party: [...CONTENT.defaultParty],
      dissonance: [{ id: CONTENT.dissonance[0]!.id, rank: 1 }],
    }
  );
}

/** The weekly panel in each state, as the weekly model would hand it over. */
export function weeklyInput(state: WeeklyState, week = 44): WeeklyPanelInput {
  const entry = weeklyEntryFixture();
  const base: WeeklyPanelInput = {
    week,
    daysLeft: 3,
    entry,
    entryLine: 'The Chronomancer, with Kael, Lyra and Vexis, at 10 Dissonance',
    best: 3210,
    rows: weeklyRows(),
    progress: null,
    result: null,
    canBegin: true,
    shareCode: fakeCode(2),
  };
  switch (state) {
    case 'board':
      return base;
    case 'empty':
      return { ...base, best: null, rows: [], shareCode: null, daysLeft: 1 };
    case 'verifying':
      return { ...base, progress: { fight: 6, fights: 15, ticks: 41_000, totalTicks: 97_000 } };
    case 'verified':
      return {
        ...base,
        result: {
          status: 'verified',
          message: `Verified on this device: Week ${week}, won, 3,880 points, 33 min of fighting.`,
        },
      };
    case 'otherVersion':
      return {
        ...base,
        result: {
          status: 'otherVersion',
          message: 'Verified, though it was recorded on another version of the game.',
        },
      };
    case 'claimed':
      return {
        ...base,
        result: { status: 'claimed', message: 'Only a code: its replay hasn’t been checked.' },
      };
    case 'mismatch':
      return {
        ...base,
        result: {
          status: 'mismatch',
          message:
            'Parts ways at fight 7 (Vharun): it was recorded as a win and plays as a loss here. It may have been edited, or recorded on another browser.',
        },
      };
  }
}

// ── The fourteen Deeds (docs/phase-6.md, "Design: Deeds"), until content has them ─────

const lvl = (effect: string) => CONTENT.dissonance.find((d) => d.effect === effect)?.id;

/** The doc's fourteen, shaped by the schema (W0's contract); content's own replace them. */
export function phase6DeedFixtures(): DeedDef[] {
  const deeds: DeedDef[] = [
    {
      id: 'absolute_pitch',
      name: 'Absolute Pitch',
      points: 0,
      test: 'runCount',
      stat: 'perfects',
      values: { n: 50 },
      text: 'Make {n} Perfect Wards in one run.',
    },
    {
      id: 'silent_bell',
      name: 'Silent Bell',
      points: 0,
      test: 'movementWithout',
      movement: 3,
      stat: 'cleanses',
      values: {},
      text: 'Clear Movement III without cleansing a hero.',
    },
    {
      id: 'out_of_tune',
      name: 'Out of Tune',
      points: 0,
      test: 'dissonance',
      values: { points: 10 },
      text: 'Clear the Finale at {points} Dissonance or more.',
    },
    {
      id: 'wolf_interval',
      name: 'Wolf Interval',
      points: 0,
      test: 'dissonance',
      values: { points: 20 },
      text: 'Clear the Finale at {points} Dissonance or more.',
    },
    {
      id: 'tritone',
      name: 'Tritone',
      points: 0,
      test: 'dissonance',
      values: { points: 30 },
      text: 'Clear the Finale at {points} Dissonance or more.',
    },
    {
      id: 'resolution',
      name: 'Resolution',
      points: 0,
      test: 'dissonance',
      allLevels: true,
      values: {},
      text: 'Clear the Finale with every Dissonance level.',
    },
    {
      id: 'faint_star',
      name: 'Faint Star',
      points: 0,
      test: 'stars',
      values: { n: 1 },
      text: 'Light a star in the Atlas of Echoes.',
    },
    {
      id: 'whole_constellation',
      name: 'Whole Constellation',
      points: 0,
      test: 'constellation',
      values: {},
      text: 'Light every star of one constellation.',
    },
    {
      id: 'atlas_walker',
      name: 'Every Star',
      points: 0,
      test: 'stars',
      values: { n: STARS_PER_ECHO * CONTENT.echoes.length },
      text: 'Light every star in the Atlas.',
    },
    {
      id: 'same_song',
      name: 'Same Song',
      points: 0,
      test: 'weeks',
      values: { n: 1 },
      text: 'Win This Week’s Song.',
    },
    {
      id: 'every_week_a_song',
      name: 'Every Week a Song',
      points: 0,
      test: 'weeks',
      values: { n: 4 },
      text: 'Win This Week’s Song in {n} different weeks.',
    },
  ];
  const tyrant = lvl('tyrant');
  if (tyrant)
    deeds.push({
      id: 'crownbreaker',
      name: 'Crownbreaker',
      points: 0,
      test: 'dissonance',
      level: tyrant,
      values: {},
      text: 'Clear the Finale with Tyrant.',
    });
  return deeds;
}
