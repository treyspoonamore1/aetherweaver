# Phase 5a: the Crimson Legion in the fight (VFX and audio)

This page documents the presentation work for [Phase 5a](../phase-5a.md). The VFX half is
written by the render workstream. This half covers audio.

## Audio

Audio now has a **biome axis**. The Sunlit Reliquary sounds exactly as before. The Crimson Spire
keeps the game's key and tempo, **D dorian at 88 BPM**, and changes:

- its chords;
- its drums, horn and choir;
- its pad cutoff;
- its ambience;
- stems for Vharun's phases.

Every Movement II status, event and attack has a voice. Audio reads the following and never
writes to the sim:

- `ArenaDef.biome`;
- the events `statusApplied` (with `stacks`), `statusRemoved` (with 'freed'), `guardBlocked`,
  `guardBroken`, `attackFired` ('charge', 'leap'), `telegraphStarted`, `telegraphResolved`,
  `allyDowned` and `enemyKilled`;
- `EnemyDef.material`;
- each telegraph's `attackId`;
- `enemy.tier` and `enemy.phase`.

### What changed

| File | Phase 5a work |
| --- | --- |
| `audio/director.ts` | `setBiome(biome)` and `getBiome()`. The biome is kept for a MusicEngine created later. `stopCombat` resets the new `apex` input. |
| `audio/music.ts` | `setBiome`. The biome takes effect on the next bar line, as a mood does. The Crimson Spire voices `map`, `calm`, `combat` and `boss`; the title, the Loom, victory and defeat are the same in every biome. Its progressions, `crimsonPulse`, `crimsonMelody`, a low choir drone, `CRIMSON_CUT` and `crimsonAmbience`. `MusicInputs.apex`: the fight's boss is a final boss. `MusicSnapshot.biome/activeBiome`. |
| `audio/theory.ts` | Chords `Dm`, `C` and `Bø7`. `PROGRESSION_CRIMSON`, `PROGRESSION_CRIMSON_BOSS`, `MELODY_CRIMSON` and `MELODY_CRIMSON_BOSS`. |
| `audio/sfx.ts` | The Legion's sounds below. `LEGION_SOUND_GROUPS`, `LEGION_SOUND_LIMITS`, `LEGION_ATTACK_SOUNDS` and `BLEED_CHIME_AT`. Iron kills by `material`. `windStyle`: a `mend` answer gives a swell. `update()` also returns `apex`. |
| `app/runtime.ts` | `getAudio().setBiome?.(arena.biome ?? 'reliquary')`, called before the mood is set. |
| `audio/lab/*` | AudioLab gains a biome switcher, a Vharun phase selector, the **Phase 5a · The Crimson Legion** group, the Crimson Spire moods in the mood audit, and `__audioLab.setBiome` and `pitchCrimson`. `FakeWorld.addEnemy` accepts content def ids, and `addTelegraph` accepts `attackId` and `name`. `renderMood` and `auditMood` accept a biome and a boss phase. |
| `tests/audioPhase5.test.ts` (new) | See Tests below. |

### The Crimson Spire's music

| Stem | Sunlit Reliquary (unchanged) | Crimson Spire |
| --- | --- | --- |
| Chords | Bright loop; Dark loop for bosses | **Dm–C–Bø7–C** ×2; boss: Dm Dm Bø7 C Dm Bø7 Em7 Am7 |
| Pulse | Kick, rim, hats, bass on root and fifth | **War drums**: low toms tuned to D2 and A1 (A2 for pickups), an anvil on the backbeat when busy, a chain rattle on off-beats, and a saw bass on the root and its octave only |
| Melody | Flute; horn for bosses | **Low horn ostinato** an octave down; sparse on the map |
| Choir | The chord's upper tones | **A low male drone**: A2, D3 and A3 whatever the chord, plus D4 at the top tier |
| Pad cutoff (Hz) | map 1300, calm 1300, combat 1700, boss 800 | map 900, calm 1000, combat 1250, boss 650 |
| Ambience bus | (nothing in the music) | **Bed**: distant drums every other bar, brazier crackle (a fixed xorshift sequence, no `Math.random`), and a fire's breath every 4 bars |

**Why Bø7 rather than B♭.** The plan asks for Dm–C–B♭–C. B♭ is outside D dorian, and every
pitched sound is quantised to that key. The test requires 94-100% of the stems in key, and a
B♭ bar would put about a tenth of the notes out of key. Bø7 (B D F A) is the dorian mode's own
chord on that degree. It keeps the D and F of the B♭ chord, and its B♮ gives the dark modal
colour. For the same reason the Spire's bass never plays the chord's fifth, because on B that
would be F♯.

**Vharun's stems.** These are keyed on `bossPhase`, and only when the boss is a final boss
(`apex`: an enemy of tier 'boss').

- **Phase 2, Bloodmoon:** the pad drops out. A slow double heartbeat on D2 beats on the
  ambience bus.
