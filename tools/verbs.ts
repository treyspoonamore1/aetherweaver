/**
 * Verb ablation (docs/phase-5c.md, "Tuning order" 2): plays Movement III's fights with the
 * Skilled bot, once with every Movement III rule and once with each rule left off
 * (`SkilledOptions.skip`), on the same seeds, so a rule that loses fights (a SENTINEL_FOCUS_AT
 * style bug) shows up before anything is tuned around it.
 *
 *   npx tsx tools/verbs.ts --seeds 20
 *   npx tsx tools/verbs.ts --seeds 50 --encounters the_unweaver --rules cut,focusSpindle
 *   npx tsx tools/verbs.ts --movement 3 --seed-base 500003     # another seed set (a check)
 *   npx tsx tools/verbs.ts --party A --techniques swap --encounters maw_hollow --rules mawHold
 *   npx tsx tools/verbs.ts --party B --calling chronomancer --path 1 --rules mawHold,maw
 *   npx tsx tools/verbs.ts --movement 4 --seeds 20                   # the Finale's rules
 *   npx tsx tools/verbs.ts --movement 4 --party B --rules crescendoCancel,fortissimoGuard
 *   npx tsx tools/verbs.ts --movement 4 --bot novice              # the Novice's NOVICE_M4 draws
 *
 * Each row is a rule left off: its win rate, mean length and downs a fight, against every rule
 * on (the first row); a rule worth keeping costs wins, time or downs when it is off. Fights play
 * on the Movement's kit (ARRIVAL3_KIT; the Finale's ARRIVAL4_KIT), at seed base + i × 7919, as
 * the harness does.
 *
 * The rule set follows `--movement` (docs/phase-5d.md, "Tuning order" 2): Movement III's
 * `M3_RULES`, or from the Finale on its `FINALE_RULES`. `--rules` may name a rule of either.
 * `--bot novice` plays the Novice instead (`NoviceOptions.skip`) and ablates her Finale draws,
 * `NOVICE_M4_RULES`; she has no Movement III rules to leave off.
 *
 * Some rules are met only off the default setup: `mawHold` needs a Bloodlusting Brann whom no
 * plain Reel takes out of an Inhale (Swap, the Chronomancer's Rewind). `--party` (A, B, C or 3
 * hero ids, as the harness takes it), `--techniques` (variant ids, e.g. `swap` or
 * `swap,chorale`) and `--calling` (a Calling id, with `--path`'s option index at each tier, 0
 * by default) set the fights up for them. Without them the config has no such key, as before.
 */
import {
  FINALE_RULES,
  M3_RULES,
  SkilledBot,
  type FinaleRule,
  type M3Rule,
} from '../src/bots/skilled';
import { NOVICE_M4_RULES, NoviceBot, type NoviceM4Rule } from '../src/bots/novice';
import type { Bot } from '../src/bots/types';
import { FINALE_MOVEMENT } from '../src/content/crucibleIds';
import { CONTENT, callingDef } from '../src/content';
import { weaverShare } from '../src/meta/run';
import { createSim, type SimConfig } from '../src/sim';
import { partyArg } from './harness';
import { movementEncounters } from './harness-core';
import { kitConfig, kitFor } from './kits';

const MAX_TICKS = 9 * 60 * 60;

/**
 * A rule a bot's `skip` can turn off: the Skilled bot's Movement III or Finale rules, or the
 * Novice's Finale draws.
 */
export type VerbRule = M3Rule | FinaleRule | NoviceM4Rule;
/** The bot an ablation plays (`--bot`): the Skilled bot by default. */
export type VerbBot = 'skilled' | 'novice';

/** The rules a Movement's ablation plays by default: the Finale's from it on, else Movement III's. */
export function rulesFor(movement: number, bot: VerbBot = 'skilled'): readonly VerbRule[] {
  if (bot === 'novice') return movement >= FINALE_MOVEMENT ? NOVICE_M4_RULES : [];
  return movement >= FINALE_MOVEMENT ? FINALE_RULES : M3_RULES;
}

/** Every rule `--rules` may name, by bot. */
function allRules(bot: VerbBot): readonly string[] {
  return bot === 'novice' ? NOVICE_M4_RULES : [...M3_RULES, ...FINALE_RULES];
}

/** One fight's numbers. */
export interface VerbFight {
  won: boolean;
  duration: number;
  downs: number;
  share: number;
}

/** Who plays the fights (`--party`, `--techniques`, `--calling`); empty, the default setup. */
export interface VerbSetup {
  party?: readonly string[];
  techniques?: SimConfig['techniques'];
  calling?: SimConfig['calling'];
}

