#!/bin/bash
# The Resonance scale: results at 0.4, 0.5 (as built) and 0.6, a player who sings every full song, and each Calling.
cd /home/user/aw-work/wt-p11solo || exit 1
D=/home/user/aw-work/11/solo/w1/data
S="npx tsx tools/solo-study.ts --seeds 20"
$S --out $D/gain.jsonl --label s0.5
$S --out $D/gain.jsonl --label s0.4 --gain-scale 0.4
$S --out $D/gain.jsonl --label s0.6 --gain-scale 0.6
$S --out $D/gain.jsonl --label eager0.5 --players skilled --eager
$S --out $D/gain.jsonl --label eager0.4 --players skilled --eager --gain-scale 0.4
$S --out $D/gain.jsonl --label eager0.6 --players skilled --eager --gain-scale 0.6
for c in luminary martyr chronomancer; do
  $S --out $D/callings.jsonl --label $c --calling $c
  $S --out $D/callings.jsonl --label $c-eager --calling $c --players skilled --eager
done
$S --out $D/callings.jsonl --label condA --calling conductor --path marcato,reprise,ensemble,triad
$S --out $D/callings.jsonl --label condB --calling conductor --path a_tempo,upbeat,spotlight,maestro
echo SWEEP DONE
