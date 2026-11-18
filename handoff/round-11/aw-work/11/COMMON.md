# Round 11: common rules for every stream

Read `/home/user/aw-work/9/COMMON.md` first: every rule there still holds (own worktree, commit
trailers, no model or tool names anywhere, no push or merge, 4 shared CPUs, software rendering,
pictures at 1280 x 720 with deviceScaleFactor 2 and opened by you, the report format, plain
language for an owner who is not a programmer). What is different now:

- Main is at `08d8b42`. Since that file was written, three things landed: common enemies have a red
  outline; boss fights have a framing camera and the HUD has a notes column at the top right; the
  Codex has portraits and the map shows reward pills. Demo Version 19. `docs/phase-8.md` records
  it all.
- **Auras and ornaments are the owner's**, as before. One change since: the owner approved five
  mark placements, and `tools/release-check.ts` now has `AURA_APPROVED` naming the one commit that
  re-recorded 90 entries of `tests/aura/presentationPin.json`. You never add to that list and
  never edit either aura pin file. `tests/releaseTools.test.ts` checks it.
- About 12 GB of disk is free. Keep one build folder and clean up after yourself.
- The container has restarted several times mid-work. Commit often. Run long jobs in pieces that
  write results as they go, so a restart loses little. If you are resumed after a restart, every
  background process you started is dead: check what finished and restart only the rest.
- Two other streams run beside you. They are: the Solo redesign (`p11/solo`: `src/sim`, bots, HUD
  and any text about Solos, Cues and hero autonomy), the menu text pass (`p11/menu`: `src/ui/text`
  and menu screens), and the remaining marks over the heroes (`p11/marks`: `src/render`). Stay out
  of the other two streams' areas; where your work needs something in theirs, say so in your report
  instead of doing it.
