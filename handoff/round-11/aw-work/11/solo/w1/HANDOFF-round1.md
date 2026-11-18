# Solos, step W1 (tools, the "person" follower, tuning, baselines): hand-off

*18 November 2026 · branch `p11/solo` in `/home/user/aw-work/wt-p11solo` · the numbers for the
other steps are in `/home/user/aw-work/11/solo/w1/NUMBERS.md`.*

## 1. Where it stands

**W1 is at its finish line.** The hands question and the Resonance numbers are settled, the
heroes have two pieces of judgement, the Conductor's A Tempo path is back where it was, the
content's wording follows the new rule, every baseline is written and every recorded result that
plays a fight was recorded once more at the end.

- Final commit: **`9b3d702`** on `p11/solo`. The tree is clean. Nothing pushed or merged.
- Typecheck: clean. Lint (ESLint and the formatter): clean.
- **Every test in a file W1 owns passes**: all of `tests/sim`, `tests/bots`, `tests/fill`,
  `tests/content`, `tests/meta`, `tests/harnessTools.test.ts`, and `tests/aura` whole. The 13
  baseline tests and the 3 aura tests that W0 left red are green.
- The whole unit suite on that commit: 5,430 tests, 5,387 pass, 31 fail, 10 skipped, 2 to-do
  (W1 skipped none). All 31 are in other steps' files and are named in section 7. Log:
  `/home/user/aw-work/11/solo/w1/verify/suite.log` (and `.json`).
- Two fights sit a little lower for the Skilled bot than before the rework, the Frayed Threshold
  and the Seamstress (section 3). Everything else measured is held or better.
- Not run: the browser tests, `npm run build`.

## 2. What changed, in plain words

1. **The hands question is answered: the 1 second wait stays, and the rule is not widened.** A
   stand-in for a person's hands (350 ms late, missing one Solo in six, never leaving a hero under
   30% of their life) gets 81 to 84% of boss-fight Solos Cued; the target was 70%. Hands as slow
   as 800 ms still make it. At 1 s they do not, so the wait is a hard edge. The best moment to
   move the Thread is when the Solo is full, not when its tell first shows.
2. **Resonance: every gain is half what it was, written into the numbers themselves.** A Perfect
   Ward gives 10, a Save 12.5, and so on. No fight plays differently for it (it was already
   halved by one hidden number; now the cards say what they give). The meter, the Crescendo's
   price and every "start with N Resonance" are as they were.
3. **Two pieces of hero judgement.**
   - With your Thread on him and his wall full, **Kael raises the dome at once** when a hit is
     about to land on two or more of the party. "A big hit is coming for everyone: thread Kael"
     is now something a player can do on purpose.
   - **Lyra and Vexis do not plant their feet into a hit.** A Solo that roots its hero, and is
     not about to be Cued, waits up to 2 s for a hit coming at them to land first.
   - Two more were measured and left out because they changed nothing in 780 fights: holding a
     Solo on a wave's last, nearly dead enemy, and while the target cannot be hurt.
4. **The Conductor's A Tempo gives 15 Resonance** for each Solo Cued on the downbeat (it gave 5).
   That puts both of its paths back where they were before the rework.
5. **A plain Solo still neither joins nor breaks a Conductor's chain.** Measured: only 0 to 3% of
   Duets and Trios have a plain Solo inside them, so a rule either way would change almost
   nothing, and leaving it means one rule fewer to explain.
6. **The content's lines no longer tell the player to "Cue"**, which no key does. They say what
   to do with the Thread, or describe a Cued Solo as a state. All of W3's proposed wording was
   taken.
7. **Tools.** `tools/solo-study.ts` (the study) and `tools/person.ts` (the follower) are in the
   repo. `tools/verbs.ts` can switch the Thread's Solo rule off (`--rules soloCue`). The
   Conductor's tallies say what they count now. The two verify tools give an old replay its own
   exit code (3).
8. **The aura pin's stored sim version is 23** (one line, its own commit), after the owner lifted
   the restriction. `tests/aura` passes whole.

## 3. Numbers

