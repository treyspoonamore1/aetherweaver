/**
 * The DamageResult key sets, pinned before Phase 5e (docs/phase-5e.md, W0a "Characterisation
 * first"; contracts item 3: `DamageResult.parried?: number`, set only by Seren's parry). Every
 * `dealDamage` result over the 19 goldens is read, and the distinct `Object.keys` lists are
 * recorded, so `parried` is proved never present for an existing party, and a stray key would
 * show up here before it moved a hash.
 *
 * Every result means every one: the calls other modules make, and the ones health.ts makes to
 * itself (Oathkeeper's share on Kael, the Lamb's blow, Aegis Link's shares, Martyr's Veil and
 * Bear on the Weaver), whose results no caller sees, only their merged outer result. A `vi.mock`
 * wrapper can't reach those: they call the module's own binding (and the modules health.ts
 * imports, loaded while the mock factory runs, get the unwrapped original). So the probe plays
 * the goldens on a copy of `src/` (and the two harness files the scenarios need) in a temporary
 * directory, in which health.ts's `dealDamage` is renamed and a reading wrapper is exported
 * under its name: every call, from any module or from health.ts itself, goes through it. The
 * copy's sim is otherwise the same source, and each golden's hash is checked against
 * golden.json, so it plays exactly the fights it pins. `nested` counts, per golden, the results
 * returned to health.ts itself (depth > 0), so the pin also proves they were sampled.
 *
 * Regenerate ONLY when damage results are meant to change:
 *   WRITE_DAMAGE_RESULT_KEYS=1 npx vitest run tests/sim/damageResultKeys.test.ts
 */
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import type { createSim as CreateSim, SimConfig } from '../../src/sim';
import type { dealDamage as DealDamage } from '../../src/sim/combat/health';
import type { World } from '../../src/sim/world';
import type { startSolo as StartSolo } from '../../src/sim/systems/solos';
import type { SCENARIOS as Scenarios } from '../../tools/scenarios';
import golden from './golden.json';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PATH = fileURLToPath(new URL('./damageResultKeys.json', import.meta.url));
const GOLDENS = golden.scenarios as Record<string, string>;
const PROBE = '__damageResultKeysProbe';
/** DamageResult's keys before Phase 5e (src/sim/combat/health.ts), the optional ones included. */
const KNOWN_KEYS = [
  'dealt',
  'absorbed',
  'absorbedByWeaver',
  'absorbedByWard',
  'absorbedByDome',
  'blocked',
  'takenBy',
  'takenDealt',
  'downed',
  'martyred',
  'saved',
  'borne',
  'absorbedByAura',
];

/** What the instrumented `dealDamage` reports to. */
const probe = {
  lists: new Map<string, number>(),
  calls: 0,
  nested: 0,
  depth: 0,
  enter(): void {
    probe.depth++;
  },
  leave(result: object): void {
    probe.depth--;
    const key = Object.keys(result).join(',');
    probe.lists.set(key, (probe.lists.get(key) ?? 0) + 1);
    probe.calls++;
    if (probe.depth > 0) probe.nested++;
  },
};

/** The wrapper appended to the copy of health.ts, under the real function's name. */
const WRAPPER = `
export function dealDamage(...args: Parameters<typeof dealDamageUnprobed>): DamageResult {
  const p = (globalThis as Record<string, any>)['${PROBE}'];
  p.enter();
  let result: DamageResult | undefined;
  try {
    result = dealDamageUnprobed(...args);
    return result;
  } finally {
    p.leave(result ?? {});
  }
}
`;

/** Turns health.ts's source into the probed one. */
function instrument(src: string): string {
  const head = 'export function dealDamage(';
  if (src.split(head).length !== 2) throw new Error('health.ts: `dealDamage` not found once');
  return src.replace(head, 'function dealDamageUnprobed(') + WRAPPER;
}

let tmp: string | null = null;
let loaded: Promise<Probed> | null = null;

interface Probed {
  createSim: typeof CreateSim;
  SCENARIOS: typeof Scenarios;
  dealDamage: typeof DealDamage;
  startSolo: typeof StartSolo;
}

