#!/bin/bash
# After the judgement: the Frayed Threshold, and every Calling again.
cd /home/user/aw-work/wt-p11solo || exit 1
D=/home/user/aw-work/11/solo/w1/data
npx tsx tools/solo-study.ts --seeds 40 --fights frayed_threshold --players skilled,novice,person-ready,ignore --out $D/frayed.jsonl --label judged
S="npx tsx tools/solo-study.ts --seeds 20 --out $D/callings2.jsonl"
$S --label none
for c in luminary martyr chronomancer; do $S --label $c --calling $c; done
$S --label condA --calling conductor --path marcato,reprise,ensemble,triad
$S --label condB --calling conductor --path a_tempo,upbeat,spotlight,maestro
echo SWEEP DONE
