# Phase 4b — Deeds

*2026-10-28 · plan: [docs/plan/02-game-design.md §9–§10](plan/02-game-design.md#9-meta-progression-the-loom) · follows [Phase 4](phase-4.md)*

**Deeds** are feats: things you do within a run that the game remembers. Ten of them give an Astrolabe point each, the "milestone Deeds" the plan sets beside Weaver Rank. Phase 4 already reserved those ten points, so a full tree stays under half the map (29 of 65 nodes). The user chose how Deeds work:

| Question | Choice |
|---|---|
| How many, and how many give points? | **20 Deeds, 10 give a point.** Like the original's 20; the other ten are badges. |
| How hard are the point-givers? | **A ladder**, from approachable (win a run) to true mastery (a flawless run, 25 Perfect Wards). A committed player earns them over time, and the last few are real feats. |
| What may a Deed ask? | **Feats within a run**: things you do in one run or one fight. No grind counters ("win 50 runs") and no collections across runs. |
| Where do they live? | **A Codex page and toasts.** Every Deed is listed with its condition and your best so far. A toast and a Summary line mark each one earned, and the Astrolabe counts the points from Deeds. |

## How it works

- **Earned as it happens.** A fight's feats (a boss with no hero down, an S) are checked when the fight ends; a run's feats (win, totals across its fights) when its last fight ends. A Deed is earned once, for good.
- **Only real runs count.** The Training Grounds earn nothing. An abandoned or lost run keeps any fight feats it earned on the way.
- **Points.** Each of the ten point Deeds adds an Astrolabe point, on top of the Rank's: 19 + 10 = 29 at most. They count from Rank 4, when the Astrolabe opens; points earned earlier wait for it. "Skip the unlocks" opens all 29.
- **Your best so far.** For a Deed that counts something ("10 Perfect Wards in one run"), the profile keeps your best run, so the Codex can say "best: 7 of 10".
- **Judged from what a run records.** Every condition reads the run's own results (each fight's stats, grade, kind and outcome) and its Calling, tree and songs. Nothing depends on the "without you" replay, which may not finish in time.
- **Never impossible.** The original shipped a Deed that couldn't be done. Here every Deed has a test that builds a run satisfying it, and the harness reports how often the bots earn each.

## The Deeds

★ gives an Astrolabe point. The point Deeds are listed easiest first; "Novice" and "Skilled" are the share of the bots' runs (Guardian, no Calling unless named) that earn each, filled in under *Harness*.

