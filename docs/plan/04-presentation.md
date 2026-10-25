# 04 — Presentation: Art, VFX, Audio, HUD, Onboarding, Accessibility

> A support game lives or dies on **legibility** and **feedback**. The player has to see what is coming, see what they did about it, and *feel* it land. This doc specifies how.

## 1. Art direction: "stained-glass cosmos"

Stylized low-poly forms with luminous emissive accents and strong silhouettes. The original's dark navy, gold and Cinzel look is the seed. The remake keeps its palette and type, and gives every biome its own lighting mood.

| Movement | Biome | Palette | Light | Enemy look |
|---|---|---|---|---|
| I | **Sunlit Reliquary**: ruined cathedral halls | warm ivory stone, gold | god-rays, dust motes | porcelain choristers with violet cracks (the Hollow Choir) |
| II | **Crimson Spire**: blood-forged fortress | obsidian, crimson, brass | torch flicker, red sky | armoured hemomancers, hounds, war-beasts |
| III | **Abyssal Rift**: the world coming unstitched | indigo void, teal frays | rim light from rift tears | shears, wraiths and maws stitched from void cloth |
| Finale | **Celestial Crucible** | white-gold, prismatic | music visualised as rings in the sky | the Silent Conductor and its mirror-choir |

**Readability rules**, which override art:

1. The combat floor is low-contrast and low-detail. Set dressing lives on the arena perimeter, so telegraphs always pop.
2. Each enemy *role* has a unique silhouette: brutes wide, casters tall with a glowing focus, snipers long-limbed with a lance, swarmers small and low.
3. Heroes wear saturated signature colours (Kael steel-blue, Lyra emerald, Vexis violet, Brann crimson, Seren silver, Oro moss). The Weaver is white-gold with trailing ribbons that *are* the threads' origin.
4. Gold always means "the Weaver did this": threads in Empower mode, attributed damage chips, Resonance and callouts. Players learn to look for gold.

**Asset sourcing** (prototype → ship):

