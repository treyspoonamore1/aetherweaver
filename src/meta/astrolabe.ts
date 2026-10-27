/**
 * CONTRACT v9 — the Astrolabe between runs (docs/phase-4.md): how many points a Rank gives, what
 * a tree may hold, and the moves on the star map (take a node and the path to it, give one back,
 * start over). Pure: the profile store wraps it; the run snapshots the tree at embark.
 *
 * A tree is the list of allocated node ids. The centre (the Weaver's Star) is always owned and
 * never listed.
 */
import { CONTENT } from '../content';
import { DEED_POINTS_MAX } from './deeds';
import { MAX_RANK } from './profile';

/** The Rank the Astrolabe opens at. */
export const ASTROLABE_RANK = 4;
/** The centre: owned by everyone, never in a tree's list. */
export const ASTROLABE_START = 'star';

/**
 * Points for a Rank and the Deeds' points (docs/phase-4b.md): one for every Rank above 1 and one
 * for each point Deed, once the Astrolabe is open. `all`: Skip the unlocks opens every point.
 */
export function astrolabePoints(rank: number, all = false, deeds = 0): number {
  if (all) return MAX_RANK - 1 + DEED_POINTS_MAX;
  if (rank < ASTROLABE_RANK) return 0;
  return Math.min(rank, MAX_RANK) - 1 + Math.min(Math.max(0, deeds), DEED_POINTS_MAX);
}

const NEIGHBOURS: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>(CONTENT.astrolabe.nodes.map((n) => [n.id, []]));
  for (const [a, b] of CONTENT.astrolabe.links) {
    map.get(a)?.push(b);
    map.get(b)?.push(a);
  }
  return map;
})();

/** The nodes linked to `id`. */
export function neighbours(id: string): readonly string[] {
  return NEIGHBOURS.get(id) ?? [];
}

/** Everything wrong with a tree, as sentences (empty: it's fine). */
export function astrolabeProblems(tree: readonly string[], points: number): string[] {
  const problems: string[] = [];
  const owned = new Set(tree);
  if (owned.size !== tree.length) problems.push('A node is taken twice.');
  for (const id of tree)
    if (!NEIGHBOURS.has(id) || id === ASTROLABE_START) problems.push(`"${id}" is not a node.`);
  if (tree.length > points)
    problems.push(`The tree holds ${tree.length} points; you have ${points}.`);
  const reached = connected(owned);
  for (const id of owned)
    if (NEIGHBOURS.has(id) && !reached.has(id)) problems.push(`"${id}" doesn't connect.`);
  return problems;
}

/** The owned nodes reachable from the centre through owned nodes. */
function connected(owned: ReadonlySet<string>): Set<string> {
  const reached = new Set<string>();
  const queue = [ASTROLABE_START];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const next of neighbours(at))
      if (owned.has(next) && !reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
  }
  return reached;
}

/**
 * The shortest way to `target` from what the tree holds: the nodes to take, nearest first.
 * Empty when it's already owned (or the centre); null when it isn't a node.
 */
export function pathTo(tree: readonly string[], target: string): string[] | null {
  if (!NEIGHBOURS.has(target)) return null;
  const owned = new Set([ASTROLABE_START, ...tree]);
  if (owned.has(target)) return [];
  // Breadth-first from every owned node at once; ties go to the first link listed.
  const from = new Map<string, string | null>();
  const queue: string[] = [];
  for (const id of owned) {
    from.set(id, null);
    queue.push(id);
  }
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const next of neighbours(at)) {
      if (from.has(next)) continue;
      from.set(next, at);
      if (next === target) {
        const path: string[] = [];
        for (let n: string | null = next; n !== null && !owned.has(n); n = from.get(n) ?? null)
          path.push(n);
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}

/** Takes `target` and the path to it, if the points allow; otherwise the tree as it was. */
export function allocate(tree: readonly string[], target: string, points: number): string[] {
  const path = pathTo(tree, target);
  if (!path || path.length === 0 || tree.length + path.length > points) return [...tree];
  return [...tree, ...path];
}

/** Can `id` be given back without cutting another node off from the centre? */
export function canRefund(tree: readonly string[], id: string): boolean {
  if (!tree.includes(id)) return false;
  const rest = new Set(tree.filter((n) => n !== id));
  return connected(rest).size === rest.size;
}

/** Gives `id` back, if nothing else depends on it; otherwise the tree as it was. */
export function refund(tree: readonly string[], id: string): string[] {
  return canRefund(tree, id) ? tree.filter((n) => n !== id) : [...tree];
}

/**
 * A tree that fits: known nodes that connect to the centre, at most `points` of them (the nearest
 * first, so what's kept still connects). For saves after a content change, or when "Skip the
 * unlocks" is turned off.
 */
export function pruneTree(tree: readonly string[], points: number): string[] {
  const owned = new Set(tree.filter((id) => NEIGHBOURS.has(id) && id !== ASTROLABE_START));
  const kept: string[] = [];
  const seen = new Set([ASTROLABE_START]);
  const queue = [ASTROLABE_START];
  while (queue.length > 0 && kept.length < points) {
    const at = queue.shift()!;
    for (const next of neighbours(at)) {
      if (seen.has(next) || !owned.has(next)) continue;
      seen.add(next);
      if (kept.length < points) kept.push(next);
      queue.push(next);
    }
  }
  // Keep the player's order for what survives.
  const keep = new Set(kept);
  return tree.filter((id, i) => keep.has(id) && tree.indexOf(id) === i);
}
