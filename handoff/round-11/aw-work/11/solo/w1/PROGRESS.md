# W1 progress (tools, the "person" follower, tuning, baselines)

Branch `p11/solo` in `/home/user/aw-work/wt-p11solo`, from `8572e48`. Read WAVE2.md, W0-HANDOFF.md
section 4 (W1's files), then this. Work files here; results for W3 in `NUMBERS.md`; hand-off `HANDOFF.md`.

- [ ] A. gainScale settled and folded into the numbers -> NUMBERS.md
- [ ] B. The "person" follower; the wait, the tell, threadCues for hands -> NUMBERS.md
- [ ] C. Harness and tools (study tool in tools/, Conductor tallies, soloCue ablation)
- [ ] D. Hero judgement, each measured
- [ ] E. Callings to band (A Tempo path, Frayed Threshold first); Novice bands; plain Solo and the chain
- [ ] F. Content wording from w3/CONTENT-WORDING.md (if any)
- [ ] G. Baselines, then the one final re-record of goldens and the rest
- [ ] H. HANDOFF.md

Notes as I go:
- 06:45 tools/solo-study.ts + tools/person.ts committed. Hands: measured (data/hands.jsonl), wait 1 s stays, rule not widened; written to NUMBERS.md section 1 (item B done).
- Gain sweep running: w1/gain-sweep.sh -> data/gain.jsonl, data/callings.jsonl (resumable: rerun the script, done cells are skipped).
- Plan for the fold: halve content gain numbers (keep gainScale field = 1 so other branches compile); Reliquary's rolled affixes (ringing, attentive) are stored in saves: do NOT change their tiers.
- 06:50 Gain scale settled at 0.5 and FOLDED into content (w1/fold.py applied; gainScale = 1 kept as the study's knob). Fold proven exact (520 fights identical: data/fold.jsonl vs gain/callings.jsonl). NUMBERS.md section 2 written (item A done). Not yet committed: waiting for the sim/bots/meta test run (data/fold-tests.json) to find literal numbers in tests. Goldens/pins will be red until the final re-record (hashes hold mods values); that is expected.
- Known from sweeps (for E): Chronomancer Skilled a bit weaker (97%/129 s/0.79 vs 100/124/0.39 before); Conductor B 97%/61 s vs 100%/51 s; Novice+Martyr 67% vs 88% before (look at why); Frayed Threshold dip.
- Fold committed. docs/solos.md NOT edited (W6's file): list doc updates in HANDOFF (rule 6 wording, content table numbers 5 / 5,7.5,12.5 / half a segment).
- Hero judgement done (item D): kept partyHit (Kael's dome with the Thread on him) and rootHold (plain rooting Solo waits out a hit); dropped lastEnemy and spare (no effect in 780 fights). data/judge.jsonl. Committed. NUMBERS.md needs a section 4 for W3 (Kael fires at once with Thread + party hit; a plain rooting Solo may sit at "now" up to 2 s longer).
- Next (E): A Tempo's gift (now 5; old free Cue was worth 10 in today's money) -> try 10; Frayed Threshold (Novice 50% vs 85%: check with judgement on); Chronomancer Skilled; Novice+Calling at the Silent Conductor; plain Solo and the chain; Novice bands.
- Frayed Threshold (150 seeds, harness): main Skilled 93% / Novice 63%; branch 85% / 51%. Cause found: the Skilled bot Cues only 65% of Lyra's Gale Barrages there (the cut rule keeps the Thread off her), and plain it roots her (8 of her 16 downs per 100 fights are mid-rooted-Solo). With plain Gale Barrage not rooting: 93% / 57%. Tried and dropped (no help, or hurt the Novice elsewhere): hold while an enemy is on her, while the Thread is locked, while a hero is under 30%, Kael's hold 1/6 s, rooting Solos waiting 2-4 s more for the Thread (91% there but Novice bosses 75 -> 66%). LEFT AS IS, in band (>=85), flagged for the owner with the one-line option.
- Callings with judgement (data/callings2.jsonl): Skilled all fine except Conductor B (97%/59 s vs 100%/51 s before). Novice+Martyr 64% vs 88% before: to look at.
- A Tempo set to 15 (committed); NUMBERS.md section 5. data/condB.jsonl. Next: Novice+Martyr, the chain question, Novice bands, then baselines + final re-record.
- 12:40 after restart: aura pin simVersion line set to 23 (own commit; tests/aura green: 5 passed, 1 skipped writer). tests/releaseTools pin-history test may be red until the join: name it. Content wording from W3 applied in working tree (uncommitted): tests quoting old lines: tests/fill/{finale,relics,foundations,bond}.test.ts, tests/sim/solos.test.ts.
- 13:00 committed: W3's content wording (all taken), W2's requests (replay tools exit 3; SOLOS.lead/danger; soloDueIn null for full Solo with no target), W4's `paid` flag on cueChained. NOT done from W2: tests/meta/roster5e.test.ts lines 629/635 pin a recap line that W2 reworded in src/meta/run.ts (their file): fix at the join.
- tests/bots/expert.test.ts: 3 staged tests (postludeRise, postludePair, postludeBank) red after tuning: restage at the end, once tuning is final.
- Left: (E) chain question, Novice+Martyr, Novice bands; (G) baselines, final re-record (goldens, pins, snapshots, pre5g refreeze, save matrix); verify; HANDOFF.md.
- 13:10 Chain question answered (data/chain.jsonl): 0-3% of Duets/Trios have a plain Solo inside; rule left as it is. Novice+Martyr: the old "88% before" was a wrong reference; main re-measured (data/main-ref.txt): Novice Martyr 49% before, 64% now. All Skilled Callings held (see main-ref.txt vs data/callings2.jsonl, condB.jsonl).
- RULES ARE FINAL at 8144e6b (sim, content, bots, tools). Running now: (1) w1/baselines.sh (nohup; log w1/baselines.log; rerun to resume; do NOT edit src/tools while it runs), (2) seed search for 3 staged Expert tests (temp SEEDFIND describe in tests/bots/expert.test.ts; backup of the file in the scratchpad; remove the temp describe and set the seeds).
- Then: Novice bands (tools/harness.ts MOVEMENT_BANDS strings; run `npx tsx tools/harness.ts --movement N --seeds 40`), final re-record (goldens+sync, dissonance pins, 4 command snapshots, fillInert, prelude, 3 key lists, pre5g refreeze, save matrix, withoutYouRise), final study numbers, full suite, HANDOFF.md.
- rerecord script ready: w1/rerecord.sh (log w1/rerecord.log), to start when a baseline writer finishes. Baselines: two writers (baselines.sh, baselines-rev.sh) share w1/baselines.log; 52 'done' lines = all written.
- 13:20 all 52 baselines written and committed. Started w1/rerecord.sh and the final study (w1/final-study.sh -> data/final.jsonl).
- 13:40 final re-record committed; every W1 test file green (tests/sim, bots, fill, content, meta, harnessTools, aura...: data/mine-tests.json + 3 tool tests fixed). Final study done: data/final.jsonl. Left: Novice bands (harness 40 seeds per Movement), whole runs, typecheck+lint, full suite, HANDOFF.md.
- Novice bands committed. Final commit so far: 9b3d702. Full suite queued: w1/verify/suite.log (.json, .done). Then fill HANDOFF.md (@@ markers) and hand back.
- DONE. Final commit 9b3d702, tree clean, typecheck+lint clean, full suite w1/verify/suite.log: 31 fail, none in W1's files (named in HANDOFF.md section 7). HANDOFF.md written. Handed back.

## ROUND 2 (after hand-back at 9b3d702; coordinator's three decisions + the review at /home/user/aw-work/11/solo/review/REVIEW.md)

Order of work (tick as done; uncommitted work is in the worktree):
- [x] R1 (committed) Meter doubled, gains back to whole numbers (w1/double.py applied; PROVEN exact: data/double.jsonl vs final.jsonl, 936 fights identical, gained exactly x2). Tests: fold's test patch reversed; staged meter values doubled by script; remaining literal expectations being fixed (data/double-tests.json). tools/sim-bench.ts uses CONTENT.resonance.max. Other steps' labs use `setResonance value: 100` for "full": list for the join.
- [ ] R2a soloDueIn null for heroes who cannot fire (review 2) + stale targetId in bots/common.ts wall rule
- [ ] R2b Oro's wait runs whenever the party is in a fight (review 1)
- [ ] R2c hold the Solo while casting a Flourish; measure for any cast (review 3)
- [ ] R2d Kael's wall needs someone to fight (review 9); float slack heroes.ts kaelHold compare (review 10)
- [ ] R2e roots off plain forms (Gale Barrage, Hawk's Vigil, Starfall?) measured; reword lines; does rootHold still earn its place
- [ ] R2f ledger count of plain Solos; a view ordering heroes waiting on the gap (view only)
- [ ] R2g Silent Cues: hold shorter than the wait (review 6); re-measure the level
- [ ] R2h Hollow Crown: chain, A Tempo's gift, Maestro Deed count only Thread-Cued Solos; Maestro Deed number raised, measured (review 7)
- [ ] R2i Novice: a beginner's hands (goes when full, late, often not; low-life guard; no parking on Kael); then her bands (review 5)
- [ ] R2j content lines that still say "Cue" as a key: deeds.ts:181, fill/finale.ts:101, callings.ts:330, bonds.ts:168 (review); dead cueCost stat key in effects.ts; harnessTools.test.ts:1810; pre5g/golden.json simVersion 22 + unread hashes
- [ ] R3 The Seamstress: at most one more hour
- [ ] R4 final study, re-record everything (w1/baselines.sh after clearing w1/baselines.log; w1/rerecord.sh after clearing w1/rerecord.log), suite on my files, HANDOFF.md + NUMBERS.md (section 2 replaced)
- Round 2 status (uncommitted in worktree, all typechecks): DONE in code: R2a soloDueIn (cannot act / reel / Oro) + bots wall rule; R2b Oro's wait while party fights; R2c a hero finishes ANY cast first (measured cast0/1/2: data/r2-cast.jsonl; no cost; cuts 0 casts); R2d Kael target check + float slack; R2e NO plain Solo roots (soloRoots = Cued Starfall only; data/r2-roots*.jsonl, r2-hawk.jsonl: no cost; Frayed 87 -> 95-97%); rootHold judgement REMOVED (nothing left to guard); R2f ledger.plainSolos + soloQueue view (+1 line in src/ui/lab/mock.ts for the mock ledger: tell the join); R2g Silent Cues hold 0.5 s; R2h threadOn vs threadCues (Crown = Cued form only, not a Cue); Maestro Deed n 75 (measured tools/run-cues.mts: skilled 28/59/112 Cues a run on 1/2/4 Movements; never-follow ~40% of that); R2i Novice beginner's hands (NOVICE_SOLO follow 0.4 once per Solo, within 0.5 s, patience 2, danger 0.3): Cued 45%, bosses 67% (data/r2-all.jsonl); R2j content lines reworded, cueCost stat key removed, harnessTools 1810 real check, pre5g/golden.json trimmed at refreeze; Lyra's Solo lines reworded (no root).
- Running: tests on W1 files (data/r2-tests.json). Then: fix tests, commit, Seamstress (<= 1 h), final study, bands, re-record all (clear w1/baselines.log and w1/rerecord.log first), suite, HANDOFF/NUMBERS.
- 16:48 round-2 rules committed d8e63ed (FINAL rules). Seamstress now 91% (150 seeds), Frayed 94%: both in band. Started baselines.sh (fresh log) and final-study.sh (data/final.jsonl). Next: rerecord.sh, bands (harness 40 seeds), seed re-picks in tests (expert mimicFocus; bots.test Decree gate 32676; harnessTools Unpick/mawHold/Finale route/FinaleWatch; roster20 cap exception; withoutYouRise literal), suite, HANDOFF/NUMBERS.

## STOPPED FOR HAND-OVER (18 Nov, about 17:40 UTC). Branch p11/solo at `bc46e3f` (work in progress), tree clean, NOT pushed (pushing is not this step's).

Commits of round 2, oldest first: `37715f5` meter doubled (proven exact) · `d8e63ed` the second round's rules and the review's fixes (FINAL rules) · `8f88e14` all 52 baselines · `bc46e3f` WIP: the re-record + seed re-picks.

### Done (in the commits above)
- Decision 1: meter 200 / segments 50 / song 200 / Maestro 150 / fade 8; gains back to whole numbers; shares of the meter doubled; A Tempo 30. Proof: data/double.jsonl vs data/final-round1.jsonl (936 fights identical, gained exactly x2). No save holds a Resonance amount.
- Decision 2: no plain Solo roots (only a Cued Starfall roots); Lyra's lines reworded; rootHold judgement removed; Seamstress 91% (150 seeds), Frayed Threshold 94%: both in band.
- Decision 3: `ledger.plainSolos`; `soloQueue` view; `threadOn` (+1 line in src/ui/lab/mock.ts).
- Review 1 (Oro), 2 (soloDueIn nulls + bots wall rule), 3 (finish any cast first), 6 (Silent Cues 0.5 s), 7 (Hollow Crown: form only; Maestro Deed 75), 9 (Kael target check), 10 (float slack), dead cueCost key, harnessTools 1810, pre5g/golden.json trimmed, four content lines reworded, 5 (Novice beginner's hands).
- All 52 baselines rewritten on the final rules (w1/baselines.log = 52 done).
- Re-record done (w1/rerecord.log = RERECORD DONE): goldens+sync, dissonance pins, 4 command snapshots, fillInert (prettier'd), prelude, 3 key lists, pre5g refreeze, save fixtures.
- Seeds re-picked in tests: harnessTools (Finale route 2002, mawHold 8919, Unpick 40595, FinaleWatch 1000), bots.test deserter [8919, 80190], expert mimicFocus 40595; withoutYouRise literals; roster20 cap exception (kael,brann,oro).
- Final study on the final rules: data/final.jsonl (5200 rows). Novice with follow off: 71% bosses (tools/novice-follow.mts - 0 20). Bands data: data/bands2.txt (complete). Whole runs: data/runs2.txt was IN FLIGHT (killed; rerun).
- NUMBERS.md sections 7 and 8 written (current). HANDOFF.md is a round-2 DRAFT with @@STATUS@@, @@NUMBERS@@, @@CONTENTVERSION@@, @@RECORDEDNOTE@@, @@TESTS@@ still to fill.

### In flight when stopped (redo)
- The test run over W1's files after the re-record (was writing data/r2-tests2.json; killed). Rerun:
  `npx vitest run tests/sim tests/bots tests/bots.test.ts tests/fill tests/content tests/content.test.ts tests/meta tests/harnessTools.test.ts tests/weeklyBotParity.test.ts tests/withoutYouRise.test.ts tests/demo.test.ts tests/demoChoice.test.ts tests/aura --maxWorkers=2 --testTimeout=900000`
  Expect green; if a seed-dependent test fails, re-pick with /home/user/aw-work/11/solo/tools/tool-seeds3.mts (its output: data/seeds3.txt).
- Whole runs: `npx tsx /home/user/aw-work/11/solo/tools/runs-rate.mts /home/user/aw-work/wt-p11solo 2 150` and `... 4 80`.

### Not started
- Novice bands in tools/harness.ts `MOVEMENT_BANDS` (and the three literals in tests/harnessTools.test.ts: band('vharun','novice'), band('the_seamstress','novice'), band(CONDUCTOR,'novice')): set from data/bands2.txt (40 fights a cell, about 15 points either side). Bands do not touch baselines or goldens.
- typecheck + lint on the final tree; the whole suite (`/home/user/aw-work/6/full-suite.sh /home/user/aw-work/wt-p11solo /home/user/aw-work/11/solo/w1/verify/suite2.log`).
- Fill HANDOFF.md's placeholders (numbers from data/final.jsonl via `npx tsx tools/solo-study.ts --report <file> --by kind`; before-figures in data/main-ref.txt; content version = `contentVersion` in tests/sim/golden.json).

### To re-record again, if a rule changes
- `rm /home/user/aw-work/11/solo/w1/baselines.log; /home/user/aw-work/11/solo/w1/baselines.sh` (52 files, resumable) then `git add tools/*baseline*.json`.
- `rm /home/user/aw-work/11/solo/w1/rerecord.log; /home/user/aw-work/11/solo/w1/rerecord.sh` (resumable), then `npx prettier --write tests/bots/fillInert.json`.
- NOTE: the scratch folder /home/user/aw-work/11/solo is NOT in the repository; in a fresh container only the branch survives. The two scripts' commands are also in HANDOFF-round1.md section 6 text below:
  baselines: `npx tsx tools/m1-baseline.ts --movement N [--party P] --write` (N 1-4; P A B C SA SB SC OA OB OC), `npx tsx tools/expedition-baseline.ts --movements N [--party P] --write` (N 2 3 4; parties on 4).
  re-record: `npx tsx tools/update-golden.ts --write && npx tsx tools/sync-golden-pins.ts`; `rm tests/sim/dissonancePins.json && npx tsx tests/sim/recordDissonancePins.ts`; `WRITE_COMMAND_SNAPSHOT=1` / `_M3` / `_FINALE` / `_ROSTER`, `WRITE_FILL_INERT=1`, `WRITE_PRELUDE_SNAPSHOT=1`, `WRITE_TELEGRAPH_KEYS=1`, `WRITE_DAMAGE_RESULT_KEYS=1`, `WRITE_SUMMON_INERT=1` each with `npx vitest run` on its test; `AW_REFREEZE_PRE5G=1 npx vitest run tests/fill/masked.test.ts --testTimeout=900000`; `npx tsx tools/save-fixtures.ts --expect`.