All from bots, on the final rules. "Before" is main, measured again today with the same fights
and seeds (the first study's figures for the Callings turned out to be wrong for the Novice, so
every "before" here was re-measured). The study's 13 fights, 20 seeds: 140 boss and mini-boss
fights and 120 skirmishes in each row.

**Boss and mini-boss fights, the Skilled bot: held.**

| Calling | Before: win / seconds / heroes downed | Now |
|---|---|---|
| None | 96% / 133 / 0.90 | 94% / 132 / 0.71 |
| Luminary | 99% / 124 / 0.75 | 98% / 118 / 0.61 |
| Martyr | 96% / 135 / 0.87 | 99% / 133 / 0.72 |
| Chronomancer | 99% / 132 / 0.66 | 99% / 128 / 0.66 |
| Conductor: Marcato, Reprise, Ensemble, Triad | 99% / 96 / 0.42 | 98% / 93 / 0.36 |
| Conductor: A Tempo, Upbeat, Spotlight, Maestro | 100% / 51 / 0.10 | 100% / 50 / 0.08 |

Skirmishes, no Calling: 100% in 42 s (was 100% in 44 s). The Conductor's chains: 2.4 Duets and
1.1 Trios a boss fight on the first path (2.8 and 1.0 before). A full song is sung 0.7 times a
boss fight without a Calling (0.44 before).

**The same fights, the Novice: she wins more everywhere, as decided.**

| Calling | Before | Now |
|---|---|---|
| None | 46% | 75% |
| Luminary | 66% | 72% |
| Martyr | 49% | 64% |
| Chronomancer | 61% | 74% |
| Conductor, first path | 71% | 82% |
| Conductor, A Tempo path | 87% | 92% |

Her bands in the harness were set again to these (`tools/harness.ts`): Movement II elite 55-90%,
mini-boss 65-95%, boss 55-85%; Movement III skirmish 45% or more, mini-boss 45-75%, boss 50-80%
(its elite band stays 30-65%); the Finale's boss 25-55%. Movement I's bands live in
`docs/phase-1.md` (W6's); her Movement I results at 40 fights a cell: skirmishes 85 to 100%,
elites 73% and 85%, the Bellwarden 90%, the Hollow Cantor 90%.

**Hands** (no Calling, boss fights):

| Who | Solos Cued | Win / seconds / downed |
|---|---|---|
| The Skilled bot | 93% | 94% / 132 / 0.71 |
| Person, goes when the tell appears (DECISION.md's follower) | 81% | 96% / 140 / 0.89 |
| Person, goes when the Solo is full | 86% | 96% / 129 / 0.71 |
| A player who never follows a Solo | 35% | 91% / 141 / 1.25 |

By hero, the two persons: Lyra 86% and 90%, Vexis 83% and 86%, Kael 73% and 80%. With the
Conductor the second person makes 2.2 Duets and 0.8 Trios a boss fight.

**Whole runs** (as the baselines play them):

| | Before | Now |
|---|---|---|
| Two Movements, 150 runs: Skilled / Novice wins | 73% / 13% | 71% / 22% |
| The Finale route, 80 runs: Skilled / Novice wins | 65% / 1% | 61% / 5% |

**Two fights where the Skilled bot lost ground** (150 fights each, both with enemies that cut the
Thread):

| Fight | Before | Now | Its band |
|---|---|---|---|
| The Frayed Threshold (Movement III, first skirmish) | 93% | 85 to 88% | 85% or more |
| The Seamstress (Movement III, mini-boss) | 94% | 89% | 90% or more |

The first is explained and has a fix for the owner to weigh (section 4). The second is not
explained: Lyra's root is not it (tried), nor is how long Kael holds his wall (tried at 6 and
10 s); following Solos helps there (86% without it). It is one point under its band.
The Silent Conductor's fight is a little quicker than its band (167 s; the band is 170 to 230 s;
it was 175 s).

**Hero judgement**, each piece alone, boss fights: none of it 96% / 133 s / 0.74 downed for the
Skilled bot and 65% for the Novice; with both kept pieces 94% / 132 s / 0.71 and 75%; the
person 97% with 0.64 downed (95%, 0.75).

