# How Aetherweaver talks

_2026-11-18. For anyone who writes a line a player reads: a screen, a card, a hint, a tooltip._

The player is in the middle of a game and wants to act. Tell them what to do. Then stop.

Every example below is from the game: the line as it was, and the line as it is now.

## Seven rules

**1. Say what to do, then stop.** Lead with the verb. Cut the sentence that explains the screen.

- Before: "The choir cannot reach this alcove. Take one: tend to your wounds, sit with the song, or retune your songs."
- After: "Choose one."

**2. One idea per line.** Two ideas get two sentences. A dash or a semicolon between them means the line is doing two jobs.

- Before: "Kael is down — Thread them {1} and let Mend revive them before they bleed out"
- After: "Kael is down. Thread them {1}: Mend revives them before they bleed out"

**3. Numbers over adjectives.** Keep the number. Drop the words that describe how the number feels.

- Before: "Slows the whole fight down: the same fight, with more time to think. Under 100% counts as an assist."
- After: "Slows the whole fight. Under 100% counts as an assist."

**4. One noun for one thing.** The game has its own words. Use each the same way everywhere, and capitalise it. A place on the map is a _stop_. How far along you are is a _step_ ("step 3 of 10"). A station _opens_. Write "Rank 4", or "Weaver Rank 4" where a Bond rank could be meant.

- Before: "Glowing nodes are within reach; hover one to see what it offers." (the same screen's header said "step", its arrival card said "stops")
- After: "Choose a glowing stop. Hover a stop, or Tab to it, to see what it offers."

**5. No line longer than it needs.** Count the words. These are ceilings.

| Where                                                   | Words                    |
| ------------------------------------------------------- | ------------------------ |
| Button                                                  | 1 to 3                   |
| Card title                                              | 1 to 4                   |
| Card body                                               | 20                       |
| Intro panel or dialog body                              | 30                       |
| Coach hint                                              | 18, in up to 2 sentences |
| Tooltip, or a setting's hint                            | 25                       |
| A screen's standing text (outside its cards and tables) | 40                       |

- Before: "Choose three. They take the keys 1, 2 and 3 in this order, so a hero's key can change with the party: the key each will take is on their card." (32)
- After: "Choose three. Each card shows the key its hero will take: 1, 2 or 3." (15)

**6. Flavour has one place on a screen.** That place is the small line above the title, and the names. Relic flavour stays too. The line that tells the player what to do is plain.

- Before: "A pack-mule of a merchant, all bells and pockets. Pay in Aether; what you buy is yours for the rest of the run."
- After: above the title, "All bells and pockets". Under it, "Pay in Aether. Each item sells once and lasts the run."

**7. Explain a thing where the player can use it.** A locked thing shows its name and when it opens. Its rules wait for the screen where it works, for a hover, or for the Codex.

- Before, on a new player's Loom: "The Astrolabe. A star map of bonuses. Opens at Weaver Rank 4."
- After: "The Astrolabe. Opens at Rank 4." The rest shows on hover and on focus, and is always read out.

## Habits to cut

Each of these was in the game. The round 11 menu audit quotes them and counts them.

- **"X, not Y."** Say X. "Some are earned, not bought" tells the player nothing "Some are earned" doesn't.
- **A list of three by reflex.** "To set out, to practise, to read up." List things when they are buttons on the screen.
- **Brackets, and a colon that repeats itself.** "Starlight: every won fight pays it, and every Deed" became "Won fights and Deeds pay Starlight."
- **Em dashes.** Use a full stop.
- **One fact said three times.** A lock that says "Rank 7" needs no sentence under it that says "Reach Weaver Rank 7 to choose it".
- **Hedges.** "For now", "this time", "a little", "right now".
- **Four keys in one sentence.** Name the key the player needs now. The pause menu's Controls has the rest.
- **Sentences about the design.** "Each station is a place to go." The player can see that.
- **A tester's footnote on a player's screen.** "Settings → Skip the unlocks" belongs in Settings.

## House style

- "You" is the Weaver. Present tense.
- British spelling: armour, colour, practise (the verb).
- Screen and card text ends with a full stop. Coach hints and labels don't.
- A screen reader gets a whole sentence. An `aria-label` can say more than the text on screen.
- Check every number against the code before the line ships.
- A long page folds. One group is open and the rest are a heading each (`src/ui/kit/Fold.tsx`). Content's own words stay as they are.
- The setting that skips the unlocks is named in Settings and nowhere else.
- Auras, ornaments and the songs' rules are the owner's words. So are the lines about Solos, Cues, hero autonomy and Resonance while that mechanic is being redesigned. Leave them as they are.
