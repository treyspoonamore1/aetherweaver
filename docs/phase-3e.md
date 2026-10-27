# Phase 3e — The Chronomancer

*2026-10-27 · plan: [docs/plan/03-content-bible.md §2](plan/03-content-bible.md#2-callings-choose-one-per-run) · follows [Phase 3d](phase-3d.md)*

The third **Calling**: the one who was ready. The Luminary makes the heroes shine and the Martyr takes their wounds; the Chronomancer bends the seconds around them. The user chose how it plays:

| Question | Choice |
|---|---|
| Rewind on a hero who went down in the last 3 s? | **It brings them back**, with the life they had then. A clutch undo, on an 18 s cooldown. |
| …and how often? (asked after tuning: a revive whenever Rewind was ready made the Chronomancer twice as strong as the other Callings) | **Once per run.** One clutch revive a run; every other Rewind (life and place) is unchanged. |
| Rewind when the hero had less life 3 s ago? | **It never lowers their life.** They keep the higher of now and then; their place always goes back. |
| What does Foresight show? | **Attacks 1 s early**: each enemy attack appears as a faint outline, with its target, a second before its telegraph starts. The attack itself is unchanged. |
| When does it unlock? | **A new Rank 9** (3,350 XP), after the Martyr's Rank 8. |

Like the Martyr's Vow, the Chronomancer's Crescendo, **Stasis**, replaces Sunrise; like Bear, **Rewind** takes an existing key (Reel's, F).

## The Chronomancer: the one who was ready

> *Again. I was ready this time.*

**Passive.**

- **Perfect Wards are 0.1 s more forgiving** (as the Steady Hands motif words it), and **every telegraph shows its timer** (the seconds until it lands).
- **Rewind replaces Reel** (F, same Spirit cost and range): the threaded hero (or the hero you point at, as for Reel) returns to where they stood **3 s ago** and to the life they had then, **never less than they have now**. **Once a run**, a hero who **went down** in those 3 s stands back up with that life. **18 s cooldown.** Statuses and shields are untouched; a hero Fermata holds, given their life back, is saved by it. If it takes a standing hero out of an attack's shape, it counts as dodging it, as Reel did, and they look again at what's coming from where they now stand.

**Crescendo: Stasis** (instead of Sunrise). For **3 s** every enemy and everything it set in motion stands still: no movement, no attacks, telegraphs and casts paused, enemy projectiles hanging in the air, summons and waves waiting, boss scripts and the enrage timer paused, and the statuses enemies carry or put on heroes (marks, links, silence, stun) paused. Heroes and the Weaver act as normal, so heroes keep hitting. While it lasts, **techniques have no cooldowns and cost half Spirit** (Ward uses no charge; Chime, Rewind and Glide neither need nor start a cooldown).

### The path

Four tiers, two options each, picked after the first fight won on rows 0, 3, 5 and 7, as for the other Callings.

| Tier | Option A | Option B |
|---|---|---|
| I | **Quickened**: your techniques recover 10% faster. | **Foresight**: you see every enemy attack 1 s before it begins, with its shape and its target. |
| II | **Echo Ward**: a Perfect Ward comes back 1 s later at 50% strength. | **Borrowed Time**: a Rewind that gives back life also fills 30% of that hero's Solo. |
| III | **Temporal Mastery**: Glide resets the cooldown of the last technique you used, once every 10 s. | **Slow Dance**: enemies in your field move 15% slower and wind up 10% longer. |
| IV | **Paradox**: Rewind also undoes every attack aimed at that hero. | **Eternal Moment**: Stasis lasts 2 s longer, and a Ward cast during it that turns out Perfect gives 10 Resonance. |

The axes: **see it coming** (Foresight, Echo Ward, Slow Dance), **more turns** (Quickened, Temporal Mastery, Eternal Moment) and **undo it** (Borrowed Time, Paradox).

**Reading the plan.** The plan leaves a few things open; this is how they're settled.

- **Foresight** "looks 1 s further ahead": the attack an enemy will use next is *foreseen* once it's due within 1 s, looking past a cast, the recovery after it and a stun, and only among attacks it could begin as things stand (someone in reach, room on the board), picked as the enemy would pick: the soonest, then the first in its list. Its target is chosen then (for attacks that pick at random, that roll happens a second early) and the attack uses it if that hero still qualifies. Boss scripts' scheduled attacks (the cracked bell's second toll, Requiem) are foreseen from their timers. With two attacks ready together, the one shown can change at the last moment if one goes out of reach (in the tests, a boss's attack is shown as itself a second ahead about 9 times in 10).
- **Echo Ward**: the echo is a real Ward (never over a stronger Ward cast since), so a hit already in its Perfect window when it comes back can be Perfect; an echo never echoes. It comes back too early for the Bellwarden's second toll.
- **Borrowed Time** asks that the Rewind give back life, so Stasis's free Rewinds can't fill a Solo for nothing.
- **Temporal Mastery** on Ward gives a charge back.
- **Paradox**: attacks targeted at the hero (a mark on them, a link through them, a lance or cleave aimed at them) are cancelled outright; an area attack they stand in when you Rewind passes them by. Either way it's an answered attack.
- **Eternal Moment**: nothing lands during Stasis, so "Perfect Wards during Stasis" means Wards *cast* during it that are Perfect when the attack resumes.
- **A Ward cast during Stasis counts as cast at the frozen moment**: if the attack was already inside its Perfect window when time stopped, a Ward cast any time during Stasis is Perfect when it lands (if it's still up).

**What it doesn't change.** Auras, songs and the Thread work as before. Stasis has no aura surge and no heal (`field.crescendo` stays "Sunrise is up", false).

## Contracts (v8)

**Content.** The Chronomancer in `callings` (`crescendoName: 'Stasis'`), unlocked at Rank 9.

**Sim** (`SIM_VERSION` 10, replay format 6; 9 when the Chronomancer landed, 10 after the review's fixes):

- Mods: `rewindSeconds` (0 = Reel), `rewindCooldown`, `stasisDuration` (0 = no Stasis), `stasisCostMult`, `techCooldownMult` (Quickened), `foresight` (seconds, 0 = none), `echoWardDelay`, `echoWardPct`, `borrowedTimeSolo`, `masteryCooldown`, `slowDanceSpeed`, `slowDanceWindup`, `paradox`, `stasisPerfectResonance`; the passive adds to `perfectWindowBonus`.
- `HeroComponent.past`: the hero's last 3 s, sampled every 0.1 s of sim time (`PAST_SAMPLE_SECONDS`; `internal.pastSampleAt`), so slow motion doesn't shorten it (`{ hp, x, z, up }`, a ring buffer with `pastAt`), kept on Chronomancer runs only (empty otherwise).
- The revive is once a run: `SimConfig.calling.reviveSpent` (the run already spent it) and `WorldState.calling.reviveSpent`; in a fight it's available while that's false and `ledger.calling.revived` is 0 (`rewindCanRevive(state)`). A refused revive is `techniqueRejected { technique: 'rewind', reason: 'locked' }`; a hero down for longer than Rewind reaches is `'target'`.
- `WeaverComponent.lastTechnique` (`'ward' | 'chime' | 'reel' | null`) and `masteryAt` (Temporal Mastery).
- `EnemyComponent.foreseen`: `{ attackId, name, target, second, at, special } | null`, the attack it's about to use and when (Foresight). It can be set while the enemy is still casting, recovering or stunned, with `at` after those.
- `FieldState.stasis`: Stasis is up. Every enemy-side clock waits while it lasts (telegraph `start`/`impact`/`perfectFrom`, enemy casts, enemy projectiles and summons in flight, waves, boss timers, `encounter.enrageAt`, `foreseen.at`, enemy shields): they move forward with time, so `impact − time` stands still. Ward shields' `appliedAt` move with them (Perfect timing is in the enemies' time), and so does the end of a hero's dodge (`dodge.until`, tied to the attack it escapes). Consumers that cached a telegraph's impact from its event must read the state while Stasis is up.
- `Shield.echo` (an Echo Ward) and `Shield.stasis` (cast during Stasis), both optional and absent on every other shield.
- Ledger `calling` adds `rewound` (life Rewind restored, revives included) and `revived` (heroes it stood back up). `EncounterStats.callingRewound` and `callingRevived`. Save cause `'rewind'`: a hero Rewind stood back up. Heal source `'rewind'`.
- `WorldState.calling.crescendo` adds `'stasis'`; `calling.rewind` (Rewind replaces Reel), `calling.timers` (telegraphs show timers), `calling.foresight` (seconds).
- Events:
  - `techniqueCast` / `techniqueRejected` with `technique: 'rewind'`: Rewind keeps Reel's slot (`cooldowns.reel`, the F key) but names itself.
  - `rewound { target, fromX, fromZ, toX, toZ, restored, revived }`, with a `healApplied { via: 'rewind' }` for the life restored (a revive also emits `revived`).
  - `foreseen { enemy, attack, name, target, at }` when an attack is first foreseen.
  - `echoWard { target, amount }`, `temporalMastery { technique }`, `paradox { target, cancelled }`.
  - `crescendoStart.calling` carries "Stasis".
- Command `{ t: 'tech', id: 'reel', slot? }` casts Rewind on a Chronomancer run.

**Run** (save v5, unchanged shape):

- `RANK_XP` gains Rank 9 at 3,350 XP, which unlocks `calling.chronomancer`.
- `RunCalling.reviveSpent`: set when a fight's `ledger.calling.revived` is above 0; passed into every later fight's config.
- `SAVE_HOW.rewind`; `summarize` names Stasis.

## Presentation

Details and screenshots: [UI](phase-3e/ui.md), [VFX](phase-3e/vfx.md), [audio](phase-3e/audio.md).

| | |
|---|---|
| **Prep** | All three Callings side by side (No Calling down the left), each locked, New or Chosen: the Chronomancer shows Rank 9 until then. His card names his Crescendo ("**Stasis** replaces Sunrise…"), and on his runs the intro says Spirit powers "Ward, Chime and Rewind". |
| **The tier screen** | His emblem and steel, options tagged by axis (See it coming, More turns, Undo it), and the passive (Rewind, the timers and the Perfect window) under "Always yours". Once the run's revive is spent the screen says so; the map's strip and the retune budget name Rewind in F's slot. |
| **HUD** | **Rewind takes F**: its own glyph, name and 18 s sweep, and a refused press shakes the slot. **F's target shows what Rewind would do**, read from the hero's past: "Rewind +1,149" with a silver ghost on the life bar, "· dodges it" when going back takes them out of a hit on its way (or "· undoes it" with Paradox); on a hero who just fell, "Rewind: stands back up · once a run · 2.4 s" with the key and a countdown ring, or "revive spent", or "out of reach". **Foresight** shows the next attack on each hero's frame and on the boss bar (a link names both its heroes), and the **telegraph timers** show the next hit's seconds on the frame; both freeze in Stasis, as the clocks do. In **Stasis** the techniques read free and cost half (the old cost struck through), the Crescendo reads "Stasis 4s" and the screen's edges take a steel tint. The Calling chip tracks Stasis, Revive (ready or spent) and Temporal Mastery, and with Temporal Mastery Glide's button shows what a Glide would bring back. Coach hints, the first-fight primer, the key hints and Settings name Rewind on his runs; callouts say "Kael stands again", a Paradox banner, and "out of reach" or "its revive is spent this run" for a refused Rewind. |
| **Result, Summary, Codex, Rank 9** | "Rewind gave back 995 life · stood 1 hero back up", a Rewind marker on the timeline, and the death recap's "Ready but unused" names Rewind; a Save by Rewind's dodge reads "with a Rewind". The Summary lists his path and totals, the Codex all three Callings, and the Rank 9 card his emblem. |
| **In the fight** | *To come with the VFX workstream.* |
| **Sound** | Precise, crystalline clockwork in the middle register, between the Martyr's bass and the Luminary's glass, pitched from the hero by scale degree. **Rewind** is a tape sweep and the hero's note as a bell played backwards, caught by a tick (longer for a longer way back, warmer for more life); **a Rewind revive** is a fuller version that lands before the save rings out; a refused Rewind jams with a tick-tock. **Stasis** halts a clock over tape winding down, holds a chord with a slowed tick about once a second while the music freezes under a lowpass, and draws time back in when it ends. **Foresight** is a soft backwards glint on the target's note; a lethal attack's last second gets one soft tick. Echo Ward returns the Ward's chime in fading repeats, Paradox is a shatter played backwards that lands with the Rewind. Windups wait with the attacks in Stasis and resume to peak when they really land, and any attack called off (its caster killed or interrupted, undone by Paradox) now stops winding up. |

## Harness

`npx tsx tools/callings.ts --calling chronomancer --loadout guardian --seeds 50`: whole Prelude runs, every one of the 16 paths on its own 50 seeds (800 runs a bot), against the same seeds with no Calling.

| Loadout · bot | No Calling | Chronomancer, all paths | I: Quickened · Foresight | II: Echo Ward · Borrowed Time | III: Temporal Mastery · Slow Dance | IV: Paradox · Eternal Moment |
|---|---|---|---|---|---|---|
| Guardian · Novice | 32% | **46%** | 48 · 44 | 49 · 43 | 41 · 50 | 46 · 45 |
| Steady · Novice | 38% | **52%** | 53 · 52 | 52 · 52 | 50 · 55 | 54 · 50 |
| Guardian · Skilled (400 runs) | 86% | **95%** | 97 · 93 | 97 · 93 | 96 · 94 | 95 · 95 |
| Steady · Skilled (400 runs) | 88% | **94%** | 97 · 92 | 95 · 94 | 95 · 94 | 94 · 95 |

For the Novice the Chronomancer is worth 14 points, level with the Martyr (46%, 49%) and the Luminary (42%, 49%). For the Skilled bot it's worth 6 to 9, where the others are worth 1 to 3: Rewind rewards being ready. The Skilled bot Rewinds the big blows its Wards didn't stop (in the Hollow Cantor about three a fight, giving back some 2,000 life), and once a run it stands a hero back up.

A longer cooldown isn't the lever: at 24 s instead of 18 every Novice run came out the same (46%, 52%) and the Skilled bot won 95% and 95%. Neither bot often has Rewind waiting on its cooldown. What each Rewind undoes is what it's worth: how far back it reaches and how much life it gives back.

**How it got there.** The first report, with Rewind standing a hero back up whenever it was ready, had the Novice at 58% and 63%, twice what the other Callings give. Fight by fight (the six hard fights, Threat 1, Guardian, 20 seeds) the cause was plain:

| Chronomancer | Fights: Novice · Skilled |
|---|---|
| No Calling | 73% · 94% |
| The passive, as first written | 87% · 98% |
| …without Rewind | 74% · 94% |
| …without the longer Perfect window | 88% · 98% |
| …with a 30 s cooldown | 85% · 98% |

(The Luminary's passive was worth 78% to the Novice, the Martyr's 72%.) Rewind was all of it, and its revive most of that: a second life for a hero in every fight. Its cost changed nothing until the bots stopped casting it at all (45 Spirit), and capping or softening the revive (half life, a longer cooldown for revives) still left ten points a fight. So the user chose how often it may revive. In whole runs (Novice, Guardian): once a fight 53%, never 43%, **once a run 47%** (shipped; 46% after the review's fixes).

**What the bots can't show.**

- **Stasis.** The bots spend their Resonance on Cues: in 48 hard fights each, the Novice cast Stasis twice and the Skilled bot never. Stasis's free, half-cost techniques and all of Eternal Moment barely appear in the table.
- **Foresight** is information, and the bots don't read it: for them it's an empty tier I option, which is why Quickened leads by four or five points. A player who sees the next attack (and its target) a second early gets more from it than the table says.
- **Temporal Mastery** needs Glide, and only the Skilled bot Glides; for the Novice it does nothing, so Guardian's tier III shows Slow Dance's own worth (nine points), not a gap between the two.

## Code review

An independent review of the sim, run layer and bots (read-only, against a clean copy of the commits) found nine problems, all fixed with regression tests:

- **Rewind on a hero Fermata held gave their life back, then the hold downed them anyway**: the hold only counted Mend and Chime as a save. Rewind's healing now saves them too (in 648 bot fights it had downed one such hero).
- **Stasis cut heroes' dodges short**: a hero stepping out of a frozen attack stopped partway through Stasis and walked back into it. The end of a dodge now waits with the attack it escapes.
- **Foresight often showed a boss's attack late, or the wrong one**: it didn't look while the boss was casting or staggered, and it could show an attack the boss then couldn't begin, while the one it did begin (and its random target) came unannounced. It now looks past casts, recovery and stuns, and only among attacks the enemy could begin; a boss's attack is now shown as itself a full second ahead about 9 times in 10, where the review had found most shown late (65 of the Bellwarden's 90 attacks and 56 of the Hollow Cantor's 132) and 27 shown as a different attack.
- **A revive counted as a Reel dodge**: a hero stood back up inside an attack got a dodge, a Reel, Resonance and a second Save. Only a standing hero Rewind moves out of an attack's shape dodges it now.
- **Rewind cancelled a dodge in progress** even when it put the hero back in the attack; the dodge now goes on and they look again at what's coming from where they stand.
- **What Paradox spared outlived its attack, and Echo Wards outlived the fight**: both are cleared with the attack or at the fight's end.
- **The spec said an Echo Ward could catch the Bellwarden's second toll**; with these timings it comes back too early, and the doc now says so.
- **The Foresight test couldn't tell a kept target from a fresh roll**; it now swaps the roll. New tests also cover the Fermata hold, attacks in flight, summons and waves under Stasis, dodges under Stasis, and Paradox on links and lances.
- **Rewind reached less far back in slow motion**: the past was sampled every few ticks rather than every 0.1 s of sim time.

The review also noted that during Stasis, Rewind's free, half-cost casts let Borrowed Time fill a Solo four times over; it now asks that the Rewind give back life. It confirmed that runs without the Chronomancer are unchanged (the bots draw no new random numbers; checked again seed for seed after every fix and after the once-a-run revive).

## Known gaps

- **The bots barely use Stasis**, as with Sunrise and the Vow, so Stasis and Eternal Moment are tuned by reasoning more than measurement.
- **Two loadouts measured** (Guardian and Steady), as for the other Callings.
- **Calling mastery** (path tiers earned by playing a Calling) isn't in: every tier is open from the start.
- **Foresight can change its mind at the last moment** when two of an enemy's attacks are ready together and one goes out of reach; about one boss attack in ten isn't shown a full second ahead.
- **Echo Ward comes back too early for the Bellwarden's second toll** (above).
- **Heroes can still shove frozen enemies** by walking into them during Stasis.
- **On screen**: the Stasis ring assumes the base length (Encore's extra time isn't shown, as for Sunrise and the Vow); a foreseen area attack around an enemy shows on the boss bar but on no hero's frame; and the HUD repeats two of the sim's rules (Stasis's discount, and what Rewind would give back), each pinned to the sim by a test.
