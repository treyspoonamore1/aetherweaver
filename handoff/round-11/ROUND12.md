# Round 12: what the next session found and did (read after STATE.md)

Session https://claude.ai/code/session_01Ufyqn2mkV4tgoiGTmeGECM, 18 November 2026, from about 20:40 UTC.

## Found on arrival

- **Item 1 of the prompt was already done** by a session between round 11 and this one
  (session_01Ufyqmyir2VFt1fLowtesK7), which left no note: on main, `ab55d73` (P1, the pour's label),
  `1573cca` (the aura pin's `beam` record re-recorded, 80 entries), `a762658` (the release check's
  aura approval guard retired), `6c345ad` (demo notes for Version 20). The demo artifact is at
  Version 20 (`1795028867-1e6a`, built from `a762658`). Branch `p11/land-marks` = `a762658`.
- That session also verified W1's work-in-progress `bc46e3f` and set the Novice's bands
  (`08d69db` on `p11/solo`).
- Not known: whether the owner was shown Version 20 with pictures. This session makes the pictures.

## Done here

- `8e7f950` on `p11/solo` (pushed): the aura pin fixture fills the meter to `CONTENT.resonance.max`
  (it set 100, half of the new 200-deep meter, so the scripted Crescendo was refused). The pin file
  is unchanged; `tests/aura` green.
- `/home/user/aw-work/7/pw.config.ts` (the e2e wrapper's config) was not in the handoff; rebuilt,
  copied here under `aw-work/7/`.
- Briefs for this round under `aw-work/12/` (COMMON, join, w1, pics).

## Running when this note was written

- Join agent on `p11/solo-join` (worktree `/home/user/aw-work/wt-p11solo-w3`): `aw-work/12/join/BRIEF.md`.
- W1 numbers agent on `p11/solo` (worktree `/home/user/aw-work/wt-p11solo`): `aw-work/12/w1/BRIEF.md`.
- Pictures agent, Version 19 against 20: `aw-work/12/pics/BRIEF.md`.

## Decided

- A hero finishes a cast before their Solo (Vexis's Solo is about a second late in 4 of 10). Kept;
  the bots' `soloDueIn` stays as it is; documented in `docs/solos.md`.

## Later (about 21:35 UTC)

- Version 20 pictures made and sent to the owner: `pictures/v20/` (Settings, Codex Motifs, the
  marks; Version 19 left, Version 20 right).
- W1's numbers re-measured on `8e7f950` (no code change): `aw-work/12/w1/DOC-TABLES.md` (ready to
  paste into `docs/solos.md` and three phase docs), `aw-work/11/solo/w1/HANDOFF.md` filled,
  summaries in `aw-work/12/w1/`. Sent to the join agent for its step 7.
- Still running: the join agent (`aw-work/12/join/BRIEF.md`; its notes in `/home/user/aw-work/12/join/PROGRESS.md`,
  not in this branch until copied).

## Later (about 01:20 UTC, 19 November), after two container restarts

- `p11/solo-join` at `8f17fe2` (pushed) is the landing candidate: main `6c345ad` and `p11/solo`
  `8e7f950` merged in; 11 sound snapshots, Dissonance pins and the b16 save re-recorded (compared);
  docs/solos.md has the second round's numbers; two browser tests fixed (Settings' Controls tab;
  the Conductor test follows the frames' queue).
- `verify-land` CLEAN on `8f17fe2` (264 files, 5,498 passed). Whole e2e on `8f17fe2`: the run was
  cut by a restart after 56 passed with none failed; the 17 tests left are being run as
  `/home/user/aw-work/12/join/e2e3.log`. Earlier full run on `6c1af0c`: 70 passed, 3 failed, all
  three fixed by the two test commits above.
- Play-through sheets: `pictures/v21/`. Draft tester notes: `aw-work/12/join/DEMO-V21.md` (drop its
  bullet about the primer's "Cue their Solos" row: the word is kept on purpose).
- Next: land (ff main to the join), build and check the demo, publish Version 21, docs/demo.md
  notes, tell the owner; then the third menu pass.
