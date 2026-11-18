import { createSim } from '/home/user/aw-work/wt-p11solo/src/sim';
import { SCENARIOS } from '/home/user/aw-work/wt-p11solo/tools/scenarios';
for (const name of process.argv.slice(2)) {
  const sc = SCENARIOS.find((s) => s.name === name)!;
  const sim = createSim({ seed: sc.seed, debug: true, ...sc.config });
  const drive = sc.driver();
  const counts: Record<string, number> = {};
  for (let t = 0; t < sc.ticks; t++) {
    sim.step(drive(t, sim.state));
    for (const e of sim.drainEvents()) {
      const k =
        e.type === 'cueChained'
          ? `cueChained:${e.link}${e.onBeat ? ':beat' : ''}`
          : e.type === 'finaleTurnLost'
            ? `finaleTurnLost:${e.reason}`
            : e.type === 'soloStarted'
              ? `solo:${e.cued ? 'cued' : 'plain'}`
              : e.type;
      if (/cueChained|finale|marcato|silenceBegan|crescendoStart|solo:|reprised|triad|ensemble/.test(k))
        counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  console.log(name, sim.state.encounter.status, (sim.state.encounter.endedAt ?? -1).toFixed(1), sc.ticks / 60, JSON.stringify(sim.state.ledger.conducting), JSON.stringify(counts));
}
