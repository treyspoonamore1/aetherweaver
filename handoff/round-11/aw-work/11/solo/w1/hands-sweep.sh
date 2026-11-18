#!/bin/bash
# The hands question: the person follower with slower hands, other waits, other tells.
cd /home/user/aw-work/wt-p11solo || exit 1
D=/home/user/aw-work/11/solo/w1/data
S="npx tsx tools/solo-study.ts --seeds 12"
$S --out $D/hands.jsonl --players person-ready --reaction 0.6
$S --out $D/hands.jsonl --players person-ready --reaction 0.8
$S --out $D/hands.jsonl --players person-ready --reaction 1.0
$S --out $D/hands.jsonl --players person --tell 2
$S --out $D/hands.jsonl --players person --tell 1.5
$S --out $D/hands.jsonl --players person --tell 1
$S --out $D/hands.jsonl --players person-ready,skilled --wait 0.75
$S --out $D/hands.jsonl --players person-ready,skilled --wait 1.5
$S --out $D/hands.jsonl --players person-ready --wait 1.5 --reaction 0.8
$S --out $D/hands.jsonl --players person-ready --wait 0.75 --reaction 0.6
echo SWEEP DONE
