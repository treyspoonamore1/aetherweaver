# 03 — Content Bible

> Every number here is a **starting value** for the balance harness ([05 §11](05-technical-architecture.md#11-balance-harness-the-secret-weapon)), not a final tune. Rules and interactions are the design. Mechanics are described in [02-game-design.md](02-game-design.md); this file is the catalogue.

## 0. Naming

The original borrows many names directly from Path of Exile: Enlighten, Generosity, Arrogance, Prism Guardian, Victario's, Shavronne's, Alpha's Howl, Chayula, Vaal, Ascendancy, Waystones, plus PoE-style Chaos/Exalted/Divine currencies. That is fine for a private prototype but a problem if the game is ever shared or sold. The remake leans into the theme the original was already reaching for (Chorus, Choir, Resonance, Symphony, Cascade) and **names things musically**:

- **Auras** are named after musical directions, with a plain subtitle: *Allegro: Haste Aura*.
- Support runes become **Ornaments**, after musical ornaments (*Grace Note*, *Pedal Point*).
- Hero signature abilities are **Solos**. The player **Cues** them.
- Boons are **Motifs**; duo boons are **Harmonies**; acts are **Movements**.
- Difficulty is **Dissonance**.

The original's own names are kept wherever they are the user's IP: *Aetherweaver*, the *Astrolabe*, Kael, Lyra, Vexis, the *Sunlit Reliquary*, *Crimson Spire*, *Abyssal Rift*, *Celestial Crucible*, and keystone names like *Martyr's Aegis*, *Triad Bond* and *Temporal Mastery*.

## 1. The Weaver's techniques

Base kit plus unlockable **variants** per slot, chosen in Expedition prep. Variants unlock through Weaver Rank and Calling mastery.

| Slot | Default | Variant B | Variant C |
|---|---|---|---|
| **Thread** (LMB / 1–4) | **Thread**: Mend (55 HP/s) or Empower (+25% more damage, +10% attack speed). Comfortable range 10 m; *taut* 10–14 m (potency falls to 60%); snaps at 14 m (1.0 s lockout) | — (the Thread is always the Thread; motifs reshape it) | — |
| **Ward** (Q) | **Ward**: barrier of 30% target max HP + 120 for 3 s. 20 Spirit, 7 s cooldown. **Perfect** if a hit lands within 0.35 s of casting: the hit is fully negated, 50% cooldown refund, attacker staggered 1 s, +20 Resonance | **Chorale**: 6 m burst; 14% max HP barrier to every hero hit for 2.5 s. Perfect if ≥ 2 heroes are struck within the window | **Aegis Link**: link two heroes for 4 s; damage to either is split evenly between both. Perfect: split three ways (including you) and the triggering hit is negated |
| **Cleanse** (E) | **Chime** (from the original): an aimed bell thrown to the cursor (it snaps to a hovered hero), landing after 0.25 s in a 4 m radius. Removes ailments, 1.5 s ailment immunity, heals 8%. 15 Spirit, 9 s cooldown. *Clutch* if a mark had < 1 s left (+15 Resonance). It does not revive | **Purge**: removed ailments detonate on enemies within 5 m (damage = remaining ailment damage × 1.5) | **Absolve**: also grants 2 s of 25% damage reduction and heals 25%; 14 s cooldown |
| **Reel** (F) | **Reel**: pull the *threaded* hero to 2 m in front of you over 0.35 s (untargetable while flying). 25 Spirit, 14 s cooldown | **Swap**: trade places with the threaded hero. *You* take what was coming for them | **Anchor**: the threaded hero becomes immovable with 40% damage reduction for 2.5 s (counters pulls, knockbacks, Void Maws) |
| **Glide** (Space) | **Glide**: 6 m dash, 0.25 s i-frames, 5 s cooldown | **Phase Step**: 8 m blink that leaves a decoy, which draws threat for 2 s | **Skate**: 2 charges of a 4 m dash, 4 s cooldown each |
| **Cue** (⇧1–4, or T on the threaded hero) | Fire that hero's **Solo** at full potency (+ Cue bonuses). Costs **25 Resonance** (one segment). The Solo must be charged | — | — |
| **Crescendo** (R) | Spend **100 Resonance**: the Calling's ultimate (see §2) | — | — |
| **Directive** (C wheel / middle-click ping) | **Focus** (mark a target: heroes prioritise it and interrupt it if they can) · **Rally** (heroes regroup on you) · **Hold** (keep current positions) · **Scatter** (spread ≥ 6 m apart). 3 s cooldown | — | — |

**Range:** every technique has a 14 m cast range, matching the Thread's snap distance.

**Spirit:** 100 base. Auras reserve a percentage of it. The unreserved remainder is the pool for techniques and regenerates at **10% of its own size per second**.
- A heavy aura build therefore means fewer and slower active saves. That trade-off is the build's spine.
- Example: at 75% reserved, the pool is 25 Spirit regenerating 2.5/s, which is one Ward every 8 s.
- In the original, Spirit regenerated about 28/s against about 4/s of spending, so it never bound. The harness checks that it binds here.

**Resonance:** 0–100 in 4 segments. Only the partial segment decays (4/s after 5 s without gain); full segments are banked. **No Resonance is gained while a Crescendo is active.**

| Resonance gain | Amount |
|---|---|
| Perfect Ward | +20 |
| Save (counterfactual lethal prevented) | +25 |
| Clutch Cleanse (Chime) | +15 |
| Reel or Swap that dodges a telegraph | +15 |
| Cleanse of a damaging ailment | +5 |
| Ward that absorbs ≥ 50% of its value | +5 |
| Empower on a hero who is actively hitting | +1/s |
| Kill by an Empowered or Cued hero | +2 |

## 2. Callings (choose one per run)

A Calling is the Weaver's "class for this run": a passive, a Crescendo, and a **Calling Path** of 4 tiers where you pick 1 of 2 options per tier. Paths unlock with Calling mastery, earned by playing that Calling. The original's three ascendancies return, plus one new Calling.

### Luminary: *the aura sovereign*

- **Passive:** aura radius +15%. **Radiant Field**: enemies inside your field take 20 radiant damage/s per active aura.
- **Crescendo: Sunrise.** For 6 s, aura effect ×2, radius ×1.5, Radiant Field ×4.

| Tier | Option A | Option B |
|---|---|---|
| I | *Haloed*: heroes in field +10% max HP | *Wide Choir*: +20% aura radius |
| II | *Dawnward*: entering the field grants a 3% barrier per active aura (once per 8 s) | *Searing Hymns*: Radiant Field ×2 and can crit |
| III | *Fourth Chord*: +1 Chord with 1 aura slot and 1 ornament slot | *Lantern Bearer*: Pedal Point auras +30% effect |
| IV | ***Sovereign Symphony***: with 5+ auras active, all aura effects +25% | *Eclipse*: during Sunrise, every aura also applies its Counterpoint form to enemies |

### Martyr: *the one who bleeds for them*

- **Passive:** +40% max Life. The Thread gains a third mode, **Bear**: you take 35% of the threaded hero's incoming damage.
- **Crescendo: Martyr's Vow.** For 5 s heroes cannot drop below 1 HP. Damage beyond that is redirected to you at −70%, and your healing received is doubled.

| Tier | Option A | Option B |
|---|---|---|
| I | *Penitence*: damage you Bear restores Spirit (3 per 100) | *Scarred Hide*: −15% damage taken while Bearing |
| II | *Blood Font*: Life reserved by auras regenerates you at 2%/s while you are below 50% | *Shared Wounds*: Bear also applies to every hero in the field at 10% |
| III | *Undying Devotion*: once per encounter, a lethal hit on you instead makes you invulnerable for 3 s and Mends all heroes 30% | *Low-Life Vigil*: while you are below 35% Life, aura effect +30% |
| IV | ***Martyr's Aegis***: your Wards also shield you and are 50% stronger | *Sanguine Covenant*: Mend heals you for 30% of the healing done |

### Chronomancer: *the one who was ready*

- **Passive:** Perfect window +0.10 s. Telegraphs show numeric timers. **Rewind** replaces Reel: restore the threaded hero's HP and position to 3 s ago (18 s cooldown).
- **Crescendo: Stasis.** For 3 s all enemies and projectiles freeze. Techniques have no cooldowns and cost half Spirit.

| Tier | Option A | Option B |
|---|---|---|
| I | *Quickened*: cooldowns −10% | *Foresight*: incoming-damage forecasts look 1 s further ahead |
| II | *Echo Ward*: a Perfect Ward repeats itself 1 s later at 50% | *Borrowed Time*: Rewind also restores 30% Solo charge |
| III | ***Temporal Mastery***: Glide resets your last technique's cooldown (once per 10 s) | *Slow Dance*: enemies in field −15% speed, windups +10% longer |
| IV | *Paradox*: Rewind also cancels every telegraph currently aimed at that hero | *Eternal Moment*: Stasis +2 s; Perfect Wards during Stasis refund 10 Resonance |

### Conductor (new): *the one who makes them great*

- **Passive:** Cue costs 15 instead of 25; Resonance gains +20%. Solos Cued within 3 s of another Cue form a **Duet** (+25% power); three in a row form a **Trio** (+50%).
- **Crescendo: Grand Finale.** All heroes fire their Solos in sequence, each +20% stronger than the last; afterwards every Solo is fully recharged.

| Tier | Option A | Option B |
|---|---|---|
| I | *Baton*: Directives grant affected heroes +10% damage for 4 s | *Downbeat*: Cues landed on the music's downbeat (±150 ms) cost 0 |
| II | *Encore*: after a Trio, all Solos recharge 30% | *Overture*: start each encounter with 50 Resonance |
| III | *Ensemble*: each *different* hero Cued in a row adds +5% party damage (max 15%) until you repeat one | *Spotlight*: a Cued hero is Empowered ×2 for the Solo's duration |
| IV | ***Triad Bond***: with 3+ heroes in the field, Resonance never decays | *Maestro*: Crescendo can be cast at 75 Resonance; Grand Finale loops once more |

## 3. Auras

Auras centre on the Weaver (radius 8 m base, capped at 14 m so positioning always matters) unless an Ornament says otherwise. Each one reserves Spirit, so a typical early build runs 2–3 auras. Auras are slotted into **Chords** (§4).

| Aura | Subtitle | Reserve | Effect on heroes in field | *Counterpoint* form (inverted onto enemies) | Tags |
|---|---|---|---|---|---|
| **Sostenuto** | Mending | 25% | regenerate 1.5% max HP/s | enemies' healing is negated and they take 1% max HP/s | Mend |
| **Ostinato** | Barrier | 30% | barrier of 12% max HP, regenerating 4%/s after 3 s unhit | enemy shields decay 10%/s | Ward |
| **Allegro** | Haste | 25% | +15% attack/cast speed, +10% move speed | enemies −15% attack/move speed | Tempo |
| **Fortissimo** | Might | 30% | +18% increased damage, +12 flat damage per hit | enemies deal −12% damage | Empower |
| **Staccato** | Precision | 30% | +10% crit chance, +30% crit damage | enemies take +15% crit damage | Empower · Crit |
| **Cantabile** | Purity | 20% | ailment duration −40%, ailment damage −30% | enemy-applied ailments last −25% (stacks with the buff form) | Cleanse |
| **Fermata** | Stillness | 25% | heroes below 35% HP take −30% damage. Once per encounter per hero, a lethal hit **holds them at 1 HP for 1.5 s**. Heal them during the hold and it counts as a Save | enemies below 35% HP are slowed 40% | Save |
| **Requiem** | Doom (hex) | 30% | *(hex aura)* enemies in field take +12% damage and deal −8% | — (already inverted) | Hex |
| **Lullaby** | Slumber (hex) | 25% | *(hex aura)* enemies in field −20% speed; their **windups take +15% longer** (wider reaction and Perfect windows) | — | Hex · Tempo |
| **Rubato** | Tempo | 25% | Solos charge 30% faster; each Cue refunds 5 Resonance | enemy Solos/elite abilities charge 20% slower | Cue · Tempo |

**Mapping from the original's 8 auras:**
- Vitality → Sostenuto
- Discipline → Ostinato
- Haste → Allegro
- Wrath → Fortissimo
- Zealotry → Staccato
- Purity → Cantabile
- Malediction → split into Requiem (damage taken) and Lullaby (slow)
- Grace (flat damage reduction) → folded into Ostinato's barrier and Fermata's low-HP reduction. In the original, flat DR reached its cap early and was invisible in play.

Fermata, Lullaby and Rubato are new. They exist to create *active-play* hooks: holds, longer windows and more Cues.

## 4. Chords and Ornaments (support runes)

This keeps the original's best build puzzle, its *conduit clusters*, under a musical name.

- **A Chord** holds **2 aura slots and 2 ornament slots.** Ornaments apply to *both* auras in their Chord, so the puzzle is pairing: which two auras both want this ornament?
- **Unlocks:** Chord I at the start, Chord II at Rank 2, Chord III at Rank 8 (Luminary's *Fourth Chord* adds a fourth). The first ornament slot per Chord opens at Rank 3, the second at Rank 6.
- **Ornaments are single copies.** You own one of each, and a copy can sit in only one Chord. In the original the same rune could be linked in every cluster, so runes cost nothing to use. Here, where your only Grace Note goes is a real decision.
- Ornaments are a persistent collection slotted in Expedition prep. Forge nodes allow one swap mid-run.
- **Mapping from the original's 6 runes:** Enlighten → Grace Note, Generosity → Descant, Arrogance → Martyr's Tithe, Magnify → Reverb, Empower → Sforzando; Overflow is folded into Ostinato. Unison, Pedal Point, Counterpoint, Echo and Syncopation are new, and each changes *behaviour*, not just numbers.

| Ornament | Effect | What it does to play |
|---|---|---|
| **Grace Note** | reservation ×0.70, effect −10% | squeeze one more aura in |
| **Sforzando** | +2 aura levels (≈ +25% effect), reservation ×1.20 | fewer, stronger auras |
| **Descant** | +40% effect on heroes; no longer affects the Weaver | pure-support specialisation |
| **Reverb** | +40% radius, −10% effect | lets the party spread (vs. Scatter mechanics) |
| **Unison** | aura applies **only to your threaded hero**, at ×2.5 effect, ignoring radius | turns an aura into a thread buff; rewards smart retargeting |
| **Pedal Point** | aura is **planted** where you cast it (recast to move, 2 s cooldown); radius −15% | frees the Weaver to roam; party holds a zone |
| **Counterpoint** | aura becomes its inverted form on enemies (§3) | hex builds; changes positioning (you want enemies *in* the field) |
| **Martyr's Tithe** | reserves **Life** instead of Spirit; +15% effect while you are below 50% Life | low-life builds; frees Spirit for techniques at real risk |
| **Echo** | after a Perfect Ward, this aura's effect doubles for 4 s | rewards timing mastery |
| **Syncopation** | aura **pulses** ×2.2 for 1.5 s every 4 s, synced to the music bar; reservation ×0.85 | rhythmic play; time Cues to the pulse |

Each Chord is a real behaviour change, not +x%. For example:
- A *Unison* Chord of Fortissimo + Allegro turns your Thread into a ×2.5 might-and-haste beam that follows your retargeting.
- A *Pedal Point* Chord of Lullaby + Requiem is a planted slow-and-doom zone you pull fights into.
- A *Counterpoint* Chord turns two buffs into two hexes.

## 5. Heroes

Choose **3 per run** (a 4th slot unlocks via the Astrolabe). Each hero has an AI-driven basic attack and two abilities, a player-Cued **Solo**, a deliberate **Quirk** (a readable flaw), clear **Needs**, and **Bond talents** at ranks 3/6/9 (1 of 2 each) that reshape quirks or add synergies.

**Scaling.** Stats below are at Movement I. Hero baselines scale with the Movement alongside enemies: HP ×1.6 / ×2.4 and damage ×1.4 / ×2.0 in Movements II and III. They **never** scale with Weaver Rank ([02 §12](02-game-design.md#12-power-math-rules)). Within a run, heroes grow through motifs, relics and Bond talents.

### Kael, the Bulwark: *Tank* · starter

- **Stats:** 1,600 HP, high armour. Sword: 85 damage per 1.1 s.
- **Abilities:** *Shield Bash* (1 s stun, interrupts casters; 8 s cooldown); *Challenge* (taunts all enemies within 7 m; 12 s cooldown).
- **Solo: Aegis Wall**, a 4 s frontal wall that blocks projectiles. **Cued:** becomes a party dome absorbing 40% of each hero's max HP. This is the canonical answer to raid-wide nukes.
- **Quirk: Glory Hound.** When a new pack spawns, he charges the biggest one and can leave the field.
- **Needs:** Wards on tank-busters, a Rally when he overextends.
- **Bond talents:**
  - R3: *Steady Vanguard* (no Glory Hound unless a Focus is set) **or** *Vanguard's Roar* (his charge taunts everything within 8 m)
  - R6: *Riposte Bash* (a Perfect Ward on Kael fires Shield Bash instantly) **or** *Bulwark of Faith* (+20% healing received while threaded)
  - R9: *Unbreakable* (once per encounter, survives at 1 HP for 2 s) **or** *Shieldbearer* (Aegis Wall also blocks melee in its arc)

### Lyra, the Windrunner: *Ranger* · starter

- **Stats:** 820 HP. Bow: 70 damage per 0.7 s, 14 m range.
- **Abilities:** *Piercing Shot* (line; interrupts; 9 s cooldown); *Volley* (4 m AoE; 10 s cooldown).
- **Solo: Gale Barrage**, a 3 s rooted channel at 12 arrows/s. **Cued:** no root and +40% crit chance.
- **Quirk: Greedy Shot.** While channelling, she won't leave a telegraph that has < 1 s remaining.
- **Needs:** Reel, Empower for burst, protection from snipers.
- **Bond talents:**
  - R3: *Wind Step* (auto-dodges the first telegraph each 10 s) **or** *Hawk Eye* (+3 m range; Empowered crits grant 1 Resonance)
  - R6: *Ricochet* (arrows bounce once to a second enemy inside your field) **or** *Hunter's Mark* (her Focus target takes +20% from everyone)
  - R9: *Storm Queen* (Gale Barrage also fires down your threads) **or** *Last Light* (below 30% HP, +50% attack speed)

### Vexis, the Starcaller: *Arcanist* · starter

- **Stats:** 740 HP. Arcane bolt: 95 damage per 1.4 s, chains to 1 extra target.
- **Abilities:** *Gravity Well* (pulls enemies within 5 m; 12 s cooldown); *Starbolt* (2 s cast, large AoE; 8 s cooldown).
- **Solo: Starfall**, 3 s of meteors on enemies. **Cued:** meteors fall *inside your field* and each stuns 0.5 s.
- **Quirk: Spellbound.** Commits to casts, staggers easily, and is the favourite target of divers.
- **Needs:** peel (Focus the divers), Wards against assassins, Allegro for cast speed.
- **Bond talents:**
  - R3: *Arcane Ward* (blinks away on the first stagger each 12 s) **or** *Overchannel* (+30% cast damage, +20% cast time)
  - R6: *Starthread* (Vexis's spells chain along your threads) **or** *Event Horizon* (Gravity Well pulls toward the centre of your field)
  - R9: *Supernova* (Starfall's final meteor is a 6 m nova) **or** *Constellation* (each Cue leaves a star that re-casts the arcane bolt for 6 s)

### Brann, the Bloodsworn: *Berserker* · unlocked in Movement II

- **Stats:** 1,250 HP. Axe cleave.
- **Passive: Blood Rage.** +1% damage per 1% missing HP (max +80%), 8% lifesteal. **Weaver healing on Brann is 50% less effective.**
- **Solo: Red Frenzy**, a 5 s whirlwind. **Cued:** lifesteal ×3.
- **Quirk: Bloodlust.** Never retreats, and ignores Rally while below 40% HP.
- **Needs:** to be kept *low but alive*. That means barriers (Ostinato, Wards) instead of heals, Fermata holds and precise Cues. **He inverts the healer's reflex; that's the point.**
- **Bond talents:**
  - R3: *Iron Will* (Bloodlust ends when Warded) **or** *Red Mist* (Blood Rage max +20%)
  - R6: *Blood Oath* (your healing on him is no longer reduced; overheal becomes bonus damage on his next hit) **or** *Scar Tissue* (barriers on him are 30% stronger)
  - R9: *Deathless* (at ≤ 10% HP, he can't die for 3 s once per encounter) **or** *Berserker's Hymn* (while he's below 30% HP, all heroes gain +15% damage)

### Seren, the Riposte: *Duelist* · unlockable

- **Stats:** 900 HP.
- **Passive: Parry.** While Warded, the next melee hit she takes is parried and countered for 300% damage. A Perfect Ward on Seren is a kill shot.
- **Abilities:** *Lunge* (gap-closer); *Feint* (sidestep plus taunt of a single enemy).
- **Solo: Thousand Cuts**, blinking between 8 enemies. **Cued:** each kill extends it 0.5 s.
- **Quirk: Showboat.** Goes looking for the strongest enemy to duel, away from the group.
- **Needs:** Wards timed to her duels, Reel when she overextends.
- **Bond talents:** *Riposte Chain* / *Cold Focus* (R3), *Bladesong* / *Unflinching* (R6), *Thousandfold* / *Duellist's Honour* (R9).

### Oro, the Grovekeeper: *Summoner* · unlockable

- **Stats:** 950 HP. Keeps 2 **Saplings** (mini-tanks) that inherit your aura buffs.
- **Passive: Rootbond.** Your Thread on Oro also Mends his summons at 50%.
- **Solo: Wildgrowth** summons an Ancient that taunts and roots enemies for 1.5 s. **Cued:** the Ancient is wreathed in all your auras, becoming a *second aura source*.
- **Quirk: Gentle.** Retreats from melee and is passive unless a Focus is set.
- **Needs:** aura coverage of his summons (positioning), and a Rally to keep the Saplings in the field.
- **Bond talents:** *Deep Roots* / *Thorned Bark* (R3), *Grove Chorus* / *Old Growth* (R6), *World Tree* / *Seedling Swarm* (R9).

## 6. Enemies

Every damaging attack carries **answer tags** (enforced by content lint). Numbers are at Movement I scale; Movements II and III scale HP ×1.8/×3.0 and damage ×1.5/×2.2 before Dissonance.

### Movement I: the Hollow Choir

| Enemy | HP | Behaviour | Telegraph | Answers |
|---|---|---|---|---|
| **Hollow Chorister** | 140 | swarm melee, 35 per 1.3 s | none (chip damage) | Mend, auras |
| **Bell Brute** | 1,100 | slow heavy; tank-buster | 90° cone, 1.4 s windup, 520 damage | ⛨ Ward (Perfect), Kael Bash stagger |
| **Lamenter** | 380 | keeps distance, casts *Dirge* | mark: 5 s countdown → 50% max HP + 2 s silence | 💧 Cleanse, ⛨ Ward |
| **Glass Lancer** | 420 | sniper; targets the farthest or squishiest hero | 18 m line, 1.8 s windup, 600 damage | ⛨ Ward, ⤺ Reel |
| **Mute** | 900 | suppression field (7 m): auras inside lose 40% radius and 30% effect | visible cracked-glass dome | ⌖ Focus |
| **Cantor Acolyte** | 500 | channels heals on enemies (120/s); shields elites | cast bar with break meter | ⌖ Focus (Bash / Piercing Shot interrupt) |

### Movement II: the Crimson Legion

| Enemy | HP | Behaviour | Telegraph | Answers |
|---|---|---|---|---|
| **Sanguine Hound** | 260 | fast packs; bleed (12/s/stack, 6 s) | stack counter on the hero | 💧 Cleanse at 5+ stacks, Cantabile |
| **Hemomancer** | 600 | *Blood Pact* links two heroes for 6 s: shared, +20% damage; if they're within 6 m of each other at the end, both take 300 | link beam | ↔ Scatter |
| **Impaler** | 900 | line charge that *pins* a hero (rooted, 60/s for 4 s) | 1.2 s line | ⤺ Reel (frees), ⛨ Ward |
| **Crimson Sentinel** | 1,600 | front-immune shield wall (120° arc) | shield arc decal | ⌖ Focus (heroes flank), Empowered Piercing Shot breaks it |
| **Leech** | 300 | latches on, drains 4% max HP/s and heals itself | latch tether | ⤺ Reel, 💧 Cleanse |

### Movement III: the Unstitched

| Enemy | HP | Behaviour | Telegraph | Answers |
|---|---|---|---|---|
| **Shears** | 450 | dashes *across your threads*, snapping them | dotted path, 0.9 s | ⌖ Focus, retarget, Guard Strand |
| **Void Maw** | 1,400 | stationary; 8 m pull field with damage over time | swirling field | ⤺ Reel outward, Anchor, ◎ Rally away |
| **Doubt Wraith** | 500 | 4 s cast possesses a hero for 5 s (they attack allies) | cast bar plus mark | 💧 Cleanse (frees), ⌖ Focus interrupt |
| **Null Priest** | 700 | 5 m silence zone: no techniques can be cast inside | rune circle | move / Glide out, Pedal Point auras |
| **Mimic** | 600 | copies your last technique, inverted, onto an enemy (your Ward shields a brute; your Empower buffs a lancer) | mirror shimmer | vary your techniques, ⌖ Focus it first |

### Elite affixes (an elite rolls 1–2, or more with Dissonance)

| Affix | Effect | Answer |
|---|---|---|
| **Shielded** | discord barrier that only *Empowered* heroes can damage | switch the Thread to Empower |
| **Volatile** | death explosion: 5 m circle, 3 s | ↔ Scatter, ⤺ Reel |
| **Hastened** | +30% speed; windups −15% | tighter Perfect timing |
| **Severing** | its attacks snap threads within 2 m | keep the threaded hero away |
| **Silencing** | carries a Mute field | ⌖ Focus |
| **Vampiric** | its hits apply *Wound* (healing received −50% for 4 s) | 💧 Cleanse removes Wound |
| **Mimicking** | Mimic behaviour (above) | vary techniques |
| **Doom-touched** | its hits stack Doom; 5 stacks detonates for 40% max HP | 💧 Cleanse, ⛨ Ward |

## 7. Bosses

Each boss teaches and then tests a verb. Every phase has a "**double-threat**" beat, where two answers are needed at once, because triage is the skill. Boss signature mechanics are announced on the cast bar as **Decrees**, the original's name for its boss skill-checks, now with answer glyphs.

### Mini-bosses

- **The Bellwarden** (Movement I, node 5). *Toll* alternates donut and circle; *Bell Slam* is a tank-buster; *Resound* marks two heroes who must ↔ Scatter.
- **Gorehound Matriarch** (Movement II). *Pack Call* (hound waves); *Rend* (heavy bleed: Cleanse); *Pounce* (leaps on the squishiest hero after a 1.0 s crouch tell: Reel or Ward).
- **The Seamstress** (Movement III). *Needle Rain* (circles); *Stitch* (sews two heroes together: they move as one until Cleansed); *Unpick* (snaps all threads; reattach fast).

### 1. The Hollow Cantor: Movement I

- **Phase 1 (100–66%).** *Toll*: tank-buster on Kael, 2.0 s, 70% max HP (⛨). *Dirge*: 1 mark (💧). Chorister adds.
- **Phase 2 (66–33%). Silent Verse:** arena-wide aura suppression except inside 3 slow-moving *Hymn circles*. ◎ Rally the party into a circle and move with it, while Toll and Dirge (now ×2) continue. Double threat: Toll and a Dirge in the same 2 s.
- **Phase 3 (33–0%). Requiem:** every 30 s a 4 s cast deals 90% max HP to every hero. Answers: Cue Kael's Aegis dome, Crescendo, *or* Ward both squishies and top up Kael. Choose; Resonance is the budget.
- **Enrage:** 6:00.

### 2. Vharun, the Crimson Warden: Movement II

- *Twin Cleave*: two tank-busters 1.2 s apart. One Ward isn't enough, so it needs a second charge, Ostinato, Aegis Wall or a well-timed Reel.
- *Blood Pact* links; *Impale* pins.
- **Phase 2 — Bloodmoon:** all healing −50% except inside drifting *Sanctuary pools*.
- **Phase 3:** *Crimson Tide* (rotating beam) and *Execution*, which targets the lowest-HP hero: if they are below 40% when the cast ends, they die. Unless Warded or held by Fermata, this forces "top everyone off" play.

### 3. The Unweaver: Movement III

- *Snip* cuts your thread (no thread for 3 s unless Guard Strand).
- *Spindles* tether to the boss and give it 80% damage reduction while any live (⌖ Focus).
- **Phase 2 — Steal Verse:** steals one of your auras; kill the *Stolen Verse* add to get it back. *Unravel*: your thread's polarity reverses for 5 s (Mend now damages; the thread turns red-black). Swap to Empower or detach.
- **Phase 3 — Mirror Weave:** the boss Threads and Wards its own champion, Perfect-timing your heroes' big hits. Focus the champion; bait the boss's Ward with a feint (Directive Hold, then Cue).

### 4. The Silent Conductor: Finale

- It Cues *enemy* Solos (elite adds with telegraphed ultimates).
- **Discord:** every telegraph you fail to answer feeds its own Resonance. At 100 it casts *Fortissimo Silence*, 150% max HP over 3 s. Cancel it with your own Crescendo, or survive with dome, Wards and Fermata.
- **Final phase — Grand Silence:** the music stops and the heroes freeze. Only your Perfect Wards, Clutch Cleanses and Reel-saves make sound. Eight notes rebuild the song and reignite the heroes for the last burn ([04 §4.1](04-presentation.md#41-music-director)).

## 8. Motifs (in-run boons)

**Structure:** pick 1 of 3 after combat nodes. Rarities are Common, Rare, Epic and Harmony. Taking the same motif again levels it (L1 → L3). Every motif has **synergy tags** (Silk, Aegis, Choir, Bond, Finale), and the draft screen shows what each pick would unlock.

**Target for 1.0:** ~90 motifs plus 12 Harmonies. The examples below are the tone and spread.

### Silk (Thread)

| Motif | Effect (L1 / L2 / L3) |
|---|---|
| **Relay Weave** | your Thread continues from its target to the nearest other hero at 40 / 55 / 70% potency |
| **Razor Silk** | enemies crossing any thread take 40 / 70 / 100 damage/s and are slowed 30% |
| **Guard Strand** | enemy projectiles crossing your threads are destroyed (1 per 1.5 / 1.0 / 0.6 s) |
| **Taut Release** | retargeting or a snap gives both ends a barrier of 8 / 12 / 16% max HP |
| **Long Weave** | thread range +3 / 5 / 7 m; no potency loss when taut |
| **Lifeline** | Mend on heroes below 30% HP ×1.6 / ×2.0 / ×2.4 |
| **Golden Filament** | Empower also grants +10 / 15 / 20% attack speed |
| **Twin Spindle** *(Epic)* | +1 Thread; RMB toggles the mode of the thread nearest the cursor |
| **Thread the Needle** *(Epic)* | retargeting onto a hero ≤ 0.35 s before a telegraph hits them counts as a Perfect Ward at 50% value |

### Aegis (Ward)

| Motif | Effect |
|---|---|
| **Riposte Bloom** | Perfect Ward releases a 5 m nova for 150 / 250 / 350% of the negated damage |
| **Lingering Aegis** | Ward duration +1 / 2 / 3 s; a Ward that expires unbroken refunds 30% of its Spirit |
| **Shatterglass** | when a Ward breaks, shards hit 3 enemies for the remaining barrier value |
| **Twin Aegis** | Ward also covers the nearest other hero at 40 / 60 / 80% |
| **Second Verse** *(Epic)* | Ward gains a second charge |
| **Steady Hands** | Perfect window +0.08 / 0.12 / 0.16 s |

### Choir (aura-specific; only offered if that aura is slotted)

| Motif | Effect |
|---|---|
| **Deep Roots** *(Sostenuto)* | regeneration doubled on heroes below 50% |
| **Iron Refrain** *(Ostinato)* | barrier regenerates 2× faster for 4 s after a Perfect Ward |
| **Presto** *(Allegro)* | +1% attack speed per second spent in the field (max 20%), lost on leaving |
| **Hammerfall** *(Fortissimo)* | every 10th hit by a hero in the field deals triple damage |
| **Killing Edge** *(Staccato)* | crits in the field grant 1 Resonance (max 3/s) |
| **Clean Slate** *(Cantabile)* | ailments expiring in the field heal 10% |
| **Long Hold** *(Fermata)* | holds last 3 s and trigger twice per encounter |
| **Last Rites** *(Requiem)* | enemies dying in the field explode for 10% of their max HP |
| **Heavy Eyelids** *(Lullaby)* | enemies in the field for 4 s fall asleep for 1.5 s (once per enemy per 15 s) |
| **Accelerando** *(Rubato)* | each Cue cuts the other heroes' Solo charge by 2 s |

### Bond (only offered if that hero is in the party)

| Motif | Effect |
|---|---|
| **Bulwark's Echo** *(Kael)* | when Kael is Warded, he taunts every enemy within 6 m |
| **Penitent Shield** *(Kael)* | Challenge also heals heroes within 6 m for 8% max HP |
| **Wind at Her Back** *(Lyra)* | Lyra moves 30% faster while threaded and her Greedy Shot quirk is suppressed |
| **Split Fletching** *(Lyra)* | arrows pierce 1 enemy while Empowered |
| **Constellation Lines** *(Vexis)* | Starbolt also strikes every enemy touching your threads |
| **Quickened Verse** *(Vexis)* | casts are 25% faster inside your field |
| **Blood Tithe** *(Brann)* | while Brann is below 40% HP, your Wards on him are 50% stronger and refund 10 Spirit when they break |
| **En Garde** *(Seren)* | each parry grants 8 Resonance |
| **Verdant Choir** *(Oro)* | Saplings each emit Sostenuto at 30% effect |

### Finale (Cue and Crescendo)

| Motif | Effect |
|---|---|
| **Encore** | Crescendo +1 s per Perfect Ward during it (max +5 s) |
| **Standing Ovation** | when Crescendo ends, heroes heal 25% and Solos charge 50% |
| **Da Capo** | the first Cue of each encounter is free |
| **Call and Response** | a Cued hero is also Empowered for 4 s (stacks with the Thread) |

### Harmonies (duo motifs: offered only when both prerequisites are owned)

| Harmony | Requires | Effect |
|---|---|---|
| **Woven Aegis** | any Silk + any Aegis | Wards travel along your threads and apply to both ends |
| **Cutting Chorus** | Razor Silk + Fortissimo | thread damage scales ×3 with Fortissimo's effect and can crit |
| **Guardian's Cadence** | Kael Bond + Riposte Bloom | Kael's Shield Bash triggers Riposte Bloom at 50% |
| **Spindle Lullaby** | Relay Weave + Lullaby | enemies crossing threads fall asleep for 1 s (once per enemy per 8 s) |
| **Martyr's Canticle** | Long Hold + Lingering Aegis | Fermata holds also apply a full Ward |
| **Starthread Symphony** | Vexis Bond + Relay Weave | Vexis's spells jump along *every* thread |
| **Tempo Rubato** | Accelerando + Da Capo | every third Cue is free |
| **Blood and Silk** | Brann Bond + Taut Release | while Brann is below 30%, your thread on him generates 3 Resonance/s |
| **Shard Requiem** | Shatterglass + Last Rites | Ward shards apply Requiem for 4 s |
| **Perfect Pitch** | Steady Hands + Thread the Needle | Perfect Wards ring the arena: +20% party damage for 4 s and +10 Resonance |
| **Ostinato Loop** | Iron Refrain + Second Verse | a Perfect Ward refreshes Ostinato barriers on every hero |
| **Grand Staff** | Golden Filament + Call and Response | Empowered heroes' Solos charge 2× faster |

## 9. Relics and the Reliquary

### 9.1 In-run relics (~40 for 1.0)

Relics drop from elites, bosses, events and merchants. Each has a fixed **core effect** plus 0–2 random **Inscriptions** by rarity. *Cursed* relics carry an upside and a real downside.

| Relic | Rarity | Core effect |
|---|---|---|
| **Cracked Metronome** | Legendary | every 12 s, your next technique that resolves a telegraph counts as Perfect |
| **Tuning Fork** | Rare | Perfect window +0.10 s |
| **Silver Thimble** | Common | retargeting the Thread grants a 4% barrier to the new target |
| **Choirmaster's Baton** | Rare | Cue costs 20 Resonance |
| **Hollow Bell** | Rare | Chime cooldown −40%; the Chime no longer heals |
| **Spindle of Fate** | Legendary | +1 Thread; −20% thread potency |
| **Sacrificial Lamb** | Rare | once per encounter, a lethal hit on a hero is redirected to the healthiest hero |
| **Lantern of the Lost** | Common | when a hero is downed, the others gain +50% damage for 6 s |
| **Warden's Key** | Common | Mutes and Silencing elites take ×3 damage |
| **Cantor's Hymnal** | Rare | start each encounter with 25 Resonance |
| **Featherweight Robes** | Common | Glide +1 charge |
| **Star Chart** | Rare | see one extra map row; Shrines offer 4 choices |
| **Prism Loom** | Legendary | auras reserve no Spirit for the first 10 s of each encounter |
| **Dissonant Tuning** | Cursed | one Chord gains a third aura slot; enemy windups −10% |
| **Heavy Score** | Cursed | +25% party damage; you cannot Glide |
| **Glass Halo** | Cursed | Perfect Wards also grant +15 Resonance; a non-Perfect Ward costs 10 Resonance |

### 9.2 The Reliquary (persistent)

This is where the original's crafting depth lives on, reshaped to fit runs.

- **Enshrine:** at the end of a run that reached Movement II or beyond, keep **one** relic from that run.
- **Carry:** equip 1 enshrined relic into each run. Rank 10 unlocks a second slot and Rank 20 a third.
- **Inscriptions** (affixes): up to 4 per relic, each with tiers T1–T5 and categories Silk / Aegis / Choir / Bond / Weaver. Examples: *+x% Thread potency*, *+x m Thread range*, *+x% Ward barrier*, *+x% aura effect*, *−x% reservation*, *+x Resonance on Perfect*, *+x% Solo charge*, *+x Life*.
- **Crafting** at the Reliquary station uses **Tuning Shards** (common) and **Discord Tears** (rare):

| Action | Cost | Effect | Instability |
|---|---|---|---|
| **Inscribe** | shards | add a random inscription from a *chosen category* | +12 |
| **Retune** | shards | reroll one inscription's value within its tier | +4 |
| **Ascend** | shards | try to raise one inscription a tier (success chance falls with tier) | +15 |
| **Dissonate** | 1 Discord Tear | one final gamble: +1 slot with a special *Dissonant* inscription, *or* empower the core effect, *or* transform into a cursed variant, *or* shatter (no more crafting, but still usable). The relic can't be crafted afterwards | — |

- **Instability** runs 0–100. Above 40, each craft has a rising chance to **Fracture** the relic, freezing it as-is. Push your luck, knowing the odds, which are shown. This replaces the original's six-currency slot machine with fewer currencies and real decisions.

## 10. Events (~16 for 1.0)

| Event | Choice |
|---|---|
| **The Wounded Cantor** | a dying chorister begs for aid. *Heal* (−10 max Spirit for this run → rare relic) / *Cleanse its corruption* (it fights for you next encounter) / *Leave it* |
| **Shrine of Discord** | corrupt a motif: 60% it gains +2 levels, 40% it becomes its cursed twin |
| **Hero's Doubt** | Lyra questions the mission. Dialogue choice → Bond XP, *or* a temporary buff for the next 2 fights |
| **The Tuning Pool** | swap one ornament or one aura in one of your Chords (an in-run loadout edit) |
| **Lost Weaver's Echo** | fight a ghost Weaver who uses *your* build. Reward: a Calling Path node for this run |
| **Merchant of Silences** | buy relics with max HP instead of Aether |
| **The Unsung Choir** | an optional extra elite wave. Win → Harmony guaranteed on the next draft |
| **Broken Loom** | repair it (spend Aether) for +1 Thread potency level, *or* salvage it for Tuning Shards |

## 11. Dissonance (difficulty levels after the first Finale clear)

Each level is a toggle with a point value (some have ranks). More points means better rewards and higher relic inscription tiers. Clearing at each point total is a mastery goal.

| # | Name | Effect |
|---|---|---|
| 1 | Brisk Foes | enemies +15% speed |
| 2 | Hardened | enemies +25% HP (×2 ranks) |
| 3 | Short Fuse | windups −10% (×2) |
| 4 | Muted Choir | aura radius −15% |
| 5 | Fragile Threads | snap range −3 m |
| 6 | Wounding Strikes | healing received −15% (×2) |
| 7 | Elite Vanguard | +1 elite per elite encounter; elites +1 affix |
| 8 | Silent Cues | Cue costs +10 Resonance |
| 9 | Restless Dead | enemies revive once at 30% |
| 10 | Tyrant | bosses gain an extra mechanic per phase |
| 11 | Unforgiving | Respite nodes no longer heal |
| 12 | Mimicry | some enemies gain the Mimicking affix |
| 13 | Blind Score | answer glyphs hidden |
| 14 | Discordant Pact | start with a random cursed relic |
| 15 | True Dissonance | the Finale gains a fourth phase |

## 12. Content targets per phase

| Content | Phase 1 (slice) | Phase 3 (Movement I loop) | 1.0 |
|---|---|---|---|
| Technique variants | defaults only | +3 | 12 |
| Callings | — | 1 (Luminary) | 4 |
| Auras / Ornaments | — (Phase 2 adds 6 / 4) | 6 / 4 | 10 / 10 |
| Heroes | 3 | 3 | 6 |
| Enemies / elite affixes | 5 / 1 | 6 / 4 | 16 / 8 |
| Mini-bosses / bosses | 1 (stretch) / 0 | 1 / 1 | 3 / 4 |
| Motifs / Harmonies | 0 | 40 / 4 | ~90 / 12 |
| Relics | 0 | 15 | ~40 |
| Events | 0 | 6 | ~16 |
| Dissonance levels | — | — | 15 |
