/**
 * Verb ablation (docs/phase-5c.md, "Tuning order" 2): plays Movement III's fights with the
 * Skilled bot, once with every Movement III rule and once with each rule left off
 * (`SkilledOptions.skip`), on the same seeds, so a rule that loses fights (a SENTINEL_FOCUS_AT
 * style bug) shows up before anything is tuned around it.
 *
 *   npx tsx tools/verbs.ts --seeds 20
 *   npx tsx tools/verbs.ts --seeds 50 --encounters the_unweaver --rules cut,focusSpindle
 *   npx tsx tools/verbs.ts --movement 3 --seed-base 500003     # another seed set (a check)
 *
 * Each row is a rule left off: its win rate, mean length and downs a fight, against every rule
 * on (the first row); a rule worth keeping costs wins, time or downs when it is off. Fights play
 * on the Movement's kit (ARRIVAL3_KIT), at seed base + i × 7919, as the harness does.
 */
import { M3_RULES, SkilledBot, type M3Rule } from '../src/bots/skilled';
import { weaverShare } from '../src/meta/run';
import { createSim } from '../src/sim';
import { movementEncounters } from './harness-core';
import { kitConfig, kitFor } from './kits';

const MAX_TICKS = 9 * 60 * 60;

/** One fight's numbers. */
export interface VerbFight {
  won: boolean;
  duration: number;
  downs: number;
  share: number;
}

/** Plays one fight with the Skilled bot, `skip` left off (empty: every rule on). */
export function verbFight(
  encounter: string,
  seed: number,
  skip: ReadonlySet<M3Rule>,
  movement = 3,
): VerbFight {
  const sim = createSim({ seed, encounter, ...kitConfig(kitFor(movement)) });
  const bot = new SkilledBot(seed, {
    every: 4,
    attention: 1,
    callReaction: 0.4,
    ...(skip.size > 0 ? { skip } : {}),
  });
  for (let t = 0; t < MAX_TICKS; t++) {
    sim.step(bot.decide(sim.state));
    sim.drainEvents();
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') break;
  }
  const st = sim.state;
  return {
    won: st.encounter.status === 'victory',
    duration: (st.encounter.endedAt ?? st.time) - st.encounter.startedAt,
    downs: st.ledger.downs,
    share: weaverShare(st.ledger),
  };
}

function main(): void {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const movement = Number(get('movement') ?? 3);
  const seeds = Number(get('seeds') ?? 20);
  const base = Number(get('seed-base') ?? 1000);
  const encounters = (get('encounters') ?? movementEncounters(movement).join(',')).split(',');
  const rules = (get('rules')?.split(',') ?? [...M3_RULES]) as M3Rule[];
  const unknown = rules.filter((r) => !(M3_RULES as readonly string[]).includes(r));
  if (unknown.length > 0) throw new Error(`Unknown rule "${unknown}" (${M3_RULES})`);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const signed = (x: number, digits = 0) => `${x >= 0 ? '+' : ''}${x.toFixed(digits)}`;
  const t0 = Date.now();
  console.log(
    `verb ablation · Movement ${movement} · ${kitFor(movement).name} · ${seeds} seeds · ${encounters.length} fights · ${rules.length} rules`,
  );
  for (const encounter of encounters) {
    const play = (skip: ReadonlySet<M3Rule>) =>
      Array.from({ length: seeds }, (_, i) =>
        verbFight(encounter, base + i * 7919, skip, movement),
      );
    const sum = (fights: VerbFight[]) => ({
      win: fights.filter((f) => f.won).length / fights.length,
      duration: fights.reduce((s, f) => s + f.duration, 0) / fights.length,
      downs: fights.reduce((s, f) => s + f.downs, 0) / fights.length,
      share: fights.reduce((s, f) => s + f.share, 0) / fights.length,
    });
    const all = sum(play(new Set()));
    console.log(
      `${encounter.padEnd(18)} every rule       win ${pct(all.win).padStart(4)} · ${all.duration.toFixed(0)} s · downs ${all.downs.toFixed(2)} · share ${pct(all.share)}`,
    );
    for (const rule of rules) {
      const off = sum(play(new Set([rule])));
      const same = off.win === all.win && off.duration === all.duration && off.downs === all.downs;
      console.log(
        `${''.padEnd(18)} −${rule.padEnd(15)} ${same ? 'no change (not met here)' : `win ${pct(off.win).padStart(4)} (${signed(100 * (off.win - all.win))}) · ${off.duration.toFixed(0)} s (${signed(off.duration - all.duration)}) · downs ${off.downs.toFixed(2)} (${signed(off.downs - all.downs, 2)})`}`,
      );
    }
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

if (process.argv[1]?.endsWith('verbs.ts')) main();
