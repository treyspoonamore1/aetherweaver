#!/bin/bash
R=/home/user/aw-work/11/marks
export AW_ROOT=/home/user/aw-work/wt-p11marks AW_W=$R AW_PORT=4640
cd $R
echo "[$(date +%T)] p2 now (rest)"
timeout 1800 node scripts/p2.mjs $R/dist-after raw now 'dawn|ember|marcato|spotlight|mark|shell|glow|answer' > logs/p2-now-b.log 2>&1; echo "exit $?"
echo "[$(date +%T)] p2 prop"
timeout 2400 node scripts/p2.mjs $R/dist-prop raw prop 'pour|radiance|dawn|circlet|vow|ember|mastery|stasis|sigil|marcato|spotlight|mark' > logs/p2-prop.log 2>&1; echo "exit $?"
echo "[$(date +%T)] p2 chest"
timeout 1500 node scripts/p2.mjs $R/dist-chest raw chest 'pour|vow|shell|glow|answer' > logs/p2-chest.log 2>&1; echo "exit $?"
echo "[$(date +%T)] CHAIN2B DONE"