/** Imports a module of the probed copy, by its path from the repo root. */
const fromCopy = async <T>(rel: string): Promise<T> =>
  (await import(/* @vite-ignore */ pathToFileURL(join(tmp!, rel)).href)) as T;

/** Copies the sim (and the scenarios) to a temporary directory, probes it, and loads it once. */
function loadProbedSim(): Promise<Probed> {
  loaded ??= (async () => {
    tmp = mkdtempSync(join(tmpdir(), 'damage-result-keys-'));
    cpSync(join(ROOT, 'src'), join(tmp, 'src'), { recursive: true });
    for (const f of ['scenarios.ts', 'kits.ts'])
      cpSync(join(ROOT, 'tools', f), join(tmp, 'tools', f));
    // Bare imports (zod) resolve from the copy as from the repo.
    symlinkSync(realpathSync(join(ROOT, 'node_modules')), join(tmp, 'node_modules'), 'dir');
    const health = join(tmp, 'src/sim/combat/health.ts');
    writeFileSync(health, instrument(readFileSync(health, 'utf8')));
    (globalThis as Record<string, unknown>)[PROBE] = probe;
    const sim = await fromCopy<{ createSim: typeof CreateSim }>('src/sim/index.ts');
    const scenarios = await fromCopy<{ SCENARIOS: typeof Scenarios }>('tools/scenarios.ts');
    const h = await fromCopy<{ dealDamage: typeof DealDamage }>('src/sim/combat/health.ts');
    const solos = await fromCopy<{ startSolo: typeof StartSolo }>('src/sim/systems/solos.ts');
    return {
      createSim: sim.createSim,
      SCENARIOS: scenarios.SCENARIOS,
      dealDamage: h.dealDamage,
      startSolo: solos.startSolo,
    };
  })();
  return loaded;
}

afterAll(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  delete (globalThis as Record<string, unknown>)[PROBE];
});

interface Kept {
  /** Each golden's distinct key lists, sorted, with how many results carried each. */
  byScenario: Record<string, Record<string, number>>;
  /** Every key any result carried, sorted. */
  keys: string[];
  /** Each golden's count of results returned to health.ts itself (its share and relay calls). */
  nested: Record<string, number>;
}

