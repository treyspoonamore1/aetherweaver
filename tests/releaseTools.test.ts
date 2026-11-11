/**
 * Phase 7 W8: the licence tool and the release check (docs/phase-7.md, *Tests*: "the licence tool
 * against the build; `release-check` on a known-red and a known-green fixture").
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ALLOWED_LICENSES,
  checkRecord,
  fontPackageOf,
  packageOfPath,
  packagesInMaps,
  parseTable,
  renderTable,
  rowsFor,
  runtimeClosure,
  shippedPackages,
  strayAssets,
  writeRecord,
  type Paths,
} from '../tools/licenses';
import {
  checkRows,
  exitCode,
  gather,
  parseFullRun,
  parsePlaywright,
  parseSuite,
  render,
  type FullRun,
  type Inputs,
  type RowResult,
  type Suite,
} from '../tools/release-check';

const REPO = resolve(import.meta.dirname, '..');
const made: string[] = [];
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'aw-release-'));
  made.push(dir);
  return dir;
}

function put(file: string, text: string | Buffer): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

const MIT_TEXT = 'MIT License\n\nPermission is hereby granted, free of charge, to any person.\n';
const OFL_TEXT = 'Copyright 2020\n\nSIL OPEN FONT LICENSE Version 1.1\n';

interface Fake {
  name: string;
  version?: string;
  license?: string;
  text?: string | null;
  deps?: string[];
}

/** A project in a temp folder: packages in node_modules, a build with maps and fonts, no record yet. */
function fixture(
  packages: Fake[],
  options: { dependencies: string[]; maps?: string[]; fonts?: string[]; extra?: string[] },
): Paths {
  const root = temp();
  put(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      dependencies: Object.fromEntries(options.dependencies.map((d) => [d, '1.0.0'])),
    }),
  );
  for (const p of packages) {
    put(
      join(root, 'node_modules', p.name, 'package.json'),
      JSON.stringify({
        name: p.name,
        version: p.version ?? '1.0.0',
        license: p.license ?? 'MIT',
        dependencies: Object.fromEntries((p.deps ?? []).map((d) => [d, '1.0.0'])),
      }),
    );
    if (p.text !== null)
      put(
        join(root, 'node_modules', p.name, 'LICENSE'),
        p.text ?? ((p.license ?? 'MIT') === 'OFL-1.1' ? OFL_TEXT : MIT_TEXT),
      );
  }
  const dist = join(root, 'dist');
  put(join(dist, 'index.html'), '<html></html>');
  put(join(dist, 'assets', 'index-abc.js'), 'console.log(1)');
  put(
    join(dist, 'assets', 'index-abc.js.map'),
    JSON.stringify({
      sources: (options.maps ?? []).map((m) => `../../node_modules/${m}/index.js`),
    }),
  );
  for (const f of options.fonts ?? []) put(join(dist, 'assets', f), 'font');
  for (const f of options.extra ?? []) put(join(dist, 'assets', f), 'x');
  return { root, dist, record: join(root, 'assets', 'licenses') };
}

function recorded(paths: Paths): Paths {
  const { shipped } = shippedPackages(paths);
  writeRecord(paths, rowsFor(paths, shipped).rows);
  return paths;
}

const BASIC: Fake[] = [
  { name: 'foo', deps: ['bar'] },
  { name: 'bar', version: '2.3.4' },
  { name: '@fontsource/jetbrains-mono', license: 'OFL-1.1' },
  { name: '@fontsource/inter', license: 'OFL-1.1' },
];

function basic(extra: Partial<Parameters<typeof fixture>[1]> = {}): Paths {
  return fixture(BASIC, {
    dependencies: ['foo'],
    maps: ['foo'],
    fonts: ['jetbrains-mono-latin-ext-500-normal-AbC123.woff2', 'inter-latin-400-normal-xyz.woff'],
    ...extra,
  });
}

