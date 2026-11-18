# The menus: what is on them, and why they read as machine-written

_Round 11, stream MENU. Taken on main at `08d8b42` (Demo Version 19), from the demo's two starts,
1280 x 720, English._

The owner said: "there's a lot of information on the menu UI (and it sounds a lot like AI)". Both
are true, and they are measured below. The game's English is 3,527 messages, about 21,300
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
| 1 | Prep, veteran | 1,849 | 358 | Embark. The three heroes, if you want others. | Every variant of every technique, open by default; four Callings in full; each hero’s kit; the Chord builder’s cards. | The beam song’s rule, three times (header, builder, its card). “Choose your three under Your party”, three times. |
| 2 | Prep, new player | 1,291 | 438 | Embark. Nothing else: a preset is already loaded. | Four locked Callings and their rules; a locked Dissonance panel; each hero’s kit; the Chord builder’s cards. | The beam song’s rule, three times (header, Newly unlocked, builder). “Settings → Skip the unlocks”, six times. |
| 3 | Settings | 1,137 | 192 | The one switch you came for. | The key table, the mouse table and the gamepad table: about half the page. | “Hero voices” twice in a row. “With Shift: Cue their Solo” four times. “Esc cancels” three times. |
| 4 | Codex, Motifs | 4,285 | 324 | Nothing. It is the reference. | All of it. | — |
| 5 | Codex, the Reliquary | 1,951 | 385 | Nothing. | All of it. | — |
| 6 | Codex, Heroes | 1,684 | 343 | Nothing. | All of it. | The same hero text as Prep’s cards. |
| 7 | Codex, Bonds | 1,477 | 277 | Nothing. | All of it. | — |
| 8 | Codex, Callings | 1,239 | 252 | Nothing. | All of it. | Prep’s Calling cards and their path dialogs. |
| 9 | Codex, Relics | 1,216 | 214 | Nothing. | All of it. | — |
| 10 | Codex, Weaver Rank | 941 | 274 | Nothing. | All of it. | The rank-up cards. |
| 11 | Codex, Enemies | 794 | 204 | Nothing. | All of it. | — |
| 12 | Codex, Techniques | 652 | 343 | Nothing. | All of it. | Prep’s techniques panel and the Atelier’s shelf. |
| 13 | The Atelier | 617 | 365 | A price and Buy. | What each variant does; how variants reach the shelf. | How Starlight is earned: here, in its intro, in the Loom’s tooltip, on every Result. |
| 14 | Dissonance | 606 | 250 | Nothing: its levels are set in Prep. | All of it: records, levels, what points pay. | Prep’s Dissonance panel. |
| 15 | Codex, The Weaver | 546 | 276 | Nothing. | All of it. | — |
| 16 | Codex, Events | 524 | 240 | Nothing. | All of it. | — |
| 17 | Codex, Songs & ornaments | 487 | 331 | Nothing. | All of it. (The owner’s: not changed.) | The Chord builder. |
| 18 | Summary, a run won | 472 | 187 | The Loom, or New run. | Everything else. It is a report. | Weaver XP three ways. Under each of eight numbers, a sentence that repeats the number. |
| 19 | Codex, the Astrolabe | 461 | 341 | Nothing. | All of it. | — |
| 20 | Hall of Deeds (the Codex’s Deeds page) | 429 | 233 | Nothing. | All of it. | — |
| 21 | Summary, a run set down | 387 | 169 | The Loom, or New run. | Everything else. | As above. Eight rows that say “0” and then “0 …” in words. |
| 22 | Bonds | 368 | 344 | A talent to choose, when one is open. | Every talent’s rule; both Solos. | Kael’s name, twelve times on his page. |
| 23 | Codex, Calls | 360 | 243 | Nothing. | All of it. | — |
| 24 | The Atlas of Echoes | 290 | 246 | An Echo to begin. | Each Echo’s twists; the weekly’s rules. | — |
| 25 | The Reliquary | 249 | 249 | The relic to carry. | Crafting odds, Instability, tiers. | Fracture’s risk, three times. |
| 26 | A Calling’s path (dialog) | 225 | 225 | Choose, or Close. | Eight options’ rules. | The Calling’s summary, also on its card. |
| 27 | Merchant | 216 | 159 | Each price, and your Aether. | Relic flavour lines. | That it is a merchant: small line, title and first sentence. |
| 28 | Result | 209 | 115 | Continue. | The coaching lines; the chart; three reward breakdowns. | The grade, three times. Weaver XP, twice. |
| 29 | How to Play | 198 | 162 | All of it, once. It does not fit the window: the first row scrolls off. | — | “You are the Weaver” (also the Title and Prep). “The fight is paused until you begin” over a button that says Begin the fight. |
| 30 | Codex, Auras | 196 | 196 | Nothing. | All of it. (The owner’s: not changed.) | The Chord builder. |
| 31 | The Loom’s welcome (three cards) | 186 | 186 | Next, or Later. | What the drill teaches; what songs are. | Each station named here is named again on its card. |
| 32 | The Loom, veteran | 168 | 168 | The Gate. | What each station is for. | A banner lists five stations that each wear a New badge. |
| 33 | The Loom, new player | 164 | 164 | The Gate. | What seven closed stations are. | The Atelier’s Rank, twice. Esc, twice. |
| 34 | The Astrolabe | 134 | 134 | A star to take. | The legend; the key list. | Points to spend, three times. |
| 35 | Relic offer | 130 | 130 | Three relics’ rules. | Their flavour lines. | — |
| 36 | The map | 129 | 129 | The glowing stop. | The names of the stops you cannot reach yet; the legend. | “0 owned” over “None yet”. |
| 37 | A first fight (HUD) | 112 | 112 | The coach hint. | The key reminders. | — |
| 38 | Respite | 109 | 92 | Three choices. | What Shaken is, when nobody is. | The header lists the three choices that the three cards below it are. |
| 39 | Shrine (a draft) | 102 | 102 | Three motifs. | Tags; Harmony notes. | — |
| 40 | Title, the demo’s first choice | 101 | 101 | Two cards. | What the veteran start contains. | — |
| 41 | Codex, Dissonance (closed) | 91 | 91 | Nothing. | When it opens. | The Loom’s Dissonance card. |
| 42 | Draft | 80 | 80 | Three motifs. | Tags. | The small line, the title and the first sentence all say “choose a motif”. |
| 43 | Forge | 85 | 85 | Three services and their prices. | — | “One service per visit”, twice. |
| 44 | Event | 67 | 67 | The choices. | — | — |
| 45 | Title, veteran | 62 | 62 | Enter the Loom. | What the next Rank opens. | Rank, here and in the Loom. |
| 46 | The pause menu’s Controls | 61 | 61 | The key you forgot. | The other nine. | — |
| 47 | Title, new player | 49 | 49 | Enter the Loom. | “No runs yet”. | Rank, here and in the Loom. |
| 48 | Codex, the Atlas (closed) | 35 | 35 | Nothing. | When it opens. | — |
| 49 | Abandon run? | 22 | 22 | Yes or no. | — | — |
| 50 | The pause menu | 14 | 14 | Resume. | — | “Paused”, then “The simulation is frozen.” |

