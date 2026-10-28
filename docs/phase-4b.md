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

- **Earned as it happens.** After every fight, the run is judged as it stands. A fight's feats (a boss with no hero down, an S) and a run's counts ("10 Perfect Wards in one run", across its fights so far) are earned the moment they're met. The feats that need a win (Through the Prelude, Elite Company, Flawless, a Calling's, Bent Rules) come when the boss is beaten. A Deed is earned once, for good.
- **Only real runs count.** The Training Grounds earn nothing. An abandoned or lost run keeps what it earned on the way: its fight feats and its counts. A run continued from a save is judged again, so one saved before Deeds gets what its fights earned.
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
| | **Every Call** | Answer at least 5 calls in one fight, and miss none. A call a stun, a silence, a down or the fight's end cuts short isn't missed. |
| | **Clutch** | Make 3 Clutch Chimes in one run. |
| | **Pull** | Reel heroes 10 times in one run. |
| | **Maestro** | Cue 25 Solos in one run. |
| | **Every Way** | Save heroes four different ways in one run. The ways: a Ward, a Chime, a Reel, a Fermata, a cued Solo's dome, the Martyr's Bear and Vow, the Chronomancer's Rewind, and Martyr's Veil. |

## Contracts (v10)

**Content** (`CONTENT_VERSION` bump): `deeds`, each `{ id, name, points: 0 | 1, test, stat?, encounter?, grade?, calling?, values, text }`. `test` names the rule (`win`, `runCount`, `grades`, `fight`, `callAll`, `calling`, `keystone`, `elites`, `flawless`, `saveWays`). `stat`, `encounter`, `grade` and `calling` name what it reads, and `values` holds its numbers (`n`, `downs`). `text` is built from them like every other text. Validated: unique ids, known tests, every placeholder filled, exactly 10 with a point, and every encounter and Calling named exists.

**Sim** (`SIM_VERSION` 12, after the review): `Ledger.missedCalls`, the calls that ended unanswered when their moment passed. A call that a stun, a silence, a down or the fight's end cut short isn't missed. Only the ledger's shape changed: the 96-run fingerprint is identical.

**Run:**
- `EncounterStats.saveCauses: SaveCause[]`: the different ways heroes were saved in that fight.
- `EncounterStats.missedCalls`, from the ledger. The "Answered every call" highlight reads it too, out of the calls that could be answered.
- `RunState.deeds: string[]`: the Deeds the run newly earned, for its Summary.

Old saves default the lists to `[]` and `missedCalls` to every unanswered call. A save's Deeds that are no longer in the content are dropped on load.

**Meta** (`meta/deeds.ts`, pure):

- `DEED_POINTS_MAX = 10`. `deedPoints(earned)` → the points earned Deeds give.
- `deedsEarned(run, earned)` → the ids this run has newly earned: fight feats and counts from its fights so far, and the win's feats once its boss is beaten.
- `deedProgress(run, deed)` → the count a counting Deed has reached in this run (for the best so far).
- `astrolabePoints(rank, all, deedPoints = 0)`: the Rank's points plus the Deeds', from Rank 4; `all` gives every point (29).

**Profile v3:** `deeds: string[]` (earned, in order) and `deedBest: Record<string, number>`. A v2 profile migrates with none earned. Its tree is pruned to 29 points at most, not 19. A best that isn't a count is dropped on load, not the whole profile.

**Stores:**
- After each fight, and when a saved run is continued, `recordDeeds(run)` records the Deeds the run has earned and the best counts, and returns the new ones.
- The run store appends them to `run.deeds`, each once.
- The profile store keeps them in `deedNotices` (as it does `rankUps`) until the toast calls `dismissDeeds(ids)` with the ones it showed.
- Its `astrolabePoints()` counts the Deeds' points.

## Presentation

**Screens** (the UI workstream: [phase-4b/ui.md](phase-4b/ui.md), with every screen in the lab under *Deeds*):
- **Codex → Deeds**: all twenty. The ladder comes first (★, numbered easiest first), then the badges. Each card shows its condition (`deedText`) and, for a counting Deed, your best run ("best 7 of 10"). A Calling's badge says when its Calling opens. The header counts what's earned and the points from Deeds, and says when they're waiting for the Astrolabe.
- **Toasts**: one per Deed as it's earned, bottom left over any screen, one after another. They never show during a fight or over a rank-up card, and a point Deed's says "★ +1 Astrolabe point". The layer dismisses only the notices it showed.
- **Summary**: "Deeds earned this run", from `run.deeds`.
- **The Astrolabe**: "11 from Ranks · 4 from Deeds" under its points, and "from Deeds" opens the Codex's Deeds in place. The rank-up cards, the Rank panel and the Codex count the Deeds' points too.

![The Codex's Deeds, partway: seven earned, best runs, a Calling's lock](phase-4b/ui/codex-deeds-some.jpg)

**Sound** (`src/audio/ui.ts`):
- `deed`, about 1.4 s: a rising fifth plucked and doubled in glass (D5 to A5), a small handbell on the A, and the open fifth (D4 A4) sung softly beneath. Warm and short, so a Rank-up that comes with it stays on top.
- `deedStar`, about 2 s, for a point Deed: the same, then the star it lights in the star map's own voice, a brass bell on D5 with glass stars kindling above it (D6 E6 A6).

Each toast plays its own sound as it appears, about 5 s apart, and the two share one rate gate so they never stack. Lab buttons: `ui-deed`, `ui-deedStar`.

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
| Every Call | 7% | 37 | 25% | 1 | 21% | 11% |
| Clutch | 18% | 5 | 1% | 51 | 27% | 13% |
| Pull | 0% | | 23% | 1 | 0% | 0% |
| Maestro | 0% | | 22% | 7 | 43% | 0% |
| Every Way | 2% | 52 | 8% | 15 | 3% | 18% |

