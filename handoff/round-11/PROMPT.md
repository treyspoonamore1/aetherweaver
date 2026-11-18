# Handoff prompt: Aetherweaver, round 11

Paste everything below the line into a new session opened on the repository
`treyspoonamore1/aetherweaver`.

---

You are taking over the orchestration of **Aetherweaver**, a support-focused action roguelite
(TypeScript, React + Zustand, three.js, WebAudio, a deterministic 60 Hz sim). The previous
session ran out of usage in the middle of a round of work. Everything you need is in the
repository: the work itself on branches, and the previous session's notes, briefs, hand-offs,
review and scripts on the branch `handoff/round-11`, under `handoff/round-11/`.

**Start by fetching the branches and reading, in this order:**

1. `git fetch origin handoff/round-11 p11/solo p11/solo-join p11/int-a p11/marks-proposals`
2. `handoff/round-11/STATE.md` on `handoff/round-11`: the exact state at hand-off, commit by
   commit, and the ordered list of what is left.
3. `handoff/round-11/aw-work/9/COMMON.md` and `aw-work/11/COMMON.md`: house rules for agents.
4. `handoff/round-11/aw-work/11/AURAS-UNLOCKED.md`: the owner lifted the aura restriction.
5. For the Solo work: `aw-work/11/solo/DECISION.md`, `docs/solos.md` on `p11/solo-join`,
   `aw-work/11/solo/review/REVIEW.md`, then `w1/PROGRESS.md` and `w6/PROGRESS.md`.

The notes refer to paths under `/home/user/aw-work/`. That directory does not exist in your
container. Recreate it: copy `handoff/round-11/aw-work/` to `/home/user/aw-work/`, make the
scripts executable, and create git worktrees there for the branches you work on (symlink
`node_modules` from the main checkout into each).

## What the owner asked for (their words)

- "Continue. I think there's a lot of information on the menu UI (and it sounds a lot like AI)
  and I feel like no players will manually trigger the solos/specials of each character - so
  either remove the manual trigger or design the game around auto triggering."
- On auras, later: "You can change the auras, remove that restriction." (The earlier rules "Ask me
  before making changes on the auras" and "Propose, then I approve" no longer apply.)
- Standing, from earlier: "Continue to work on the game. Go with your recommendations." "Show me
  pictures for the things you want answered." "Use sub agents with model and effort chosen based
  on task. You should be the orchestrator." "You can increase sub agents if necessary for speed."
- Last message: "I'm almost out of fable usage. Finish up and write a prompt to handoff to a new
  session." So be sparing: prefer finishing and landing what exists over starting new streams.

## Rules that still hold

- No pull requests unless asked. Push with `git push -u origin <branch>`; retry only on network
  errors.
- Never put a model name in a commit, PR, code comment, doc or artifact. Commits end with exactly:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  Claude-Session: <the new session's URL>
  ```
- Land code on main only when verified on the exact commit (typecheck, lint, whole unit suite,
  golden dry run, baseline `--check`s: `aw-work/6/verify-land.sh <worktree> <outdir>`; browser
  tests: `aw-work/7/e2e.sh <worktree> <port> <log> [spec args]`), then `git merge --ff-only` in
  the main checkout and push. Docs-only changes may go straight to main.
- A recorded result (golden, baseline, pin, snapshot) is re-recorded only when the change means
  to move it, compared first, with the reason in the commit. Never weaken or skip a test.
- The aura pins (`tests/aura/presentationPin.json`, `chordCardsPin.json`) are regression pins now,
  not approval gates.
- The owner sees what changed: before-and-after pictures sent directly, and plain notes with each
  demo version in `docs/demo.md`. Text a player reads follows `docs/voice.md`.
- The machine has 4 CPUs: tests time out under load; re-run a timeout alone before calling it a
  failure. Containers restart; agents should keep a `PROGRESS.md`.
- Deleting remote branches is refused by the git proxy. The owner has been asked to delete the
  five `backup/*` branches themselves.
- The owner's email is private: never send it to an outside service.

## Where things stand (details and commits in STATE.md)

1. **Menus: landed on main.** Two passes (first-hour screens; Settings tabs, Codex folds, station
   intros, aura lines), plus `docs/voice.md`. A third pass is owed after the Solo work lands:
   Result and Summary as tiles, Prep's hero cards, and the wording of `src/content` (motifs,
   relics, events, aura descriptions), which moves `contentVersion` and should ride the Solo
   landing's re-record or a later one.
2. **Marks over the larger heroes: built on `p11/int-a`, not landed.** It holds the non-aura
   marks, proposals P2 to P6 and main merged in. Proposal P1 (the pour's label, on
   `p11/pour-label`) is left out because it moves 80 aura pin entries, and the permission system
   refused the agent's pin re-record even after the owner lifted the restriction; the release
   check's aura approval guard is likewise still in place. Read "The aura pin and the guard" in
   STATE.md before touching either. Left: the whole unit suite and browser tests on the merged
   commit (two browser tests failed under load and were not shown to be noise: run them on main
   and on the branch back to back), then fast-forward main and push.
3. **Solos: designed, built, joined, reviewed; not landed.** Design A, "your Thread is the Cue":
   every hero fires their own Solo one second after it fills; it is the stronger "Cued" form if
   the Weaver's Thread is on that hero as it fires; no Cue key, no price; Resonance buys only the
   Crescendo. `p11/solo` is the rules, bots, tools and tuning branch (W1); `p11/solo-join` is all
   four steps joined (rules, input and saves, HUD and text and the new mark, sound) with docs and
   five new browser tests. An independent review found no broken fight, save or replay, and ten
   edge defects; both branches were mid-way through fixing them, and W1 was mid-way through a
   second tuning round (the Resonance meter doubled to 200 so that every gain keeps its whole
   number; the root taken off plain Solos that pin their hero; a count of plain Solos in the
   tallies; a view ordering heroes waiting on the one-second gap), when the session stopped.
   **Both branches may end in a work-in-progress commit. Read the two PROGRESS files before
   trusting either tip.**
4. **The demo** (a claude.ai Artifact, https://claude.ai/artifact/WQmazTSTrGDW3SpS4CQ9Uv) is at
   Version 19, built before any of this round. Version 20 should carry the menus and the marks;
   the Solo change should follow as its own version with its notes. How to build, check and
   publish is in `docs/demo.md` and STATE.md. The gallery artifact
   (https://claude.ai/artifact/4b68jifSWuqqKajSZf6zW7, Version 11) has its source only as the
   published page: read it back with the Artifact tool before editing.

## What to do, in order

1. Land the marks (item 2), then build, check and publish demo Version 20 with notes in
   `docs/demo.md`, and tell the owner with two or three pictures.
2. Finish the Solo work: W1's second round and its review fixes, then one final re-record of
   every fight-derived result; the join's review fixes; merge W1 and main into the join;
   re-record the fight-derived sound snapshots; build, release check, whole unit suite, whole
   browser suite; a scripted first run with pictures. Then land, publish the demo as the next
   version, update `docs/demo.md`, and show the owner.
3. Tell the owner plainly, as before: every Solo number comes from bots, nobody has played it;
   the beginner bot's gain was overstated until she is given a beginner's hands; old replays will
   not play back; settings, saves and profiles carry over; the two Movement III fights where the
   skilled bot lost a little ground.
4. Then the third menu pass (item 1).

Use subagents for the work and stay the orchestrator: one agent per branch, with a brief written
to a file, explicit file ownership, and a finish line. Review each hand-back against the commit
before landing anything.
