// The browser test's way of following Solos (thread the hero whose Solo is soonest due, within
// `within` seconds; ties to the lower slot), tried here first: polled every `every` ticks, as a
// slow page would.  npx tsx follow.mts <repo root>
const root = process.argv[2]!;
const { createSim, soloDueIn } = await import(`${root}/src/sim/index.ts`);
function play(seed: number, within: number, every: number, calling?: { id: string; path: string[] }) {
  const sim = createSim({ seed, encounter: 'first_light', ...(calling ? { calling } : {}) });
  const st = sim.state;
  const out: string[] = [];
  let end = 'fighting at 240 s';
  for (let t = 0; t < 60 * 240; t++) {
    const commands: unknown[] = [];
    if (t === 30) commands.push({ t: 'thread', slot: 1 });
    if (t > 30 && t % every === 0) {
      const w = st.entities.get(st.weaverId)!.weaver!;
      let want: number | null = null;
      let soon = Infinity;
      st.party.forEach((id: number, slot: number) => {
        const due = soloDueIn(st, st.entities.get(id)!);
        if (due !== null && due <= within && due < soon) { soon = due; want = slot; }
      });
      if (want !== null && w.threadSlot !== want) commands.push({ t: 'thread', slot: want });
    }
    sim.step(commands as never);
    for (const e of sim.drainEvents() as { type: string; solo?: string; cued?: boolean; link?: number }[]) {
      if (e.type === 'soloStarted') out.push(`${st.time.toFixed(1)}s ${e.solo}${e.cued ? ' CUED' : ''}`);
      if (e.type === 'cueChained' && e.link! > 1) out.push(e.link === 2 ? 'DUET' : 'TRIO');
    }
    if (st.encounter.status === 'victory' || st.encounter.status === 'defeat') { end = `${st.encounter.status} at ${st.time.toFixed(1)}s`; break; }
  }
  return `${out.join(', ')} | ${end}`;
}
const conductor = { id: 'conductor', path: [] as string[] };
for (const [within, every] of [[0.8, 1], [0.8, 6], [0.8, 15], [1.5, 15]] as const) {
  let duets = 0; const lines: string[] = [];
  for (const seed of [4242, 1, 7, 99, 2024, 31337, 5, 12, 77, 300]) {
    const r = play(seed, within, every, conductor);
    if (r.includes('DUET')) duets++;
    lines.push(`  ${seed}: ${r}`);
  }
  console.log(`within ${within} s, polled every ${every} ticks: a Duet in ${duets} of 10 fights`);
  if (every === 15 && within === 0.8) console.log(lines.join('\n'));
}
