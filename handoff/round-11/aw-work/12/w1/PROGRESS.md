# Round 12, W1 measurement: progress

Worktree /home/user/aw-work/wt-p11solo (p11/solo @ 8e7f950). Measurement and writing only.
Data: /home/user/aw-work/11/solo/w1/data/ (was lost; re-run from scratch here).

- [x] 1. final study (DONE 21:00, 5200 rows; report final-report-kind.txt, per hero final-analysis.txt) (final-study.sh -> data/final.jsonl; log data/final-study.log; resumable: re-run the script)
- [x] 2a. Novice with follow off (novice-follow.mts)
- [x] 2b. whole runs 2x150, 4x80 (runs-rate.mts)
- [x] 4. HANDOFF.md placeholders
- [x] 5. DOC-TABLES.md
- [x] 6. owner numbers

Notes:
- 20:55 started final-study.sh (nice 10), pid in final-study.pid.
- extras.sh (waits for final.done, then: hands rows person-ready reaction 0.6/0.8/1 -> data/hands-final.jsonl; novice-follow0.txt; pilot timings runs-2-5.txt, runs-4-4.txt). Then launch the real whole runs by hand (runs-rate 2 150 / 4 80, cut if > 90 min), outputs data/runs-<M>-<N>.txt.
- If restarted: re-run final-study.sh then extras.sh (both resumable / skip done).
- Before figures: docs/solos.md round-1 tables on p11/solo-join + NUMBERS.md (main-ref.txt was lost).
- m3.sh queued after pilot: harness M3 frayed_threshold + seamstress, 150 seeds, novice+skilled -> data/m3-two.txt
- 21:03 hands rows done (hands-final.jsonl), novice-follow0.txt done (71% bosses, 178 s, 24% Cued). Pilots: whole runs are fast (10 runs in 8 s): no cut needed.
- runs.sh queued after m3: person-ready --wait 0.75/1.5 (hands-final.jsonl), then runs-2-150.txt, runs-4-80.txt; writes RUNS DONE to data/extras.log.
- 21:08 ALL MEASURING DONE: m3-two.txt (Frayed Skilled 94%, Seamstress 91%, 150 seeds), runs-2-150 (Sk 76 / Nov 31), runs-4-80 (Sk 73 / Nov 1), waits 0.75/1.5 in hands-final.jsonl. Draft HANDOFF backed up to 12/w1/HANDOFF.draft-before-fill.md. Next: fill HANDOFF, write DOC-TABLES.
- 21:12 HANDOFF.md filled (no @@ left); pieces in 12/w1/fill/. Next DOC-TABLES.
- 21:20 DOC-TABLES.md written. HANDOFF filled. Worktree untouched, nothing committed. DONE; handing back.
