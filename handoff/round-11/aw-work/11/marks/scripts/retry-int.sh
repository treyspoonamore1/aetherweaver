#!/bin/bash
# retry-int.sh: each test that timed out or ran over budget under load, alone, when the machine is
# quieter. Up to three tries each; stops a test at its first pass.
R=/home/user/aw-work/11/marks
run() { # <tag> <grep>
  for n in 1 2 3; do
    for i in $(seq 1 60); do l=$(cut -d' ' -f1 /proc/loadavg); [ "${l%.*}" -lt 8 ] && break; sleep 30; done
    echo "[$(date +%T)] $1 try $n at load $(cut -d' ' -f1-3 /proc/loadavg)"
    /home/user/aw-work/7/e2e.sh /home/user/aw-work/wt-p11marks 4650 $R/e2e-int-$1-$n.log e2e/smoke.spec.ts -g "$2"
    echo "[$(date +%T)] $1 try $n exit $(cat $R/e2e-int-$1-$n.log.done) at load $(cut -d' ' -f1-3 /proc/loadavg)"
    [ "$(cat $R/e2e-int-$1-$n.log.done)" = "0" ] && return 0
  done
  return 1
}
run perf "perf: a busy fight stays inside"
run roster "Phase 5e: the roster of six"
echo RETRY DONE
