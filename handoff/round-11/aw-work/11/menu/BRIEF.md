# Stream MENU: less on the menus, and a human voice

Read `/home/user/aw-work/11/COMMON.md` first. Worktree `/home/user/aw-work/wt-p11menu`, branch
`p11/menu`, scratch `/home/user/aw-work/11/menu`, ports 4620-4639.

## What the owner said

> "I think there's a lot of information on the menu UI (and it sounds a lot like AI)"

Two problems: too much on each menu screen, and the writing reads as machine-written. The game's
UI text is in `src/ui/text/en/**` (about 29,000 words) and in `src/content/**` descriptions. This
stream fixes the screens a player meets in the first hour, and writes the rules the rest will
follow.

## Step 1: audit (write `/home/user/aw-work/11/menu/AUDIT.md`)

Take a picture of every menu screen as a new player and as a veteran sees it (the demo's two
starts: `VITE_DEMO=1`, or the lab `?lab=ui`): Title, the Loom with its welcome and each station
card, Prep, the map, the pause menu, How to Play, the Result and Summary, Settings (each tab),
the Calling picker, the Chord builder (look only; do not change it), Draft, Respite, Merchant,
Forge, Event, Relic offer, the Astrolabe, Atelier, Reliquary, Bonds, Hall of Deeds, Dissonance,
the Atlas, the Codex's pages. For each: the word count on screen, what a player must read to act,
what is reference they could look up, and what is said twice. Rank the screens by how overloaded
they are.

Then list the habits that make the text read as machine-written, with real examples quoted from
the game. Look for at least these: sentences that explain the design instead of telling the
player what to do; "X, not Y" and "not just X but Y"; lists of three; stacked qualifiers and
parentheticals; em dashes joining two thoughts; abstract nouns where a verb would do; the same
fact said in a title, a subtitle and a hint; every line the same length and rhythm; hedges;
colons before a restatement; ornate fantasy filler that carries no information; instructions
that name four keys at once.

## Step 2: a voice guide (`docs/voice.md`, one page)

How this game talks. Short. Rules a writer can apply, each with a before and after from the game.
Suggested spine: say what to do, then stop; one idea per line; numbers over adjectives; the
game's own nouns, used the same way every time; no line longer than it needs; flavour in names
and a few chosen places, not in every sentence; never explain a mechanic on a screen where the
player cannot use it. Give word budgets: a button, a card title, a card body, a hint, a tooltip,
a screen's standing text.

## Step 3: rewrite and cut, on the first-hour screens

Title, the Loom (welcome, station cards), Prep, the map, the pause menu and its Controls page,
How to Play, coach hints and first-sighting cards, Result and Summary, Draft, Respite, Merchant,
Forge, Event and Relic screens, Settings labels and hints, the Calling picker's standing text.

- Cut what is said twice. Move reference detail behind what already exists for it (a hover or
  focus detail, the Codex) and do not invent new UI unless a screen cannot work without it; if you
  add a "more" toggle, it must work with keyboard and pad and at every text size.
- Rewrite what stays to the voice guide. Keep every fact true: check each number and rule against
  the code or content it describes.
- Target: each of those screens shows at least a third fewer words than today, and nothing a
  player needs in order to act is lost. Report the count before and after per screen.

**Do not touch**: anything that names or describes an aura or an ornament (the Chord builder and
its cards, the song chips, the Codex's Auras and Songs pages; `tests/aura/chordCardsPin.json`
pins some of that markup and must pass unedited); and the wording about Solos, Cues, hero
autonomy and Resonance, which another stream is redesigning: leave those lines exactly as they
are and list them in your report so the two streams can be joined. Leave the Codex's long
reference pages for a second pass, but include them in the audit.

The text layer has tests, a pseudo-language and e2e specs that look for strings
(`tests/**`, `e2e/**`, `src/ui/text/**`). Update the tests that pin a string you changed on
purpose, and say which. Screen readers read `aria-label`s: keep them complete sentences.

## Step 4: show it

For every screen you changed: one picture, before on the left and after on the right, labelled,
with the word counts in the caption, in `/home/user/aw-work/11/menu/shots/`. Also one sheet of
the ten lines you think improved most, before and after, as text
(`/home/user/aw-work/11/menu/ten-lines.md`).

## Verify

`verify-land.sh` into `/home/user/aw-work/11/menu/verify`, and the browser tests
`e2e/smoke.spec.ts e2e/a11y.spec.ts e2e/locale.spec.ts` (port 4630, log
`/home/user/aw-work/11/menu/e2e.log`). `src/sim`, `src/meta` stay identical to main;
`src/content` may change only in description strings that are not an aura's or an ornament's, and
`contentVersion` must not move (if a description is hashed into it, leave that description and
report it).

In your report, besides the usual: the ranked audit in ten lines, the per-screen word counts, the
lines you left for the Solo stream, and what a second pass should take on.