describe('tools/licenses.ts', () => {
  it('names the package a path under node_modules belongs to', () => {
    expect(packageOfPath('../../node_modules/react/index.js')).toBe('react');
    expect(packageOfPath('../../node_modules/@fontsource/inter/400.css')).toBe('@fontsource/inter');
    expect(packageOfPath('/a/node_modules/.pnpm/x/node_modules/zod/v4/core.js')).toBe('zod');
    expect(packageOfPath('../../src/main.tsx')).toBeNull();
  });

  it('finds a font file’s package, hyphens in the family and the subset both', () => {
    const { root } = basic();
    expect(fontPackageOf('assets/jetbrains-mono-latin-ext-500-normal-AbC123.woff2', root)).toBe(
      '@fontsource/jetbrains-mono',
    );
    expect(fontPackageOf('assets/inter-cyrillic-ext-700-normal-q_-9.woff', root)).toBe(
      '@fontsource/inter',
    );
    expect(fontPackageOf('assets/mystery-latin-400-normal-aa.woff2', root)).toBeNull();
    expect(fontPackageOf('assets/readme.woff2', root)).toBeNull();
  });

  it('lists what ships: maps, fonts and the runtime dependencies’ closure, with the build tools', () => {
    const paths = basic();
    expect([...packagesInMaps(paths.dist)]).toEqual(['foo']);
    expect([...runtimeClosure(paths.root).names].sort()).toEqual(['bar', 'foo']);
    const { shipped, problems } = shippedPackages(paths);
    expect(problems).toEqual([]);
    expect([...shipped.keys()].sort()).toEqual([
      '@fontsource/inter',
      '@fontsource/jetbrains-mono',
      'bar',
      'foo',
      'tailwindcss',
      'vite',
    ]);
    expect([...shipped.get('bar')!.origins]).toEqual(['dependency']);
  });

  describe('a known-green fixture', () => {
    it('passes once the record is written, and writing it again changes nothing', () => {
      // The build tools are not in this fixture's node_modules, so give them a licence too.
      const paths = fixture([...BASIC, { name: 'tailwindcss' }, { name: 'vite' }], {
        dependencies: ['foo'],
        maps: ['foo'],
        fonts: ['inter-latin-400-normal-xyz.woff'],
      });
      recorded(paths);
      const result = checkRecord(paths);
      expect(result.problems).toEqual([]);
      expect(result.rows.map((r) => r.name)).toContain('foo');
      const readme = readFileSync(join(paths.record, 'README.md'), 'utf8');
      const before = readme;
      writeRecord(paths, result.rows);
      expect(readFileSync(join(paths.record, 'README.md'), 'utf8')).toBe(before);
      expect(parseTable(readme).map((r) => r.name)).toEqual(result.rows.map((r) => r.name));
      expect(readme).toContain('No third-party asset ships.');
      expect(renderTable(result.rows)).toContain('| `foo`');
    });
  });

  describe('known-red fixtures', () => {
    const tools = [{ name: 'tailwindcss' }, { name: 'vite' }];
    const red = (extra: Fake[] = [], options: Partial<Parameters<typeof fixture>[1]> = {}) =>
      recorded(
        fixture([...BASIC, ...tools, ...extra], {
          dependencies: ['foo'],
          maps: ['foo'],
          fonts: ['inter-latin-400-normal-xyz.woff'],
          ...options,
        }),
      );

    it('fails when a shipped module has no record', () => {
      const paths = red();
      // A new module enters the build after the record was written.
      put(
        join(paths.root, 'node_modules', 'baz', 'package.json'),
        '{"name":"baz","version":"1.0.0","license":"MIT"}',
      );
      put(join(paths.root, 'node_modules', 'baz', 'LICENSE'), MIT_TEXT);
      put(
        join(paths.dist, 'assets', 'index-abc.js.map'),
        JSON.stringify({ sources: ['../../node_modules/foo/a.js', '../../node_modules/baz/b.js'] }),
      );
      const { problems } = checkRecord(paths);
      expect(problems).toContain('baz: no licence text in the record');
      expect(problems).toContain('baz: shipped, but not in the README table');
    });

    it('fails when a record’s text was altered or removed', () => {
      const paths = red();
      writeFileSync(join(paths.record, 'foo', 'LICENSE'), 'edited');
      rmSync(join(paths.record, 'bar', 'LICENSE'));
      const { problems } = checkRecord(paths);
      expect(problems).toContain("foo: the record's licence text differs from the package's");
      expect(problems).toContain('bar: no licence text in the record');
    });

    it('fails when the table’s version is stale or a row is stale', () => {
      const paths = red();
      const readme = readFileSync(join(paths.record, 'README.md'), 'utf8').replace(
        '2.3.4',
        '2.3.3',
      );
      writeFileSync(join(paths.record, 'README.md'), readme);
      put(join(paths.record, 'gone', 'LICENSE'), MIT_TEXT);
      const { problems } = checkRecord(paths);
      expect(problems.some((p) => p.startsWith('bar: the README table says 2.3.3'))).toBe(true);
      expect(problems).toContain('gone/LICENSE: a licence copy of a package that is not shipped');
    });

    it('fails on a package with no licence file, a licence the game may not ship, or text that is not the licence', () => {
      const paths = fixture(
        [
          ...BASIC,
          ...tools,
          { name: 'nolicence', text: null },
          { name: 'copyleft', license: 'GPL-3.0-only', text: 'GNU GENERAL PUBLIC LICENSE' },
          { name: 'wrongtext', text: 'all rights reserved' },
        ],
        { dependencies: ['foo', 'nolicence', 'copyleft', 'wrongtext'], maps: ['foo'] },
      );
      recorded(paths);
      const { problems } = checkRecord(paths);
      expect(problems).toContain('nolicence: the package carries no licence file');
      expect(problems.some((p) => p.startsWith('copyleft: licence "GPL-3.0-only"'))).toBe(true);
      expect(problems).toContain('wrongtext: its licence file does not read as MIT');
      expect(ALLOWED_LICENSES).toContain('OFL-1.1');
    });

    it('fails on a third-party asset in the build, and on a font no package accounts for', () => {
      const paths = red([], {
        extra: ['logo-1a2b.png', 'theme.ogg'],
        fonts: ['inter-latin-400-normal-xyz.woff', 'brand-latin-400-normal-xyz.woff2'],
      });
      expect(strayAssets(paths.dist).sort()).toEqual(['assets/logo-1a2b.png', 'assets/theme.ogg']);
      const { problems } = checkRecord(paths);
      expect(
        problems.some((p) => p.includes('logo-1a2b.png') && p.includes('third-party asset')),
      ).toBe(true);
      expect(problems.some((p) => p.includes('brand-latin-400-normal-xyz.woff2'))).toBe(true);
    });

    it('fails, saying so, when there is no build', () => {
      const paths = red();
      const { problems } = checkRecord({ ...paths, dist: join(paths.root, 'nowhere') });
      expect(problems[0]).toContain('no build here');
    });
  });

  it('passes on the real tree against the real build', () => {
    const out = temp();
    execFileSync(
      'npx',
      ['vite', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
      {
        cwd: REPO,
        stdio: 'pipe',
      },
    );
    const paths: Paths = { root: REPO, dist: out, record: join(REPO, 'assets', 'licenses') };
    const result = checkRecord(paths);
    expect(result.problems).toEqual([]);
    // What the doc lists (docs/phase-7.md, Audit, "Assets and licences"), and the build tools.
    expect(result.rows.map((r) => r.name)).toEqual([
      '@fontsource/cinzel',
      '@fontsource/inter',
      '@fontsource/jetbrains-mono',
      'react',
      'react-dom',
      'scheduler',
      'tailwindcss',
      'three',
      'vite',
      'zod',
      'zustand',
    ]);
    expect(strayAssets(out)).toEqual([]);
  }, 240_000);
});

// ── release-check ────────────────────────────────────────────────────────────

const TESTS = [
  'tests/colorVision.test.ts',
  'tests/input.test.ts',
  'tests/meta/migration.test.ts',
  'tests/sim/m1Unchanged.test.ts',
  'tests/sim/dissonancePins.test.ts',
  'tests/sim/determinism.test.ts',
  'tests/renderSpireSnapshot.test.ts',
  'tests/renderRiftSnapshot.test.ts',
  'tests/audioSpireSnapshot.test.ts',
  'tests/audioRiftSnapshot.test.ts',
  'tests/aura/presentationPin.test.ts',
];

const FULLRUN: FullRun = {
  outcome: 'victory',
  seconds: 3600,
  errors: 0,
  warnings: 0,
  pageErrors: 0,
  failedRequests: 0,
  fights: 14,
  steps: 40,
  sound: true,
};

function greenInputs(): Inputs {
  const suite: Suite = {
    files: new Map(TESTS.map((t) => [t, 'passed'] as const)),
    tests: 100,
    failed: [],
  };
  const pins = [
    ['SIM_VERSION', 22],
    ['run save', 5],
  ] as const;
  return {
    suite,
    e2e: {
      passed: 40,
      failed: 0,
      skipped: 0,
      passedTitles: ['smoke.spec.ts:1:1 › Phase 7: export and import a save'],
      failedTitles: [],
    },
    fullrun: { run: FULLRUN, text: '' },
    baselines: [
      { name: 'm1-A.log', text: 'M1 party A baseline unchanged: 270 fights byte-equal.' },
    ],
    build: { titleBytes: 1.7e6, totalBytes: 7.2e6 },
    licenses: { problems: [], rows: [], shipped: 0 },
    pins: pins.map(([name, v]) => ({ name, expected: v, actual: v })),
    auraChanged: [],
    ran: {
      goldens: { code: 0, tail: 'Goldens are up to date.' },
      'sim-bench': { code: 0, tail: '✔ within budget' },
      typecheck: { code: 0, tail: '' },
      lint: { code: 0, tail: '' },
    },
  };
}

const byId = (rows: RowResult[], id: string) => rows.find((r) => r.id === id)!;

describe('tools/release-check.ts', () => {
  it('a known-green fixture: no row is red or unrun; the rows that need a person say so', () => {
    const rows = checkRows(greenInputs());
    expect(rows.map((r) => r.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(rows.filter((r) => r.status === 'red' || r.status === 'not run')).toEqual([]);
    for (const id of ['1', '2', '3', '4']) expect(byId(rows, id).status).toBe('not provable here');
    for (const id of ['5', '6', '7', '8', '9', '10']) expect(byId(rows, id).status).toBe('green');
    expect(exitCode(rows, true)).toBe(0);
    const text = render(rows);
    for (const id of ['1', '10']) expect(text).toContain(`\n${id.padStart(2)}  `);
    expect(text).toContain('NOT PROVABLE HERE');
    expect(text).toContain('6 green, 0 red, 4 not provable here, 0 not run');
  });

  it('a known-red fixture: each failure turns its own row red, with the evidence, and exits 1', () => {
    const inputs = greenInputs();
    inputs.suite!.failed = ['tests/sim/golden.test.ts > the goldens'];
    inputs.suite!.files.set('tests/sim/golden.test.ts', 'failed');
    inputs.fullrun = { run: { ...FULLRUN, warnings: 2, errors: 1 }, text: '' };
    inputs.baselines = [{ name: 'm1-A.log', text: 'M1 baseline drifted' }];
    inputs.pins = [{ name: 'SIM_VERSION', expected: 22, actual: 23 }];
    inputs.auraChanged = ['src/render/field.ts'];
    inputs.licenses = { problems: ['baz: no licence text in the record'], rows: [], shipped: 1 };
    inputs.build = { titleBytes: 1, totalBytes: 30 * 1024 * 1024 };
    inputs.e2e = {
      passed: 3,
      failed: 1,
      skipped: 0,
      passedTitles: [],
      failedTitles: ['smoke.spec.ts:9:1 › the title'],
    };
    const rows = checkRows(inputs);
    for (const id of ['1', '2', '3', '5', '6', '7', '8', '9', '10'])
      expect(byId(rows, id).status, id).toBe('red');
    expect(byId(rows, '1').parts[0]!.text).toContain('tests/sim/golden.test.ts > the goldens');
    expect(byId(rows, '6').parts[0]!.text).toContain('1 console errors; 2 console warnings');
    expect(byId(rows, '9').parts[0]!.text).toContain('src/render/field.ts');
    expect(byId(rows, '8').parts[0]!.text).toContain('SIM_VERSION 22 -> 23');
    expect(exitCode(rows, false)).toBe(1);
  });

  it('a full run that never printed its result, or ended in defeat, or ran without sound, is red', () => {
    const inputs = greenInputs();
    inputs.fullrun = { run: null, text: 'timed out' };
    expect(byId(checkRows(inputs), '6').status).toBe('red');
    inputs.fullrun = { run: { ...FULLRUN, outcome: 'defeat' }, text: '' };
    expect(byId(checkRows(inputs), '6').parts[0]!.text).toContain('ended in defeat');
    inputs.fullrun = { run: { ...FULLRUN, fast: true }, text: '' };
    expect(byId(checkRows(inputs), '6').parts[0]!.text).toContain('navigation-only');
    inputs.fullrun = { run: { ...FULLRUN, sound: false }, text: '' };
    expect(byId(checkRows(inputs), '6').parts[0]!.text).toContain('sound was not running');
  });

  it('evidence that was not given is "not run", which only --strict fails', () => {
    const inputs: Inputs = {
      ...greenInputs(),
      suite: null,
      e2e: null,
      fullrun: null,
      baselines: [],
      ran: {},
    };
    const rows = checkRows(inputs);
    expect(byId(rows, '6').status).toBe('not run');
    expect(byId(rows, '1').status).toBe('not run');
    expect(byId(rows, '7').status).toBe('green');
    expect(exitCode(rows, false)).toBe(0);
    expect(exitCode(rows, true)).toBe(1);
  });

  it('a pin test missing from the log is red, not silently green', () => {
    const inputs = greenInputs();
    inputs.suite!.files.delete('tests/audioRiftSnapshot.test.ts');
    expect(byId(checkRows(inputs), '8').status).toBe('red');
  });

  it('reads a vitest JSON report and the suite script’s text log', () => {
    const json = JSON.stringify({
      numTotalTests: 3,
      testResults: [
        { name: '/w/tests/a.test.ts', status: 'passed', assertionResults: [{ status: 'passed' }] },
        {
          name: '/w/tests/sim/b.test.ts',
          status: 'failed',
          assertionResults: [{ status: 'failed', fullName: 'b does a thing' }],
        },
        { name: '/w/tests/c.test.ts', status: 'failed', assertionResults: [] },
      ],
    });
    const suite = parseSuite(json)!;
    expect(suite.files.get('tests/sim/b.test.ts')).toBe('failed');
    expect(suite.failed).toEqual([
      'tests/sim/b.test.ts > b does a thing',
      'tests/c.test.ts > (file failed to load)',
    ]);
    const text = [
      ' ✓ tests/a.test.ts (2 tests) 5ms',
      ' ❯ tests/b.test.ts (3 tests | 1 failed) 9ms',
      '      Tests  4 passed | 1 failed (5)',
      'exit 1',
      'FAILED TESTS:',
      'b.test.ts > it breaks',
    ].join('\n');
    const fromText = parseSuite(text)!;
    expect(fromText.files.get('tests/a.test.ts')).toBe('passed');
    expect(fromText.files.get('tests/b.test.ts')).toBe('failed');
    expect(fromText.failed).toEqual(['b.test.ts > it breaks']);
    expect(parseSuite('nothing here')).toBeNull();
  });

  it('reads the Playwright list and the full run’s result line', () => {
    const log = [
      '  ✓   1 [chromium] › smoke.spec.ts:30:1 › the title (2.1s)',
      '  ✘   2 [chromium] › smoke.spec.ts:40:1 › a save export (1.0s)',
      '  1 failed',
      '  36 passed (38.3m)',
    ].join('\n');
    const pw = parsePlaywright(log)!;
    expect([pw.passed, pw.failed]).toEqual([36, 1]);
    expect(pw.passedTitles).toEqual(['[chromium] › smoke.spec.ts:30:1 › the title']);
    expect(pw.failedTitles).toHaveLength(1);
    expect(parsePlaywright('no summary')).toBeNull();
    const line = `[fullrun] ${JSON.stringify(FULLRUN)}`;
    expect(parseFullRun(`noise\n${line}\nmore`)).toEqual(FULLRUN);
    expect(parseFullRun('[fullrun] {broken')).toBeNull();
    expect(parseFullRun('nothing')).toBeNull();
  });

  it('with no flags it reads no logs and runs nothing', () => {
    const inputs = gather([], REPO, REPO);
    expect(inputs.suite).toBeNull();
    expect(inputs.e2e).toBeNull();
    expect(inputs.fullrun).toBeNull();
    expect(inputs.baselines).toEqual([]);
    expect(inputs.ran).toEqual({});
    expect(inputs.pins.every((p) => p.expected === p.actual)).toBe(true);
  });
});
