# Solos without a trigger key: what we found, three designs, and a recommendation

*Round 11, stream SOLO, part 1. 2026-11-18. Main at `08d8b42`. Nothing in the game has changed yet.*

The owner's note:

> "I feel like no players will manually trigger the solos/specials of each character - so either
> remove the manual trigger or design the game around auto triggering."

This document says how Solos work today, measures them, compares three ways to change them, and
recommends one. Words used throughout:

- **Plain** and **Cued**: the two forms of every Solo. Cued is the stronger one.
- **The Skilled bot** and **the Novice bot**: the game's two scripted players. One plays well, one
  plays like a beginner. They play real fights with no screen, thousands of times.
- **A seed**: one roll of the dice for a fight. More seeds, steadier numbers.

## The short version

1. **The worry is right, and it is worse than it sounds.** Hero autonomy is off unless the player
   turns it on. So a player who never presses the Cue key never sees a Solo at all (bar Kael's
   emergency wall). Their boss fights take 70% longer.
2. **Recommended: design A, "your Thread is the Cue".** Every hero fires their own Solo a second
   after it fills. If your Thread is on that hero as it fires, it is the Cued form. No key, no
   cost. Solos start at least a second apart, so you can follow them with the Thread.
3. **It lands on today's numbers** with one number changed. Resonance no longer pays for Cues, so
   it fills at half speed. Then the Skilled bot wins as often and as fast as today (bosses: 95%
   in 134 s, against 96% in 133 s), and so does the Conductor.
4. **A player who ignores it still gets every Solo**, a third of them Cued by luck. Ignoring it
   costs about 6% in speed. Today, ignoring the Cue key costs 70%.
5. **The Conductor keeps its whole shape.** Duets and Trios come from Cueing with the Thread, one
   Solo after the next. Its two pieces about a Cue's price change: one goes, one gets a new job.

Three questions need the owner. They are at the end.

---

## 1. How it works today

### Charge, Cue and cost

- **Charge.** A hero's Solo fills while they fight: 25 seconds from empty (Oro: 28). Several things
  fill it faster (see the list below). The ring around the hero's portrait shows it.
- **Full.** At 100 the Solo waits. The frame says READY and shows the key.
- **Cue.** The player presses **T** (the hero under the cursor, else the threaded hero),
  **Shift + 1 to 4** (that hero), or the pad's **right bumper** (the reticle's hero). The Solo
  fires in its **Cued** form.
- **Cost.** One segment of Resonance: **25**. (20 as the Conductor. 10 more with the Dissonance
  level Silent Cues. Four other things change the price; they are in the list below.)
- **Refused** when the hero is down, possessed or stilled, the Solo isn't full, or there isn't
  enough Resonance.
- **What else a Cue does.** The hero calls out. The camera nudges and a spotlight falls. With three
  or more auras sung, a chorus pulse heals and shields the heroes in your field. Motifs, relics
  and talents that say "when you Cue" go off.
- **Without a Cue** a Solo does not fire. Two exceptions: Kael raises his plain wall himself under
  30% of his life, and with the talent Shieldbearer when a hero beside him falls low.

### Every Solo, plain and Cued

The first Solo is the hero's own. The second is the alternate their Bond opens at rank 10.

| Hero | Solo | Plain | Cued |
|---|---|---|---|
| Kael | Aegis Wall (4 s) | A barrier on himself: 25% of his life. | A dome over the whole party and you: 40% of each one's life. |
| Kael | Oathkeeper (6 s) | Hits on you and on heroes within 9 m land on him at 40%. He takes 30% less of everything. | Within 12 m, and at 25%. |
| Lyra | Gale Barrage (3 s) | She stands still and looses 12 arrows a second. | She can move, each arrow hits a third harder, and crits 40% more often. |
| Lyra | Hawk's Vigil (6 s) | She stands still and shoots every enemy that starts an attack, interrupting what she can. | She can move, and each shot marks its target to take 25% more damage for 4 s. |
| Vexis | Starfall (3 s) | Meteors fall on enemies near her. | Meteors fall inside your field, hit a quarter harder, and each one stuns. |
| Vexis | Celestial Sphere (5 s) | The hero you Thread gets a sphere that swallows 2 hits. | Every hero in your field gets one. |
| Brann | Red Frenzy (5 s) | A whirlwind that cuts everything around him. | His axe also heals him three times as much. |
| Brann | Blood Brother (6 s) | 16% of his damage heals the hero you Thread. | It heals every hero in your field, 8% each. |
| Seren | Thousand Cuts (4 s) | She vanishes, strikes up to eight enemies, and returns. | Every kill buys another cut. |
| Seren | Blade Waltz (5 s) | She parries every melee blow and counters at 150%. | She counters at 300%. |
| Oro | Wildgrowth (8 s) | An Ancient rises: it roots, taunts and slams the lesser enemies around it. | Its disc also counts as your field while it stands. |
| Oro | Homecoming (4 s) | His Saplings re-sprout at full life with a barrier, and taunt. | Heroes within 6 m of you also gain a 15% barrier. |

Two things to notice. The Cued form is usually **the same Solo made wider or freer**, not a
different move. And two plain forms (Celestial Sphere, Blood Brother) **already read your Thread**.

### What Resonance is spent on

Resonance is earned by good support: a Perfect Ward 20, a Save 25, a clutch Chime 15, a Reel that
dodges 15, and small trickles. It holds 100, in four segments of 25. A part-filled segment fades
after 5 idle seconds.

