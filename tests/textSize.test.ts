/**
 * The 12 px minimum at 100% UI scale (docs/phase-7.md, W2; docs/plan/04 §8): no text in the game's
 * screens and HUD is set smaller than 0.75 rem, by class name (`text-[…px]`, `text-[…rem]`) or by a
 * literal inline size. The labs are dev pages and are not scanned. The one exception sits on an
 * aura or ornament element, which no stream changes (ground rule 4): it is listed, held for the
 * owner.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_PX = 16;
const MIN_PX = 12;

/** Small text on an aura or ornament element: listed, not changed (held for the owner). */
export const HELD: readonly { file: string; match: string; why: string }[] = [
  {
    file: 'src/ui/screens/ChordBuilder.tsx',
    match: 'pointer-events-none absolute -top-2 right-2 z-10',
    why: 'the Calling’s tag on a bonus aura or ornament slot card (11 px)',
  },
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'lab' ? [] : files(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function px(value: string, unit: string): number {
  const n = Number(value);
  return unit === 'rem' || unit === 'em' ? n * BASE_PX : n;
}

describe('text sizes: 12 px at least at 100%', () => {
  const sources = files(join(ROOT, 'src/ui')).map((path) => ({
    file: relative(ROOT, path),
    lines: readFileSync(path, 'utf8').split('\n'),
  }));

  it('scans the screens and the HUD', () => {
    expect(sources.length).toBeGreaterThan(100);
  });

  it('no class name sets text under 0.75 rem (except the held aura element)', () => {
    const found: string[] = [];
    const held: string[] = [];
    for (const { file, lines } of sources)
      lines.forEach((line, i) => {
        for (const m of line.matchAll(/\btext-\[([0-9.]+)(px|rem)\]/g)) {
          if (px(m[1]!, m[2]!) >= MIN_PX) continue;
          const where = `${file}:${i + 1} ${m[0]}`;
          if (HELD.some((h) => h.file === file && line.includes(h.match))) held.push(where);
          else found.push(where);
        }
      });
    expect(found).toEqual([]);
    expect(held).toHaveLength(HELD.length);
  });

  it('no literal inline font size under 12 px', () => {
    const found: string[] = [];
    for (const { file, lines } of sources)
      lines.forEach((line, i) => {
        for (const m of line.matchAll(/fontSize:\s*['"]?([0-9.]+)(px|rem|em)?['"]?\s*[,}]/g))
          if (px(m[1]!, m[2] ?? 'px') < MIN_PX) found.push(`${file}:${i + 1}`);
      });
    expect(found).toEqual([]);
  });
});
