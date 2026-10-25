# 02 — Game Design

> The design for the remake. Content specifics (every hero, enemy, aura and motif) are in [03-content-bible.md](03-content-bible.md). Why each change was made, traced to the original, is in [01-findings.md](01-findings.md).

## 1. Vision

**You are the Weaver: the one who makes heroes great.** You never swing a sword. You read the battlefield, bind heroes with threads of living song, catch the killing blow a heartbeat before it lands, pull the ranger out of the fire, and when the moment is right, *cue* your heroes' finest moves and bring the whole party to a crescendo.

The original's tagline, *"You are the support — your party is the weapon"*, stays. The remake's job is to make it **true in the player's hands**:

- support is a **skill**, not a stat sheet;
- your impact is **visible and audible** the instant it happens;
- every run asks **new questions** of your build.

**Format:** a 3D isometric **action-roguelite with a persistent meta layer**, for desktop browsers first, with mouse/keyboard and gamepad.

- **Session:** a 30–40 minute *Expedition* (run) of three *Movements* plus a Finale.
- **Long-term:** hours of unlocks, Calling mastery, Hero Bonds, Reliquary crafting, then Dissonance and the Atlas of Echoes for mastery.

> **Why a roguelite structure?** The original is a persistent ARPG loop: fight endless waves, summon a boss, collect loot, tweak menus. The remake keeps the ARPG *build depth* (aura reservation, support links, crafting) but wraps it in runs with a beginning, middle and climax. That gives a fresh decision every few minutes, a reason to try new builds, and a difficulty curve that can be measured and tuned. If you'd rather stay a pure persistent ARPG, see [06-roadmap.md §8](06-roadmap.md#8-decisions-for-you): roughly 80% of this design carries over unchanged.

## 2. Design pillars

Each pillar comes with a **test** used at every milestone review.

| # | Pillar | What it means | Test |
|---|---|---|---|
| 1 | **Anticipate, don't just react** | The best support play is *proactive*: reading telegraphs and answering them in time. Reactive healing exists, but mastery is prevention. | Expert-bot Perfect Ward rate correlates with clear time and grade. The Idle bot always loses, and win rate and grade climb steeply from Novice to Expert ([05 §11](05-technical-architecture.md#11-balance-harness-the-secret-weapon)). |
| 2 | **Your hand on every hit** | The player sees, hears and feels their contribution *at the moment it happens*, and gets proof afterwards. | In playtests, players can say what they did that mattered in the last fight. The ledger's Weaver share is never "0%" while the player is acting. |
| 3 | **Every threat has an answer** | Every damaging enemy action is readable before it lands and has at least one support answer. Deaths are explainable. | Content lint passes. The death recap names the telegraph and the missed answer in 100% of downs. |
| 4 | **Heroes are characters, not stat sticks** | AI heroes are competent but have readable flaws (Quirks) that you cover, and they grow with you (Bonds). | Players describe heroes by personality. Hero AI never "does nothing". Quirks fire predictably and are announced by barks. |
| 5 | **Builds change how you play** | Choices transform behaviour (planted auras, inverted hexes, thread geometry, Cue chains) instead of adding +x%. | Harness: ≥ 5 distinct builds are viable at Dissonance 10, and no single loadout dominates every scenario. |

**Anti-goals:** menus during combat; idle play that wins; heals that feel like whack-a-mole; damage numbers as the only feedback; systems that exist only in tooltips.

## 3. The loops

```
 seconds   ── read telegraph → Thread / Ward / Chime / Reel → see & hear the result → gain Resonance
 ~90 sec   ── encounter: waves with double-threat beats → Cue Solos → grade + highlight
 ~35 min   ── expedition: map choices → draft motifs & relics → mini-boss → boss ×3 → Finale
 hours     ── the Loom: Weaver Rank unlocks → Astrolabe → Calling paths → Hero Bonds → Reliquary crafting
 mastery   ── Dissonance levels → Atlas of Echoes → seeded weekly runs → Deeds
```