/** The sim config of one fight: the Movement's kit, plus whatever `setup` names (only that). */
export function verbConfig(
  encounter: string,
  seed: number,
  movement = 3,
  setup: VerbSetup = {},
): SimConfig {
  return {
    seed,
    encounter,
    ...kitConfig(kitFor(movement)),
    ...(setup.party ? { party: [...setup.party] } : {}),
    ...(setup.techniques ? { techniques: { ...setup.techniques } } : {}),
    ...(setup.calling ? { calling: setup.calling } : {}),
  };
}

/**
 * `--techniques`' value: variant ids, comma-separated, each in its own slot (content
 * `techniqueVariants`). Undefined: undefined (the defaults). Throws on an unknown id or two
 * variants in one slot.
 */
export function techniquesArg(value: string | undefined): SimConfig['techniques'] {
  if (value === undefined) return undefined;
  const out: NonNullable<SimConfig['techniques']> = {};
  for (const id of value.split(',').filter(Boolean)) {
    const v = CONTENT.techniqueVariants.find((x) => x.id === id);
    if (!v)
      throw new Error(
        `Unknown technique variant "${id}" (${CONTENT.techniqueVariants.map((x) => x.id)})`,
      );
    if (out[v.slot] !== undefined) throw new Error(`Two variants for ${v.slot}: "${value}"`);
    out[v.slot] = v.id;
  }
  return out;
}

/**
 * `--calling`'s value and `--path`'s (an option index a tier, '0' or '1' each, as the harness
 * takes it; tiers it leaves out take their first option). Undefined: undefined (no Calling).
 */
export function callingArg(
  id: string | undefined,
  path: string | undefined,
): SimConfig['calling'] | undefined {
  if (id === undefined) return undefined;
  const def = callingDef(id);
  const picks = [...(path ?? '')].map((c) => (c === '1' ? 1 : 0));
  return { id: def.id, path: def.tiers.map((t, i) => t.options[picks[i] ?? 0]!.id) };
}

/** The ablation's player: the Skilled bot (the harness's options) or the Novice, `skip` left off. */
function verbBot(seed: number, skip: ReadonlySet<VerbRule>, bot: VerbBot): Bot {
  if (bot === 'novice')
    return new NoviceBot(seed, skip.size > 0 ? { skip: skip as ReadonlySet<NoviceM4Rule> } : {});
  return new SkilledBot(seed, {
    every: 4,
    attention: 1,
    callReaction: 0.4,
    ...(skip.size > 0 ? { skip: skip as ReadonlySet<M3Rule | FinaleRule> } : {}),
  });
}

/** Plays one fight with the Skilled bot (or `bot`), `skip` left off (empty: every rule on). */
export function verbFight(
  encounter: string,
  seed: number,
  skip: ReadonlySet<VerbRule>,
  movement = 3,
  setup: VerbSetup = {},
  botKind: VerbBot = 'skilled',
): VerbFight {
  const sim = createSim(verbConfig(encounter, seed, movement, setup));
  const bot = verbBot(seed, skip, botKind);
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
  const botKind = (get('bot') ?? 'skilled') as VerbBot;
  if (botKind !== 'skilled' && botKind !== 'novice')
    throw new Error(`--bot is skilled or novice, not "${botKind}"`);
  const rules = (get('rules')?.split(',') ?? [...rulesFor(movement, botKind)]) as VerbRule[];
  const known = allRules(botKind);
  const unknown = rules.filter((r) => !known.includes(r));
  if (unknown.length > 0) throw new Error(`Unknown rule "${unknown}" (${known})`);
  const party = partyArg(get('party'));
  const techniques = techniquesArg(get('techniques'));
  const calling = callingArg(get('calling'), get('path'));
  const setup: VerbSetup = {
    ...(party ? { party } : {}),
    ...(techniques ? { techniques } : {}),
    ...(calling ? { calling } : {}),
  };
  const setupLabel = [
    party ? `party ${party.join(',')}` : '',
    techniques ? `techniques ${Object.values(techniques).join(',')}` : '',
    calling ? `${calling.id} ${(calling.path ?? []).join('/')}` : '',
  ]
    .filter(Boolean)
    .map((x) => ` · ${x}`)
    .join('');
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const signed = (x: number, digits = 0) => `${x >= 0 ? '+' : ''}${x.toFixed(digits)}`;
  const t0 = Date.now();
  console.log(
    `verb ablation · ${botKind === 'novice' ? 'Novice · ' : ''}Movement ${movement} · ${kitFor(movement).name} · ${seeds} seeds · ${encounters.length} fights · ${rules.length} rules${setupLabel}`,
  );
  for (const encounter of encounters) {
    const play = (skip: ReadonlySet<VerbRule>) =>
      Array.from({ length: seeds }, (_, i) =>
        verbFight(encounter, base + i * 7919, skip, movement, setup, botKind),
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
