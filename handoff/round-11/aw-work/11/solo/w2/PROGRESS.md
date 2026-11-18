# W2 progress (input, settings, saves, replays, Auto-Thread)

Worktree /home/user/aw-work/wt-p11solo-w2, branch p11/solo-w2, base 8572e48. Ports 4605-4609.
Read WAVE2.md, W0-HANDOFF.md section 4 (W2), then this.

- [x] 1. `assisted` mark: autonomy out of `assistsInUse` (first commit)
- [x] 2. Settings 4 -> 5 with migration (autonomy, cueModifier, `cue` binding, pad Cue dropped)
- [x] 3. Cue action / cueReticle out of actions, bindings, inputMap, InputController
- [x] 4. Screens: Settings, Controls, Prep, Training
- [x] 5. Auto-Thread follows a Solo about to fire
- [x] 6. Old replays refused in a plain sentence (fight 6, run 1)
- [x] 7. Run layer: two advice lines in src/meta/run.ts; freeCues name left
- [x] 8. tools/save-fixtures.ts --expect, save-fuzz
- [x] 9. Tests in my files green; typecheck, lint
- [x] 10. HANDOFF.md

Decisions so far:
- W3's files (labels.ts, KeyHints.tsx, HowToPlay.tsx, CodexScreen.tsx) still read the Cue key's
  label and the Cue modifier. I do not edit them. The real removal goes in first; a last, separate
  commit adds marked stand-ins (tag `SOLO-JOIN`) in my files so those four compile until W3's
  branch is joined. Tests must pass with and without that commit.
- Old run replay: status `claimed` (never `mismatch`) with `refused: 'oldReplay'` and the sentence.

Notes as I go:
- 06:46 commit 2 done: items 1-7 coded (settings 5 + migration, Cue out of input, screens, Auto-Thread
  follow, old replay refusal, advice lines). Stand-ins in place (SOLO-JOIN tag), not a separate commit:
  W3's labels.ts imports isModifierToken, so they are needed at the join too; W6 removes them.
- Still to do: replay tests (meta/runReplay.test.ts), save-fixtures --expect, save-fuzz, the whole
  list of my test files, lint, e2e look, HANDOFF.
- 07:20 commits so far: ab3ceea (assisted), d0dd30c (main body), 60e79e6 (b16 fixture + replay tests),
  e8dc192 (settings fuzz), aff5262 (no-target guard), 9974ef1 (weekly board guard). All 25 of my test
  files pass (mine1.log). Typecheck, eslint, prettier clean on my files.
- Browser check: /home/user/aw-work/11/solo/w2/check/browser.mjs against a built preview on 4605
  (dist in check/dist, pid in check/vite.pid: kill it and delete dist when done). Part 1 (old settings,
  Controls) passes. Part 2 (fight, Auto-Thread) was being re-run with waits in sim ticks.
- Still to do: full suite once on the final commit (full-suite.sh -> logs/suite.log), HANDOFF.md,
  clean up dist + preview server, final report.
- 12:35 after the restart (about 08:10): the whole-suite run had finished and written its log
  seconds before (logs/suite.log, 41 failing, all explained). Typecheck and lint re-run: clean.
  Aura: the same three. HANDOFF.md brought up to date. Preview server gone, dist deleted.
  All ten items done. Tree clean at 9974ef1. Nothing left in flight.
- 12:45 follow-up from the orchestrator: Auto-Thread follows a Solo when the Thread has not been
  touched for 2 s (not hands fully off), with a 60% keep guard and the danger line. Coded and
  committed; all 25 of my files pass (476 tests). Still to do: build, scripted fight with other
  keys pressed throughout (check/browser.mjs, BUSY=1), whole suite once, HANDOFF.md, hand back.
- 14:00 follow-up done: a569874, suite2.log (5,460 tests, the same 41 failing), typecheck and lint
  clean, busy fight run in the built app (check/report.txt part 3), HANDOFF.md up to date.
  Preview server stopped, dist deleted. Nothing left in flight.
