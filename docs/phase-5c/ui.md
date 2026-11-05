# Phase 5c UI: the Unstitched on screen

*Workstream W8 of [Phase 5c](../phase-5c.md).* Every new piece keys on a HUD key that only
Movement III sets (`HudSnapshot.rift`, `WeaverHud.runeLocked/threadCut/unravelLeft/stolenAura`,
`HeroHud.possessed/stitchedWith`, `BossHud.spindles/stolen/unravelLeft/mirrorWard/champion/
stitched`), on a status only Movement III content applies, or on content (`movement`, `biome`).
A Movement I or II snapshot carries none of them (`tests/uiPhase5c.test.ts`), so those fights
draw as they did. The lab's 'Movement III' group (`src/ui/lab/UiLab.tsx`, mock data in
`src/ui/lab/mock.ts`) shows every state below.

## The HUD

| Piece | What it shows | Where |
| --- | --- | --- |
| Answer glyphs | `thread` is **Retarget** (the Thread with a cut mark, `threadCut`; its glyph shows the hero keys, '1–3' as bound, `answerKeyLabel`), `empower` is **Empower** (its star, the Thread-mode key). | `hud/labels.ts` `ANSWER` |
| Statuses | Each with its glyph and answer: Doubted (mask), Possessed (mask; 'Chime frees them; Focus the Wraith before its cast ends'), Doom (skull, '×N/5'), Ignited (`doomed`), Voided (maw; 'Rally or Reel them out'), Stitch and Stitched (needle; 'Chime frees both'), Unravelled ('Your Mend wounds — Empower'), Emboldened (mirror, on enemies). | `hud/labels.ts` `STATUS` |
| Icons | scissors, needle, spindle, mask, rune, mirror, maw, threadCut; the three Rift relic glyphs (lamb, cord, stillbell). | `kit/iconPaths.ts`, `kit/RelicGlyph.tsx` |
| Doom badge | Counts against its ignition from the first stack ('×3/5'), glows with the Chime glyph from 4 (`DOOM_EMPHASIS = DOOM_CHIME_AT`). Bleed keeps its 5. | `hud/StatusBadge.tsx`, `hud/legionLook.ts` `stacksUrgent` |
| Possession | An indigo frame border (never the enemy bar's red or Focus gold), a 'Possessed → Kael' strip with the Chime glyph (hidden under Blind Score). The victim is the sim's own `possessionVictim`: never the Weaver. | `hud/RiftMarks.tsx`, `hud/PartyFrames.tsx` |
| Stitch | A needle-and-link chip naming the hero the same Stitch joined them to (paired by the status's source). | `hud/RiftMarks.tsx` |
| Rune lock | Per key: `slotSilenced(key, downed, runeLocked)` greys Ward, Chime and Reel (Rewind) inside a Null rune under a bone rune-and-lock overlay; **Glide never greys**. A 'Rune: Glide out' badge with Glide's key sits on the bar's left edge, in one row beside the contribution readout (`WeaverEdgeBadges`), so it never covers it; the Mute's 'Auras silenced' keeps the right edge. The bridge reads the sim's `weaverSilenced`. | `hud/techniqueState.ts`, `hud/WeaverBar.tsx` |
| Thread chip | After an **enemy** cut, 'Cut · 3.0 s (Snip)' instead of 'Snapped' (the range snap still reads 'Snapped'); while Unravel is open, 'Unravelled · 5 s' with the Empower glyph (alarmed in Mend, calm in Empower). The dial's plate says the same. | `hud/threadMode.ts`, `hud/WeaverBar.tsx` |
| Stolen aura | Hollow and struck through, with a Focus pointer; its Spirit or Life stays reserved (the tooltip says so). | `hud/WeaverBar.tsx` `AuraChip` |
| Boss conditions | The Bloodmoon line is now one of a list (`bossConditions`), each a glyph, a word and its meaning: Spindles ×N (−80%), a stolen song, Unravel, the Mirror Ward (casting / up), the Hollow Champion (a mini bar), Stitched heroes. Under Blind Score the answer after '·' is hidden. | `hud/riftLook.ts`, `hud/BossBar.tsx` |
| Cast glyphs | The Seamstress's needle, the Unweaver's scissors. Needle Rain's 1/3–3/3 pips come from its follow-up chain (`blowsOf`). | `hud/legionLook.ts` `CAST_ICON` |

## Hints

Each with its own id, so no existing hint's count moves; all but two are answer hints (hidden by
Blind Score):

- `rune` (not an answer hint: it says why an input was refused) — Glide or walk out. This is a
  separate technique-silence hint; the Mute's aura `silenced` hint is untouched (it says 'the
  Silencing elite' when no Mute is on the field).
- `cut` (not an answer hint) — re-thread the moment the lock ends.
- `cut-coming` — a cut line will cross the Thread: Thread a hero on your side, or step across.
- `inhale` — Rally in the tell ('Swap puts you in the Maw' with the Swap variant), or Reel one out.
- `possessed`, `wraith` — Chime frees them; Focus the Wraith or Chime the mark. `wraith` follows
  `rift.wraithCasting` (the bridge sets it while a `doubt` mark is in its windup) and names the
  hero the mark is on; it goes the moment the cast is interrupted.
- `doom` — at 4+ stacks or Ignited: Chime, or Ward the blast.
- `stitched` — Chime frees both.
- `unravel` — Empower (or Bear on a Martyr run) until it passes.
- `spindles`, `verse` (a Luminary hears that Radiance counts one aura fewer), `mirror-ward` — Focus.
- `mimic` — cast the other technique (or Mend instead of Empower) to crack the mirror.

Guard Strand is never taught.

## First sightings and recaps

- **Sightings.** Every Unstitched foe, add and boss has a lesson (`riftLesson`). On a Chronomancer
  run the cards never teach Reel: the Maw's says 'Rewind takes back a hero you lost to the pull',
  the Null Priest's names Rewind. Paradox is named only when it is on the path
  (`hud.calling.tiers`).
- **Recaps.** `riftDownLine` (ahead of the generic answers): 'Lyra, struck by Kael (possessed):
  Chime frees them'; 'Doom: Chime before five, or Ward the burst'; 'Pulled into the Maw: Rally or
  Reel' (Rewind on a Chronomancer run); 'Snip: Retarget off the line'; 'Your Mend, unravelled:
  switch to Empower'. It keys on the killer as the sim names it, so every Movement I and II death
  keeps its line.

## Map, copy and the Reliquary

- **Backdrop.** A biome → tone table (`biomeTone`) replaces the crimson ternary; the Rift's tone
  `'abyss'` is an indigo glow with a few drifting bone threads (never Mend's teal).
- **Movement card.** Styled per biome (`movementCardLook`): the Rift's indigo eyebrow and glow,
  and 'Descend'.
- **Route copy.** Derived from `EXPEDITION_MOVEMENTS`: the Title's 'Movements I–III · The
  Expedition', the Route hint 'Movements I–III, to the Unweaver.', Prep's 'climbs on through
  Movements II–III'. Prep reads the run's own length (`expeditionLength`): a two-Movement
  Expedition saved before Phase 5c reads as it did then. With two Movements every string reads as before, and every Prelude string is
  unchanged.
- **Ends and spoils.** VICTORY 'The Unweaver falls, and the Rift knits shut.'; ENCOUNTER_ICON
  needle and scissors; SPOILS for Vharun ('The Warden's armoury … the Rift yawns below') and the
  Seamstress; the Discord Tear names only the last Movement's boss.
- **Deeds.** Whole Cloth keeps the Thread; Needle-Sure takes the needle.
- **Reliquary.** A Rift relic shows 'Wakes in the Abyssal Rift' on its card, in the carry slots,
  in its label and in the Codex, and its shelf tile carries the sleeper's moon (`WakesMark`) (`wakesLabel`, from the meta's `wakesIn`).
- **Codex.** Enemy entries show 'never moves' (stationary), a Spindle's tether, and 'Cuts your
  Thread' on a cut attack.

## Input

For `CUT_FALLBACK_SECONDS` (3 s) after an **enemy** cut (`threadSnapped` with a `cause`; the
range snap has none), an un-hovered Ward or Reel goes to the hero the Thread was on
(`InputController.onThreadCut`, fed by the runtime through `heardCut`). A hovered or threaded hero
still wins. The sim is unchanged: the command simply names the slot.

## Outside the UI files

- `src/app/runtime.ts`: hears an enemy cut (`heardCut`), keeps it for the Thread chip and tells the
  input. Additive, and silent outside Movement III.
- `src/ui/kit/RelicGlyph.tsx`: three relic glyphs.

## e2e

The Expedition smoke now plays Movements I–III: the Crimson Gate, Vharun as an interlude (relic →
draft → map), the Rift's title card, the Frayed Threshold, the Unweaver and the victory line; its
`winRun` walks to the Unweaver. A Movement III smoke checks Prep's route copy, `warpMovement(3)`,
the Rift's card and backdrop, and that Glide is never rune-locked in a Rift fight.

## Left for W9

- `ROUTE_MINUTES.expedition` (Prep's '~30 min') takes its measured value.
- The overlay's `GlyphIcon` 'thread' entry (W0b's stub) and the render's own cut callout belong to
  render.
