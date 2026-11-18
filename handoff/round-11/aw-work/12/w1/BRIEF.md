# Brief: W1's final numbers for the Solo rework (measurement and writing only)

Read `/home/user/aw-work/12/COMMON.md` first.

## Where things are

- The Solo rework (design A, "your Thread is the Cue") is explained in
  `/home/user/aw-work/11/solo/DESIGN.md` and `DECISION.md`; the doc as built is `docs/solos.md`
  on branch `p11/solo-join`.
- Your worktree: `/home/user/aw-work/wt-p11solo`, branch `p11/solo`, at `8e7f950`. The rules are
  **final**; every recorded result was re-recorded on them (`bc46e3f`), the Novice's bands were set
  (`08d69db`), and the aura pin fixture was fixed to fill the 200-deep meter (`8e7f950`).
- W1's notes: `/home/user/aw-work/11/solo/w1/PROGRESS.md` (read "ROUND 2" and "STOPPED FOR
  HAND-OVER"), `w1/NUMBERS.md` (sections 7 and 8 are current; section 2 is replaced by 7), and
  `w1/HANDOFF.md`, a round-2 draft with placeholders `@@STATUS@@`, `@@NUMBERS@@`,
  `@@CONTENTVERSION@@`, `@@RECORDEDNOTE@@`, `@@TESTS@@`.
- **All of W1's measured data (`w1/data/`) was lost with the old container.** Only scripts and
  text survived. The study must be run again.

## What to do

1. Re-run the final study on `8e7f950`: `/home/user/aw-work/11/solo/w1/final-study.sh` (create
   `w1/data/` first; it is resumable). Run it under `nice -n 10`, one process at a time: the join
   agent is running the unit suite beside you. Summaries with
   `npx tsx tools/solo-study.ts --report <file> --by kind` (look at the tool for other `--by`
   options).
2. The Novice with follow off (`/home/user/aw-work/11/solo/tools/novice-follow.mts`, as in
   PROGRESS) and whole-run win rates (`/home/user/aw-work/11/solo/tools/runs-rate.mts
   /home/user/aw-work/wt-p11solo 2 150` and `... 4 80`). If a whole-run measurement would take
   more than about 90 minutes, cut the run count and say so.
3. "Before" figures (main, before the rework): main's fights have not changed since round 1, so the
   before columns in the round-1 tables of `docs/solos.md` (`git show p11/solo-join:docs/solos.md`)
   and W1's NUMBERS.md stand. Do not re-measure main unless a figure you need is missing.
4. Fill every placeholder of `w1/HANDOFF.md` (content version: `contentVersion` in
   `tests/sim/golden.json`). Status should say plainly what is verified and on which commit.
5. Write `/home/user/aw-work/12/w1/DOC-TABLES.md`: replacement text, ready to paste, for every
   table or number in `docs/solos.md` (as on `p11/solo-join`) that still holds round-1 figures,
   in the same shape, each with the line of the doc it replaces. Also the Novice sentences for
   `docs/phase-5a.md`, `phase-5c.md`, `phase-5d.md` if they quote her bands (check). The join
   agent will paste these; you do not edit `p11/solo-join`.
6. Things the owner will be told, so measure them exactly: the Skilled bot's boss-fight win rate,
   time and downs, before and after; the Novice's (Cued share, wins); a never-following player;
   the "person" model's Cued share; the two Movement III fights where the Skilled bot lost a
   little ground (name them, with numbers); each Calling, Silent Cues, Conductor paths A and B.

## Rules for this step

- **No rule, content, bot or tool change.** Measurement and writing only. If a number looks wrong
  or a fight is out of band, report it; do not tune. If you must commit something (for example a
  fix to a tool's crash), commit it on `p11/solo` alone, with the reason, and say so.
- Keep `/home/user/aw-work/12/w1/PROGRESS.md` as you go.

## Finish line

`final.jsonl` complete; the extra measurements done or cut with the reason; `HANDOFF.md` has no
placeholder left; `DOC-TABLES.md` written. Hand back with the headline numbers in a short table,
anything out of band, and the commit (if any).
