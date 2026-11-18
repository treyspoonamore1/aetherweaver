#!/bin/bash
# chain1.sh: the "after" build, then the Part 1 pictures on both builds, one job at a time.
R=/home/user/aw-work/11/marks; WT=/home/user/aw-work/wt-p11marks
export AW_ROOT=$WT AW_W=$R AW_PORT=4640
cd $WT || exit 1
echo "[$(date +%T)] build after ($(git rev-parse --short HEAD))"
npx vite build --outDir $R/dist-after --emptyOutDir > $R/logs/build-after.log 2>&1 || { echo build failed; exit 1; }
git rev-parse HEAD > $R/dist-after/COMMIT
cd $R
for tag in before after; do
  echo "[$(date +%T)] p1 $tag"
  timeout 2400 node scripts/p1.mjs $R/dist-$tag raw $tag "${1:--}" > logs/p1-$tag.log 2>&1
  echo "[$(date +%T)] p1 $tag exit $?"
done
echo "[$(date +%T)] CHAIN1 DONE"
