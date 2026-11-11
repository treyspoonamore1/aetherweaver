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
 *   accepted           a known miss the owner's decision ships as it is (the row says which)
 *
 * A row takes its worst part: red, then not run, then not provable here, then accepted, then
 * green.
 *
 * Every log must carry the commit it was recorded on: a line `[evidence] commit <sha>` (with
 * ` dirty` when the tree had uncommitted changes, or moved during the run), which the scripts that
 * make the logs write (the suite script into its log and its JSON report as `evidence`; the e2e
 * script into each Playwright log, the full run's included). Evidence with no stamp, a dirty one,
 * or another commit than the checked tree's HEAD is red, and so is a checked tree with
 * uncommitted changes: evidence is only ever read for one exact commit.
 *
 * With no flag it runs only quick checks (the licence record against `dist/`, the build's sizes,
 * the version pins, the diff of the aura files and glyphs) and reads nothing else, so it never
 * runs the whole vitest suite or the whole e2e suite itself. The long runs are read from their
 * logs:
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

export type Status = 'green' | 'red' | 'not provable here' | 'not run' | 'accepted';

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

/**
 * The eight files nobody edits in Phase 7 (ground rule 4). The elements around them that draw an
 * aura or an ornament live in files others edit (the Weaver bar, the Chord builder), so they are
 * held by their pins instead (`AURA_PIN_TESTS`), and the glyphs by their paths (`AURA_GLYPHS`).
 */
export const AURA_FILES: readonly string[] = [
  'src/content/auras.ts',
  'src/content/ornaments.ts',
  'src/sim/combat/auras.ts',
  'src/sim/systems/field.ts',
  'src/sim/chords.ts',
  'src/render/field.ts',
  'src/render/songs.ts',
  'src/render/fermata.ts',
];

/** Where the game's glyphs are drawn. */
export const ICON_PATHS = 'src/ui/kit/iconPaths.ts';

/**
 * The aura and ornament glyphs of `ICON_PATHS` (ground rule 4): an aura (`note`), an ornament
 * (`diamond`), the beam song and the field song (`thread`, `scatter`), Fermata's hold (`fermata`)
 * and Pedal Point's plant (`pin`). The rest of the file may change.
 */
export const AURA_GLYPHS: readonly string[] = [
  'note',
  'diamond',
  'thread',
  'scatter',
  'fermata',
  'pin',
];

/** The aura presentation pin, which must have exactly one commit: the one that recorded it. */
export const AURA_PIN = 'tests/aura/presentationPin.json';

/**
 * The Chord builder's aura and ornament cards pin (recorded from 81a12ef, review B finding 2),
 * which must have exactly one commit too.
 */
export const CARDS_PIN = 'tests/aura/chordCardsPin.json';

/** The pin tests row 9 needs passing in the vitest log: the presentation and the cards. */
export const AURA_PIN_TESTS: readonly { pattern: RegExp; what: string }[] = [
  { pattern: /aura\/presentationPin\.test/, what: 'the aura presentation pin' },
  { pattern: /aura\/chordCardsPin\.test/, what: 'the Chord builder’s cards pin' },
];

/**
 * Each glyph's path in `iconPaths.ts`'s text, as written (null: not there). Reads the
 * `name: 'path'` entries of `PATHS`, a path on the same line or the next.
 */
export function glyphPaths(text: string, names: readonly string[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const name of names) {
    const m = new RegExp(`^\\s*${name}:\\s*('[^']*'|"[^"]*")`, 'm').exec(text);
    out[name] = m ? m[1]! : null;
  }
  return out;
}

/**
 * Row 4's Phase 7 option and input tests, by name (W1's and W2's, and fix2's reduced-motion
 * sites): a test file of an earlier phase can't stand in for them.
 */
export const PHASE7_OPTION_TESTS: readonly string[] = [
  'tests/a11yPhase7.test.ts',
  'tests/inputPhase7.test.ts',
  'tests/gamepad.test.ts',
  'tests/reducedMotionSites.test.ts',
  'tests/textSize.test.ts',
  'tests/contrast.test.ts',
];

/** The download budget (docs/plan/05 §12). */
export const DOWNLOAD_BUDGET_BYTES = 25 * 1024 * 1024;

const STATUS_ORDER: Status[] = ['red', 'not run', 'not provable here', 'accepted', 'green'];

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
const accepted = (text: string): Part => ({ status: 'accepted', text });

// ── Evidence ────────────────────────────────────────────────────────────────

/** The commit a log was recorded on, from its `[evidence]` lines (null: none). */
export interface Stamp {
  commit: string;
  /** Uncommitted changes in the tree, or the tree moved during the run. */
  dirty: boolean;
}

const STAMP = /\[evidence\] commit ([0-9a-f]{7,40})( dirty)?/g;

/** Reads a log's `[evidence]` lines: every one must name the same commit, or it reads as dirty. */
export function parseStamp(text: string): Stamp | null {
  const found = [...text.matchAll(STAMP)];
  if (found.length === 0) return null;
  const commit = found[0]![1]!;
  return { commit, dirty: found.some((m) => m[2] !== undefined || m[1] !== commit) };
}

/** The checked tree: its HEAD, and whether it has uncommitted changes (null: git could not say). */
export interface Tree {
  commit: string;
  dirty: boolean;
}

/** Why a log can't be read as evidence for the checked tree (null: it can). */
export function stampProblem(stamp: Stamp | null, tree: Tree | null): string | null {
  if (!tree) return 'git could not say which commit is checked';
  if (tree.dirty) return 'the checked tree has uncommitted changes, so no log can be bound to it';
  if (!stamp) return 'the log does not say which commit it was recorded on';
  if (stamp.dirty)
    return `the log was recorded on ${stamp.commit.slice(0, 12)} with uncommitted changes, or the tree moved during the run`;
  if (!tree.commit.startsWith(stamp.commit) && !stamp.commit.startsWith(tree.commit))
    return `the log was recorded on ${stamp.commit.slice(0, 12)}, not on the checked ${tree.commit.slice(0, 12)}`;
  return null;
}

export interface Suite {
  /** Test files by name relative to the project ("tests/sim/golden.test.ts"), with their result. */
  files: Map<string, 'passed' | 'failed'>;
  tests: number;
  /** The failed tests' names. */
  failed: string[];
  /** The commit it ran on. */
  stamp: Stamp | null;
}

/** Reads a vitest run: `full-suite.sh`'s JSON report, or the default reporter's text. */
export function parseSuite(text: string): Suite | null {
  const files = new Map<string, 'passed' | 'failed'>();
  const failed: string[] = [];
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(text) as {
        evidence?: unknown;
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
      const stamp = typeof json.evidence === 'string' ? parseStamp(json.evidence) : null;
      return { files, tests: json.numTotalTests ?? 0, failed, stamp };
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
  return { files, tests: total ? Number(total[1]) : 0, failed, stamp: parseStamp(text) };
}

export interface Playwright {
  passed: number;
  failed: number;
  skipped: number;
  /** The titles of the tests that passed. */
  passedTitles: string[];
  failedTitles: string[];
  /** The spec files with a result in the log (passed, failed or skipped), by file name. */
  specs: string[];
  /** The commit it ran on. */
  stamp: Stamp | null;
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
  const specs = new Set<string>();
  for (const line of text.split('\n')) {
    const m = /^\s*([✓✘-])\s+\d+\s+(.*?)(?:\s+\(\d[\d.]*\w+\))?$/.exec(line);
    if (!m) continue;
    if (m[1] !== '-') (m[1] === '✓' ? passedTitles : failedTitles).push(m[2]!);
    const spec = /(?:^|[\s›/])([\w.-]+\.spec\.ts):\d+:\d+/.exec(m[2]!);
    if (spec) specs.add(spec[1]!);
  }
  return {
    passed,
    failed,
    skipped,
    passedTitles,
    failedTitles,
    specs: [...specs].sort(),
    stamp: parseStamp(text),
  };
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
  /** The navigation-only mode, where fights are won through the test hook: not a full run. */
  fast?: boolean;
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
  fullrun: { run: FullRun | null; text: string; stamp: Stamp | null } | null;
  baselines: BaselineLog[];
  /** The build's sizes: the files its page loads at the title, and everything but maps. */
  build: { titleBytes: number; totalBytes: number } | null;
  licenses: CheckResult | null;
  pins: { name: string; expected: string | number; actual: string | number }[];
  /**
   * Since the Phase 7 base: the aura files changed, and the aura pins with other than the one
   * commit that recorded them; null if git could not say.
   */
  auraChanged: string[] | null;
  /** The aura and ornament glyphs whose path changed since the base; null if git could not say. */
  glyphsChanged: string[] | null;
  /** Quick checks run by this tool (`--run`), by name: exit code and the last lines. */
  ran: Record<string, { code: number; tail: string }>;
  /** The checked tree's commit, which every log must have been recorded on. */
  tree: Tree | null;
  /** The project's browser test files (`e2e/*.spec.ts`), by file name: each needs a result. */
  e2eSpecs: string[];
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
function suitePart(inputs: Inputs, what: string): Part {
  const suite = inputs.suite;
  if (!suite) return notRun(`${what}: no vitest log given (--suite)`);
  const problem = stampProblem(suite.stamp, inputs.tree);
  if (problem) return red(`${what}: ${problem}`);
  if (suite.failed.length > 0)
    return red(`${what}: ${suite.failed.length} failing: ${suite.failed.slice(0, 5).join('; ')}`);
  return green(`${what}: ${suite.files.size} files, ${suite.tests} tests, none failing`);
}

/** A part about test files in the suite whose names match `pattern`. */
function filesPart(inputs: Inputs, pattern: RegExp, what: string, atLeast = 1): Part {
  const suite = inputs.suite;
  if (!suite) return notRun(`${what}: no vitest log given (--suite)`);
  const problem = stampProblem(suite.stamp, inputs.tree);
  if (problem) return red(`${what}: ${problem}`);
  const { passed, failed } = suiteFiles(suite, pattern);
  if (failed.length > 0) return red(`${what}: failing: ${failed.join(', ')}`);
  if (passed.length < atLeast)
    return red(
      `${what}: expected at least ${atLeast} test file(s) in the log, found ${passed.length}`,
    );
  return green(`${what}: ${passed.join(', ')} passed`);
}

/** A part about test files named one by one: each must be in the log, and pass. */
function namedPart(inputs: Inputs, names: readonly string[], what: string): Part {
  const suite = inputs.suite;
  if (!suite) return notRun(`${what}: no vitest log given (--suite)`);
  const problem = stampProblem(suite.stamp, inputs.tree);
  if (problem) return red(`${what}: ${problem}`);
  const missing = names.filter((n) => !suite.files.has(n));
  const failed = names.filter((n) => suite.files.get(n) === 'failed');
  if (failed.length > 0) return red(`${what}: failing: ${failed.join(', ')}`);
  if (missing.length > 0) return red(`${what}: not in the log: ${missing.join(', ')}`);
  return green(`${what}: ${names.join(', ')} passed`);
}

/** Why the e2e log can't be read as the whole e2e suite for the checked tree (null: it can). */
function e2eProblem(inputs: Inputs): string | null {
  const e2e = inputs.e2e!;
  const problem = stampProblem(e2e.stamp, inputs.tree);
  if (problem) return problem;
  const missing = inputs.e2eSpecs.filter((f) => !e2e.specs.includes(f));
  if (missing.length > 0)
    return `not the whole suite: no result for ${missing.join(', ')} (every e2e/*.spec.ts file needs one)`;
  return null;
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
      suitePart(inputs, 'the bot halves, in the vitest suite'),
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
      accepted(
        'accepted (decision 13): the harness prints each band beside its numbers; the bands it misses are the known balance notes, shipped as they are (docs/phase-7.md, decision 13), and re-read on the release candidate',
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
      filesPart(inputs, /colorVision/i, 'colour-vision tests'),
      namedPart(inputs, PHASE7_OPTION_TESTS, 'the Phase 7 option and input tests'),
      noProof(
        'nobody has watched reduced motion, used a real gamepad or read the text at 100% on a real screen',
      ),
    ]),
  );

  // 5. Saves.
  const e2eWhole = inputs.e2e ? e2eProblem(inputs) : null;
  const exportImport = !inputs.e2e
    ? notRun('e2e: no Playwright log given (--e2e)')
    : e2eWhole
      ? red(`e2e: ${e2eWhole}`)
      : inputs.e2e.passedTitles.some((t) => /saves\.spec\.ts/.test(t) && /export/i.test(t)) &&
          inputs.e2e.passedTitles.some((t) => /saves\.spec\.ts/.test(t) && /import/i.test(t))
        ? green('e2e: the export and import tests of e2e/saves.spec.ts passed')
        : red('e2e: the log has no passing export and import test from e2e/saves.spec.ts');
  rows.push(
    row('5', 'Save migration tested from every pre-release version; export and import work', [
      filesPart(
        inputs,
        /migration|saves?(File|Matrix|Fuzz)|saveFile/i,
        'migration and save-file tests',
      ),
      exportImport,
    ]),
  );

  // 6. Console errors across a full run.
  const fr = inputs.fullrun;
  let full: Part;
  const frProblem = fr ? stampProblem(fr.stamp, inputs.tree) : null;
  if (!fr) full = notRun('the full run: no log given (--fullrun)');
  else if (frProblem) full = red(`the full run: ${frProblem}`);
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
      r.fast && 'a navigation-only run (fights were won through the test hook, not played)',
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
      inputs,
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

  // 9. Auras: ground rule 4's files and glyphs unchanged, and the pins of everything else that
  // draws an aura or an ornament (the song chips, the Chord builder's cards) passing.
  rows.push(
    row('9', 'No aura or ornament changed in look or sound', [
      inputs.auraChanged === null
        ? notRun(`git diff of the aura files against ${PHASE7_BASE}: git could not say`)
        : inputs.auraChanged.length === 0
          ? green(
              `git diff ${PHASE7_BASE} is empty on ground rule 4's ${AURA_FILES.length} aura files, and each aura pin has only the commit that recorded it`,
            )
          : red(`changed since ${PHASE7_BASE}: ${inputs.auraChanged.join(', ')}`),
      inputs.glyphsChanged === null
        ? notRun(`the aura and ornament glyphs of ${ICON_PATHS}: git could not say`)
        : inputs.glyphsChanged.length === 0
          ? green(
              `the ${AURA_GLYPHS.length} aura and ornament glyphs of ${ICON_PATHS} are as at ${PHASE7_BASE} (${AURA_GLYPHS.join(', ')})`,
            )
          : red(
              `aura and ornament glyphs changed since ${PHASE7_BASE} in ${ICON_PATHS}: ${inputs.glyphsChanged.join(', ')}`,
            ),
      ...AURA_PIN_TESTS.map((p) => filesPart(inputs, p.pattern, p.what)),
    ]),
  );

  // 10. The suites.
  const e2e: Part = !inputs.e2e
    ? notRun('e2e suite: no Playwright log given (--e2e)')
    : e2eWhole
      ? red(`e2e suite: ${e2eWhole}`)
      : inputs.e2e.failed > 0
        ? red(
            `e2e suite: ${inputs.e2e.failed} failed: ${inputs.e2e.failedTitles.slice(0, 3).join('; ')}`,
          )
        : green(`e2e suite: ${inputs.e2e.passed} passed, ${inputs.e2e.skipped} skipped`);
  rows.push(
    row('10', 'Vitest, typecheck, lint and the e2e suite green', [
      suitePart(inputs, 'vitest'),
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

  const head = git(root, ['rev-parse', 'HEAD']);
  const status = git(root, ['status', '--porcelain']);
  const tree: Tree | null =
    head === null || status === null ? null : { commit: head.trim(), dirty: status.trim() !== '' };
  const diff = git(root, ['diff', '--name-only', base, '--', ...AURA_FILES]);
  const pinCommits = [AURA_PIN, CARDS_PIN].map(
    (pin) => [pin, git(root, ['log', '--format=%h', '--', pin])] as const,
  );
  const pinsMoved = pinCommits
    .filter(([, log]) => log !== null && log.split('\n').filter(Boolean).length !== 1)
    .map(([pin, log]) =>
      log!.trim() === '' ? `${pin} (never committed)` : `${pin} (re-recorded)`,
    );
  const glyphsThen = git(root, ['show', `${base}:${ICON_PATHS}`]);
  const glyphsNow = readIf(join(root, ICON_PATHS));
  let glyphsChanged: string[] | null = null;
  if (glyphsThen !== null && glyphsNow !== null) {
    const then = glyphPaths(glyphsThen, AURA_GLYPHS);
    const now = glyphPaths(glyphsNow, AURA_GLYPHS);
    glyphsChanged = AURA_GLYPHS.filter((g) => then[g] === null || then[g] !== now[g]);
  }
  const licenses = existsSync(dist)
    ? checkRecord({ root, dist, record: join(root, 'assets', 'licenses') })
    : null;
  return {
    suite: suiteText ? parseSuite(suiteText) : null,
    e2e: e2eText ? parsePlaywright(e2eText) : null,
    fullrun: fullText
      ? { run: parseFullRun(fullText), text: fullText, stamp: parseStamp(fullText) }
      : null,
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
      diff === null || pinCommits.some(([, log]) => log === null)
        ? null
        : [...diff.split('\n').filter(Boolean), ...pinsMoved],
    glyphsChanged,
    ran,
    tree,
    e2eSpecs: existsSync(join(root, 'e2e'))
      ? readdirSync(join(root, 'e2e'))
          .filter((f) => f.endsWith('.spec.ts'))
          .sort()
      : [],
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
    `${count('green')} green, ${count('red')} red, ${count('not provable here')} not provable here, ${count('accepted')} accepted, ${count('not run')} not run`,
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
