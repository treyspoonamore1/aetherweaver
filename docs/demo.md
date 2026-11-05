# The playtest demo

*2026-10-30 · follows [Phase 4h](phase-4h.md); updated 2026-11-03 for [Phase 5a](phase-5a.md), 2026-11-04 for [Phase 5b](phase-5b.md), and 2026-11-05 for [Phase 5c](phase-5c.md)*

A build of the game for playtesters: the Prelude run (Movement I), and since Phase 5a the Expedition, which climbs on past the Hollow Cantor into Movement II (the Crimson Spire and the Crimson Legion), with everything the Loom has opened by then. It's published as a private link (a claude.ai Artifact) that its owner can share. Nothing is collected from players.

## Starting

The first screen asks how to start:
- **Start fresh** is a new Weaver: the real first hours, every station dark until it opens, each with its first-contact intro. This is the build's main test: does each system make sense when it arrives?
- **Veteran** is a Weaver some hours in, so the later systems can be tried at once:
  - Rank 12, with the Astrolabe's points left to spend;
  - Starlight for the Atelier, and one variant (Purge) owned;
  - the Luminary mastered (its title earned, Chorale for sale) and the Martyr on her way;
  - Brann, the Bloodsworn, recruited (Phase 5b), so Prep picks three of four heroes;
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

`dist-demo/index.html` is the page, and its `assets/` (109 files, 4.7 MB) are published beside it as the artifact's own files. The page loads nothing from anywhere else.
- **Where it is:** [Aetherweaver](https://claude.ai/artifact/WQmazTSTrGDW3SpS4CQ9Uv), a private claude.ai artifact (slug `ee2a9adf-b9b9-4612-abe0-a64652bfb45b`). Only its owner sees it until they share it from its page on claude.ai.
- **To update it,** rebuild and republish the folder to the same artifact (its slug and current version), so the link stays the same.
- **Checked before publishing:** the build was served under a content policy like the host's (its own files only, no eval), and both starts were clicked through. Fresh and veteran, the Title, the Loom with its welcome, Prep: no console errors, page errors or failed requests. For the Thread dial's update, a fresh start went on into the Training Grounds, and the dial turned from Mend to Empower on a right-click, again with no errors. For Movement II (version 1793691876-2760), the Veteran start went on to Prep, which opened on the Expedition route ("The Expedition · Movements I-II"), again with no errors; the e2e suite's Expedition smoke plays past the Cantor to Vharun and the Summary. For Phase 5b (version 1793773158-83ac), both starts were clicked through again with no errors, and the e2e roster smoke recruits Brann, picks him in Prep and plays a fight beside him.

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

The published link above has Movement III only once it is rebuilt and republished from this branch (`npm run build:demo`, then *Publishing* above).

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