Data: `/home/user/aw-work/11/solo/w1/data/` (`final.jsonl` the final study, `main-ref.txt` the
"before", `hands.jsonl`, `gain.jsonl`, `judge.jsonl`, `condB.jsonl`, `chain.jsonl`, `bands.txt`,
`runs.txt`). Read a study file with
`npx tsx tools/solo-study.ts --report <file> --by kind`.

## 4. For the owner to decide

1. **Whole numbers or exact halves on the cards.** The halved gains include 12.5, 7.5, 2.5 and
   1.25. They are exact, which is why no fight moved. The game already shows "2.5" in places. If
   whole numbers are wanted, the list of candidates is in `NUMBERS.md` section 2; rounding any of
   them is a small balance change and wants a re-measure.
2. **The Reliquary's two rolled affixes, Ringing and Attentive, were not halved.** Their rolled
   values sit in players' saves, so halving them is a save migration (W2's kind of work). Left as
   they are, they are worth twice as much against the halved base: a top Ringing is +25% on a
   Perfect Ward where it was +12.5%. Keep the small gift, or halve them with a migration?
3. **The Frayed Threshold (Movement III's first skirmish) is the one fight that got harder.** 150
   fights each: the Skilled bot wins 85 to 88% where it won 93%; the Novice 51 to 55% where she
   won 63%. The Skilled result is still inside its band (85% or more). The cause is found: this
   fight's Shears cut the Thread, the bot keeps the Thread off Lyra to dodge the cut, so her Gale
   Barrage fires plain, and plain it roots her to the spot, where she is killed. Five kinds of
   hero judgement were tried there and none helped without hurting elsewhere. One change does
   fix it: if a plain Gale Barrage no longer rooted Lyra, the fight goes back to 93% and 57%, and
   nothing else moves. But "Lyra roots herself; Cued, she can move" is how her Solo is described,
   so it is the owner's call. It was left as designed.
4. **Whether to tell players about Kael's dome on demand** (thread him as a big hit comes in).
   It is in the rules now; W3 has the note for the coach or the primer.

## 5. What each other step needs to know

**W2 (input, saves, replays, Auto-Thread)**

- Done as asked: an old replay exits 3 from `tools/replay-verify.ts` (caught by its name,
  `OldReplayError`, so it works once your branch is joined) and from `tools/run-verify.ts` (a
  result with `refused`).
- `SOLOS.lead` (0.5 s) and `SOLOS.danger` (0.3) are in `src/sim/constants.ts` now, and the
  Skilled bot reads them. Auto-Thread's own copies can read the same two at the join. Neither
  number moved in tuning, and `threadCues` was not widened.
- `soloDueIn` now says nothing is coming (null) for a hero whose Solo is full with no one to
  fight (Oro aside, whose wait runs while a Sapling fights). That was your item 5.
- **Not done: `tests/meta/roster5e.test.ts` lines 629 and 635.** They pin the recap line you
  reworded in `src/meta/run.ts`, which is your file and still has the old words on this branch,
  so the test passes here and will fail at the join. Whoever joins the branches puts your two
  sentences in those two lines.
- The Reliquary's two rolled affixes (above, section 4, point 2) are a possible migration.

**W3 (HUD, hints, text, the mark)**

- `NUMBERS.md` has everything: the wait and tell (section 1), every Resonance number (2), the
  two judgement rules that the frames and the coach should know (4), A Tempo at 15 (5).
- All of `CONTENT-WORDING.md` was taken, as written.
- A test of yours that states an old number from the content will fail at the join, not before.

**W4 (sound)**

- `cueChained` now carries `paid` (true when A Tempo paid for that Cue): the sound's own copy of
  that rule in `src/audio/conduct.ts` (`tempoPays`) can read it at the join. It is optional in
  the type so an event built by hand need not carry it; the sim always sets it.
- The `soloWaitBegan` event was not added: the wait rule was not widened, which was your
  condition for wanting it.
- A Tempo pays 15 now; nothing in the sound should depend on the amount.

**W6 (tests, browser tests, docs, the join)**

- `docs/solos.md` was not edited (it is yours). It needs: rule 6 reworded (every gain half what
  it was, in the numbers; no `gainScale`); the content table's numbers (A Tempo 15, Opening Bars
  5 / 7.5 / 12.5, Tempo Rubato "half a segment"); a section "For hands" from `NUMBERS.md` section
  1; the two judgement rules (section 4); the numbers tables from this file; the tools
  (`tools/solo-study.ts`, `tools/person.ts`); the new wording of the lines W3 proposed.
