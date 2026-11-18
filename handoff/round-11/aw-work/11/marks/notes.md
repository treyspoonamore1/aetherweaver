# Stream MARKS (round 11): working notes

Branches: `p11/marks` (Part 1, to land) and `p11/marks-proposals` (seven proposals stacked on it).
Scratch worktree for the proposals branch was `11/marks/wt-prop` (removed at the end; the branch stays).

Lifts (0.12 x content height): Kael +0.24 m, Brann +0.252, Seren +0.234, Lyra and Vexis +0.222,
Oro and the Weaver +0.204.

Pictures: `scripts/p1.mjs` (Part 1 scenes) and `scripts/p2.mjs` (proposal scenes) stage the VFX
lab; cams: `game` (follow camera, default zoom), `close` (pinned 11 m from the head at the game's
pitch), `maxzoom` (the player's closest zoom; AW_MOUSE sets the aim). `scripts/part1sheet.py`,
`scripts/propsheet.py` build the sheets with `panels.py`. Builds: before = main 08d8b42, after =
Part 1, prop = proposals P1..P6, chest = prop + every chest anchor (used for P7's shell and the
"chest-anchors-compared" sheet).

Edits were applied with `scripts/apply.py <tree> <spec.py>` (exact replacements, counted):
`part1.py`, `part1b.py` (Part 1); `p2a..p2f`, `p2g_shell.py` (proposals); `p2g_chest.py` (all chest
anchors, not proposed).

Pin: `npx tsx --tsconfig tsconfig.app.json scripts/pinNow.mts out.json` in the tree, then
`scripts/pindiff.py tests/aura/presentationPin.json out.json`. P1: 80 entries (beam, all 8 samples
of the ten beam-role cases). P2..P6: 0. P7: 10 (fermata, samples 4-8 of aura:fermata:beam and
aura:fermata:field).

## Integration (after the restart, 18 Nov, from 12:30)

Branch `p11/int-a` (in the worktree) = main 2a2b91b + merge of p11/marks + P2..P6 + the new place
for Seren's blades and Oro's drop + docs. Tip `e6780fc`. verify-land clean there
(`verify-int/`); browser tests in `e2e-int.log` (re-run a timeout alone: `e2e.sh ... -g "<name>"`).

NOT done, on purpose: re-recording the aura presentation pin (P1's 80 `beam` entries) and retiring
the release check's approval guard. The permission system refused the re-record ("undermining
oversight"), so neither was attempted another way. They wait for the person running the work.
- P1 is on `p11/pour-label` (= int-a + one commit in thread.ts); the pin test fails there.
- The recorder with `--diff` and `--rewrite --only=<records>` is saved, uncommitted, as
  `pending/recorder-diff-and-rewrite.patch` (applies to tests/aura/recordPresentationPin.ts).
  On the int tree with P1, `--diff` listed exactly 80 entries: `beam`, samples 1-8 of the ten
  beam-song cases; nothing else.

Sheet for the owner: `shots/landed-marks.png`.
