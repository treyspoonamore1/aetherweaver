/**
 * The release checklist, row by row (docs/plan/06 §6, and docs/phase-7.md *Exit criteria*).
 *
 * Each row prints one of four states with the evidence behind it:
 *
 *   green              every part of the row is shown, here, by evidence this tool read or ran
 *   red                a part of the row failed
 *   not provable here  a part needs a person, a real GPU or a real laptop (the evidence for the
 *                      rest of the row is still listed)
 *   not run            nobody gave this tool the evidence, and it does not produce it itself
 *
 * A row takes its worst part: red, then not run, then not provable here, then green.
 *
 * With no flag it runs only quick checks (the licence record against `dist/`, the build's sizes,
 * the version pins, the aura files' diff) and reads nothing else, so it never runs the whole
 * vitest suite or the whole e2e suite itself. The long runs are read from their logs:
 *
 *   npx tsx tools/release-check.ts \
 *     --suite full.log.json        the vitest run (full-suite.sh's JSON report, or its log)
 *     --e2e e2e.log                the Playwright run's list output
 *     --fullrun fullrun.log        the full run's (e2e/fullrun.spec.ts) output
 *     --baselines DIR              logs of the `--check` runs of the baseline tools
 *     --run goldens,sim-bench      also run those quick checks: goldens, sim-bench, typecheck, lint
 *     --dist DIR  --base REF       the build to read (default dist), the commit the aura diff reads from
 *     --strict                     a row that is "not run" also fails
 *
 * Exit status: 1 if any row is red (or, with --strict, not run); otherwise 0. "Not provable here"
 * never fails: it says what a person has to look at.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONTENT_VERSION } from '../src/content';
import { RUN_SAVE_VERSION } from '../src/meta/types';
import { PROFILE_VERSION } from '../src/meta/profile';
import { RUN_REPLAY_VERSION } from '../src/meta/runReplay';
import { SIM_VERSION } from '../src/sim/constants';
import { ReplaySchema } from '../src/sim/replay';
import { DEFAULT_SETTINGS } from '../src/app/settings';
import { checkRecord, type CheckResult } from './licenses';

export type Status = 'green' | 'red' | 'not provable here' | 'not run';

export interface Part {
  status: Status;
  text: string;
}

export interface RowResult {
  id: string;
  title: string;
  status: Status;
  parts: Part[];
}

/** What the release pins, as recorded at the start of Phase 7 (docs/phase-7.md, ground rule 1). */
export const RELEASE_PINS = {
  simVersion: 22,
  contentVersion: 'c-691f26eff5775748',
  runSave: 5,
  profile: 10,
  settings: 4,
  fightReplay: 6,
  runReplay: 1,
} as const;

/** The commit Phase 7's pins are read from: main when docs/phase-7.md was written. */
export const PHASE7_BASE = '6a2b5eb';

/** Files nobody edits in Phase 7 (ground rule 4, and the aura presentation pin). */
export const AURA_FILES: readonly string[] = [
  'src/content/auras.ts',
  'src/content/ornaments.ts',
  'src/sim/combat/auras.ts',
  'src/sim/systems/field.ts',
  'src/sim/chords.ts',
  'src/render/field.ts',
  'src/render/songs.ts',
  'src/render/fermata.ts',
  'src/ui/hud/WeaverBar.tsx',
  'src/ui/screens/ChordBuilder.tsx',
  'src/ui/kit/iconPaths.ts',
];

/** The aura presentation pin, which must have exactly one commit: the one that recorded it. */
export const AURA_PIN = 'tests/aura/presentationPin.json';

/** The download budget (docs/plan/05 §12). */
export const DOWNLOAD_BUDGET_BYTES = 25 * 1024 * 1024;

const STATUS_ORDER: Status[] = ['red', 'not run', 'not provable here', 'green'];

function worst(parts: readonly Part[]): Status {
  for (const s of STATUS_ORDER) if (parts.some((p) => p.status === s)) return s;
  return 'not run';
}

function row(id: string, title: string, parts: Part[]): RowResult {
  return { id, title, status: worst(parts), parts };
}

