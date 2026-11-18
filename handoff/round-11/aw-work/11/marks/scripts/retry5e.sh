#!/bin/bash
# retry5e.sh: the one long fight test again, when the machine is quieter (it needs about 5 minutes
# of an 8-minute limit on a quiet machine). Up to three tries; stops at the first pass.
R=/home/user/aw-work/11/marks
for n in 3 4 5; do
  for i in $(seq 1 80); do
    l=$(cut -d' ' -f1 /proc/loadavg); [ "${l%.*}" -lt 9 ] && break; sleep 30
  done
  echo "[$(date +%T)] try $n at load $(cut -d' ' -f1-3 /proc/loadavg)"
  /home/user/aw-work/7/e2e.sh /home/user/aw-work/wt-p11marks 4650 $R/e2e-rerun$n.log e2e/smoke.spec.ts -g "Phase 5e: the roster of six"
  echo "[$(date +%T)] try $n exit $(cat $R/e2e-rerun$n.log.done) at load $(cut -d' ' -f1-3 /proc/loadavg)"
  [ "$(cat $R/e2e-rerun$n.log.done)" = "0" ] && break
done
echo RETRY DONE
