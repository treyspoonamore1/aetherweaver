# W0 progress (stream SOLO, the build's first step)

Branch `p11/solo` in `/home/user/aw-work/wt-p11solo`. Read DECISION.md, then this.

- [x] A. Sim rules 1 to 6 (heroes fire, Thread decides, the gap, no Cue command, no Cue price)
- [x] B. Content changes (Conductor, A Tempo, Opening Bars, Tempo Rubato, Hollow Crown, Silent Cues)
- [x] C. Bots' Thread rule (novice, skilled, expert)
- [x] D. Minimal compile fixes outside sim/content/bots (listed in the hand-off)
- [x] E. Versions, goldens and the other recorded results
- [x] F. Unit suite, lint, typecheck
- [x] G. W0-HANDOFF.md

Notes as I go are appended below.
- A and B committed (sim + content compile; bots, UI, tools do not yet). Fight replay version literal not yet bumped.
- D committed: src and tools compile. Tests do not yet (about 40 test files reference the Cue command, its price or autonomy).
- Typecheck clean at c4b971f. Next: goldens and recorded results, then the suite's failures (first full run is in w0/suite1.log, started before the test fixes).
- Goldens, pins, frozen copies re-recorded; docs/solos.md written. Committed at f88b0b2. Next: lint, full suite (w0/suite2.log), W0-HANDOFF.md.
- Last commit 2270533 (tree clean). Typecheck and lint clean on it. Full suite running on it: w0/suite2.log (.json, .done). Whole-run check done (tools/runs-rate.mts): runs hold. W0-HANDOFF.md being drafted in this folder; when suite2 is done, classify its failures into the hand-off, then hand back.
- DONE. Final commit f74ad24, tree clean. Typecheck and lint clean. Full suite on it: w0/suite3.log, 5,374 pass, 41 fail, every one named in W0-HANDOFF.md section 5 (3 aura simVersion, 13 W1, 6 W2, 13 W3, 6 W4). Handed back.
