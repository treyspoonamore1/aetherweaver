/** The words of "Without you" (Result and Summary), testable without React. */
import type { EncounterResult, WithoutYou } from '../../meta/types';
import { clock, pct, plural } from '../kit/format';

/** One sentence for the re-run: "Without you, the party falls at 0:41 in wave 2." */
export function withoutYouLine(
  w: WithoutYou,
  r: Pick<EncounterResult, 'outcome' | 'duration'>,
): string {
  const wave = w.waves > 1 ? ` in wave ${w.wave} of ${w.waves}` : '';
  const boss = w.bossHp !== null && w.bossHp > 0 ? `, with the boss at ${pct(w.bossHp)}` : '';
  if (w.outcome === 'defeat')
    return `Without you, the party falls at ${clock(w.duration)}${wave}${boss}.`;
  if (w.outcome === 'timeout')
    return `Without you, the fight is still going at ${clock(w.duration)}${wave}: ${w.standing} still standing${boss}.`;
  const slower = w.duration - r.duration;
  const tail =
    w.downs > 0
      ? `, with ${w.downs} ${plural(w.downs, 'hero', 'heroes')} going down along the way`
      : '';
  if (r.outcome !== 'victory')
    return `Without you, they would have won in ${clock(w.duration)}${tail}.`;
  return slower > 1
    ? `Without you, they still win, but it takes ${clock(w.duration)} (${clock(slower)} longer)${tail}.`
    : `Without you, they still win in ${clock(w.duration)}${tail}.`;
}

/** Whether you turned the fight: you won and they wouldn't have. */
export function madeTheDifference(r: EncounterResult): boolean {
  return !!r.withoutYou && r.outcome === 'victory' && r.withoutYou.outcome !== 'victory';
}

/** Run aggregate: in how many fights the party would have fallen (or stalled) alone. */
export function withoutYouTally(results: readonly EncounterResult[]): {
  fights: number;
  fell: number;
  stalled: number;
  won: number;
} {
  let fights = 0;
  let fell = 0;
  let stalled = 0;
  let won = 0;
  for (const r of results) {
    const w = r.withoutYou;
    if (!w) continue;
    fights++;
    if (w.outcome === 'defeat') fell++;
    else if (w.outcome === 'timeout') stalled++;
    else won++;
  }
  return { fights, fell, stalled, won };
}

export function tallyLine(t: ReturnType<typeof withoutYouTally>): string {
  if (t.fights === 0) return '';
  const lost = t.fell + t.stalled;
  if (lost === 0)
    return `Without you, the party would still have won all ${t.fights} ${plural(t.fights, 'fight')}, just slower and bloodier.`;
  return `Without you, the party would have fallen in ${t.fell} of ${t.fights} ${plural(t.fights, 'fight')}${t.stalled > 0 ? `, and been stuck in ${t.stalled} more` : ''}.`;
}
