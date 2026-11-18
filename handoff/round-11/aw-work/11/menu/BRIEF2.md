# Stream MENU, second pass

Your first pass is on main at `2a2b91b` (fast-forwarded, pushed). Thank you: the audit and the
voice guide are what the owner asked for. This pass takes on what you listed for a second pass,
minus what waits on the Solo stream.

## Where

- Worktree `/home/user/aw-work/wt-p11menu`, new branch `p11/menu2` from main `2a2b91b`.
- Ports 4620 to 4639, as before. Work files under `/home/user/aw-work/11/menu/pass2/`.
- The Solo stream is rewriting the sim, the content and the bots on `p11/solo` right now, and a
  marks stream is in `src/render`. Use `--maxWorkers=2`; expect slow runs.

## In scope, in this order

1. **Settings.** Controls (the key, mouse and gamepad tables) on its own tab or behind a fold, so
   the page a player opens to change one thing is short. Do not change the Solo, Cue, autonomy or
   Cue-modifier rows or their wording; they move with the rest and the Solo stream removes them.
2. **The stations' openings.** The seven station intros and the opening paragraphs of the Atelier,
   Dissonance, Bonds, the Reliquary, the Atlas, the Astrolabe and the Hall of Deeds: each to the
   voice guide's ceiling (30 words for an intro, 40 for standing text). The earlier decision that
   each intro explains its terms in brackets is dropped: a term is explained where the player uses
   it. Update the test that held it, and say so in the test.
3. **The Codex**, except its Auras and Songs pages. The words of motifs, relics, heroes, enemies
   and Callings come from `src/content` and stay as they are in this pass. What can change is how
   much shows at once: a name and one line, the rest on opening a row; groups that fold; a filter
   or search where a page is a long list (Motifs is 4,285 words on one page). Keyboard, pad and
   screen reader must reach everything a mouse can.
4. **The map.** A stop out of reach must give up its name to a keyboard or pad player and to a
   screen reader, not only on hover. Find the lightest way.
5. **"Settings → Skip the unlocks"** off every player-facing screen except Settings itself and the
   demo's first choice on the Title.
6. **Later-game HUD lines**: the 16 em dashes left in decrees and boss lines, and any other line
   under `src/ui/text/en` that breaks the voice guide and is not excluded below.
7. **"node" against "step" and "stop"**: one noun each, as the guide says. Re-record the pin that
   holds the old word, with the reason in its test.

## Out of scope

- Everything under `src/content`, `src/sim`, `src/meta`, `src/bots`, `src/render`, `src/audio`.
  `contentVersion` must not move.
- Any line about Solos, Cues, hero autonomy, Resonance or Crescendos (your `left-lines.md`), the
  Result and the Summary, Prep's hero cards, How to Play. They wait for the Solo stream.
- Any line that names or describes an aura, an ornament or a song's rule; the Chord builder; the
  Codex's Auras and Songs pages; both aura pins; `tests/aura/**`.

## Deliver

- Before-and-after sheets as in pass one, in `/home/user/aw-work/11/menu/pass2/shots/`, with word
  counts, and `counts.md`.
- `verify-land.sh` into `/home/user/aw-work/11/menu/pass2/verify`; browser specs `smoke`, `a11y`,
  `locale` on port 4630 into `/home/user/aw-work/11/menu/pass2/e2e.log`.
- A short report: what changed in plain language, the table, behaviour changes to confirm, what
  you did not check. Commit often; the same trailer; no model names.
