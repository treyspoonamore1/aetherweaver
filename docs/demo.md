# The playtest demo

*2026-10-30 · follows [Phase 4h](phase-4h.md); updated 2026-11-03 for [Phase 5a](phase-5a.md), 2026-11-04 for [Phase 5b](phase-5b.md), 2026-11-05 for [Phase 5c](phase-5c.md), 2026-11-08 for [Phase 5d](phase-5d.md), 2026-11-09 for [Phase 5e](phase-5e.md), for [Phase 5f](phase-5f.md) and [Phase 5g](phase-5g.md) (Version 13), and 2026-11-10 for [Phase 6](phase-6.md) (Version 14)*

A build of the game for playtesters: the Prelude run (Movement I), and since Phase 5a the Expedition, which climbs on past the Hollow Cantor into Movement II (the Crimson Spire and the Crimson Legion), with everything the Loom has opened by then. It's published as a private link (a claude.ai Artifact) that its owner can share. Nothing is collected from players.

## Starting

The first screen asks how to start:
- **Start fresh** is a new Weaver: the real first hours, every station dark until it opens, each with its first-contact intro. This is the build's main test: does each system make sense when it arrives?
- **Veteran** is a Weaver some hours in, so the later systems can be tried at once:
  - Rank 12, with the Astrolabe's points left to spend;
  - Starlight for the Atelier, and one variant (Purge) owned;
  - the Luminary mastered (its title earned, Chorale for sale) and the Martyr on her way;
  - Brann, the Bloodsworn (Phase 5b), Seren, the Riposte, and Oro, the Grovekeeper (Phase 5e) recruited, so Prep picks three of six heroes;
  - each hero at Bond rank 4 (their first talents);
  - two relics enshrined, with materials to craft.
  The stations' intros still play on first visit.

Settings → *Start the demo over* comes back to this choice. Progress stays in the browser that played it (and only for the session where the browser blocks storage).

## Building it

```sh
npm run build:demo        # VITE_DEMO=1, relative paths, no source maps → dist-demo/
```

`DEMO` (src/app/demo.ts) is false in every other build, so the normal game never shows the choice. The demo's starts are tested in tests/demo.test.ts.

## Publishing

