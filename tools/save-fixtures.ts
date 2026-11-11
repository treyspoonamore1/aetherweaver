/**
 * Save fixtures written by real builds (docs/phase-7.md, W5): for every commit that bumped a save
 * version (run save 1-5, profile 1-10, settings 1-4), and for the two playtest demos (Versions 13
 * and 14, each start), this checks the commit out in a scratch git worktree, links today's
 * `node_modules` into it, and runs a small writer there that uses **that build's own code**:
 *
 * - a run: `newRun`, `embark`, fights chosen on its map and won (`fakeOutcome`, the UI lab's
 *   made-up result, from that build), every screen between them passed, until a third fight is
 *   chosen: a run mid-Movement, saved with that build's `saveRun` (the copy before it is the
 *   backup);
 * - a profile (from Phase 3 on): that build's profile store, played on through whichever of its
 *   actions it has (XP, runs, the Astrolabe, Deeds, the Reliquary, Bonds, variants, Starlight,
 *   mastery, the roster, the route), saved with its `saveProfile`;
 * - settings: that build's settings store, changed through its own `update`, as its `save`
 *   writes them;
 * - the demo builds: `chooseDemo(start)`, as a tester's click wrote them.
 *
 * Each fixture is `tests/fixtures/saves/<id>.json`: the storage keys as written, byte for byte,
 * with the commit, the versions and how it was written. `--expect` then records what today's build
 * loads from each (`expected.json`), which `tests/meta/saveMatrix.test.ts` holds it to.
 *
 * Run: `npx tsx tools/save-fixtures.ts [--only <id>] [--builds <dir>]` (writes the fixtures), then
 * `npx tsx tools/save-fixtures.ts --expect`. A build that can't write its save with today's
 * dependencies is reported, and its fixture is written from that commit's schema instead, marked
 * `"writtenBy": "schema"` (none needed it when these were made).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_SETTINGS, migrateSettings } from '../src/app/settings';
import { createSim } from '../src/sim';
import { FIGHT_AETHER, RELIC_OFFERS } from '../src/meta/economy';
import * as Run from '../src/meta/run';
import { readProfile, readRun, SAVE_KEYS } from '../src/meta/save';
import { memoryStore, SETTINGS_KEY } from '../src/meta/saveFile';
import type { RunState } from '../src/meta/types';

const ROOT = resolve(import.meta.dirname, '..');
export const FIXTURE_DIR = join(ROOT, 'tests/fixtures/saves');

/** One build a fixture comes from. */
export interface FixtureBuild {
  id: string;
  commit: string;
  /** What it bumped (or what it is). */
  why: string;
  /** A demo build: the start a tester chose. */
  demo?: 'fresh' | 'veteran';
}

/**
 * The builds: each commit that bumped a save version (`git log -S` on each version constant),
 * then the two demo versions' published commits (docs/demo.md).
 */
export const BUILDS: readonly FixtureBuild[] = [
  { id: 'b01-71840ed', commit: '71840ed', why: 'run save v1, settings v1 (Phase 1)' },
  { id: 'b02-b2afe4a', commit: 'b2afe4a', why: 'run save v2, settings v2 (Phase 2)' },
  { id: 'b03-05933c4', commit: '05933c4', why: 'run save v3, settings v3, profile v1 (Phase 3)' },
  { id: 'b04-ad36f11', commit: 'ad36f11', why: 'run save v4 (Phase 3b)' },
  { id: 'b05-61a0621', commit: '61a0621', why: 'run save v5 (Phase 3c)' },
  { id: 'b06-ee6b25e', commit: 'ee6b25e', why: 'profile v2 (Phase 4)' },
  { id: 'b07-05f4454', commit: '05f4454', why: 'profile v3 (Phase 4b)' },
  { id: 'b08-9e21c4d', commit: '9e21c4d', why: 'profile v4 (Phase 4c)' },
  { id: 'b09-29278e2', commit: '29278e2', why: 'profile v5 (Phase 4d)' },
  { id: 'b10-21ef501', commit: '21ef501', why: 'profile v6 (Phase 4e)' },
  { id: 'b11-7a2bbdd', commit: '7a2bbdd', why: 'profile v7 (Phase 4f)' },
  { id: 'b12-237094f', commit: '237094f', why: 'profile v8 (Phase 4g)' },
  { id: 'b13-a5c4ea5', commit: 'a5c4ea5', why: 'settings v4 (health at a glance)' },
  { id: 'b14-5b365b3', commit: '5b365b3', why: 'profile v9 (Phase 5a)' },
  { id: 'b15-d86b04a', commit: 'd86b04a', why: 'profile v10 (Phase 6)' },
  { id: 'demo13-fresh', commit: '2554e69', why: 'demo Version 13, Start fresh', demo: 'fresh' },
  { id: 'demo13-veteran', commit: '2554e69', why: 'demo Version 13, Veteran', demo: 'veteran' },
  { id: 'demo14-fresh', commit: '6a2b5eb', why: 'demo Version 14, Start fresh', demo: 'fresh' },
  { id: 'demo14-veteran', commit: '6a2b5eb', why: 'demo Version 14, Veteran', demo: 'veteran' },
];

