# Brief: the third menu pass, the content's words (and keeping replays when only words change)

Read `/home/user/aw-work/12/COMMON.md` first, then `docs/voice.md` (the game's voice guide) and
`/home/user/aw-work/11/menu/AUDIT.md` (section "Why it reads as machine-written").

## Why

The owner, in their words: "I think there's a lot of information on the menu UI (and it sounds a
lot like AI)". Two passes rewrote the screens' own lines (`src/ui/text/en`). The words that come
from the content (`src/content`: motifs, relics, events, heroes and their abilities, auras,
ornaments and songs, Callings and their paths, Bonds, Deeds, the Astrolabe, Echoes) were left
alone, because changing them moves `contentVersion`.

`contentVersion` (`contentVersionOf` in `src/content/index.ts`) hashes the whole content,
display text included. Replays and run replays carry it and are refused when it differs
(`src/sim/replay.ts`, `src/meta/runReplay.ts`). So today every wording fix makes every saved
replay unplayable, though no word can change a fight.

## Where

- Worktree `/home/user/aw-work/wt-menu3c`, new branch `p12/menu3-content` from main (the
  orchestrator creates it and tells you the commit). Scratch: `/home/user/aw-work/12/menu3/content/`.
  Ports 4640 to 4649.
- Another agent works beside you on `p12/menu3-ui` in `/home/user/aw-work/wt-menu3`: the screens
  under `src/ui` (Result, Summary, Prep, the Codex's Auras page). **Do not edit `src/ui/screens`
  or `src/ui/text/en`** except a test or text key that your content change forces, and say so.

## In order

1. **Find out whether display text reaches a fight.** List every text field in the content schema
   (`src/content/schema.ts`: names, descriptions, flavour, lines, tooltips, and so on; not ids,
   tags, numbers or anything a rule reads). Prove no sim, bot or meta code reads one to decide
   anything: search, and then the experiment: change every such field to a placeholder in a
   scratch copy and run the goldens (`npx tsx tools/update-golden.ts` dry run), the command
   snapshots and the baseline `--check`s. Expected: only `contentVersion` differs. If anything
   else moves, stop that step and report what reads the text.
2. **If text reaches no fight: take display text out of `contentVersion`.** Exclude exactly those
   fields from the hash (a named list beside `HASHED_ONCE_FILLED`, with a comment saying why: a
   word cannot change a fight, and a reworded line should not refuse a replay), and a unit test
   that changing a text field leaves `contentVersion` the same while changing a number moves it.
   This moves `contentVersion` once. Re-record what holds it (goldens and their synced pins,
   `RELEASE_PINS.contentVersion`, save fixtures, the masked replay's frozen copies, anything the
   suite names), compared first: **only** the `contentVersion` value may differ in each. Commit
   this alone, before any wording, with the reason. Old replays from the version before are
   refused once, by the existing sentence; say so in your report.
3. **Then the words**, one family per commit, to the voice guide: motifs, relics, events, heroes
   and abilities, Callings and their paths, Bonds, Deeds, Echoes and the Astrolabe, auras,
   ornaments and songs (the aura restriction is lifted; the aura pins are regression pins: a card
   text that moves `tests/aura/chordCardsPin.json` is re-recorded entry by entry with the entries
   named). Short lines, one idea each, the same word for the same thing everywhere, numbers as the
   game states them. Keep each line's meaning and every number exactly; where a line states a
   rule, it must still be true (check against the rule's code when unsure). Templated values
   (`{n}` and the like) keep their placeholders. After step 2, `contentVersion` must not move
   again: check it after every family.
4. Tests that quote a line (`tests/fill/*`, `tests/content*`, Codex hashes, the Brann pin) are
   updated with the line; a test that only checks a line exists is not weakened.

## Deliver

- Commits on `p12/menu3-content`. A word count before and after per family, in
  `/home/user/aw-work/12/menu3/content/counts.md`, and ten before-and-after lines that show the
  change best, in `ten-lines.md`. One sheet of two Codex pages before and after (Motifs and
  Relics) in `content/shots/`, 1280 x 720 at `deviceScaleFactor: 2`, opened by you.
- `verify-land.sh` into `/home/user/aw-work/12/menu3/content/verify` on your final commit; browser
  specs `smoke`, `locale`, `weekly` via `e2e.sh` on port 4640.
- A short report: what changed in plain language; whether text reached a fight (with the proof);
  every recorded result moved and why; what you did not check.

Keep `/home/user/aw-work/12/menu3/content/PROGRESS.md` as you go.