Each loop feeds the next. Resonance earned through skill buys the big moments; grades buy better drafts; drafts shape the build; runs feed the meta; the meta opens harder, stranger runs.

## 4. Core combat

### 4.1 Camera, movement and targeting

- Isometric 3/4 camera (≈ 50° pitch) with cursor look-ahead and zoom. WASD moves (click-to-move is optional). The Weaver is mobile and fragile: 300 Life, 6.5 m/s.
- **Mouseover casting** (the proven healer paradigm). Techniques target the hero under the cursor, in the world (generous 1.2 m pick radius) or on their party frame. With no hover, they target the threaded hero.
- **1–4** focus heroes (retargeting the Thread); **Shift+1–4** Cues that hero.
- Gamepad: the right stick moves a reticle that **snaps between heroes**; bumpers cycle targets; triggers handle the Thread and its mode.

### 4.2 Resources

| Resource | Range | Role |
|---|---|---|
| **Life** | 300 base | Your survival. You *can* be focused: healing draws threat (§4.8) |
| **Spirit** | 100 base | Auras **reserve** part of it permanently. The unreserved remainder is the pool for techniques and regenerates at 10% of its own size per second. **More auras means fewer and slower active plays.** That's the core build tension, inherited from the original and made consequential |
| **Resonance** | 0–100 in 4 segments | A skill meter: earned by Perfect Wards, Saves, Clutch Cleanses, Reel-dodges and sustained Empower; spent on **Cues** (one segment) and **Crescendo** (all four). Only the partial segment decays |

### 4.3 The Thread

The Weaver's constant verb: a living beam to one hero.

- **Modes:** *Mend* (heal over time) and *Empower* (more damage and attack speed), toggled with RMB. (Martyr adds a third mode, *Bear*.) The choice of mode **and** target is the constant micro-decision.
- **Tension:** comfortable range 10 m; *taut* 10–14 m, where the thread thins, whines and loses potency down to 60%; **snaps** at 14 m (1 s lockout). This ties your movement to your target.
- **Retargeting** is instant and free, with a 0.15 s whip animation. Fast triage is the skill, not a cooldown.
- **Geometry matters.** The thread is a physical line in the world. Motifs make it cut enemies (*Razor Silk*), block projectiles (*Guard Strand*), relay to a second hero (*Relay Weave*) or carry spells (*Starthread*). Some enemies (*Shears*) attack it.
- **Revive:** Mend on a downed hero channels a revive (3 s, then 30% HP). It's a tense trade, because nobody else is being mended meanwhile.

### 4.4 Techniques

