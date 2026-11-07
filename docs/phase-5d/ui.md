# Phase 5d UI: the Finale on screen

*Workstream W8 of [Phase 5d](../phase-5d.md).* Every new piece keys on a HUD key that only the
Finale sets, filled from `field.finale` and the `stilled` status (`src/ui/hudBridge.ts`):
- `BossHud.discord {value, max, rate}`, `fortissimo {pulse, of}`, `silence {notes, of, sources,
  left, cap}`, `cue {soloist, solo, target?}`;
- `HeroHud.stilled`;
- `CalloutKind 'note'`.

A Movement I-III snapshot carries none of them, bosses included (`tests/uiPhase5d.test.ts`), so
those fights draw as they did. The UiLab's 'Finale' group (`src/ui/lab/UiLab.tsx`, mock data in
`src/ui/lab/mock.ts`) shows every state below. How it looks and sounds in the world is in
[vfx-audio.md](vfx-audio.md).

## The HUD

| Piece | What it shows | Where |
|---|---|---|
| Discord meter | A stave under the boss's life: four segments of 25 with ticks, the number and a brass baton glyph. 'Conductor’s Discord 72/100 · Crescendo cancels Fortissimo Silence'. Blind Score hides only the part after '·'. Never colour alone. | `hud/BossBar.tsx`, `hud/finaleLook.ts` |
| Its countdown | 'Fortissimo Silence in ~14 s', from the current rate; 'Fortissimo Silence now' at 100. | `fortissimoInText` |
| Fortissimo | 'Fortissimo Silence · pulse 2 of 3' with its pips; the meter at 100. | `fortissimoPulseText` |
| The Cue | The boss's cast bar names the soloist and its Solo; the target is named once the Solo begins (1.2 s later). | `cueText` |
| Cast glyphs | CAST_ICON gains the baton (the Conductor's casts) and the music-cut glyph (Fortissimo Silence). | `hud/legionLook.ts` |
| Silence stave | In phase 3 the meter becomes 8 pips, each filled with its note's source glyph (Ward, Chime, Reel, Rewind), and 'Grand Silence · 3/8 notes'. A bar drains to the Coda: 'The Coda in 22 s'. The bar uses the cap fixed when the silence began, so a Stasis inside it can't shrink it. | `silencePips`, `codaText` |
| Silence tint | A full-screen tint, copying the Stasis tint. | `hud/Hud.tsx` |
| Stilled frames | Greyed, with 'Stilled · waits for your song', an aria countdown and a Solo ring that fills a segment per note. A full Solo on a stilled frame is not READY. A downed frame reads 'The song will bring them back' until the Coda. | `hud/PartyFrames.tsx` |
| Reignite | Frames relight gold for a moment; the revived ones rise. | `REIGNITE_LINE` |
| The Weaver | Her bar stays fully lit: she is the only one who can act. | `hud/WeaverBar.tsx` |
| Directives | Every spoke of the wheel greys with 'Frozen' in the silence, and only then. The sim still accepts a Directive (see *Known gaps*). | `hud/DirectiveWheel.tsx` |

## Callouts and captions

- **Callouts:**
  - 'Note 3/8 · Perfect Ward' (also Clutch Chime, Reel-save, Rewind);
  - 'Note 8/8 · The song returns!', which stays though the revives, barks and captions follow it in
    the same frame;
  - 'Lyra and Vexis stand again' after a Reignite with revives;
  - 'Fortissimo Silence — cancelled' (a Crescendo's cancel only);
  - 'The Coda — your heroes wake without the song', with '5/8 notes'.
- **Defeat:** in the Finale the callout reads 'The Conductor’s silence holds.' in place of 'The
  song falls silent…'.
- **Captions** (Settings, `captions`, off by default; settings saved before it load with it
  off): 'The music stops', 'Note 3 of 8 · Perfect Ward', 'Discord rises', 'The song returns'. Each
  has a visual twin with captions off.

## Hints

Each has its own id, so no existing hint's count moves. All three are hidden by Blind Score.

- `discord` (while a Cue is live): 'Every Solo you let through feeds the Conductor’s Discord:
  answer it, or interrupt the soloist (Focus {key})'.
- `fortissimo` (Discord at 75 or more, or the cast live): 'Fortissimo Silence: hold 100 Resonance
  — your Crescendo {key} cancels it', and 'press it now' once it is live and she has the
  Resonance.
- `silence`: 'The Grand Silence: only your Perfect Wards, Clutch Chimes and Reel-saves are heard.
  Eight notes bring your heroes back — even the fallen'. The sources follow the Calling and the
  Reel variant: a Chronomancer hears Rewinds; an Anchor Weaver 'Perfects and Clutches'.
- The Empower hint stays quiet in the Grand Silence.

## First sightings and recaps

- **Sightings** (`crucibleLesson`, in the `legionLesson ?? riftLesson` chain):
  - the Conductor's card names the notes this Weaver can play;
  - each voice's card teaches its Solo's verb, and shows at that voice's first Cue (a voice killed
    before its Cue is still recorded as seen, so the Codex unlocks it);
  - a Chronomancer's card never teaches Reel; a Swap Weaver reads 'Swap takes the blow on you';
  - no earlier foe's card changes.
- **Recaps** (`finaleDownLine`): every Finale down names an answer, and no earlier death gets a
  Finale line.
  - Lament: 'Chime it away, or interrupt the Alto'.
  - Basso Ostinato: 'Ward on the beat, or interrupt the Bass'.
  - Cadenza: 'Reel them out or step aside'.
  - Shatter Aria: 'Scatter so it catches one, and Ward the one it's on'.
  - Downbeat: 'Ward or dome the tank'. The Conductor's own melee names an answer too,
    Calling-aware.
  - Fortissimo Silence: 'Crescendo before Discord fills, or dome, Ward and heal'.
  - Measure, Final and Half Cadence: 'Only you can answer in the silence: Ward on the beat, or
    Reel them out'.

## The epilogue and the Summary

- **Epilogue** (`screens/EpilogueView.tsx`): five lines, 3 s each, then a 2 s hold, 17 s in all
  (under 02's 20 s). It sits as a panel at the top of the Summary, with no new RunPhase.
  - Skippable: a Skip button, Escape, Enter or Space. A key a dialog owns (the Rank-up card's
    button) is left to the dialog, and the epilogue waits behind that card.
  - Shown once per victory (the run's seed in `localStorage`); reduced motion shows the lines still.
  - The third line is the party's first hero's (Kael, Lyra, Vexis or Brann).
- **Summary:** OUTCOME 'The song goes on', the VICTORY line 'The Silent Conductor lowers its
  baton, and the song goes on.', and the first-clear card:
  - 'The Song Goes On — your first Finale clear';
  - 'Dissonance is open', or that a Finale clear at Weaver Rank 15 or above opens it;
  - 'Coming later: the Atlas of Echoes and True Dissonance'.
  - None of it shows on an I-III win.

## Map, copy and the Codex

- **Route copy:** the Title's 'Movements I–III and the Finale · The Expedition'; Prep's 'Movements
  I–III and the Finale, to the Silent Conductor.'; the Route toggle 'Expedition · ~40 min'
  (`ROUTE_MINUTES.expedition`, below). A two-Movement count still reads as it did, and every
  Prelude string is unchanged.
- **Movement card:** the Crucible's gold-white eyebrow, its line ('Above the Rift the sky rings
  like a struck bell. Someone is conducting it.') and the button 'Ascend'. Earlier cards have no
  line.
- **Backdrop:** the `'crucible'` tone: the four spinning rings brighten and pulse, with text at
  WCAG AA.
- **Spoils:** the Unweaver's interlude ('The Unweaver falls' / 'The Unweaver's loom' / 'The Rift
  knits shut, and the sky above rings white-gold. Take something epic.').
- **Codex:** the Conductor's lore line and the choir under 'The Finale'. The Starlight breakdown
  reads 'the Finale'. `callingText.ts` (`tierWhen(i, run?)`), the Codex and the UiLab mock read
  the run's road rows when given a run; `tierWhen(i)` without a run keeps CALLING_ROWS.
- **Dissonance:** its gate copy says a Finale clear at the Rank opens it, never that reaching the
  Rank does. Skip the unlocks opens it on the card, as everywhere else.

## Done in the hand-off (m4/tune)

- `ROUTE_MINUTES.expedition` stays 40, now from the Finale route's measurement: the Skilled
  average is 39.6 / 39.4 min on bases 9001 / 77003, losses included (the winning-run median is
  43.2 / 43.7). `tests/uiPhase5.test.ts` pins `ROUTE_MINUTES` and the '~40 min' label.
- The Fortissimo Decree mock reads '120%' (it follows `FORTISSIMO_PCT`).

## Not run here

- `e2e/smoke.spec.ts` expects the Finale route, the epilogue's test ids and 'The song goes on'.
  This machine has no Playwright browser, so it was not run in the hand-off step.
- The cold read (≥ 4 of 5 testers naming the three note sources with audio muted and Flashes at 0)
  needs testers; the questions are in [docs/demo.md](../demo.md).