/** A fixture file: the keys a build wrote, byte for byte, and where they came from. */
export interface Fixture {
  id: string;
  commit: string;
  subject: string;
  why: string;
  writtenBy: 'build' | 'schema';
  versions: { run: number | null; profile: number | null; settings: number | null };
  notes: string[];
  keys: Record<string, string>;
}

/**
 * The writer, run inside the old build's worktree (`.save-fixture-writer.ts`). It reaches the
 * build's modules by path and asks for nothing that build may lack without checking first.
 */
const WRITER = String.raw`
const demo = process.env.FIXTURE_DEMO || '';
const notes: string[] = [];
const keys: Record<string, string> = {};
const memory = new Map<string, string>();
const store = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
};
const fs: any = await import('node:fs');
const has = (rel: string) => fs.existsSync(rel);
const save: any = await import('./src/meta/save.ts');
const Run: any = await import('./src/meta/run.ts');
const mock: any = await import('./src/ui/lab/mock.ts');
const content: any = (await import('./src/content/index.ts')).CONTENT;

if (demo) {
  const choice: any = await import('./src/app/demoChoice.ts');
  const storageMod: any = await import('./src/app/storage.ts');
  choice.chooseDemo(demo);
  const s = storageMod.storage();
  for (const k of ['aetherweaver.profile', 'aetherweaver.profile.bak', 'aetherweaver.run',
    'aetherweaver.run.bak', 'aetherweaver.settings', 'aetherweaver.demo.start']) {
    const v = s.getItem(k);
    if (v !== null) keys[k] = v;
  }
  notes.push('chooseDemo(' + JSON.stringify(demo) + ') through the build’s own stores');
} else {
  // ── A run mid-Movement ──
  let run = Run.embark(Run.newRun(4242));
  let won = 0;
  const fights = new Set(['skirmish', 'elite', 'miniboss', 'boss']);
  for (let step = 0; step < 80; step++) {
    let next = run;
    if (run.phase === 'map') {
      const options = Run.reachable(run);
      if (options.length === 0) break;
      const node = options.find((n: any) => fights.has(n.kind)) ?? options[0];
      if (fights.has(node.kind) && won >= 2) {
        save.saveRun(store, run);
        run = Run.chooseNode(run, node.id);
        break;
      }
      next = Run.chooseNode(run, node.id);
    } else if (run.phase === 'combat') {
      next = Run.finishCombat(run, mock.fakeOutcome(run, true));
      if (next !== run) won++;
    } else if (run.phase === 'result') next = Run.continueFromResult(run);
    else if (run.phase === 'draft') next = Run.pickDraft(run, 0);
    else if (run.phase === 'relic' && Run.pickRelic) next = Run.pickRelic(run, 0);
    else if (run.phase === 'respite') next = Run.respite(run, 'rest');
    else if (run.phase === 'scene' && Run.endScene) next = Run.endScene(run);
    else if (run.phase === 'merchant' && Run.leaveShop) next = Run.leaveShop(run);
    else if (run.phase === 'forge' && Run.leaveForge) next = Run.leaveForge(run);
    else if (run.phase === 'event' && Run.leaveEvent) next = Run.leaveEvent(run);
    else if (run.phase === 'calling' && Run.pickCalling) next = Run.pickCalling(run, 0);
    if (next === run) {
      notes.push('the run stopped at ' + run.phase);
      break;
    }
    run = next;
  }
  save.saveRun(store, run);
  notes.push('run: ' + won + ' fights won, then ' + run.phase + ' at ' + (run.pending ?? 'no node'));
  for (const k of ['aetherweaver.run', 'aetherweaver.run.bak']) {
    const v = store.getItem(k);
    if (v !== null) keys[k] = v;
  }

  // ── A profile, through the build's own store ──
  if (has('./src/meta/profile.ts') && has('./src/app/profileStore.ts')) {
    const P: any = (await import('./src/app/profileStore.ts')).useProfile;
    const did: string[] = [];
    const act = (name: string, ...args: any[]) => {
      const fn = P.getState()[name];
      if (typeof fn !== 'function') return false;
      try {
        fn(...args);
        did.push(name);
        return true;
      } catch (e) {
        notes.push(name + ' threw: ' + String(e));
        return false;
      }
    };
    act('award', 2600);
    act('dismissRankUps');
    act('recordRun', true);
    act('recordRun', false);
    for (const node of (content.astrolabe?.nodes ?? []).filter((n: any) => n.kind !== 'start')) {
      const before = JSON.stringify(P.getState().profile.astrolabe);
      act('takeNode', node.id);
      if (JSON.stringify(P.getState().profile.astrolabe) !== before && P.getState().profile.astrolabe.length >= 2) break;
    }
    act('recordDeeds', { ...run, outcome: 'victory' });
    act('dismissDeeds');
    const relic = content.relics?.[0]?.id;
    if (relic) act('enshrine', { id: relic, cleansed: false });
    act('payReliquary', { shards: 30, tears: 1 });
    act('awardBonds', { kael: 300, lyra: 120 });
    act('dismissBondNotices');
    const variant = content.techniqueVariants?.[0]?.id;
    if (variant) act('ownVariant', variant);
    act('awardStarlight', 150);
    act('awardMastery', 'luminary', 600);
    act('recruit', ['brann']);
    act('clearRecruitNotices');
    act('setRunMode', 'expedition');
    const profile = P.getState().profile;
    // The copy before the last change is the backup, as play leaves it.
    save.saveProfile(store, { ...profile, runs: Math.max(0, profile.runs - 1) });
    save.saveProfile(store, profile);
    notes.push('profile store actions: ' + did.join(', '));
    for (const k of ['aetherweaver.profile', 'aetherweaver.profile.bak']) {
      const v = store.getItem(k);
      if (v !== null) keys[k] = v;
    }
  }

  // ── Settings, through the build's own store ──
  const S: any = (await import('./src/app/settings.ts')).useSettings;
  S.getState().update((d: any) => ({
    ...d,
    volumes: { ...d.volumes, music: 0.35 },
    screenShake: 0.5,
    hints: false,
  }));
  keys['aetherweaver.settings'] = JSON.stringify(S.getState().settings);
}
process.stdout.write('\n@@FIXTURE@@' + JSON.stringify({ keys, notes }) + '\n');
`;