const green = (text: string): Part => ({ status: 'green', text });
const red = (text: string): Part => ({ status: 'red', text });
const noProof = (text: string): Part => ({ status: 'not provable here', text });
const notRun = (text: string): Part => ({ status: 'not run', text });

// ── Evidence ────────────────────────────────────────────────────────────────

export interface Suite {
  /** Test files by name relative to the project ("tests/sim/golden.test.ts"), with their result. */
  files: Map<string, 'passed' | 'failed'>;
  tests: number;
  /** The failed tests' names. */
  failed: string[];
}

/** Reads a vitest run: `full-suite.sh`'s JSON report, or the default reporter's text. */
export function parseSuite(text: string): Suite | null {
  const files = new Map<string, 'passed' | 'failed'>();
  const failed: string[] = [];
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(text) as {
        numTotalTests?: number;
        testResults?: {
          name: string;
          status: string;
          assertionResults?: { status: string; fullName?: string }[];
        }[];
      };
      for (const f of json.testResults ?? []) {
        const name = f.name.includes('/tests/') ? `tests/${f.name.split('/tests/').pop()}` : f.name;
        files.set(name, f.status === 'passed' ? 'passed' : 'failed');
        for (const t of f.assertionResults ?? [])
          if (t.status === 'failed') failed.push(`${name} > ${t.fullName ?? ''}`);
        if (f.status === 'failed' && !(f.assertionResults ?? []).some((t) => t.status === 'failed'))
          failed.push(`${name} > (file failed to load)`);
      }
      return { files, tests: json.numTotalTests ?? 0, failed };
    } catch {
      return null;
    }
  }
  let inFailed = false;
  for (const line of text.split('\n')) {
    if (/^FAILED TESTS:/.test(line)) {
      inFailed = true;
      continue;
    }
    if (inFailed) {
      if (line.trim() !== '') failed.push(line.trim());
      continue;
    }
    const m = /^\s*([✓❯×✗✘])\s+(tests\/\S+\.test\.ts)/.exec(line);
    if (m) files.set(m[2]!, m[1] === '✓' ? 'passed' : 'failed');
  }
  const total = /Tests\s+(?:\d+ failed \| )?(\d+) passed/.exec(text);
  const exit = /^exit (\d+)/m.exec(text);
  if (files.size === 0 && !total) return null;
  if (exit && exit[1] !== '0' && failed.length === 0) failed.push(`vitest exited ${exit[1]}`);
  return { files, tests: total ? Number(total[1]) : 0, failed };
}

export interface Playwright {
  passed: number;
  failed: number;
  skipped: number;
  /** The titles of the tests that passed. */
  passedTitles: string[];
  failedTitles: string[];
}

/** Reads the Playwright list reporter's output. Null if it holds no summary. */
export function parsePlaywright(text: string): Playwright | null {
  const count = (word: string) =>
    Number(new RegExp(`^\\s*(\\d+) ${word}\\b`, 'm').exec(text)?.[1] ?? 0);
  const passed = count('passed');
  const failed = count('failed') + count('interrupted');
  const skipped = count('skipped');
  if (passed + failed + skipped === 0) return null;
  const passedTitles: string[] = [];
  const failedTitles: string[] = [];
  for (const line of text.split('\n')) {
    const m = /^\s*([✓✘])\s+\d+\s+(.*?)(?:\s+\(\d[\d.]*\w+\))?$/.exec(line);
    if (m) (m[1] === '✓' ? passedTitles : failedTitles).push(m[2]!);
  }
  return { passed, failed, skipped, passedTitles, failedTitles };
}

export interface FullRun {
  outcome: string;
  seconds: number;
  errors: number;
  warnings: number;
  pageErrors: number;
  failedRequests: number;
  fights: number;
  steps: number;
  sound: boolean;
}

/** The one machine line the full run prints: `[fullrun] {json}`. Null if it never got that far. */
export function parseFullRun(text: string): FullRun | null {
  const line = text
    .split('\n')
    .reverse()
    .find((l) => l.includes('[fullrun] {'));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(line.indexOf('[fullrun] {') + '[fullrun] '.length)) as FullRun;
  } catch {
    return null;
  }
}

