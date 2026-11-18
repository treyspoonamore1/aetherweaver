# The menus: what is on them, and why they read as machine-written

_Round 11, stream MENU. Taken on main at `08d8b42` (Demo Version 19), from the demo's two starts,
1280 x 720, English._

The owner said: "there's a lot of information on the menu UI (and it sounds a lot like AI)". Both
are true, and they are measured below. The game's English is {MESSAGES} messages, about {WORDS}
words, before any content text (motifs, relics, heroes) is counted.

## How the counting was done

A script opens each screen in the real game and counts every word a player can see on it: text
that is displayed, not shrunk to a pixel for screen readers, and not faded out. A key cap counts as
a word. "On screen" is the whole screen, scrolled or not. "First view" is what fits in the window
before scrolling. Pictures and the words of each screen are in `before/` (one `.png` and one `.txt`
a screen). The script is `scripts/capture.mjs`.

Three things a count cannot show are judged by eye for each screen: what a player **must read to
act**, what is **reference** they could look up, and what is **said twice**.

## The screens, ranked by overload

Overload here is words on screen set against the words needed to act. Worst first. A page of the
Codex is ranked below a screen the player has to pass through: nobody is made to read the Codex.

| # | Screen | Words | First view | Must read to act | Reference | Said twice |
| - | ------ | ----- | ---------- | ---------------- | --------- | ---------- |
{TABLE}

### The ten lines of it

1. **Prep is the worst screen in the game.** A new player sees {prep-fresh} words and needs one of
   them: Embark. A veteran sees {prep-veteran}.
2. **Prep explains four classes and a difficulty system nobody at Rank 1 can use**: about 230 words
   of locked Callings and a locked Dissonance panel.
3. **Settings is one page of {settings-whole} words.** Half is the key table.
4. **The Codex is where reference belongs, and it is long**: Motifs is {codex-motifs} words on one
   page, the Reliquary {codex-the-reliquary}, Heroes {codex-heroes}.
5. **The Summary ({summary-win-whole}) and the Result ({result-win-whole}) print a sentence for
   every number**, including the numbers that are zero.
6. **The Atelier ({atelier}) and Dissonance ({dissonance}) lead with a paragraph before the
   shelves.**
7. **How to Play is {howto} words and does not fit the window**: its first row scrolls off the top.
8. **The Loom shows a new player seven closed stations with two sentences each** ({loom-fresh}
   words). Its welcome is three cards, {welcome} words.
9. **The road's screens (Draft, Merchant, Forge, Event, Relic) are mostly item text**, with a
   flavour sentence and an instruction on top that both say what the screen already shows.
10. **The Title, the map and the pause menu are light.** Their extra words are key reminders and
    labels on stops the player cannot reach yet.

## Why it reads as machine-written

Twelve habits. Each is quoted from the game as it was on main.

