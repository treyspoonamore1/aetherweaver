// Cues in a whole run, by bot and route: npx tsx run-cues.mts <movements> <runs>
const root = '/home/user/aw-work/wt-p11solo';
const { playRun } = await import(`${root}/tools/harness-core.ts`);
const movements = Number(process.argv[2] ?? 2);
const runs = Number(process.argv[3] ?? 30);
for (const bot of ['skilled', 'novice'] as const) {
  const all: number[] = [];
  const won: number[] = [];
  for (let i = 0; i < runs; i++) {
    let cues = 0;
    let fights = 0;
    const r = playRun(2000 + i * 104729, bot, undefined, {
      movements,
      relics: true,
      onEnd: (run: { results: { stats: { cues: number } }[] }) => {
        cues = run.results.reduce((s, x) => s + x.stats.cues, 0);
        fights = run.results.length;
      },
    });
    all.push(cues);
    if (r.outcome === 'victory') won.push(cues);
    void fights;
  }
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  console.log(`${bot} movements ${movements}: Cues a run mean ${mean(all).toFixed(0)}, median ${q(all, 0.5)}, 90th ${q(all, 0.9)}, max ${Math.max(...all)}; in won runs (${won.length}) mean ${mean(won).toFixed(0)}, min ${won.length ? Math.min(...won) : '-'}, max ${won.length ? Math.max(...won) : '-'}`);
}
