// One whole run's summary: npx tsx run-one.mts <repo root> <seed> <movements>
const root = process.argv[2]!;
const { playRun } = await import(`${root}/tools/harness-core.ts`);
for (const seed of process.argv[3]!.split(',').map(Number)) {
  const r = playRun(seed, 'skilled', undefined, { movements: Number(process.argv[4] ?? 2) });
  console.log(seed, r.outcome, 'M' + r.movementReached, r.fights, 'fights', r.minutes.toFixed(1), 'min', r.lastEncounter, JSON.stringify(r.motifs), JSON.stringify(r.relics));
}