### The ten lines of it

1. **Prep is the worst screen in the game.** A new player sees 1,291 words and needs one of
   them: Embark. A veteran sees 1,849.
2. **Prep explains four classes and a difficulty system nobody at Rank 1 can use**: about 230 words
   of locked Callings and a locked Dissonance panel.
3. **Settings is one page of 1,137 words.** Half is the key table.
4. **The Codex is where reference belongs, and it is long**: Motifs is 4,285 words on one
   page, the Reliquary 1,951, Heroes 1,684.
5. **The Summary (472) and the Result (209) print a sentence for
   every number**, including the numbers that are zero.
6. **The Atelier (617) and Dissonance (606) lead with a paragraph before the
   shelves.**
7. **How to Play is 198 words and does not fit the window**: its first row scrolls off the top.
8. **The Loom shows a new player seven closed stations with two sentences each** (164
   words). Its welcome is three cards, 186 words.
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

**2. "X, not Y", and "never Y".** 18 lines turn on a comma and a "not" or a "never".
- "Some are earned, not bought: by a Calling's top mastery, by a Deed, or in the Atlas of Echoes."
- "A look changes how the Weaver looks, never how she plays."
- "It changes how they look, never their timing." (Settings, Telegraphs)

**3. Lists of three.**
- "to set out, to practise, to read up"
- "tend to your wounds, sit with the song, or retune your songs"
- "your party, enemies to spawn and your build to try"
- "(tougher enemies, shorter wind-ups, Respites that don't heal)"

**4. Stacked qualifiers and brackets.** 187 bracketed asides of eight letters or more.
- "Reach Weaver Rank 7 to choose it (or Settings → Skip the unlocks)." Four times on one screen.
- "A Calling (a class for the Weaver, chosen in Prep from Rank 7) gains mastery as you play it, and its top mastery puts its own variant on sale and earns its title."
- "Click a party frame (or press its number) to tie your Thread to that hero."

**5. Em dashes joining two thoughts.** 100 in the catalogue, 83 of them in the coach hints, which are all built the same way.
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
- The coach hints follow one mould: "[Name] is [state] — [do this]". Their file holds 83 dashes.
- Seven closed stations follow one mould: "[What it is]. Opens at [when]."
- Most settings have a hint that is one long sentence with a colon in the middle.

**9. Hedges.** "for now" (5), "this time" (3), "right now", "a little".
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

**13. A tester's footnote on a player's screen.** "Settings → Skip the unlocks" appears 20 times in 12 files: on locked Callings, on Prep's techniques, on the closed Dissonance panel, in the Atelier.

**14. Three nouns for one thing.** A place on the map is a "node" (5 times), a "step" (24) and a "stop" (13). A station "lights up", "opens" and "unlocks".

**15. Semicolons.** 88 messages hold one. Players do not talk in semicolons.

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
