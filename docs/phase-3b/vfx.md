# Phase 3b: Relics in the fight (render / VFX)

The Weaver now carries relics that change rules in combat (see [Phase 3b](../phase-3b.md)). This
workstream makes each one visible in the 3D fight at the moment it acts. The relics that help a
hero read as **the Weaver's gift to that hero**: the Thimble's needle leaves the Weaver's hand,
the Veil runs from the hero to the Weaver, the Metronome ticks from over the Weaver's head, and
the Prism Loom spreads the Weaver's Thread. Everything reads `WorldState.relics`, the Thread's
state and the `relicTriggered` / `techniqueRejected` events only. Relic numbers (the Prism's
reach, the cooldowns, the Fork's share) come from content, so the lead's tuning shows up without
render changes.

![Prism Loom: Lyra threaded in Mend; the Thread spills to Kael and Vexis inside its reach](vfx/prism-mend.jpg)

## What changed

| File | Phase 3b work |
| --- | --- |
| `relicCues.ts` (new) | Pure helpers, tested in Node. `relicCue(event)` maps every `relicTriggered` relic to its moment, and only a Glide refused as `'locked'` to Heavy Score (a Thread lockout after a snap is also `'locked'` and is ignored). `relicValue(id, key, fallback)` reads `relic.values`. `relicCharge` / `metronomeCharge` / `thimbleCharge` turn `metronomeAt` / `thimbleAt` plus the content cooldown into 0..1 (1 = ready, null = not carried). `flareScale(flashes)` scales in-world flares by the flashes setting. `PrismScan` works out who the Prism Loom reaches each frame with the same rule as the sim's `threadPotency` (no sim internals imported; it reuses its arrays). |
| `relics.ts` (new) | `RelicView`: one pooled moment per relic event (32 slots, no per-frame allocation) and three per-frame states (the Prism's threads, the Metronome, the Thimble's ready glint). It draws through the existing ring, sprite, beam, ribbon, shell and particle batches only. A moment whose entity isn't drawn yet waits (up to 2 s), so the Hymnal's tick-0 event plays on the first frame. `fired` counters and `activeCount()` are for tests and the lab. |
| `combatView.ts` | Creates the `RelicView` and passes it events and frames (after `Feedback`). |
| `songs.ts` | **Spindle of Fate.** `fieldLook()` used to treat a beam song with `echo ≥ 1` as a *field song*, so with the Spindle the echo lost its dashes and was drawn on top of a shared field song (Guardian, Bastion). Now the beam song's disc is always its echo. New `isFullEcho(chord)`. `fieldLoudness()` is 1 for a full echo. `auraHearing()` returns `'fullEcho'` for heroes who hear it. |
| `field.ts` | The field shader draws a full echo (loudness ≥ `FULL_ECHO_LOUDNESS`) with longer, thicker dashes and a field song's glow. It is still dashed and still sits just outside a shared field song. A planted full echo gets the full stake. |
| `entities.ts` | Foot arcs for a full echo: a field song's weight, still dashed. |
| `thread.ts` | `weaverHand()` exported (the Thimble's needle leaves from the same hand as the Thread). |
| `fx/ribbons.ts` | `vertices` getter (tests). |
| `lab/VfxLab.tsx` | **Phase 3b · Relics** group: one scenario per relic (below), `window.__VFX__.relicScenarios() / relicScenario(name) / setRelics(ids) / relicStats()`. The lab sim carries `relics` (kept across loadout and encounter changes), and the stats line lists them. |
| `tests/renderRelics.test.ts` (new) | Real sim → real `RelicView` over a real `FxKit` for every relic (below). |

## The visuals

| Relic | When | What you see |
| --- | --- | --- |
| **Silver Thimble** | The Thread moves to a hero and shields them | A silver **needle** runs from the Weaver's weaving hand to the hero (0.22 s), then a silver thread **sews a spiral** up the hero, a dashed silver ring cinches in at their feet, a glint marks the last stitch, and a small `THIMBLE` label appears. While it is ready, a small silver glint waits at the Weaver's hand (the next hero you thread gets the shield). |
| **Lantern of the Lost** | A hero goes down, the others get barriers | A warm **lantern rises** from where the hero fell (`LANTERN`), swells, and **splits into lights** that arc to each standing hero and land as their barrier (a shield ring, a warm dashed ring and a soft warm flare). |
| **Martyr's Veil** | A blow that would down a hero lands on the Weaver | A pale **veil unfurls** from the saved hero to the Weaver (a sheer drape with a hem and a bright seam, fluttering, trailing **dark smoke**). The hero is draped for an instant, then the Weaver is **shrouded** (a pale shell, a shadow burst, a small shake) and `VEIL` appears over them. The sim's own `save` event still gives the hero's gold `SAVED`. |
| **Cracked Metronome** | Ready / an early Ward counts as Perfect | **While ready**: a small brass **metronome ticks** over the Weaver's head, with a dashed brass dial at their feet brightening on each tick. **While winding up**: the dial fills over the 12 s cooldown, and a ring pops when it is ready again. **When it fires**: a brass streak from the metronome to the hero, a tick-flash, and a brass **clock face** on the ground under the hero whose hand ticks forward one notch. This reads under the Perfect's overhead bloom. `METRONOME` appears above `PERFECT`. |
| **Tuning Fork** | A Perfect Ward charges the hero's Solo | A steel **tuning fork** rings at the hero's shoulder (its prongs shiver), sound rings roll out from their chest, and their **Solo arc** (gold, at their feet) fills by the Fork's share, with a bright leading spark and `+25% SOLO` under them. The share is the Solo before and after, so it is exact when the charge caps at 100. |
| **Glass Halo** | A Perfect Ward heals every hero | A **glass halo** forms over the warded hero (after the Perfect's bloom), **shatters** into shards and a dashed ring, and its shards fly to **every standing hero** as healing glints that land in heal rings. `GLASS HALO` appears, and the heal numbers are the sim's `healApplied`. |
| **Cantor's Hymnal** | Tick 0: the fight opens with 50 Resonance | An opening **shimmer** at the Weaver: Resonance and gold rings, a column of light, notes spiralling up, and `HYMNAL · CUE READY`. |
| **Prism Loom** | Continuous | Faint **prismatic threads** from the threaded hero's chest to each hero inside its reach, coloured like the Thread (Mend teal / Empower gold, washed with a slow spectrum), as bright as their share (they dim with tension, like the Thread). Beads flow along them, and **Mend pulses travel them** when the spilled Mend lands. The **reach** is drawn as a faint prismatic dashed ring at the threaded hero's feet, so who is inside reads at once. Links fade in and out as heroes cross the edge. Nothing is drawn for a downed threaded hero or a downed Weaver (the sim gives no share then either). |
| **Spindle of Fate** | Continuous | The beam song's echo plays at ×1. It is drawn as loud as a field song but **still dashed** (longer, thicker dashes and a glow), still just outside a shared field song, and heroes hearing it get bold dashed foot arcs. Without the Spindle the echo is unchanged (thin, faint dashes). |
| **Heavy Score** | A Glide is refused (`techniqueRejected`, glide, `locked`) | An iron **weight drops** onto the Weaver, an iron ring slams in, a **chain** of links closes round them, dust, a small shake, and `NO GLIDE`. Rate-limited to one every 0.4 s, so mashing Space doesn't stack chains. The blessing (+15% hero damage) already shows as the gold chip on damage numbers (`amplified`). |

**Settings.**

- **Flashes.** Bright in-world flares (the needle's and stitch glints, the lantern's core, the Metronome's tick-flash, the halo's glow and shatter, the hymnal's column, the drape and shroud rims) scale by `flareScale(flashes)`: 35% of their size or alpha at 0. The moment still plays in full otherwise (tested). No relic adds a full-screen flash.
- **Colour vision.** Barriers use `C.shield`, heals `C.heal`, the Solo arc `C.amp`, and the Prism threads `C.mend` / `C.empower`. These are all live per colour vision. The relic identity colours (silver, warm lantern, linen veil, brass, glass, iron) are light neutrals kept ΔE ≥ 20 from lethal and ≥ 15 from threat under every palette's own simulated vision (tested). Each moment is also a distinct shape (needle and spiral, lantern, drape, clock face, fork, halo, chain) with a text label, so none relies on colour.
- **Shake** goes through the rig, so `screenShake` applies (Veil 0.16, Heavy Score 0.1).

## Seeing each one in the lab (`?lab=vfx`)

**Phase 3b · Relics** has one button per scenario. Each restarts the real sim carrying that relic
and stages the moment with real commands and debug ops (no injected events). The hover text says
what it does. **No relics** restarts without any.

| Scenario | Relics | Staging (all real sim) |
| --- | --- | --- |
| Silver Thimble | `silver_thimble` | `{t:'thread'}` Kael at 0.2 s, Lyra at 4.6 s (after the 4 s cooldown) |
| Lantern of the Lost | `lantern_of_the_lost` | `{op:'forceHold', slot:0}`, left unhealed: Kael goes down when the hold runs out |
| Martyr's Veil | `martyrs_veil` | `forceHold` Kael + thread him (Mend saves him at a sliver), then thread Vexis, `teleportWeaver` back 7 m, three Bell Brutes on Kael. The next blow that would down him is the Veil's. The brutes are cleared 1.6 s later. |
| Cracked Metronome | `cracked_metronome` | `teleportWeaver` clear of the cleave, a Bell Brute beside Kael, `{t:'tech', id:'ward'}` the moment *Toll Cleave* starts (far too early) |
| Tuning Fork | `tuning_fork` | The same, Ward at `perfectFrom + 0.05` |
| Glass Halo | `glass_halo` | Two choristers on Vexis, an elite brute on Kael, a Perfect Ward |
| Cantor's Hymnal | `cantors_hymnal` | Tick 0 |
| Prism Loom / · Empower | `prism_loom` | Thread Lyra, `rally` (Empower: `{t:'mode'}` and two choristers) |
| Spindle of Fate | `spindle_of_fate` | Thread Lyra. Use **Guardian** (echo next to the field song) or **Steady** under Chords. |
| Heavy Score | `heavy_score` | `{t:'glide'}` twice |
| Every relic | all 15 | Thread Lyra, rally, a brute and a Perfect Ward (the clutter check) |

The brute is spawned beside the hero with the Weaver stepped back: Toll Cleave is a 5 m cone,
and with the Weaver behind the hero it one-shots them (360 life), which buried the Ward moments
under the downed-Weaver screen.

`window.__VFX__.relicScenario(name)` runs one from a script, `relicStats()` returns
`{ fired, active, prism }`, and `setRelics(ids)` restarts with any set.

## Verification against the real sim

`tests/renderRelics.test.ts` (14 tests) drives the real sim through the same staging as
`tests/sim/relics.test.ts`. It feeds the real events to the real `RelicView` over a real
`FxKit` (entity records taken from the sim state) and checks what starts and what draws:

- **Cue mapping**: every relic in `CUE_OF_RELIC` exists in content. A `'locked'` Glide is Heavy
  Score; a `'locked'` Thread (snap lockout) and a Glide on cooldown are not.
- **Thimble**: ready at the start, and the hand glint draws. `{t:'thread'}` gives exactly one
  `silver_thimble`, the moment plays and draws more than the idle frame, and the charge drops. A
  second thread within 4 s gives no event and no second moment.
- **Lantern**: `hurt` (the sim's `dealDamage`) downs Kael. The event names Kael, the lights go
  to Lyra and Vexis (not Kael), barrier flares draw on both, `LANTERN` shows, and the pool is
  empty again afterwards.
- **Veil**: a lethal hit on Kael gives `martyrs_veil` (hero Kael), a `save` with cause `martyr`
  and a `damageTaken` on the Weaver. The drape draws (ribbon vertices), there is one `VEIL`, and
  one shake.
- **Metronome**: ready at the start (the pendulum is a beam). An early Ward gives `perfectWard`
  and `cracked_metronome` on Kael, the moment plays with `METRONOME`, the charge drops, and once
  it is over the dial draws and the pendulum doesn't. (The brute's cleave downs the Weaver in this
  staging, and the indicator hides while they are down, so the test clears the brute and waits for
  the Weaver to reform.)
- **Tuning Fork**: a Perfect Ward gives `tuning_fork` only, the moment draws, and the label is
  `+25% SOLO` (from content).
- **Glass Halo**: `glass_halo` fires, the glints target all three heroes, at least six glints
  fly at once, and `GLASS HALO` shows.
- **Hymnal**: the tick-0 event is fed before any entity record exists. It waits, then plays
  with `HYMNAL · CUE READY` on the first drawn frame.
- **Heavy Score**: two refused Glides within 0.4 s make one chain and one `NO GLIDE`. A
  cleansed Heavy Score glides and shows nothing.
- **Prism Loom**: in several layouts (inside, outside, right on the edge with the hero radius)
  and at tension 0 and 0.7, `PrismScan.potencyOf` equals the sim's own `threadPotency` for every
  hero, to 1e-9. One hero inside draws exactly 2 strips × 13 points × 2 vertices; two heroes
  draw twice that. A downed threaded hero reaches no one, and a sim without the relic draws no
  prism vertices.
- **Spindle of Fate** (Guardian, threaded Lyra): `echo` is 1, `fieldLook` is still `'echo'`,
  `isFullEcho` is true and loudness is 1 (0.45 without it). The field song stays `'song'`. Kael
  hears `'fullEcho'`, Lyra `'focus'`.
- **Flashes 0 vs 1**: the same moment fires and draws the same instances, only dimmer.

In the browser, each lab scenario was run through `window.__VFX__` with fixed frames, polling
`relicStats().fired` until the moment fired. The screenshots below are taken that many frames
after the real event; every scenario's counter went to exactly 1 (2 for the Thimble's second
thread).

## Performance

These were measured with Chromium headless (SwiftShader) from an isolated production build (other
agents' edits were hot-reloading the dev server). Draw calls are from `renderer.info`. Frame
times under SwiftShader are noise, not FPS.

| Measure | Draw calls |
| --- | --- |
| Lab, **no relics**, Lyra threaded (Guardian), idle / busy (25 + Bellwarden) | 22 / 36 |
| Lab, Silver Thimble (ready glint, two stitches played) | 23 / 36 |
| Lab, Prism Loom (two prism links, reach ring) | **22 / 36** |
| Lab, Spindle of Fate (full echo) | 22 / 36 |
| Lab, Cracked Metronome (ticking; the scenario's brute fight is on screen) | 26 / 36 |
| Lab, every relic (all 15; a brute fight on screen) | 28 / 36 |
| Lab, relic moments while firing (Thimble, Lantern, Veil, Metronome, Fork, Halo, Hymnal, Heavy) | 22–30 (the Perfect's shell, telegraphs and bars on screen account for the spread) |
| e2e busy fight (137 entities, high, autoplay), 2 runs | **30**, 30 (Phase 3: 30) |
| e2e busy fight, frame ms mean / p95 | 6.4 / 8.8, 7.2 / 7.2 (CPU shared with two other agents' builds) |
| e2e busy fight, sim ms per tick | 0.26, 0.32 |

The relic scenarios' own idle numbers differ from "no relics" only by what their staging adds
(the Metronome and every-relic scenarios have a Bell Brute fight on screen). The busy preset is
36 in every case.

**No new draw calls, no new batches, no new materials or shaders** (the field shader's echo
branch gained two `step`s). Every relic moment rides the ring, sprite, beam, ribbon, shell,
particle and smoke batches. The lab counts above vary with what else is on screen (the Perfect's
shell, telegraphs, bars), not with the relic. CPU: `RelicView.sync` measured in Node (including
`FxKit.begin/end`) is about **23 µs a frame** with the Prism drawing two links, the Metronome
ticking and the Thimble glint, and about **50 µs** with all seven moments restarting every
second. The heap didn't grow over 20 000 frames. Moments are pooled (32), colours are owned or
shared constants, positions go through two reused vectors, and the Prism's scan reuses its link
array. The only per-event allocations are the overlay callout strings (as for every callout).

## Screenshots

| | |
| --- | --- |
| ![](vfx/thimble-needle.jpg) **Silver Thimble**: the needle leaves the Weaver's hand for Lyra (the Thread's second hero, 4 s later) | ![](vfx/thimble-stitch.jpg) …and sews the shield on: silver spiral, cinching dashed ring, `THIMBLE` |
| ![](vfx/lantern-rise.jpg) **Lantern of the Lost**: Kael goes down; the lantern rises where he fell | ![](vfx/lantern-lights.jpg) …and splits into lights for Lyra and Vexis |
| ![](vfx/lantern-barriers.jpg) …landing as their barriers | ![](vfx/veil.jpg) **Martyr's Veil**: the drape and its shadow run from Kael (behind the brutes, `SAVED`) to the Weaver, shrouded, `VEIL` |
| ![](vfx/metronome-ready.jpg) **Cracked Metronome, ready**: the brass metronome over the Weaver, the dial at their feet | ![](vfx/metronome-tick.jpg) **…firing**: an early Ward made Perfect; the brass clock face under Kael, `METRONOME` over `PERFECT` |
| ![](vfx/metronome-flashes-off.jpg) The same with **flashes at 0**: the flares are dimmer, the clock face and labels are unchanged | ![](vfx/tuning-fork.jpg) **Tuning Fork**: the fork at Kael's shoulder, his Solo arc grown by its share, `+25% SOLO` |
| ![](vfx/glass-halo.jpg) **Glass Halo**: the shattered halo's ring over Kael, glints flying to Lyra and Vexis, `GLASS HALO` | ![](vfx/glass-halo-deuteranopia.jpg) The same under **deuteranopia** (heal glints in the live heal colour) |
| ![](vfx/hymnal.jpg) **Cantor's Hymnal**: the opening shimmer, `HYMNAL · CUE READY` | ![](vfx/heavy-score-weight.jpg) **Heavy Score**: a refused Glide; the weight drops on the Weaver… |
| ![](vfx/heavy-score-chain.jpg) …and the chain closes, `NO GLIDE` | ![](vfx/prism-mend.jpg) **Prism Loom (Mend)**: Lyra threaded; links to Kael and Vexis inside the reach ring |
| ![](vfx/prism-empower.jpg) **Prism Loom (Empower)**: the same in gold | ![](vfx/prism-tritanopia.jpg) Prism Loom under **tritanopia** (the live Mend colour) |
| ![](vfx/spindle-full-echo.jpg) **Spindle of Fate** (Guardian, Lyra threaded): the Fortissimo echo at ×1 just outside the Sostenuto field song, bold dashes; Kael's and Vexis's arcs bold dashed | ![](vfx/spindle-off.jpg) The same loadout **without** the Spindle: the echo is thin and faint |
| ![](vfx/every-relic.jpg) **Every relic** (clutter check): a Perfect with the Fork and the Halo; the labels stack `GLASS HALO` / `PERFECT` / `+25% SOLO`, the Spindle's bold echo and the Thimble's glint stay. The elite brute's cleave still reached the Weaver in this run (the downed Weaver at the centre). | |

## Known gaps

- **The Lantern's barriers land before its lights do.** The sim adds the barriers at the moment
  the hero goes down; the lights arrive 0.6–1.1 s later. The barrier shells (amber, existing
  overshield look) are already on the others when the lights land.
- **Ward-time relics share the Perfect's moment.** The Metronome's clock face, the Fork's arc and
  the Halo's glints are placed and timed to read around the Perfect's bloom (ground level, at the
  shoulder, after the bloom). The hero-side flash of the Metronome is still mostly lost under it,
  so `METRONOME` carries that read.
- **No "Veil is still unused" mark** in the world. The once-per-fight Veil is only seen when it
  acts. A HUD relic bar is the right place for its charge (the UI workstream has one).
- **The Thimble's shield is the existing amber overshield look.** The shield itself isn't silver
  after the stitch fades.
- **Prism Loom**: Empower's spill has no per-hit cue (the damage chips don't split Prism Empower
  from the main Thread's). The reach ring is drawn at `radius + the threaded hero's radius`, while
  the sim checks `radius + the other hero's radius` (the same for today's heroes).
- **Spindle of Fate**'s other half (Mend and Empower 20% weaker) has no visual; it's a number.
- **Relic label callouts** are 14–17 px world callouts (28 px for the Veil). With several relics
  on one Perfect they stack above `PERFECT` (Metronome) and above that (Glass Halo).
- **The Hymnal** plays at the Weaver on the first frame; the camera's opening snap can make the
  first rings start slightly off-centre.
- Real FPS still isn't measurable here (SwiftShader).

## Contract requests (for the lead)

- **`relicTriggered.amount`** (shield or heal amount, or Solo charge added). The Thimble could
  label its shield, and the Fork's arc would not have to infer the share from the Solo before and
  after.
- **`relicTriggered.targets`** for the Lantern (the heroes that actually got a barrier: the sim
  skips anyone whose existing overshield is already bigger) and the Glass Halo (who was healed).
  Render now assumes "every other standing hero" / "every standing hero".
- **A debug op to set a hero's life** (`{ op: 'setHeroHp', slot, pct }`) or a `{ op: 'hurt' }`.
  The Veil scenario has to go through a Fermata hold, Mend and three brutes to land a blow that
  would down a hero, because no debug op can.
- **`WorldState.relics.prism`** (the heroes the Prism reaches and their share) would let views use
  the sim's answer instead of re-deriving `threadPotency` (`PrismScan` is tested to match it
  today).
- Optional: **`techniqueRejected.cause: 'heavy_score'`**, so a future second Glide lock (another
  curse, a status) doesn't show Heavy Score's chain.

### Resolved by the lead

- **`relicTriggered.targets`**: the Lantern and the Glass Halo now name the heroes they reached (a hero keeping a bigger shield of their own gets no Lantern barrier), and `RelicView` draws its lights to exactly those, falling back to everyone standing when an event has no list.
- Still open: the shield or heal `amount` on the event, a debug op to set a hero's life for staging, `WorldState.relics.prism`, and a `cause` on a refused Glide.