- `tools/release-check.ts` is yours: the content's version is now `c-0a37a658f5775748` (it is
  the `contentVersion` in `tests/sim/golden.json`).
- `tests/releaseTools.test.ts`'s pin-history test may be red on this branch because the aura pin
  has a commit that the approval list does not name; that guard is being retired elsewhere.
- Fight-derived sound and picture snapshots were not re-recorded (section 6): they follow these
  goldens and are done after the join.
- The bands printed by the harness for the Novice were re-set (section 3); `docs/phase-1.md`,
  `phase-5a.md`, `phase-5c.md` and `phase-5d.md` state the old ones.

## 6. Recorded results re-recorded, and why

Each was recorded once, at the end, because it is a record of how a fight plays or of what a
bot presses, and both changed with the tuning (the judgement, A Tempo, the bot's Thread rule
reading `SOLOS.lead` and the corrected `soloDueIn`) and with the content's version (the halved
numbers, the reworded lines).

| What | File | Command |
|---|---|---|
| All 52 baselines | `tools/m1-baseline*.json` to `m4-baseline*.json`, `tools/expedition*-baseline*.json` | `/home/user/aw-work/11/solo/w1/baselines.sh` (it runs `npx tsx tools/m1-baseline.ts --movement N [--party P] --write` and `npx tsx tools/expedition-baseline.ts --movements N [--party P] --write` for each) |
| The goldens | `tests/sim/golden.json`, and its hashes in `tests/sim/m1Unchanged.test.ts` | `npx tsx tools/update-golden.ts --write`, then `npx tsx tools/sync-golden-pins.ts` |
| The Dissonance pins | `tests/sim/dissonancePins.json` | `rm tests/sim/dissonancePins.json && npx tsx tests/sim/recordDissonancePins.ts` |
| The bots' commands | `tests/bots/commandSnapshot.json`, `...M3.json`, `...Finale.json`, `...Roster.json` | `WRITE_COMMAND_SNAPSHOT=1` (and `_M3`, `_FINALE`, `_ROSTER`) with `npx vitest run` on the test of the same name |
| The fill-inert pin | `tests/bots/fillInert.json` | `WRITE_FILL_INERT=1 npx vitest run tests/bots/fillInert.test.ts`, then `npx prettier --write` on the file |
| The Prelude snapshot | `tests/meta/__snapshots__/prelude.json` | `WRITE_PRELUDE_SNAPSHOT=1 npx vitest run tests/meta/preludeSnapshot.test.ts` |
| Three key lists | `tests/sim/telegraphKeys.json`, `damageResultKeys.json`, `summonInert.json` | `WRITE_TELEGRAPH_KEYS=1`, `WRITE_DAMAGE_RESULT_KEYS=1`, `WRITE_SUMMON_INERT=1` with their tests |
| The frozen "before the fill" copies | `tests/fill/pre5g/*.json` | `AW_REFREEZE_PRE5G=1 npx vitest run tests/fill/masked.test.ts --testTimeout=900000` |
| The aura pin's stored sim version | `tests/aura/presentationPin.json`, line 2 only | by hand, its own commit (`49c8284`), after the owner lifted the restriction |

`/home/user/aw-work/11/solo/w1/rerecord.sh` runs all but the first and last rows in order.

Not moved, and checked by their tests: the save fixtures' expectations, the draft snapshot, the
roster's and the passive readers' key lists, the map fingerprints, the aura chord-cards pin, and
every case, markup entry and shader hash of the aura presentation pin.

Midway, the fold of the Resonance scale moved **no** hash: every golden, Dissonance pin and
command snapshot still matched after it, and 520 study fights were identical before and after.
Only the content's version moved.