- **Phase 3, judgement:** Bloodmoon persists, so the pad stays out and the heartbeat continues.
  The toms double to every eighth note, and brass stabs (horns on the chord) land on beats 1
  and 2&.
- **The Matriarch's Blood Frenzy:** her phase 2 keeps the pad and adds a high-tom pickup.

A Fermata or Stasis holds the drums and the heartbeat. Only the fire keeps crackling.

### The Legion's sounds

Each sound has its own voice group, rate gate and cap (`LEGION_SOUND_LIMITS`). Every pitched
note is in D dorian.

| Sound | Trigger | Recipe | Gate / cap |
| --- | --- | --- | --- |
| Bleed | `statusApplied` bleed | A wet pluck that climbs one scale step per stack (E5 at ×1 to E6 at ×8) with a wet band of noise. At **5+** stacks a glass glint rings: the cue to Chime. | 0.15 s / 2 |
| Pinned | `statusApplied` pinned | A stake's thunk on A2, then four chain links, each a faint high glint | 0.12 s / 2 |
| Latched | `statusApplied` latched | A suck: air drawn through a rising band, with D3 sinking to A2 under it | 0.2 s / 2 |
| Wound | `statusApplied` wound | A muffled thud on D2, with a dull F3 | 0.2 s / 2 |
| Blood Pact | `statusApplied` pact | Two hearts (D2 and A1) beating slightly out of step. The pair's two events make one sound. | 0.4 s / 1 |
| Condemned | `statusApplied` condemned | A low horn sentence (D2 and A2) under the drum roll | 1 s / 1 |
| Freed | `statusRemoved` 'freed' | The chain snaps: a hiss, an anvil ping on A5, and three links ringing down | 0.1 s / 2 |
| Chime release | `statusRemoved` 'cleansed' of bleed, latched or wound | A rising glass arpeggio of 1 to 5 chord tones plus a whoosh. It scales with what was cleared: bleed counts its stacks, latched and wound count 1 each. It plays once per batch. | 0.1 s / 2 |
| Guard blocked | `guardBlocked` | A dull clank: an anvil on A3, a thump and a band of noise. Gated, so a volley sounds as one clank. | 0.25 s / 2 |
| Guard broken | `guardBroken` | A shatter: an iron hiss, an anvil on D4, a low thump, and three glass shards falling | 0.3 s / 1 |
| Charge | `attackFired` 'charge' | A low whoosh (300 to 1600 Hz) with three heavy footfalls | 0.15 s / 2 |
| Pounce | `attackFired` 'leap' | A rising whoosh, then a landing thump after `travel` (0.25 to 0.8 s) | 0.15 s / 2 |
| Crimson Tide | the first non-cancelled `telegraphResolved` of a Tide telegraph | A wave's rush and its crash. It plays for each sweep, front and then back. | 0.4 s / 2 |
| Pack Call | `telegraphStarted` of `gorehound_pack_call` | A **howl stinger**: the Matriarch's A3→D4, then the pack answering further off (E4→A4 and D4→F4). The music ducks for it. | 1 s / 1 |
| Execution | `telegraphStarted` of `vharun_execution` | A **drum roll** for the whole windup, quickening and swelling. It is the telegraph's windup, so a cancelled cast cuts it and Stasis holds it. | 0.3 s / 1 |
| Executed / spared | that telegraph's `telegraphResolved` | **Gong** (a brass bell on D2, a thump and a cymbal) if the target went down in that batch or is down. **Bell** (handbells on D5 and A5 with a glass D6) if they were spared. A cancelled cast makes neither. | 0.5 s / 1 each |
| Iron kills | `enemyKilled` of an `material: 'iron'` def | Iron, not porcelain, by role. Swarm (hound, leech): a small clatter that cycles 3 tones. Caster: an anvil on D4 with a wet pop. Brute (Impaler, Sentinel): an anvil on D3 with a chain. Mini-boss and boss: a cascade of three anvils, a cymbal, and for Vharun a brass bell and a low choir. | swarm 0.035 s / 4; others cap 2-3 |
| Execution windup style | `windStyle` | A `mend` answer winds up as a swell, not brass | — |

**Execution's outcome.** No event field records it (stage-A `check.problems`). Audio infers it:
the target was executed if an `allyDowned` or `allyOut` for them is in the same batch as the
`telegraphResolved`, or if their state is downed or dead. Otherwise they were spared, which
covers a lift above 40%, a Ward, Fermata, Martyr's Vow, and so on.

**Bleed stacks at a cleanse.** `statusRemoved` carries no stack count, so audio keeps each hero's
last `statusApplied.stacks` and reads that.

### Movement I is unchanged

`tests/audioPhase5.test.ts` keeps a snapshot of every source scheduled. For each source it
records the kind, the frequencies set, and the start and stop times, then takes an FNV hash and
a count. The snapshot was captured from `main` before any change, with `Math.random` seeded the
same way for each score. It covers:

