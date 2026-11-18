#!/bin/bash
# Round 2: holding a Solo during a cast; which Solos root.
cd /home/user/aw-work/wt-p11solo || exit 1
D=/home/user/aw-work/11/solo/w1/data
S="npx tsx tools/solo-study.ts --seeds 20 --players skilled,novice,person-ready"
$S --out $D/r2-cast.jsonl --label cast0
$S --out $D/r2-cast.jsonl --label cast1 --cast-hold 1
$S --out $D/r2-cast.jsonl --label cast2 --cast-hold 2
for r in 1 2 3; do $S --out $D/r2-roots.jsonl --label roots$r --roots $r --cast-hold 1; done
F="npx tsx tools/solo-study.ts --seeds 60 --players skilled,novice,person-ready --fights frayed_threshold,the_seamstress"
for r in 0 1 2 3; do $F --out $D/r2-roots-m3.jsonl --label roots$r --roots $r --cast-hold 1; done
H="npx tsx tools/solo-study.ts --seeds 20 --players skilled,novice,person-ready --solos hawks_vigil"
for r in 0 1; do $H --out $D/r2-hawk.jsonl --label hawk-roots$r --roots $r --cast-hold 1; done
echo SWEEP DONE
