# State at hand-off (18 November 2026, about 17:30 UTC)

Paths under `/home/user/aw-work/` in these notes are copied under `handoff/round-11/aw-work/` on
this branch (text and scripts only; pictures, logs and build folders were not kept, except three
Solo sheets in `handoff/round-11/pictures/`).

## Branches

| Branch | Tip | What it is | Verified? |
|---|---|---|---|
| `main` | `0df94e8` | Round 10 plus both menu text passes | Yes: unit suite 260 files, 5,429 passed; browser smoke, a11y, locale, input 47 passed, 2 timeouts that passed alone |
| `p11/int-a` | `28bcc44` | The marks over the larger heroes: Part 1 (non-aura marks), proposals P2 to P6, a new place for Seren's blades and Oro's drop, docs; main `0df94e8` merged in | Before the merge (`e6780fc`): unit suite clean (5,433), browser 40 passed, 2 failed (the busy-fight time budget and the roster-of-six fight's 8-minute limit; both failed again alone, machine under load, **not shown to be noise**). On the merge: typecheck, lint, goldens, baselines passed; whole suite and browser tests **not run** |
| `p11/pour-label` | `d645c35` | Proposal P1 alone (the pour's label over the drawn head). Moves exactly 80 entries of the aura presentation pin (`beam`, all 8 samples of the ten beam-song cases) | Not landed: see "The aura pin and the guard" |
| `p11/marks-proposals` | `0222d76` | P1 to P7 stacked (P7, Fermata's shell, was not taken) | Reference only |
| `p11/solo` | see `aw-work/11/solo/w1/PROGRESS.md` | Solos: rules, content, bots, tools, tuning (step W1) | Mid second round: see below |
| `p11/solo-join` | `861c5f2` | Solos: all four steps joined, docs, browser tests, review items 1 to 10 fixed | Typecheck and lint clean; **no whole unit suite since W1's second round was merged**; five new browser tests and the Conductor's test passed on the earlier `da9c99e` only |
| `p11/solo-w2`, `-w3`, `-w4` | merged into the join | Input and saves; HUD, text, the mark; sound | Not pushed; nothing in them the join lacks |
| `handoff/round-11` | this branch | Notes, briefs, hand-offs, the review, scripts | Docs only; never merge into main |

## The aura pin and the guard: read this before touching them

- The owner lifted the aura restriction in their own words ("You can change the auras, remove that
  restriction."; `aw-work/11/AURAS-UNLOCKED.md`).
- The session's permission system nevertheless **refused** two attempts to edit the aura
  presentation pin as "undermining oversight": the orchestrator's one-line `simVersion` change
  (before the owner's answer), and later the marks agent's re-record of P1's 80 entries (after
  it). The Solo tuning agent's one-line `simVersion` change did go through (commit `49c8284` on
  `p11/solo`).
- So on `p11/int-a` **no pin entry was re-recorded and the release check's aura guard
  (`AURA_APPROVED`, `AURA_BASE` in `tools/release-check.ts`; its tests in
  `tests/releaseTools.test.ts`) is still in place.** P1 is therefore left out of `p11/int-a`.
- On `p11/solo` and `p11/solo-join`, two guard tests in `tests/releaseTools.test.ts` are red
  because the pin has a commit the guard does not list.
- What is needed, and it should be done in the open: either retire the guard (the owner's answer
  covers it; if the permission system refuses again, do not work around it: tell the owner what
  was refused and ask them to allow it or to make the change), or add the two commits to
  `AURA_APPROVED` with the owner's date. Do not land the Solo work with those tests red.
- A recorder patch with `--diff` and `--rewrite --only=` was written but not committed; it was in
  the scratch folder and is lost. The method that worked before is in the summary of `STATE.md`
  below ("Re-recording aura pin entries").

## Solos: where each piece stands

Design and decisions: `aw-work/11/solo/DESIGN.md`, `DECISION.md`. As built: `docs/solos.md` on
`p11/solo-join`. Review: `aw-work/11/solo/review/REVIEW.md` (ten findings, none breaking).

**W1, `p11/solo`** (`aw-work/11/solo/w1/PROGRESS.md` is the truth; its last section is round 2):

- Round 1 complete at `9b3d702`: hands study (a late, imperfect "person" still gets 81 to 86% of
  boss-fight Solos Cued; the 1 s wait stays), hero judgement, A Tempo's gift, all baselines and
  recorded results re-recorded.
- **Tip: `bc46e3f`, a labelled work-in-progress commit. Unverified:** the test run over W1's files
  after the last re-record was cut short, and typecheck and lint were not re-run on it.
- Round 2, rules final at `d8e63ed`: the Resonance meter doubled to 200 with every gain back to
  its whole number (`37715f5`; proved identical over 936 fights; no save holds a Resonance
  amount); no plain Solo roots its hero (only a Cued Starfall does) and the rootHold judgement is
  gone; a hero finishes any cast before a Solo; `ledger.plainSolos`, `soloQueue` and `threadOn`
  for the screens. Review items fixed, as reported: 1 (Oro), 2 (`soloDueIn` nulls, the bots' wall
  rule), 3, 5 (the Novice has a beginner's hands: 45% Cued), 6 (Silent Cues holds 0.5 s),
  7 (Hollow Crown gives the Cued form only; the Maestro Deed is 75), 9, 10, the small leftovers
  and four content lines. The Seamstress and the Frayed Threshold are back in band (91% and 94%
  over 150 fights).
- `8f88e14`: all 52 baselines written again. `bc46e3f`: the full re-record and seed re-picks.
- **Left:** typecheck, lint and the tests over W1's files on `bc46e3f`; the Novice's bands in
  `tools/harness.ts` (they still hold round-1 numbers, and she is weaker now by design); the
  whole suite; whole-run win rates; `HANDOFF.md`'s placeholders. `NUMBERS.md` sections 7 and 8
  are current; section 2 (the halved gains) is replaced by the doubled meter.
- The agent's first kill at stop matched other Solo worktrees by name; no other agent was running
  a process in them that mattered (the join had already stopped), but treat any half-written log
  from that minute with suspicion.

**The join, `p11/solo-join`** (`aw-work/11/solo/w6/PROGRESS.md`, section "STATE AT STOP"):

- Contains `p11/solo` through `8f88e14`, W2 at `a569874`, W3 at `52fe225`, W4 at `621cd5a`.
- Review items 1 to 10 for the HUD, input, text and tests are done, with tests. Item 11 (docs) is
  part done: `docs/solos.md` is rewritten for round 2 but its result tables are round 1's.
- Left, in order: merge `p11/solo` when W1's last re-record is committed; set
  `RELEASE_PINS.contentVersion` from `tests/sim/golden.json`; the whole unit suite; re-record the
  11 fight-derived sound snapshots; merge main (expect conflicts in `docs/voice.md`,
  `src/ui/text/en/hud/hints.ts`, the Brann UI pin and its test, `src/render/relics.ts` once the
  marks are on main); build; release check; whole browser suite; the scripted first run with
  pictures (`aw-work/11/solo/JOIN.md`, Part 2).
- Raised and not decided: heroes now finish a cast before a Solo, so Vexis's Solo fires after its
  one-second wait has run out in about 4 of 10, a second late on average. The frames and
  Auto-Thread count the cast; the bots' tell does not.

**Known and to tell the owner:** every number is a bot's; the beginner bot's 75% was earned with
instant hands and overstates a real beginner until R2i is done; old replays are refused in one
sentence; settings step from 4 to 5 and drop the Cue key, the Cue modifier and Hero autonomy; `T`
and the pad's right bumper do nothing; saves and profiles load unchanged.

## Menus

Landed: pass 1 (`2a2b91b`) and pass 2 (`0df94e8`). Audit, counts and the lines left alone are in
`aw-work/11/menu/` (`AUDIT.md`, `counts.md`, `left-lines.md`, `pass2/counts.md`).

Left for a third pass, after the Solo work lands: Result and Summary as tiles; Prep's hero cards
(Prep is still about 930 words for a new player); the wording of everything in `src/content`
(motifs, relics, events, hero and aura descriptions), which moves `contentVersion`; 13 em-dash
lines; the Codex Auras page is not folded; "Newly unlocked" sentences live in
`src/meta/profile.ts`.

Behaviour changes made by pass 2 that the owner has been told about but has not played: Settings
has two tabs; Codex pages open folded; Motifs shows one level until "Every level"; locked map
stops take keyboard focus; Prep's "Newly unlocked" shows names until opened.

## The demo

- Artifact https://claude.ai/artifact/WQmazTSTrGDW3SpS4CQ9Uv, Version 19 (built from `9485ea3`).
  Nothing from this round is published.
- Build: `npm run build:demo` in the main checkout. Checks: the scripts in
  `aw-work/8/land/demo/` (`c1-starts.mjs`, `c2-fight.mjs`, `c3-v18.mjs`; `DEMO_ROOT` points them
  at a build). Publish with the Artifact tool: `file_path` `dist-demo/index.html`, the artifact's
  `url`, `root: dist-demo`, and a `files` map of new hashed assets (same path) and stale
  published ones (`null`); list the published files first (`action: list, scope: files`).
- `docs/demo.md` gets a section per version: what changed, "What we know is off", "What we'd
  like to hear".
- Gallery artifact https://claude.ai/artifact/4b68jifSWuqqKajSZf6zW7, Version 11. Its source was
  in the old scratchpad and is gone; read the page back with the Artifact tool before editing.

## Re-recording aura pin entries (the method that worked)

Write a temporary script that computes `serializePin(await computePin())` from
`tests/aura/presentationPinFixture.ts` to a temp file with
`npx tsx --tsconfig tsconfig.app.json`; diff it against the committed JSON entry by entry;
confirm only the entries the change means to move differ; then copy it over and commit it alone,
naming the entries. `tests/aura/recordPresentationPin.ts` refuses to overwrite.

## Verification commands

- `aw-work/6/verify-land.sh <worktree> <outdir>`: typecheck, lint, golden dry run, baseline
  `--check`s, whole unit suite; writes `summary.log` and `done`.
- `aw-work/7/e2e.sh <worktree> <port> <log> [spec args]`: browser tests; queues itself on a lock;
  the first log line is `[evidence] commit <sha>`. Whole suite about an hour; smoke, perf and
  framing about half that.
- Re-record commands for each kind of recorded result: `aw-work/11/solo/W0-HANDOFF.md`, section 6.

## For the owner, still open

- Delete the five remote `backup/*` branches (the git proxy refuses it from a session).
- Play the demo on a real graphics card: nothing has been measured on one.
