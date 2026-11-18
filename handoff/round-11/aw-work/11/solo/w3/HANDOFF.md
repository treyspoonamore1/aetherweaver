# Solos, step W3: hand-off (HUD, hints, text, the mark)

*18 November 2026 · branch `p11/solo-w3` in `/home/user/aw-work/wt-p11solo-w3`, from `8572e48` ·
read `W0-HANDOFF.md` section 4 first.*

## 1. Where it stands

**W3 is at its finish line.**

- Final commit: **`52fe225`** on `p11/solo-w3`. The tree is clean.
- Typecheck (all three configs) and lint (ESLint with no warnings allowed, and the formatter):
  clean.
- The 13 failing tests W0 listed as W3's all pass, rewritten for a game with no Cue key and no
  Cue price. Two new test files hold the successors W3 owed.
- **Unit suite, whole:** 5,453 tests: 5,410 pass, 31 fail, 10 are skipped and 2 are marked
  to-do. That run was on `fac6f65`, the commit before the last. One of the 31 was mine
  (`tests/loomHub.test.ts`: my shorter Loom line had dropped what a Solo is); the last commit
  puts it back, and that test and its neighbours pass. So **30 fail on the final commit, none of
  them in a file I own**:
  - 3: the aura pin's stored version (below).
  - 13: W1's baselines (`harnessTools` 4, `meta/expedition2Pin` 2, `meta/finaleHandoff` 2,
    `meta/movement3Handoff` 2, `meta/rosterHandoff` 2, `sim/rosterInvariance` 1), as W0 listed.
  - 8: W2's. The 6 W0 listed (`inputController` 1, `inputPhase7` 3, `gamepad` 2), and 2 more in
    `tests/inputNamesW3b.test.ts`, **which my change turned red**: the base's copy of that file
    still expects the key reminders to show a Cue row ("⇧1–4"), and the row is gone. W2's branch
    has rewritten the file; it goes green at the join.
  - 6: W4's sound tests (`audioConducting` 1, `audioPhase5` 2, `audioPhase5c` 1,
    `audioSpireSnapshot` 2), as W0 listed.
  Log: `/home/user/aw-work/11/solo/w3/logs/suite.log` (and `suite.json`).
- Aura: `tests/aura/chordCardsPin.test.ts` passes. `tests/aura/presentationPin.test.ts` fails
  in its 3 tests, and the only line that differs is `"simVersion"` (22 stored, 23 now); I checked
  the printed difference, and nothing else is in it. Nothing under `tests/aura/`, neither pin,
  none of the eight aura files and not `AURA_APPROVED` was touched. The Weaver bar's song chips,
  which that pin records, did not move.

## 2. What changed, in plain language

### What a player sees in a fight

1. **A strip on the party frame says a Solo is coming, and what the Thread makes of it.** It has
   two stages, from W1's study of a person's hands (the moment to move is when the Solo is full):
   - *Coming* (the last 3 seconds of charge): quiet. The Solo's name in a dashed outline and the
     seconds left.
   - *Full* (the 1 second wait): loud. A solid gold outline that glows: **"Thread to Cue"** and
     the seconds.
   - *Your Thread on that hero*, at either stage: a filled gold strip with a tick, **"Cued"** and
     the Solo's name, and the ring round the portrait doubles.
   - Under Silent Cues, with the Thread on them but not yet long enough: "Hold 0.6 s".
   - Kael's strip shows no seconds: he may raise his wall sooner than any count.
   The AUTO tag and the key cap under a ready portrait are gone. The seconds are the sim's own
   (`soloDueIn`); "Cued" is the sim's own rule (`threadCues`).
