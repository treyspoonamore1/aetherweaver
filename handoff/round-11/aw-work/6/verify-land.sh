#!/bin/bash
# usage: verify-land.sh <worktree> <outdir>
wt="$1"; out="$2"; mkdir -p "$out"; cd "$wt" || exit 2
rm -f "$out/done"
{ npm run typecheck > "$out/tc.log" 2>&1; echo "tc exit $?";
  npm run lint > "$out/lint.log" 2>&1; echo "lint exit $?";
  npx tsx tools/update-golden.ts > "$out/golden.log" 2>&1; echo "golden: $(tail -1 "$out/golden.log")";
  : > "$out/checks.log"
  for m in 1 2 3 4; do npx tsx tools/m1-baseline.ts --movement $m --check >> "$out/checks.log" 2>&1; echo "m$m exit $?"; done
  for m in 2 3 4; do npx tsx tools/expedition-baseline.ts --movements $m --check >> "$out/checks.log" 2>&1; echo "exp$m exit $?"; done
  for p in A SB OC; do npx tsx tools/m1-baseline.ts --movement 4 --party $p --check >> "$out/checks.log" 2>&1; echo "m4-$p exit $?"; npx tsx tools/expedition-baseline.ts --movements 4 --party $p --check >> "$out/checks.log" 2>&1; echo "exp4-$p exit $?"; done
  /home/user/aw-work/6/full-suite.sh "$wt" "$out/full.log"; grep -E "Test Files|Tests |^exit" "$out/full.log"; sed -n '/^FAILED TESTS:/,$p' "$out/full.log" | head -20
} > "$out/summary.log" 2>&1
touch "$out/done"
