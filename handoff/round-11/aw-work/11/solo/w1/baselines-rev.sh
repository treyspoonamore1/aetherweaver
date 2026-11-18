#!/bin/bash
# The same baselines as baselines.sh, from the far end, so two run at once; skips what is done.
cd /home/user/aw-work/wt-p11solo || exit 1
LOG=/home/user/aw-work/11/solo/w1/baselines.log
touch $LOG
run() {
  local name="$1"; shift
  if grep -qx "done $name" $LOG; then return; fi
  if "$@" > /home/user/aw-work/11/solo/w1/baseline-last2.out 2>&1; then echo "done $name" >> $LOG; else echo "FAILED $name" >> $LOG; tail -5 /home/user/aw-work/11/solo/w1/baseline-last2.out >> $LOG; fi
}
for p in OC OB OA SC SB SA C B A; do
  [ -f tools/expedition4-baseline-$p.json ] && run "exp4-$p" npx tsx tools/expedition-baseline.ts --movements 4 --party $p --write
done
run "exp4" npx tsx tools/expedition-baseline.ts --movements 4 --write
run "exp3" npx tsx tools/expedition-baseline.ts --movements 3 --write
run "exp2" npx tsx tools/expedition-baseline.ts --movements 2 --write
for m in 4 3 2 1; do
  for p in OC OB OA SC SB SA C B A; do
    [ -f tools/m$m-baseline-$p.json ] && run "m$m-$p" npx tsx tools/m1-baseline.ts --movement $m --party $p --write
  done
  run "m$m" npx tsx tools/m1-baseline.ts --movement $m --write
done
echo "REV DONE" >> $LOG
