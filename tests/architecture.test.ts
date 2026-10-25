/**
 * Belt-and-braces check of the sim purity rule (docs/plan/05 §1–§4), independent of ESLint
 * and tsconfig.sim.json: src/sim and src/content may only import each other and zod, and
 * must not use Math.random, engine-dependent Math functions, or wall-clock/environment APIs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PURE_DIRS = ['src/sim', 'src/content'].map((d) => join(ROOT, d));
const ALLOWED_PACKAGES = new Set(['zod']);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const pureFiles = PURE_DIRS.flatMap(files);

describe('architecture: the simulation is pure', () => {
  it('finds the sim and content sources', () => {
    expect(pureFiles.length).toBeGreaterThan(10);
  });

  for (const file of pureFiles) {
    const rel = relative(ROOT, file);
    const code = stripComments(readFileSync(file, 'utf8'));

    it(`${rel} only imports sim, content and zod`, () => {
      const specifiers = [
        ...code.matchAll(
          /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g,
        ),
      ].map((m) => m[1] ?? m[2]!);
      for (const spec of specifiers) {
        if (spec.startsWith('.')) {
          const target = resolve(dirname(file), spec);
          const ok = PURE_DIRS.some((d) => target === d || target.startsWith(d + '/'));
          expect(ok, `${rel} imports ${spec}`).toBe(true);
        } else {
          expect(ALLOWED_PACKAGES.has(spec), `${rel} imports package "${spec}"`).toBe(true);
        }
      }
    });

    it(`${rel} uses no nondeterministic or environment APIs`, () => {
      expect(code, 'Math.random').not.toMatch(/Math\.random\b/);
      expect(code, 'engine-dependent Math').not.toMatch(
        /Math\.(sin|cos|tan|asin|acos|atan2?|sinh|cosh|tanh|exp|expm1|log|log1p|log2|log10|pow|cbrt|hypot)\b/,
      );
      expect(code, 'wall clock / environment').not.toMatch(
        /\b(Date|performance|setTimeout|setInterval|requestAnimationFrame|window|document|navigator)\b/,
      );
    });
  }
});
