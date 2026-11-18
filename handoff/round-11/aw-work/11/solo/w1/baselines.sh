#!/bin/bash
# Writes every baseline in tools/ again, one at a time; a line in the log per file done, so a
# restart can skip them: rerun this script.
cd /home/user/aw-work/wt-p11solo || exit 1
LOG=/home/user/aw-work/11/solo/w1/baselines.log
touch $LOG
run() { # name, command...
  local name="$1"; shift
  if grep -qx "done $name" $LOG; then return; fi
  if "$@" > /home/user/aw-work/11/solo/w1/baseline-last.out 2>&1; then echo "done $name" >> $LOG; else echo "FAILED $name" >> $LOG; tail -5 /home/user/aw-work/11/solo/w1/baseline-last.out >> $LOG; fi
}
for m in 1 2 3 4; do
  run "m$m" npx tsx tools/m1-baseline.ts --movement $m --write
  for p in A B C SA SB SC OA OB OC; do
    [ -f tools/m$m-baseline-$p.json ] && run "m$m-$p" npx tsx tools/m1-baseline.ts --movement $m --party $p --write
  done
done
run "exp2" npx tsx tools/expedition-baseline.ts --movements 2 --write
run "exp3" npx tsx tools/expedition-baseline.ts --movements 3 --write
run "exp4" npx tsx tools/expedition-baseline.ts --movements 4 --write
for p in A B C SA SB SC OA OB OC; do
  [ -f tools/expedition4-baseline-$p.json ] && run "exp4-$p" npx tsx tools/expedition-baseline.ts --movements 4 --party $p --write
done
echo "ALL DONE" >> $LOG