**Not re-recorded, by the plan** (after the join, by whoever joins): the fight-derived sound
snapshots (`tests/audioSpireSnapshot.test.ts`, `audioRiftSnapshot.test.ts`, `audioPhase5.test.ts`,
`audioPhase5c.test.ts`; W4 lists eleven fights in all) and picture snapshots
(`tests/renderSpireSnapshot.test.ts`, `renderRiftSnapshot.test.ts`), and `RELEASE_PINS` in
`tools/release-check.ts` (the content version above).

## 7. Tests

**Changed or added in W1's files**

- `tests/sim/solos.test.ts`: three new tests for the judgement (Kael's dome with the Thread on
  him for a hit on the party, and not without it; a rooting Solo waiting out a hit when plain
  and firing on time when Cued; the hold ending after 2 s).
- Tests that stated a Resonance number state the halved one (`tests/fill/*`, `tests/sim/*`,
  `tests/content.test.ts`); `tests/fill/foundations.test.ts` says what the frozen resolver's
  numbers must be now, leaving the frozen file as recorded.
- `tests/harnessTools.test.ts`: the Solo rule in the Conductor's ablation list and what leaving it
  off does; the tallies' new keys (`plain`, `given`); the Novice's new bands; two tests whose
  expectations hang on one seed's fight had their seeds found again (each says so beside it), and
  one states Blood and Silk's halved trickle.
- `tests/bots/expert.test.ts`: three staged fights found their seeds again.
- No test was skipped or weakened.

**The 31 that fail in the whole suite, none in W1's files**

| Owner | Tests | Why |
|---|---|---|
| W2 (6) | `tests/inputController.test.ts` 1, `tests/inputPhase7.test.ts` 3, `tests/gamepad.test.ts` 2 | As in W0's list: the Cue key, modifier and pad button. W2's branch has done this work. |
| W3 (15) | `tests/uiConducting.test.ts` 3, `tests/uiPhase4d.test.ts` 3, `tests/uiPhase5dReview.test.ts` 1, `tests/renderDissonance.test.ts` 4, `tests/renderConducting.test.ts` 2 | As in W0's list: the Cue's price and prompt in the HUD and the pictures. |
| | `tests/uiPhase5e.test.ts` 2: "the Codex heroes page for the first four is byte-equal to W3's…" and "every pinned text and frame hashes as recorded at W3's head" | **New, and caused by W1 on purpose:** the content lines W3 asked to reword (Brann's needs line and Cued line among them) are in those pinned hashes. They are re-pinned by W3 or at the join. |
| W4 (7) | `tests/audioSpireSnapshot.test.ts` 3, `tests/audioPhase5.test.ts` 2, `tests/audioPhase5c.test.ts` 1 | Fight-derived sound snapshots: re-recorded after the join, by the plan. (The Gorehound Matriarch's joined the list: its fight changed with the tuning.) |
| | `tests/audioConducting.test.ts` 1 | As in W0's list: a test about a Cue's price. |
| The join (3) | `tests/releaseTools.test.ts`: "at HEAD, the eight aura files … are as at the base"; "the owner-approved aura changes are whole commits …" | The aura pin's one line changed (its own commit); the approval guard is being retired on another branch. |
| | `tests/releaseTools.test.ts`: "with no flags it reads no logs and runs nothing" | It also checks the release pins against the game: the content's version moved to `c-0a37a658f5775748` and `RELEASE_PINS` in `tools/release-check.ts` (W6's file) still holds the last one. |

One more will fail **at the join, not here**: `tests/meta/roster5e.test.ts` lines 629 and 635 pin
a recap line W2 reworded in its own file (section 5).

## 8. Not done, not checked

- **Nobody has played it.** The "person" follower is a model of hands, not hands.
- **The browser tests and `npm run build` were not run** (W6's).
- **Rounding the halved numbers** to whole ones: left for the owner (section 4).
- **The Frayed Threshold** is left where it is, inside its band, with the cause and the one fix
  that works written down (section 4).
- **A hero's Solo that is held by judgement** (a plain rooting Solo waiting out a hit) shows as
  due "now" in `soloDueIn` for up to 2 s; the tell does not count the hold. W3 knows.
- **`soloWaitBegan`** (W4's optional event) was not added.
- **The docs** were not touched (W6's).
- Fight-derived sound and picture snapshots: not re-recorded, by the plan.
