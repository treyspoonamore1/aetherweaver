// Whole baseline-style runs over many seeds: how often each bot wins, and how far it gets.
//   npx tsx runs-rate.ts <repo root> <movements> <seeds>
const root = process.argv[2]!;
const movements = Number(process.argv[3] ?? 2);
const seeds = Number(process.argv[4] ?? 40);
const { expeditionRun } = (await import(`${root}/tools/expedition-baseline.ts`)) as {
  expeditionRun: (bot: 'novice' | 'skilled', i: number, movements: number) => {
    outcome: string;
    movementReached: number;
    fights: number;
    minutes: number;
  };
};
for (const bot of ['novice', 'skilled'] as const) {
  let wins = 0;
  let fights = 0;
  let minutes = 0;
  const reached = new Map<number, number>();
  for (let i = 0; i < seeds; i++) {
    const r = expeditionRun(bot, i, movements);
    if (r.outcome === 'victory') wins++;
    fights += r.fights;
    minutes += r.minutes;
    reached.set(r.movementReached, (reached.get(r.movementReached) ?? 0) + 1);
  }
  const far = [...reached.entries()].sort((a, b) => a[0] - b[0]).map(([m, n]) => `M${m}:${n}`).join(' ');
  console.log(
    `${bot.padEnd(8)} movements ${movements}, ${seeds} runs: won ${((100 * wins) / seeds).toFixed(0)}%, ${(fights / seeds).toFixed(1)} fights, ${(minutes / seeds).toFixed(1)} min; ended in ${far}`,
  );
}
