# Phase 5b: Brann, the Bloodsworn (VFX, colour and audio)

Brann (see [Phase 5b](../phase-5b.md)) is the first hero recruited into the roster. This page
covers how he looks and sounds: his colours and the tests that hold them, the Movement II ΔE
table that decided his brass trim, his sound groups and their limits, his war drum and the rule
for his low-life alert. The design is in `docs/phase-5b.md` ("Presentation"); this page records
what shipped.

**What it leaves alone.** Every Brann cue keys on `hero.blood` (present only for a hero with Blood
Rage), on `defId === 'brann'`, or on events only he emits (`lifeSpent`, `bloodlust`,
`titheRefund`, a hero-sourced `attackFired` 'leap'). The default party draws and sounds exactly as
before: `tests/renderBrann.test.ts` pins the starters' model hashes, and
`tests/audioBrann.test.ts` keeps the default heroes' sounds byte-equal.

## Colours

| Role | Hex | Where |
| --- | --- | --- |
| Body (`HeroDef.color`) | `#b91c1c` | his model's crimson sash, his frame's border, his chips |
| Ink (`heroInk`) | `#d26b6b` | lifesteal motes and their soft "+N", the Bloodletting floater, the 'New ally' name |
| Brass trim (`BRANN_HEX.brass`, `BRASS_TRIM`, `signalHex`) | `#a6a650` | collar and axe edge; every signal drawn beside danger: swipes, the leap, his Solo and ground rings, his edge arrow, the bar's key tag, his Bonds moments |
| Ember (`BRANN_HEX.ember`) | `#ffd2a6` | Blood Rage's glow, the raging band over his head |
| Drain (`BRANN_HEX.drain`) | `#7f1d1d` | Bloodletting's drain segment on the bar over his head |
| Frame raging fill (`RAGING_COLOR`) | `#c2410c` | his frame's life between 40% and 15% (see "Known deviations") |

**The brass changed in W6.** The design first gave the trim as `#c8a46e`, the Spire's polished
brass. That is the Impaler's own accent (0 ΔE), so an Impaler's telegraph ring, badge border and
charge streak would have worn the colour of his swipes. It also sat 11.6 ΔE from Vharun's accent,
13.8 from Lyra under protanopia and 14.5 from the Weaver's amp gold under tritanopia. The
tarnished brass `#a6a650` replaces it. Its lowest ΔE values (2026-11-03): the Weaver's gold
`#f5d78e` 20.8 (protanopia), the red-green lethal `#c84300` 20.9 (deuteranopia), the Leech accent
`#7a8f5a` 21.3, the Impaler accent `#c8a46e` 21.5 and Vharun's accent `#e0c48a` 22.6 (normal), and
Vexis `#a78bfa` 21.6 (tritanopia).

**No danger channel wears his colour.** His crimson never fills a lethal, threat or Bear cue;
where a hero colour would sit beside danger, his brass is drawn instead (`signalHex`).

### The Movement II environment

Brann's body (`#b91c1c`) and his lifesteal ink (`#d26b6b`) measured against every Legion body and
accent and the Bloodmoon's tint, in normal vision (`tests/colorVision.test.ts`, 2026-11-03). The
rule: where any pair falls under 15 ΔE, his identity can't rest on colour there, so a model test
asserts the brass trim parts exist. The test holds the rule in every vision, which is stricter.

| Legion colour | Body ΔE | Ink ΔE |
| --- | --- | --- |
| Legion bodies (bone) `#b9b1aa` | 76.2 | 44.2 |
| Hound / Matriarch accent `#c9785a` | 37.9 | 16.3 |
| Hemomancer accent `#b0577a` | 49.7 | 23.3 |
| Impaler accent `#c8a46e` | 61.5 | 39.1 |
| Sentinel accent `#8fa3b8` | 86.9 | 54.2 |
| Leech accent `#7a8f5a` | 79.9 | 58.0 |
| Vharun accent `#e0c48a` | 70.8 | 47.0 |
| Bloodmoon tint `#8a1c24` | 24.3 | — |

Lowest outside normal vision: ink against the Leech's accent, 4.3 under deuteranopia; ink against
the hound's, 9.5 under tritanopia. Hence the trim, and hence his ink never fills a danger channel.

### Hero against hero

Every pair of hero colours, and every hero against the Weaver's gold, is ≥ 20 ΔE in every vision,
with one exception. Brann against lethal, threat and Bear is ≥ 20 in normal vision and ≥ 10 in
every vision.

**Known starter gap: Kael and Vexis.** Kael's blue `#5b8def` and Vexis's violet `#a78bfa` were
chosen before hero colours were measured (Movement I). They collapse under red-green vision: 3.2
ΔE under protanopia and 8.9 under deuteranopia. Their silhouettes, leitmotifs and key numbers carry
them apart. Changing a starter's colour was out of this slice, since the default party must stay
byte-identical. The test pins the pair at a floor of 3, so it can't get worse; every other pair,
and every pair with Brann, holds the full 20. Fixing it needs a starter colour pass with its own
render and UI snapshots.

## Model and VFX

These are summarised here; the full list is in `docs/phase-5b.md`, "Model and VFX".

