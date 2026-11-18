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