| | Deed | Condition |
|---|---|---|
| ★ | **Through the Prelude** | Win a run. |
| ★ | **Heard** | Answer 15 heroes' calls in one run. |
| ★ | **Unrung** | Beat the Bellwarden with no hero going down. |
| ★ | **Bright Finale** | Beat the Hollow Cantor with an S. |
| ★ | **Steady Hands** | Make 10 Perfect Wards in one run. |
| ★ | **Elite Company** | Win a run that fought two elites. |
| ★ | **Unbowed** | Beat the Hollow Cantor with no hero going down. |
| ★ | **Encore** | Earn three S grades in one run. |
| ★ | **Flawless** | Win a run in which no hero ever goes down. |
| ★ | **Perfect Pitch** | Make 25 Perfect Wards in one run. |
| | **Dawn's Herald** | Win a run as the Luminary. |
| | **The Bleeding Saint** | Win a run as the Martyr. |
| | **Hourglass** | Win a run as the Chronomancer. |
| | **Bent Rules** | Win a run with a keystone in your Astrolabe. |
| | **Lifeline** | Make 8 Saves in one run. |
| | **Every Call** | Answer every call in a fight where the heroes called at least 5 times. |
| | **Clutch** | Make 3 clutch Cleanses in one run. |
| | **Pull** | Reel heroes 10 times in one run. |
| | **Maestro** | Cue 25 Solos in one run. |
| | **Every Way** | Save heroes four different ways in one run (Ward, Mend, Chime, Reel, Fermata, a Calling's own). |

## Contracts (v10)

**Content** (`CONTENT_VERSION` bump): `deeds`, each `{ id, name, points: 0 | 1, test, values, text }`. `test` names the rule (`win`, `runCount`, `fight`, `callAll`, `calling`, `keystone`, `elites`, `flawless`, `saveWays`); `values` holds its numbers and names (`n`, `stat`, `encounter`, `grade`, `downs`, `calling`); `text` is built from `values` like every other text. Validated: unique ids, known tests, every placeholder filled, exactly 10 with a point, and every encounter and Calling named exists.

**Run:**
- `EncounterStats.saveCauses: SaveCause[]`: the different ways heroes were saved in that fight.
- `RunState.deeds: string[]`: the Deeds the run newly earned, for its Summary.

Old saves default both to `[]`.

**Meta** (`meta/deeds.ts`, pure):

- `DEED_POINTS_MAX = 10`. `deedPoints(earned)` → the points earned Deeds give.
- `deedsEarned(run, earned)` → the ids this run has newly earned: fight feats from any fight so far, run feats once its last fight is won.
- `deedProgress(run, deed)` → the count a counting Deed has reached in this run (for the best so far).
- `astrolabePoints(rank, all, deedPoints = 0)`: the Rank's points plus the Deeds', from Rank 4; `all` gives every point (29).

**Profile v3:** `deeds: string[]` (earned, in order) and `deedBest: Record<string, number>`. A v2 profile migrates with none earned. Its tree is pruned to 29 points at most, not 19.

**Stores:** after each fight, `recordDeeds(run)` records the Deeds the run has earned and the best counts, and returns the new ones (the run store appends them to `run.deeds`). It keeps them in `deedNotices` (as it does `rankUps`) until the toast calls `dismissDeeds()`. Its `astrolabePoints()` counts the Deeds' points.

## Presentation

*To be filled in by the UI and audio workstreams.*

## Harness

`npx tsx tools/deeds.ts --seeds 200`: whole Prelude runs (Guardian), each judged alone. The table shows the share of runs that earn each Deed; "first" is the run (of the seeds in order, a career of sorts) in which it was first earned.

| Deed | Novice | first | Skilled | first | Skilled, Chronomancer | Novice, Chronomancer |
|---|---|---|---|---|---|---|
| ★ Through the Prelude | 28% | 2 | 86% | 1 | 94% | 48% |
| ★ Heard | 39% | 2 | 81% | 1 | 89% | 55% |
| ★ Unrung | 14% | 5 | 82% | 1 | 87% | 20% |
| ★ Bright Finale | 10% | 12 | 75% | 1 | 90% | 26% |
| ★ Steady Hands | 4% | 12 | 89% | 1 | 97% | 4% |
| ★ Elite Company | 6% | 13 | 14% | 4 | 18% | 8% |
| ★ Unbowed | 6% | 12 | 42% | 1 | 66% | 8% |
| ★ Encore | 0% | | 57% | 1 | 78% | 1% |
| ★ Flawless | 0% | | 23% | 8 | 45% | 0% |
| ★ Perfect Pitch | 0% | | 1% | 124 | 6% | 0% |
| Lifeline | 10% | 2 | 3% | 13 | 1% | 19% |
| Every Call | 7% | 37 | 25% | 1 | 21% | 8% |
| Clutch | 18% | 5 | 1% | 51 | 27% | 13% |
| Pull | 0% | | 23% | 1 | 0% | 0% |
| Maestro | 0% | | 22% | 7 | 43% | 0% |
| Every Way | 2% | 52 | 8% | 15 | 3% | 18% |

200 runs a bot without a Calling, 100 with one. Each Calling's own Deed is earned by every win with it: the Luminary and the Martyr are won 93% and 88% of the Skilled bot's runs. Bent Rules isn't in the table (the harness plays without a tree); a test builds a run that earns it.

**The ladder holds.**
- **Novice:** seven of the ten points come within the first 13 runs, and Encore, Flawless and Perfect Pitch stay out of reach.
- **Skilled:** nine come within 8 runs, and Perfect Pitch first falls on run 124 without a Calling (on run 9 with the Chronomancer, whose Wards are easier to time).
- **Elite Company** reads low only because the bots pick routes by seed; a player who takes both elites on purpose earns it far more often.
- **No Deed is out of reach.** Every one is earned by some bot, except Bent Rules, which a test covers instead.

## Code review

*To be filled in after the review.*

## Known gaps

*To be filled in.*