Defaults below; variants per slot are listed in [03 §1](03-content-bible.md#1-the-weavers-techniques).

- **Ward (Q).** A barrier that absorbs a big chunk of one hit. **Perfect Ward:** if a hit lands within **0.35 s** of casting, it is *fully negated* regardless of size, half the cooldown is refunded, the attacker staggers, you gain +20 Resonance, and the game gives you hit-stop, a crystalline strike in key and a shockwave. Cast early and you still get the barrier, so there's a smooth skill gradient: *no ward → partial → perfect*.
- **Cleanse (E): the Chime.** An aimed bell, kept from the original, where it was the most skilful verb.
  - Throw it at the cursor, or let it snap to a hovered hero. It lands after 0.25 s and resolves in a 4 m radius.
  - It removes ailments (marks, bleeds, possession, Wound) and grants brief immunity.
  - It's *Clutch* if a mark had < 1 s left.
  - It no longer revives. In the original, instant Chime revives made deaths meaningless.
- **Reel (F).** Yanks the **threaded** hero to you. It's tied to the Thread on purpose: to Reel Lyra out of a lance beam you must already be threaded to her, or retarget first. That small anticipation tax is a big source of skill.
- **Glide (Space).** A short dash with i-frames, for your own survival, positioning the field and outrunning divers. It grants no Resonance; the original's free Resonance on dash rewarded nothing.
- **Range.** All techniques share a **14 m cast range**, the same as the Thread's snap distance. The Weaver has to be where the fight is. In the original the tether, Chime and Sigil had no range limit, so position barely mattered.

### 4.5 Solos, Cues and Crescendo

- Each hero charges a **Solo** (signature ultimate) in about 25 s of fighting. By default heroes **wait for your Cue**. Cued Solos get the full effect *plus* a Cue bonus (for example, Kael's wall becomes a party dome).
- **Cue** costs one Resonance segment. *When* to Cue is a real decision: Kael's dome for the boss's Requiem, Lyra's barrage when the Shielded elite's barrier drops, Vexis's meteors into your Lullaby field.
- **Crescendo** spends all 4 segments on your Calling's ultimate (Sunrise, Martyr's Vow, Stasis, Grand Finale). Resonance is the currency of agency: spend it on Cues now, or bank it for a Crescendo that turns a boss phase.
- **No Resonance is gained while a Crescendo is active**, so a Crescendo can never chain itself. The original's ultimate refilled its own charge while running.
- *Assist option:* **Hero Autonomy** lets heroes fire their own Solos at 70% potency.

### 4.6 Directives

A ping wheel (C, or middle-click) with 3 s cooldown:

- **Focus**: mark a target. Heroes prioritise it and interrupt it if they can.
- **Rally**: heroes regroup on you.
- **Hold**: heroes keep current positions.
- **Scatter**: heroes spread at least 6 m apart.

Heroes acknowledge with a bark. Several mechanics have Directive answers (Scatter for Blood Pact, Rally for Silent Verse, Focus for Mutes and healers). This replaces the original's three stance buttons with *timed* commands that are part of the skill.

### 4.7 Auras and the field

- **Chords.** Auras are grouped into Chords: 2 auras + 2 ornaments, where the ornaments apply to both auras. This is the original's cluster puzzle; see [03 §4](03-content-bible.md#4-chords-and-ornaments-support-runes).
- **The field.** Each Chord's field radiates from the Weaver (8 m base, 14 m cap) and is drawn at its *true* radius and position, one band per aura in its colour. In the original every aura used the largest radius and the per-aura rings were decorative. Heroes inside get a rim light in that colour, so coverage is readable without UI.
- Where the field sits is a real choice: hug Kael for the melee pile, or drift back to cover Vexis? *Pedal Point* auras can be planted; *Unison* auras ride the Thread; *Counterpoint* auras invert into hexes you want **enemies** standing in.
- **Suppression:** Mutes and Silencing elites crack your field (−40% radius, −30% effect inside their dome). This keeps the original's Dissonant Warden idea, now with clear visuals and a Directive answer (Focus).
- **Chorus.** With 3+ auras active, every Cue also releases a *chorus pulse* from the field: a heal and barrier scaled by the number of active auras. The original's chorus tiers were passive multipliers, already reached after the first boss. Here the bonus is visible and triggered by play.

### 4.8 Threat and aggro

- Enemies keep **threat tables**. Damage, taunts *and healing* generate threat, so a Weaver who heals hard pulls enemies toward themself.
- Kael's AI peels: he Challenges enemies attacking the Weaver or squishies, unless his Glory Hound quirk has dragged him away. The Weaver answers with Glide, Rally to Kael, or Focus on the diver.

This creates the positional push-and-pull every good support game has, without the player dealing damage.

### 4.9 Telegraphs and answers

- Every damaging enemy action **telegraphs** with a shape (circle, cone, line, donut, link, mark), a **fill that completes exactly at impact**, a **severity colour** (amber is survivable, crimson is lethal *as things stand*) and **answer glyphs** (Ward, Cleanse, Reel, Focus, Scatter, Stack). See [04 §5.3](04-presentation.md#53-telegraph-grammar-world).
- Severity is **live**: Warding a crimson telegraph turns it amber in front of you. That's immediate proof the answer worked.
- Party frames show an **incoming-damage forecast** stripe for every telegraph aimed at a hero, so triage reads at a glance.
- The encounter director schedules **double threats** (two answers needed within ~2 s) at a rate set by difficulty. Triage under pressure is the skill being tested.

### 4.10 Saves, contribution and grades

- **Counterfactual saves.** When a hit or detonation resolves, the sim checks whether it would have killed the hero without your intervention in the last few seconds: the Ward, the Reel, the Chime, the Fermata hold, the Mend tick that topped them up. If it would have, that's a **Save**, logged with its cause.
- **Contribution ledger.** Amplified damage (your multiplicative share, computed properly), effective healing, mitigation (absorbed, negated, avoided), saves, cleanses and Cues. It shows live as gold chips on damage numbers, per encounter as a 3-second highlight, and per run as the timeline report ([04 §6.1](04-presentation.md#61-run-summary-proof-of-support)).
- **Grade (S/A/B/C/D)** per encounter. It weighs party HP lost, downs, answered-telegraph %, Perfects and time against par. Grades raise draft rarity and Aether. Grades reward *quality* of support, not just survival.

### 4.11 Failure

- **Downed heroes** bleed out over 12 s and can be revived by a Mend channel. A hero who bleeds out is *out* for the encounter and returns next node at 30% HP with a *Shaken* debuff (−10% max HP) that a Respite node clears.
- **Weaver down:** your threads and auras drop and you re-form beside the nearest hero after 6 s. Every second of that hurts.
- **Party wipe** ends the run. You keep Weaver XP, Starlight earned so far and Bond XP, so you always progress, and the run summary shows what went wrong.

### 4.12 The difficulty contract

| Player | Movement I | Movement III | Dissonance 10+ |
|---|---|---|---|
| Idle (no input) | **loses** by node 2 | loses | loses |
| Novice | wins ~70% | struggles | — |
| Skilled | wins ~95% | wins ~70% | struggles |
| Expert | wins ~99%, mostly S | wins ~95% | the real game |

These are enforced by the bot harness in CI ([05 §11](05-technical-architecture.md#11-balance-harness-the-secret-weapon)). If idle play wins anywhere past the tutorial, that's a release-blocking bug.

## 5. Callings: the Weaver's class per run

Four Callings, each with a passive, a Crescendo and a 4-tier path where you pick 1 of 2 per tier. Full tables are in [03 §2](03-content-bible.md#2-callings-choose-one-per-run).

| Calling | Fantasy | Plays like |
|---|---|---|
| **Luminary** | the aura sovereign | field positioning, many auras, Radiant Field damage, Sunrise |
| **Martyr** | the one who bleeds for them | Bear mode, life reservation, risky self-sacrifice, Martyr's Vow |
| **Chronomancer** | the one who was ready | widest Perfect windows, Rewind instead of Reel, Stasis |
| **Conductor** *(new)* | the one who makes them great | cheap Cues, Duet/Trio chains, downbeat timing, Grand Finale |

## 6. Heroes and AI

- **A party of 3** chosen per run from 6 heroes (Kael, Lyra and Vexis at the start; Brann, Seren and Oro unlocked). A 4th slot unlocks late via the Astrolabe.
- **No leash.** Heroes fight where the fight is: ranged heroes kite, Kael charges. The Weaver decides whom the field covers and when to Rally. In the original a leash kept every hero within 6.4 m of the player, so one Chime at your own feet caught everyone and triage never happened.
- **Utility AI** (see [05 §4.8](05-technical-architecture.md#48-ai)): heroes attack sensibly, use their two abilities, dodge *some* telegraphs, stay near the field and obey Directives. Their **Quirks** are deliberate, consistent, *announced* flaws that create predictable work for the Weaver:
  - Kael's *Glory Hound* charge
  - Lyra's *Greedy Shot* channel
  - Vexis's *Spellbound* casts
  - Brann's *Bloodlust*
  - Seren's *Showboat* duels
  - Oro's *Gentle* passivity

  A bark precedes each one ("Leave this pack to me!"), so the player learns to anticipate them.
- **Bonds (ranks 1–10).** Earned per encounter by *how much you supported that hero*: their share of your healing, mitigation, amp and saves. At ranks 3/6/9 you choose 1 of 2 talents that reshape a quirk or add a synergy. Rank 10 unlocks an alternate Solo. Bond scenes play at Respite nodes and in the hub, which gives the heroes stories.
- **Hero design rule:** every hero must *need something different* from the Weaver, so party composition changes how you play. Brann exists to break the "heal everything" reflex; Seren turns Wards into damage; Oro makes aura coverage a pet-management puzzle.

## 7. Encounters

- **Types:**
  - *Skirmish*: 3 waves, about 90 s.
  - *Elite*: 1–2 affixed elites plus adds.
  - *Vigil*: protect a fragile Tuning Stone, Weaver-style objective play.
  - *Escort*: move with a caravan that only your field protects.
  - *Rescue*: revive a captured hero under fire; they join you as a guest for the next node.
  - *Mini-boss* and *Boss*.
- **Encounter director.** A budget-based spawner with role quotas (frontline, caster, sniper, controller). A pacing curve runs build-up → peak → release, and the scheduler guarantees double-threat beats at a difficulty-set rate. A **readability cap** limits simultaneous lethal telegraphs (2 at Movement I, up to 4 at high Dissonance).
- **Opening grace.** Each encounter opens with a breath. There are no lethal telegraphs in the first 4 s, and heroes engage after the Weaver's first action or a 3 s count-in. In the original, heroes often went down in the opening wave before the player could react.
- **Boss pacing.** Boss fights target **3–5 minutes** for the Skilled bot.
  - Phases are HP-gated, but **Decrees are scheduled per phase** and every Decree must appear at least twice per fight. A fast kill can't skip the skill-check.
  - In the original, engaged players killed bosses in 4–17 s and saw 2 Decrees in 17 clears.
- **Modifiers** (from the original's map mods, reframed): e.g. *Dissonant Ground* (aura radius −30%), *Bloodmoon* (enemies lifesteal), *Gale* (projectiles faster). They appear on map nodes and trade risk for reward.

## 8. The Expedition (run structure)

```
 Prep ─▶ Movement I (6 rows) ─▶ Movement II (6 rows) ─▶ Movement III (6 rows) ─▶ Finale
          ├ Skirmish ├ Elite ├ Shrine ├ Forge ├ Respite ├ Merchant ├ Event ├ Mini-boss
          └ Boss: The Hollow Cantor    └ Boss: Vharun        └ Boss: The Unweaver    └ The Silent Conductor
```

1. **Prep.** Choose a Calling, 3 heroes, your Chords (auras + ornaments, with a live Spirit budget), technique variants and carried Reliquary relics.
   - Before you commit, the prep screen previews the field on a dummy party and shows **stat deltas for every change**. The original had no delta previews.
   - Save up to 5 **loadout presets** (the original had 3).
2. **Map.** Each Movement is a branching graph of 6 rows. Every node shows its **reward preview** (motif category, relic, Aether, Bond scene, Forge) and any modifiers, so the route is a strategy.
3. **Rewards.**
   - After each combat node, **draft 1 of 3 Motifs**. Taking a motif again levels it. Synergy tags and Harmony hints show what each pick would unlock.
   - Elites, bosses and events drop **Relics**.
   - *Aether* (the run currency) is spent at Merchants and Forges.
4. **Non-combat nodes.**
   - *Shrine*: a draft from a chosen category.
   - *Forge*: level a motif, swap an ornament, or reroll a relic inscription.
   - *Respite*: heal the party 40% *or* play a Bond scene for Bond XP.
   - *Merchant*.
   - *Event*: narrative choices with trade-offs; see [03 §10](03-content-bible.md#10-events-16-for-10).
5. **Run end.** The proof-of-support summary, rewards (Weaver XP, Starlight, Bond XP, Tuning Shards), and **Enshrine** one relic into the Reliquary (if you reached Movement II).
6. **First run = the Prelude.** Movement I only, teaching one verb per fight ([04 §7](04-presentation.md#7-onboarding-and-progressive-disclosure)). It ends at the Hollow Cantor.

## 9. Meta progression: the Loom

The hub is **the Loom**, a sanctum whose stations light up as you rank up. **Progressive disclosure is a design rule.** The original exposes six management menus from minute one; the remake opens systems one at a time, each with a short interactive intro.

| Weaver Rank | Unlocks |
|---|---|
| 1 | Prelude run: Kael, Lyra and Vexis; Chord I with Sostenuto, Allegro and Fortissimo available; Thread, Ward, Chime, Glide (Reel, Cue and Crescendo are taught inside the Prelude) |
| 2 | Full Expeditions (Movements I–III + Finale); Chord II; **Astrolabe** (passive tree) |
| 3 | **Ornaments** (first ornament slot per Chord); Training Grounds |
| 4 | **Callings**: Luminary and Martyr; Calling paths begin earning mastery |
| 5 | Technique variants (one per slot); more auras purchasable with Starlight |
| 6 | Second ornament slot per Chord; **Reliquary** (Enshrine and carry 1 relic) |
| 8 | Chord III; Chronomancer; Seren recruitable via event |
| 10 | Second relic slot; crafting with Discord Tears (Dissonate) |
| 12 | Conductor; Oro recruitable via event |
| 15+ | Dissonance (after the first Finale clear), Atlas of Echoes, weekly seeds |

Brann joins through a story event in Movement II of a full Expedition.

- **Astrolabe** (passive tree). About 64 nodes in four constellations (Silk / Aegis / Choir / Bond) around a centre, with minor nodes, named notables and 6 **keystones** that bend rules. The keystone names are the original's: *Eldritch Conduit*, *Prism Covenant*, *Unbroken Chorus*, *Overflowing Grace*, *Shatterproof Halo* and *Sanguine Font*, reinterpreted in [01 §4](01-findings.md#4-what-the-remake-keeps). You get 1 point per Weaver Rank plus points from milestone Deeds (the original's "Book of Skill" idea). **Respec is free in the hub**, because experimenting is the point and runs already provide the commitment.
- **Calling mastery.** Playing a Calling earns mastery XP that unlocks its path tiers and cosmetic variants.
- **Bonds** persist (§6).
- **Reliquary** (persistent relics and crafting): see [03 §9.2](03-content-bible.md#92-the-reliquary-persistent). It keeps the original's crafting appeal, with Instability push-your-luck crafting instead of six slot-machine currencies.
- **Codex**: every enemy, telegraph, motif and term, unlocked on first sighting.

**Power budget.** Meta progression mostly adds **options**: auras, ornaments, variants, Callings, heroes and relic slots. Raw power is capped at roughly +30% from the Astrolabe and Reliquary combined, so skill stays the main axis and Dissonance stays meaningful.

## 10. Endgame and mastery

- **Dissonance.** 15 opt-in difficulty modifiers with point values ([03 §11](03-content-bible.md#11-dissonance-difficulty-levels-after-the-first-finale-clear)). Higher totals raise rewards and Reliquary inscription tiers. A clear at each total is a badge per Calling.
- **Atlas of Echoes.** After the first Finale clear, a persistent star map of *Echo Expeditions*: remixed runs with fixed twists (e.g. *Choir of Blood*, Movement I enemies with Movement II's boss mechanics). Clearing Echoes at Dissonance lights stars and earns Reliquary materials and cosmetics. This is where the original's Atlas and waystone idea lands.
- **Weekly seed.** Same seed, Calling and heroes for everyone. A deterministic replay verifies the result. Share a code to compare scores, and keep a local leaderboard.
- **Deeds.** Skill-based achievements ("Win with Brann never above 40% HP", "50 Perfect Wards in one run", "Clear Movement III without Cleansing"), some granting Astrolabe points.

## 11. Build archetypes (proof of intricacy)

Each is reachable by around mid-progression and plays differently, not just with bigger numbers.

| Archetype | Core pieces | How it plays |
|---|---|---|
| **Choir Sovereign** | Luminary, 5 auras across three Chords (a Grace Note Chord plus Astrolabe efficiency), *Fourth Chord*, *Sovereign Symphony*, a Pedal Point Chord of Lullaby + Requiem | a positional zone-controller: plant the slow field, hold the party inside, few active saves; Fermata and Ostinato carry safety |
| **Perfect Pitch** | Chronomancer, an Echo Chord, *Steady Hands*, *Thread the Needle*, *Riposte Bloom*, Tuning Fork | a timing virtuoso: every Perfect Ward detonates and doubles an aura. Highest skill ceiling |
| **Bleeding Saint** | Martyr, a Martyr's Tithe Chord, Bear mode, *Sanguine Covenant*, *Undying Devotion* | the tank's tank: you soak at low life for big aura power. Thrilling and risky |
| **Razor Loom** | *Razor Silk*, *Relay Weave*, *Twin Spindle*, *Cutting Chorus*, Scatter discipline | threads as weapons: position heroes as anchors of a cutting web |
| **Maestro** | Conductor, a Syncopation Chord with Rubato, *Da Capo*, *Accelerando*, *Tempo Rubato*, *Downbeat* | a Cue machine: chain Duets and Trios on the beat; Solos every few seconds |
| **Red Line** | Brann + Seren, Ostinato + Fermata, *Blood and Silk*, *En Garde* | keep Brann in the red without losing him while Seren parries off your Wards. Inverted healing |

## 12. Power math rules

The original's build math collapsed into one per-aura multiplier fed by about 12 sources. It reached ×22–33 by the endgame, so every capped stat saturated and players could only perceive "bigger" or "capped" ([01 §2](01-findings.md#2-what-is-wrong-ranked-by-impact-on-fun)). These rules stop that from recurring.

1. **Few "more" sources.** Most bonuses, auras included, are additive "increased" within their stat. Multiplicative "more" bonuses come only from the Thread's Empower (the Weaver's signature, kept multiplicative so your share is always visible), Callings' Crescendos, Harmonies, Cue bonuses and enemy debuffs. Content lint caps the "more" sources any single build can stack on one stat (≤ 4).
2. **Visible soft caps.** Stats with natural limits (damage reduction, slow, crit chance, cooldown) use diminishing-returns curves. Tooltips show where you are on the curve, so over-investment is visible, not silently wasted.
3. **Behaviour beats numbers.** A new option must change *how* something works (where, when, to whom, what it triggers) before it is allowed to change *how much*. Pillar 5 is enforced at content review.
4. **Hero power is not account level.** Hero baselines scale with Movement and Dissonance. A hero's growth comes from Bonds, motifs and relics. The original's ×4.5 hero damage from player level is gone, and so is the second hidden power ladder it created.
5. **Meta power cap ~+30%** (Astrolabe + Reliquary), as in §9.
6. **Costs are real.**
   - Spirit binds: techniques need *unreserved* Spirit.
   - Weaver Life matters: healing threat draws enemies, and going down drops your field.
   - Runs can fail.
   - Ornaments are single copies, and in-run choices are permanent for that run.
   - In the original, Spirit regenerated about 28/s against about 4/s of casting, death cost 20 ult charge, and every choice could be undone for free.
7. **Text is generated from data.** Every number in a tooltip, Codex entry or reward screen comes from the same effect data the sim runs. The original had about 15 texts that disagreed with its code and one impossible achievement.
8. **The harness polices it.** Across 500 random legal builds at the same progression point, the 90th/10th-percentile party-output ratio must stay ≤ 2.5×, and no archetype may exceed 1.5× the median of the top decile ([05 §11](05-technical-architecture.md#11-balance-harness-the-secret-weapon)).

## 13. Economy

| Currency | Earned | Spent | Notes |
|---|---|---|---|
| **Aether** | combat nodes (scaled by grade), events | Merchants, Forges (run only) | resets each run |
| **Weaver XP** | everything in a run | — | drives Weaver Rank (unlocks, Astrolabe points) |
| **Starlight** | run progress, bosses, Deeds | unlock auras, ornaments, technique variants, cosmetics | the main meta currency |
| **Bond XP** | supporting a specific hero | — | per hero |
| **Tuning Shards** | elites, bosses, Echoes | Reliquary crafting | common |
| **Discord Tears** | bosses at Dissonance 5+, Echoes | Dissonate (one-shot gamble) | rare |

There are four spendable currencies (Aether, Starlight, Tuning Shards, Discord Tears), introduced over hours. The original showed all six crafting currencies at once, and one of them (Astraloes) appeared under three different names.

## 14. Tone and narrative

- **World.** The world is woven from song. The *Dissonance*, a spreading silence, is unpicking it, and the Reliquaries that hold the world's verses are falling silent. You are the last Weaver, binding heroes together to retune them.
- **Heroes.**
  - Kael: an oath-bound knight who needs to be needed.
  - Lyra: an exiled windrunner who trusts no one to have her back.
  - Vexis: a star-scholar who thinks the song can be solved like an equation.
  - Brann: a berserker who is only calm in pain.
  - Seren: a duellist paying off a debt.
  - Oro: a gentle grovekeeper who hates fighting.
  - Their Bond arcs pay off in talents *and* story.
- **Antagonist.** The Silent Conductor is the first Weaver, who believes the world deserves rest. The finale's *Grand Silence* is the argument; your song is the answer.
- **Delivery.** Light and fast: barks, short Bond scenes, event text and Codex lore. No cutscene longer than 20 s, always skippable.

## 15. What changes vs. the original (summary)

| Original (verified in code and play) | Remake | Why |
|---|---|---|
| You can't lose: in a seeded playtest, a no-input run cleared every tier tried (T1–T8); the Weaver respawns at 75%, downed heroes revive on their own, enemies freeze when all heroes are down | downs, bleed-out, revive channels; a party wipe ends the run; the Idle bot must lose (a CI gate) | stakes make support matter |
| Heroes are leashed to the aura, a second beam triages by itself, auto-move dodges for you, Summon skips waves | no leash; Thread triage with range and tension; Ward/Chime/Reel timed against telegraphs; Cues and Crescendo | pillar 1: support as a skill |
| "Attribution %" is a 2.5 s rolling sample that ignores attack speed | a counterfactual ledger behind live gold chips, callouts, highlights and the run timeline | pillar 2 |
| Lancer hits are instant and invisible; most damage is ailment ticks that bypass every defence | a telegraph grammar with answer glyphs and forecast stripes; all damage goes through one pipeline; death recaps | pillar 3 |
| Heroes have no abilities; the three normal enemies are the same grey cone | hero kits, Solos, quirks with barks, behaviour-changing talents; role silhouettes | pillar 4 |
| One aura multiplier inflates to ×22–33; low-life is a free ×2.18; everything is maxed by about run 25 | power math rules (§12); options over raw power; a long tail of Dissonance, Echoes and the Reliquary | pillar 5, longevity |
| Six management menus are open from minute one | runs plus progressive disclosure | onboarding |
| Endless waves → summon a boss, 5 boss names over one moveset | a 35-minute Expedition with map choices, drafts and 4 multi-phase bosses | session shape, replayability |
| Six PoE-named currencies; crafting converges on near-perfect items; corruption has no upside | Instability push-your-luck crafting on enshrined relics; Dissonate with real boons | decisions over dice |
| Two monolithic components; a 2,900-line game loop inside a `useEffect`; whole-app re-renders ~11×/s; leaks | a deterministic headless sim, event-driven views and a bot harness | quality, tuning, longevity |

Details and evidence for each row are in [01-findings.md](01-findings.md).