- Heroes and rank-and-file enemies: **KayKit Adventurers** and **KayKit Skeletons** (both CC0, glTF, rigged), animated with the **KayKit Character Animations** pack (CC0). Recolour and accessorise them to the roles above.
- Arenas: **KayKit Dungeon Remastered** (CC0, 200+ modular pieces) for the Reliquary; kitbash the other biomes from KayKit sets plus custom shaders.
- Monsters for Movements II and III: **Quaternius Ultimate Monsters** (glTF, 50 animated). **Confirm the licence on quaternius.com first**, because one listing says CC0 and another says CC-BY.
- The Weaver and the 4 bosses are custom models (commissioned, or built in Blender to the KayKit proportions) because they carry the identity.
- The packs' licences are permissive, but the authors ask that unmodified copies not be resold. Keep their `LICENSE` files in `assets/licenses/`.
- Sources are listed in [README.md](README.md#sources).

## 2. VFX language

**Semantic colour and shape**: one meaning per colour, always paired with a shape so colour is never the only cue.

| Meaning | Colour | Shape / motion |
|---|---|---|
| Healing (Mend) | teal | upward motes, soft pulses along the thread |
| Shielding (Ward, barriers) | pale cyan | hexagonal shell, crack lines when damaged |
| Amplification (Empower, Weaver attribution) | gold | sparks on hit, gold number chips |
| Ailments | violet | dripping smoke, countdown ring above head |
| Enemy damage / threat | orange → crimson by severity | sparks, telegraph fills |
| Resonance | white-gold | rising notes, orbiting segments around the Weaver |

**Intensity budget.** Particle count has a hard cap per quality tier. During a *spotlight moment* (Perfect Ward, Save, Cue, Crescendo), everything else dims 20% for 0.4 s so the moment reads.

## 3. Feedback ("juice") specification

Every key event gets a deliberate stack of visual, camera, audio, UI and haptic feedback. This table is the acceptance checklist for Phase 1.

| Event | Visual | Camera / time | Audio | UI | Pad rumble |
|---|---|---|---|---|---|
| **Perfect Ward** | shell flares, then a shockwave ring; the attacker staggers | 80 ms hit-stop, 0.25 s at 35% speed | crystalline strike on the current chord's root plus a choir swell | "PERFECT" callout; Resonance segment shine | short sharp |
| **Save** (counterfactual lethal prevented) | gold flash outline on the hero; "SAVED" glyph | 0.3 s slow-mo; slight push-in | rising 3-note phrase in key | callout with what was prevented ("Requiem · 1,140") | double tap |
| **Chime** (Cleanse) | the bell lands with a ring of light; ailment smoke rips off the heroes caught in it | — | the Chime's handbell (pitched in key) + a breath whoosh | ailment icons shatter | light |
| **Reel** | thread snaps taut and the hero arcs to you on a ribbon trail | short lead toward you | rope zip + landing thud | — | medium |
| Thread attach / retarget | spline whips; target rim lights up | — | pluck on the scale degree of that hero's leitmotif | thread icon moves on the party frame | — |
| Thread taut / snap | thins and shimmers / bursts into strands | snap: small kick | rising tension whine / string snap | frame flashes "SNAPPED" | snap: medium |
| **Cue** (hero Solo) | hero's leitmotif sigil above them; their Solo VFX tinted gold | 0.15 s focus pull | hero leitmotif phrase (3–5 notes) | portrait flare; Resonance segment consumed | medium |
| **Crescendo** | aura rings expand ×1.5 and blaze; sky responds (per biome) | zoom-punch out, chromatic pulse | music jumps to its top layer with a cymbal swell | Resonance arc bursts; timer ring | long rumble |
| Enemy kill | white flash, dissolve in role colour | — | role-specific crunch | — | — |
| Elite / boss phase | shatter of shield; arena lighting shifts | brief pan to boss | phase stinger, quantised to the bar | phase marker ticks on boss bar | medium |
| Hero downed | desaturate the hero; red pulse at the screen edge | — | music drops a layer | frame turns grey with revive ring | long |
| Loot / reward | items burst then magnetise to the Weaver | — | rarity-scaled chimes | reward toast | — |

Damage and heal numbers are **aggregated** (per target per 0.4 s) and **sized by significance**, and can be toggled to "important only". The Weaver's share of damage shows as a gold chip on the number: `412 +96`.

## 4. Audio: "every support action is a note"

The original already reached for music words: Chorus, Resonance, Symphony, Cascade. The remake makes that literal, and that is the single biggest satisfaction lever we have.

### 4.1 Music director

- Each biome has a track in **4 stems**: *Pad*, *Pulse*, *Melody*, *Choir*. Stems fade in as Resonance crosses 25 / 50 / 75 / 100 and as combat intensity rises. All transitions are quantised to the bar.
- Each boss has phase stems. Phase transitions land on downbeats with stingers.
- The music director exposes `currentKey`, `currentChord`, `beatTime` and `barTime` to the rest of the audio engine.
- **Finale set piece, "Grand Silence"**: the Silent Conductor strips the music to nothing. Only the player's support actions make sound, and they rebuild the song note by note. Heroes reignite as the arrangement returns.

### 4.2 Pitched support SFX

- Support-action SFX are pitched to the **current key and chord** (scale-degree mapping), so good play *sounds* good and never clashes.
  - **Mend ticks** are soft plucks that **rise in pitch as the target's HP rises**. This is kept from the original, whose heal tick tracked the target's HP from 340 to 780 Hz and was its best feedback; here the pitch is quantised to the scale.
  - **Ward** is a glass-shield ring; a **Perfect Ward** plays a full chord.
  - **Resonance segments** are an ascending arpeggio.
- **Each hero has a 3–5 note leitmotif**, played when you Cue their Solo and quoted in their bond scenes. Players learn heroes by ear.
- Telegraph windups are **spatialised** (stereo position from screen position) and timbre-coded by answer (low brass for tank-busters, high glass for marks), so the player can *hear* what's coming from off-screen.
- Low-HP warnings use per-hero heartbeat timbres rather than one generic alarm.

### 4.3 Mixing and sourcing

- Buses: music, sfx, ui, barks and ambience, each with a slider. Big moments (Perfect, Crescendo) briefly duck the rest. Voice limiting keeps the same SFX from stacking past 4 voices. A master limiter sits at the end.
- Barks: text speech bubbles plus short non-verbal vocalisations, drawn from pools per event with cooldowns so they never spam.
- **Sourcing**: prototype with WebAudio synthesis and CC0 SFX such as Kenney's interface sound packs. Ship with licensed or commissioned stems. The stem and leitmotif design is the spec either way.

## 5. HUD

### 5.1 Principles

1. **Answer three questions at a glance.** Who is in danger? What is coming? What can I do *right now*?
2. **World first.** Threat lives in the world: telegraphs, threat lines, mark rings over heads. The HUD holds only your resources and your party.
3. **No menus in combat.** No menu tabs, no permanent controls panel. Key hints live on the ability buttons.
4. **Progressive.** HUD elements appear as their systems unlock (§7). A first-run player sees perhaps 40% of the final HUD.

### 5.2 Layout (combat)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ MOVEMENT I · node 3/6                 THE HOLLOW CANTOR  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░|░░░░░|  ph.2  │
│ Elite: Shielded · Volatile            ▸ REQUIEM 3.1s   answers: [⛨ Dome] [✦ Crescendo]   │
│                                                                                          │
│                     (world: telegraph decals with answer glyphs, threads,                │
│                      aura rings, mark rings over heads, threat lines)                    │
│                                                                              ▸ off-screen│
│ ┌───────────────────────────┐                        PERFECT WARD                ally  ▸ │
│ │◉ KAEL   ████████▒▒▒░░  ⛨  │  ▒ = damage incoming from active telegraphs               │
│ │  solo ◔ 80%   ◈ in field  │                                                          │
│ │◉ LYRA   ███░░░░░░░░  ☠ 2s │  ☠ = mark countdown (Cleanse)                            │
│ │  solo ● READY  [⇧2]       │                                                          │
│ │◉ VEXIS  ██████▒░░░░  ⟆    │  ⟆ = threaded                                            │
│ └───────────────────────────┘                                                          │
│        ( LIFE 300 )  [Q Ward 2.1][E Chime][F Reel][␣ Glide●●]    ( SPIRIT 45 / ▨▨▨ 55 )   │
│                       ═════ RESONANCE ◆◆◇◇ ═════   THREAD: MEND ⇄ EMPOWER [RMB]   [R] ✦    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Party frames** (bottom-left, large, colour-blind-safe):

- HP bar with a **shield overlay**, plus an **incoming-damage forecast**: a striped segment showing the damage of telegraphs currently aimed at that hero. This is the single most useful triage aid; it turns "read four things" into "look at stripes".
- Ailments with countdown rings.
- A **Solo charge ring** around the portrait. It glows and shows its Cue key when ready.
- A thread marker, an in-field pip and the Bond rank.
- Hovering a frame targets that hero for mouseover casting.

**Weaver bar** (bottom-centre):

- Life on the left. Spirit on the right, with the reserved portion hatched and labelled.
- Techniques with cooldown sweeps, cost and charges.
- Thread mode indicator.
- The Resonance arc with 4 segments, and the Crescendo key that blazes when full.

**Boss bar** (top-centre): HP with phase ticks; a **cast bar that names the ability and shows its answer glyphs**; enrage timer.

**Callouts**: centre-low, transient and rate-limited: PERFECT, SAVE, CLUTCH, SOLO READY, SNAPPED.

**Event feed**: optional, right side, last 5 notable events.

**Off-screen indicators**: edge arrows for heroes and for telegraphs targeting them.

### 5.3 Telegraph grammar (world)

| Shape | Means | Answer glyph examples |
|---|---|---|
| Filled circle | ground AoE | Scatter, Reel, Ward |
| Cone | cleave (usually tank-buster) | ⛨ Ward |
| Line / lance | beam or charge on one hero | ⛨ Ward, ⤺ Reel |
| Donut | safe only in the middle | ◎ Stack / Rally |
| Link (beam between two heroes) | shared fate (Blood Pact) | ↔ Scatter |
| Mark (ring over head) | single-target detonation | 💧 Cleanse, ⛨ Ward |
| Field (persistent ground) | zone denial | move / Rally |

- The **fill sweeps to the edge exactly at impact**. The Perfect window is a bright rim during the last 0.35 s, widenable in settings.
- **Severity colour**: amber means survivable; crimson means lethal to the target as they stand. Crimson is computed live from the target's current HP and shields, so warding a crimson telegraph visibly turns it amber. That is instant feedback that your Ward was enough.
- **Answer glyphs** sit on the telegraph edge. They are on by default during the first Movements and can be switched off for mastery (a Dissonance level also hides them).

## 6. Screens outside combat

| Screen | Purpose | Notes |
|---|---|---|
| Title | continue / new / settings / codex | living background: the Loom spinning |
| **The Loom (hub)** | diegetic room with stations: Astrolabe (passives), Reliquary (relics & crafting), Bonds (heroes), Callings, Atlas (Dissonance & Echoes), Training Grounds | stations unlock and light up over time (§7) |
| **Expedition prep** | pick Calling, 3 heroes, Chords (auras + ornaments), technique variants, carried relics; loadout presets | live Spirit budget bar; a field preview on a dummy party; stat deltas on every change |
| **Map** | branching nodes with reward previews | Hades-style reward icons; hover shows modifiers |
| **Draft** | pick 1 of 3 motifs | shows synergy tags, *what it upgrades*, and which Harmonies it would enable |
| **Forge / Merchant / Event** | node interactions | one screen, one decision, fast |
| **Results (per encounter)** | 3-second "highlight" banner of your best moment, plus grade | skippable; never blocks for more than 3 s |
| **Run summary** | party-HP timeline with your interventions marked (like a raid log); contribution breakdown; highlights reel; rewards; Bond XP | the place the support fantasy is *proven*, so see §6.1 |
| **Codex** | every enemy, telegraph, motif, relic and term, generated from content | entries unlock on first sighting |

### 6.1 Run summary: "proof of support"

- **Timeline**: four HP lines (one per hero) across the run's fights, with icons where you Warded, Saved, Cleansed, Reeled and Cued. Hovering an icon shows the moment.
- **Contribution breakdown** from the ledger: Amplified damage, Effective healing, Mitigated (absorbed, negated, avoided), Saves (with causes), Cleanses (with prevented damage) and Cues. Each is a big number with a one-line plain-English sentence ("Your Empower thread accounted for 31% of Lyra's damage").
- **Highlights**: top 3 moments by counterfactual value, replayable from the run's replay log.

## 7. Onboarding and progressive disclosure

The original front-loads a 6-page text primer and a HUD with every system visible. The remake **teaches by doing, one verb at a time, inside the first real run** (the *Prelude*: Movement I only).

| Step | New verb | How it's taught |
|---|---|---|
| Fight 1 | Move, Thread (Mend), Glide | Kael alone vs. choristers; "Kael is hurt — click him." Lyra and Vexis join mid-fight |
| Fight 2 | Ward and the Perfect window | Bell Brutes with slowed windups (assist on). A missed Perfect gets a gentle retry prompt |
| Fight 3 | Empower mode, Cleanse | Lamenter marks; "Lyra is marked — press E before it fills" |
| Elite | Reel | Glass Lancer beam on Vexis; the answer glyph pulses |
| Rest node | Directives | Kael charges ahead; "Press C ▸ Rally" |
| Boss | Resonance, Cue, Crescendo | Hollow Cantor's Requiem is the first "big answer" moment |

- **The simulation never runs behind tutorial text.** Any prompt that asks the player to read pauses the sim. In the original, the arena kept running behind the 6-page primer, so a new player closing it landed on an already-cleared first expedition.
- **Hints are contextual and expire.** Each shows at most 3 times and only when relevant ("Lyra is standing in a lethal zone — Reel her (F)").
- **Systems unlock by Weaver Rank** (see [02-game-design.md §9](02-game-design.md#9-meta-progression-the-loom)). The Loom's stations light up one by one, and each unlock comes with a 20-second interactive intro, not a wall of text.
- **Training Grounds** (unlocks after the Prelude) is a practice arena. It offers a Perfect-Ward trainer with adjustable windups, telegraph drills, and dummies that log your contribution numbers live. It is great for mastery and for testing builds.

## 8. Accessibility

| Area | Options |
|---|---|
| Visual | colour-blind palettes (protan/deutan/tritan) for telegraphs and semantic colours; shape and glyph always paired with colour; telegraph opacity and outline thickness; UI scale 80–150%; text size with a **12 px minimum** at 100% (the original used 8–10 px text 69 times) and WCAG AA contrast for labels; high-contrast telegraph mode |
| Motion | screen shake 0–100%; flash and chromatic pulses off; reduced-motion UI; hit-stop and slow-mo toggles |
| Timing | game speed 70–100%; Perfect window width +0–0.25 s; "telegraph lead" assist (+15% windup in the first Movements) |
| Input | full remapping; mouseover casting toggle; hold-vs-toggle for Thread mode; **gamepad support** (left stick move; right stick snaps a target reticle between heroes; triggers Thread/mode; face buttons techniques; d-pad Directives) |
| Cognitive | answer glyphs on/off; "important numbers only"; Auto-Thread assist (thread follows the lowest-HP hero after 2 s of no input); **Hero Autonomy** (heroes fire their own Solos at 70% potency) |
| Audio | separate bus sliders; visual captions for spatial audio cues ("Brass windup — left") |

Assists never block achievements. They show as a small badge on the run summary, nothing more.
