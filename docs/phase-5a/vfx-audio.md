# Phase 5a: Movement II, the Crimson Legion (VFX and audio)

Movement II (see [Phase 5a](../phase-5a.md)) takes the run up the **Crimson Spire**. This page
covers how it looks: the Spire's arenas, the Legion's bodies and how they move, and every Legion
status, guard, pool and boss cue. The audio half (the crimson voicing, Vharun's stems, the
Legion's sounds) is W7's and follows below it when it lands.

**What it reads.** Render reads only the contract's state and events (docs/phase-5a.md,
CONTRACTS): `ArenaDef.biome`; `EnemyDef.material` and `guard`; `AttackDef.move`, `linkStatus`
and `executeBelow` (through the telegraph's `attackId` when the telegraph doesn't carry them);
the statuses `bleed` (its `stacks`), `wound`, `latched` (its `source`), `pinned`, `pact` and
`condemned`; `enemy.guard {fx, fz, brokenUntil}`; `field.sanctuary.pools`; `enemy.cast`; and the
events `attackFired` 'charge' / 'leap', `guardBlocked` and `guardBroken`. Nothing is in
`src/sim`.

**What it leaves alone.** Every key it reads is absent in Movement I, so a Prelude fight is drawn
exactly as before. `tests/renderMovement2.test.ts` pins it:

- every Movement I arena's `setMood` arguments, mesh count, geometry, uniforms and shaders;
- every Movement I enemy model;
- a First Light fight drawing none of the new cues and keeping no new state.

No new FX batches, draw calls or materials: the kit keeps its 12 batches, and the Spire swaps its
torch cards and embers in for the god rays and dust (one mesh each).

## What changed

