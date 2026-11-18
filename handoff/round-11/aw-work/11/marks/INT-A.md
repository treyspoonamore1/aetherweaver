# p11/int-a: where the marks integration stands (18 November 2026, about 17:15 UTC)

Worktree `/home/user/aw-work/wt-p11marks`, branch `p11/int-a`, clean. Nothing is pushed and
nothing is merged to main: only what is pushed survives the hand-over, so push `p11/int-a` (and
`p11/pour-label`, `p11/marks`, `p11/marks-proposals`) if they are wanted.

## Final commit

`28bcc44` "Merge main (the second menu text pass) into the marks integration". It already holds
main `0df94e8`: the merge was made, cleanly, before the message to stop arrived. The tip before
that merge is `e6780fc`. `src/render`, `tools`, `tests/aura`, `src/sim`, `src/content`, `src/meta`
and the perf and framing specs are byte-identical between `e6780fc` and `28bcc44`
(`git diff --quiet e6780fc 28bcc44 -- src/render` says so).

## What is in it

- **Part 1** (`311a184`, `ddaa30e`, merged as `05f824f`): every mark over a hero or the Weaver that
  is not aura, ornament or Calling drawing is lifted from the drawn height. Test:
  `tests/renderMarksDrawn.test.ts`.
- **Proposals P2 to P6**: Luminary `a0bbf59`, Martyr `b54451b`, Chronomancer `57075b0`, Conductor
  `717561e`, target mark with Foresight's outline `fb21eba`. None touches a pin or one of the eight
  aura files.
- **Seren's blades and Oro's drop** (`70cb228`): a new place, 0.8 m over the drawn head and 0.6 m
  to the right, clear of the health bar and beside the Thread's mode glyph. Oro's closed leaf
  moved with his drop.
- **Docs** (`e6780fc`): `docs/phase-8.md`, "The marks on the larger heroes".

## What is NOT in it

- **P1, the pour's label, is not in.** It is on `p11/pour-label` (`d645c35` = `28bcc44` plus one
  line in `src/render/thread.ts`). It moves 80 entries of `tests/aura/presentationPin.json`: the
  `beam` record, all 8 samples of the ten beam-song cases, and nothing else (computed on the
  integration tree and compared entry by entry).
- **No pin entry was re-recorded.** When I ran the re-record, the session's permission system
  refused it as undermining oversight. I did not try another way.
- **The release check's aura guard is untouched** (`AURA_APPROVED`, `AURA_BASE`, the eight-files
  row, the approved-commits rule, `tests/releaseTools.test.ts`), for the same reason. It is still
  green on `p11/int-a`, because nothing there touches a pin or an aura file.
- The recorder with `--diff` and `--rewrite --only=<records>` is written but uncommitted:
  `/home/user/aw-work/11/marks/pending/recorder-diff-and-rewrite.patch` (scratch only; it will not
  survive unless copied). Once a person allows it: apply the patch, cherry-pick `d645c35`, run
  `npx tsx --tsconfig tsconfig.app.json tests/aura/recordPresentationPin.ts --rewrite --only=beam`,
  commit the pin on its own, then retire the guard and update the docs.
- P7 (Fermata's shell) is not taken.

## Evidence, and on which commit

- **`verify-int/` on `e6780fc`: clean.** Typecheck, lint, goldens, every baseline, full suite 261
  files, 5,433 tests passed.
- **`e2e-int.log` on `e6780fc`: 40 passed, 2 skipped, 2 failed.**
  - `smoke.spec.ts:505`, the busy fight's budgets: sim time per tick 2.54 ms against 1.5. Alone it
    failed twice more (1.98, 2.22 ms; `e2e-int-perf-1.log`, `-2.log`). The same test passed on Part
    1 in the morning at 0.34 ms, and failed for the menu stream on its own branch this afternoon.
    `src/sim` is identical to main.
  - `smoke.spec.ts:1911`, the roster of six: the 8-minute limit. Alone it failed once more
    (`e2e-int-roster-1.log`, 7.6 min); the page at the timeout shows the fight already won. On Part
    1 it passed once in three tries (7.3 min). The menu stream passed it in 5.3 min on its branch.
  - **I have not shown these two are load and not this branch.** The control I had planned (the
    same two tests on a checkout of main, back to back with mine) was not run.
- **`verify-int2/` on `28bcc44`: stopped part-way on request.** Typecheck, lint, goldens and all
  baselines passed; the full suite was running and has no result. No browser test ran on `28bcc44`.

## What is left

1. Full `verify-land.sh` on `28bcc44` and the smoke spec via `e2e.sh`.
2. Settle the two browser tests: run each alone on main and on `28bcc44` back to back.
3. Decide P1, the pin re-record and the guard (a person must allow the re-record).
4. Land.

Pictures: `shots/landed-marks.png` (the combined sheet; its last row shows P1 as waiting),
`shots/part1-*.png`, `proposals/P1..P7-*.png`. Working notes: `notes.md`.
