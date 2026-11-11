/**
 * The licence record's tool (docs/phase-7.md, W8; release checklist row 7).
 *
 * `assets/licenses/` holds each shipped package's licence text, copied from `node_modules`, and a
 * README table (package, version, licence, what of it ships). This tool rebuilds that list from
 * the build and fails if a shipped module has no record:
 *
 *   - code: the source maps of the build list every `node_modules` module bundled into a chunk
 *     (the main bundle and the workers);
 *   - fonts: the build's font files are named `<family>-<subset>-<weight>-normal-<hash>.<ext>`,
 *     which names the `@fontsource` package they came from;
 *   - dependencies: the runtime `dependencies` of `package.json` and theirs, in case a chunk has
 *     no map (the demo build ships without any);
 *   - assets: any file in the build that is not code, style, a map, a page or a font is a
 *     third-party asset nobody recorded, and fails.
 *
 * Usage (`npm run licenses -- [--dist <dir>] [--write]`):
 *   no flag      check the record against the build in `dist/`; exit 1 on any problem
 *   --write      rebuild the record (README table and licence copies) from the build, then check
 *   --dist DIR   the build to read (default `dist`)
 *   --root DIR   the project root (default: this repository)
 *   --record DIR the record's folder (default `<root>/assets/licenses`)
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Licences the game may ship. Anything else needs a person to look at it first. */
export const ALLOWED_LICENSES: readonly string[] = [
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MIT',
  'OFL-1.1',
];

/** A phrase every copy of the licence carries, to tell that the text copied is the licence. */
const LICENSE_MARKERS: Record<string, RegExp> = {
  MIT: /Permission is hereby granted/i,
  ISC: /Permission to use, copy, modify/i,
  'OFL-1.1': /SIL OPEN FONT LICENSE/i,
  'Apache-2.0': /Apache License/i,
  'BSD-2-Clause': /Redistribution and use in source and binary forms/i,
  'BSD-3-Clause': /Redistribution and use in source and binary forms/i,
  '0BSD': /Permission to use, copy, modify/i,
};

/** Build tools whose generated code lands in the build, though no map lists them. */
export const BUILD_TOOLS: readonly string[] = ['tailwindcss', 'vite'];

/** What a build may hold without being a recorded asset. */
const CODE_EXTENSIONS = new Set(['.html', '.js', '.css', '.map']);
const FONT_EXTENSIONS = new Set(['.woff', '.woff2']);

export type Origin = 'source map' | 'font file' | 'dependency' | 'build tool';

export interface Shipped {
  name: string;
  origins: Set<Origin>;
}

export interface PackageInfo {
  name: string;
  version: string;
  license: string;
}

export interface Row extends PackageInfo {
  /** What of it ships, in words. */
  ships: string;
}

export interface Paths {
  root: string;
  dist: string;
  record: string;
}

export const BEGIN = '<!-- licenses:begin (written by tools/licenses.ts --write) -->';
export const END = '<!-- licenses:end -->';

