# Phase 5b: playtest protocol (Brann and the roster)

*The post-merge readability gates for [Phase 5b](../phase-5b.md), exit criterion 5.* The automated
gates were the merge gate: the ΔE tests, recaps that name an answer for every Brann down, no dome
or Kael text for a party without Kael, and every Brann rule shown where the player looks. This
page is what people have to confirm, and how to run and record it.

## The gates

| # | Gate | Pass |
| --- | --- | --- |
| G1 | **Cold read.** A reader new to Brann reads Prep's picker and his card, his party frame in a fight, and the 'New ally' card, and rates how well they understand each, 1 to 5 (the [Phase 4h](../phase-4h.md) method). | Each of the three surfaces scores **≥ 4/5** |
| G2 | **The healing cut, before his second fight.** A new player, after one fight beside him, can say in their own words that the Weaver's healing on him is halved, and that Wards and barriers aren't. | **≥ 4 of 5** players, asked before his second fight |
| G3 | **Bloodletting reads as a choice, not a hit.** Watching his frame and the bar over his head as he Bloodlets, the player doesn't say he was hit, and doesn't Mend him for it. | **≥ 4 of 5** players |
| G4 | **Bloodlust reads.** After a Rally he refuses (below 40%), the player can say why he didn't come back, and name Reel or a Ward (Iron Will) as the answer. | **≥ 4 of 5** players, unprompted or after "what happened there?" |
| G5 | **His downs' recaps.** On the Result after a Brann down, the player reads the recap line and can say what they would do differently. | **≥ 4 of 5** players |
| G6 | **Movement II identity.** In a Crimson Spire fight (bone, crimson, the Bloodmoon), the player can point Brann out among the Legion at a glance, by his silhouette and brass trim. | **≥ 4 of 5** players; include at least one red-green colour-blind player if one is available, and record it |
| G7 | **He steps out of others' blows (rebalance).** After a cleave swung at Kael (or a lance at Vexis) that Brann walks round, the player can say that he keeps out of blows aimed at the others and that the ones aimed at him are theirs to Ward. | **≥ 4 of 5** players, after "what did Brann do there?" |

G1 and G2 are the design's two named gates (exit criterion 5). G3 to G7 are the human halves of
rules whose automated halves already pass (`tests/renderBrann.test.ts`, `tests/uiPhase5b*.test.ts`,
`tests/meta/recapNoDome.test.ts`, `tests/colorVision.test.ts`, and for G7, added with the
rebalance, `tests/sim/brannSidestep.test.ts`).

## Who

- **Five players for G2 to G7**, new to the game or within their first few hours, and new to
  Brann. Not anyone who worked on Phase 5b.
- **One or more cold readers for G1:** no docs, no code and no play; screenshots and the card text
  only, as in Phase 4h. A fresh agent session can stand in, as it did there, but record which.

## Setup

- **Build:** the playtest demo (`npm run build:demo`, see [docs/demo.md](../demo.md)) or a local
  `npm run dev`. Sound on: the war drum and the alert rule are part of what is tested.
- **G2 to G7:** start **Veteran** in the demo. The veteran has Brann recruited, so Prep opens on
  the picker with the default party chosen. Ask the player to take Brann (drop one starter). For a
  fresh-start player, use Settings → Progress → *Skip the unlocks* to bring him into the roster;
  note that the setting also opens every other system, which is more to read.
- **The order of fights:** the first fight of the run (First Light, or the Crimson Gate when
  testing Movement II for G6). Ask the G2 question **on the Result of that first fight, before the
  second fight starts**.
- **Party for G4:** a party without Kael (Lyra, Vexis, Brann) makes refused Rallies frequent; a
  Rally needs to be called while he is below 40%. If it doesn't happen in play, ask the player
  to call one when his frame shows the Bloodlust chip.
- **Screenshots for G1** (taken from the build, or from UiLab's 'Brann' group):
  1. Prep with the picker open, Brann chosen, his card's Passive and Needs rows, and the
     missing-starter note.
  2. His party frame mid-fight: below 40% (the raging band, the rage % chip, the Bloodlust chip,
     the heal-cut hatch) and once above 50% (no chips but the ticks).
  3. The 'New ally' card.

## Script

Read it as written; don't explain the mechanics before the questions.

1. **Prep.** "Choose the three heroes you want to take." Note whether they read his card before
   choosing. Then: "What do you think Brann needs from you?" (G1 reading, recorded as notes.)
2. **First fight.** Let them play. Note out loud anything they say about his life, healing him,
   or him being hit. Watch for a Mend aimed at him right after a Bloodletting (G3).
3. **On the first Result, before continuing (G2):** "How does healing Brann work, compared with the
   others?" Then, if needed: "Is there anything that works better on him?"
4. **After a refused Rally (G4):** "What happened there?" Then: "What could you do about it?"
5. **After a Brann down (G5):** "Read the line under his name. What would you do differently?"
6. **After a cleave or lance aimed at Kael or Vexis that Brann stepped round (G7):** "What did
   Brann do there?" Then: "And when one is aimed at him?"
7. **Movement II (G6):** In a Spire fight, pause and ask: "Point to Brann."
8. **Close:** "Was anything about Brann confusing, or did anything look like damage when it
   wasn't?"

## Scoring and recording

- **G1:** each surface 1 to 5. 5: every rule on it understood. 4: the main rule (healing halved,
  Wards and barriers aren't, he fights harder low) understood, a detail missed. 3: the main rule
  half-understood. 2 or less: misread.
- **G2 to G7:** pass or fail per player, with their words quoted.
- Record each session in a table like this, one per gate, and keep the quotes:

| Player | Start | Party | G2 | G3 | G4 | G5 | G6 | G7 | Notes and quotes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | Veteran | Kael, Lyra, Brann | | | | | | | |

| Reader | Prep (1-5) | Frame (1-5) | 'New ally' (1-5) | What tripped them up |
| --- | --- | --- | --- | --- |
| R1 | | | | |

## When a gate fails

Change the words or the cue, never Brann's numbers (those are the bands' business, see "Measured
bands" in the design). Then read again with a fresh reader or player. In order of what to try:

- **G1 or G2:** the 'New ally' card's lines (`allyOf`, `src/ui/hud/sighting.ts`), his Needs row
  (`HeroDef.needs`), the `brannLow` hint, and the Codex's stacking line (`healCutStackText`).
- **G3:** the drain segment's colour and hold (`BLOODLET_DRAIN_S`, `DRAIN_HOLD`), and the
  Bloodlet chip's wording.
- **G4:** the Bloodlust chip and the refused-Rally hint; the 'refused' glyph on the Rally ack.
- **G5:** `downAdvice`'s wording (`src/meta/run.ts`).
- **G6:** the brass trim's size on the model (not its colour: `#a6a650` is held by the ΔE tests).
- **G7:** his Needs row and Codex line ('Ward the blows aimed at him: he steps out of the rest').
  His movement is the bands' business, like his numbers.

Record the result here, under a dated heading, with what changed and the new scores.

## Results

*None yet: the gates run after the merge.*
