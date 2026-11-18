# Solos, second wave: four agents at once

Read, in this order:

1. `/home/user/aw-work/9/COMMON.md` and `/home/user/aw-work/11/COMMON.md` (house rules: commits,
   the trailer, no model names anywhere, stop only your own processes by pid, where temp files go).
2. `/home/user/aw-work/11/solo/DECISION.md` (what was decided and why).
3. `docs/solos.md` in your worktree (the rule as built).
4. `/home/user/aw-work/11/solo/W0-HANDOFF.md`: **section 4 says which files are yours.** A file has
   one owner. Do not edit another step's file; write what you need from it in your hand-off note.

## State

- Base for all four: `8572e48` (W0 at `f74ad24`, with main's menu text pass merged in).
- Main is at `2a2b91b`. `docs/voice.md` is the voice for any line a player reads.
- **The aura pin's `simVersion` line is waiting on the owner.** Three tests in
  `tests/aura/presentationPin.test.ts` fail on it and will keep failing. Nobody edits anything
  under `tests/aura/`, either pin, the eight aura files, or `AURA_APPROVED`. The orchestrator tried
  to change that one line itself and was refused; do not try, by any route. If any other aura test
  fails for you, stop and report.

## Who is where

| Step | Worktree | Branch | Ports |
|---|---|---|---|
| W1 tools, tuning, baselines | `/home/user/aw-work/wt-p11solo` | `p11/solo` | 4600 to 4604 |
| W2 input, settings, saves, replays, Auto-Thread | `/home/user/aw-work/wt-p11solo-w2` | `p11/solo-w2` | 4605 to 4609 |
| W3 HUD, hints, text, the new mark | `/home/user/aw-work/wt-p11solo-w3` | `p11/solo-w3` | 4610 to 4614 |
| W4 sound | `/home/user/aw-work/wt-p11solo-w4` | `p11/solo-w4` | 4615 to 4619 |

Work files and your hand-off: `/home/user/aw-work/11/solo/w<N>/`, hand-off as `HANDOFF.md` there.
Keep a short `PROGRESS.md` beside it: the container restarts, and you will be resumed.

## Changes to the hand-off's plan

- **W1 settles the Resonance numbers early and tells W3.** As its first tuning act, decide
  `gainScale` and fold it into the numbers, then write the list of every number a text states
  (old, new) to `/home/user/aw-work/11/solo/w1/NUMBERS.md`. W3 reads that file for its wording.
  If a number moves again later, append to the file with the time.
- **W1 also answers the hands question early** (the "person" follower), because W3's frames and
  mark depend on how long the tell and the wait are. Write the answer (the wait, the tell, the
  rule in `threadCues`) to the same `NUMBERS.md` as soon as it is known.
- **Content wording** (`src/content/**`) is W1's file, but its lines must follow `docs/voice.md`.
  W3 may propose wording in `/home/user/aw-work/11/solo/w3/CONTENT-WORDING.md`; W1 puts it in
  before its last re-record.
- **Fight-derived picture and sound snapshots are not re-recorded in this wave.** They follow
  W1's final goldens and are done after the four branches are joined. List them in your hand-off.
- **W2:** `T` and the pad's right bumper do nothing after this; say so in your hand-off. Fix the
  "assisted" mark first.
- **W3's mark over a hero whose Solo is coming** will be shown to the owner: take a before-and-after
  style sheet (the tell, the wait, Thread on, Thread off, on Kael, Lyra, Vexis and one larger
  hero) into `/home/user/aw-work/11/solo/w3/shots/`. It must read at a glance with the red enemy
  outline and the other marks over heads; it must respect Reduced motion and the colour-vision
  settings.

## Finish line for each

- Typecheck and lint clean in your worktree.
- The unit tests in files you own pass, except those that need another step's work, which you
  name with the reason. Do not skip or weaken a test to get there.
- Everything committed on your branch, tree clean.
- `HANDOFF.md`: what changed in plain language, what you need from other steps, text keys now
  unused, recorded results you re-recorded and why, and what you did not check.

Six agents share 4 CPUs right now. Use `--maxWorkers=2`, run only the test files you need while
working, and expect slow runs; a timeout under load is not a failure until it repeats alone.
