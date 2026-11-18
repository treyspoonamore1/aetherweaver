# Brief: finish the Solo join, verify it, and play it with pictures

Read `/home/user/aw-work/12/COMMON.md` first.

## Where things are

- The Solo rework (design A, "your Thread is the Cue": every hero fires their own Solo one second
  after it fills; it is the stronger "Cued" form if the Weaver's Thread is on that hero as it
  fires; no Cue key; Resonance buys only the Crescendo). Design: `/home/user/aw-work/11/solo/DESIGN.md`,
  `DECISION.md`. As built: `docs/solos.md` on your branch. Review:
  `/home/user/aw-work/11/solo/review/REVIEW.md`.
- Your worktree: `/home/user/aw-work/wt-p11solo-w3`, branch `p11/solo-join`, at `861c5f2`. It
  holds all four steps joined, docs, five new browser tests, and every review item fixed except
  11a (docs numbers). Read `/home/user/aw-work/11/solo/w6/PROGRESS.md`, section "STATE AT STOP",
  and `/home/user/aw-work/11/solo/JOIN.md` Part 2. Tools from that step: `w6/scripts/`
  (`zzDump.test.ts` + `pindiff.py` for the Brann UI pin, `noinput.mts`, `follow.mts`,
  `cast-hold.mts`) and `w6/check/`.
- `p11/solo` (W1, rules, bots, tools, every recorded fight result) is at `8e7f950`, final. Since
  your branch last merged it (`8f88e14`): `bc46e3f` (the second re-record of every fight-derived
  result and seed re-picks; verified: typecheck, lint and W1's test files green), `08d69db` (the
  Novice's bands), `8e7f950` (the aura pin fixture fills the 200-deep meter; the pin file is
  unchanged). A dry run merges it cleanly.
- Main is at `6c345ad`: both menu passes, the marks, the pour's label with its aura pin re-record,
  the retired aura guard, demo Version 20 notes. A dry run of merging it into your branch conflicts
  in `docs/voice.md`, `src/render/relics.ts`, `src/ui/text/en/hud/hints.ts`,
  `tests/uiPhase5e.brann.json`, `tests/uiPhase5e.test.ts`; `tests/aura/presentationPin.json`,
  `tools/release-check.ts` and `tests/releaseTools.test.ts` merge by themselves.
- Another agent is re-running W1's study for the docs' numbers in `/home/user/aw-work/wt-p11solo`
  (CPU-heavy, niced). It will produce `/home/user/aw-work/12/w1/DOC-TABLES.md`; the orchestrator
  will tell you when it exists. Do not touch that worktree.

## Decided by the orchestrator (do not reopen)

- **A hero finishes a cast before their Solo.** That makes Vexis's Solo fire after its one-second
  wait in about 4 of 10 Solos, about a second late. Keep it. The frames and Auto-Thread already
  count the cast; the bots' `soloDueIn` does not, and stays as it is (changing it would move every
  recorded fight result again). Say it in `docs/solos.md` under what is known, in two sentences.
- The aura pins are regression pins (see COMMON). If the merged tree fails an aura test, find out
  why before anything else; re-record only what a change means to move, compared entry by entry.

## What to do, in order (commit after each step)

1. Merge `p11/solo` (`8e7f950`). Set `RELEASE_PINS.contentVersion` from `tests/sim/golden.json`.
2. Merge main (`6c345ad`). Resolve the five conflicts keeping both sides' intent: the menu pass's
   wording and the voice guide's bullets, plus your Solo bullet and lines; the marks' placement in
   `relics.ts` plus your Solo changes there. The Brann pin and its test: take both stories, dump
   the pin on the merged tree, compare key by key against both parents, and re-record only the keys
   the two changes explain, with the reason in `tests/uiPhase5e.test.ts` and the commit. Check that
   main's `docs/demo.md` Version 20 section and your branch's doc edits both survive.
3. Typecheck and lint. Then the whole unit suite with
   `/home/user/aw-work/6/full-suite.sh /home/user/aw-work/wt-p11solo-w3 /home/user/aw-work/12/join/suite1.log`.
   Expected red: the 11 fight-derived sound snapshots (re-record each, compared first, commands in
   `/home/user/aw-work/11/solo/W0-HANDOFF.md` section 6; `audioPhase5c`'s literals from its failure
   message). Anything else red: find the cause. A seed-dependent test that W1's re-record moved may
   need a seed re-picked (W1's tools: `/home/user/aw-work/11/solo/tools/tool-seeds3.mts`); a text
   pin the merge moved is re-dumped and compared. Never weaken or skip a test.
4. `npm run build` and `npx tsx tools/release-check.ts` (read what evidence it wants; the logs of
   step 5 are its evidence).
5. On the commit you intend to land: `/home/user/aw-work/6/verify-land.sh <wt> /home/user/aw-work/12/join/verify`
   and the whole browser suite, `/home/user/aw-work/7/e2e.sh <wt> 4610 /home/user/aw-work/12/join/e2e.log`
   (about an hour; the wrapper config `/home/user/aw-work/7/pw.config.ts` was rebuilt this round:
   if it misbehaves, fix it and say so). Keep the tree still while either runs. A browser test that
   fails under load: run it alone, and if it still fails, run the same test on main
   (`/home/user/aetherweaver`, port 4620) back to back, and report both.
6. Play it (JOIN.md Part 2, step 10): a scripted new-player first run in the built app, Title to the
   end of the second fight, with pictures of a Solo coming (the mark and the frame's strip), firing
   plain, and firing Cued; the same with Auto-Thread on; a Conductor fight with a Duet. Pictures at
   1280 x 720, `deviceScaleFactor: 2`, into `/home/user/aw-work/12/join/shots/`, plus one or two
   labelled sheets that put the moments side by side for the owner. Open each; say plainly what
   looks wrong.
7. When the orchestrator sends `DOC-TABLES.md`: paste it into `docs/solos.md` (and the phase docs it
   names), check it reads as one document, and commit (docs only).
8. Draft the tester notes for the next demo version as `/home/user/aw-work/12/join/DEMO-V21.md`,
   in the shape of the Version 20 section of `docs/demo.md` (what changed; what we know is off;
   what we'd like to hear), plain words, following `docs/voice.md`. It must say: every Solo number
   comes from bots and nobody has played it; old replays will not play back (one sentence why);
   settings, saves and profiles carry over (and what the settings lose: the Cue key, the Cue
   modifier, Hero autonomy); `T` and the pad's right bumper do nothing now. Do not edit
   `docs/demo.md` itself.

Keep `/home/user/aw-work/12/join/PROGRESS.md` as you go. Do not merge to main or push.

## Finish line

Steps 1 to 6 and 8 done; verify-land clean and the browser suite passing (or each failure shown to
be load, with the main control) on one commit, named; the sheets made. Step 7 when the tables come.
Hand back with the commit, what the verification says, the pictures, and what looks wrong.
