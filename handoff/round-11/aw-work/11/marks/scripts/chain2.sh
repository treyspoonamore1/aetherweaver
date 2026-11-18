#!/bin/bash
# chain2.sh: the proposals' builds and pictures, one job at a time.
R=/home/user/aw-work/11/marks; P=$R/wt-prop
export AW_ROOT=/home/user/aw-work/wt-p11marks AW_W=$R AW_PORT=4640
cd $P || exit 1
echo "[$(date +%T)] typecheck + build chest (tip $(git rev-parse --short HEAD) + chest edits)"
npx tsc -p tsconfig.app.json --noEmit > $R/logs/tsc-chest.log 2>&1; echo "tsc exit $?"
npx vite build --outDir $R/dist-chest --emptyOutDir > $R/logs/build-chest.log 2>&1 || { echo build chest failed; exit 1; }
git stash -q
echo "[$(date +%T)] build prop (tip $(git rev-parse --short HEAD), clean: $(git status --porcelain | wc -l))"
npx vite build --outDir $R/dist-prop --emptyOutDir > $R/logs/build-prop.log 2>&1 || { echo build prop failed; git stash pop -q; exit 1; }
git rev-parse HEAD > $R/dist-prop/COMMIT
git stash pop -q
cd $R
echo "[$(date +%T)] p2 now"
timeout 3000 node scripts/p2.mjs $R/dist-after raw now "${1:--}" > logs/p2-now.log 2>&1; echo "exit $?"
echo "[$(date +%T)] p2 prop"
timeout 3000 node scripts/p2.mjs $R/dist-prop raw prop "${1:--}" > logs/p2-prop.log 2>&1; echo "exit $?"
echo "[$(date +%T)] p2 chest"
timeout 2000 node scripts/p2.mjs $R/dist-chest raw chest 'pour|vow|shell|glow|answer' > logs/p2-chest.log 2>&1; echo "exit $?"
echo "[$(date +%T)] CHAIN2 DONE"