200 runs a bot without a Calling, 100 with one. Every Call was measured again after the review's fix (only missed calls count against it): only its Novice-with-the-Chronomancer rate moved (from 8%). Each Calling's own Deed is earned by every win with it: the Luminary and the Martyr are won 93% and 88% of the Skilled bot's runs. Bent Rules needs a tree, so it has its own line: with a full tree through Overflowing Grace (`--tree`, 18 points, 60 runs), every win earns it, 52% of the Novice's runs and 88% of the Skilled's.

**The ladder holds.**
- **Novice:** seven of the ten points come within the first 13 runs, and Encore, Flawless and Perfect Pitch stay out of reach.
- **Skilled:** nine come within 8 runs, and Perfect Pitch first falls on run 124 without a Calling (on run 9 with the Chronomancer, whose Wards are easier to time).
- **Elite Company** reads low only because the bots pick routes by seed; a player who takes both elites on purpose earns it far more often.
- **No Deed is out of reach.** Every one is earned by some bot.

## Code review

An independent review of the Deeds core (05f4454, f5d91b3) found nothing high-severity: no crash, no lost save, no change to a run's results, and the whole suite passed. Its findings, each fixed with a test unless it's the doc:

| Finding | What changed |
|---|---|
| **Totals without the Deeds' points.** The rank-up card, the Rank panel and the Codex counted only the Rank's points. Five Deeds earned before Rank 4 made the card say "It opens with 3 points" while the store gave 8, and the Codex still said "Skip the unlocks" gives 19. | They count the Deeds' points too (UI workstream). |
| **Doc and code disagreed on run counts.** The doc said they come once the last fight is won. The code earns them as they're met, in a lost run too, which is what the texts ("in one run") and the harness assumed. | The doc. |
| **Reset progress mid-run** listed the run's Deeds twice in its Summary. | The run lists each once. |
| **Every Call counted calls nobody could answer**: cut short by a stun, a silence or a down, or still open when the last enemy fell. In 150 Skilled runs there were 60 of the last kind, a median 0.6 s after they opened, and 8 fights missed the Deed only through such calls. | The ledger tells missed calls apart (`missedCalls`, SIM_VERSION 12). Every Call needs 5 answered and none missed, and the "Answered every call" highlight reads the same. |
| **Every Way's list in the doc was wrong.** No save counts as Mend's, while a cued Solo's dome, Bear, the Vow and Martyr's Veil do. | The doc lists the real ways. The Martyr's Bear and Vow stay two ways: they save heroes differently. |
| **The two Deed sounds stacked.** Each had its own gate, so a point Deed and a badge from one fight (Heard and Every Call) played on top of each other. | One rate gate for both. |
| **One bad best lost the profile.** A single non-number in `deedBest` failed the whole profile, which fell back to the backup or a new Rank 1. | A bad value is dropped, not the profile. |
| **`run.deeds` wasn't checked against the content** on load (`profile.deeds` was). | It is. |
| **A run saved by the old build after its boss never got its Deeds**: nothing judged it again. | Continuing a saved run judges it again. |
| **Wording.** The contract left out `grades` and put `stat` and the others in `values`. Clutch said "clutch Cleanses" where the game says Clutch Chimes. | Fixed. |

It also raised three questions of design, left as they are under *Known gaps*: retrying a fight by quitting, the test hook, and Deeds earned with Skip the unlocks or the assists on.

## Final checks

- `npm run typecheck` and `npm run lint`: clean.
- `npx vitest run`: 50 files, 1034 tests.
- `CI=1 npx playwright test`: 11 of 11, the new Deeds test among them.
- The 96-run fingerprint is identical to Phase 4's, after Deeds and again after `missedCalls`.

## Known gaps

- **A fight can be retried.** Quitting mid-fight and continuing restarts it from its start, with the same seed, as it has since Phase 1. So a fight feat (Unrung, Bright Finale, Unbowed, and Flawless fight by fight) can be tried again. A run's results, once in, stand.
- **The test hook works in production builds** (`?e2e`; the e2e suite runs against one). Its `winFight()` is a clean victory, so it earns the no-downs Deeds.
- **Skip the unlocks and the assists** earn Deeds and points that stay after they're turned off. A Deed is still a feat in a real run, and the assists are there for access, so neither is held against it.
- **No Deeds for the past.** A profile from before Deeds starts with none, since its old runs aren't kept. The exception is a run saved mid-way, which is judged when continued.
- **Bests only for counts.** Flawless and the boss feats show earned or not, with no "closest so far".
- **No bot aims at a Deed.** The harness rates are what a player who isn't chasing one gets. Elite Company depends most on that, since the bots' routes come from the seed.
- **A toast isn't saved.** Closing the game before it shows loses the toast, not the Deed: the Codex and the run's Summary list it.
- **Toasts take their time.** Each stays 4.6 s with no way to skip it, so a boss win that earns three takes about 15 s. They never take a click, but they cover the bottom left of the screen beneath.
- **With Skip the unlocks on**, a rank-up card and the Rank panel show the Rank's and the Deeds' points, not the 29 the store gives. The same was true in Phase 4 of the Rank's points alone.
- **The ★ is a text glyph.** None of the game's fonts has it, so it comes from the system's.
- **Four Deeds take their glyph by id** (Unrung, Encore, Perfect Pitch, Hourglass). Content has no icon field yet.