2. **A mark over the hero in the world** (new file `src/render/soloMark.ts`). A ring in the slot
   the Thread's glyph takes over a head, filling clockwise until the Solo fires.
   - Thread elsewhere: a **dashed ring round a note**. Smaller and dimmer while the Solo charges;
     full size, brighter and breathing once it is full.
   - Thread on them: a **solid ring with eight rays** and a light behind it, a third larger,
     round the Thread's own glyph. It pops once as the Thread arrives.
   - Silent Cues: a second ring outside the first fills as the Thread holds.
   - It moves up while a call's bubble is open over the hero, and stands down while a Fermata
     holds them (the hold's marks have that slot).
   - Reduced motion: nothing breathes or pops; only the fill moves. Colour vision: it takes the
     palette's "call" colour (gold; white under the three colour-vision palettes). Cost: two
     sprites a hero at most, in a batch that already exists; no new draw call.
3. **The Resonance meter** has no Cue ticks and no "Cue 25". The Dissonance chip no longer
   states a Cue's cost. The gold ticks on the Weaver's Resonance orbit (Silent Cues' old look)
   are gone, and the Cantor's Hymnal call-out says "HYMNAL", not "HYMNAL · CUE READY".
4. **The Conductor.** The badge says **Duet** or **Trio** and nothing else (no price, no "Free");
   it sits on the strip of a hero whose Solo is coming, outlined until your Thread is on them,
   then filled. With A Tempo the beat strip shows when the next Solo begins: the downbeat's band
   lights, and the hero's initial stands beside the strip in their colour, ringed gold when your
   Thread is on them. A Solo Cued on the beat raises "On the beat · +N Resonance", N being what
   the meter gained.
5. **Call-outs** when a Solo fires: "Cued · Lyra: Gale Barrage" when your Thread was on her,
   "Lyra: Gale Barrage" when it was not.
6. **The coach.** Four lessons, each 18 words or fewer:
   - A Solo coming, Thread elsewhere: "Lyra's Gale Barrage is coming. Thread them {2} to Cue it:
     the stronger form".
   - Kael's wall full and a hit coming for more than one hero (from W1's new rule): "A hit is
     coming for the party. Thread Kael {1}: Cued, his wall shields everyone". Blind Score hides
     it, as it hides every answer.
   - The Conductor's chain: "Duet next. Thread Kael {1} as their Solo fires".
   - A Tempo: "Solos begin on the downbeat. Each one you Cue gives N Resonance".
7. **The primer's last row** is "Cue their Solos": "Heroes fire their own Solos. A Solo fired
   with your Thread on them is Cued: the stronger form." On a Conductor run it is "Duets and
   Trios". The key reminders have no Cue row.
8. **The Codex** has a "Solos" entry on the Weaver's page (the same sentence, and the sim's own
   seconds), and its Resonance entry no longer describes buying a Cue. The gains it lists are
   shown as the meter gains them.
9. **Result and Summary.** "7 Solos Cued, 1 Crescendo sung." The Summary's tile is "Cued Solos".
   The Conductor's line says "4 Solos Cued on the beat" where it said "4 free Cues", and his two
   tips say how a Duet is made now. The screens' layout is untouched.
10. **An old replay** is answered with "This replay is from an earlier version. It can’t be
    played back." (W2 asked for the key; it shows when W2's `refused: 'oldReplay'` arrives.)

Nothing on screen names a Cue key. `tests/uiSolos.test.ts` checks the frames, the meter, the key
reminders, the primer and every HUD and screen message for it.

### The labs

- **VFX lab, Conductor scenes** (`src/render/lab/conductScenarios.ts`): every Solo is charged and
  the Thread goes to each hero as their Solo comes due (`followSolos`, by `soloDueIn`). Lyra,
  Vexis, then Kael fire a second apart: a Duet, then a Trio. Sturdier foes (Bell Brutes) so the
  third hero still has someone to fight.
- **UI lab, Conductor scenes** (`src/ui/lab/conductingMock.ts`): the same. The Trio is Lyra,
  Vexis and Kael's wall (he raises it at once when a blow takes him under half his life).