It is spent on exactly two things: **a Cue (25)** and **the Crescendo (100)**. Nothing else.

In practice it goes on Cues. In boss fights the Skilled bot spends **252 on Cues and 44 on the
Crescendo**: six parts in seven. It sings a Crescendo less than once every two boss fights.

### What Hero autonomy does

It is an assist in Settings and on the Prep screen. **It is off by default.**

- On: a full Solo waits 1 second for a Cue, then the hero fires it in the **plain** form.
- Kael holds his wall for a big hit, but never more than 3 seconds. Hurt, he raises it at once.
- The wait only runs while the hero has someone to fight.
- The frame says AUTO instead of READY.
- Off: nothing fires without a Cue (bar Kael's emergency wall, above).

### Everything else that reads or reacts to a Cue

Each line is something that will be kept, changed or removed. Section 3 says which.

**Content (the things a player collects)**

| What | Today |
|---|---|
| Motif: Canon | Cueing a Solo charges the other heroes' Solos by 15 / 22 / 30%. |
| Motif: Call and Response | A hero you Cue is Empowered for 3 / 4 / 5 s, Thread or not. |
| Motif: Footlights | A hero you Cue gains a barrier of 8 / 12 / 16% of their life. |
| Motif: Answering Phrase | Cueing a hero within 4 s of Cueing another gives back 3 / 5 / 7 Resonance. |
| Motif: Opening Bars | Your first Cue in each fight costs 10 / 15 / 25 less. |
| Harmony: Tempo Rubato | One Cue in every 3 costs nothing. (Needs Canon and Opening Bars.) |
| Harmony: Grand Staff | Needs Call and Response as one of its two motifs. |
| Bond motif: Steady Draw | Cueing Lyra brings her Piercing Shot 2 / 3 / 4 s closer. |
| Relic: Choirmaster's Baton | Solos you Cue last 50% longer. |
| Relic: Cantor's Hymnal | Start every fight with 50 Resonance, "ready to Cue". |
| Relic (cursed): Hollow Crown | Cues cost 10 less. Solos charge 25% slower. |
| Talent: Shieldbearer (Kael) | **Uncued**, Aegis Wall also shields the heroes beside him. He raises it himself when one falls low. |
| Talent: Constellation (Vexis) | Each Cue leaves a star that casts her bolt for 6 s. |
| Astrolabe: Spotlight (a small node) | Cued Solos last 2.5% longer. |
| Astrolabe: Ensemble (a great node) | When you Cue a Solo, the other heroes' Solos charge 5%. |
| Deed: Maestro | Cue 25 Solos in one run. |
| Dissonance: Silent Cues | A Cue costs 10 more Resonance. One of the weekly songs uses it. |
| Chorus pulse (3 or more auras) | Every Cue releases one. |
| Event boon: The Last Note | Heroes start two fights with Solos charged. (Not about Cues, but it puts three Solos in play at once.) |
| Calling: the Conductor | Built on Cues. See below. |

Things that only **charge** Solos (Quickened Verse, Tuning Fork, Tuning Up, Taking Bows, Lament's
Answer, the Astrolabe's and the Reliquary's "Solos charge faster") never read a Cue. They are
untouched by every design here.

**The Conductor Calling** (`docs/phase-5f.md`)

| Piece | Today |
|---|---|
| Passive | Cues cost 20. You gain 10% more Resonance. A Cue within 4 s of the last is a **Duet** (25% stronger); a third is a **Trio** (50% stronger). |
| Crescendo: Grand Finale | Every hero plays their Solo in turn, in the Cued form, each 20% stronger. Then every Solo is full again. |
| Marcato / A Tempo | Heroes who answer a Directive hit 10% harder. / A Cue on the downbeat is free. |
| Reprise / Upbeat | A Trio charges every Solo 30%. / Start each fight with 50 Resonance. |
| Ensemble / Spotlight | Each different hero Cued in a row: +5% damage, up to 15%. / A Cued hero is Empowered at double strength. |
| Triad / Maestro | Resonance never fades with 3 heroes in your field. / The Finale costs 75 and plays twice. |
| The meter | Keeps whole Cues from fading, and marks a Cue's price with ticks. |

**Enemies and fights**

- **The Finale's boss** "Cues Solos" onto its own voices. That is an enemy attack. It is not what
  the owner means and no design here touches it.
- **The Grand Silence** (the Finale) stills heroes: a stilled hero can't take a Cue. **Possession**
  (Movement III) is the same. After Reignite or the Coda, every Solo is filled for "the last burn".
- **Raids** (a hit on the whole party, such as the Hollow Cantor's Requiem): in boss fights the
  Skilled bot keeps one segment back to Cue Kael's dome for them.

**What the player sees and touches**

- **Party frames:** the charge ring, READY or AUTO, the key cap (⇧1), the Solo's plain and Cued
  lines in the tooltip. As the Conductor: a badge that says "Duet ×1.25" or "Free".
- **The Weaver bar:** ticks on the Resonance arc at each Cue's worth, the label "Cue 25", and
  "enough for 3".
- **Key hints:** the row "T / ⇧1–4 · Cue a Solo".
- **Callouts:** "Cue: Kael" on a Cue; "Kael: Aegis Wall" when he fires on his own.
- **The coach's hints:** "Kael's Aegis Wall is ready, press ⇧1 to Cue it (costs 25)", an autonomy
  version of the same, and three Conductor hints (a Duet's window, the downbeat, the Finale).
- **The primer (How to play):** its Resonance paragraph, in three versions.
- **Settings:** Assists has "Hero autonomy" (also on the Prep screen). Controls has "Cue a Solo"
  (T), "With Shift: Cue their Solo" on the four Thread keys, the bindable "Cue modifier", and the
  pad's "Cue the reticle's hero" on the right bumper. The README's control table repeats them.
- **The Codex:** the Weaver's Resonance and chorus paragraphs, the Conductor's paragraph, every
  hero's Solo lines, the Bonds pages.
- **After a fight:** the Result's "Cued 4 Solos" line and its timeline marker; the Summary's
  "Cues" tile; the Conductor's recap ("Free Cues", "No Duet this run: Cue a second hero…").
- **Sound and picture:** the Cue's musical phrase, the free-Cue chime, the Duet and Trio stingers,
  the heroes' Cue barks ("Aegis!"), the spotlight, and each Solo's Cued look.

**Under the hood**

- **Bots.** The Novice Cues a ready hero now and then. The Skilled bot Cues by rule: damage Solos
  into a pack or a boss, the dome for a raid, Brann low in a crowd, chains as the Conductor. The
  Expert bot adds banking rules. A lab page plays the weekly with a bot in the browser.
- **Replays.** A fight replay (format 6) is the fight's settings plus every command, tick by tick.
  "Cue hero 2" is one of the commands. The settings include "autonomy: on or off". A run replay
  (`.awrun`, format 1) holds the same for each fight of a run.
- **The weekly.** A week's result is checked by playing its replay again.
- **Saves.** Settings (version 4) hold the autonomy switch, the Cue key and the Cue modifier. The
  profile (version 10) holds the Deeds. A run in progress (version 5) holds each fight's Cue count.
- **Pins** (recorded results that tests compare against): the sim's version number (22), the 25
  golden fights, 52 baseline files of bot results, four snapshots of the bots' commands, and more.
  They are listed in section 5.

---

## 2. Measured today

**How.** The repo's own sim and bots, through a small tool (`tools/solo-study.ts` on the prototype
branch). 13 fights: two skirmishes, the mini-boss and the boss of Movements I, II and III, and the
Finale's boss. 20 seeds each, both bots: 520 fights a row-set. The default party (Kael, Lyra,
Vexis) with the kit the harness gives each Movement. "Bosses" below means mini-bosses and bosses.

Four ways to play today's rules:

{{today}}

*Solos and Resonance are per fight. "Never fired" is a Solo still full and unused when the fight
ended.*

**What it says**

- **The default game hides Solos from anyone who doesn't Cue.** Third pair of rows: a Solo charges
  once and then sits. In boss fights the Skilled bot's heroes stand with a full, unused Solo for
  four-fifths of the fight. Fights take **226 s instead of 133 s**, and twice as many heroes go
  down.
- **The bots do Cue.** The Skilled bot fires 98% of its Solos Cued. So every balance number in the
  game today assumes a player who Cues ten times a boss fight.
- **Autonomy alone is a weak fix.** Fourth pair: every Solo fires, all plain. The Skilled bot's
  boss fights are 20% slower than today and it wins 88% instead of 96%.
- **The Novice does much better with autonomy on** (bosses: 46% to 67%), with or without Cueing.
  A beginner gains more from Solos simply happening than from choosing their moment.
- **Resonance is Cue money.** Six parts in seven go on Cues. The Crescendo is rare.

Fight by fight, today's shipped rules are in the appendix.

---

## 3. Three candidate designs

All three share the first step: **heroes always fire their own Solos**. Hero autonomy stops being
a setting. The Cue keys go. Kael keeps his judgement (at once when hurt or about to be hit hard;
otherwise he holds for a big hit, at most 3 s). They differ in **what makes a Solo Cued**.

### A. Your Thread is the Cue (recommended)

**The rule.** A hero fires their Solo one second after it fills. If your Thread is on that hero at
the moment it fires, it is the Cued form; if not, the plain form. Two Solos never start less than
one second apart.

**What the player does differently.** Nothing new to press. The frame shows a Solo about to fire;
swing the Thread there (keys 1 to 4, or a click) and it plays Cued. Then swing back. When three
Solos come due together they fire a second apart, so you can follow all three: 1, 2, 3.
A player who never does this still gets every Solo, and the one they happen to be threading is
Cued.

**Resonance.** Feeds the Crescendo only. It has to fill more slowly to keep Crescendos as rare as
they are (measured below: half speed).

**The Conductor.** Keeps its shape. A Cue is now "your Thread on them as they fire", so a Duet is
two Solos Cued within 4 s and a Trio is three: the 1-2-3 sweep. Measured, Duets and Trios form
about as often as today when the player follows the Solos, and almost never when they don't. So
the Calling still rewards exactly the player it was built for. Two pieces were about a Cue's
price:

- *Cues cost 20* goes. Measured, nothing is needed in its place: with Resonance slowed the
  Calling plays as it does today (section 4). If the passive should read as more than "10% more
  Resonance, Duets and Trios", the natural addition is "Solos charge 10% faster", paid for from
  the Finale's ramp.
- *A Tempo* becomes **your heroes begin their Solos on the downbeat, and each Cued Solo gives 10
  Resonance.** The beat strip on the meter now shows when the next Solo will start.

Everything else of the Conductor's reads as it does today, with "Cue" meaning the new thing.

**Risks.**

- *It is one more thing to watch.* But missing it costs little: the Solo still fires.
- *The Thread leaves someone who needs it.* For about half a second. The bot that follows Solos
  stands down when a hero is under 30% life, and its heroes go down less than today, not more.
- *It asks for good frames.* The player must see a Solo coming a few seconds ahead. That is HUD
  work and one mark over the hero (see "What we need from other streams").
- *Crescendos become common* unless Resonance is slowed. See tuning.

### B. Always the stronger form

**The rule.** A hero fires their Solo one second after it fills, always in the Cued form. The
plain forms are deleted.

**What the player does differently.** Nothing. Solos are something heroes do.

**Resonance.** Feeds the Crescendo only, as in A.

**The Conductor.** Every Solo is a Cue, so Duets, Trios, Ensemble and Spotlight all happen by
themselves whenever Solos fall close together. The Calling becomes a bundle of passive bonuses
with nothing to do. To keep it worth picking it would have to become the one Calling where the
Thread decides (that is, design A, for one Calling only).

**Risks.**

- *It removes a decision and puts nothing in its place.* The owner's first option, taken plainly.
- *Things go missing.* Shieldbearer is written for the plain wall. Celestial Sphere and Blood
  Brother lose "choose whom you Thread". Twelve plain forms and their lines are cut.
- *The game gets easier* and needs the most tuning of the three (below).

### C. In your field

**The rule.** A hero fires their Solo one second after it fills. If they stand in one of your song
fields as it fires, it is the Cued form.

**What the player does differently.** Keep the party in the field. They already do.

**Resonance.** Feeds the Crescendo only.

**The Conductor.** As in B: chains form by themselves, because nearly every Solo is Cued.

**Risks.**

- *It is B with a tax on strays.* Measured, 88 to 93% of Solos come out Cued without anyone
  trying. The ones that miss are Kael charging a new pack and heroes at the edge. The player
  cannot do much about either in the second it takes.
- *It leans on the song field*, which is the owner's. It only reads "is this hero in a field",
  as the Conductor's Triad does today. No aura file or pin would change. But it makes the field
  matter more, which is a change to what auras are for.

### What each thing becomes

| Thing | A. Thread | B. Always | C. Field |
|---|---|---|---|
| Cue keys (T, Shift+1–4, right bumper), the Cue modifier setting | Removed | Removed | Removed |
| Hero autonomy setting (Settings, Prep) | Removed: it is how the game works | Removed | Removed |
| Plain and Cued forms | Both kept | Plain forms deleted | Both kept |
| Kael's hold (3 s) and his emergency wall | Kept | Kept | Kept |
| The word "Cue" | Kept, with a new meaning: your Thread on the hero as the Solo fires | Gone; "Solo" covers it | Kept: "in your field" |
| Resonance | Crescendo only; fills at half speed | Same | Same |
| Canon, Call and Response, Footlights, Steady Draw, Constellation, Ensemble (Astrolabe), Choirmaster's Baton, Spotlight (Astrolabe) | Kept as written | Kept, but now go off on every Solo: each needs re-tuning | As B, nearly |
| Answering Phrase | Kept ("gives 3 / 5 / 7 Resonance") | Kept, goes off far more | As B |
| Opening Bars | Changed: your first Cue in each fight **gives** 10 / 15 / 25 Resonance | Same change | Same change |
| Tempo Rubato | Changed: every third Cue **gives** 25 Resonance | Same change | Same change |
| Hollow Crown | Changed: every Solo plays Cued, Thread or not. Solos charge 25% slower | Needs a wholly new effect | Changed: Cued, field or not |
| Cantor's Hymnal | Text only: drop "ready to Cue" | Same | Same |
| Shieldbearer | Kept as written | Needs a new effect | Kept |
| Celestial Sphere, Blood Brother | Kept: Thread Vexis or Brann for everyone, Thread someone else for just them | Lose their plain form | Kept |
| Deed: Maestro (Cue 25 Solos in a run) | Kept; 25 is still about two boss fights' worth | Reworded; the number must rise | Kept; the number must rise |
| Dissonance: Silent Cues | Changed: your Thread must be on the hero for a full second before the Solo fires | Needs a new effect (say, Solos charge slower) | Needs a new effect |
| Chorus pulse | Every Cued Solo releases one. Same pulse, same numbers, about as many as today | One on every Solo: about 20% more | About 10% more |
| The Conductor | Kept; "Cues cost 20" goes and A Tempo gets a new job (above) | Becomes passive, or becomes design A | As B |
| The Finale's boss, the Grand Silence, possession | Unchanged (a stilled or possessed hero does not fire) | Unchanged | Unchanged |
| "The last burn" after Reignite | Solos fire themselves; the hint changes | Same | Same |
| Tutorial, primer, coach hints | Rewritten: one hint, "your Thread on a hero as their Solo fires makes it stronger" | Cue hints deleted | Rewritten around the field |
| Party frames | Ring, a countdown, and a mark when the Thread will make it Cued. No key cap | Ring and countdown | Ring, countdown, an "in field" mark |
| Weaver bar | Cue ticks and "Cue 25" removed | Same | Same |
| Key hints, Controls page, README table | Cue rows removed | Same | Same |
| Codex | Resonance, chorus, Conductor and hero pages reworded | Same, and plain forms removed | Same |
| Result and Summary | "Cued 4 Solos" kept | Becomes "4 Solos" | Kept |
| Sound and picture of a Cue | Kept, on Cued Solos | On every Solo | Kept |
| Bots | Cue rules become one Thread rule: follow the Solo about to fire unless someone is in danger | Cue rules deleted | Cue rules deleted |
| The weekly | Old weeks' replays read "recorded on another version" | Same | Same |
| Replays | New format; old ones are refused with a plain sentence | Same | Same |
| Saves | Settings move up a version and drop three entries. Profiles and runs in progress load unchanged | Same | Same |
| Aura pins and the eight aura files | Untouched, bar one number (question 1) | Same | Same |

---

## 4. Measured candidates

**How.** Each rule was built behind a switch that only the study tool can turn on
(`src/sim/soloProto.ts`, branch `p11/solo-proto`). With the switch off the game is byte for byte
as on main: the 25 golden fights still match. The bots were not rewritten. Instead the tool wraps
them:

- it drops every Cue the bot sends;
- **"follows the Solos"** adds one behaviour: half a second before a Solo fires, move the Thread
  to that hero, unless a hero is down or under 30% life;
- **"sings every full song"** casts the Crescendo the moment the meter is full (outside the Silent
  Conductor's fight, where the bots keep it for his Fortissimo). The bots today only sing when
  the party is in trouble, which would hide what freeing Resonance does.

Same 13 fights, 20 seeds, both bots.

{{cands}}

*Under the candidates "Fired Cued" means fired in the stronger form by the candidate's rule.*

**What it says**

- **A, followed, matches today with no tuning except Resonance.** Skilled, bosses: 94 to 96% won
  (today 96%), 125 to 130 s (today 133), 0.68 heroes down (today 0.90). Fight by fight it is
  inside the noise of 20 seeds everywhere (appendix).
- **Freed Resonance means Crescendos.** A player who sings every full song sings **2.6 a boss
  fight instead of 0.4**. With Sunrise that is only 4% faster. With a stronger Crescendo it is a
  lot: the Conductor's boss fights drop from 96 s to 78 s (below).
- **Halving Resonance gains fixes that.** "A tuned": 95% won, 134 s, 0.71 down, 1.3 Crescendos.
  That is today's Skilled result to within a second.
- **A, ignored, is still a fair game.** A third of Solos are Cued by luck. Skilled: 94%, 139 s
  (141 s tuned). That is the cost of not engaging: about 6% slower. Today the cost is 70%.
- **The one-second gap is for hands, and costs nothing.** The bot can move the Thread in a
  sixtieth of a second, so for it the gap adds little: 90% of Solos Cued with it, 87% without. A
  person cannot follow three Solos that fire on the same instant. The gap moved no result.
- **B and C are stronger than today** (0.5 to 0.6 heroes down against 0.9; 123 to 129 s). They
  need Solos to charge about 15% slower as well as the Resonance change.
- **The Novice wins more under every candidate** (bosses: 46% today, 69 to 83% untuned). Nearly
  all of that is Solos simply happening: today's rules with autonomy on already give 67%. With
  Resonance halved, design A gives the Novice 59% if it ignores the Thread and 75% if it follows.

**The Conductor, and the other Callings.** Path A is Marcato, Reprise, Ensemble, Triad. Path B is
A Tempo, Upbeat, Spotlight, Maestro.

{{cond}}

- Followed, design A makes **2.4 Duets and 1.4 Trios a boss fight** (today 2.8 and 1.0). Ignored,
  0.4 and none. The skill survives the change.
- The Conductor gets **much** stronger untuned (96 s to 78 s on path A): the Resonance that paid
  for Cues now pays for Grand Finales, twice as many.
- **Halving Resonance gains puts it back: 94 s, 0.41 heroes down** (today 96 s, 0.42), with 2.2
  Duets and 1.1 Trios a fight. None of the Calling's own numbers had to move.
- Path B barely moves. It was already singing two Finales a fight.

Skilled bot, bosses, by Calling (one path each; the bot's own Crescendo habits):

{{callings}}

The Luminary, the Martyr and the Chronomancer land within 3 seconds of today. Their bots sing
only in trouble, so this understates what a player who sings every song would get from the
Martyr's Vow or the Chronomancer's Stasis. The Resonance change covers it; the tuning step must
check each.

**Other parties.** Design A, untuned, with each of the three later heroes in Lyra's place.
Skilled bot, bosses:

{{parties}}

Within 8% of today in each. Seren's party is the one that speeds up (206 s to 189 s).

**Also tried, and set aside**

{{others}}

- **Empower only** (Cued when the Thread is on the hero *and* in Empower). Ignored, almost nothing
  is Cued. Followed, it is A with an extra switch to flip each time. More to do than today, which
  is the opposite of what was asked.
- **The Thread, and it takes a segment** (Cued costs 25 if you have it). It keeps today's economy
  exactly, and every price-changing motif and relic as written. But it spends the player's
  Resonance without asking, so they can never save for a Crescendo while healing the hero whose
  Solo is due. And the Novice, short of Resonance, gets few Cued Solos, as today.
- **A 2-second wait** in place of 1. No more Solos Cued, and every Solo a second later.
- **Heroes that wait for each other** (a full Solo holds up to 4 s for the next hero's, to make
  chains for the Conductor). It changed nothing: the heroes charge together already.

### What tuning each needs

| | A. Thread | B. Always | C. Field |
|---|---|---|---|
| Resonance | Gains halved (one number) | Gains halved | Gains halved |
| Solos | None | Charge about 15% slower | Charge about 13% slower |
| "When you Cue" motifs, relics, talents | None: they go off about as often as today | All re-tuned: they go off 20% more for a Skilled player and three times more for a Novice | As B |
| The Conductor | None on path A once Resonance is halved; path B to be checked | A redesign | A redesign |
| Novice bands | Re-set (question 3) | Re-set, by more | Re-set, by more |

Tuned as in the table, each candidate against today. The player follows the Solos (where there
is anything to follow) and sings every full song:

{{tuned}}

*B and C tuned: Solos charge 15% and 13% slower, and Resonance gains are halved. A tuned:
Resonance gains halved only.*

---

## 5. Recommendation and work list

**Build design A.** It is the only one of the three that keeps a choice for the player without
asking for a key, keeps both forms of every Solo, keeps the Conductor, and lands on today's
balance with one number changed.

### The rules to build

1. A hero with a full Solo and someone to fight waits **1 s**, then fires it. Kael's wall: at once
   when he is under half life, about to be hit hard, or (Shieldbearer) a neighbour falls low;
   otherwise within **3 s**. As now, the wait starts over after a gap (no target, downed, stunned,
   Reeled), and a possessed or stilled hero does not fire.
2. **Cued** if your Thread is on that hero on the tick it fires. Otherwise plain.
3. A hero does not start a Solo within **1 s** of another hero's starting. (Kael's urgent wall and
   the Grand Finale's turns ignore this.)
4. A Cued Solo does everything a Cue does today: the callout, the spotlight, the chorus pulse,
   Canon, Constellation, every "when you Cue" trigger, the Conductor's chain. It costs nothing.
5. Resonance is spent on the Crescendo only. Every gain is halved (starting value; tuned in W5).
6. The `cue` command, its keys, its pad button, the Cue modifier and the Hero autonomy setting
   are removed.
7. **Auto-Thread** (the existing aid in Controls) learns to follow a Solo about to fire when
   nobody is in danger. It is the same behaviour the study's "follows the Solos" bot uses, and it
   makes the whole thing hands-off for a player who wants that. It stays marked as an assist.

To try in tuning, not promised. Each is a small piece of hero judgement of the kind Kael has:

- Kael also raises his wall at once when a hit on the whole party is 1.5 s away, since his Cued
  wall covers everyone.
- Lyra and Vexis, whose plain Solos root them, wait out a hit that is about to land on them.
- Nobody starts a Solo on the last, nearly dead enemy of a wave.

### Content that changes

| What | Becomes |
|---|---|
| The Conductor's passive | "Cues cost 20" is removed. The rest as written. |
| A Tempo | Your heroes begin their Solos on the downbeat. Each Cued Solo gives 10 Resonance. |
| The Conductor's meter | No Cue ticks; no "keeps whole Cues". |
| Opening Bars | Your first Cue in each fight gives 10 / 15 / 25 Resonance. |
| Tempo Rubato | Every third Cue gives 25 Resonance. |
| Hollow Crown | Every Solo plays Cued, Thread or not. Curse unchanged. |
| Silent Cues | Your Thread must be on a hero for 1 s before their Solo fires for it to be Cued. |
| Answering Phrase, Cantor's Hymnal | A word each. |
| Every Solo's Cued line; the primer; the Codex; the coach | "Cued" explained once as "with your Thread on them". |

Everything else in section 1's list is kept as written.

### Files and systems

*(p11/solo's area unless marked.)*

**The sim** (`src/sim`)

- `systems/heroes.ts`: the firing rule (rules 1 to 3). `shouldFireUncued` loses its autonomy
  check and gains the gap.
- `systems/techniques.ts`: `cue()` goes; its body stays as "what a Cued Solo does", called from
  the hero's own firing.
- `systems/solos.ts`, `duel.ts`, `grove.ts`, `blood.ts`, `summons.ts`, `combat/health.ts`: read
  the Cued flag as they do. Oro's target-less firing (`groveFireUncued`) takes the same rule.
- `systems/conducting.ts`: no Cue price (`cueCostNow`, the fade floor, "saved" and "free Cues"
  tallies go); `nextCue` keeps the chain; A Tempo's downbeat start.
- `combat/resonance.ts`: spent on the Crescendo only; the gain scale.
- `fill/finale.ts` (Opening Bars, Tempo Rubato), `fill/relics.ts` (Hollow Crown), `mods.ts` (six
  Cue-price mods go; Silent Cues' and Hollow Crown's new ones arrive), `astrolabe.ts`,
  `triggers.ts` (unchanged: it listens for the same `cued` event).
- `commands.ts`, `normalize.ts`, `replay.ts`: the `cue` command and `assists.autonomy` go.
- `world.ts`, `state.ts`, `events.ts`, `constants.ts`: one new field (when the last Solo began;
  for Silent Cues, when the Thread reached its hero), `AUTONOMY` renamed, the version.

**Content** (`src/content`): `heroes.ts` and `bonds.ts` (the Cued lines), `callings.ts`,
`motifs.ts`, `fill/finale.ts`, `fill/harmonies.ts`, `fill/relics.ts`, `relics.ts`,
`dissonance.ts`, `weaver.ts` (the Cue's price goes; the gain scale), `effects.ts`.

**Bots and tools**: `src/bots/novice.ts`, `skilled.ts`, `expert.ts`, `common.ts` (Cue rules become
the Thread rule; the Conductor's chain rules become a sweep); `src/ui/lab/weeklyBot.ts`;
`tools/harness-core.ts` (the Conductor's tallies), `tools/callings.ts`, `tools/verbs.ts`,
`tools/run-verify.ts`, `tools/save-fixtures.ts`, `tools/release-check.ts` (the pins).

**Input and settings**: `src/input/actions.ts`, `bindings.ts`, `InputController.ts` (the Cue key,
the modifier, the pad button; Auto-Thread's new rule), `inputMap.ts`; `src/app/settings.ts`
(version 5 and its migration), `gameSpeed.ts`, `runtime.ts`, `runStore.ts`;
`src/ui/screens/SettingsScreen.tsx`, `ControlsSettings.tsx`, `PrepScreen.tsx`,
`TrainingScreen.tsx`; `README.md`.

**HUD and screens**: `src/ui/hudBridge.ts`, `store.ts`; `hud/PartyFrames.tsx`, `WeaverBar.tsx`,
`KeyHints.tsx`, `hints.ts`, `HowToPlay.tsx`, `ConductParts.tsx`, `conducting.ts`, `labels.ts`;
`screens/CodexScreen.tsx`, `SummaryScreen.tsx`, `Timeline.tsx`, `resultText.ts`,
`callingText.ts`, `dissonanceModel.ts`, `astrolabeModel.ts`, `chordModel.ts`; the labs' mock data.

**Text** (`src/ui/text/en`, shared with the menu stream): about 65 strings in 19 files. Every
one that says Cue, Cued or autonomy.

**Sound** (`src/audio`): the Cue phrase and barks stay on Cued Solos; the free-Cue chime becomes
A Tempo's; a soft tick as a Solo's one-second wait begins.

**Picture** (`src/render`, **the marks stream's area**): see "What we need from other streams".

**Docs**: `docs/hero-autonomy.md` becomes the Solo page; a note at the top of `docs/phase-5f.md`;
`docs/demo.md`'s notes for the next version; the plan's controls table.

### The pins that move

| Pin | Today | After | Why |
|---|---|---|---|
| The sim's version (`SIM_VERSION`) | 22 | 23 | The same inputs now give a different fight. |
| The content's version | `c-691f…` | new | Texts and numbers change. |
| Fight replay format | 6 | 7 | The `cue` command and the autonomy flag leave the format. |
| Run replay format | 1 | 2 | It holds each fight's assists. |
| Settings | 4 | 5 | Three entries leave. |
| Run save, profile | 5, 10 | unchanged | Nothing in them changes shape. |
| The 25 golden fights (and their copies in `m1Unchanged.test.ts`) | | re-recorded | Every fight plays differently. |
| The 52 baseline files in `tools/` | | re-recorded | The bots play differently. |
| The bots' command snapshots (four), the Prelude and draft snapshots, the Expedition pins, the hand-off pins, the Dissonance pins, the fill pins | | re-recorded | Same reason. Each test must say why. |
| The audio and render fight snapshots | | re-recorded if they contain a Solo | To be seen in the build. |
| The release check's list of pins | | updated | It names the numbers above. |
| **The aura presentation pin** | holds `simVersion: 22` | **one number, by the owner** | See question 1. Its 627 recorded entries do not move: checked with the rule switched on. |
| The chord cards pin | | unchanged | Checked with the rule switched on. |

**Old replays and saves**

- **Old fight and run replays** cannot be played back: the fights would go differently. Opening
  one says so in words ("recorded before Solos changed, in Version 19 or earlier; it can't be
  played back here"). It is never shown as a failed check.
- **The weekly.** A week recorded before the change reads "recorded on another version". The
  week in progress when the build ships should be played again.
- **Settings** load and step up to version 5. A key the player had bound to Cue is freed.
- **Profiles** load unchanged. Deeds, bests and Bond ranks stand.
- **A run in progress** loads and carries on under the new rules. Its motifs and relics keep
  their names and take their new wording.

{{suite}}

### Tests to add

- **Firing:** each hero fires 1 s after filling, Kael within 3 s; hurt, at once; no target, never;
  after a gap, the full wait again; possessed, stilled, downed or being Reeled, never.
- **The form:** Thread on the hero on that tick, Cued; one tick late, plain; the Weaver downed,
  plain; the Thread snapped, plain.
- **The gap:** three Solos filled together start 1 s apart, in slot order; Kael's urgent wall and
  Finale turns ignore it.
- **What a Cued Solo does:** one chorus pulse, Canon's charge, a star, each trigger, exactly once;
  a plain Solo, none of them.
- **Resonance:** no path spends it but the Crescendo.
- **The Conductor:** a Duet and a Trio by Thread; a chain broken by a plain Solo; A Tempo's
  downbeat start and its Resonance; the Finale unchanged.
- **Changed content:** Opening Bars, Tempo Rubato, Hollow Crown, Silent Cues, each alone.
- **Determinism:** the same seed twice, with and without the Conductor.
- **Replays and saves:** a format 6 fight replay and a format 1 run replay are refused in words;
  settings 4 becomes 5 without loss; a saved run from main loads and plays.
- **Bots:** the Thread rule (follows, and stands down for a hero in danger); new snapshots.
- **Interface:** the frame's three states; no Cue key anywhere on screen (a search of every
  string); Controls and the pad map; Auto-Thread follows a Solo.
- **Browser:** the Conductor's test rewritten (a Duet by moving the Thread); a first fight in which
  a new player sees a Solo fire without touching anything.

### Order of work

1. **W0, alone, first: the sim and its versions.** Rules 1 to 6, the content changes, the version
   numbers, the goldens. Everything else stands on it. About a third of the whole job.
2. Then four in parallel:
   - **W1, bots and tools.** The Thread rule in the three bots; the harness; then every baseline.
   - **W2, input, settings and saves.** Keys, pad, the settings step, replays' new formats and
     their refusal sentence, Auto-Thread.
   - **W3, HUD, hints and text.** Frames, the meter, key hints, the coach, the primer, the Codex,
     the Result and Summary.
   - **W4, sound.** Small.
3. **W5, tuning**, after W1: the Resonance scale, the Conductor to its band, each Calling
   checked, the Novice's bands re-set, the Deed's number.
4. **W6, tests, browser tests, docs, demo notes**, alongside W3 to W5, finishing last.
5. An independent review, then the usual full verification.

### What we need from other streams

- **Marks (`src/render`).** A mark over a hero whose Solo is about to fire (the last 3 s of
  charge and the 1 s wait), and a different one when the Thread is on them. Without it the player
  has only the frame to watch. We have not touched `src/render`.
- **Menu text (`src/ui/text`).** Our strings sit in their folder. We will change only the ones
  about Solos, Cues and autonomy, and say which, so the two passes merge cleanly.

### What we did not check

- No person has played any of this. Every number is a bot's.
- Brann, Seren and Oro were measured in one party each, untuned, Skilled bot only (section 4).
  Other parties, and those three with halved Resonance, were not.
- Only single fights, with the harness's kits. No whole runs, no Expert bot, no Dissonance tiers.
- One path of each Calling (two of the Conductor's).
- The halved Resonance was measured with no Calling and with the Conductor's path A. Not with
  the Luminary, the Martyr or the Chronomancer, nor on the Conductor's path B.
- The new jobs for A Tempo, Silent Cues, Hollow Crown, Opening Bars and Tempo Rubato are designed
  here, not built or measured.
- The pad. It loses a button and gains nothing; nobody has held one.
- Moments when a Solo is wasted: a boss that cannot be hurt for a while (the Postlude's rise),
  the last enemy of a wave. Today the Skilled and Expert bots hold their Cues there. Whether the
  heroes need a rule for it was not measured; the overall results say the loss is small.

---

## 6. Questions for the owner

**1. May one number in the aura pin file change?**
The redesign changes how fights go, so the sim's version number must go from 22 to 23. That is
how old replays are told from new. The aura presentation pin has "22" written inside it, and its
test fails on any other number. We switched the new rule on and ran both aura pin tests: **every
recorded look and sound still matches**. Only the number would differ.
*Recommended: yes.* The orchestrator records that one line and names the commit in the release
check's approved list. The alternative is to leave the number at 22, which would make old replays
look current and fail in confusing ways.

**2. The Conductor: keep it as a Calling of skill, as described?**
Under design A it stays the Calling for the player who wants to lead: follow three Solos with the
Thread and you have a Trio. "Cues cost 20" goes, and A Tempo makes the heroes start their Solos
on the beat.
*Recommended: yes.* The other choice is to make it fully automatic (heroes wait for each other
and chain by themselves). That is less work to play and gives the Calling nothing to do.

**3. The game gets easier for players who never Cued. Leave the fights alone?**
Such a player's heroes now use their Solos. Across the four Movements the Novice bot wins 59% of
boss fights if it ignores the Thread and 75% if it follows the Solos, against 46% today. The
Skilled bot's results are held where they are.
*Recommended: leave the fights alone, and re-set the Novice's target numbers to the new results.*
If most players never Cued, this is the game they should have been playing. The other choice is
to toughen every boss until the Novice is back at 46%, which would also make the game harder
than today for the players who did Cue.

A smaller matter, with a default we will take unless told otherwise: **the word.** We keep
"Cue" and "Cued" for the stronger form ("your Thread Cues a Solo"). It keeps Silent Cues, the
Deed and the Conductor's vocabulary intact. If "Cue" should go with the key, "Accompanied" is the
musical word for the same thing.

---

## Appendix

### Fight by fight

{{today-fights}}

### Where everything is

- **This document:** `/home/user/aw-work/11/solo/DESIGN.md`. It is built from `DESIGN.tpl.md`,
  `parts/` and the data by `python3 -I tools/tables.py build`, all in the same folder.
- **The data:** `/home/user/aw-work/11/solo/data/*.jsonl`, one line a fight.
- **The prototype:** branch `p11/solo-proto` (off `08d8b42`). The switch is
  `src/sim/soloProto.ts`; the tool is `tools/solo-study.ts`. `p11/solo` itself is untouched.
- **To run a row again:**
  `npx tsx tools/solo-study.ts --variant thread --lead --gap 1 --seeds 20 --out x.jsonl`,
  then `npx tsx tools/solo-study.ts --report x.jsonl --by kind`.
- **To see what a rule would break:**
  `SOLO_PROTO_MODE=thread SOLO_PROTO_GAP=1 npx vitest run tests/aura --maxWorkers=2`.
  The whole suite run that way is in `logs/suite-forced.log` and `.log.json`.
- **State at hand-back:** the worktree `/home/user/aw-work/wt-p11solo` is on `p11/solo`, clean,
  with no commit of ours. Nothing is built. The prototype is not a start on the build: its switch
  and its tool are thrown away, and the real rule is written fresh in W0.
