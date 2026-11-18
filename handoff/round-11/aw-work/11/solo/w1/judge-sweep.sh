#!/bin/bash
# Hero judgement: each piece alone against none, and all four together.
cd /home/user/aw-work/wt-p11solo || exit 1
D=/home/user/aw-work/11/solo/w1/data
S="npx tsx tools/solo-study.ts --seeds 20 --players skilled,novice,person-ready --out $D/judge.jsonl"
OFF="--party-hit 0 --root-hold 0 --last-enemy 0 --spare 0"
$S --label none $OFF
$S --label partyHit --root-hold 0 --last-enemy 0 --spare 0
$S --label rootHold --party-hit 0 --last-enemy 0 --spare 0
$S --label lastEnemy --party-hit 0 --root-hold 0 --spare 0
$S --label spare --party-hit 0 --root-hold 0 --last-enemy 0
$S --label all
echo SWEEP DONE