- 11 mood cases: title, map, Loom, calm, combat at Resonance 0 and 100, boss at phases 1-3,
  victory and defeat;
- three real Movement I fights through the director: `first_light`, `bellwarden` and
  `hollow_cantor`, 30 s each, with the lab's auto-support bot.

All 14 are identical both with the default biome and after `setBiome('reliquary')`. In the
Crimson Spire, the title, the Loom and the two stingers also match the Reliquary snapshot. The
ambience bus stays silent in the Reliquary.

On a Movement I path:

- no Legion code adds a source or a `Math.random` call;
- the new `kill()` material check finds no material on Movement I defs and falls through;
- the new branches in `windStyle`, `telegraph()` and `telegraphResolved` require a `mend`
  answer, a Legion attack id or a tracked telegraph.

### Measurements (`tests/audioPhase5.test.ts`)

**In key.** These figures are the share of oscillator frequencies whose note is in D dorian,
counting a recipe's own partials as partials of an in-key note: glass, handbell, brass bell, the
horn's sub-octave and the anvil's ring.

| Case | In key |
| --- | --- |
| Crimson map; calm (Resonance 40); combat (0, 100); boss phases 1, 2 and 3; Matriarch phase 2 | 100% each (test: ≥ 94%) |
| Every crimson lab button and every iron kill | 100% each (test: ≥ 94%) |

**The Crimson Spire's music:**

- Its progressions are heard bar by bar: Dm C Bø7 C… in combat and Dm Dm Bø7 C Dm Bø7 Em7 Am7
  for a boss.
- The key is D dorian at 88 BPM.
- Its notes differ from the Reliquary's in combat, on the map and for a boss.
- In phase 2 the pad target is 0 for Vharun but not for the Matriarch, and D2 sources rise by
  more than 8 over 12 s (the heartbeat).
- In phase 3 the toms rise by more than 20% over phase 2, and the total source count rises.
- A biome change takes effect on the next bar line, and can be switched back.

**The bleed tick.** A test sends 120 bleed applications in 2 s (three every 50 ms on two
heroes). They produce between 6 and 15 ticks (⌈2 / 0.15⌉ + 1) and at most 2 voices. The tick
climbs with stacks, and it gains its glint at `BLEED_CHIME_AT` (5).

**Other checks:**

- Every `LEGION_SOUND_GROUPS` group is heard from a lab button, within its cap.
- The Chime release grows with the stacks cleared and stays silent on 'expired'.
- Execution: gong on a down; bell on a hit while still standing and on a Ward; nothing on a
  cancel.
- Iron kills by role; `hollow_chorister` and `bell_brute` keep `kill:swarm` and `kill:brute`.
- Movement I statuses (dirge, silence, a dirge cleansed) make no Legion sound.
- The runtime calls `setBiome` before `setMood`.

### Lab (`?lab=audio`)

**Music panel:**

- A **Biome** switcher (`biome-reliquary`, `biome-crimson_spire`).
- A **Vharun phase** selector (`warden-phase`: none, 1, 2 Bloodmoon, 3 judgement). It replaces
  the enemy count with a final boss at that phase.

Pick the boss mood to hear the stems.

**The Phase 5a · The Crimson Legion group:**

| Button | What it plays |
| --- | --- |
| `crimson-bleed-1`, `-5`, `-8` | One bleed tick at that stack count |
| `crimson-bleed-pack` | Stacks 1 to 8 in 0.4 s, to hear the gate |
| `crimson-pinned`, `crimson-latched`, `crimson-wound`, `crimson-pact` | Each status |
| `crimson-freed` | A pin, then a Reel freeing it |
| `crimson-release-2`, `-8` | A bleed at 2 or 8 stacks Chimed away 0.4 s later |
| `crimson-guard-block`, `crimson-guard-break` | A Sentinel's guard |
| `crimson-charge`, `crimson-pounce` | The moving attacks |
| `crimson-tide` | Both sweeps' windups and their breaks |
| `crimson-pack-call` | The howl |
| `crimson-execution-gong`, `crimson-execution-spared` | The roll for 4 s, then each outcome |
| `kill-iron-<def>` | One for each iron Legion enemy |

**Hooks and audits:**

- `window.__audioLab.setBiome(biome)`.
- `window.__audioLab.pitchCrimson()`: Goertzel in-key shares of the Spire's moods (map, calm,
  combat, boss p1-p3).
- **Audit moods** also renders the Crimson Spire's moods.

### Known gaps

- The Map calling `setBiome` with the Movement's biome belongs to the UI workstream (MapScreen).
  Until then the map keeps the last fight's biome. After a Crimson fight, the next Prelude map
  stays Crimson-voiced until its first fight resets it to the Reliquary.
- Decrees still share one horn. Twin Cleave has no stinger of its own (optional in the plan).
- The low male choir uses the shared choir formants, pitched low.