const versionOf = (text: string | undefined): number | null => {
  if (!text) return null;
  try {
    const v = (JSON.parse(text) as { version?: unknown }).version;
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
};

function git(args: string[], cwd = ROOT): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/** Writes one build's fixture (its worktree made and removed here). */
export function writeFixture(build: FixtureBuild, buildsDir: string): Fixture {
  const dir = join(buildsDir, build.commit);
  if (!existsSync(dir)) git(['worktree', 'add', '--detach', dir, build.commit]);
  try {
    const modules = join(dir, 'node_modules');
    if (!existsSync(modules)) symlinkSync('/home/user/aetherweaver/node_modules', modules);
    writeFileSync(join(dir, '.save-fixture-writer.ts'), WRITER);
    const out = execFileSync(join(modules, '.bin/tsx'), ['.save-fixture-writer.ts'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, FIXTURE_DEMO: build.demo ?? '' },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000,
    });
    const line = out.split('\n').find((l) => l.startsWith('@@FIXTURE@@'));
    if (!line) throw new Error(`no fixture from ${build.commit}`);
    const { keys, notes } = JSON.parse(line.slice('@@FIXTURE@@'.length)) as {
      keys: Record<string, string>;
      notes: string[];
    };
    return {
      id: build.id,
      commit: build.commit,
      subject: git(['log', '-1', '--format=%s', build.commit]),
      why: build.why,
      writtenBy: 'build',
      versions: {
        run: versionOf(keys[SAVE_KEYS.run]),
        profile: versionOf(keys[SAVE_KEYS.profile]),
        settings: versionOf(keys[SETTINGS_KEY]),
      },
      notes,
      keys,
    };
  } finally {
    git(['worktree', 'remove', '--force', dir]);
  }
}

