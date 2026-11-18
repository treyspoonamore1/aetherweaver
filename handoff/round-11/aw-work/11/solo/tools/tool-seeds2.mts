const root = '/home/user/aw-work/wt-p11solo';
const { decreeFight } = await import(`${root}/tools/decrees.ts`);
const { playEncounter } = await import(`${root}/tools/harness-core.ts`);
const { kitConfig, ARRIVAL4_KIT } = await import(`${root}/tools/kits.ts`);
for (let k = 0; k < 20; k++) {
  const seed = 1000 + k * 7919;
  const f = decreeFight('the_seamstress', seed, 'skilled');
  const open = f.unpicks!.filter((u: { open?: boolean }) => u.open);
  const ok = f.won && open.length > 0 && open.every((u: { lockEnd: number | null; rethreaded: boolean }) => u.lockEnd !== null && !u.rethreaded) && f.answered.Unpicking === f.unpicks!.filter((u: { downed?: boolean }) => !u.downed).length;
  if (ok) console.log('unpick seed', seed);
}
for (let seed = 1000; seed < 1012; seed++) {
  let cue: number | null = null;
  let excused = 0;
  let unsung = 0;
  const run = playEncounter({ seed, encounter: 'the_silent_conductor', ...kitConfig(ARRIVAL4_KIT) }, 'skilled', (sim: any, events: any[]) => {
    for (const e of events) {
      if (e.type === 'enemyCued') cue = e.soloist;
      if (e.type === 'telegraphStarted' && e.owner === cue) cue = null;
      if (cue !== null && (e.type === 'phaseChanged' || (e.type === 'enemyKilled' && e.enemy === cue))) { excused++; cue = null; }
    }
    if (cue !== null && sim.state.field.finale?.cue?.soloist !== cue) { if (sim.state.encounter.status !== 'victory') unsung++; cue = null; }
  });
  console.log('finale seed', seed, run.outcome, 'excused', excused, 'unsung', unsung, 'cuesFailed', run.finale?.cuesFailed);
}