- **UI lab, new views**: "Solo strip: coming, Thread to Cue, Cued" and "Solo strip: Kael's wall,
  coming, Silent Cues' hold" (`?lab=ui&view=hud-solos`, `hud-solos-more`).
- **VFX lab, Silent Cues scene**: the hold ring on the mark, then the Cued look.
- The unused `autonomy` flag is gone from the lab scenes.

## 3. The pictures

All in `/home/user/aw-work/11/solo/w3/shots/`. 1280 × 720 at twice the pixels where a whole
screen is shown. I opened every one.

| File | What it shows |
|---|---|
| `1-the-mark-tell-wait-thread.png` | Lyra: charging (no mark), Solo coming (the tell), Solo full (the wait, Thread elsewhere), Thread on her (Cued look), the Solo firing. Close-up, and the game camera enlarged. |
| `2-four-heroes.png` | Kael, Lyra, Vexis and Brann (the largest): coming, full with the Thread elsewhere, Thread on them. Close-up and game camera. |
| `3-boss-fight.png` | Five frames of a real Hollow Cantor fight with the whole HUD, the Skilled bot playing: a Cued ring beside a plain one, red-outlined choristers, a call, a decree. One frame shows the mark's limit under Kael's dome. |
| `4-beside-other-marks.png` | The mark with a call's bubble (it moves up), and with bleed pips, a Wound and the Chime badge. |
| `5-colour-vision.png` | Normal and the three colour-vision palettes: gold, or white. |
| `6-party-frames.png` | The strip's states, and the Conductor's Duet and Trio badges. |
| `7-meter-and-beat-strip.png` | The meter without the Cue's price; A Tempo's strip with the next Solo's hero. |
| `8-primer.png` | The primer, plain and on a Conductor run. |

Raw pictures: `w3/raw/`. Scripts: `w3/scripts/` (`mark.mjs` the lab, `boss.mjs` the real fight,
`ui1.mjs` the UI lab, `sheets.py` the sheets).

**What the pictures show that I would tell the owner:**

- Under Kael's dome the heroes are wrapped in bright shells, and a plain ring over a hero is hard
  to see against them (sheet 3, second frame). The frame's strip still says "Thread to Cue". The
  mark is drawn as light, like the other marks; a dark backing would need a new kind of batch.
- Bleed pips sit inside the ring over the note (sheet 4). They already sit inside the Thread's
  glyph (Version 19's "combo"). The ring, its fill and its rays still read.
- Vexis's staff tip stands inside her ring (sheet 2). It reads, but it is the most crowded of the
  four.
- With a call open and heroes standing in a line toward the camera, a raised ring can fall on the
  hero behind (sheet 3, first frame).

## 4. Text: word counts

`/home/user/aw-work/11/solo/w3/WORDS.md` lists every line with its words before and after
(`scripts/words.py` regenerates it). A placeholder counts as one word.

| | Lines | Words before | Words after |
|---|---|---|---|
| Reworded | 35 | 635 | 451 |
| Removed | 35 | 287 | 0 |
| New | 31 | 0 | 286 |
| **All** | 101 | **922** | **737** |

**The menu pass's 55 left lines:** 23 shorter, 14 gone, 3 the same length, 1 longer, 14 kept.

- *The same length (3):* "Resonance is full. Press {R} for Sunrise" (the dash went); the
  Result's "{n} Solos Cued" (its partner " , {n} Crescendo sung" is a word shorter, so the
  sentence is); the Summary tile's sentence (only "Cued" gained its capital).
- *Longer (1):* the Summary tile's label, "Cues" to "Cued Solos". One word more, so the tile
  needs no glossary. Say if you want "Cued".