- **Model** (`buildHero`, `case 'berserker'`): broad and bare-armed, scars, a two-handed axe
  carried low, a crimson sash, dark-iron bracers and the broken collar, with brass trim on the
  collar and axe edge. It reads apart from Kael in greyscale (a longer, lower silhouette and a
  different value). Primitives only.
- **Bars over the heads** (`partyBars.ts`): notches at 40%; at 30% with Berserker's Hymn or Blood
  and Silk (one notch for both); at 10% with Deathless; the ember raging band from 40% to 15%; a
  pulse only below 15%, falling fast or with a lethal hit coming. With a lethal hit coming he is
  critical (no ember fill), as on his frame.
- **Bloodletting**: a crimson drain segment on the bar (`drainOf`; the white hit trail is moved
  down with it, so the drop never reads as a hit), a palm-cut spark and three pips on the axe.
- **Lifesteal**: crimson motes from `healApplied {via: 'lifesteal'}`, never drawn as a cut heal.
- **Sunder Leap**: the existing `attackFired 'leap'` arc, from a hero source, and a landing dust
  ring; Red Comet adds a gold shock ring.
- **Red Frenzy**: a yaw spin and a crimson swipe ring that follows him; Cued, the ring is
  gold-edged and the motes larger.
- **Budget**: no new FX batches.

## Audio

### Leitmotif and call phrase

Both are in D dorian, on the new `bowedLow` voice (a low bowed string over a `thump()`), in the
register under every other hero's. `motifNote` and `heroNote` branch for it before their glass
`else`.

- **Leitmotif:** A2–C3–D3–E3. It passes the tonic and keeps climbing: unfinished.
- **Call phrase:** A2–C3–D3–F3–E3. The motif's A2–C3 pick-up, then D–F…E: it overshoots to F and
  falls back, hanging on the 2nd. The Weaver's Ward answers it down to D3 (`resolve: -7`).

### Sound groups and limits

`BRANN_SOUND_GROUPS` and `BRANN_SOUND_LIMITS` (`src/audio/sfx.ts`). The rate gate is the shortest
time between two plays of a group (per hero); the cap is the most voices of it at once. None of
these can sound without Brann in the party.

| Group | Key | Gate (s) | Cap | What plays it |
| --- | --- | --- | --- | --- |
| `leap` | `brann:leap` | 0.4 | 1 | Sunder Leap: a whoosh and a slam (a hero-sourced `attackFired` 'leap') |
| `bloodletting` | `brann:bloodletting` | 0.5 | 1 | `lifeSpent`: a hiss and a low pluck |
| `frenzy` | `brann:frenzy` | 1 | 1 | Red Frenzy's whirl (its `soloStarted`), a loop |
| `frenzyHit` | `brann:frenzyHit` | 0.3 | 2 | Red Frenzy's spins (`attackFired` 'cleave' while it lasts) |
| `lifesteal` | `brann:lifesteal` | 0.25 | 2 | his axe drinking (`healApplied` via 'lifesteal'): a sip, E3 drawn up to A3 |
| `refused` | `brann:refused` | 1 | 1 | a refused Rally (`bloodlust`): a drum hit |
| `tithe` | `brann:tithe` | 0.2 | 2 | `titheRefund`: a chime (the Weaver's voice) |
| `silk` | `brann:silk` | 0.8 | 1 | Blood and Silk making Resonance: a tick once a second (the Weaver's voice; read from the state) |
| `drum` | `heart:brann` | 0 | 2 | his heartbeat, the war drum (below) |

Also in his voice: his hit at 82.4 Hz (E2), the flourish kind `redComet`, and a talent or
alt-Solo sound group for every Brann id (`iron_will`, `blood_oath`, `deathless`,
`berserkers_hymn`, `blood_brother`). The Weaver's own Blood Font keeps `self`.

### The war drum

Below his raging line (40%) his heartbeat is a war drum, not a heart: A1, then E2 0.2 s later.
Its tempo follows the life he is missing: beats 1.3 s apart at his line, down to 0.7 s with none
left (`1.3 − 0.6 × rage`, where `rage = 1 − (hp/max) / 0.4`). Its gain is fixed: it never swells,
so it is Blood Rage heard, with no alarm in it. It plays on the ambience bus.

### The alert rule

Brann's low-life alert is the same two soft notes as every hero's, but only in real danger:

- below his critical line (15%);
- falling fast (the last two seconds' damage would take what he has left: `fallingFast`); or
- with a lethal hit coming, as the bars show it (none while the Martyr's Vow covers every blow).

Never for the band he fights in. It sounds once a danger and re-arms when the danger has been gone
for two seconds. It shares the alerts' 1.5 s spacing with the other heroes. The default heroes'
alert branches, and their order, are unchanged.

## Known deviations

- **Frame and bar raging fills.** His frame's raging fill is a deep ember `#c2410c`; over his head
  the band is the pale Spire ember (`#ffd2a6`, on the bar's white-to-ember gradient). Both sit
  outside the alarm colours and both switch off at the same line (15%, falling fast or a lethal
  hit), so the levels agree; only the shade differs. `healthLevels.ts`'s 'one ramp for both'
  holds for the levels, not yet for this shade: matching them is open, for a playtest to judge.
