/**
 * The words `contentVersionOf` leaves out (`UNHASHED_TEXT` in src/content/index.ts) never reach a
 * fight. A reworded line keeps `contentVersion`, so it must keep every replay's final hash too:
 * this plays every golden scenario with each of those words replaced, and checks that every
 * final hash stays the same. A name, which the fight copies into what it hashes, is the control:
 * replacing the attacks' names moves a hash, so the test can see a word that reaches a fight.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_VERSION, UNHASHED_TEXT, contentVersionOf } from '../../src/content';
import type { Content } from '../../src/content/schema';
import { runScenario } from '../../tools/runScenario';
import { SCENARIOS } from '../../tools/scenarios';

/** Every string at `path` under `root`, through every list, as [holder, key] pairs. */
function sites(
  root: unknown,
  path: string,
): [Record<string, unknown> | unknown[], string | number][] {
  const out: [Record<string, unknown> | unknown[], string | number][] = [];
  const walk = (node: unknown, keys: readonly string[]): void => {
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, keys));
      return;
    }
    if (node === null || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const [key, ...rest] = keys;
    if (key === undefined || !(key in record)) return;
    const value = record[key];
    if (rest.length > 0) walk(value, rest);
    else if (typeof value === 'string') out.push([record, key]);
    else if (Array.isArray(value))
      value.forEach((x, i) => {
        if (typeof x === 'string') out.push([value, i]);
      });
  };
  walk(root, path.split('.'));
  return out;
}

/** Replaces every string at `paths` in place (its `{tokens}` kept); returns the undo. */
function replaceText(root: unknown, paths: readonly string[]): () => void {
  const undo: (() => void)[] = [];
  let n = 0;
  for (const path of paths)
    for (const [holder, key] of sites(root, path)) {
      const h = holder as Record<string | number, string>;
      const was = h[key]!;
      const tokens = was.match(/\{[a-zA-Z]+\}/g) ?? [];
      h[key] = [`Placeholder ${n++}.`, ...tokens].join(' ');
      undo.push(() => {
        h[key] = was;
      });
    }
  return () => undo.forEach((u) => u());
}

const finalHashes = (): Record<string, string> =>
  Object.fromEntries(SCENARIOS.map((s) => [s.name, runScenario(s).hash]));

describe('display text out of contentVersion', () => {
  it('every path in UNHASHED_TEXT names text that is there', () => {
    for (const path of UNHASHED_TEXT) expect(sites(CONTENT, path).length, path).toBeGreaterThan(0);
    expect(new Set(UNHASHED_TEXT).size).toBe(UNHASHED_TEXT.length);
  });

  it('changing an unhashed line keeps contentVersion; changing a number or a name moves it', () => {
    const copy = (): Content => JSON.parse(JSON.stringify(CONTENT)) as Content;
    expect(contentVersionOf(copy())).toBe(CONTENT_VERSION);

    const reworded = copy();
    reworded.motifs[0]!.text = 'Another line, with its {v}.';
    reworded.heroes[0]!.codex = 'Another Codex line.';
    reworded.heroes[0]!.barks.quirk = reworded.heroes[0]!.barks.quirk.map(() => 'Another bark.');
    reworded.events[0]!.choices[0]!.outcome = 'Another outcome.';
    expect(contentVersionOf(reworded)).toBe(CONTENT_VERSION);
    const all = copy();
    replaceText(all, UNHASHED_TEXT);
    expect(contentVersionOf(all)).toBe(CONTENT_VERSION);

    const number = copy();
    const motif = number.motifs.find((m) => m.values.length > 0)!;
    motif.values[0]! += 1;
    expect(contentVersionOf(number)).not.toBe(CONTENT_VERSION);

    const name = copy();
    name.attacks[0]!.name = 'Another name';
    expect(contentVersionOf(name)).not.toBe(CONTENT_VERSION);
    const decree = copy();
    decree.attacks.find((a) => a.decree !== undefined)!.decree = 'Another decree.';
    expect(contentVersionOf(decree)).not.toBe(CONTENT_VERSION);

    // A line more in a list of lines is not only words: it is still seen.
    const longer = copy();
    longer.heroes[0]!.barks.quirk.push('One more bark.');
    expect(contentVersionOf(longer)).not.toBe(CONTENT_VERSION);
  });

  it('every golden fight ends on the same hash with every unhashed line replaced', () => {
    const before = finalHashes();
    const undo = replaceText(CONTENT, UNHASHED_TEXT);
    let after: Record<string, string>;
    try {
      expect(CONTENT.heroes[0]!.codex).toMatch(/^Placeholder \d+\.$/);
      after = finalHashes();
    } finally {
      undo();
    }
    expect(after).toEqual(before);
  }, 300_000);

  it('the control: replacing the attacks’ names, which a fight copies, moves a hash', () => {
    const scenarios = SCENARIOS.slice(0, 6);
    const before = scenarios.map((s) => runScenario(s).hash);
    const undo = replaceText(CONTENT, ['attacks.name']);
    let after: string[];
    try {
      after = scenarios.map((s) => runScenario(s).hash);
    } finally {
      undo();
    }
    expect(after).not.toEqual(before);
  }, 300_000);
});
