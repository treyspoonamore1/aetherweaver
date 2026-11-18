# Brief: before-and-after pictures for demo Version 20

Read `/home/user/aw-work/12/COMMON.md` first.

## Goal

Demo Version 20 is already published (built from `a762658`; main is `6c345ad`, which adds only
`docs/demo.md`). The owner has not been shown it. Make **three** clear before-and-after picture
sheets, Version 19 (`9485ea3`) on the left and Version 20 (`6c345ad`) on the right, each with a
short plain caption, so the owner can see what changed at a glance:

1. **Settings**: the General tab as a new player opens it (Version 19 had one long page; Version 20
   has General and Controls tabs). One shot each side; if Version 19's page is taller than the
   window, show what a player sees on opening it (top of page), and say so in the caption.
2. **The Codex**: one page that folds now (the Motifs page is best: Version 20 shows one level,
   folded by family, with a filter and an *Every level* switch). Same page each side.
3. **The marks over a hero in a fight**: one hero close enough to read, showing the health bar
   with marks over it, including **the pour's label** ("♪ ×2" over the hero the Thread moves to,
   which in Version 19 sat on the Mend/Empower glyph and in Version 20 sits above it), and if you
   can, Seren's crossed blades or Oro's tending drop (new place at the right end of the bar). Same
   scene, same camera, both sides.

What changed is described in `docs/demo.md`, section "Version 20" (on main). The marks agent's
staging scripts for the VFX lab are in `/home/user/aw-work/11/marks/scripts/` (`lib.mjs`,
`p1.mjs`, `p2.mjs`, `panels.py`; copy, do not edit in place) and its notes in
`/home/user/aw-work/11/marks/notes.md`; the menu agent's capture scripts are in
`/home/user/aw-work/11/menu/scripts/` and `menu/pass2/scripts/` (`capture.mjs`, `lib.mjs`,
`sidebyside.py`). Reuse what helps. Older scripts assume paths under `/home/user/aw-work/` that may
no longer exist; fix your copies.

## How

- Make two detached worktrees under `/home/user/aw-work/12/pics/`: `v19` at `9485ea3` and `v20`
  at `6c345ad` (`git -C /home/user/aetherweaver worktree add --detach <path> <sha>`), symlink
  `node_modules` into each, `npm run build` in each, and serve each `dist` with
  `npx vite preview --host 127.0.0.1 --port <p> --strictPort` (ports 4801 and 4802). Stop your
  servers by pid when done.
- A fresh start (no save) reaches the Title; the Settings and Codex need whatever the menu
  scripts did to get there (the Codex may need a veteran profile or *Skip the unlocks*; look at
  how the menu scripts reached it). Use the same route on both builds.
- Pictures at 1280 x 720, `deviceScaleFactor: 2`. Open every picture; retake what is empty,
  cropped or mid-transition. Compose each sheet side by side with a heading "Version 19" /
  "Version 20" and a one-line caption (PIL is available for `python3 -I`).
- Write the sheets to `/home/user/aw-work/12/pics/shots/` as `1-settings.png`, `2-codex.png`,
  `3-marks.png`. Keep each sheet under about 3000 px wide.
- When done, remove both worktrees (`git worktree remove --force`), their builds and any browser
  profile. Do not commit anything; this is pictures only.

## Finish line

Three sheets exist, you have opened each and they show what the captions say. Hand back the paths,
one line per sheet on what it shows, and anything that looked wrong in Version 20.
