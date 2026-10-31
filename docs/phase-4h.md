# Phase 4h — Phase 4's exit checks

*2026-10-30 · plan: [docs/plan/06-roadmap.md, Phase 4](plan/06-roadmap.md#phase-4--the-loom-meta-progression-ml), [02 §9](plan/02-game-design.md#9-meta-progression-the-loom) · follows [Phase 4g](phase-4g.md)*

The roadmap closes Phase 4 at a gate with three exit criteria. This is how each was checked, and what it took to pass.

| Exit criterion | How it's checked | Result |
|---|---|---|
| The pacing model for the first 3 hours matches the schedule in 02 §9. | `tools/pacing.ts`: simulated players' first three hours, run by run (see *Pacing*). | **Passes.** A system opens every 15–45 minutes, in the schedule's order, and the first Calling arrives in the second hour. |
| In new-player tests, every station is understood on first contact. | Each station's first-contact intro, played in the browser and read cold by a stand-in newcomer, twice (see *First contact*). The playtest demo carries the real test. | **Passes the stand-in.** It scored the stations 2–5 at first, 3–5 after the fixes it prompted, mostly 4 and 5. |
| The raw-power cap (+30%) holds in the harness. | `tools/powercap.ts`: a maxed veteran's Astrolabe and carried relics, measured together (see *The raw-power cap*). | **Passes, after tuning.** It measured +55%. Halving the tree's bonuses and the Inscriptions brought it to about +34% (±4). |

## Pacing

`npx tsx tools/pacing.ts --players 16 --hours 3 [--bot skilled]` plays each simulated player's runs in order, on what their Rank has opened so far:
- **Their build:** the newest preset their Rank allows, their Astrolabe points spent on a fixed tree, and from Rank 7 the Luminary, with the path tiers its mastery has opened.
- **What they earn:** Weaver XP, Starlight (fights, wins and Deeds) and mastery, as the stores pay them.
- **The clock:** each run's fights, plus an allowance for everything around them:
  - 90 s of Prep and the Loom before a run, 45 s for its Summary;
  - 6 s for a path, 12 s for a Result, 20 s for a draft, a forge or a Calling's choice, 15 s for a relic, 25 s for a Respite;
  - 40–45 s for an event, a merchant or a scene.

It's a model of a player, not a measurement of one: the Novice bot stands in for a newcomer and the Skilled bot for a quick learner.

| First reached (median) | Novice | Skilled | Opens |
|---|---|---|---|
| a first won run | 0:24 | 0:16 | |
| Rank 2 | 0:16 | 0:15 | the field song, Ostinato |
| Rank 3 | 0:18 | 0:16 | an ornament slot; Grace Note, Reverb |
| Rank 4 | 0:35 | 0:30 | Lullaby, Pedal Point; **the Astrolabe** |
| Rank 5 | 0:52 | 0:32 | Fermata, Unison; **the Atelier** (variants and keepsakes) |
| Rank 6 | 1:20 | 0:58 | a second ornament slot |
| Rank 7 | 1:56 | 1:19 | **the Luminary** |
| Rank 8 | 2:40 (15 of 16 in 3 h) | 1:41 | **the Martyr** |
| Rank 9 | 3:04 (8 of 16) | 2:24 | **the Chronomancer** |
| Rank 10 | — | 3:04 (15 of 16) | **the Reliquary** |
| Luminary mastery 2 · 3 · 4 · 5 | 2:18 · 2:26 · 2:52 · 3:07 | 1:36 · 1:52 · 2:10 · 2:29 | its tiers II–IV; then its title and Chorale |

| | Novice | Skilled |
|---|---|---|
| A run | 13.6 min, 239 Weaver XP, 47% won | 16.7 min, 413 XP, 96% won |
| Starlight earned by 1:00 · 2:00 · 3:00 | 226 · 427 · 636 | 402 · 663 · 873 |

These are after the raw-power trim below (it made the Novice's later runs a little harder: 47% won, from 58%).

**Against 02 §9.** The schedule's rule is progressive disclosure: systems open one at a time, each with a short intro, never all at once. Its table has since moved in earlier phases, each by its own decision: the Astrolabe to Rank 4 ([Phase 4](phase-4.md)), the Callings to Ranks 7–9 (Phases 3c–3e), the Reliquary to Rank 10 ([Phase 4c](phase-4c.md)). Variants stay at 5, now in the Atelier. Against that schedule:
- **One at a time.** After the first run, something new opens every 15–45 minutes for both players, and the big systems (the Astrolabe, the Atelier, each Calling, the Reliquary) never share a Rank.
- **The Callings arrive within the first three hours** for both, and the first one's path opens over its next three or four runs.
- **Starlight has somewhere to go.** By the time the Atelier opens, a newcomer has about 200 Starlight saved: a variant (120) or a keepsake (60–90) at once. By three hours they've earned 40–55% of what the Atelier sells, so it doesn't empty early.
- **One rough edge:** a good first run reaches Rank 3 as well as Rank 2 (the second Rank needs only 40 XP), so its rank-up card names two Ranks' unlocks. That's two songs' worth of news at once, which the card already handles, and it was left as it is.

## First contact

The roadmap asks for new-player tests. The playtest demo ([docs/demo.md](demo.md)) puts the game in front of real newcomers. Before it, two checks stood in.

**Built in.** Every station is dark until it opens, and says how it opens. When it lights up, the hub marks it ("New", a banner, its thread brightening). Its first visit plays a two- or three-panel intro ending in "Try it". The Gate, the Training Grounds and the Codex share one welcome on the first visit. Tests cover each station's gate, and the e2e test plays a fresh profile's welcome and the Atelier's intro once.

**A cold read.** A fresh reader stood in for a first-time player: no docs, no code, no play. It read the hub's screenshots and every intro, and rated how well it understood each station, 1 to 5:

| Station | First read | After the fixes |
|---|---|---|
| The Gate | 4 | 5 |
| Training Grounds | 4 | 4 |
| Codex | 5 | 5 |
| Astrolabe | 4 | 4 |
| Atelier | 4 (2 for what variants do) | 4 (2 for its page under Skip the unlocks) |
| Reliquary | 2 | 3 |
| Bonds | 3 | 4 |
| Hall of Deeds | 4 (about 1 while dark) | 4 |
| Dissonance | 3 | 4 |

What tripped it up, and what changed:

- **The hub's own cues.**
  - "Begin a run" was a small outlined button just when a newcomer needs it most; it's now the gold primary, as Continue is.
  - The locked Atelier had a box and a gold line that read as "selected". Dark stations now get no emphasis, with dim names, a dashed arch and a larger lock, so a first visit reads as three places and six to come.
  - The Weaver's label looked like a station's; it's now a name plate.
  - Badges are named ("Kael 7 · Lyra 7 · Vexis 7", "34 Shards · 1 Tear").
  - Starlight says what it's for before the Atelier opens.
  - The Title doesn't preview the next Rank's unlocks before the first run, since their words assume you've played.
- **Words before their meaning.** Each intro now says what a term is where it first appears:
  - Prep and songs (the auras you sing to your heroes), and what a Perfect Ward is.
  - Deeds where the Astrolabe counts them, and Inscriptions, Tuning Shards, Discord Tears and attunement in the Reliquary.
  - Who the heroes are and what a Solo is, in Bonds.
  - Dissonance as optional difficulty and what it pays.
  - Callings and mastery where the Atelier first names them.
- **Wording that misled.**
  - "choose one you have to give it back" read as an obligation.
  - "Open with Skip the unlocks" didn't name the setting.
  - "Opens with your first." had no noun.
  - The welcome's "Try it" under the Training Grounds led through the Gate; it now says "begin a run".
  - "New run instead" didn't say it ends the run in progress.
  - "Starlight's shop" read like a shopkeeper's name.
- **Unchanged.** A mock showed Dissonance open below its Rank; it was the lab's data, fixed. The second read's main gap is the game's own vocabulary (the Thread, Ward, Mend and Empower, Prep), which the Prelude teaches in play and the Codex explains. On the Atelier's page under *Skip the unlocks*, every variant repeats the setting's note; that's a tester's view, not a newcomer's.

**Result: passes as far as a stand-in can show.** On the second read every station scores 3 or more, and most score 4 or 5. The Reliquary, which opens at Rank 10, the third hour, after crafting has appeared in play, is lowest at 3. Whether newcomers understand each station on first contact is the demo's question for real players.

A reader that hasn't played meets "Ward" and "Prep" cold, when a player has met them in the Prelude. So the read is harsher than play on the game's own words, and fair on the hub's.

## The raw-power cap

The plan caps raw power from the Astrolabe and the Reliquary together at roughly +30% (02 §9), "so skill stays the main axis and Dissonance stays meaningful". Each phase tuned its own half to about +15%, but they were never measured together.

`npx tsx tools/powercap.ts --set typical --steps 1.15,1.25,1.35,1.45` plays whole Prelude runs on Guardian with the Novice bot. Without meta it wins 31.5% (800 runs). A build is worth the extra enemy life at which it wins as often. The veteran here has every Rank's and Deed's point (29) on the tree the earlier phases measured. The set is three legendaries carried with Prism Loom attuned, each with four Inscriptions at T4 and T5.

| Measured | Before | After |
|---|---|---|
| The full tree, alone | +31% | +17% |
| A typical carried set, alone | +17% | +11% |
| … its relics' own effects, without Inscriptions | | +8% |
| **Both: a maxed veteran** | **+55%** | **+34%** |
| Both, with an excellent set (T3, rolled high) | +64% | +41% |

Most figures read the crossing between two steps of 400 runs, so they're good to about ±4: two reads of the same veteran gave +31% and +41%. The veteran's "after" is a straight-line fit on the logistic scale through four steps of 600 runs each.

**Where it came from.** The Astrolabe was tuned to +15% for its 19 Rank points. Deeds added 10 more points ([Phase 4b](phase-4b.md)), and the tree and relics compound: together they were worth more than the sum of their parts. The tree's power was spread, not in one place: a 19-point tree and a 22-node tree without its keystone's branch each read +21%. So the trim was proportional. The user chose it over fewer Deed points or deferring:
- **The tree's bonuses at half.** Every percentage and Resonance gain is halved: +2% Mend is now +1%. Second Wind revives at 35% life, half its bonus over the usual 30%. Keystones, durations, reaches and thresholds are unchanged: the Perfect window, Afterglow and Held Note, the Thread's and the field's reach, Bell Tower's radius, Second Stitch's threshold.
- **The Inscriptions at half,** each tier's range halved and rounded to its step. The Thread's reach, the Perfect window, the field's size and the two Resonance Inscriptions are unchanged. Saved relics come back inside their new tiers on load, as they did when [Phase 4c](phase-4c.md) first halved them.
- **Not touched:** the relics' own effects, since they're also found in runs, and the auras' own numbers.

**What it leaves.** A typical maxed veteran plays at about +34%, within the measurement's noise of the plan's "roughly +30%". A lucky one plays at about +41%. Later power is the endgame's by design: T2 and T1 Inscriptions open with Dissonance. Bonds, Callings and variants aren't in the cap (02 §9 caps the Astrolabe and the Reliquary). Measured on their own, a hero's full Bond is worth 5–8%, a Calling about 10%, and the variants are within about 5 points of their defaults, about 14% together for the Skilled bot ([Phase 4f](phase-4f.md)).
