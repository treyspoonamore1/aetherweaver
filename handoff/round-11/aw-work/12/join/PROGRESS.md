# Round 12 join progress
Worktree /home/user/aw-work/wt-p11solo-w3, branch p11/solo-join, started at 861c5f2. Ports 4610-4619.
Brief: BRIEF.md here. Never touch /home/user/aw-work/wt-p11solo.

## Steps
- [x] 1 merge p11/solo 8e7f950; RELEASE_PINS.contentVersion
- [x] 2 merge main 6c345ad (5 conflicts; Brann pin)
- [ ] 3 typecheck, lint, full suite (suite1.log); sound snapshots
- [ ] 4 build, release-check
- [ ] 5 verify-land + e2e on the landing commit
- [ ] 6 play it, shots/, sheets
- [ ] 7 DOC-TABLES.md (waits for orchestrator)
- [ ] 8 DEMO-V21.md

## Notes
- step1 done: 8c2d8e4 (merge p11/solo + contentVersion c-7781374df5775748)
- cmp worktrees at join/cmp/ours (8c2d8e4) and join/cmp/main (6c345ad): REMOVE with git worktree remove when done. tests/zzDump.test.ts copied into wt: REMOVE before commit
- step2 done: 130c027 (merge main; Brann pin 12 keys + codex hash). typecheck clean (tc2.log)
- cmp worktrees removed (dumps kept in join/cmp/*.json)
- suite1 started at 130c027 (pid 3670): keep tree still until suite1.log has FAILED TESTS / exit
- play scripts written: join/scripts/{lib,play-a,play-b,play-c}.mjs (untested; run after e2e, preview port 4611)
- 21:1x DOC-TABLES.md arrived (orchestrator): paste before final verify/e2e
- 78da8fa-amended: dissonance pins + b16 expected re-recorded (compared). suite1: 18 fail = 11 sound + 6 dpins + 1 saveMatrix
- 836ff3a sound snapshots; 6c1af0c docs step 7 done (DOC-TABLES pasted + known note)
- step4: build ok, release-check quick rows green (versions). 21:3x verify-land started on 6c1af0c (join/verify); then e2e. TREE STILL.
- verify-land CLEAN on 6c1af0c (5498 pass). e2e started 21:36 (e2e.log, port 4610)
- e2e full on 6c1af0c: 70 pass, 4 skip, 3 fail (Conductor Duet: fight won at 0:32 with 1 Cued; 2 solos.spec Settings tab = merge). Spec fix committed da7f7c9. Running solos.spec + Conductor alone (e2e-alone1.log)
- Conductor e2e failed alone too (e2e-alone1.log); cause: test followed soloDueIn. Fix 8f17fe2 (turnIn in hook). Next: Conductor alone again, then main control on 4620, then full verify+e2e on final commit
- play: preview server on 4611 serving dist of 8f17fe2 (pid above in PROGRESS: kill by pid)
- 23:35 Conductor e2e PASSES at 8f17fe2 alone (e2e-conductor2.log); main control passes too (e2e-main-conductor.log, main's old test). 
  Play scripts iterating (play-a.log). Freeze holds rAF time + CSS anims. Callouts not caught by my watcher in run fights (Training dbg shows them) - investigating.
  STILL TO DO: final verify-land + full e2e on final commit (8f17fe2 or later); sheets; DEMO-V21 'what we know is off'; handback.
- 00:20 container restart. orchestrator pushed 8f17fe2. Resumed 00:3x: preview restarted on 4611 (dist of 8f17fe2).
  play-a done (a*.png; a124 lacks the Cued callout -> maybe rerun). play-b done to fight 2 (b*.png; fight 1: Thread stuck on hurt Kael, Lyra+Vexis plain).
  Next: play-c, sheets, DEMO-V21 known-off, then verify2 + e2e2.log on final commit.
- 00:27 play done, sheets made (shots/sheet1*, sheet2*). preview killed. verify2 started on 8f17fe2; then e2e2.log. TREE STILL.
- DEMO-V21.md done (step 8)
- verify2 CLEAN on 8f17fe2. e2e2.log started 00:42
