/** Counts HUD React commits so the perf HUD can show commits/s (budget ≤ 20/s in combat). */
let hudCommits = 0;

export function countHudCommit(): void {
  hudCommits++;
}

export function takeHudCommits(): number {
  const n = hudCommits;
  hudCommits = 0;
  return n;
}
