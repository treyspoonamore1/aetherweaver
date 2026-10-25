# Phase 2 — The Chord, and proof of support: exit report

*2026-10-25 · plan: [docs/plan/06-roadmap.md, Phase 2](plan/06-roadmap.md#phase-2--the-chord-build-layer-inside-combat-m)*

Phase 1 already pulled half of the roadmap's Phase 2 forward (auras, Resonance, Cues, the Crescendo, the combat HUD). This phase builds the rest of the **build layer** and adds the two features that give the game its own identity:

- **The build layer.** Two Chords of two auras each, four ornaments that change *both* auras in their Chord (Grace Note, Reverb, Unison, Pedal Point), the Fermata aura, the chorus pulse, a Chord builder with presets, Retune at respites and a loadout report in the harness.
- **Call and Response** *(signature)*. Heroes call for a specific kind of help just before their big move: Kael wants a **Ward**, Lyra **Empower**, Vexis a **Chime**. Answer before the move goes off and it becomes a stronger **Flourish**. Ignoring a call costs nothing.
- **Proof of support** *(signature)*. The game makes good support visible: when you save a hero, their **ghost** falls where they would have died; and every fight is **re-run without you** in the background, so the result screen can say *"Without you, the party falls at 0:41."*
- **Also:** the radial **Directive wheel**, key **remapping**, **colour-blind palettes** checked under simulated deficiencies, **UI scale** and **flash strength**.

<!-- screenshots: filled in from docs/phase-2/ui and docs/phase-2/vfx -->

## Exit criteria

| Criterion (roadmap, Phase 2) | Result | Evidence |
|---|---|---|
| Three distinct loadouts are each viable for the Skilled bot | ✅ four | Every preset clears every Skilled floor (skirmishes ≥ 80%, elites and bosses ≥ 90%) and wins 80–100% of whole runs; none dominates. [Loadout report](#loadouts) |
| Playtesters can describe how the loadouts *play* differently | ⏳ **not run** | Needs humans: see [For the playtest](#for-the-playtest) |
| The Phase 1 difficulty contract still holds | ✅ | [Harness](#harness) |

## What was built

### The build layer (`src/sim`)

| Area | What's in |
|---|---|
| **Chords** | Up to two Chords, each with two aura slots and two ornament slots. Each Chord has its own field (`field.chords`): around the Weaver, planted, or on the Thread. Every hero and enemy carries a mask of the auras covering it, so effects, rim lights and the HUD all agree. One shared module (`sim/chords.ts`) decides what is legal and what it costs, for the sim, the run and the Chord builder alike |
| **Ornaments** | One copy of each. **Grace Note**: reserve ×0.7, effect ×0.9. **Reverb**: radius ×1.4, effect ×0.9. **Pedal Point**: the field stays where you plant it (V at the cursor, 2 s cooldown), radius ×0.85. **Unison**: the Chord rides the Thread, affecting only the threaded hero at ×2.5 — and its hexes hit whatever attacks that hero. Unison can't share a Chord with Pedal Point or Reverb. Fields are capped at 14 m outside a Crescendo |
| **Spirit** | Auras reserve Spirit (ornaments change how much); what's left powers Ward, Chime and Reel. More auras means fewer techniques: the core build trade-off |
| **Fermata** | Heroes below 35% life take 30% less damage. Once per fight per hero, a lethal hit **holds** them at 1 HP for 1.5 s: heal them in time (Thread, Chime, Crescendo) and they live — logged as a Save — or they go down. Passive regeneration doesn't count |
| **Chorus pulse** | With three or more auras singing, every Cue also heals and shields everyone in a field, scaled by the number of auras |

### Call and Response

- A hero calls in the last seconds before their call ability comes off cooldown: Kael before **Challenge** (*Ward me*), Lyra before **Piercing Shot** (*Empower me*), Vexis before **Starbolt** (*Chime on me*). Casts can be answered mid-cast.
- They use the move exactly when they would have anyway, so an ignored call costs nothing. An early version made heroes *wait* for the answer instead; the harness showed that changed balance in odd ways (fewer rooted Starbolts made the Bellwarden easier), so it was dropped.
- Answered, the move becomes its **Flourish**:
  - **Bulwark**: Challenge reaches 1.5× as far, holds 2 s longer, and gives Kael a barrier per enemy caught.
  - **Heartseeker**: Piercing Shot always crits, hits 2.5× as hard, cuts a wider line and refunds 20% of Lyra's Solo.
  - **Resonant Starbolt**: 1.6× damage, 1.5× radius, and it stuns.
- Everything a Flourish adds counts as the Weaver's share. An answer also gives 10 Resonance.
- Pacing: the first call comes 6 s in; each hero waits 22 s between calls; calls are at least 6 s apart; and none is made while anything lethal is on the board.
- The bots answer: the Skilled bot when the answer isn't needed for something more urgent (it keeps its Ward for a Perfect if a big hit is coming), the Novice bot about a third of the time.

### Proof of support

- **Ghosts**: every `save` event — the sim's counterfactual says that hit would have downed the hero without you — shows the hero's ghost collapsing on the spot while the real hero fights on.
- **"Without you"**: `runWithoutYou(config)` (`sim/counterfactual.ts`) replays the encounter with the Weaver *absent*: no Chords, no calls, never targeted, nobody revived. It doesn't depend on the player's input, so the runtime starts it in a Web Worker as the fight begins (`app/withoutYou.ts`); it takes 50–200 ms. The result rides along with the fight's outcome to the result and summary screens. The e2e test checks the browser worker's result matches Node's bit for bit.
- Without the Weaver, the party loses every fight the harness plays, usually within 25–40 s.

### The run

- **Prep** builds Chords with a live Spirit budget, from scratch or from four **presets**: Steady (easy), Beam (hard), Anchor (medium), Wide Choir (easy).
- **Respites** gain a third choice, **Retune**: change your Chords instead of resting or meditating.
- **Save v2** migrates Phase 1 saves (auras become Chord I; the renamed motif follows). Settings v2 migrates the same way.
- The **Call and Response** motif from Phase 1 is renamed **Canon**, so the name belongs to the new mechanic.

<!-- presentation: filled in from the workstream reports -->

## Harness

<!-- filled in at the end -->

## Loadouts

<!-- filled in at the end -->

## For the playtest

Phase 1's checklist still applies (Perfect Wards and Reels should feel great; nobody should say the heroes play themselves). Add:

- **Loadouts.** Have each tester play at least two presets (Steady and one of Beam, Anchor, Wide Choir). Afterwards, can they describe how the two *played* differently? That's the Phase 2 exit criterion.
- **Calls.** Did they notice the calls? Did answering one feel like a conversation with the hero, or like a chore? Did they ever feel punished for ignoring one (they shouldn't be)?
- **Fermata.** When a hero was held, did they understand they had to heal them, and in time?
- **Proof of support.** Did they see a ghost fall after a save? Did the "without you" panel make them feel their play mattered, or was it discouraging when the party would have won anyway?
- **Directive wheel.** Was holding C quicker or slower than the old Z/X/C keys?

Use **Settings → Assists** for anyone who struggles, and **Settings → Accessibility** for colour vision and UI scale.

## Known gaps

- The playtest hasn't happened; tuning is still by bots only.
- Every Phase 2 aura and ornament is available from the first run: unlocks belong to Phase 4's meta layer. The presets and the Chord builder's warnings carry new players for now.
- Beam is hard for a novice (the Novice bot wins none of its runs with it); it is labelled *hard* in the builder.
- Duets (cueing two heroes together) and the remaining six ornaments and four auras are later phases (docs/plan/03 §3–§4).
- Real-GPU frame rate is still unverified (this container renders with SwiftShader).
<!-- more from the workstream reports -->