| File | Phase 5a work |
| --- | --- |
| `crimsonCues.ts` (new) | Pure helpers, tested in Node. `CRIMSON_HEX` (the new semantic colours) and `SPIRE_HEX` (ambient: sky, torch, rim, Bloodmoon, iron, banner). `arenaLook` / `arenaMood`: the per-biome mood table that replaces `warm = def.id !== 'sandbox'`. `isQuadruped`, `materialOf`, `moveOf`, `guardHalf`, `guardArc` (from the *sim's* guard direction), `guardBrokenAt`. `crimsonStatuses` (one read of a hero's Legion statuses), `pipOffset`, `statusAnswers`. `isPact`, `executeBelowOf`, `TIDE_HALF`, `PACT_LABEL`. `inSanctuary`, `bloodmoonOn`, `CUT_HEAL_SIZE` / `CUT_HEAL_ALPHA`. |
| `arena.ts` | The mood comes from `arenaMood(def)`. The Spire builds its own floor (iron plates, blood-channel grooves, brass inlay), ramparts (obsidian towers, banners, brass braziers, chains; tall pieces only on the far side, one draw call), spire pillars, torch cards and rising embers. A Movement I arena takes the old code path unchanged. `ArenaView.look` says which. |
| `models/library.ts` | `buildEnemy` builds the seven Legion bodies by id before any role (`buildLegion`): two quadrupeds (the Matriarch with a mane of spines), the robed Hemomancer with a caged blood orb, the Impaler's long forward pike, the Sentinel's tower shield, the ribbed Leech, and Vharun with a twin-bladed glaive and a brass crown. `buildSpirePillar` for the Spire's obstacles. Primitives only. |
| `entities.ts` | `AILMENTS` gains bleed, latched and wound (the sim's set). The quadruped gait, the Pounce crouch, the charge lean, and the leap arc and charge rush (`travel()`, from `attackFired`). The statuses: bleed pips and drips, Wound's heart, a latch's tether, a pin's stake and ring. The guard arc and its broken flash (`guardBreak()`). `drawnM2` counters. |
| `telegraphs.ts` | Blood Pact: the link in its plum tint, `+20%` on its badge. The Crimson Tide: its badge near Vharun. Execution: `<40%` on the mark's badge. Answer badges over a hero a Legion status holds. `drawnM2` counters. |
| `field.ts` | Sanctuary pools (teal ring, gold rim, dashed inner ring, rising motes), after the hymn circles. `sanctuaryOverride` (lab) and `pools(state)` (the override, else the sim's). `drawnM2.pools`. |
| `feedback.ts` | Iron deaths. The charge's streak and the leap's landing ring. `guardBlocked` ('Blocked', rate-limited) and `guardBroken`. The Bloodmoon sky lerp on the light handles. Heal numbers outside the pools, smaller and dimmer. `firedM2` counters and `bloodmoon`. |
| `overlay.ts`, `partyBars.ts` | The Execution notch on the bar over the marked hero (`AllyBarView.notch?`, absent otherwise; `executionOn`). `LABELS.mend` reads **Mend**, as the HUD's `ANSWER.mend` does (`glyphLabel`). |
| `fx/sprites.ts` | `SPRITE.drop` (a stack pip), `SPRITE.wound` (a cracked heart), `SPRITE.stake`. |
| `fx/rings.ts` | `RING.guard`: a ribbed arc over a faintly filled sector, cracked by `param`. |
| `lab/VfxLab.tsx` | **Phase 5a · Movement II** group, the `gallery2` preset, Movement II encounters in the encounter list, the Sanctuary pools toggle and the `window.__VFX__` hooks (below). |
| `tests/renderMovement2.test.ts` (new), `tests/colorVision.test.ts` | Tests (below). |

## The Crimson Spire

| | Reliquary (Movement I) | Crimson Spire |
| --- | --- | --- |
| Sky (hemisphere) | `#ffe7c2` at 0.6 | `#3a1416` at 0.55 |
| Key light | `#ffd9a0` at 1.85 | torch `#ffb27a` at 1.6 |
| Rim light | the theme's accent at 0.55 | crimson `#9e2a33` at 0.6 |
| Fog | the theme's, 46 to 96 m | `#1c0f10`, 38 to 84 m |
| Floor | flagstone courses, a rosette | iron plates with rivets, six blood-channel grooves, brass inlay rings and a hexagonal seal |
| Perimeter | ivory columns, low walls, candles, rubble | obsidian rampart towers (crenellated on the far side), long banners, brass braziers, hanging chains, iron debris |
| Pillars | broken ivory drums | obsidian spires, brass-banded, a crimson inlay, a spiked cap |
| Air | 7 god rays, 420 dust motes | a flickering torch card and halo over every brazier, 320 rising embers (thicker toward the rim) |

Both floors are darkened ×0.78 and kept low in contrast, so lethal and threat telegraphs pop.
Crimson stays in the sky, the rim light and the perimeter (banners): never on the combat disc.
On **Low** quality the torch cards and embers hide, as the god rays and dust do.

## The Legion

| Body | Silhouette | Motion |
| --- | --- | --- |
| Sanguine Hound | a low quadruped: a long barrel, lowered head and snout, ember eyes, ears, iron plates down its back in its accent, a tail | **a dog's gait**: a quicker, deeper bob and a pitch rock, no side sway |
| Gorehound Matriarch | the same body at 1.5 m, with a mane of brass spines raked back over the neck | the gait; **the crouch** (squashed 26%, pitched forward, a shudder) through Pounce's 1 s windup, then **the leap**: an arc 1.4 m + her radius high, 0.42 s, from where she crouched to where the sim put her, and a ring where she lands |
| Hemomancer | robed and hooded, ember eyes in the dark, a blood orb held out in a brass cage | the cast glow round the orb |
| Impaler | a plated charger, a helm, a long pike held low and level with a steel point well past its body | **the lean** into the pike through the windup (a shudder at the end), then **the rush** to the line's end (0.22 s) with a streak in its accent and dust along the line |
| Crimson Sentinel | wide and squat behind a tower shield of three plates, brass-rimmed, the boss in its accent | its guard arc (below) |
| Leech | a ribbed bulb on stubby legs, a ringed sucker for a mouth | the tether to the hero it latches (below) |
| Vharun, the Crimson Warden | an armoured warden: pauldrons, a slit helm, a brass crown with six points, a twin-bladed glaive across the body | the boss's breath; Impale's lean and rush |

Every body is steel-bone (`#b9b1aa`) with its accent from content and brass trim. **Iron deaths**
(`material: 'iron'`): dark iron shards, pale ember sparks and a little smoke where it fell, its
accent's ring and an ember flash. Never a red mist. Porcelain enemies still break into
porcelain.

## Statuses, guards and boss cues

| Visual | When | What you see |
| --- | --- | --- |
| **Bleed** | `bleed` on a hero or the Weaver | A **violet drop pip per stack** over the head (8 at most), centred and spreading as they grow, plus violet drips falling off them, more with more stacks. From **5 stacks** the pips glow and pulse and a **Chime** badge shows over the head with the count (`×6`). Bleed is an ailment: violet, never red. |
| **Wound** | `wound` | A **cracked heart** over the shoulder in the ailment violet, bobbing. |
| **Latched** | `latched` (its `source` is the Leech) | A **violet tether**, dashed and flowing, from the Leech to the hero, in a soft glow. **Reel · Chime** badge, labelled *Latched*. |
| **Pinned** | `pinned` | A **steel stake** standing beside the hero, an **amber ring** at the feet and a dashed one outside it. **Reel** badge, labelled *Pinned*, with an amber border. |
| **Guard arc** | `enemy.guard` | A **brass arc** at the Sentinel's feet across its 120°, ribbed like shield plates, the sector it guards faintly filled. It points along the **sim's** guard direction (`guard.fx, guard.fz`), not the body's smoothed yaw, so it never lies about which side is guarded. **Broken** (`brokenUntil` ahead): it cracks into shards, the fill drains, a white ring and a brass flash on the frame it breaks; a brass shatter and *GUARD BROKEN* on `guardBroken`. A blocked hit (`guardBlocked`) throws back a brass swipe on that side of the arc and a grey *Blocked*, at most every 0.6 s per enemy. |
| **Blood Pact** | a link whose status is `pact` | The link renderer, in its own **plum tint** (`#9d4f8a`) while the pair stand apart; **lethal red**, pulsing, within 6 m, as every link. Its badge reads **`+20% · 4.2`**. |
| **Crimson Tide** | a cone 180° wide | The cone telegraph over half the arena, front then back. Its badge sits **near Vharun** (6 m out), not at the cone's far edge, which is off the arena. |
| **Execution** | a mark with `executeBelow` | The mark over the head, its badge reading **`<40% · 3.1`**, and a bright **notch at 40%** on the bar over the marked hero: lift them past it, or Ward. |
| **Sanctuary pools** | `field.sanctuary.pools` (Bloodmoon) | Each pool a **teal heal ring** with a **gold rim**, a slow dashed gold ring inside it, and teal and gold motes rising, as the hymn circles. |
| **Bloodmoon** | while the pools are up | The hemisphere light lerps toward **crimson** (`#8a1c24`, 55%) and dims 15% over about 2 s, and back when they go. A Mend landing **outside every pool** shows its number **28% smaller and dimmer**. |

**Colour.** Every new semantic colour is ΔE ≥ 20 from lethal, threat, the Martyr's Bear, Mend
and Empower under every colour-vision palette (tested):

| Colour | Hex | Used for |
| --- | --- | --- |
| `pact` | `#9d4f8a` | Blood Pact's link and `+20%` |
| `guard` | `#c9b28a` | the guard arc, its swipe and shatter |
| `pin` | `#e2c78f` | the pinned ring and badge border |
| `stake` | `#cbd5e1` | the pin's stake |
| `notch` | `#f1f5f9` | Execution's notch |
| `ember` | `#ffd2a6` | iron deaths' sparks, the Spire's embers |
| `blocked` | `#cbd5e1` | the 'Blocked' floater |

Bleed, Wound and Latched draw in the live **ailment violet**, and the pools in the live **heal teal
and gold**: neither is a new colour. The Spire's ambient colours (sky, torch, rim, Bloodmoon,
banners, iron) are not semantic and stay off the combat disc.

## The VFX lab

`?lab=vfx` → **Phase 5a · Movement II**. Each scenario restarts the real sim on a Crimson Spire
floor and stages it with real spawns and commands. Until the sim produces a Legion mechanic itself
(the workstreams land in parallel), a **lab stand-in** puts it in place a moment later, only if the
sim hasn't: a status on a hero, a guard, the pools, a scripted attack begun with the sim's own
`beginAttack`, or a charge or leap. `crimsonStats().standIns` names each one used; once the sim has
it, the stand-ins stand aside on their own.

| Scenario | Floor | Staging |
| --- | --- | --- |
| Gallery · the Legion | Spire Gate | `gallery2`: every Legion body side by side |
| Hounds · bleed stacks | Spire Gate | five hounds on Kael; bleed climbs to 7 (pips, then the glow and Chime from 5) |
| Hemomancer · Blood Pact | Blood Forge | a Hemomancer's Blood Pact; you Scatter at 3 s (lethal red, then plum) |
| Impaler · charge and pin | Spire Gate | an Impaler's charge at Lyra: the lean, the rush and streak, the pin |
| Sentinel · guard and flank | Barracks | a Sentinel, Focused: its arc, the party flanking, a 'Blocked' |
| Sentinel · guard broken | Barracks | Lyra Empowered; at 2 s the guard breaks (flash, cracks) |
| Leech · latch | Blood Forge | two Leeches on Lyra; the tether, Reel · Chime |
| Vampiric · wound | Spire Gate | an elite hound on Kael; the cracked heart |
| Matriarch · Pounce | Kennels | the Matriarch's Pounce at Lyra: the crouch, the leap, the landing ring |
| Vharun · Twin Cleave | Warden's Throne | Twin Cleave on Kael |
| Vharun · Bloodmoon pools | Warden's Throne | two drifting pools, the crimson sky; Kael threaded (his Mend numbers dim outside) |
| Vharun · Crimson Tide | Warden's Throne | the front cone, then the back cone |
| Vharun · Execution | Warden's Throne | Lyra at 32%: the mark, `<40%`, the notch on her bar |
| Iron deaths | Spire Gate | three hounds and a chorister struck down: iron beside porcelain |

**Presets and toggles.** *Legion gallery* (`preset('gallery2')`), *Sanctuary pools* / *No pools*
(`setSanctuary`), and the Movement II encounters in the encounter list (`crimson_gate`,
`red_muster`, `blood_forge`, `gorehound_matriarch`, `vharun`). The Theme select lists the Spire's
five arenas (it lists every arena in content).

**`window.__VFX__`.**

- `crimsonScenarios()`: the scenario names.
- `crimsonScenario(name)`: restarts and stages one.
- `crimsonStats()`: the floor and its biome; `drawn` (last frame: quadrupeds, crouch, lean, leaps,
  charges, pips, pipsHot, wounds, tethers, stakes, guardArcs, guardBroken, pacts, tides,
  executions, statusBadges, pools); `fired` (so far: leaps, charges, blocked, guardBroken,
  ironDeaths, cutHeals); `bloodmoon` (0..1); the pools; the `standIns` used; every hero (position,
  life, statuses with stacks) and enemy (def, cast, guard).
- `setSanctuary(on)`: the lab's drifting pools.

## Tests

`tests/renderMovement2.test.ts` drives a real sandbox sim (and a real First Light fight) through
the real `EntityLayer`, `FieldView`, `TelegraphLayer`, `PartyBarsView` and `Feedback` over a real
`FxKit`. Where a mechanic is the sim's to produce, the test stages it on the real world the way the
sim keeps it (a status with its stacks, `enemy.guard`, `field.sanctuary`, an `attackFired`
'leap'), and Legion attacks are begun with the sim's own `beginAttack`.

- **Movement I is drawn as before**: each Movement I arena's `setMood` arguments (a snapshot), mesh
  count and a fingerprint of its geometry, uniforms and shaders; each Movement I enemy model's
  geometry; twelve seconds of First Light draw no Movement II cue and keep no `field.sanctuary` or
  `notch`; the overlay labels the Mend glyph *Mend*, as the HUD does.
- **The Spire**: its mood for each of the five arenas; the same mesh budget as a Reliquary arena;
  torch cards and embers hide on Low; every Legion body differs from its role's porcelain one, and
  from each other.
- **Statuses**: pips per stack (capped at 8), the glow and the Chime badge with `×N` from 5; the
  Wound heart; the latch tether to its Leech with Reel · Chime; the pin's stake with Reel.
- **The guard**: the arc's middle points along the sim's guard direction, whichever way the body
  faces; broken, it cracks (`param` 1) and flashes; 'Blocked' is rate-limited; *GUARD BROKEN*.
- **The pools**: drawn per pool, the lab override, the sky lerping toward the Bloodmoon and back;
  a heal outside every pool smaller and dimmer than one inside.
- **Telegraphs**: the Tide's two 180° cones with the badge near Vharun; a Blood Pact's `+20%` (and
  a Bellwarden's Resound without it); Execution's `<40%` and the notch on the marked hero's bar
  only.
- **Motion**: the hound's gait; the Matriarch's crouch through Pounce's windup, then the leap (in
  the air mid-arc, landed where the sim put her); the Impaler's lean, rush and streak; iron deaths
  for iron, porcelain for porcelain.
- **The budget**: through a busy Legion scene (every cue at once) the kit keeps its 12 batches and
  stays inside every batch's capacity.
- **Colour**: every `CRIMSON_HEX` colour ΔE ≥ 20 from lethal, threat, Bear, Mend and Empower under
  every palette (also in `tests/colorVision.test.ts`).