/** The package a path under a `node_modules` folder belongs to ("react", "@fontsource/inter"). */
export function packageOfPath(source: string): string | null {
  const i = source.lastIndexOf('node_modules/');
  if (i < 0) return null;
  const rest = source.slice(i + 'node_modules/'.length).split('/');
  const first = rest[0];
  if (!first) return null;
  if (first.startsWith('@')) return rest[1] ? `${first}/${rest[1]}` : null;
  return first;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

function extensionOf(file: string): string {
  const i = file.lastIndexOf('.');
  return i < 0 ? '' : file.slice(i).toLowerCase();
}

/** Packages the build's source maps list (empty for a build without maps). */
export function packagesInMaps(dist: string): Set<string> {
  const found = new Set<string>();
  for (const file of walk(dist)) {
    if (!file.endsWith('.map')) continue;
    const map = JSON.parse(readFileSync(file, 'utf8')) as { sources?: string[] };
    for (const source of map.sources ?? []) {
      const name = packageOfPath(source);
      if (name) found.add(name);
    }
  }
  return found;
}

/** A font file's `@fontsource` package, from its name (null if it is not one of theirs). */
export function fontPackageOf(file: string, root: string): string | null {
  const base = file.slice(file.lastIndexOf('/') + 1);
  const m = /^(.+)-\d{3}-(?:normal|italic)-[A-Za-z0-9_-]+\.woff2?$/.exec(base);
  if (!m) return null;
  // "<family>-<subset>": both may hold hyphens ("jetbrains-mono-latin-ext"), so take the longest
  // prefix that is an installed package, leaving at least one part for the subset.
  const parts = m[1]!.split('-');
  for (let n = parts.length - 1; n > 0; n--) {
    const candidate = `@fontsource/${parts.slice(0, n).join('-')}`;
    if (existsSync(join(root, 'node_modules', candidate, 'package.json'))) return candidate;
  }
  return null;
}

/** Font files in the build and the package each came from; `unknown` lists the ones with none. */
export function fontsInBuild(
  dist: string,
  root: string,
): { packages: Set<string>; unknown: string[] } {
  const packages = new Set<string>();
  const unknown: string[] = [];
  for (const file of walk(dist)) {
    if (!FONT_EXTENSIONS.has(extensionOf(file))) continue;
    const name = fontPackageOf(file, root);
    if (name) packages.add(name);
    else unknown.push(relative(dist, file));
  }
  return { packages, unknown };
}

/** Files in the build that are neither code, style, a map, a page nor a font. */
export function strayAssets(dist: string): string[] {
  return walk(dist)
    .filter((f) => !CODE_EXTENSIONS.has(extensionOf(f)) && !FONT_EXTENSIONS.has(extensionOf(f)))
    .map((f) => relative(dist, f));
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The project's runtime dependencies and theirs, by name (those that cannot be read are listed). */
export function runtimeClosure(root: string): { names: Set<string>; unreadable: string[] } {
  const names = new Set<string>();
  const unreadable: string[] = [];
  const own = readJson(join(root, 'package.json'));
  const queue = Object.keys((own?.dependencies as Record<string, string> | undefined) ?? {});
  while (queue.length > 0) {
    const name = queue.pop()!;
    if (names.has(name)) continue;
    names.add(name);
    const pkg = readJson(join(root, 'node_modules', name, 'package.json'));
    if (!pkg) {
      unreadable.push(name);
      continue;
    }
    queue.push(...Object.keys((pkg.dependencies as Record<string, string> | undefined) ?? {}));
  }
  return { names, unreadable };
}

/** Everything the build ships from `node_modules`, with how each was found. */
export function shippedPackages(paths: Paths): {
  shipped: Map<string, Shipped>;
  problems: string[];
} {
  const problems: string[] = [];
  const shipped = new Map<string, Shipped>();
  const add = (name: string, origin: Origin) => {
    const entry = shipped.get(name) ?? { name, origins: new Set<Origin>() };
    entry.origins.add(origin);
    shipped.set(name, entry);
  };
  for (const name of packagesInMaps(paths.dist)) add(name, 'source map');
  const fonts = fontsInBuild(paths.dist, paths.root);
  for (const name of fonts.packages) add(name, 'font file');
  for (const file of fonts.unknown)
    problems.push(`${file}: a font file that no @fontsource package accounts for`);
  const closure = runtimeClosure(paths.root);
  for (const name of closure.names) add(name, 'dependency');
  for (const name of closure.unreadable)
    problems.push(`${name}: a runtime dependency with no package.json in node_modules`);
  for (const name of BUILD_TOOLS) add(name, 'build tool');
  for (const file of strayAssets(paths.dist))
    problems.push(
      `${file}: a file in the build that is not code, style or a font (a third-party asset?)`,
    );
  return { shipped, problems };
}

function licenseOf(pkg: Record<string, unknown>): string {
  if (typeof pkg.license === 'string') return pkg.license;
  const old = pkg.licenses;
  if (Array.isArray(old))
    return old
      .map((l) => (typeof l === 'object' && l ? String((l as { type?: unknown }).type) : String(l)))
      .join(' OR ');
  return '';
}

export function packageInfo(root: string, name: string): PackageInfo | null {
  const pkg = readJson(join(root, 'node_modules', name, 'package.json'));
  if (!pkg) return null;
  return { name, version: String(pkg.version ?? ''), license: licenseOf(pkg) };
}

/** The licence file a package carries (`LICENSE`, `LICENSE.md`, `LICENCE`…), or null. */
export function licenseFileOf(root: string, name: string): string | null {
  const dir = join(root, 'node_modules', name);
  if (!existsSync(dir)) return null;
  const hit = readdirSync(dir).find((f) => /^(license|licence|copying)(\.(md|txt))?$/i.test(f));
  return hit ? join(dir, hit) : null;
}

function shipsText(entry: Shipped): string {
  if (entry.origins.has('font file')) return 'font files';
  if (entry.origins.has('source map')) return 'code';
  if (entry.origins.has('dependency')) return 'code (a dependency of a shipped package)';
  return 'generated CSS and helper code, by the build';
}

/** The rows of the README table, sorted by package name. */
export function rowsFor(
  paths: Paths,
  shipped: Map<string, Shipped>,
): { rows: Row[]; problems: string[] } {
  const problems: string[] = [];
  const rows: Row[] = [];
  for (const entry of [...shipped.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const info = packageInfo(paths.root, entry.name);
    if (!info) {
      problems.push(`${entry.name}: shipped, but not installed, so its licence cannot be read`);
      continue;
    }
    rows.push({ ...info, ships: shipsText(entry) });
  }
  return { rows, problems };
}

export function renderTable(rows: readonly Row[]): string {
  const cells = rows.map((r) => [`\`${r.name}\``, r.version, r.license, r.ships]);
  const head = ['Package', 'Version', 'Licence', 'What of it ships'];
  const widths = head.map((h, i) => Math.max(h.length, ...cells.map((c) => c[i]!.length)));
  const line = (c: readonly string[]) => `| ${c.map((x, i) => x.padEnd(widths[i]!)).join(' | ')} |`;
  return [
    line(head),
    `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`,
    ...cells.map(line),
  ].join('\n');
}

/** The packages the README's table lists: name, version and licence of each row. */
export function parseTable(readme: string): PackageInfo[] {
  const start = readme.indexOf(BEGIN);
  const end = readme.indexOf(END);
  if (start < 0 || end < start) return [];
  const rows: PackageInfo[] = [];
  for (const line of readme.slice(start + BEGIN.length, end).split('\n')) {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    const name = /^`(.+)`$/.exec(cells[0] ?? '')?.[1];
    if (name && cells.length >= 4) rows.push({ name, version: cells[1]!, license: cells[2]! });
  }
  return rows;
}

const NOTES = `# Third-party licences

What the build ships from other people's work, and the licence it comes under. The licence text
of each package is in this folder, copied from \`node_modules\`.

**No third-party asset ships.** There is no image, model, sound or video file in the build.
Every model is built in code from three.js primitives, and every sound is synthesised with
WebAudio. The only files in the build that are not the game's own code and style are the font
files below. \`tools/licenses.ts\` checks this against every build.

The list is rebuilt from the build's source maps (the code), from its font files, and from the
runtime dependencies in \`package.json\` and theirs, so a package that is missing here fails the
check. Run it after \`npm run build\`:

\`\`\`bash
npm run licenses            # check the record against dist/
npm run licenses -- --write # rebuild this table and the copies below from the build
\`\`\`

`;

const AFTER = `

\`tailwindcss\` and \`vite\` are development dependencies.
Their generated CSS and small runtime helpers are emitted into the build, so their licences are
kept here too. The other development dependencies (the compiler, the linter, the test runners)
produce nothing that ships.

The fonts are self-hosted from the \`@fontsource\` packages under the SIL Open Font License 1.1.
The licence text in each folder here is the package's own; the font files themselves carry the
foundry's copyright and reserved names, which the licence lets us keep unchanged.
`;

export function renderReadme(rows: readonly Row[]): string {
  return `${NOTES}${BEGIN}\n\n${renderTable(rows)}\n\n${END}${AFTER}`;
}

/** Where a package's licence copy lives in the record (always `LICENSE`: copied as text, never reformatted). */
export function recordFile(record: string, name: string): string {
  return join(record, name, 'LICENSE');
}

/** Rebuilds the record's README and licence copies, and removes copies of packages not shipped. */
export function writeRecord(paths: Paths, rows: readonly Row[]): void {
  mkdirSync(paths.record, { recursive: true });
  const keep = new Set<string>();
  for (const row of rows) {
    const source = licenseFileOf(paths.root, row.name);
    if (!source) continue;
    const target = recordFile(paths.record, row.name);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    keep.add(resolve(target));
  }
  for (const file of walk(paths.record)) {
    if (file.endsWith('README.md') && dirname(file) === paths.record) continue;
    if (!keep.has(resolve(file))) rmSync(file);
  }
  // Empty folders left by a removed package.
  for (const entry of readdirSync(paths.record, { withFileTypes: true })) {
    const dir = join(paths.record, entry.name);
    if (entry.isDirectory() && walk(dir).length === 0) rmSync(dir, { recursive: true });
  }
  writeFileSync(join(paths.record, 'README.md'), renderReadme(rows));
}

export interface CheckResult {
  problems: string[];
  rows: Row[];
  shipped: number;
}

/** Checks the record against the build. Every problem is one line; none means the record is complete. */
export function checkRecord(paths: Paths): CheckResult {
  if (!existsSync(paths.dist) || !statSync(paths.dist).isDirectory())
    return {
      problems: [`${paths.dist}: no build here (run \`npm run build\` first, or pass --dist)`],
      rows: [],
      shipped: 0,
    };
  const found = shippedPackages(paths);
  const problems = [...found.problems];
  const { rows, problems: rowProblems } = rowsFor(paths, found.shipped);
  problems.push(...rowProblems);
  const readmePath = join(paths.record, 'README.md');
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : null;
  if (readme === null) problems.push(`${relative(paths.root, readmePath)}: missing`);
  const listed = readme === null ? [] : parseTable(readme);
  if (readme !== null && listed.length === 0)
    problems.push(`${relative(paths.root, readmePath)}: no table between its markers`);
  for (const row of rows) {
    if (!ALLOWED_LICENSES.some((l) => row.license === l))
      problems.push(
        `${row.name}: licence "${row.license || '(none declared)'}" is not one the game may ship without a person's look`,
      );
    const source = licenseFileOf(paths.root, row.name);
    if (!source) problems.push(`${row.name}: the package carries no licence file`);
    else {
      const copy = recordFile(paths.record, row.name);
      if (!existsSync(copy)) problems.push(`${row.name}: no licence text in the record`);
      else if (readFileSync(copy, 'utf8') !== readFileSync(source, 'utf8'))
        problems.push(`${row.name}: the record's licence text differs from the package's`);
      else {
        const marker = LICENSE_MARKERS[row.license];
        if (marker && !marker.test(readFileSync(copy, 'utf8')))
          problems.push(`${row.name}: its licence file does not read as ${row.license}`);
      }
    }
    if (readme !== null) {
      const hit = listed.find((l) => l.name === row.name);
      if (!hit) problems.push(`${row.name}: shipped, but not in the README table`);
      else if (hit.version !== row.version || hit.license !== row.license)
        problems.push(
          `${row.name}: the README table says ${hit.version} (${hit.license}); installed is ${row.version} (${row.license})`,
        );
    }
  }
  const shippedNames = new Set(rows.map((r) => r.name));
  for (const l of listed)
    if (!shippedNames.has(l.name))
      problems.push(`${l.name}: in the README table but not shipped (run with --write)`);
  for (const file of walk(paths.record)) {
    const rel = relative(paths.record, file).split('\\').join('/');
    if (rel === 'README.md') continue;
    const name = rel.split('/').slice(0, -1).join('/');
    if (!shippedNames.has(name))
      problems.push(`${rel}: a licence copy of a package that is not shipped`);
  }
  return { problems, rows, shipped: found.shipped.size };
}

export function parseArgs(argv: readonly string[], cwd: string, repo: string) {
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = resolve(cwd, flag('--root') ?? repo);
  const dist = resolve(cwd, flag('--dist') ?? join(root, 'dist'));
  const record = resolve(cwd, flag('--record') ?? join(root, 'assets', 'licenses'));
  return { paths: { root, dist, record } satisfies Paths, write: argv.includes('--write') };
}

function main(): number {
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const { paths, write } = parseArgs(process.argv.slice(2), process.cwd(), repo);
  if (write) {
    const found = existsSync(paths.dist) ? shippedPackages(paths) : null;
    if (!found) {
      console.log(`licenses: ${paths.dist}: no build here (run \`npm run build\` first)`);
      return 1;
    }
    const { rows } = rowsFor(paths, found.shipped);
    writeRecord(paths, rows);
    console.log(
      `licenses: wrote ${rows.length} records under ${relative(paths.root, paths.record)}`,
    );
  }
  const result = checkRecord(paths);
  if (result.problems.length === 0) {
    console.log(
      `licenses: ok, ${result.rows.length} packages shipped, each with its licence text and a table row, and no third-party asset in the build`,
    );
    for (const row of result.rows)
      console.log(`  ${row.name} ${row.version} ${row.license}: ${row.ships}`);
    return 0;
  }
  console.log(
    `licenses: ${result.problems.length} problem${result.problems.length === 1 ? '' : 's'}`,
  );
  for (const p of result.problems) console.log(`  ${p}`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main());
}
