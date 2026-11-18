#!/bin/bash
# usage: full-suite.sh <worktree> <logfile>  — one full vitest run at a time across streams
# The log and its JSON report carry the commit the run was on, for tools/release-check.ts:
# "[evidence] commit <sha>", with " dirty" when the tree had uncommitted changes or moved
# during the run (the log's first line, and the report's "evidence" key).
wt="$1"; log="$2"
cd "$wt" || exit 2
exec 9>/home/user/aw-work/6/suite.lock
flock 9
stamp() {
  local sha; sha=$(git -C "$wt" rev-parse HEAD 2>/dev/null) || { echo "[evidence] commit unknown"; return; }
  if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then echo "[evidence] commit $sha dirty"; else echo "[evidence] commit $sha"; fi
}
before=$(stamp)
{ echo "$before"; date; npx vitest run --maxWorkers=3 --testTimeout=120000 --hookTimeout=120000 --reporter=default --reporter=json --outputFile="$log.json" 2>&1 | tail -60; echo "exit ${PIPESTATUS[0]}"; date;
  after=$(stamp)
  if [ "$after" != "$before" ]; then
    # The tree moved during the run: the evidence is not of one commit.
    evidence="${before% dirty} dirty"
    echo "$evidence"
  else
    evidence="$before"
  fi
  python3 -I - "$log.json" "$evidence" <<'PY'
import json,sys
try:
    d=json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
d['evidence']=sys.argv[2]
json.dump(d,open(sys.argv[1],'w'))
PY
  echo "FAILED TESTS:"; python3 -I - "$log.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
for f in d.get('testResults',[]):
    for t in f.get('assertionResults',[]):
        if t.get('status')=='failed':
            print(f['name'].split('/tests/')[-1], '>', t.get('fullName','')[:160])
    if f.get('status')=='failed' and not any(t.get('status')=='failed' for t in f.get('assertionResults',[])):
        print(f['name'].split('/tests/')[-1], '> (file failed to load)', (f.get('message') or '')[:200])
PY
} > "$log" 2>&1
touch "$log.done"