describe('DamageResult keys are unchanged over the 19 goldens (docs/phase-5e.md, W0a)', () => {
  it("the probe wraps every call, health.ts's own included", () => {
    const src = instrument(readFileSync(join(ROOT, 'src/sim/combat/health.ts'), 'utf8'));
    // One definition of each, and the recursive calls (Oathkeeper, the Lamb, Aegis Link,
    // Martyr's Veil, Bear) name `dealDamage`, which is now the wrapper.
    expect(src.match(/function dealDamageUnprobed\(/g)).toHaveLength(1);
    expect(src.match(/export function dealDamage\(/g)).toHaveLength(1);
    expect(src.match(/dealDamageUnprobed\(/g)).toHaveLength(2);
    expect((src.match(/[^.\w]dealDamage\(world,/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('equal the committed key sets, and `parried` is never present', async () => {
    expect(Object.keys(GOLDENS)).toHaveLength(19);
    const { createSim, SCENARIOS } = await loadProbedSim();
    /** Plays a golden exactly as tools/runScenario.ts does. */
    const play = (name: string): string => {
      const scenario = SCENARIOS.find((s) => s.name === name)!;
      const sim = createSim({ seed: scenario.seed, debug: true, ...scenario.config });
      const drive = scenario.driver();
      for (let tick = 0; tick < scenario.ticks; tick++) {
        sim.step(drive(tick, sim.state));
        sim.drainEvents();
      }
      return sim.hash();
    };
    const byScenario: Kept['byScenario'] = {};
    const keys = new Set<string>();
    const nested: Kept['nested'] = {};
    for (const name of Object.keys(GOLDENS)) {
      probe.lists.clear();
      probe.nested = 0;
      expect(play(name), name).toBe(GOLDENS[name]);
      expect(probe.depth, name).toBe(0);
      byScenario[name] = Object.fromEntries([...probe.lists].sort(([a], [b]) => (a < b ? -1 : 1)));
      nested[name] = probe.nested;
      for (const list of probe.lists.keys()) for (const k of list.split(',')) if (k) keys.add(k);
    }
    const fresh: Kept = { byScenario, keys: [...keys].sort(), nested };
    if (process.env.WRITE_DAMAGE_RESULT_KEYS)
      writeFileSync(PATH, JSON.stringify(fresh, null, 1) + '\n');
    const kept = JSON.parse(readFileSync(PATH, 'utf8')) as Kept;
    expect(fresh).toEqual(kept);
    // The probe really saw the hits, the module's own relay calls among them.
    expect(probe.calls).toBeGreaterThan(1000);
    expect(Object.values(nested).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(fresh.keys).toContain('dealt');
    expect(fresh.keys).not.toContain('parried');
  }, 600_000);

  /**
   * The goldens send few hits through health.ts's own calls (one, a relay to the Weaver), so the
   * share paths are driven here, on the same probed copy: each inner result is read (at depth
   * > 0) and carries only DamageResult's known keys. A key such as `parried` set only on a share
   * result would fail here even though the merged outer result never shows it.
   */
  it('reads the results of the share calls health.ts makes to itself', async () => {
    const { createSim, dealDamage, startSolo } = await loadProbedSim();
    const sandbox = (config: Partial<SimConfig>) =>
      createSim({ seed: 7, encounter: 'sandbox', debug: true, auras: [], ...config });
    const stage = (sim: ReturnType<typeof CreateSim>) => {
      sim.step([
        { t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', x: 0, z: -20, elite: false } },
      ]);
      for (let i = 0; i < 60; i++) sim.step([]);
      sim.drainEvents();
      const w = sim.state as unknown as World;
      const brute = [...w.entities.list()].find((e) => e.enemy)!;
      const of = (slot: number) => w.entities.get(w.party[slot]!)!;
      return { w, brute, kael: of(0), lyra: of(1) };
    };
    /** One enemy hit on `target`; returns the nested results' key lists it produced. */
    const nestedOf = (w: World, target: ReturnType<typeof stage>['kael'], source: number) => {
      probe.lists.clear();
      probe.nested = 0;
      const outer = dealDamage(w, target, {
        source,
        sourceName: 'test',
        amount: 200,
        telegraph: null,
      });
      expect(probe.depth).toBe(0);
      const lists = [...probe.lists.keys()];
      return { outer, nested: probe.nested, lists };
    };

    // Oathkeeper: the hit on Lyra lands on Kael, through dealDamage, at a share.
    {
      const sim = sandbox({ bonds: { talents: [], solos: ['oathkeeper'] } });
      const { w, brute, kael, lyra } = stage(sim);
      lyra.x = kael.x + 3;
      lyra.z = kael.z;
      startSolo(w, kael, false);
      const r = nestedOf(w, lyra, brute.id);
      expect(r.outer.takenBy).toBe(kael.id);
      expect(r.nested).toBe(1);
      for (const list of r.lists) {
        expect(list.split(',')).not.toContain('parried');
        for (const k of list.split(',')) if (k) expect(KNOWN_KEYS).toContain(k);
      }
    }
    // Aegis Link: the other linked hero's share goes through dealDamage too.
    {
      const sim = sandbox({ techniques: { ward: 'aegis_link' } });
      const { w, brute, kael } = stage(sim);
      sim.step([{ t: 'thread', slot: 1 }]);
      sim.step([{ t: 'tech', id: 'ward', slot: 0 }]);
      sim.drainEvents();
      expect(w.internal.link).not.toBeNull();
      const r = nestedOf(w, kael, brute.id);
      expect(r.nested).toBeGreaterThanOrEqual(1);
      for (const list of r.lists) {
        expect(list.split(',')).not.toContain('parried');
        for (const k of list.split(',')) if (k) expect(KNOWN_KEYS).toContain(k);
      }
    }
  });
});
