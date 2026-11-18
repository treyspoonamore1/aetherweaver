# Phase 8c: common rules for every stream

Aetherweaver is a support-focused action roguelite (TypeScript, React + Zustand, three.js, a
deterministic 60 Hz sim in `src/sim`, views in `src/render`, UI in `src/ui`, labs at `?lab=...`).
Main is at `19fdec5`. Phase 8b just landed: every figure in a fight is redrawn as leaded stained
glass (`docs/art-style.md`, `docs/art-roster.md`, `docs/phase-8.md` section 8b). The visual audit
that this pass works through is `/home/user/aw-work/8/audit/AUDIT.md` (read the parts your brief
names). The owner is not a programmer: anything you report must be in plain language.

## Rules

- Work only in your own worktree and your own scratch folder. Commit on your branch as you go (the
  container can restart; the disk survives). Commit messages are plain and end with exactly:

      Co-Authored-By: Claude <noreply@anthropic.com>
      Claude-Session: https://claude.ai/code/session_01MH5PPqLtisvhfXmhxM3BPg

  No model, assistant or tool names in code, comments, docs or commits. Do not push, merge, open a
  pull request, or touch `main` or another worktree.
- **Auras and ornaments are the owner's.** The song field, the beam song on the Thread, the pour,
  Fermata, Chorus Pulse, the Calling's marks, the Thread itself and their HUD chips keep their look,
  colour, size, timing, reach, sound and numbers exactly. `tests/aura/presentationPin.json` and
  `tests/aura/chordCardsPin.json` are never edited, and `npx vitest run tests/aura --maxWorkers=2`
  must pass. If your work cannot be done without changing one, stop on that part and report it.
- `src/sim`, `src/content` and `src/meta` stay identical to main unless your brief says otherwise.
  Replays, goldens and baselines must not move.
- Re-record a pinned picture, hash or snapshot only when your change legitimately moves it, and say
  why in the test.
- The machine has 4 CPUs shared with two other agents; rendering is in software (Chromium args
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`). One heavy command at a
  time. Foreground `sleep` is blocked. A vitest "timed out in 5000ms" is load: re-run that file
  with `--testTimeout=120000`. Stop only your own processes, by pid; never `pkill` or `killall`
  by name. Give each preview server its own port (your brief names a range).
- Disk is tight (about 7 GB free). Keep one build folder, delete what you no longer need, and
  never leave a vitest cache or browser profile behind.
- Chromium and Playwright are installed (`require('playwright')`; do not install browsers).
  Pictures a person will see are 1280 x 720 at `deviceScaleFactor: 2`. Open every picture you
  take and retake what is empty, cropped or mid-transition.
- Final verification, on your last commit:
  `/home/user/aw-work/6/verify-land.sh <your worktree> <your scratch>/verify` (typecheck, lint,
  goldens, baselines, the whole unit suite; it queues behind other streams' runs by itself, so
  just wait for `<outdir>/done` with a background until-loop) and, if your brief asks for browser
  tests, `/home/user/aw-work/7/e2e.sh <worktree> <port> <log> [spec files]` (also self-queuing;
  the log's tail prints a "FAILED TESTS:" header even when none failed).
- Earlier picture and measurement scripts you may reuse (copy, do not edit in place):
  `/home/user/aw-work/8/integ/scripts/` (`shoot.mjs`, `fights.mjs`, `fightlib.mjs`, `cues.mjs`,
  `states.mjs`, `measure_rim3.py`, `measure_cues.py`, `sheet.py`, `cv.py`) and the repo's
  `tools/art-shoot/shoot.mjs`. Run Python with `python3 -I`.

## What to hand back

Your final message is read by the orchestrator, then put to the owner. Lead with what is done and
whether verification is clean. Then: the final commit; what changed, in plain language; the
pictures (full paths) and what each shows; the numbers you measured; every pin you re-recorded and
why; anything you chose not to do and why; anything the owner must decide. Say plainly what you
did not check.