/** Every fixture on disk, in `BUILDS` order. */
export function readFixtures(dir = FIXTURE_DIR): Fixture[] {
  return BUILDS.filter((b) => existsSync(join(dir, `${b.id}.json`))).map(
    (b) => JSON.parse(readFileSync(join(dir, `${b.id}.json`), 'utf8')) as Fixture,
  );
}

// ── What today's build makes of each fixture ───────────────────────────────────────────

/** How long a fixture's next fight is played (no commands): enough for the party to engage. */
export const FIGHT_TICKS = 1800;

/** The run's next fight: the one it is in, or the first fight its map offers next. */
export function toNextFight(run: RunState): RunState | null {
  if (run.phase === 'combat') return run;
  if (run.phase !== 'map') return null;
  const node = Run.reachable(run).find((n) => n.encounterId !== null);
  return node ? Run.chooseNode(run, node.id) : null;
}

/** A fight played `FIGHT_TICKS` ticks with no commands, or to its end: its hash and tick. */
export function playFight(run: RunState): { hash: string; tick: number; encounter: string } | null {
  const config = Run.combatConfig(run, DEFAULT_SETTINGS.assists);
  if (!config) return null;
  const sim = createSim(config);
  const over = () =>
    sim.state.encounter.status === 'victory' || sim.state.encounter.status === 'defeat';
  while (sim.tick < FIGHT_TICKS && !over()) sim.step();
  return { hash: sim.hash(), tick: sim.tick, encounter: config.encounter ?? '' };
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The values a loader gives a run save's nested fields the save never had, each stated here from
 * the decision behind it rather than read from the loader (review B, finding 9): a path (array
 * indices as `[]`), the value from the save's own objects around it (`parents`, outermost first,
 * the field's own object last), and where the decision is written.
 */
export const NESTED_DEFAULTS: readonly {
  path: string;
  value: (parents: readonly Json[]) => unknown;
  why: string;
}[] = [
  {
    path: 'map.rows[][].reward.threat',
    value: () => 1,
    why: 'maps tuned before Threat keep their fights at ×1 (17dbc56, 71b6b0c; `v3to4`)',
  },
  {
    path: 'map.rows[][].movement',
    value: () => 1,
    why: 'maps from before Movements are Movement I’s (docs/phase-5a.md)',
  },
  {
    path: 'map.rows[][].eventId',
    value: () => null,
    why: 'maps from before events have none (Phase 3b; `v3to4`)',
  },
  {
    path: 'map.rows[][].reward.aether',
    value: (p) => FIGHT_AETHER[String(p.at(-2)?.kind) as keyof typeof FIGHT_AETHER] ?? 0,
    why: 'a fight pays its kind’s Aether (`FIGHT_AETHER`, Phase 3b economy)',
  },
  {
    path: 'map.rows[][].reward.relics',
    value: (p) =>
      p.at(-2)?.kind === 'elite'
        ? RELIC_OFFERS.elite.count
        : p.at(-2)?.kind === 'miniboss'
          ? RELIC_OFFERS.boss.count
          : 0,
    why: 'an elite and a miniboss offer their relics (`RELIC_OFFERS`, Phase 3b economy)',
  },
];

/**
 * Nested fields the twin takes from the loaded run, unproven by it: the records of the fights
 * already played (their tallies and rewards), which no later fight reads.
 */
export const LOADED_RECORDS: readonly string[] = ['results[]', 'lastResult'];

/** `raw` (a value the save had) over `loaded`'s shape, with the nested defaults above. */
function fromRaw(raw: unknown, loaded: unknown, path: string, parents: readonly Json[]): unknown {
  if (isObject(raw) && isObject(loaded)) {
    const out: Json = {};
    const around = [...parents, raw];
    for (const [k, v] of Object.entries(loaded)) {
      const at = `${path}.${k}`;
      if (k in raw) out[k] = fromRaw(raw[k], v, at, around);
      else if (LOADED_RECORDS.some((r) => at.startsWith(`${r}.`) || at === r)) out[k] = v;
      else {
        const rule = NESTED_DEFAULTS.find((d) => d.path === at);
        if (!rule)
          throw new Error(
            `freshTwin: the loader fills ${at}, which the save never had, and NESTED_DEFAULTS states no value for it`,
          );
        out[k] = rule.value(around);
      }
    }
    return out;
  }
  if (Array.isArray(raw) && Array.isArray(loaded) && raw.length === loaded.length)
    return raw.map((r, i) => fromRaw(r, loaded[i], `${path}[]`, parents));
  return raw;
}

/**
 * The same run built fresh by today's build, from the save's own values (review B, finding 9):
 * `newRun(seed)` for every key the save never had (the migrations' defaults for the systems an old
 * save never had are a fresh run's), and for every key it had, its raw value, nested field by
 * field, with only these from elsewhere:
 *   - a nested field the save never had takes its stated default (`NESTED_DEFAULTS`); one with no
 *     stated default throws, so a new nested default must be stated before it passes;
 *   - the records of fights already played (`LOADED_RECORDS`) are the loaded run's;
 *   - `version` (the save's stamp) and `chords` for a v1 save's `auras` (a rename) are the loaded
 *     run's.
 * Its next fight must hash as the loaded run's does: so a loader that changes a value the save had,
 * or fills a nested field with another value than its stated default, fails the matrix.
 */
export function freshTwin(loaded: RunState, raw: Record<string, unknown>): RunState {
  const own = new Set(Object.keys(raw));
  const fresh = Run.newRun(loaded.seed) as unknown as Json;
  const from = loaded as unknown as Json;
  for (const key of Object.keys(loaded)) {
    if (key === 'version' || (key === 'chords' && !own.has('chords') && own.has('auras')))
      fresh[key] = from[key];
    else if (own.has(key)) fresh[key] = fromRaw(raw[key], from[key], key, []);
  }
  return fresh as unknown as RunState;
}

/** What today's build makes of a fixture: each save as loaded, and the run's next fight. */
export interface Expected {
  profile: { from: string; json: unknown } | null;
  run: {
    from: string;
    phase: string | null;
    fight: { hash: string; tick: number; encounter: string } | null;
  } | null;
  settings: unknown;
}

export function expectedOf(f: Fixture): Expected {
  const store = memoryStore();
  for (const [k, v] of Object.entries(f.keys)) store.setItem(k, v);
  const hasProfile = SAVE_KEYS.profile in f.keys;
  const hasRun = SAVE_KEYS.run in f.keys;
  const profile = hasProfile ? readProfile(store, 1) : null;
  const run = hasRun ? readRun(store) : null;
  const next = run?.run ? toNextFight(run.run) : null;
  const settingsText = f.keys[SETTINGS_KEY];
  return {
    profile: profile ? { from: profile.from, json: profile.profile } : null,
    run: run
      ? { from: run.from, phase: run.run?.phase ?? null, fight: next ? playFight(next) : null }
      : null,
    settings: settingsText ? migrateSettings(JSON.parse(settingsText)) : null,
  };
}

function main(): void {
  const argv = process.argv.slice(2);
  const arg = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  if (argv.includes('--expect')) {
    const all = Object.fromEntries(readFixtures().map((f) => [f.id, expectedOf(f)]));
    writeFileSync(join(FIXTURE_DIR, 'expected.json'), `${JSON.stringify(all, null, 2)}\n`);
    execFileSync('npx', ['prettier', '--write', FIXTURE_DIR], { cwd: ROOT, stdio: 'ignore' });
    console.log(`✔ expected.json: ${Object.keys(all).length} fixtures`);
    return;
  }
  const buildsDir = resolve(arg('--builds') ?? '/home/user/aw-work/7/w5/builds');
  mkdirSync(buildsDir, { recursive: true });
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const only = arg('--only');
  for (const build of BUILDS) {
    if (only && build.id !== only) continue;
    const started = Date.now();
    try {
      const fixture = writeFixture(build, buildsDir);
      writeFileSync(join(FIXTURE_DIR, `${build.id}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
      console.log(
        `✔ ${build.id} (${build.commit}): run ${fixture.versions.run}, profile ${fixture.versions.profile}, settings ${fixture.versions.settings} (${Date.now() - started} ms)`,
      );
    } catch (e) {
      console.log(`✘ ${build.id} (${build.commit}): ${String(e).slice(0, 2000)}`);
      process.exitCode = 1;
    }
  }
  // Prettier's JSON layout, so the repository's format check passes; the saves' text, held in
  // JSON strings, is untouched by it.
  execFileSync('npx', ['prettier', '--write', FIXTURE_DIR], { cwd: ROOT, stdio: 'ignore' });
}

if (import.meta.url === `file://${process.argv[1]}`) main();
