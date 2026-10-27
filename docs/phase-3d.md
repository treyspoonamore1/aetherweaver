# Phase 3d — The Martyr

*2026-10-26 · plan: [docs/plan/03-content-bible.md §2](plan/03-content-bible.md#2-callings-choose-one-per-run) · follows [Phase 3c](phase-3c.md)*

The second **Calling**: the one who bleeds for them. The Luminary makes the heroes shine; the Martyr takes their wounds. The user chose how it plays:

| Question | Choice |
|---|---|
| How do you switch the Thread to Bear? | **Its own key** (B by default). Right-click still toggles Mend ⇄ Empower; Bear replaces them while it's on, so protecting a hero costs you their heal or their damage. |
| What happens to Sunrise? | **Martyr's Vow replaces it.** Each Calling has its own ultimate. |
| How does the Martyr reserve Life? | **Every song, as the passive.** On a Martyr run your auras reserve Life instead of Spirit: all your Spirit goes to Ward, Chime and Reel, and your usable Life shrinks by what your songs hold. You live at low Life. |
| When does it unlock? | **A new Rank 8** (2,500 XP), after the Luminary's Rank 7. |
| Should Bear dim the beam song on the Thread so its crimson reads first? | **No.** The auras look the same in every Thread mode; Bear stands apart by its crimson, braid, drips, weight and backward flow. |

## The Martyr: the one who bleeds for them

> *Let it come to me.*

**Passive.**

- **+100% Life.** The Weaver's 360 becomes 720.
- **Your songs reserve Life instead of Spirit.** The share a loadout would reserve of your Spirit (Guardian: 55%) comes off your Life instead: you fight with what's left (Guardian: 324 of 720), and every point of Spirit is free for techniques. "Below half your Life" counts against all of it, reserved included, so a Martyr singing two auras is always below half.
- **Bear**, a third Thread mode (B): you take **35%** of the life the threaded hero would lose, softened by half, and never more than leaves you at 1 life (your shields count). Their shields, Wards and armour act first; Bear splits what gets through.

**Crescendo: Martyr's Vow** (instead of Sunrise). For 5 s heroes cannot drop below 1 life. Damage past that comes to you instead, at −70%, and your healing received is doubled.

### The path

Four tiers, two options each, picked after the first fight won on rows 0, 3, 5 and 7, as for the Luminary.

| Tier | Option A | Option B |
|---|---|---|
| I | **Penitence**: damage you Bear fills Resonance (4 for every 100). | **Scarred Hide**: you take 15% less damage while Bearing. |
| II | **Blood Font**: while you're below half your Life, the Life your songs reserve regenerates you, 2% of it per second. | **Shared Wounds**: while Bearing, you also take 10% of what every other hero in your field would lose. |
| III | **Undying Devotion**: once a fight, a hit that would down you instead leaves you at 1 life, untouchable for 3 s, and Mends every hero for 30% of their life. | **Low-Life Vigil**: while you're below 35% of your Life, every aura is 30% stronger. |
| IV | **Martyr's Aegis**: your Wards are 50% stronger, and each one shields you too. | **Sanguine Covenant**: Mend heals you for 30% of what it heals. |

The axes: **endure** (Scarred Hide, Blood Font, Undying Devotion), **share the pain** (Penitence, Shared Wounds, Martyr's Aegis) and **live at low Life** (Low-Life Vigil, Sanguine Covenant, Blood Font again).

**Changes from the plan.** The plan gave the Martyr +40% Life and Bear at full force. With every song reserving Life, that left a Guardian Martyr 227 Life against a normal Weaver's 360, and Bear turned big hits into downs: the bots lost ten to twenty points of win rate with her. Tuning ([Harness](#harness)) settled on +100% Life, Bear softened by half, and a guard rail: Bear never takes more than leaves her at 1 life. The plan's Penitence restored Spirit; with every song reserving Life, Spirit is plentiful, so Penitence fills Resonance instead and brings the Vow sooner. The plan's Blood Font regenerated "Life reserved by auras": with Life reservation now the Martyr's passive, it keeps that wording. Martyr's Aegis's "your Wards also shield you" is a Ward barrier on the Weaver herself, sized from her own Life.

**What it doesn't change.** The auras work as before: the same effects, the same share of a pool. Only the pool is Life instead of Spirit, and Low-Life Vigil (like the Luminary's Sovereign Symphony) makes every aura stronger while it holds.

## Contracts (v7)

**Content.** The Martyr in `callings`, unlocked at Rank 8. A Calling may name its own Crescendo (`crescendoName`); the Luminary keeps Sunrise.

**Sim** (`SIM_VERSION` 8, replay format 6; 7 when the Martyr landed, 8 since her own healing is reported, so replays from the first Phase 3d builds no longer verify):

- `ThreadMode` adds `'bear'`. `WeaverComponent.lastMode` is the mode Bear returns to.
- Command `{ t: 'mode', mode?: 'bear' }`: without `mode`, Mend ⇄ Empower (from Bear, back to `lastMode`); with `'bear'`, Bear on and off. Without the Martyr, Bear is refused (`techniqueRejected`, technique `'thread'`, reason `'locked'`).
- `WeaverComponent.maxLife` (all of it, reserved included) and `reservedLife`. `health.maxHp` is the usable part, so heals stop there. `reservedSpirit` is 0 on a Martyr run.
- `FieldState.vow`: Martyr's Vow is up. `field.crescendo` stays "Sunrise is up", so everything that reads it (aura strength, reach, the Luminary's Radiance and Eclipse, the views) is untouched by the Vow. The Weaver's `crescendo` clock times both.
- Events: `borne { hero, amount, via: 'bear' | 'shared' | 'vow' }` when damage a hero would have taken goes to the Weaver; `undying { }` when Undying Devotion holds. `crescendoStart.calling` carries "Martyr's Vow".
- Ledger `calling { amplified, shielded, borne }`: `borne` is the damage the Weaver took for her heroes (after Bear's softening); what Bear, Shared Wounds and the Vow kept off a hero counts as shielded. `EncounterStats.callingBorne`. Save causes `'bear'` and `'vow'`; `DamageResult.saved` keeps a telegraph from logging a second Save for the same hit.
- Heal source `'self'`: the Martyr healing herself (Blood Font, Sanguine Covenant), kept out of the support ledger. It is reported as one `healApplied { via: 'self' }` a second (`WeaverComponent.selfHealAcc` holds what hasn't been yet). During the Vow, her healing received doubles.
- `chordProblems(chords, content, { fieldAuraSlots, pool })`: with `pool: 'life'`, songs may reserve at most 90% (the Weaver keeps a tenth of her Life).
- `WorldState.calling` adds `crescendo: 'sunrise' | 'vow'` and `bearShare`.
- `vowHoldsAt(state, impact)`: Martyr's Vow will still be holding the heroes when a hit due at `impact` lands. A telegraph that lands while it holds isn't `'lethal'` for a hero (the Vow doesn't hold the Weaver), so the HUD, the telegraph's colour and the calls for help all treat the party as safe.
- Mods: `lifeMult`, `lifeReserve`, `bearShare`, `borneTaken` (Bear's softening), `vowDuration`, `vowRedirect`, `vowHealMult`, `penitencePer100`, `bearDamageTaken`, `bloodFontPct`, `bloodFontBelow`, `sharedWounds`, `undyingInvulnerable`, `undyingMendPct`, `vigilBelow`, `vigilMult`, `aegisWardMult`, `aegisSelf`, `covenantPct`.

**Run** (save v5, unchanged shape):

- `RANK_XP` gains Rank 8 at 2,500 XP, which unlocks `calling.martyr`.
- The song pool follows the run's Calling (`Run.reservePool(run)`): Prep, Retune, the forge and events check Life on a Martyr run. `embark` resets Chords the new pool can't hold.

## Presentation

Details and screenshots: [UI](phase-3d/ui.md), [VFX](phase-3d/vfx.md), [audio](phase-3d/audio.md).

| | |
|---|---|
| **Prep** | Both Callings side by side (No Calling down the left), each locked, New or Chosen: the Martyr shows Rank 8 until then. The pick schedule is said once, in the section's header. Each card names its own Crescendo ("**Martyr's Vow** replaces Sunrise…"), and choosing the Martyr turns the song builder's budget into Life at once. |
| **Song builder** | On a Martyr run the Spirit budget becomes a **Life budget**: what the songs hold of all her Life (hatched, in the auras' colours), the dashed 90% cap, "You fight with 324 Life of 720: a Weaver without the Martyr has 360", where Blood Font and Low-Life Vigil wake when they're on the path, and "All 100 Spirit is free". Over the cap it shows the sim's sentence and holds Embark or the Retune. Every retune site (Prep, a Respite, the forge, the Tuning Pool, events, Third Voice) checks the run's pool. |
| **The tier screen** | Her emblem and colours, options tagged by axis (Endure, Share the pain, Live at low Life; Blood Font carries two). Blood Font and Low-Life Vigil say what the run's songs mean for them: "Your songs hold 55% of your Life, so you fight below 50% from the start: Blood Font is on all the time." |
| **HUD** | Her Life bar shows all of her Life: the usable part filled, what the songs hold hatched ("188 / 324 ▨396"), notches with glyphs where Blood Font and Vigil wake (lit while she's under them), and the figure turns red below 15%. Spirit reads "all free". The Thread read-out says "Bear 35%" with the B key (on Martyr runs only); the Crescendo reads "Martyr's Vow 4s". The threaded hero's frame shows "Borne · 35%" while she Bears; every hero shows "Vow · ≥ 1 life" while the Vow holds, and no frame reads LETHAL for a hit the Vow will catch. The Calling chip tracks Bear, Undying (ready or spent), Vigil and Blood Font. A coach hint introduces Bear when a big hit is coming at the threaded hero; the first-fight primer and the key hints name B. Callouts: "You bore it with Kael", "Your Vow held Kael", "Undying Devotion". |
| **Result, Summary, Codex, Rank 8** | "Bore 472 for your heroes · 945 kept off them"; the Summary lists her path and both totals; the Codex shows both Callings, each with its own axes; the Rank 8 card shows her emblem. |
| **In the fight** | Crimson and old gold, sacrificial, never gory. **Bear** turns the Thread crimson and heavy: it sags, an old-gold strand braids round it, its flow runs back toward her and embers drip from it; switching to Bear sends a ring sinking in to her. A **borne wound** runs as a pulse from the hero along the Thread into her hand, and she flinches when it lands, more for a bigger wound. **Shared Wounds** sends fainter pulses straight from the other heroes, **Penitence** lifts Resonance motes off her, **Scarred Hide** gives her a dull bronze rim while she Bears. **Martyr's Vow** is not Sunrise: rings draw in to her, a seal stamps over each hero's head with a tether to her, a hit it holds flashes the seal and runs down the tether to her, and at the end the seals break into rising motes. **Undying Devotion** bursts at her and sends a Mend wave to every hero; an old-gold shell breathes round her while she's untouchable, and until it's spent an ember floats over her head. **Low-Life Vigil** pulses her rim and her field's edge like a heartbeat, **Blood Font** glows at her feet and raises embers while it heals, **Martyr's Aegis** links each Ward to her and gives her own an old-gold shell, and **Sanguine Covenant** runs a faint pulse back along the Mend Thread; what she heals herself shows as a soft rose "+N" beside her. The auras' own looks are unchanged, and nothing adds a draw call (21 idle, as without her). |
| **Sound** | Low, solemn and warm, pitched from the hero: a heartbeat and a bowed swell when she takes up Bear, a sigh when she lets it go, a muffled thud for each borne wound (rate-limited, so a burst is a few thuds), a low choir, drone and dull bell for Martyr's Vow (no Sunrise horn or glass), a struck-iron clang when the Vow holds a hero, a caught breath and a deep bell for Undying Devotion, and a near-silent swell when she heals herself. |

## Harness

`npx tsx tools/callings.ts --calling martyr --loadout guardian --seeds 50`: whole Prelude runs, every one of the 16 paths on its own 50 seeds (800 runs a bot), against the same seeds with no Calling.

| Loadout · bot | No Calling | Martyr, all paths | I: Penitence · Scarred Hide | II: Blood Font · Shared Wounds | III: Undying · Vigil | IV: Aegis · Covenant |
|---|---|---|---|---|---|---|
| Guardian · Novice | 32% | **46%** | 48 · 44 | 47 · 44 | 44 · 47 | 49 · 42 |
| Steady · Novice | 38% | **49%** | 50 · 48 | 51 · 47 | 49 · 50 | 49 · 49 |
| Guardian · Skilled (400 runs) | 86% | **88%** | 91 · 85 | 88 · 88 | 87 · 89 | 88 · 88 |
| Steady · Skilled (400 runs) | 88% | **89%** | 88 · 89 | 89 · 89 | 89 · 88 | 87 · 91 |

The Martyr is worth 11 to 14 points to the Novice and 1 or 2 to the Skilled bot, level with the Luminary (Guardian 42%, Steady 49% for the Novice). Within each tier the two options sit within five points, except Guardian's capstone (Martyr's Aegis 49, Sanguine Covenant 42; level for Steady).

**How it got there.** The bots first had to learn Bear. A Novice that Bore whenever a hero was low gave up Mend exactly when it mattered; a Skilled bot that Bore any big hit it could afford left the Weaver too low for the next raid. Both now Bear just before a big hit on the threaded hero that no shield will stop (the Novice notices less often and lingers in Bear), and Mend or Empower otherwise. Then the numbers, measured fight by fight (the six hard fights, Threat 1, Guardian, 20 seeds) and in whole runs:

| Martyr | Fights: Novice · Skilled | Whole runs, Novice: Guardian · Steady |
|---|---|---|
| No Calling | 73% · 94% | 32% · 38% |
| The plan: +40% Life, Bear at full force (the first bot policies) | 55% · 87% | |
| Bear off, +40% Life | 71% · 92% | |
| +70% Life, Bear softened by half | | 40% · 41% |
| **+100% Life, Bear softened by half (shipped)** | | **44% · 49%** |
| +150% Life, Bear softened by half | 73% · 97% | 53% · 56% |

Without Bear the Life reservation is close to neutral: what the songs take from her Life, the free Spirit gives back. Bear at full force was the trap: a big hit's share could be more than her whole usable Life (227 for a Guardian Martyr), downing her and silencing every song. The guard rail (never more than leaves her at 1 life) and the softening made Bear a tool rather than a risk of losing the fight; +100% Life puts her level with the Luminary.

**What the bots can't show.** As for the Luminary, the bots almost never cast a Crescendo, so Martyr's Vow is tuned by reasoning. And the Skilled bot rarely needs Bear (its Wards answer most big hits), so the Martyr is mostly a different way to play for it, not more power.

## Code review

An independent review of the sim, run layer, bots and input (read-only, against a clean copy of the commits) found these, all fixed with regression tests:

- **The Vow logged a Save for every hit on a hero it held**, with a slow-motion beat each time; it now logs one, when it first holds them at 1. A hit could also leave a hero at 0.5.
- **Bear charged her for hits that felled the hero anyway**, and after Martyr's Veil had spent her life it could still down her. Bear now lifts nothing from a hit that stays lethal (the Veil, Fermata or the Vow may still catch it), and the "never below 1" cap holds.
- **Bear and the Vow worked for free while she was untouchable or down.** Bear lifts nothing while she's invulnerable; the Vow ends when she goes down; what she bore is credited from what she actually took.
- **A hero Fermata already held was still Borne and Vowed**, and a hold running out during the Vow downed them.
- **Her own Martyr's Aegis Ward counted as shielding the party**, and **Scarred Hide worked with no Thread attached**.
- **The new B default took over a key a player had already bound** (now a player's binding always wins), and **a Prep save with the Martyr over songs her Life couldn't hold was thrown away on reload**.
- The result's Crescendo highlight said Sunrise on a Martyr run; the bots judged Bear on the hero they were leaving.

Reviewing the UI and VFX work turned up three more, also fixed with tests: **a hit the Vow would catch still read LETHAL** on the hero's frame and the telegraph (now `vowHoldsAt`, above); **a Save by Bear or the Vow read as a plain "Saved Kael"**, with no callout for Undying Devotion; and **her own healing was never reported**: Blood Font and Sanguine Covenant healed her silently, so the self-heal sound never played and the view had to guess. It now comes once a second (a soft rose "+N" beside her).

After the fixes: 704 unit tests, typecheck and lint clean, and 8/8 end-to-end tests in Chromium against the production build, including the Martyr's own (choose her in Prep, the Life budget, her HUD, Bear on Kael).

## Known gaps

- **The bots barely use the Martyr's tools.** The Skilled bot rarely Bears (its Wards answer most big hits) and neither bot casts the Vow, so both are tuned by reasoning more than measurement.
- **Two loadouts measured.** Heavier songs (Bastion, Anchor, Wide Choir) reserve more of her Life and leave her more fragile; they weren't swept.
- **Calling mastery** (path tiers earned by playing a Calling) isn't in: every tier is open from the start.
- Guardian's capstone leans to Martyr's Aegis (above).
- **On screen**: Martyr's Aegis's shield on her isn't drawn on her Life bar; Shared Wounds marks only the threaded hero's frame; the Crescendo ring assumes the base length (Encore's extra time isn't shown, as for Sunrise). The UI and render each repeat the sim's "below a share of her Life" rule for Blood Font and Low-Life Vigil, and the builder works out her whole Life from content; tests pin all three to the sim.
- **Bear's crimson can only glow** (the Thread is drawn additively), so over a bright floor it reads rose; its braid, drips, weight and backward flow carry it. Fortissimo's rose on the beam song sits close to it.
