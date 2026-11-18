# W6 progress (the join)

Worktree /home/user/aw-work/wt-p11solo-w3, branch p11/solo-join, started from p11/solo at accbe3a.
Ports 4610 to 4619. Brief: ../JOIN.md. Never run anything in /home/user/aw-work/wt-p11solo.

## Part 1
- [x] 1. Merge w2, w3, w4; resolve
- [x] 2. SOLO-JOIN stand-ins out; unused text keys; stale lines; old-replay sentence one home
- [x] 3. Tests quoting the reworded recap line
- [x] 4. W4 uses `paid`; W2 uses SOLOS.lead / SOLOS.danger
- [x] 5. Name-only seams (W0 section 3, items 7 and 10)
- [x] 6. e2e
- [x] 7. Docs
- [x] 8. release-check pins
- [x] 9. typecheck, lint, unit suite
- [x] 10. Merge p11/solo-w2 again if it moved; hand back

Notes as I go:
- 13:20 three merges clean (no conflicts), typecheck clean after them. Commits f4b1678, d939649, 268e334.
- 13:25 c25bd67: SOLO-JOIN stand-ins out, 16 unused text keys deleted, Auto-Thread hint reworded,
  old-replay sentence one home (src/sim/replay.ts OLD_REPLAY_LINE, W3's words; text key + replayMessage removed).
- 13:35 next commit: SOLOS.lead/danger in InputController, `paid` in audio, 4 no-target guards removed,
  recap-line tests, Brann pin 12 keys + Codex hash re-recorded (compared: two reworded Brann lines only).
  Comparison worktree at w6/cmp (detached 52fe225): REMOVE with `git worktree remove` when done.
- Items 1-4 done. Next: seams 7 and 10, lab decree copies, lint, full suite (background), e2e, docs, release pins.
suite pid 22164
- 13:45 seams commit: cueChained.cost and resonanceSpent.on removed; freeCues/saved LEFT (hash + save shape); lab decree copies. Suite1 running on cmp at a6debfe (log w6/suite1.log).
- 14:05 e2e commit; e2e-solos1.log running (e2e.sh, port 4610, e2e/solos.spec.ts). Then smoke -g Conductor.
- (clock note: the two times above are 20 min ahead; real time now 14:00)
- 14:00 merged p11/solo twice more as it moved: 76702cd (baselines) and 71ee07c (final re-record). Clean.
  Release pins set (settings 5, content c-0a37a658f5775748). releaseTools: 2 aura-guard tests red (retired on p11/int-a, not mine).
  W1 has NOT handed back yet (Novice bands, HANDOFF.md still to come): check p11/solo head again before hand-back.
- e2e-solos1.log queued behind the marks stream's e2e run; suite1.log queued behind w2's and menu's suites (cmp worktree, snapshot).
- Next: docs (solos.md, hero-autonomy.md, phase-5f.md, phase-7.md 15/16, voice.md, README, demo.md, phase-4d), then read suite + e2e results.
- 13:58 docs committed (4050d4d). Queued: e2e-solos1.log (solos.spec), e2e-conductor1.log (smoke -g "the Conductor"); suite1.log on cmp snapshot.
  NOTE e2e.sh builds from this worktree when its turn comes: do not leave src half-edited.
- Found while sizing the e2e tests (scripts/noinput.mts): a first fight nobody touches loses on 2 of 6 seeds (no Mend), Solos fire once at ~31 s.
- Open for the report: soloDueIn shows the same seconds for two heroes waiting on the gap (W3 asked W1); no plain-Solo tally; decreeNoDome still has an em dash (content, W1's); settings-5 fixture after landing (W2 #6).
- 14:05 coordinator: w2 follow-up a569874 (already merged: verified ancestor), hint wording fits voice (25 words, 'Counts as an assist.'), Brann stays out of the 60% line (doc updated).

## State at 14:55 (Part 1 nearly done)
- Join head: da9c99e (tree clean). Contains p11/solo through 9b3d702 (W1's final re-record + Novice bands), w2 a569874, w3 52fe225, w4 621cd5a.
- Typecheck clean (tc2.log). Lint: eslint clean; prettier's one complaint (tests/bots/fillInert.json) was W1's file and W1's fae00c6, merged since, fixed it (checked the file alone after the merge; the whole lint was not run again after that merge).
- Unit suite on da9c99e (suite1.log): 5,493 tests, 5,468 pass, 13 fail, 10 skipped, 2 to-do.
  11 = fight-derived SOUND snapshots (audioPhase5 3, audioPhase5c 1, audioRiftSnapshot 2, audioSpireSnapshot 5): Part 2 re-record.
  2 = tests/releaseTools.test.ts aura-guard tests (guard retired on p11/int-a; resolve when main has it).
  The two PICTURE snapshots (renderSpire/RiftSnapshot) pass: they record how arenas and models are drawn, no fight is played in them.
- e2e/solos.spec.ts: 5 of 5 pass on da9c99e (e2e-solos1.log, 9.5 min).
- e2e Conductor test (smoke -g "the Conductor"): queued behind the menu stream's long run; log e2e-conductor1.log (+ .done).
- cmp worktree removed. Nothing of mine is running except the queued e2e.sh for the Conductor (pids 28946, 28953).

## Part 2 to-do (when resumed)
1. Merge p11/solo if it moved past 9b3d702 (W1's HANDOFF.md: fill docs/solos.md from its final numbers if they differ).
2. Re-record the 11 sound snapshots, each compared first (GEN_AUDIO_SPIRE_SNAPSHOT=<file>, GEN_AUDIO_RIFT_SNAPSHOT=<file>, GEN_AUDIO_SNAPSHOT=1; audioPhase5c's literals from its failure message).
3. Merge main (menu2: docs/voice.md last bullets conflict, keep theirs + my Solo bullet; tests/uiPhase5e.brann.json + uiPhase5e.test.ts will conflict: take both stories, re-dump and compare before re-recording; int-a: release-check aura guard retired, then releaseTools 2 tests go green; src/render marks).
4. npm run build; tools/release-check.ts; whole unit suite; whole e2e (e2e.sh <wt> 4610 w6/e2e.log); verify-land.sh.
5. Play it with pictures into w6/shots/. scripts/noinput.mts and follow.mts are the Node dry runs of a first fight.
6. HANDOFF.md.
- 15:00 Part 1 handed back at da9c99e. PART1.md is the hand-back note. Still queued, mine: e2e.sh for the Conductor test (pids 28946, 28953; it builds from the worktree when its turn comes: keep the tree at a commit until e2e-conductor1.log.done exists, or stop those two pids).

## Review round (coordinator's 11 items; review at ../review/REVIEW.md)
Working in a SECOND worktree /home/user/aw-work/11/solo/w6/wt on branch p11/solo-join-review (from da9c99e), so the
main worktree stays at a commit for the queued Conductor e2e run. When that run is done: in wt-p11solo-w3,
`git merge --ff-only p11/solo-join-review`, then `git worktree remove w6/wt`, delete the review branch.
- [x] 4 Auto-Thread back/keep + empty click (+tests, mutation-checked)   - [x] 6 text (5 lines)   - [x] 8 gamepad test
- [x] 2 badge (647a9e9)
- [x] 7 screen readers (strip; Brann pin 2 keys re-recorded, compared)
- waits for W1's round on p11/solo (still 9b3d702 at 15:45): 1 (soloDueIn cannot-fire; delete callers' copies; wall rule),
  3 (Silent Cues hold < wait; strip), 5 (dome hint reads sim: needs a sim export, add after merging W1 to avoid conflicts in heroes.ts),
  9 ("7 of 9 Solos Cued"), 10 (meter 200), 11 (docs: Novice sentence from W1; masked replay frozen copies).
- 15:50 review branch p11/solo-join-review at fa89e2b (in w6/wt): done 2, 4, 5 (UI side + sim view wallWanted in solos.ts), 6, 7, 8, 11b (masked replay docs).
  AFTER MERGING W1's round (p11/solo past 9b3d702):
  * heroes.ts soloFires: use wallWanted(world, e) for the party-hit branch (one copy).
  * item 1: delete callers' own stilled/possessed checks (hudBridge soloTell, soloMark.ts, InputController autoSoloTarget, conducting.ts nextSolo has none);
    autoSoloTarget wall line: drop `c.targetId !== null` (soloDueIn non-null already means he can fire); add probe5-C as a test (Kael stunned, full wall: Thread does not go to him);
    beat strip test from review/beatnext.mts (stilled party: no next Solo named).
  * item 3: Silent Cues: add a sim view (can a Thread put on them now still Cue it: due + held >= cueHold) and use it in the strip ("Thread to Cue"/"Hold" only if it can be met), the coach's solo hint and the mark's loud look.
  * item 9: Result "7 of 9 Solos Cued" from W1's plain count.
  * item 10: meter 200 / segment 50 / crescendoCost 200 (w1/double.py). Places to fix (survey): src/audio/music.ts:916 (resonance / 25), TrainingParts.tsx:196 (setResonance 100 + its label key),
    labs' setResonance 100/75 (VfxLab, conductScenarios, conductingMock, audio lab fight.ts:142, offline.ts), ui/lab/mock.ts 355-358/847/4218/4239, render/entities.ts:3221 fallback 25,
    render/feedback.ts:4044 (motes per resonance), audio/sfx.ts:1302, audio/lab/labState.ts 851/876, e2e (smoke: grep aria-valuenow / setResonance), tests in my areas, docs/solos.md numbers (halves -> meter 200), README?
  * item 11a: docs/solos.md Novice sentence + numbers from W1.
- 16:15 review branch at a9525d3: merged p11/solo 37715f5 (meter 200) and did item 10 (views/labs/tests read the content's meter; FakeWorld.setResonancePct; sound board res buttons).
  Left failing in top-level tests: 11 sound snapshots (Part 2), phase6Contracts 1 + phase7Contracts 2 (goldens/content version: follow W1's next re-record; then RELEASE_PINS.contentVersion too).
  docs/solos.md still says "half": rewrite the Resonance parts when W1's NUMBERS.md section 2 is replaced.
  Part 2 dry run (git merge-tree): menu2 conflicts in docs/voice.md, src/ui/text/en/hud/hints.ts, tests/uiPhase5e.brann.json, tests/uiPhase5e.test.ts; int-a conflicts in src/render/relics.ts.
- 16:33 Conductor e2e PASSED on da9c99e (e2e-conductor1.log, 3.4 min). Review branch fast-forwarded into p11/solo-join (head 8ffd087);
  the second worktree w6/wt and branch p11/solo-join-review are gone. Work is back in /home/user/aw-work/wt-p11solo-w3. Nothing of mine is queued or running.
  Item 3 done generically (sim view cueInReach; strip/coach/badge/mark). Waiting on W1's round 2 (p11/solo still 37715f5) for 1, 9, 11a, wallWanted in soloFires, docs numbers, contract tests + release pin.
- 16:50 suite2.log started (full-suite.sh on the main worktree at 8ffd087): keep the tree still until suite2.log.done.
- 16:50 W1 round 2 code landed (d8e63ed). Merging in SECOND worktree again: w6/wt, branch p11/solo-join-r2 (suite2 runs in the main worktree). Later: ff p11/solo-join to it, remove wt + branch.
- 17:10 Round-two work is on p11/solo-join (no second worktree, no extra branch any more). Merged p11/solo d8e63ed (round-2 rules) and 8f88e14 (baselines).
  Done from the coordinator's list: 1 (callers' checks deleted; frames/mark/beat strip/badge/Auto-Thread read soloQueue via soloTurnIn; wall rule), 2, 3 (cueInReach), 4, 5 (wallWanted, one copy with soloFires; goldens identical with/without),
  6, 7, 8, 9 (Result "7 of 9"; optional stats key plainSolos; Summary tile "7/9"), 10 (meter), 11b.
  LEFT: 11a (docs/solos.md: Novice sentence + numbers from W1; whole doc needs the round-2 rewrite: meter 200, no rooting, cast first, Oro, Hollow Crown, Silent Cues 0.5 s, Maestro Deed 75, bands).
  suite2.log was run at 8ffd087 = between W1's meter commit and its re-record: its 93 failures are that, not a result to quote.
  WAITING on W1's re-record commit (goldens etc.): then phase6Contracts/phase7Contracts/saveMatrix/determinism go green; set RELEASE_PINS.contentVersion from tests/sim/golden.json; run the whole suite.
  FOUND, to report: a hero finishing a cast before a Solo makes Vexis's Solo fire after its tell ran out in 39% of cases (1.0 s mean, 2.2 s max; scripts/cast-hold.mts). soloDueIn (bots) does not count the cast; soloQueue (frames, Auto-Thread) now does.

## STATE AT STOP (18 Nov, about 17:35) — read this first
Branch p11/solo-join, head faae9b5, tree clean, in /home/user/aw-work/wt-p11solo-w3. No second worktree, no extra branch,
nothing of mine running or queued. Contains p11/solo through 8f88e14 (round-2 rules d8e63ed + its baselines), w2 a569874, w3, w4.
Typecheck and lint clean on faae9b5. No whole unit suite has run since the round-2 merge (a top-level run was stopped unfinished).

Conductor browser test: RAN and PASSED on da9c99e (w6/e2e-conductor1.log, 3.4 min). e2e/solos.spec.ts: 5 of 5 passed on da9c99e.
Neither has run since the review changes (strip markup, queue, badge `on`): rerun both in Part 2.

The eleven review items:
 1 callers of soloDueIn .......... DONE (own checks deleted; frames/mark/badge/beat strip/Auto-Thread read soloQueue via soloTurnIn; wall rule; tests)
 2 badge only inside the chain ... DONE (+ filled only when threadOn)
 3 Silent Cues prompt ............ DONE (sim view cueInReach; strip/coach/badge/mark)
 4 Auto-Thread back + empty click  DONE (tests mutation-checked)
 5 coach's dome hint ............. DONE (sim view wallWanted, shared with soloFires; goldens identical with/without)
 6 text that said "Cue" .......... DONE (5 lines)
 7 screen readers ................ DONE (strip says states, not seconds)
 8 gamepad test that could not fail DONE
 9 "7 of 9 Solos Cued" ........... DONE (optional stats key plainSolos; Summary tile 7/9)
10 meter at 200 .................. DONE (audio stems/arpeggio, motes, Training button, labs, 25 test stagings)
11 docs .......................... IN FLIGHT: masked-replay note done; docs/solos.md rewritten for round 2 BUT its result tables are still
                                   the first round's (labelled so). Replace from W1's final HANDOFF/NUMBERS; Novice bands notes in phase-5a/5c/5d too.

Still to do before/with Part 2:
 - Merge p11/solo when W1 commits its round-2 re-record (goldens etc.). Then expect green: phase6Contracts, phase7Contracts, meta/saveMatrix,
   sim/determinism, command snapshots. Set RELEASE_PINS.contentVersion from tests/sim/golden.json (it is stale: c-0a37a658f5775748).
 - Run the whole unit suite; name what fails. Known waiting: 11 fight-derived sound snapshots (re-record, compared), 2 aura-guard tests in releaseTools (p11/int-a).
 - Tell W1/owner: finishing a cast first makes Vexis's Solo fire after its wait ran out in 39% of cases (1.0 s mean, 2.2 s max; scripts/cast-hold.mts).
   soloQueue (frames, Auto-Thread) counts the cast; soloDueIn (bots) does not.
 - Part 2 as in JOIN.md: re-record sound snapshots; merge main (dry run: conflicts in docs/voice.md, src/ui/text/en/hud/hints.ts,
   tests/uiPhase5e.brann.json, tests/uiPhase5e.test.ts from the menu branch; src/render/relics.ts from the marks branch); build; release-check;
   whole unit suite; whole e2e; verify-land; play it with pictures into w6/shots/; HANDOFF.md.
 - Brann pin re-records so far (each compared, reason in tests/uiPhase5e.test.ts): 12 keys, 2 keys, 8 keys, 3 keys. Tool: w6/scripts/zzDump.test.ts + pindiff.py.
NOTE: w6/ is outside the repository. If only the repository survives, this file and w6/scripts do not: the list above is also in the last commit message.