export interface BaselineLog {
  name: string;
  text: string;
}

export interface Inputs {
  suite: Suite | null;
  e2e: Playwright | null;
  fullrun: { run: FullRun | null; text: string } | null;
  baselines: BaselineLog[];
  /** The build's sizes: the files its page loads at the title, and everything but maps. */
  build: { titleBytes: number; totalBytes: number } | null;
  licenses: CheckResult | null;
  pins: { name: string; expected: string | number; actual: string | number }[];
  /** Files changed since the Phase 7 base among the aura files; null if git could not say. */
  auraChanged: string[] | null;
  /** Quick checks run by this tool (`--run`), by name: exit code and the last lines. */
  ran: Record<string, { code: number; tail: string }>;
}

// ── The rows ────────────────────────────────────────────────────────────────

function suiteFiles(suite: Suite, pattern: RegExp): { passed: string[]; failed: string[] } {
  const passed: string[] = [];
  const failed: string[] = [];
  for (const [name, status] of suite.files)
    if (pattern.test(name)) (status === 'passed' ? passed : failed).push(name);
  return { passed, failed };
}

/** A part about the vitest suite as a whole. */
function suitePart(suite: Suite | null, what: string): Part {
  if (!suite) return notRun(`${what}: no vitest log given (--suite)`);
  if (suite.failed.length > 0)
    return red(`${what}: ${suite.failed.length} failing: ${suite.failed.slice(0, 5).join('; ')}`);
  return green(`${what}: ${suite.files.size} files, ${suite.tests} tests, none failing`);
}

/** A part about named test files in the suite. */
function filesPart(suite: Suite | null, pattern: RegExp, what: string, atLeast = 1): Part {
  if (!suite) return notRun(`${what}: no vitest log given (--suite)`);
  const { passed, failed } = suiteFiles(suite, pattern);
  if (failed.length > 0) return red(`${what}: failing: ${failed.join(', ')}`);
  if (passed.length < atLeast)
    return red(
      `${what}: expected at least ${atLeast} test file(s) in the log, found ${passed.length}`,
    );
  return green(`${what}: ${passed.join(', ')} passed`);
}

