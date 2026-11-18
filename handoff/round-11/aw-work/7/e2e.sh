#!/bin/bash
# e2e.sh <worktree> <port> <log> [playwright args, e.g. e2e/input.spec.ts -g "pad"]
# Builds the worktree and runs the named browser tests against it. Queues behind any other e2e run
# (one at a time on this machine). Writes <log> and, when finished, <log>.done holding the exit code.
# The log carries the commit it ran on, for tools/release-check.ts: "[evidence] commit <sha>" on
# its first line once the queue is passed (" dirty" when the tree had uncommitted changes), and
# again at the end, marked dirty, if the tree moved during the run.
WT="$1"; PORT="$2"; LOG="$3"; shift 3
HERE="/home/user/aw-work/7/e2e-scratch/$PORT"
mkdir -p "$HERE"; rm -f "$LOG.done"
stamp() {
  local sha; sha=$(git -C "$WT" rev-parse HEAD 2>/dev/null) || { echo "[evidence] commit unknown"; return; }
  if [ -n "$(git -C "$WT" status --porcelain 2>/dev/null)" ]; then echo "[evidence] commit $sha dirty"; else echo "[evidence] commit $sha"; fi
}
(
  flock 9
  cd "$WT" || exit 97
  before=$(stamp)
  echo "$before"
  PW_ROOT="$WT" PW_PORT="$PORT" PW_HERE="$HERE" \
    npx playwright test -c /home/user/aw-work/7/pw.config.ts --trace off "$@"
  code=$?
  after=$(stamp)
  [ "$after" != "$before" ] && echo "${before% dirty} dirty"
  exit $code
) 9>/home/user/aw-work/7/e2e.lock >"$LOG" 2>&1
echo $? > "$LOG.done"
