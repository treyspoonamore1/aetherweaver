# Solos: the join (step W6)

You join four finished branches into one, take out the seams left between them, bring the
browser tests and docs up to date, and take the result to a state that can land on main.

## Read first

1. `/home/user/aw-work/9/COMMON.md`, `/home/user/aw-work/11/COMMON.md` (house rules).
2. `/home/user/aw-work/11/AURAS-UNLOCKED.md` (the owner lifted the aura restriction; the pins are
   regression pins now).
3. `/home/user/aw-work/11/solo/DECISION.md`, then `docs/solos.md` on `p11/solo`.
4. `/home/user/aw-work/11/solo/W0-HANDOFF.md` (sections 3, 4 "W6", 5, 6).
5. The four hand-offs: `/home/user/aw-work/11/solo/w1/NUMBERS.md` and `PROGRESS.md` (W1 is still
   finishing; its `HANDOFF.md` comes later), `w2/HANDOFF.md`, `w3/HANDOFF.md`, `w4/HANDOFF.md`.
6. `docs/voice.md` for any line a player reads.

## Where

- Worktree `/home/user/aw-work/wt-p11solo-w3` (W3 has finished in it). New branch
  `p11/solo-join`, started from `p11/solo` as it stands when you begin (W1 says the rules are
  final at `8144e6b`; what it is still doing is baselines, bands and the last re-record of
  recorded results, all in its own files).
- Merge `p11/solo-w2`, `p11/solo-w3`, `p11/solo-w4` into it.
- Ports 4610 to 4619. Work files `/home/user/aw-work/11/solo/w6/`, with `PROGRESS.md` (the
  container restarts; you will be resumed) and at the end `HANDOFF.md`.
- **Do not work in `/home/user/aw-work/wt-p11solo`**: W1 is running long recordings there.

## Part 1, now (does not need W1's last results)

1. Merge the three branches; resolve what the hand-offs say meets at the join:
   - the `SOLO-JOIN` stand-ins in W2's files and their uses in W3's (`labels.ts`, `KeyHints.tsx`,
     `HowToPlay.tsx`, `CodexScreen.tsx`) come out;
   - the unused text keys both hand-offs list are deleted; the three stale lines W2 names get
     their new wording; the old-replay sentence has one home;
   - tests that quote the recap line W2 reworded (`uiPhase5e*.test.ts`, `tests/meta/roster5e.test.ts`)
     follow it;
   - W4's use of W1's `paid` flag; W2's use of `SOLOS.lead` and `SOLOS.danger`.
2. Seams that are only names (W0 hand-off, section 3, items 7 and 10): take them out where it does
   not change a save's shape; leave and list the ones that would.
3. `e2e/**`: the Conductor's test rewritten (a Duet by moving the Thread); any test that presses
   `T` or Shift+number; add one where a new player's first fight shows a Solo fire without the
   player touching anything, and one where threading the hero makes it Cued.
4. Docs: `docs/solos.md` to its final state (the rule, the numbers from `NUMBERS.md`, what
   changed in content, what happens to old replays and settings, what was measured and what was
   not); `docs/hero-autonomy.md`; a note in `docs/phase-5f.md`; `docs/phase-7.md` decisions 15
   and 16; `docs/voice.md`'s last line; the README's key tables.
5. `tools/release-check.ts`: the `RELEASE_PINS` (settings 5 and whatever W1 reports). The aura
   approval guard (`AURA_APPROVED`, `AURA_BASE`, the pin-history test) is being retired on branch
   `p11/int-a`, which will reach main before you land: do not redo that work; when main has it,
   merge main in and resolve.
6. Typecheck, lint, and the unit suite: everything green except tests that wait for W1's last
   results (baselines, fight-derived snapshots), each named.

## Part 2, when the orchestrator says W1 has handed back

7. Merge W1's final `p11/solo`. Re-record the fight-derived picture and sound snapshots (commands
   in the W0 hand-off, section 6), each compared first so that only what the new fights explain
   moves, with the reason in the commit.
8. Merge main (it will have a second menu text pass and the marks over the heroes by then).
9. `npm run build`; `tools/release-check.ts`; the whole unit suite; the whole browser suite with
   `/home/user/aw-work/7/e2e.sh <worktree> 4610 /home/user/aw-work/11/solo/w6/e2e.log`;
   `/home/user/aw-work/6/verify-land.sh <worktree> /home/user/aw-work/11/solo/w6/verify`.
10. Play it: a scripted new-player first run in the built app (Title to the end of the second
    fight) with pictures of each moment a Solo comes, fires plain, and fires Cued; the same with
    Auto-Thread on; a Conductor fight with a Duet. Into `/home/user/aw-work/11/solo/w6/shots/`.
    Say plainly what looks wrong.

Do not merge to main or push. An independent review comes after you.

Hand back after Part 1 with what is done and what waits; you will be resumed for Part 2.
Several agents share 4 CPUs: `--maxWorkers=2`, and a timeout under load is re-run alone before it
is called a failure.
