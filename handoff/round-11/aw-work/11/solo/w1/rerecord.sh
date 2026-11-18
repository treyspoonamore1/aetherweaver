#!/bin/bash
# The one final re-record of every recorded result that plays a fight (not pictures or sounds).
# A line in the log per step done; rerun to resume.
cd /home/user/aw-work/wt-p11solo || exit 1
LOG=/home/user/aw-work/11/solo/w1/rerecord.log
OUT=/home/user/aw-work/11/solo/w1/rerecord-last.out
touch $LOG
V="npx vitest run --maxWorkers=2 --testTimeout=900000"
step() { # name, command (a string, run by bash -c)
  local name="$1"; shift
  if grep -qx "done $name" $LOG; then return; fi
  if bash -c "$1" > $OUT 2>&1; then echo "done $name" >> $LOG; else echo "FAILED $name" >> $LOG; tail -8 $OUT >> $LOG; fi
}
step goldens "npx tsx tools/update-golden.ts --write && npx tsx tools/sync-golden-pins.ts"
step dissonance "rm -f tests/sim/dissonancePins.json && npx tsx tests/sim/recordDissonancePins.ts"
step commands "WRITE_COMMAND_SNAPSHOT=1 $V tests/bots/commandSnapshot.test.ts"
step commandsM3 "WRITE_COMMAND_SNAPSHOT_M3=1 $V tests/bots/commandSnapshotM3.test.ts"
step commandsFinale "WRITE_COMMAND_SNAPSHOT_FINALE=1 $V tests/bots/commandSnapshotFinale.test.ts"
step commandsRoster "WRITE_COMMAND_SNAPSHOT_ROSTER=1 $V tests/bots/commandSnapshotRoster.test.ts"
step fillInert "WRITE_FILL_INERT=1 $V tests/bots/fillInert.test.ts"
step prelude "WRITE_PRELUDE_SNAPSHOT=1 $V tests/meta/preludeSnapshot.test.ts"
step telegraphKeys "WRITE_TELEGRAPH_KEYS=1 $V tests/sim/telegraphKeys.test.ts"
step damageKeys "WRITE_DAMAGE_RESULT_KEYS=1 $V tests/sim/damageResultKeys.test.ts"
step summonInert "WRITE_SUMMON_INERT=1 $V tests/sim/summonInert.test.ts"
step pre5g "AW_REFREEZE_PRE5G=1 $V tests/fill/masked.test.ts"
step saves "npx tsx tools/save-fixtures.ts --expect"
echo "RERECORD DONE" >> $LOG
