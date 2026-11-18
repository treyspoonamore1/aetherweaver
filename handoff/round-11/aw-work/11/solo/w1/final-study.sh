#!/bin/bash
# The final numbers, on the final rules. Resumable: done cells are skipped.
cd /home/user/aw-work/wt-p11solo || exit 1
D=/home/user/aw-work/11/solo/w1/data
S="npx tsx tools/solo-study.ts --seeds 20 --out $D/final.jsonl"
$S --label none --players skilled,novice,person,person-ready,ignore
for c in luminary martyr chronomancer; do $S --label $c --calling $c; done
$S --label condA --calling conductor --path marcato,reprise,ensemble,triad --players skilled,novice,person-ready
$S --label condB --calling conductor --path a_tempo,upbeat,spotlight,maestro --players skilled,novice,person-ready
$S --label silent --dissonance silent_cues --players skilled,novice,person-ready
echo FINAL DONE >> $D/final.done
