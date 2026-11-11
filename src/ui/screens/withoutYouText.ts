/** The words of "Without you" (Result and Summary), testable without React. */
import type { EncounterResult, WithoutYou } from '../../meta/types';
import { clock, pct, plural } from '../kit/format';
import { t as txt } from '../text';

/** One sentence for the re-run: "Without you, the party falls at 0:41 in wave 2." */
export function withoutYouLine(
  w: WithoutYou,
  r: Pick<EncounterResult, 'outcome' | 'duration'>,
): string {
  const wave =
    w.waves > 1 ? txt('screens.withoutYouText.inWaveOf', { wave: w.wave, waves: w.waves }) : '';
  const boss =
    w.bossHp !== null && w.bossHp > 0
      ? txt(
          w.rose
            ? 'screens.withoutYouText.withTheBossRisen'
            : 'screens.withoutYouText.withTheBossAt',
          { bossHp: pct(w.bossHp) },
        )
      : '';
  if (w.outcome === 'defeat')
    return txt('screens.withoutYouText.withoutYouTheParty', {
      duration: clock(w.duration),
      wave,
      boss,
    });
  if (w.outcome === 'timeout')
    return txt('screens.withoutYouText.withoutYouTheFight', {
      duration: clock(w.duration),
      wave,
      standing: w.standing,
      boss,
    });
  const slower = w.duration - r.duration;
  const tail =
    w.downs > 0
      ? txt('screens.withoutYouText.withGoingDownAlong', {
          downs: w.downs,
          downsWord: plural(w.downs, 'hero', 'heroes'),
        })
      : '';
  if (r.outcome !== 'victory')
    return txt('screens.withoutYouText.withoutYouTheyWould', { duration: clock(w.duration), tail });
  return slower > 1
    ? txt('screens.withoutYouText.withoutYouTheyStill', {
        duration: clock(w.duration),
        slower: clock(slower),
        tail,
      })
    : txt('screens.withoutYouText.withoutYouTheyStill2', { duration: clock(w.duration), tail });
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
    return txt('screens.withoutYouText.withoutYouTheParty2', {
      fights: t.fights,
      fightsWord: plural(t.fights, 'fight'),
    });
  return txt('screens.withoutYouText.withoutYouTheParty3', {
    fell: t.fell,
    fights: t.fights,
    fightsWord: plural(t.fights, 'fight'),
    value:
      t.stalled > 0 ? txt('screens.withoutYouText.andBeenStuckIn', { stalled: t.stalled }) : '',
  });
}
