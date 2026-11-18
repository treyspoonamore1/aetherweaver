import type { Bot } from '/home/user/aw-work/wt-p11solo/src/bots';
import { ExpertBot, type ExpertRule } from '/home/user/aw-work/wt-p11solo/src/bots/expert';
import { CONDUCTOR } from '/home/user/aw-work/wt-p11solo/src/content/crucibleIds';
import { createSim, type Command, type SimConfig, type WorldState } from '/home/user/aw-work/wt-p11solo/src/sim';
import { StateHasher, hashValue } from '/home/user/aw-work/wt-p11solo/src/sim/core/hash';
import { ARRIVAL4_KIT, kitConfig } from '/home/user/aw-work/wt-p11solo/tools/kits';

const MAX_TICKS = 9 * 60 * 60;
const level = (id: string) => [{ id, rank: 1 }];
interface Stage { each?: (state: WorldState) => void; reset?: () => void }
function play(config: SimConfig, bot: Bot, stage: Stage = {}) {
  stage.reset?.();
  const sim = createSim(config);
  const h = new StateHasher();
  for (let t = 0; t < MAX_TICKS; t++) {
    stage.each?.(sim.state);
    const commands: Command[] = bot.decide(sim.state);
    if (commands.length > 0) { h.u32(t); hashValue(h, commands); }
    sim.step(commands);
    sim.drainEvents();
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') break;
  }
  return { commands: h.digest(), fires: bot instanceof ExpertBot ? { ...bot.play.fires } : null };
}
const expert = (seed: number, skip: ExpertRule[] = []) => new ExpertBot(seed, skip.length > 0 ? { skip: new Set(skip) } : {});
function acts(rule: ExpertRule, config: SimConfig, stage: Stage = {}): string {
  const on = play(config, expert(config.seed), stage);
  const off = play(config, expert(config.seed, [rule]), stage);
  return `${on.fires![rule]} fired, off ${off.fires![rule]}, ${off.commands !== on.commands ? 'CHANGES' : 'same'}`;
}
const POSTLUDE: SimConfig = { seed: 1000, encounter: CONDUCTOR, ...kitConfig(ARRIVAL4_KIT), dissonance: level('true_dissonance') };
const which = process.argv[2];
for (let i = 0; i < 8; i++) {
  const seed = 1000 + i * 7919;
  if (which === 'mimicFocus') console.log(seed, acts('mimicFocus', { seed, encounter: 'shattered_choir', dissonance: level('mimicry') }));
  if (which === 'postludePair') console.log(seed, acts('postludePair', { ...POSTLUDE, seed }));
  if (which === 'postludeRise' || which === 'postludeBank') {
    let staged = false;
    const rise: Stage = {
      each: (state) => {
        const p = state.field.finale?.postlude;
        if (staged || !p) return;
        (state.entities.get(state.weaverId)!.weaver! as { resonance: number }).resonance = 100;
        staged = true;
      },
      reset: () => (staged = false),
    };
    const bank: Stage = {
      each: (state) => {
        const p = state.field.finale?.postlude;
        const d = state.field.finale?.discord;
        if (staged || !p || !d || state.time < p.riseUntil) return;
        (d as { value: number }).value = 80;
        (state.entities.get(state.weaverId)!.weaver! as { resonance: number }).resonance = 100;
        staged = true;
      },
      reset: () => (staged = false),
    };
    const config: SimConfig = { ...POSTLUDE, seed, calling: { id: 'conductor', path: ['marcato', 'reprise', 'ensemble', 'triad'] } };
    console.log(seed, which, acts(which, config, which === 'postludeRise' ? rise : bank));
  }
}
