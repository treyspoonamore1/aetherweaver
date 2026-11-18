#!/bin/bash
R=/home/user/aw-work/11/marks; WT=/home/user/aw-work/wt-p11marks
export AW_ROOT=$WT AW_W=$R AW_PORT=4640
cd $R
for tag in before after; do
  echo "[$(date +%T)] p1 $tag close"
  timeout 1500 node scripts/p1.mjs $R/dist-$tag raw $tag "${1:--}" close > logs/p1-$tag-close.log 2>&1; echo "exit $?"
done
echo "[$(date +%T)] CHAIN1C DONE"
