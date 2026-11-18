# Stream MARKS: the rest of the marks over the larger heroes

Read `/home/user/aw-work/11/COMMON.md` first. Worktree `/home/user/aw-work/wt-p11marks`, branch
`p11/marks`, scratch `/home/user/aw-work/11/marks`, ports 4640-4659.

Heroes and the Weaver are drawn 12% larger (`HERO_DRAWN` in `src/render/models/artFlag.ts`). The
owner approved raising five marks to match (on main: the beam song's ring, the Calling halo, the
Mode glyph, call prompts, Fermata's glyph; see `docs/phase-8.md`, "The marks on the larger
heroes", and commits `5bc9832..1fb831e` for exactly how each was done: the height multiplied by
`HERO_DRAWN`, nothing else). Other marks are still placed from the old height. The earlier
stream's notes and picture scripts are in `/home/user/aw-work/9/rim/` (`notes-part2.md`,
`scripts/`, `marks/`, `marks-src/`): reuse them.

## Part 1, to land: marks that are not aura, ornament or Calling drawing

Place each from the hero's drawn height, exactly as the approved five were, changing nothing else
(no colour, size, timing, strength):

- Seren's crossed blades and parry glyphs; Oro's tending drop and leaf;
- stun stars and status badges;
- bond and relic marks over a hero;
- damage and heal numbers where they start from a hero's head;
- the PERFECT and SAVED callouts (HOLD went up with Fermata's glyph already);
- anything else of this kind you find. Enemies are not drawn larger: leave marks over enemies.
  The Weaver is drawn larger too: include marks over her that are not aura, ornament or Calling
  drawing.

For each, check the result against the over-head health bar and the marks already raised, at the
game camera and close, on Kael (tallest) and Lyra or Vexis, and in a boss fight with the camera
pulled back. If raising one makes it collide with something or leave the screen, do not raise it
blindly: say so and propose what to do.

These must not move either aura pin (`npx vitest run tests/aura` passes with both files
unedited) and must not touch the eight aura files listed in `tools/release-check.ts`. If one of
them cannot be done without that, move it to Part 2.

One before-and-after sheet for the set (`/home/user/aw-work/11/marks/shots/part1-before-after.png`,
panels labelled Before and After, Kael and one other hero, game camera and close). Verify with
`verify-land.sh` into `/home/user/aw-work/11/marks/verify` and the browser tests
`e2e/smoke.spec.ts e2e/perf.spec.ts e2e/framing.spec.ts` (port 4650, log
`/home/user/aw-work/11/marks/e2e.log`). Re-record a render snapshot only for an entry your change
legitimately moves, and say which.

## Part 2, proposals only: aura, ornament and Calling marks

On a second branch `p11/marks-proposals` cut from your Part 1 commit, one commit per proposal,
none of which lands until the owner approves it from its own picture:

- the pour's "♪" label;
- the Luminary's Dawn callout, Radiance shaft and the Sovereign circlet over the Weaver;
- the Tyrant's crown and edict;
- the Martyr's seals and ember;
- the Chronomancer's mastery mark and Stasis callout;
- the Conductor's sigil, marcato mark and solo light;
- the chest anchors, if and only if the difference is visible: the beams and tethers that end on
  a hero, the song's glow, the pour's splash, the Fermata shell (about 0.13 m low on the larger
  figure).

For each: a sheet "Now / Proposed" for the hero or the Weaver it sits on, at the game camera and
close (`/home/user/aw-work/11/marks/proposals/P<n>-<name>.png`), which entries of
`tests/aura/presentationPin.json` it would move (do not edit the file; the pin's tests fail on
that branch on purpose), which of the eight aura files it edits, and your view in one line. Group
marks that only make sense together into one proposal (a Calling's set), and keep the number of
proposals to what the owner can judge: at most eight.

Report as COMMON asks. Lead with what landed-ready on `p11/marks`, then the proposal table.