**1. It explains the design when it should tell the player what to do.**
- "Each station is a place to go: to set out, to practise, to read up and, as you play, to grow the Weaver." (the Loom's welcome)
- "A new Weaver: the real first hours. Every station of the Loom stays dark until it opens, and shows you around when it does." (the Title)
- "The Weaver's class for this run, chosen here." (Prep)

**2. "X, not Y", and "never Y".** {NOT_COUNT} lines turn on a comma and a "not" or a "never".
- "Some are earned, not bought: by a Calling's top mastery, by a Deed, or in the Atlas of Echoes."
- "A look changes how the Weaver looks, never how she plays."
- "It changes how they look, never their timing." (Settings, Telegraphs)

**3. Lists of three.**
- "to set out, to practise, to read up"
- "tend to your wounds, sit with the song, or retune your songs"
- "your party, enemies to spawn and your build to try"
- "(tougher enemies, shorter wind-ups, Respites that don't heal)"

**4. Stacked qualifiers and brackets.** {PAREN_COUNT} bracketed asides of eight letters or more.
- "Reach Weaver Rank 7 to choose it (or Settings → Skip the unlocks)." Four times on one screen.
- "A Calling (a class for the Weaver, chosen in Prep from Rank 7) gains mastery as you play it, and its top mastery puts its own variant on sale and earns its title."
- "Click a party frame (or press its number) to tie your Thread to that hero."

**5. Em dashes joining two thoughts.** {DASH_COUNT} in the catalogue, {DASH_HINTS} of them in the coach hints, which are all built the same way.
- "Kael is hurt — click their frame or press 1 to Thread them"
- "Everyone is healthy — press RMB to switch the Thread to Empower and add damage"

**6. Abstract nouns where a verb would do.**
- "Optional difficulty, for the endgame."
- "Passive bonuses, chosen between runs."
- "0% of everything that mattered in this run was you: healing, shields, saves and added damage."

**7. One fact in a title, a subtitle and a hint.**
- The Merchant: "A merchant · each item once", then "The Merchant", then "A pack-mule of a merchant…".
- A locked Calling: a lock that says "Rank 7", then "Reach Weaver Rank 7 to choose it".
- The Loom: "Spent at the Atelier, which opens at Weaver Rank 5" under the Starlight count, and "The Starlight shop. Opens at Weaver Rank 5." on the Atelier's card, on the same screen.
- The Respite's header lists its three choices. The three cards under it are those choices.
- The Summary: "+23 Weaver XP", "This run earned 23 Weaver XP toward Rank 2.", "23 / 40 XP to Rank 2".

**8. Every line the same length and rhythm.**
- The coach hints follow one mould: "[Name] is [state] — [do this]". Their file holds {DASH_HINTS} dashes.
- Seven closed stations follow one mould: "[What it is]. Opens at [when]."
- Most settings have a hint that is one long sentence with a colon in the middle.

**9. Hedges.** "for now" ({FORNOW}), "this time" ({THISTIME}), "right now", "a little".
- "No one is Shaken right now."
- "Your auras did nothing this time."
- "Skip: heal the party a little"

**10. A colon before a restatement.**
- "Starlight: every won fight pays it, and every Deed."
- "Slows the whole fight down: the same fight, with more time to think."
- "A new Weaver: the real first hours."

**11. Ornate filler that carries no information.**
- "The choir cannot reach this alcove."
- "An old bell-forge, still warm. The smith will do one thing for you before the fire goes out."
- "Your sanctum between runs"
- "The road waits. Here is what you wove while you walked it."
- "The forge's fire takes your old songs and gives them back reshaped."

**12. Four keys named at once.**
- "Arrow keys to move between stations · Enter to open · Esc for the front door"
- "Arrow keys or Tab to move · Enter to choose"
- The Astrolabe's footer: "Click or Enter take · Right-click or Del give back · Tab move · Esc back"

Three more, found on the way:

**13. A tester's footnote on a player's screen.** "Settings → Skip the unlocks" appears {SKIP} times in {SKIPFILES} files: on locked Callings, on Prep's techniques, on the closed Dissonance panel, in the Atelier.

**14. Three nouns for one thing.** A place on the map is a "node" ({NODE} times), a "step" ({STEP}) and a "stop" ({STOP}). A station "lights up", "opens" and "unlocks".

**15. Semicolons.** {SEMI} messages hold one. Players do not talk in semicolons.

## What is good and should stay

- **Relic flavour lines.** "Rung so often it forgot how to be gentle." They are short, they sound like a person, and they sit where flavour belongs.
- **First-sighting cards.** "It charges the farthest hero and pins them in place. A Ward stops the pin." A fact, then an order.
- **Button labels.** "Embark", "Weave in", "Take it", "Begin a run".
- **The tagline.** "You are the support. Your party is the weapon."

## Where the rest is

- `counts.md`: each first-hour screen's words before and after this pass.
- `shots/`: each changed screen, before on the left and after on the right.
- `ten-lines.md`: the ten lines that improved most.
- `left-lines.md`: the lines left exactly as they were, for the Solo stream and for the owner.
- `docs/voice.md` in the repository: the rules the rest of the text should follow.
