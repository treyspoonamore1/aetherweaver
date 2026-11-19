# Brief: the third menu pass, screens (Result, Summary, Prep's hero cards, the rest)

Read `/home/user/aw-work/12/COMMON.md` first, then `docs/voice.md` (the game's voice guide: every
line a player reads follows it) and the first two passes' notes:
`/home/user/aw-work/11/menu/AUDIT.md` (the audit, with "why it reads as machine-written"),
`counts.md`, `pass2/counts.md`, `pass2/left-lines.md`.

## Why

The owner, in their words: "I think there's a lot of information on the menu UI (and it sounds a
lot like AI)". Passes one and two (on main) cut the first-hour screens, Settings, the Codex and
the station intros. The Solo rework has now landed too (heroes fire their own Solos; the Thread
is the Cue; `docs/solos.md`). This pass takes what was left for after it.

## Where

- Worktree `/home/user/aw-work/wt-menu3`, new branch `p12/menu3-ui` from main (the orchestrator
  creates it and tells you the commit). Scratch: `/home/user/aw-work/12/menu3/ui/`. Ports 4630
  to 4639. The capture and counting scripts of the earlier passes are in
  `/home/user/aw-work/11/menu/scripts/` and `pass2/scripts/` (copy, do not edit in place; fix
  paths that no longer exist).
- Another agent works beside you on `p12/menu3-content` in `/home/user/aw-work/wt-menu3c`: the
  words under `src/content` (motifs, relics, events, heroes, auras, Callings) and how the content
  is versioned. **Do not edit anything under `src/content` or `src/sim`.** Where a screen shows
  content text, shorten how much of it shows (fold, first line, on opening), not the text itself.

## In scope, in this order

1. **The Result** (after each fight, about 209 words) and **the Summary** (after a run, 387 to
   472). Today they print a sentence for every number, zeros included, and say the grade three
   times and Weaver XP two or three ways. Make them tiles: a number and a short label each; a
   zero tile is left out or quiet; the coaching lines at most one or two, the most useful; the
   chart and the reward breakdowns folded or on demand. Keep every number a player could want;
   keep "7 of 9 Solos Cued". Keyboard, pad and screen reader reach everything.
2. **Prep's hero cards.** Prep is still about 930 words for a new player and 1,250 for a veteran.
   A hero card shows the name, the role and one line; the kit opens on demand. Find what else in
   Prep a new player reads twice and cut it.
3. **The rest left from pass two:** the 13 lines with an em dash (`pass2/left-lines.md` and a
   search), the Codex's Auras page folded like the others, the "Newly unlocked" sentences in
   `src/meta/profile.ts` (UI text that lives there; you may move it into `src/ui/text/en` if
   that is cleaner, keeping what a save stores unchanged).
4. **Solo, Cue and Resonance lines** (`pass2/left-lines.md` lists 144 that waited for the Solo
   rework; the rework reworded many). Read every Solo, Cue, autonomy and Resonance line now under
   `src/ui/text/en` against the voice guide and fix what breaks it. The word stays "Cue"/"Cued".

## Out of scope

`src/content`, `src/sim`, `src/bots`, `src/audio`, `src/render` (except where a screen's markup
needs it, and say so). No fight, number or rule changes. `contentVersion` must not move.

## Deliver

- Commits on `p12/menu3-ui`, each a step. Re-record a text pin (the Brann UI pin, Codex hashes)
  only after dumping and comparing key by key, with the reason in its test.
- Before-and-after sheets with word counts per screen in `/home/user/aw-work/12/menu3/ui/shots/`
  and a `counts.md` table (before, after, change), as the earlier passes did. 1280 x 720 at
  `deviceScaleFactor: 2`; open every picture.
- `verify-land.sh` into `/home/user/aw-work/12/menu3/ui/verify` on your final commit; browser specs
  `smoke`, `a11y`, `locale`, `solos` via `e2e.sh` on port 4630 into
  `/home/user/aw-work/12/menu3/ui/e2e.log`.
- A short report: what changed in plain language, the table, behaviour changes the owner should
  confirm (things that now fold or open), what you did not check.

Keep `/home/user/aw-work/12/menu3/ui/PROGRESS.md` as you go.