function ranPart(inputs: Inputs, name: string, what: string): Part {
  const r = inputs.ran[name];
  if (!r) return notRun(`${what}: not run (pass --run ${name})`);
  const tail = r.tail.trim().split('\n').slice(-1)[0] ?? '';
  return r.code === 0
    ? green(`${what}: ${tail || 'exit 0'}`)
    : red(`${what}: exit ${r.code}: ${tail}`);
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

export function checkRows(inputs: Inputs): RowResult[] {
  const rows: RowResult[] = [];

  // 1. Pillar tests.
  rows.push(
    row('1', 'All pillar tests pass on the release build', [
      suitePart(inputs.suite, 'the bot halves, in the vitest suite'),
      noProof(
        'the playtest halves need people (docs/phase-7.md, Exit criteria 1); recorded "not done" with the demo\'s questions',
      ),
    ]),
  );

  // 2. Harness bands.
  const baseline: Part =
    inputs.baselines.length === 0
      ? notRun('baseline --check logs: none given (--baselines DIR)')
      : inputs.baselines.some((b) => /drifted/i.test(b.text) || !/unchanged/i.test(b.text))
        ? red(
            `baselines drifted or did not finish: ${inputs.baselines
              .filter((b) => /drifted/i.test(b.text) || !/unchanged/i.test(b.text))
              .map((b) => b.name)
              .join(', ')}`,
          )
        : green(`${inputs.baselines.length} baseline --check logs, every one "unchanged"`);
  rows.push(
    row('2', 'Harness bands met in every Movement and in the Dissonance tiers', [
      baseline,
      noProof(
        'the harness prints each band beside its numbers and gives no verdict; the misses are the known balance notes shipped as they are (docs/phase-7.md, decision 13), re-read on the release candidate',
      ),
    ]),
  );

  // 3. Perf budgets.
  const perf: Part[] = [];
  if (!inputs.build) perf.push(notRun('download size: no build to read (npm run build)'));
  else {
    const { titleBytes, totalBytes } = inputs.build;
    const over = totalBytes > DOWNLOAD_BUDGET_BYTES;
    perf.push(
      over
        ? red(`download: ${mb(totalBytes)} in all, over the ${mb(DOWNLOAD_BUDGET_BYTES)} budget`)
        : green(
            `download: ${mb(titleBytes)} to the title, ${mb(totalBytes)} in all without maps (budget ${mb(DOWNLOAD_BUDGET_BYTES)})`,
          ),
    );
  }
  perf.push(ranPart(inputs, 'sim-bench', 'sim tick budget (sim:bench --check)'));
  perf.push(
    noProof(
      "frame time on a reference laptop and its GPU: no laptop is named and SwiftShader is not one (decision 8); the bench page is for the owner's laptop",
    ),
  );
  rows.push(row('3', 'Perf budgets met on the reference laptop', perf));

  // 4. Accessibility.
  rows.push(
    row('4', 'Accessibility options complete and tested with colour-blind simulation', [
      filesPart(inputs.suite, /colorVision/i, 'colour-vision tests'),
      filesPart(inputs.suite, /(a11y|accessib|settings|input)/i, 'option and input tests', 1),
      noProof(
        'nobody has watched reduced motion, used a real gamepad or read the text at 100% on a real screen',
      ),
    ]),
  );

  // 5. Saves.
  const exportImport = inputs.e2e
    ? inputs.e2e.passedTitles.some((t) => /export|import/i.test(t))
      ? green('e2e: an export and import test passed')
      : red('e2e: the log has no passing export or import test')
    : notRun('e2e: no Playwright log given (--e2e)');
  rows.push(
    row('5', 'Save migration tested from every pre-release version; export and import work', [
      filesPart(
        inputs.suite,
        /migration|saves?(File|Matrix|Fuzz)|saveFile/i,
        'migration and save-file tests',
      ),
      exportImport,
    ]),
  );

  // 6. Console errors across a full run.
  const fr = inputs.fullrun;
  let full: Part;
  if (!fr) full = notRun('the full run: no log given (--fullrun)');
  else if (!fr.run)
    full = red('the full run: its log has no result line, so it did not reach the end');
  else {
    const r = fr.run;
    const problems = [
      r.outcome !== 'victory' && `ended in ${r.outcome}, not victory`,
      r.errors > 0 && `${r.errors} console errors`,
      r.warnings > 0 && `${r.warnings} console warnings`,
      r.pageErrors > 0 && `${r.pageErrors} page errors`,
      r.failedRequests > 0 && `${r.failedRequests} failed requests`,
      !r.sound && 'sound was not running',
    ].filter(Boolean);
    full =
      problems.length > 0
        ? red(`the full run: ${problems.join('; ')}`)
        : green(
            `the full run: ${r.fights} fights and ${r.steps} steps to a victory in ${(r.seconds / 60).toFixed(1)} min, with sound, and zero console errors, warnings, page errors and failed requests`,
          );
  }
  rows.push(row('6', 'Zero console errors (and warnings) across a full scripted run', [full]));

  // 7. Licences.
  rows.push(
    row('7', 'Asset licences recorded in assets/licenses/', [
      !inputs.licenses
        ? notRun('tools/licenses.ts: no build to check it against (npm run build)')
        : inputs.licenses.problems.length === 0
          ? green(
              `tools/licenses.ts: ${inputs.licenses.rows.length} packages shipped, each recorded; no third-party asset in the build`,
            )
          : red(`tools/licenses.ts: ${inputs.licenses.problems.join('; ')}`),
    ]),
  );

  // 8. The pins.
  const pinParts: Part[] = [];
  const badPins = inputs.pins.filter((p) => p.expected !== p.actual);
  pinParts.push(
    badPins.length > 0
      ? red(
          `versions moved: ${badPins.map((p) => `${p.name} ${p.expected} -> ${p.actual}`).join(', ')}`,
        )
      : green(`versions: ${inputs.pins.map((p) => `${p.name} ${p.actual}`).join(', ')}`),
  );
  pinParts.push(ranPart(inputs, 'goldens', 'goldens (update-golden dry run)'));
  pinParts.push(
    filesPart(
      inputs.suite,
      /(m1Unchanged|dissonancePins|sim\/determinism|SpireSnapshot|RiftSnapshot)\.test/,
      'the pin tests',
      7,
    ),
  );
  rows.push(
    row(
      '8',
      'Every pin byte-identical; SIM_VERSION, contentVersion and the save versions unmoved',
      pinParts,
    ),
  );

  // 9. Auras.
  rows.push(
    row('9', 'No aura or ornament changed in look or sound', [
      inputs.auraChanged === null
        ? notRun(`git diff of the aura files against ${PHASE7_BASE}: git could not say`)
        : inputs.auraChanged.length === 0
          ? green(
              `git diff ${PHASE7_BASE} is empty on the ${AURA_FILES.length} aura files, and the pin has only the commit that recorded it`,
            )
          : red(`changed since ${PHASE7_BASE}: ${inputs.auraChanged.join(', ')}`),
      filesPart(inputs.suite, /aura\/presentationPin/, 'the aura presentation pin'),
    ]),
  );

  // 10. The suites.
  const e2e: Part = !inputs.e2e
    ? notRun('e2e suite: no Playwright log given (--e2e)')
    : inputs.e2e.failed > 0
      ? red(
          `e2e suite: ${inputs.e2e.failed} failed: ${inputs.e2e.failedTitles.slice(0, 3).join('; ')}`,
        )
      : green(`e2e suite: ${inputs.e2e.passed} passed, ${inputs.e2e.skipped} skipped`);
  rows.push(
    row('10', 'Vitest, typecheck, lint and the e2e suite green', [
      suitePart(inputs.suite, 'vitest'),
      ranPart(inputs, 'typecheck', 'typecheck'),
      ranPart(inputs, 'lint', 'lint'),
      e2e,
    ]),
  );
  return rows;
}

// ── Gathering the evidence ──────────────────────────────────────────────────

function readIf(path: string | undefined): string | null {
  if (!path || !existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walkFiles(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** The build's size: what its page loads at the title (scripts, preloads, styles), and all files but maps. */
export function buildSizes(dist: string): { titleBytes: number; totalBytes: number } | null {
  const page = join(dist, 'index.html');
  if (!existsSync(page)) return null;
  const html = readFileSync(page, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]!);
  let titleBytes = statSync(page).size;
  for (const ref of new Set(refs)) {
    const file = join(dist, ref.replace(/^\.?\//, ''));
    if (existsSync(file)) titleBytes += statSync(file).size;
  }
  const totalBytes = walkFiles(dist)
    .filter((f) => !f.endsWith('.map'))
    .reduce((sum, f) => sum + statSync(f).size, 0);
  return { titleBytes, totalBytes };
}

function git(root: string, args: string[]): string | null {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
}

function run(root: string, command: string[]): { code: number; tail: string } {
  const r = spawnSync(command[0]!, command.slice(1), { cwd: root, encoding: 'utf8' });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n');
  return { code: r.status ?? 1, tail: out.slice(-3).join('\n') };
}

/** What `--run` can run: each is quick, or at least bounded; none is the full suite. */
const RUNNABLE: Record<string, string[]> = {
  goldens: ['npx', 'tsx', 'tools/update-golden.ts'],
  'sim-bench': ['npm', 'run', 'sim:bench', '--', '--check'],
  typecheck: ['npm', 'run', 'typecheck'],
  lint: ['npm', 'run', 'lint'],
};

export function gather(argv: readonly string[], cwd: string, repo: string): Inputs {
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = resolve(cwd, flag('--root') ?? repo);
  const dist = resolve(cwd, flag('--dist') ?? join(root, 'dist'));
  const base = flag('--base') ?? PHASE7_BASE;
  const at = (p: string | undefined) => (p ? resolve(cwd, p) : undefined);

  const suiteText = readIf(at(flag('--suite')));
  const e2eText = readIf(at(flag('--e2e')));
  const fullText = readIf(at(flag('--fullrun')));
  const baselineDir = at(flag('--baselines'));
  const baselines = baselineDir
    ? walkFiles(baselineDir)
        .filter((f) => f.endsWith('.log'))
        .map((f) => ({ name: relative(baselineDir, f), text: readFileSync(f, 'utf8') }))
        // The logs of the baseline tools only: a folder may hold other logs beside them.
        .filter((b) => /baseline/i.test(b.text))
    : [];

  const ran: Inputs['ran'] = {};
  for (const name of (flag('--run') ?? '').split(',').filter(Boolean)) {
    const args = RUNNABLE[name];
    if (!args)
      throw new Error(`--run: "${name}" is not one of ${Object.keys(RUNNABLE).join(', ')}`);
    const result = run(root, args);
    ran[name] =
      name === 'goldens' && result.code === 0 && !/up to date/.test(result.tail)
        ? { code: 1, tail: result.tail }
        : result;
  }

  const diff = git(root, ['diff', '--name-only', base, '--', ...AURA_FILES]);
  const pinCommits = git(root, ['log', '--format=%h', '--', AURA_PIN]);
  const pinMoved = pinCommits !== null && pinCommits.split('\n').filter(Boolean).length > 1;
  const licenses = existsSync(dist)
    ? checkRecord({ root, dist, record: join(root, 'assets', 'licenses') })
    : null;
  return {
    suite: suiteText ? parseSuite(suiteText) : null,
    e2e: e2eText ? parsePlaywright(e2eText) : null,
    fullrun: fullText ? { run: parseFullRun(fullText), text: fullText } : null,
    baselines,
    build: buildSizes(dist),
    licenses,
    pins: [
      { name: 'SIM_VERSION', expected: RELEASE_PINS.simVersion, actual: SIM_VERSION },
      { name: 'contentVersion', expected: RELEASE_PINS.contentVersion, actual: CONTENT_VERSION },
      { name: 'run save', expected: RELEASE_PINS.runSave, actual: RUN_SAVE_VERSION },
      { name: 'profile', expected: RELEASE_PINS.profile, actual: PROFILE_VERSION },
      { name: 'settings', expected: RELEASE_PINS.settings, actual: DEFAULT_SETTINGS.version },
      {
        name: 'fight replay',
        expected: RELEASE_PINS.fightReplay,
        actual: ReplaySchema.shape.version.value,
      },
      { name: 'run replay', expected: RELEASE_PINS.runReplay, actual: RUN_REPLAY_VERSION },
    ],
    auraChanged:
      diff === null || pinCommits === null
        ? null
        : [...diff.split('\n').filter(Boolean), ...(pinMoved ? [AURA_PIN] : [])],
    ran,
  };
}

export function render(rows: readonly RowResult[]): string {
  const lines = ['Release check (docs/plan/06 §6 and docs/phase-7.md, Exit criteria)', ''];
  for (const r of rows) {
    lines.push(`${r.id.padStart(2)}  ${r.status.toUpperCase().padEnd(17)} ${r.title}`);
    for (const p of r.parts) lines.push(`      ${p.status.padEnd(17)} ${p.text}`);
  }
  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  lines.push(
    '',
    `${count('green')} green, ${count('red')} red, ${count('not provable here')} not provable here, ${count('not run')} not run`,
  );
  return lines.join('\n');
}

export function exitCode(rows: readonly RowResult[], strict: boolean): number {
  return rows.some((r) => r.status === 'red' || (strict && r.status === 'not run')) ? 1 : 0;
}

function main(): number {
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const argv = process.argv.slice(2);
  const rows = checkRows(gather(argv, process.cwd(), repo));
  console.log(render(rows));
  return exitCode(rows, argv.includes('--strict'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main());
}