`dist-demo/index.html` is the page, and its `assets/` (109 files, 5.6 MB up to Version 13; 113 files, 7.2 MB from Version 14) are published beside it as the artifact's own files. The page loads nothing from anywhere else.
- **Where it is:** [Aetherweaver](https://claude.ai/artifact/WQmazTSTrGDW3SpS4CQ9Uv), a private claude.ai artifact (slug `ee2a9adf-b9b9-4612-abe0-a64652bfb45b`). Only its owner sees it until they share it from its page on claude.ai.
- **To update it,** rebuild and republish the folder to the same artifact (its slug and current version), so the link stays the same.
- **Checked before publishing:** the build was served under a content policy like the host's (its own files only, no eval), and both starts were clicked through. Fresh and veteran, the Title, the Loom with its welcome, Prep: no console errors, page errors or failed requests. For the Thread dial's update, a fresh start went on into the Training Grounds, and the dial turned from Mend to Empower on a right-click, again with no errors. For Movement II (version 1793691876-2760), the Veteran start went on to Prep, which opened on the Expedition route ("The Expedition · Movements I-II"), again with no errors; the e2e suite's Expedition smoke plays past the Cantor to Vharun and the Summary. For Phase 5b (version 1793773158-83ac), both starts were clicked through again with no errors, and the e2e roster smoke recruits Brann, picks him in Prep and plays a fight beside him. For Phase 5c (version 1793913565-ae7a), both starts were clicked through again with no errors; the e2e suite (23 tests, all passing) plays an Expedition past Vharun into Movement III, through the Unweaver to the Summary, and checks the Rift's map, a Rift fight's HUD and that Glide never greys out. For Phase 5d (version 1794096200-d582), both starts were clicked through again with no errors; the e2e suite (23 tests, all passing) plays the Expedition on to the Silent Conductor, skips the epilogue with no card over it, then sees the held Rank-up and Bond cards, and the roster smoke takes First Light's road relic before its draft. For Phase 5e (version 1794207886-8a83), both starts were clicked through again with no errors; the e2e suite (24 tests, all passing) adds the roster-of-six smoke: a veteran recruits Brann, Seren and Oro, picks Kael, Seren and Oro in Prep, fights beside them, and sees their frames and their Result and Summary lines. For the rank-and-file enemies' red rim (version 1794254244-18f3, 2026-11-09), both starts were clicked through again with no errors; the unit suite passed, and the e2e suite was not re-run for this render-only change. For Phase 5f and Phase 5g (Version 13, version 1794298241-a148), both starts were clicked through again with no console errors, page errors or failed requests; the unit suite (4,380 tests) passed on the published commit; the e2e suite (31 tests, six of them new for the content fill) passed on the commit before the two tuning changes (Long Phrase, Iron Mask) and was not re-run after them. For Phase 6 (Version 14, version 1794333817-e322, 2026-11-10), both starts were clicked through again with no console errors, page errors or failed requests, and the same build was driven further under the same policy on both starts with *Skip the unlocks* on: the Loom and the Atlas station, Retrograde and A Cappella from their cards through Prep and the map into a first fight, This Week's Song through Prep to its map, Prep's three new levels and the total out of 42, the Codex's Atlas and Dissonance pages, the Hall of Deeds, a made-up code and a garbage file refused in words, and a bot-recorded week's replay opened and read Verified; the verifier's worker and the replay store in IndexedDB both worked under the policy. The unit suite (4,872 tests) passed on the published commit; the e2e suite (36 tests, five of them new for Phase 6: the Atlas station, This Week's Song, the lab views, a weekly played twice in a page worker and verified in the page, and a weekly's first fight played through the combat screen) passed after both tuning rounds, on the commit before five small interface fixes (the Echo Summary's heading, a weekly with no fight played recording nothing, the code box's width, a keepsake tag, the Loom's station labels), and was not re-run after them.

## For testers

- **New since the first build:** the Thread dial over the Weaver bar, and a glyph over the hero you've threaded, show at a glance whether you're Mending or Empowering ([docs/thread-dial.md](thread-dial.md)).
- **Also new:** bars over the heroes, healer-style party frames, a low-life sound, and a HUD layout of your own: pause, then Edit HUD layout to move and resize the party frames and the Weaver bar ([docs/health-ui.md](health-ui.md)).
- **New in this build: Movement II.** From Rank 2, Prep's Route switch picks the Prelude (Movement I, about 17 minutes) or the Expedition (Movement I, then the Crimson Spire's seven stops: about 28 minutes in all). A Veteran start can choose it at once; a fresh one opens it at Rank 2. The Crimson Legion brings bleeds, pins, latches, Blood Pacts and shielded Sentinels, each introduced by a "New foe" card the first time you meet it, then the Gorehound Matriarch and Vharun, the Crimson Warden ([docs/phase-5a.md](phase-5a.md)).
- **Also new: hero autonomy works.** With the assist on, heroes fire their own Solos a moment after they charge; Kael saves his wall for a big hit, never more than 3 seconds ([docs/hero-autonomy.md](hero-autonomy.md)).
- **Play on a computer** with a keyboard and mouse. The Title, the Loom and the Atelier also take a gamepad; fights don't yet.
- **Sound starts with your first click** (browsers require it).
- **Nothing is collected.** There's no feedback form or telemetry in this build; tell its owner what you found.

## Phase 5b: Brann and the roster

*For testers.* Phase 5b adds a fourth hero, **Brann, the Bloodsworn**, and a roster: once he has
joined, Prep asks you to choose three of four heroes. The published link above has Brann since
version 1793773158-83ac, which includes the rebalance (he keeps out of blows swung at the others).

**How to get him.**

- **Veteran start:** he is already recruited. Prep opens with the picker, on Kael, Lyra and
  Vexis; click a starter to drop them, then click Brann.
- **Fresh start:** on an Expedition, Movement II has an event, *The Bloodsworn's Cell*. Free the
  prisoner and win the elite fight, and he joins from your next run. If you never find the Cell,
  fighting Vharun, won or lost, frees him too. Until then Prep is exactly as before: no picker.
- **Or skip it:** Settings → Progress → *Skip the unlocks* puts him in the roster at once (with
  every other system). Turning it off again sends a party with an unrecruited Brann back to the
  default party.

**What to look at.** His one rule: **your healing on him is halved, and your Wards and barriers
aren't.** He hits harder the lower his life, and his axe heals him. Please tell us:

- **Before his second fight,** could you say how healing him differs from the others? Did the
  'New ally' card, Prep's Needs row or the hint make it clear?
- **His frame:** the 40% and 15% lines, the ember band between them (where he fights best), the
  rage % and Bloodlust chips. Did anything read as an alarm when it wasn't?
- **Bloodletting:** above half life he spends some of his own life for three stronger swings. It
  shows as a crimson drain, not a white hit. Did it ever look like he'd been hit?
- **Bloodlust:** below 40% he won't come back for a Rally. Reel him; or, once he has his Iron
  Will talent, Ward him and he obeys. Was it clear why he stayed?
- **When he goes down,** the Result says what would have saved him. Did it help?
- **His footwork:** he steps out of blows swung at the hero beside him, but never out of one aimed
  at him (those are yours to Ward). Did he ever stand in a cleave meant for Kael?
- **Without Kael** (Lyra, Vexis and Brann) there is no dome: Brann is the front line, and Prep
  says what each missing starter takes with them.
- **In the Crimson Spire,** among the crimson Legion, could you find him at a glance (his
  silhouette, the axe and the brass collar)?

The full protocol for these questions is [docs/phase-5b/playtest-protocol.md](phase-5b/playtest-protocol.md).

## Phase 5c: Movement III, the Unstitched

*For testers.* The Expedition now goes on past Vharun into **the Abyssal Rift** ([docs/phase-5c.md](phase-5c.md)). Vharun becomes an interlude (a relic, an epic draft, half your life back), and the run ends at **the Unweaver**. Movement III attacks the Weaver's own tools: it cuts your Thread, silences your techniques, turns a hero against the party, copies your casts and steals a song.

The published link above has Movement III since version 1793913565-ae7a (2026-11-05).

**How to get there.**

- **Prep:** the Expedition route now reads 'Movements I–III, to the Unweaver', about 40 minutes for a strong player.
- **Veteran start:** choose the Expedition in Prep and play through, or use *Skip the unlocks* first.
- The Prelude is unchanged.

**What to look for.**

- **Shears** (the opening fight): a dotted dash line with a scissors marker where it crosses your Thread. Was it clear that you can Thread a hero on your side of the line, or step across it? After a cut, did the 'CUT' callout and the lock ring tell you when you could re-thread?
- **The Void Maw:** its swirl tightens before it inhales. Did you Rally in the tell? Did 'Swap puts you in the Maw' make sense?
- **The Doubt Wraith:** a 4 s cast and a cracked-mask mark. If it lands, the hero gets an indigo rim and strikes an ally. Did you know to Chime them free, or Focus the Wraith first?
- **The Null Priest:** a rune closes at your feet. Inside it Ward, Chime and Reel grey out, but **Glide never does**. Did you walk or Glide out without being told twice?
- **The Mimic:** its cast bar shows the icon it will copy. Did you notice that casting something else cracks the mirror?
- **The elite** (*The Frayed Court*): Severing, Silencing and Doom-touched, one per wave. Doom counts to five over a hero; did you Chime before five?
- **The Seamstress:** Needle Rain, Stitch (two heroes sewn to the floor), and at half life the Unpick, which pulls your Thread loose.
- **The Unweaver**, in three phases:
  1. Snip (a cut across your Thread, 3 s lock), Spindles (Focus them: while one stands the boss takes 75% less damage) and Shear;
  2. Steal Verse (one of your auras goes hollow until you kill the fleeing Stolen Verse) and Unravel (your Mend wounds for 5 s: switch to Empower);
  3. Mirror Weave: a Hollow Champion the boss Wards as you Ward yours. Interrupt the Mirror Ward and Focus the champion.

**Please tell us:**

- Did each 'New foe' card, glyph and Decree say what to do before it cost you a hero?
- When a hero went down, did the Result's line name what would have saved them?
- Was any input ever blocked without a visible lock and a way out?
- How long did the whole Expedition take you, and did Movement III feel too long after two Movements?

## Phase 5d: the Finale, the Silent Conductor

*For testers.* The Expedition now climbs out of the Rift into **the Celestial Crucible**, where the Silent Conductor waits with its mirror-choir ([docs/phase-5d.md](phase-5d.md)). The Unweaver becomes an interlude (half your life back, 75 Aether, a relic and an epic draft), and the run ends at the Conductor. To keep the whole run near 40 minutes, the Finale route takes a shorter road through Movements I-III.

The published link has the Finale since version 1794096200-d582 (2026-11-08). It has Seren and Oro since version 1794207886-8a83 (2026-11-09).

**How to get there.**

- **Prep:** the Expedition route reads 'Movements I–III and the Finale, to the Silent Conductor.', about 40 minutes for a strong player (39.6 / 39.4 minutes measured on the Skilled bot, losses included).
- **The road:** Movement I is 5 stops (First Light; a skirmish or elite row; the Bellwarden; a respite, merchant or forge; the Cantor). Movement II is 6. Movement III is unchanged. The Prelude is unchanged.
- **Veteran start:** choose the Expedition in Prep and play through, or use *Skip the unlocks* first.

**What to look for in the Finale.**

- **Phase 1, the Overture:** the Conductor Cues a Solo onto a glass voice. Its cast bar names the soloist and the Solo, and a brass baton line points at it. Did you know to interrupt the soloist, or to answer its Solo?
  - Lament (the Alto): a mark. Chime it away.
  - Basso Ostinato (the Bass): a circle. Ward on the beat.
  - Cadenza (the Tenor): a line, more than a hero's life. Reel them out or step aside.
  - Shatter Aria (the Soprano): a wide circle. Scatter so it catches one.
- **Discord:** the brass stave under the boss bar. Every Solo you let through adds 25. A brass streak runs from the hero it hit to the Conductor. It also rises on its own, faster in phase 2. Did you see the 'Fortissimo Silence in ~N s' countdown?
- **Fortissimo Silence** (Discord at 100): three raid pulses of 40% of every hero's life. Your Crescendo cancels it, whatever your Calling. Did you hold the Resonance for it? Without one, the dome, Wards and heals carry the party through.
- **Phase 2, the Mirror Choir:** the Tenor and Soprano join at once, so the choir can be four for a while. Cues come faster.
- **Phase 3, the Grand Silence** (at 30% life): the music stops, the light greys and your heroes freeze. Only you can act.
  - Only three things are heard, and each is a **note**: a Perfect Ward, a Clutch Chime, and a Reel that saves a hero (a Chronomancer's Rewind counts too).
  - Eight notes bring the song back. Every hero wakes with a full Solo, and the fallen stand up again.
  - If you can't make eight, the Coda wakes them after about 50 s, but the fallen stay down.
  - The stave in the boss bar fills one pip per note, with the note's glyph.
- **The last burn:** Cue your heroes' Solos and finish it.

**The epilogue.**

- After the win, five short lines play at the top of the Summary (about 17 s): the Conductor, your first hero, and the Weaver. You can skip it with the Skip button, Escape, Enter or Space.
- It shows once per victory.
- The Summary then reads 'The song goes on', with a first-clear card. Dissonance opens on your first Finale clear at Weaver Rank 15 or above.

**Playing with the sound off.** The Grand Silence is built around sound, so please try it muted too (and with Flashes at 0, if you can).

- The music stopping: the grey light, the vignette, the silence tint, dark sky rings, frozen frames, and the stave in place of the meter.
- A note: the 'Note 3/8 · Perfect Ward' callout, its pip and glyph on the stave, a gold mote rising to a ring in the sky.
- The song returning: frames relit gold, the fallen rising, 'Note 8/8 · The song returns!'.
- Settings has a **Captions** switch (off by default) that also writes the key sounds as words.

**Please tell us:**

- In phase 1, did the Cue tell you who would sing, and what to do about it, before the Solo landed?
- Did you understand what fills Discord, and that your Crescendo stops Fortissimo Silence?
- In the Grand Silence, could you name the three things that count as notes? (With the sound off, too?)
- Did you ever press something in the silence and wonder why nothing happened?
- Was the epilogue the right length, and did you find the way to skip it?
- How long did the whole Expedition take you? Did the Finale feel like an ending?

## Phase 5e: Seren and Oro

*For testers.* Phase 5e adds the last two heroes of the plan's six ([docs/phase-5e.md](phase-5e.md)). Each gives one of your buttons a new job.

- **Seren, the Riposte** (a duellist) turns your **Ward** into damage. Warded, she parries the next melee blow aimed at her and answers it for 300%. A Perfect Ward on her is a **kill shot**.
- **Oro, the Grovekeeper** (a summoner) turns your **field** into a placement puzzle. His two **Saplings** hold the small foes, and they take your songs only while they stand in your field.

**The published link has them** (since version 1794207886-8a83). The tuning decisions in [docs/phase-5e.md](phase-5e.md) (*Tuning (W9)*, *NEEDS USER*) are still open; this section says what to look for.

**How to get them.**

- **Veteran start:** both are already recruited (Rank 12). Prep opens on a 3 × 2 picker of six heroes; click a starter to drop them, then click Seren or Oro.
- **Fresh start, Seren (from Rank 8):** on an Expedition, Movement II's *Tithe Altar* gains a fourth choice, *Pay a stranger's debt*. Win its elite fight and she joins from your next run. Or fight the Gorehound Matriarch, won or lost, at Rank 8 or above.
- **Fresh start, Oro (from Rank 12):** Movement III's *Loose Thread* gains *Follow the thread*. Win its elite fight and he joins from your next run. Or fight the Seamstress, won or lost, at Rank 12 or above.
- **Below their Ranks** the new choices stay hidden, and the Codex says where to find each hero.
- **Or skip it:** Settings → Progress → *Skip the unlocks* puts both in the roster at once (with every other system). A won *Pull it* at the Loose Thread recruits nobody.
- **Which party?** In the bot runs, Kael, Lyra and Oro won more often than the default party, and Kael, Vexis and Oro about as often. Every Seren party won less often; Kael, Vexis and Seren about half as often. Lyra, Vexis and Oro have nothing to hold the bosses, by design: it is the hardest party, and Prep says so.

**What to look for: Seren.**

- **Ward her to parry.** Crossed blades over her mean a Ward is armed. The next melee blow aimed at her flashes PARRIED, and she counters. A Ward on her is a weapon, not just a shield.
- **Her Call** (Lunge): answer it with a Ward, and she arrives armed for the duel's first swing.
- **The kill shot.** Time the Ward Perfectly on a blow aimed at her: a star, KILL SHOT and a gold number. It finishes a normal foe, an elite under half life, and deals six times her strike to a boss.
- **Bringing her home.** She leaves the group to duel the strongest enemy (*Showboat*), outside your songs but never past 13 m. When the pack closes on her, her frame shows 'Overextended · Reel': Reel her, or Rally (she always comes). As the Chronomancer, or with the Anchor or Swap Reel variant, the chip says Rally instead.
- **Without Kael** the bosses come to her. Ward her as each boss blow lands; she parries it whole.

**What to look for: Oro.**

- **The Saplings in your field.** Two rooted Saplings sprout 4 m ahead of you. Each one in your field shows your songs on its rim and its mini bar (under Oro's frame). Outside it, the arcs grey and a leaf mark shows: walk back over them, or Rally, and they burrow and re-sprout ahead of you.
- **Rootbond.** Your Thread on Oro, in Mend, also heals his Saplings (green motes along his roots).
- **Gentle.** He won't fight without a Focus: a closed leaf on his portrait. While he tends, his Saplings hit harder.
- **The Ancient.** His Solo, Wildgrowth, raises an Ancient that roots and taunts the small foes near it. Cue it, and its 6 m disc is your field for its 8 s: your songs reach whoever stands in it (a second dashed disc).
- **Bosses and the biggest foes ignore Saplings.** They hold the pack, never the boss.

**Playing with the sound off.** Every state has a shape, so please try a fight muted (and with Flashes at 0, if you can): crossed blades (armed), the PARRIED flash, the KILL SHOT star, the duel tether and crown, the overextended chip and arrow ring, the grey Sapling arcs and leaf mark, the burrow trail, the closed leaf, the root vines and the Ancient's rings. Settings → *Captions* writes their barks and key sounds as words.

**Please tell us:**

- **What does a Ward on Seren do?** Could you say it after your first fight with her?
- **Why did your Sapling die?** Could you say what you'd do differently?
- Did you notice a kill shot when you made one? Did you try for the next?
- When Seren was surrounded, did the chip tell you in time, and did the Reel or Rally bring her back?
- Did you ever lose track of where she was?
- Did you find a way to keep both Saplings in your field? Did Rally re-plant them where you wanted?
- Did you know to Focus to wake Oro? Did the closed leaf read as 'idle'?
- With Lyra, Vexis and Oro, did Prep's note prepare you for the bosses?
- When either went down, did the Result name what would have saved them?

The cold read (≥ 4 of 5 testers answering the first two questions) uses the protocol in [docs/phase-5b/playtest-protocol.md](phase-5b/playtest-protocol.md).

## Version 13: the Conductor and the content fill

*For testers.* Version 13 holds two phases: a fourth Calling, **the Conductor** ([docs/phase-5f.md](phase-5f.md)), and **the content fill** ([docs/phase-5g.md](phase-5g.md)), which adds 63 motifs, 18 relics, 2 boons and 6 events to the Expedition. They can be played together or apart.

### Phase 5f: the Conductor

*The one who makes them great.* The Luminary lights the heroes, the Martyr takes their wounds, the Chronomancer bends the seconds. The Conductor leads them: Cues are cheap, Solos called close together grow stronger, and his Crescendo plays every hero's Solo in turn.

**How to get him.**

- **Rank:** he opens at Weaver Rank 12. Prep shows four Callings beside *No Calling*, and his card says *Rank 12* until then.
- **Veteran start:** the veteran is Rank 12, so he is already in Prep. His path is shut, though: a Calling's tiers open with mastery, and the veteran has no mastery with him. He plays with his passive and his Grand Finale only.
- **Fresh start:** reach Rank 12, then choose him in Prep, as for the other Callings. Playing him earns mastery, and each level opens a tier of his path.
- **Or skip it:** Settings → Progress → *Skip the unlocks* opens him at once, with every tier of his path.
- **His path** is four tiers of two options, picked after won fights on the road, as for the other Callings (listed below).
- **The Prelude and the Expedition both work.** Only the content fill, further down, is Expedition-only.

**What he does.**

- **Cheap Cues.** A Cue costs 20 Resonance, and you gain 10% more Resonance. (A Cue is Shift plus the hero's number; the cost shows as ticks on the Resonance meter.)
- **Duets and Trios.** Cue a Solo within 4 seconds of your last Cue and it plays as a **Duet**, 25% stronger. A third hero Cued within 4 seconds of the second plays as a **Trio**, 50% stronger. A chain needs different heroes: Cue the same hero again and it starts over.
- **Only Cues count.** A Solo a hero fires on their own (with the assist on, a full Solo fires itself a moment after it is ready) neither joins nor breaks a chain, and neither does a Grand Finale turn. So with the assist on, build your chain quickly.
- **Grand Finale** replaces Sunrise. Every hero plays their Solo in turn, as if Cued, each 20% stronger than the one before; when it ends, every Solo is full again. It costs the Crescendo's 100 Resonance.

**His path.**

- **Tier I:**
  - **Marcato:** heroes who answer one of your orders (Focus, Rally, Hold or Scatter) deal 10% more damage for 4 seconds. It comes again 8 seconds after it was given.
  - **A Tempo:** a Cue given on the downbeat, within 0.15 seconds either side, costs no Resonance. A strip under your Resonance meter shows the beat.
- **Tier II:**
  - **Reprise:** when a Trio lands, every hero's Solo charges 30%.
  - **Upbeat:** every fight begins with 50 Resonance.
- **Tier III:**
  - **Ensemble:** each different hero you Cue in a row makes your heroes deal 5% more damage, up to 15%, until you Cue one of them again.
  - **Spotlight:** a hero you Cue is Empowered at double strength while their Solo lasts, Thread or not.
- **Tier IV:**
  - **Triad:** while three or more heroes stand in your field, your Resonance never fades.
  - **Maestro:** Grand Finale needs only 75 Resonance, and it plays every hero's turn twice, still rising.

**What to look for.**

- **Cueing a Solo and its cost.** Ready heroes show a badge on their frame (*Duet ×1.25* or *Trio ×1.5* when a Cue now would chain). Did the cost on the meter match what you expected?
- **The chain.** After a Cue, a gold arc drains around the Cue strip for 4 seconds, and a gold ribbon runs from the last hero Cued to those who could join. A Duet links two small sigils; a Trio closes a triangle of light over the three. DUET and TRIO are called out. Could you say what a Duet is after one fight?
- **The downbeat (A Tempo).** Four marks under the Resonance meter, with a light running along them. While the light is inside the band around the first mark, the band glows and a hero's badge reads *Free*. A faint ring pulses from the Weaver's feet on each downbeat. Did you notice it, and did you Cue on it on purpose?
- **Orders and Marcato (tier I).** The Calling chip reads *Marcato* when it is ready and *Marcato* with seconds while it is held; a small accent mark sits over each hero who has it.
- **Ensemble and Spotlight.** Gold motes circle the Weaver, one to three, for Ensemble. Spotlight puts a cone of white light on the hero for the length of their Solo.
- **Triad.** A faint gold triangle on the ground between three heroes, and *holding* on the Calling chip, while your Resonance is not fading.
- **The Grand Finale.** A banner, then each hero's turn: a baton stroke from the Weaver to the hero, a callout building up as *Kael ×1 · Lyra ×1.2 · Vexis ×1.44*, and pips on the Weaver bar (six with Maestro) that light as they are played. On the party frames each hero shows their place in the queue, *waits* or *lost*. A hero who is down, possessed or stilled when their turn comes loses it, and a *can't play* callout says so. When it ends, *Every Solo is full*.
- **The Result and the Summary** count his work: Duets, Trios, the Grand Finale's Solos and free Cues.
- **In Movement III and the Finale.** A possessed hero cannot take a Cue, and the Silent Conductor's stilled heroes lose Finale turns. A Grand Finale cast while the Grand Silence stills the party plays no Solo for its Resonance. Did a Finale ever fail you that way?

**Playing with the sound off.** Everything above has a shape as well as a sound: the beat strip's light and band, the chain arc and ribbon, the DUET and TRIO call-outs and their sigils and triangle, the *Free* badge, and the Finale's turn chips and pips. With reduced motion the beat light steps from mark to mark instead of sliding, and stands on the downbeat mark exactly while the window is open. Settings has a **Captions** switch (off by default) that also writes the key sounds as words.

**What we know is off.**

- Only bots have played him. In their runs the Grand Finale is so strong that fights with the Conductor end much sooner than with no Calling: the Silent Conductor, for one, falls about 65 to 120 seconds sooner. It may feel too strong, and tell us if it does.
- On the Triad path the Finale costs 100 Resonance, which is seldom reached in the short early fights; the Maestro path casts it far more often. If Triad feels like a Calling with no Finale, that is this.
- Marcato needs orders to answer. The bots could not use it well in the Prelude, so we know least about how it plays.

**Please tell us:**

- After one fight, could you say what a Duet is? A Trio?
- Did you notice the downbeat? Did the strip's light make sense, and did you Cue on it?
- Did a Cue ever feel too expensive, or too cheap to think about?
- Did the Finale's order make sense (who played first, who waited, who was lost)? Did the rising numbers tell you anything?
- Which tier option did you pick, and why? Which did you wish you could have kept?
- With the assist on, did heroes fire their Solos before you could chain them?

### Phase 5g: the content fill

The Expedition's pools are much larger: **63 new motifs** (30 common, 22 rare and 11 epic, ten of the epics being **Harmonies**), **18 new relics**, **2 new boons** (one boost, one drawback) and **6 new events**.

**On Expeditions only.** The Prelude run is unchanged: it offers the same motifs, relics and events as before. Every new motif and relic is offered only on an Expedition, and the new events sit in Movements II and III.

**How to see them quickly.**

- **The Codex** lists every new entry. Each carries an *Expeditions only* chip, and a Harmony also reads *Harmony · needs* followed by the two things it needs.
- **Harmonies need two motifs you already hold** (and, for some, a hero or a song). On a draft or merchant card, a Harmony lists its prerequisites under *Needs*, each marked *owned* or *missing*. A prerequisite's own card names the Harmony it leads to ("Harmony → Woven Aegis, with Warded Weft") and says *you have the rest* when only that one is missing.

**Some of what is new.** Ten of the 63 motifs are Harmonies. The rest are in five groups: the Thread (Silk), Wards, Chimes, Reels and Glides (Aegis), the field (Choir), the heroes (Bond, two for each of the six) and Resonance, Cues and the Crescendo (Finale). A sample:

- **Razor Silk** (rare): enemies touching your Thread take damage every second, so where you string it matters. 30 / 50 / 70 a second.
- **Thread the Needle** (epic, one level): move the Thread onto a hero in the 0.35 seconds before a telegraph strikes them and it negates half the hit and gives Resonance. It is not a Perfect Ward.
- **Shatterglass** (rare): when a Ward breaks, shards strike the three nearest enemies for 100 / 150 / 200 damage each. It pays on a Ward that was used up, not on a Perfect Ward.
- **Breath Between** (rare): after 4 seconds without casting a technique, your next costs 30 / 45 / 60% less Spirit. It rewards pacing your casts.
- **Iron Answer** (Kael, common): each Ward you cast on Kael brings his Challenge 2 / 3 / 4 seconds closer. The other Bond motifs are Penitent Shield (Kael), Split Fletching and Steady Draw (Lyra), Constellation Lines and Inner Orbit (Vexis), Bloodsong and Edge of the Red (Brann), Cold Steel and Second Intention (Seren), and Graft and Seed Vault (Oro). Each is offered only when its hero is in your party.
- **Opening Bars** (rare, a Finale motif): your first Cue in each fight costs 10 / 15 / 25 less Resonance.
- **Concert Pitch** (Harmony, needs Steady Hands and Thread the Needle): a Perfect Ward rings out, and every hero deals 15% more damage for 4 seconds.
- **Tempo Rubato** (Harmony, needs Canon and Opening Bars): one Cue in every three costs no Resonance.
- **Everbell** (legendary relic): your Chime holds two charges.
- **Water Clock** (legendary relic): once a fight, when a hero goes down, time turns back for them. They stand again with the life and the place they had 3 seconds before.
- **Iron Mask** (cursed relic): your heroes take 12% less damage, but your Thread can't Empower.

**The six new events.**

- **Movement II:**
  - **Hero's Doubt:** a hero stops on the stair. Hear them out (everyone heals 20%, and your heroes deal 10% more damage for 2 fights), press on (40 Aether, but your heroes deal 10% less damage next fight) or say nothing.
  - **The Quartermaster:** a Legion cart. Pay 70 Aether for a rare relic, or 140 for a legendary one; or walk on.
  - **The Bleeding Bell:** toll for the fallen (everyone heals 20%), ring it yourself (50%: a legendary relic; otherwise everyone loses 25% of their life) or pass by.
- **Movement III:**
  - **Lost Weaver's Echo:** a Weaver in a cracked mirror. Face your echo (a fight in the Mirror Hall; win and choose one of two relics), listen to it (a motif of your choice gains a level; everyone loses 10% of their life) or look away.
  - **The Unravelled Tapestry:** reweave it (50 Aether: a motif of your choice gains a level), pull a thread (lose a motif of your choice, gain a legendary relic) or leave it.
  - **The Stopped Clock:** wind it (your heroes start the next 2 fights with their Solos charged), take its spring (everyone loses 15% of their life; gain a rare relic) or leave it.

**Six builds to try.** The fill was designed around these. They are suggestions, not rules: draft toward one and see whether it holds together.

- **Choir Sovereign** (the Luminary, with Kael, Lyra and Vexis): hold the party in a planted field and let the songs carry them, with few active saves. Try Massed Voices, Close Harmony, Full Chord, Breath Between, Long Phrase and the Closed Circle Harmony.
- **Perfect Pitch** (the Chronomancer): every well-timed Ward detonates, refunds and rings. Try Steady Hands, Thread the Needle, Shatterglass and Concert Pitch.
- **Bleeding Saint** (the Martyr): soak at low Life and turn your wounds into their healing. Try Kindred Wound, Last Bastion, Vigil Song, Saving Grace and the Wounded Healer Harmony.
- **Razor Loom** (no Calling): the Thread as a weapon; string it through packs and snap it on purpose. Try Razor Silk, Whiplash, Slack Line, Quickening Thread, Constellation Lines and the Cutting Chorus Harmony.
- **Maestro** (the Conductor, with A Tempo, Reprise, Ensemble and Maestro): Cue after Cue, with Solos every few seconds. Try Call and Response, Opening Bars, Answering Phrase, Footlights, Tenuto, Tuning Up and the Tempo Rubato and Grand Staff Harmonies.
- **Red Line** (no Calling, with Kael, Brann and Seren): keep Brann in the red behind barriers while Seren parries off your Wards. Try Blood Tithe, Edge of the Red, Bloodsong, Second Intention, Cold Steel, Shieldsong, Bright Peal and the Crossed Steel Harmony.

**What to look for in a fight.**

- **Trigger chips.** When a motif or relic of yours fires, a chip counts up on the HUD with its name, newest first, at most three, and each is gone about two seconds after its last fire. The chips do not show which hero it landed on.
- **On the Result and the Summary,** a line says how often each fired ("Clean Strike triggered 3 times", "triggered once" or "never triggered"), and the Summary has a panel, *Your motifs and relics at work*.
- **Once-a-fight relics.** *Spare Strings* (the first time your Thread snaps at range in a fight, it does not lock, so you can thread again at once) and *Water Clock* show a tile on the relic bar that is ready, then used.
- **Concert Pitch's Ringing.** While it rings, gold streaks rise on each standing hero, a handbell sounds, and a chip with the seconds left sits at the head of the chip row.
- **Thread the Needle.** The Thread loops once round the hero's chest and knots in a glint. It is not the flash of a Perfect Ward.
- **Razor Silk.** A glint where your Thread crosses each enemy it is cutting.
- **Water Clock.** A clock face over the hero who stood again, its hand running backward, and the relic's name called out.

**Playing with the sound off.** Every trigger has a look: a barrier gathers into a shield before the hero, a heal is teal motes rising, Resonance is stars falling into the Weaver's hand, Spirit is a thread reeled to her hand, a Solo charge is stars stepping up the body, damage is a burst, a stun or sleep is a pin over the head, and a cooldown is a timer over the head. Ringing has its streaks, handbell and chip; Spare Strings a coil of thread unwinding from the Weaver's hand; Water Clock its clock face. None draws a ring on the ground, so none should be mistaken for an aura. The chips and the Result lines say the same in words. The new sounds have not been judged by ear yet, so please tell us if any is too loud or too much.

**What we know is off.** The new entries have been tuned with bots only, not people.

- **Some entries fire rarely.** Sixteen of the 35 entries that fire on an event did so in fewer than half the fights the bots held them in, because their events are rare: a hero going down or being revived, a Crescendo, a Ward that was used up rather than a Perfect one. Lament Pin, Lament's Answer, Pilgrim's Lamp, Black Ribbon, Shatterglass and Ringing On are examples.
- **Some do nothing in places.** Clutch Peal and Second Toll need a Clutch Cleanse, which only exists against a Dirge, so they do nothing in Movements II and III except at the Silent Conductor. Taking Bows does nothing after the Conductor's Grand Finale, which fills the Solos first. Ringing Steel does nothing against bosses.
- **A whole build rarely comes together.** The pool is large (84 motifs, and 11 Harmonies), a run drafts only some thirteen or fifteen times, and the bots held three or more of a build's entries in most runs for only one of the six builds (Perfect Pitch). Expect to meet a few pieces of a build, not all of it.
- **Red Line is not viable yet.** In the bots' runs the party it is built on (Kael, Brann and Seren, no Calling) wins none of its Expeditions, and this slice did not change that. If it does win for you, we want to hear how.
- **Perfect Pitch and Maestro are strong,** well ahead of the other builds in the bots' runs, because the Chronomancer and the Conductor carry them.
- **Two Harmonies lean on a song.** Cutting Chorus needs Fortissimo and Spindle Lullaby needs Lullaby among your songs, as well as Razor Silk. The bots could not aim the Thread across enemies, so Razor Silk, Constellation Lines and Cutting Chorus are the least tested, and Spindle Lullaby was not measured at all.

**Please tell us:**

- Did you notice when a motif or relic fired? Could you tell which one?
- Did a Harmony's *Needs* list change what you drafted or bought?
- Did you ever hold a Harmony? How did you get there?
- Did any new relic change how you played? Did you take a cursed one, and was it worth it?
- Which new entry did you never understand?
- Did you try one of the six builds? Did it come together, and how many of its pieces did you see?
- Did any of the six new events leave you wishing for a different choice, or one you could not read?
- Did the Prelude feel the same as before?

## Version 14: mastery, the endgame

*For testers.* Version 14 is Phase 6 ([docs/phase-6.md](phase-6.md)): the reasons to play after the first Finale clear. It holds four things, which can be tried together or apart: **three new Dissonance levels** (Tyrant, Mimicry and True Dissonance), **the Atlas of Echoes** (nine remixed runs with stars to light), **This Week's Song** (one run, the same for everyone that week, with share codes and replays that your own device checks), and **fourteen new Deeds**. Only bots have played any of it so far; **What we know is off**, further down, says what that means.

The numbers below are the ones in the game and the tuning's last readings. Where the first build and the tuning differ (the Postlude's life, the weekly entries, Tyrant's pacing), the tuned value is the one given.

### How to reach it

Everything here hangs on Dissonance: **the Atlas of Echoes lights when Dissonance opens**, and Dissonance opens with your first Finale clear at Weaver Rank 15 or above (a clear first and the Rank later works too). As the demo ships, **neither start has it open**:

- **Veteran start:** Rank 12, no Finale clear. In the Loom, *Dissonance* and *The Atlas of Echoes* are both dark and say "Opens with Dissonance" (and the Codex's *Dissonance* and *Atlas of Echoes* tabs read locked). A veteran needs 4,200 more XP to reach Rank 15, and a Finale clear.
- **Fresh start:** the same, from Rank 1, with every station dark.
- **The way in: Settings → Progress → *Skip the unlocks*.** Settings is in the Loom's top bar (and in the pause menu); the switch is in the Progress card. It lights both stations at once, with every level, Calling, variant and hero, on either start. Each newly lit station plays its first-contact cards on your first visit; the Atlas's three cards are *Old songs, played strangely*, *Constellations* and *This Week's Song*.
- **Or earn it:** clear the Finale (Expedition, Prep's Route switch) at Rank 15 or above. Dissonance opens (with a card at the Summary), and the Atlas with it.

With Skip on, find the new things here:

- **The Atlas of Echoes:** a Loom station (mint), on the right of the Loom under Dissonance. It holds the star chart, the Echoes and *This Week's Song*.
- **The three new levels:** Prep, in the Dissonance section, after Discordant Pact. Prep's total now reads *out of 42*.
- **The new Deeds:** the Hall of Deeds, once the thing they are about is in sight (table below). The Hall reads 2 of 22 as the veteran ships and 2 of 32 with Skip on.
- **Beginning an Echo or the weekly:** from the Atlas; both go to a Prep of their own. A run already in progress blocks them ("A run is saved: continue or end it at the Gate first").

### The three new Dissonance levels

Each is listed in Prep with its text and points; the most you can reach is now **42** (it was 30). Each point pays +3% Weaver XP and +4% Tuning Shards; at 42, +126% and +168%. Relic depth and Tears are as before (from 10 and 20 points).

- **Tyrant (4 points).** *Bosses and mini-bosses take up one more attack in each phase, borrowed from the foes of their road.* The boss's first borrowed cast comes 6 seconds into the phase, then at 150% of that attack's own cooldown, so it comes less often than the foe's own did. A decree names it, then what answers it: "Tyrant — the Bellwarden takes up the Glass Lancer's Lance. Ward it, Reel the target, or step aside." The borrowed attacks are:

  | Boss | Phase 1 | Phase 2 | Phase 3 |
  |---|---|---|---|
  | The Bellwarden | Glass Lancer's Lance | Lamenter's Dirge | |
  | The Hollow Cantor | Bell Brute's Toll Cleave | Glass Lancer's Lance | Cantor Acolyte's Mending Hymn (Focus it) |
  | The Gorehound Matriarch | Impaler's Charge | Leech's Latch | |
  | Vharun | Impaler's Charge | Impaler's Charge | Lamenter's Dirge |
  | The Seamstress | Impaler's Charge | Doubt Wraith's Doubt | |
  | The Unweaver | Null Priest's Rune | Void Maw's Inhale | Doubt Wraith's Doubt |
  | The Silent Conductor | its own Sforzando, more often | its own Downbeat, more often | none in the Grand Silence |

  None of them cuts your Thread or touches an aura, by rule. The Silent Conductor borrows nothing: it plays its own two closing attacks more often (the bots measured about one cast every 6 to 7 seconds of each), and in the last burn and the Postlude its Downbeat comes every 7 seconds and its Sforzando every 9.
- **Mimicry (3 points).** *In each wave, 1 enemy that isn't a boss or a mini-boss carries Mimicking: it copies your Empower, Ward or Chime.* The marked enemy is the first of the wave's group with the most life per enemy. Boss and mini-boss waves (7 of the 78 waves) have none. It is the Rift's mirror, so it has the mirror gem and the cast bar showing the icon it will copy, and casting something else cracks the mirror.
- **True Dissonance (5 points, Expeditions only).** *The Silent Conductor rises from its fall with 60% of its life and plays a fourth phase, the Postlude.* When the blow that would kill the Conductor lands, it stands up once instead: three seconds untouchable (hits and statuses pass through, and your heroes pick another target), then at 60% of its life, with its live telegraphs dropped and any pending Fortissimo Silence cancelled. Two choir voices are raised. Then:
  - **Pairs:** every 14 seconds it Cues two voices, the second 1.5 seconds after the first, so there are never more than two damaging telegraphs at once.
  - **Discord** swells at 1.5 a second; at 100 comes Fortissimo Silence, and any Crescendo cancels it, whatever your Calling. Its closing attacks go on.
  - **After 90 seconds:** Cues every 10 seconds, and Discord twice as fast. The phase ends only when the Conductor falls a second time (an ordinary death).
  - The boss bar gets a fourth pip, there is a rise countdown, and the decree reads "Postlude — The Conductor will not let the song end, and its choir sings in pairs. Answer both voices, and silence its Fortissimo with your Crescendo."
  - The Finale fight's par is 40% longer on this level, so the time part of its grade is read against the longer clock.
  - **Where it plays:** only on a route with the Finale. On a Prelude, Prep says *Expeditions only: a Prelude has no Finale*, the row shows +0 and adds no points. Echoes drop it too, except The Last Rehearsal.

**The tiers the bots were read at.** Prep has no presets for these; they are sets of levels the bots were measured with, and good ones to try:

| Tier | Points | Levels |
|---|---|---|
| 0 | 0 | none |
| I | 10 | Hardened ×2, Wounding Strikes ×2 |
| II | 20 | Tier I, Restless Dead, Elite Vanguard |
| III | 30 | Tier II, Tyrant, Mimicry, Short Fuse ×2, Brisk Foes |
| IV | 42 | every level at its top rank |

### The Atlas of Echoes

*Old songs played strangely: roads you know, with foes, bosses or rules you don't.* The chart draws nine Echoes in three constellations of three, each a star with three points of light. Pick one and its card shows its road, its twists and its three stars; **Begin** goes to its Prep, where the Echo's fixed parts show locked, what it switches off is listed (*Off in this Echo*), and the rest is yours. Then Embark. Its map reads, for example, "Retrograde · leg 1 of 3 · step 1 of 3".

| Constellation | Echo | What it is |
|---|---|---|
| **Borrowed Crowns** (all nine stars: the robe *Crownless*) | Choir of Blood | The Reliquary Road (Movement I's road) at the Crimson Ascent's strength, with the Gorehound Matriarch and Vharun at its end. |
| | Bells in the Rift | The Unravelling Descent (Movement III's road), but the Bellwarden and the Hollow Cantor wait at its end, grown to its strength. |
| | The Seamstress's Court | The Crimson Ascent at the Descent's strength with no Respite, the Seamstress and the Unweaver at its end. |
| **Strange Roads** (the Thread look *Wayward*) | Retrograde | The Expedition backwards, in three legs with no Respite: the Descent, the Ascent, then the Reliquary Road, ending at the Hollow Cantor. |
| | The Last Rehearsal | Nothing but bosses: the Hollow Cantor, Vharun, the Unweaver and the Silent Conductor, with a Respite and a Merchant after each. The only Echo with the Finale, so the only one where True Dissonance plays. |
| | The Gilded Road | The Crimson Ascent with every fight an elite, ending at Vharun. |
| **Hard Bargains** (the title *Hard Bargainer*) | A Cappella | The Reliquary Road and the Crimson Ascent to Vharun with no Calling, no Astrolabe and no carried relics. |
| | Strangers | The same two roads, shortened, ending at Vharun; your party is Brann, Seren and Oro, whoever you have recruited. |
| | The Unrested | The same road at the Descent's strength; Restless Dead and Unforgiving are always on, and add no points. |

- **Stars.** ★ for clearing it (40 Tuning Shards). ★★ for clearing it at 10 Dissonance or more (60 Shards). ★★★ at 20 or more (40 Shards and 1 Discord Tear). Dissonance counts from the levels you choose in Prep; an Echo's own forced levels count for nothing. A higher star lights the lower ones, and each star pays once, the first time it lights.
- **Keepsakes.** All nine stars of a constellation earn its keepsake (above). All 27 earn the title *Atlas-Walker*. They are never sold: the Atelier hides an unearned one and shows an earned one with no price.
- **An Echo is an ordinary run** in every way but its route and twists: a new seed each attempt, the Expedition's motifs, relics, boons and events (including Version 13's), and your Calling's four picks along the road (every Echo but A Cappella; on some one fight brings two in a row). It pays XP, Starlight, Aether, Shards and Tears as any run, and a clear may enshrine a relic. It sets **no Dissonance best** and earns **no run-wide Deed** (it counts for Deeds about one fight).
- **Its Summary** has an Atlas card: the stars it lit and what they paid. An Echo's replay is kept in memory until you leave; **Keep** stores it on this device and **Save the file** writes a `.awrun` file.
- **How long.** By the bots' clock at ★: Bells in the Rift 14 minutes, The Gilded Road 16, The Seamstress's Court 16, Choir of Blood 17.5, Strangers 20, A Cappella 20, Retrograde 21.5, The Unrested 22, The Last Rehearsal 23.5. A ★★★ clear runs longer (19 to 33 minutes), since its fights are longer.

### This Week's Song

One run, the same for everyone this week. It lives in the Atlas station, under the chart: the week, the days left, its entry ("Strangers: The Conductor, with Brann, Seren and Oro, at 8 Dissonance"), your best score, **Begin**, **Share**, **Add a code**, **Open a replay**, and a board of this week's results.

- **The week** runs Monday 00:00 UTC to the next Monday, read from your **device's clock**. Week 44 began Monday 9 November 2026. The entry is one of a **rotation of twelve**, in a fixed order that repeats, with a new seed each week. Week 44 is *Strangers* (Conductor; Brann, Seren, Oro; Hardened ×2 and Short Fuse ×2, 8 points). Next: week 45, an Expedition (Conductor; Kael, Lyra, Vexis; Hardened and True Dissonance, 8 points); week 46, Choir of Blood (Martyr; Kael, Lyra, Seren; Unforgiving, 1 point); week 47, Retrograde (Luminary; Kael, Lyra, Vexis; Blind Score, 2 points). Then the cycle starts again.
- **What is fixed, and what is yours.** Fixed: the seed, the route, the Calling (every tier of its path open; the picks are yours, in the run), the three heroes and the Dissonance levels. Prep shows them locked, under *Everyone plays this*. Yours: your Chords and technique variants, from every aura, ornament and variant. There is no Astrolabe, no carried relics and no Bond talents.
- **The score.** 1,000 for a won run; 100 for each fight won (200 for a mini-boss, 300 for a boss); plus, for each fight won, by its grade: S 50, A 35, B 20, C 10, D 0. A tie goes to the run with less total fighting time. The board orders by score, then time; it keeps the last 12 weeks and 30 entries a week.
- **Share codes.** A result is a code of 38 characters: `AW1-`, then 28 letters and digits in seven groups of four. It holds the week, the build, the score, the fights won and the time, and a fingerprint of the run, but no name (the person adding it names it). A typed I or L is read as 1 and O as 0, and spaces and dashes are ignored. Its check bits catch any one wrong character and any two swapped neighbours. **Add a code** takes a code and a name; it answers in words: "This code has a typo: its check letters don't match.", "Not a share code: it starts AW1-.", "This code is for Week N, which hasn't begun." A code is accepted only for the last 12 weeks.
- **Replays.** Weeklies and Echoes are recorded as you play (Preludes and Expeditions are not). A weekly's own replay is kept by itself at the Summary; **Share** is meant to copy the code and a line ("My Week 44 song: 2,665 points, won. AW1-…") and save the file; **Open a replay** reads a `.awrun` file. A bot's whole weekly was about 530 KB of data (81 KB gzipped); a person's is estimated up to about 1 MB.
- **What the board's words mean.** Each result carries one of five marks, each with its own glyph as well as its colour:
  - **Verified:** its replay played through on this device and ended where its code says ("Verified on this device: Week 44, won, 2,165 points, 15 min of fighting.").
  - **Another version:** verified, though it was recorded on another version of the game.
  - **Claimed:** only a code, so its replay has not been checked.
  - **Didn't match:** its replay doesn't play to what its code says, or can't be read, or parts ways partway ("Parts ways at fight 3"). It may have been edited, or recorded in another browser.
  - **Plays back:** not a weekly (an Echo's replay, say). It plays back as it was recorded, but nothing fixes its start, so it is never *Verified*.
- **Checking.** Your own finished weekly is re-checked when it ends, in a background worker, with a progress line ("Verifying · fight 4 of 5"). In our test, a bot's recorded week took under six seconds to verify in the page.

### Deeds and keepsakes

Fourteen new Deeds, all badges: no Astrolabe point, 15 Starlight each. The first eleven are in the Hall of Deeds as soon as Dissonance (or Skip) opens; three wait until you have met what they are about.

| Deed | What it asks | Shows up |
|---|---|---|
| Absolute Pitch | Make 50 Perfect Wards in one run. | from the start |
| Silent Bell | Clear Movement III without cleansing a hero. | once you have reached Movement III |
| Red All the Way | Win an Expedition with Brann, never letting him above 40% life once he falls to it in a fight. | with Brann in your roster, once you have reached Movement II |
| Out of Tune | Clear the Finale at 10 Dissonance or more. | Dissonance open |
| Wolf Interval | The same at 20. | Dissonance open |
| Tritone | The same at 30. | Dissonance open |
| Resolution | Clear the Finale with every Dissonance level. Earns the title *the Resolved*. | Dissonance open |
| Final Bar | Beat the Silent Conductor's Postlude. | Dissonance open, and the Finale met |
| Crownbreaker | Clear the Finale with Tyrant. | Dissonance open |
| Faint Star | Light a star in the Atlas of Echoes. | the Atlas lit |
| Whole Constellation | Light every star of one constellation. | the Atlas lit |
| Every Star | Light every star in the Atlas. | the Atlas lit |
| Same Song | Win This Week's Song. | the Atlas lit |
| Every Week a Song | Win This Week's Song in 4 different weeks. | the Atlas lit |

Echoes and Echo-route weeklies never earn the run-wide ones (Absolute Pitch, Silent Bell, Red All the Way, and the Finale-clear Deeds from Out of Tune to Crownbreaker); the Expedition-route weeklies do. Same Song and Every Week a Song read the weeks you won from your codes, and a changed device clock can earn them (see below).

### What to look for

- **The Loom.** With Skip on, the Atlas station is lit and marked new. Without it, did the dark station say how to open it?
- **The chart.** Stars and lines fill as you light them; each Echo shows three points. The card's three star rows say what each star asks.
- **Prep under an Echo or the weekly.** The twists, the locked parts, and what is off. Could you say what you could change before you embarked?
- **The map and the fight.** An Echo's eyebrow says which leg and step you are on; its Result says which Movement the leg is built over.
- **Tyrant.** At each phase, a decree under the boss bar naming the borrowed attack and its answers. The boss wears a borrowed accent ring (two dashed hoops in the foe's colour) for the phase, and a crown over its head only while it casts the borrowed attack. Did you know the cast was the borrowed one, and what answered it? On the Silent Conductor there is no ring: the crown is in the baton's brass.
- **Mimicry.** The mirror gem on an ordinary enemy, and the Mimic's cast bar showing the icon it will copy.
- **The Postlude.** The fourth pip, the rise countdown, the decree said once, the sky rings relighting from the inside out, the pair's cue line and the two answering voices. The enraged state (after 90 seconds) adds a layer of music and no look of its own.
- **The weekly's panel.** Each status has a word, a glyph and a colour. Did the words tell you what to trust?

**Playing with the sound off.** Everything above has a shape as well as a sound: Tyrant's ring and crown and its decree in words; Mimicry's gem and icon; the Postlude's pip, countdown and decree; the five statuses' glyphs. The Atlas has sounds for each star lit (one, two or three), for a completed constellation, and for a run that verifies and one that doesn't match. Settings has a **Captions** switch (off by default) that also writes key sounds as words.

### What we know is off

- **Only bots have played it.** Every reading below is a bot's. The tuning's best player, the Expert, is the Skilled bot's fight play deciding twice as often and answering calls faster, with a plan for map, drafts and shops, and a **Rank 20** build. A veteran start is Rank 12 and a weekly has no build at all, so expect it to feel harder than these numbers. No person has looked at the new visuals or listened to the new sounds, and reduced motion has not been watched.
- **Tyrant and Mimicry cost far less than their points suggest.** A point is meant to cost about 8% more enemy life. Measured that way (300 runs each): **Tyrant (4 points) cost the Novice bot −4% (it was a little easier), the Skilled bot +11% and the Expert +7%**; **Mimicry (3 points) cost the Novice +1%, the Skilled bot +7% and the Expert +6%**. Both were meant to cost far more (24 to 40% and 16 to 32%). Tyrant is also uneven: with it, the Seamstress and the Matriarch were *easier* for the Novice bot (24 to 29 of 40 wins, and 28 to 33), while the Unweaver was far harder (24 to 12 of 40). The first build made some bosses easier by letting the borrowed attack take the place of their own (the Bellwarden fell from 6 Novice losses in 40 to none); it was changed so it adds to them, and the figures above are after that change. If a Tyrant fight felt easy, or a Mimicry wave never mattered, that is this.
- **The tiers, as the Expert read them** (50 runs on each of three sets, Rank 20 build):

  | Tier | Won | Aimed at | |
  |---|---|---|---|
  | 0 | 98%, 100%, 98% | at least 90% | inside |
  | I (10) | 88%, 84%, 90% | 70 to 90% | inside; two sets on the edge |
  | II (20) | 70%, 80%, 68% | 40 to 70% | **80% is outside**; two on the edge |
  | III (30) | 32%, 26%, 38% | 15 to 40% | inside; one on the edge |
  | IV (42) | 18%, 16%, 14% | 2 to 15%, never 0 | two sets on the edge |

  The Skilled bot, the bot most like a good player, won only 4 to 7 points less than the Expert at Tier I (we aimed for at least 10). The Novice and Idle bots were not run at the tiers.
- **Two Echoes are too easy at the first star.** The Expert won every ★ run of **Retrograde** and **A Cappella** (40 of 40), above the 60 to 95% we aimed for, and four more sit at 95 to 98%. Their ★★★ read 38% and 43%. The Last Rehearsal is a little long (23.5 minutes by the clock, over the 22 we aimed for). ★★ was not read after the Echoes' legs were tuned.
- **The Postlude is short on Conductor runs: about 14 seconds.** The Conductor Calling's Grand Finale ends it. With no Calling, or the Luminary, the Martyr or the Chronomancer, it lasted 75 to 92 seconds on average (68 over all runs; the shortest 12, the longest 182, a Martyr run); the whole fight ran 13 to 93 seconds longer. If True Dissonance on a Conductor run felt like nothing, that is this. The bots won 93% of Finale cells with it on, against 100% without.
- **The weekly rotation was read by bots with no build.** Eleven of twelve entries sit in the band for the Expert (50 to 85%); week 45's (the True Dissonance Expedition) read 90%, **too easy**. Two entries sit on the edge of the Skilled bot's band (the Chronomancer week at 75%, the Conductor week with Restless Dead at 20%), and Bells in the Rift (still an Echo, no longer in the rotation) opens on a first fight no bot won on the weekly's level field.
- **Nothing in a weekly is checked by a server.** There is no server: no global board, nothing signed. Verifying proves that a run follows from its inputs under the game's rules *on this device*. It cannot prove a person played it live: a bot, a slowed-down browser or reloading a fight can all make a valid replay, and the restart count in the file is written by the game and could be changed. **A changed device clock moves you to another week** (the code names its week, so it is harmless, but it can earn Same Song and Every Week a Song). **A hand-made file** is caught where the verifier can catch it (a start that isn't the week's, impossible assists, a fight that doesn't end where it says, a file that is too large or too deeply nested, one that plays on after its end), and not beyond that. **A code alone proves nothing:** it has check letters, not a signature. A replay made in another browser might not verify. A replay from an earlier build is *Another version*, not *Verified*.
- **Not yet checked:** the Share button's file download, Keep and Save the file from a real Summary, a weekly played to its end by a person, and the Tyrant, Mimicry and Postlude looks in a live fight.

### Please tell us

- With the veteran or a fresh start, **how did you find the Atlas?** Did the dark station tell you how to open it, and did you reach it with Skip the unlocks?
- In Prep for an Echo, **could you say what was fixed and what was yours** before you embarked? Did the map's "leg 1 of 3" tell you where you were?
- **Which star was hard?** Which Echo felt too easy at ★, too hard at ★★ or ★★★, or too long? How many minutes did it take?
- **Tyrant:** did the decree tell you what to do before it cost you a hero? Could you tell the borrowed attack from the boss's own (ring, crown)? Did it feel like extra danger, or like a nuisance?
- **Mimicry:** did you notice the marked enemy before it cast? Did it ever change what you did?
- **True Dissonance:** did the rise read as a second fight? Did you know to hold your Crescendo for Fortissimo Silence? Was the Postlude too long or too short?
- **The weekly:** did the locked rows in Prep say what everyone shares? Did you share a code, or add a friend's? Did the five words (Verified, Another version, Claimed, Didn't match, Plays back) tell you what to trust, and how long did a check take you?
- Did you try an Echo or the weekly **with the sound off**? What did you miss?
- Did a **Deed** appear when you expected it? Which new one did you never understand?
- Did anything here make the Prelude or an ordinary Expedition feel different from Version 13?
