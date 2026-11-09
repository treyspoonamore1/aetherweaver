/**
 * Freezes the motif/relic resolver's output (docs/phase-5g.md, ground rule 4) into
 * `resolver.json`, beside this file. It was run ONCE, on the tree before Phase 5g's W0 touched
 * `src/sim/mods.ts` (main at 2a9f68b), and its output is committed:
 *
 *   npx tsx tests/fill/pre5g/freezeResolver.ts
 *
 * It refuses to overwrite the fixture: re-running it on a later tree would freeze that tree's
 * resolver, which proves nothing. `tests/fill/foundations.test.ts` resolves every stored input
 * again and compares.
 *
 * What it holds:
 *   - `noMods`: NO_MODS as it was;
 *   - `cases`: an input (motifs, relics, boons, a Calling and path, Astrolabe nodes, passives,
 *     Dissonance) and the resolved mods' keys that differ from `noMods`. The inputs are every
 *     motif at every level alone; every relic alone (plain, cleansed when cursed, Empowered when
 *     it can be); every boon alone; and 200 builds drawn from a fixed-seed PRNG with motifs,
 *     relics, boons, a Calling with a path, Astrolabe nodes, passives and Dissonance levels.
 *
 * Numbers are stored as JSON numbers (exact round trip), except -0, NaN and ±Infinity, which are
 * stored as the strings "-0", "NaN", "Infinity" and "-Infinity" (`encodeNumber`).
 */
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONTENT } from '../../../src/content';
import { PASSIVE_EFFECTS } from '../../../src/content/schema';
import { NO_MODS, resolveMods } from '../../../src/sim/mods';
import type { ResolvedSimConfig } from '../../../src/sim/world';
import { encodeMods, type ResolverCase, type ResolverInput } from './resolverFixture';

const PATH = fileURLToPath(new URL('./resolver.json', import.meta.url));

/** mulberry32: a small fixed PRNG, so the builds are the same on every machine. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, list: readonly T[], n: number): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < n && pool.length > 0)
    out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]!);
  return out;
}

const EMPTY: ResolverInput = {
  motifs: [],
  relics: [],
  boons: [],
  calling: null,
  astrolabe: [],
  passives: [],
  dissonance: [],
};

function build(seed: number): ResolverInput {
  const r = prng(seed * 7919 + 17);
  const motifs = pick(r, CONTENT.motifs, Math.floor(r() * 11)).map((d) => ({
    id: d.id,
    level: 1 + Math.floor(r() * d.values.length),
  }));
  const relics = pick(r, CONTENT.relics, 1 + Math.floor(r() * 6)).map((d) => ({
    id: d.id,
    cleansed: d.rarity === 'cursed' && r() < 0.5,
    empowered: d.empowered !== undefined && r() < 0.5,
  }));
  const boons = pick(r, CONTENT.boons, Math.floor(r() * 3)).map((d) => d.id);
  const calling = CONTENT.callings[Math.floor(r() * CONTENT.callings.length)]!;
  const path = calling.tiers
    .map((t) => (r() < 0.6 ? t.options[Math.floor(r() * 2)]!.id : null))
    .filter((id): id is string => id !== null);
  const astrolabe = pick(r, CONTENT.astrolabe.nodes, Math.floor(r() * 30))
    .map((n) => n.id)
    .sort();
  const passives = pick(r, PASSIVE_EFFECTS, Math.floor(r() * 4)).map((effect) => ({
    effect,
    value: 1 + Math.floor(r() * 12),
  }));
  const dissonance = pick(r, CONTENT.dissonance, Math.floor(r() * 4)).map((d) => ({
    id: d.id,
    rank: 1 + Math.floor(r() * d.ranks),
  }));
  return {
    motifs,
    relics,
    boons,
    calling: { id: calling.id, path, reviveSpent: false },
    astrolabe,
    passives,
    dissonance,
  };
}

function inputs(): ResolverInput[] {
  const out: ResolverInput[] = [];
  for (const d of CONTENT.motifs)
    for (let level = 1; level <= d.values.length; level++)
      out.push({ ...EMPTY, motifs: [{ id: d.id, level }] });
  for (const d of CONTENT.relics) {
    out.push({ ...EMPTY, relics: [{ id: d.id, cleansed: false, empowered: false }] });
    if (d.rarity === 'cursed')
      out.push({ ...EMPTY, relics: [{ id: d.id, cleansed: true, empowered: false }] });
    if (d.empowered)
      out.push({ ...EMPTY, relics: [{ id: d.id, cleansed: false, empowered: true }] });
  }
  for (const d of CONTENT.boons) out.push({ ...EMPTY, boons: [d.id] });
  for (let seed = 1; seed <= 200; seed++) out.push(build(seed));
  return out;
}

function main(): void {
  if (existsSync(PATH)) {
    console.error(`${PATH} exists: it is the frozen pre-5g resolver and is never rewritten.`);
    process.exit(1);
  }
  const noMods = encodeMods(NO_MODS as unknown as Record<string, unknown>);
  const cases: ResolverCase[] = inputs().map((input) => {
    const mods = encodeMods(
      resolveMods(input as unknown as ResolvedSimConfig, CONTENT) as unknown as Record<
        string,
        unknown
      >,
    );
    const diff = Object.fromEntries(
      Object.entries(mods).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(noMods[k])),
    );
    return { input, mods: diff };
  });
  writeFileSync(PATH, JSON.stringify({ noMods, cases }, null, 1) + '\n');
  console.log(`Wrote ${PATH}: ${cases.length} cases.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