- *Kept (14):* four are one- or two-word labels ("Solo · {name}", "Crescendo", "Crescendo:
  {name}"). **Ten wait for the input step**: the Hero autonomy rows (Settings, Prep), the Cue
  modifier rows and the pad's Cue row. W2's screens stop reading them on its branch; on mine they
  are still read, so deleting them here would not compile. They go at the join (section 6).

Other lines outside the 55, in the 22 files: the frames', the Conductor's, the Codex's, the
Dissonance chip's. All in WORDS.md.

**"Cued" is explained in one phrase everywhere:** "fired with your Thread on them" (the primer,
the Codex, the strip's tooltip). The coach says what to do: "Thread them to Cue it".

**Resonance amounts in text.** No text of mine states one as a literal. The Codex's gains, A
Tempo's gift on the strip, the call-out and the coach's line take the content's number times the
sim's scale, to one decimal, so they read true before and after W1's fold. One thing to know:
the Conductor gains 10% more Resonance, so A Tempo's card says "15" and the HUD says "+16.5",
which is what the meter gains.

**Not touched, as told:** the Chord builder's aura text (two lines there say "every Cue releases
a pulse"; they read correctly with the new meaning), song chips, the Codex's Auras and Songs
pages, every aura line the menu pass listed. Oro's two glossary lines in `rosterModel.ts` are as
they were (I shortened them, a test showed the old wording carries a fact, I put them back).

**Content wording for W1:** `/home/user/aw-work/11/solo/w3/CONTENT-WORDING.md`. 16 lines, in
three groups, with the two constraints the UI puts on them (the Requiem decree's first sentence;
"Grand Finale replaces Sunrise"). W1's progress note says it is applying them.

## 5. Tests

**Rewritten (they tested the Cue's price or key):**

- `tests/uiConducting.test.ts`: the badge (Duet, Trio, none for a plain Cue, no price); the beat
  strip (when the next Solo begins, from `soloDueIn`; nothing says "Free"); the live beat; the
  Dissonance chip under Silent Cues; the call-outs; the chain and beat hints; the Result's line.
- `tests/uiPhase4d.test.ts`: Silent Cues is a hold on the HUD, never a price; the frame says
  Hold, then Cued.
- `tests/uiPhase4e.test.ts`, `tests/uiPhase5dReview.test.ts`: the Solo hint in place of the Cue
  hint; a stilled hero has no tell.
- `tests/renderDissonance.test.ts`: Silent Cues' picture is the hold ring on the mark; no ticks
  on the orbit.
- `tests/renderConducting.test.ts`: a Solo Cued on the beat sparks, a plain one does not; the
  lab's scenes follow the Solos.
- `tests/renderRelics.test.ts`, `tests/uiPhase3d.test.ts`, `tests/uiPhase5d.test.ts`: reworded
  lines.

**New:**

- `tests/uiSolos.test.ts` (15 tests): through a 45 second fight every frame's seconds and Cued
  state equal the sim's `soloDueIn` and `threadCues`; the strip's states; Kael's no seconds;
  nothing on the HUD names a Cue key or price; the coach's lines and their word ceilings; the
  Codex's gains; the old-replay sentence. This is the successor to `uiFill`'s "the Cue's price on
  the HUD is the sim's".
- `tests/renderSoloMark.test.ts` (11 tests): the mark's seconds and looks are the sim's; where
  it is drawn; the pop; the raise over a call; the hold ring; Reduced motion; Flashes at 0; two
  sprites a hero; 30 or more from danger, Mend and the enemy outline in every colour vision.
- The successor to "the beat hint says what a Cue on the downbeat costs" is in
  `tests/uiConducting.test.ts`: "the chain hint names the link, the hero and their Thread key;
  the beat hint what A Tempo gives".

**A recorded result I re-recorded, and why:** `tests/uiPhase5e.brann.json`, the pin that holds
Brann's and the default party's UI byte-equal. 19 of its 76 keys moved (17 `frames:*`,
`hints:crisis`, `hints:boss`). I dumped the pin's contents on the base and on my tree and
compared them piece by piece: the Solo ring's wrapper, the Cue key cap's removal, the Solo strip
in the two scenes whose Kael has a Solo coming, and the coach's two new lessons. Nothing else:
no life bar, no status, no Brann chip, no Fermata. The reason is written in the test.

**Fight-derived picture snapshots, not re-recorded (as told):**
`tests/renderSpireSnapshot.test.ts` (`GEN_SPIRE_SNAPSHOT=<file>`) and
`tests/renderRiftSnapshot.test.ts` (`GEN_RIFT_SNAPSHOT=<file>`). They pass on my branch (the
fights are W0's). They follow W1's final goldens and are recorded after the join.

## 6. What I need from other steps

### W1 (sim, content, tools)

1. **Content wording**: `CONTENT-WORDING.md` (above).
2. **`soloDueIn` returns the whole wait for a full hero with no one to fight**, who will not fire
   (W2 found the same). Three places in my files guard against it with the same test (`solo >=
   100`, no target, not Oro): `soloTell` in `src/ui/hudBridge.ts`, `nextSolo` in
   `src/ui/hud/conducting.ts`, `soloMarkOf` in `src/render/soloMark.ts`. If `soloDueIn` answers
   null there, the three guards can go.
3. **Two heroes due on the same moment show the same seconds.** `soloDueIn` knows the gap after
   the last Solo, not that another hero will fire first. With A Tempo, Lyra and Vexis both read
   "1.1", and one of them then jumps a bar. An order among the heroes inside `soloDueIn` would
   mend it.
4. **A count of plain Solos in the fight's tallies** (added, not changed). The Result can then
   say "7 of 9 Solos Cued" when those screens are reworked. Today it has only the Cued count.
5. **`rootHold`** (your section 4): a Solo can sit full with the count at 0. The strip hides its
   seconds at 0 rather than show a standing "0.0". Nothing needed; say if the count should read
   another way.

### W2 (input)

1. Done from your list: the old-replay key (`screens.atlasModel.replayTooOld`, shown by
   `replayMessage` in `src/ui/screens/atlasModel.ts` when `refused === 'oldReplay'`); the
   Auto-Thread hint; the mouseover and pad lines; no Cue key in the key reminders, the primer or
   the Codex. `bindingLabel('cue')` is no longer called anywhere in my files, and
   `CodexScreen.tsx` no longer reads `cueModifier`.
2. **Still there, on purpose:** `cueModifierMark` in `src/ui/hud/labels.ts`. Nothing on the HUD
   calls it now. I left it because the base's `tests/inputNamesW3b.test.ts` (yours) imports it,
   and my worktree must typecheck. Your branch's test no longer does, so it can go at the join.

### W6 (the join)

1. **Delete at the join:** `cueModifierMark` and the modifier branch of `inputLabel`
   (`src/ui/hud/labels.ts`), then W2's three `SOLO-JOIN` stand-ins.
2. **Text keys to delete at the join** (W2's screens stop reading them; mine never did):
   `input.options.cueModifier`, `input.options.cueModifier.hint`, `input.padAction.cueReticle`,
   `input.controls.pressModifier`, `input.controls.pressModifierAria`,
   `input.controls.modifierName`, `input.controls.cueHint`, `a11y.settings.heroAutonomy`,
   `a11y.settings.heroesFireTheirOwn`, `screens.prepScreen.heroAutonomy`,
   `screens.prepScreen.heroesFireTheirOwn`; and, once `cueModifierMark` is gone,
   `input.labels.cueShiftMark`, `input.labels.cueModifierMark`, `input.modifier.Shift`,
   `input.modifier.Control`, `input.modifier.Alt`. `tests/textLayer.test.ts` will name the two
   `screens.*` ones as unused until they go; `tests/uiSolos.test.ts` lists those two as held
   (its `held` set), and that set should be emptied with them.
3. **Tests of mine that quote another step's words and will fail at the join:**
   - `tests/uiPhase5ePresentation.test.ts` lines 195 and 196, `tests/uiPhase5e.test.ts` line
     594: Seren's recap line, which W2 reworded ("…or Thread her as Thousand Cuts fires.").
   - Any test that quotes a content line W1 takes from `CONTENT-WORDING.md`. I found none in my
     files; `tests/uiPhase4d.test.ts` checks only that the Requiem decree's first sentence names
     neither Ward nor dome, which the proposed wording keeps.
   - The lab has four copies of the Requiem decree (`src/ui/lab/UiLab.tsx` lines 220 and 997,
     `src/ui/lab/mock.ts` lines 542 and 1115). When W1's wording lands they should follow; the
     Brann pin's `decree` key may then move.
4. **Browser tests** (`e2e/smoke.spec.ts`, about lines 793 to 830): the Conductor's test reads
   `cue-cost` and presses Shift+number. Test ids that went: `cue-tick`, `cue-cost`, the meter's
   `data-cue-cost`, `beat-free`, the badge's `data-free`. Test ids that came: `solo-strip` (with
   `data-state` coming, now, cued or hold), `solo-say`, `solo-in`, `solo-ring` (`data-coming`,
   `data-cued`), `solo-count`, `beat-next` (`data-cued`), the strip's `data-armed`, the badge's
   `data-on`.
5. **Docs** (yours): `docs/solos.md` "Still to do" (HUD, hints, text and the mark are done);
   `docs/voice.md`'s last line, which says the Solo and Cue lines are held; `docs/phase-5f.md`
   (the badge, the beat strip, no free Cue); `docs/phase-4d.md` and `docs/phase-4d/` (Silent
   Cues' look).
6. **After W1's final goldens:** the two picture snapshots in section 5.

### W4 (sound)

Nothing.

## 7. Choices the owner may want to look at

1. **The mark sits in the Thread glyph's slot**, so that with your Thread on the hero the ring
   closes round the Thread's own glyph. The Thread's glyph itself is untouched. If the owner
   would rather the mark never share a slot with anything, it can stand higher; it would then
   be further from the hero.
2. **The strip appears in the frame for about four seconds a Solo**, so a frame grows and
   shrinks, as it already does for a call. A fixed row would stop the movement and cost a line
   of height always.
3. **The coach's Solo lesson shows three times** and then stops, like every hint. The strip and
   the mark carry it from then on.
4. **The Result says "7 Solos Cued"**, not "7 of 9" (W1, item 4).
5. **The Summary tile's label grew by a word** ("Cued Solos").
6. **The Conductor's sighting card lost its last sentence** (what is heard in the Grand
   Silence). The coach says it when the Silence begins, for this Weaver's own techniques. The
   card went from 40 words to 19.

## 8. What I did not check

- **The browser tests in `e2e/` were not run.** The Conductor's test will fail (section 6).
- **Nobody has played it.** The frames and the mark were looked at in pictures: the labs, and one
  real boss fight driven by the bot. Whether the strip and the ring are noticed in time by a
  person is not measured here; W1 measured the hands, not the eyes.
- **The mark in motion.** I looked at stills. The breath, the pop and the fill are tested as
  numbers, not watched.
- **Reduced motion and Flashes** on the mark are tested in code, not pictured (a still shows no
  difference).
- **The mark with Oro, Seren, Hollow Crown, A Tempo and the Grand Finale** in the world: read
  from the rule and, for Hollow Crown, unit-tested; not pictured.
- **Performance** was not measured. The mark adds two sprites a hero to an existing batch.
- **The pseudo-language** (`en-XA`) passes its test; I did not look at the new lines in it for
  clipping.
- **`npm run build`** ran once for the pictures; `tools/release-check.ts` was not run.
- **The whole suite ran on the commit before the last** (above). On the last commit I ran
  typecheck, lint, and the four test files the one changed sentence touches.
- **The join.** My branch has not been merged with W1's, W2's or W4's.
