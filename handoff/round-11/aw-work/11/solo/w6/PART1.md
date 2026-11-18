# Solos, the join (W6): Part 1 hand-back

*18 November 2026 · branch `p11/solo-join` in `/home/user/aw-work/wt-p11solo-w3` · final commit `da9c99e`, tree clean · not merged to main, not pushed.*

## Where it stands

- The four branches are one. Typecheck and lint are clean on `da9c99e`.
- Unit suite, whole, on `da9c99e` (`suite1.log`): 5,493 tests, 5,468 pass, 13 fail, 10 skipped, 2 to-do. Every failure waits on a later step (below).
- The five new browser tests pass (`e2e-solos1.log`). The Conductor's rewritten browser test has not run: it is queued behind another stream's long run (`e2e-conductor1.log`).

## The merges

Six, none with a conflict: `p11/solo-w2` (a569874), `p11/solo-w3` (52fe225), `p11/solo-w4` (621cd5a), and `p11/solo` three more times as it moved (76702cd baselines, 71ee07c final re-record, 9b3d702 the Novice's bands). The branch began at `p11/solo` accbe3a.

## What came out

- The three `SOLO-JOIN` stand-ins (the hidden `cue` action, `cueModifier` on the input settings, `isModifierToken`) and their last readers (`cueModifierMark`, the modifier branch of `inputLabel`).
- 16 unused text keys (the list both hand-offs gave) and the `held` set in `tests/uiSolos.test.ts`.
- Auto-Thread's own copies of the lead and the danger line: it reads `SOLOS.lead` and `SOLOS.danger`.
- The sound's copy of A Tempo's rule (`tempoPays`): it reads the event's `paid` flag.
- Four copies of "a full Solo with no one to fight is not coming" (frames, beat strip, mark, Auto-Thread): `soloDueIn` says it now.
- Two dead event fields: `cueChained.cost` (always 0) and `resonanceSpent.on` (only ever 'crescendo'). Events are not hashed or saved.
- The screens' second copy of the old-replay sentence (`screens.atlasModel.replayTooOld`, `replayMessage`). The sentence lives once, in `src/sim/replay.ts`, in the HUD step's wording. Reason: the sim cannot read the screens' text, the tools print it too, and every other answer of a replay check is shown as the check's own message. The other way round (keep the text key, give the sim a tool-only message) is the alternative.

## What stayed, and why

- `freeCues` and `saved` in the fight tally: hashed (every Conductor fight's hash would move) and saved with the run (the run save's shape would move).
- The two aura-guard tests in `tests/releaseTools.test.ts`: the guard is retired on `p11/int-a`.
- W0's seam 10 (the labs' `autonomy: true`) was already gone on the HUD branch.

## Recorded results re-recorded

`tests/uiPhase5e.brann.json`, 12 of 76 keys (`needs`, 11 `frames:brann-*`), and the Codex heroes page's hash in `tests/uiPhase5e.test.ts`. Every pinned value and the page were dumped on the HUD branch and on the join and compared piece by piece: two sentences differ and nothing else, both Brann's, reworded in the content by the tuning step (his needs line's end, and a full stop for a dash in his Cued line). Nothing else was re-recorded.

## Failing unit tests (13)

- Fight-derived sound snapshots, 11, re-recorded in Part 2: `audioPhase5` 3 (first_light, bellwarden, hollow_cantor), `audioPhase5c` 1, `audioRiftSnapshot` 2 (mirror_hall, the_seamstress), `audioSpireSnapshot` 5 (first_light, bellwarden, hollow_cantor, crimson_gate, gorehound_matriarch).
- `releaseTools` 2: "at HEAD, the eight aura files…are as at the base", "the owner-approved aura changes are whole commits…". Expected until main has the guard's retirement.
- The two picture snapshots (`renderSpireSnapshot`, `renderRiftSnapshot`) pass: they record how arenas and models are drawn and play no fight.

## Browser tests

- New, `e2e/solos.spec.ts`, 5 tests, all pass on `da9c99e` in 9.5 minutes.
- Rewritten, `e2e/smoke.spec.ts` "Phase 5f: the Conductor…": not yet run in a browser. Its way of following Solos was tried in Node first (`scripts/follow.mts`): a Duet in 9 of 10 fights.
- The rest of the browser suite was not run (Part 2).
- New in the test hook: `window.__AW__.solos()`, read-only.

## Found on the way

- A first fight nobody touches at all (`scripts/noinput.mts`): the Solos fire once, at about 31 s, plain; on 2 of 6 seeds the party falls before the fight is won, because nobody is healed. That was so before the rework too.
- After one Solo fires, the two heroes still waiting both show the same seconds (the gap's), and one of them then jumps a second. The HUD step asked the tuning step for an order inside `soloDueIn`; it was not done. Changing it would change what the bots do, so it was not done here either.
- No count of plain Solos in the fight's tallies (the HUD step asked): the Result says "7 Solos Cued", not "7 of 9".
- The Requiem decree's two forms now differ in punctuation (a colon with the dome, a dash without). Content is the tuning step's.
- When the rework lands on main, a settings-5 save fixture is owed (the input step's item 6).

## Not checked

- The Conductor's browser test, and every browser test but the five new ones.
- `npm run build`, `tools/release-check.ts`, `verify-land.sh`.
- Nobody has played it or listened to it.
- W1's `HANDOFF.md` still had two unfilled places when this was written; `docs/solos.md` takes its numbers from `NUMBERS.md`, W0's tables and W1's progress notes.
