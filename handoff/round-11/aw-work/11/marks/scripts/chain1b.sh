#!/bin/bash
R=/home/user/aw-work/11/marks; WT=/home/user/aw-work/wt-p11marks
export AW_ROOT=$WT AW_W=$R AW_PORT=4640
cd $R
echo "[$(date +%T)] p1 before seren|oro"
timeout 1500 node scripts/p1.mjs $R/dist-before raw before 'seren|oro' > logs/p1-before-b.log 2>&1; echo "exit $?"
echo "[$(date +%T)] p1 after"
timeout 2400 node scripts/p1.mjs $R/dist-after raw after - > logs/p1-after.log 2>&1; echo "exit $?"
echo "[$(date +%T)] CHAIN1B DONE"
