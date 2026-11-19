# Round 12: common rules for every agent

Aetherweaver is a support-focused action roguelite (TypeScript, React + Zustand, three.js,
WebAudio, a deterministic 60 Hz sim in `src/sim`, views in `src/render`, UI in `src/ui`, labs at
`?lab=...`). The owner is not a programmer: anything you report must be in plain language.

Read `/home/user/aw-work/9/COMMON.md` and `/home/user/aw-work/11/COMMON.md` for the house rules.
Everything there holds **except** what this file changes:

- **Main is at `8f17fe2`.** Since round 11's notes: both menu text passes, every mark over the
  larger heroes (the pour's label included), demo Version 20, and the Solo rework (heroes fire
  their own Solos; the Thread is the Cue; `docs/solos.md`) are on main.
- **The aura restriction is lifted** (`/home/user/aw-work/11/AURAS-UNLOCKED.md`). The release
  check's aura approval guard (`AURA_APPROVED`, `AURA_BASE`) is retired on main (`a762658`). The
  two aura pins (`tests/aura/presentationPin.json`, `chordCardsPin.json`) are **regression pins**:
  re-record an entry only when a change means to move it, compare entry by entry first, and name
  the entries and the reason in the commit. Never re-record to make an unexplained failure pass.
- **The commit trailer is now exactly:**

      Co-Authored-By: Claude <noreply@anthropic.com>
      Claude-Session: https://claude.ai/code/session_01Ufyqn2mkV4tgoiGTmeGECM

  No model, assistant or tool names in code, comments, docs or commits.
- Work only in your own worktree and scratch folder. Commit on your branch as you go. Do not push,
  merge to main, open a pull request, or touch another agent's worktree. The orchestrator pushes.
- The machine has **4 CPUs** shared by up to three agents. One heavy command at a time per agent.
  A vitest "timed out" is load: re-run that file alone with `--testTimeout=300000` before calling
  it a failure. Stop only your own processes, by pid; never `pkill`/`killall` by name.
  Foreground `sleep` is blocked: wait with a background until-loop or a Monitor.
- `node_modules` in each worktree is a symlink to `/home/user/aetherweaver/node_modules`. Do not
  run `npm install`/`npm ci`.
- Chromium and Playwright are installed (`require('playwright')`, do not install browsers;
  launch args `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`). Pictures a
  person will see: 1280 x 720 viewport at `deviceScaleFactor: 2`. Open every picture you take and
  retake what is empty, cropped or mid-transition. Run Python with `python3 -I`.
- Verification: `/home/user/aw-work/6/verify-land.sh <worktree> <outdir>` (typecheck, lint,
  goldens, baselines, whole unit suite; queues itself; wait for `<outdir>/done`) and
  `/home/user/aw-work/7/e2e.sh <worktree> <port> <log> [spec args]` (browser tests; builds the
  worktree; queues itself; `<log>.done` holds the exit code). Both are one-at-a-time across agents.
- The container can restart. Keep a `PROGRESS.md` in your scratch folder and commit often. If you
  are resumed after a restart, every background process you started is dead.

## What to hand back

Your final message is read by the orchestrator. Lead with what is done and whether verification is
clean. Then: the final commit; what changed, in plain language; the pictures (full paths) and what
each shows; numbers measured; every recorded result you re-recorded and why; what you chose not to
do and why; what the owner must decide. Say plainly what you did not check.
