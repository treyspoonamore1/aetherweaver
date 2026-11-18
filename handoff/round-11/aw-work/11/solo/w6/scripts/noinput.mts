// What a first fight does when nobody touches anything, and when the player only threads:
// when each Solo fires, plain or Cued, who goes down, and how it ends.
//   npx tsx noinput.mts <repo root>
const root = process.argv[2]!;
const { createSim, soloDueIn } = await import(`${root}/src/sim/index.ts`);
type Mode = 'nothing' | 'thread-kael' | 'follow';
function play(seed: number, mode: Mode, calling?: { id: string; path: string[] }) {
  const sim = createSim({ seed, encounter: 'first_light', ...(calling ? { calling } : {}) });
  const st = sim.state;
  const out: string[] = [];
  let end = 'still fighting at 240 s';
  for (let t = 0; t < 60 * 240; t++) {
    const commands: unknown[] = [];
    if (mode === 'thread-kael' && t === 30) commands.push({ t: 'thread', slot: 0 });
    if (mode === 'follow') {
      // A player who only follows Solos: Kael by default, the hero whose Solo is due within 0.6 s.
      const w = st.entities.get(st.weaverId)!.weaver!;
      let want = 0;
      st.party.forEach((id: number, slot: number) => {
        const due = soloDueIn(st, st.entities.get(id)!);
        if (due !== null && due <= 0.6) want = slot;
      });
      if (t >= 30 && w.threadSlot !== want) commands.push({ t: 'thread', slot: want });
    }
    sim.step(commands as never);
    for (const e of sim.drainEvents() as { type: string; solo?: string; cued?: boolean; hero?: number; link?: number }[]) {
      if (e.type === 'soloStarted') out.push(`${st.time.toFixed(1)}s ${e.solo}${e.cued ? ' CUED' : ''}`);
      if (e.type === 'heroDowned') out.push(`${st.time.toFixed(1)}s down:${st.entities.get(e.hero!)?.hero?.defId}`);
      if (e.type === 'cueChained' && e.link! > 1) out.push(`${st.time.toFixed(1)}s ${e.link === 2 ? 'DUET' : 'TRIO'}`);
    }
    if (st.encounter.status === 'victory' || st.encounter.status === 'defeat') {
      end = `${st.encounter.status} at ${st.time.toFixed(1)}s`;
      break;
    }
  }
  return `${out.join(', ')} | ${end}`;
}
for (const seed of [4242, 1, 7, 99, 2024, 31337])
  for (const mode of ['nothing', 'thread-kael', 'follow'] as Mode[])
    console.log(`${seed} ${mode}: ${play(seed, mode)}`);
console.log('--- the Conductor, following Solos');
for (const seed of [4242, 1, 7, 99]) console.log(`${seed}: ${play(seed, 'follow', { id: 'conductor', path: [] })}`);
