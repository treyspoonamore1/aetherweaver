## Version 21: heroes fire their own Solos

*For testers.* One change since Version 20, and **it changes every fight**: your heroes now fire their own Solos, and there is no Cue key. What is left to you is where the Thread is. The whole rule is in [docs/solos.md](solos.md).

**Every Solo number in this version comes from bots.** The timings, the Resonance and the win rates were tuned by bots and by a scripted stand-in for a person's hands. Nobody has played it yet. You are the first.

What the bots measured, in boss and mini-boss fights: the Skilled bot wins 97% (96% before). The Novice bot wins 67% (46% before), mostly because her heroes now use their Solos. A bot that never moves the Thread for a Solo still wins 92%. The one fight where following a Solo clearly matters is the Seamstress, in Movement III: 65% for a bot that never follows, 95% for the Skilled bot.

**How a Solo works now.**

- **A hero fires their Solo on their own,** 1 second after it is full, if there is someone to fight.
- **Your Thread is the Cue.** If your Thread is on that hero as the Solo fires, it is *Cued*: the stronger form. If not, it fires plain. A Cue costs nothing.
- **One at a time.** Two heroes never start a Solo within a second of each other. Three that come due together fire a second apart.
- **Kael judges his own wall.** He raises Aegis Wall at once when he is hurt or a big hit is coming at him. With his wall full and your Thread on him, he raises it when a hit is about to land on two or more of the party. Cued, it is a dome over everyone.
- **A hero finishes what they are casting first,** then fires the Solo.
- **No plain Solo roots its hero.** Lyra can move during Gale Barrage, and Vexis during a plain Starfall. Only a Cued Starfall still holds Vexis in place.
- **Oro fires his Solo** whenever the party is fighting. Before, it waited for one of his Saplings to fight.

**What you see and hear.**

- **On a hero's frame,** a strip appears as their Solo comes. Quiet while it charges, with the seconds. Gold and "Thread to Cue" once it is full. "Cued" and a filled strip once your Thread is on them.
- **Over the hero,** a ring fills until the Solo fires. Dashed while your Thread is elsewhere, solid with rays when it is on them.
- **A soft tick** on the hero's note when the one-second wait begins.
- **The call-out** says "Cued · Lyra: Gale Barrage" or just "Lyra: Gale Barrage".
- **The Result and the Summary** count every Solo: "7 of 9 Solos Cued".

**Resonance buys the Crescendo, and nothing else.** The meter is twice as deep: 200, in four segments of 50. Every gain is the number it was, so a full song comes about once a boss fight. Anything that starts you with Resonance doubled with it (the Cantor's Hymnal, Upbeat, Deep Well, Da Capo, Prompt Book).

**The Conductor.** A Duet is two Solos Cued within 4 seconds, a Trio three: follow each Solo with the Thread as it fires. The Duet or Trio badge on a frame is outlined until your Thread is there, then filled. A Tempo, Opening Bars and Tempo Rubato now give Resonance for a Cued Solo, since a Cue has no price to cut. The Maestro Deed asks for 75 Cued Solos in one run.

**A relic and a Dissonance level.** The Hollow Crown relic plays every Solo in its Cued form, wherever your Thread is. The Silent Cues level counts a Solo as Cued only if your Thread was on the hero for half a second.

**Controls.** `T` and the gamepad's right bumper do nothing now. Bind them to something else if you like. A hero's number threads that hero, with or without a key held. *Hero autonomy* is gone from Settings and Prep. **Auto-Thread** (still an assist, still off unless you turn it on) now moves the Thread to each Solo when you leave the Thread alone for 2 seconds, then back.

**What carries over.** Your settings, saves and profile all load. A run in progress continues. Settings lose three things: the Cue key, the Cue modifier and the *Hero autonomy* switch. A key you had given to something else stays yours.

**Old replays will not play back.** Their fights were played by the old Solo rules, so this version cannot replay them. The game says so in one sentence. An old run in the Atlas shows as *Claimed*.

### What we know is off

- **Nobody has played it.** Every number above comes from bots and a scripted stand-in for hands. Whether a person sees a Solo coming in time is not known.
- **Vexis's Solo can wait on her casts.** A hero finishes what they are casting before their Solo, and Vexis casts almost without pause. In about 4 Solos of 10 hers fires about a second after its wait, so her strip can say "Thread to Cue" for two seconds or more. It is kept this way for now.
- **A hero near the bottom of the screen is hidden by your own bar.** In the play-through, Vexis often stood behind the Weaver's panel and the Mend dial while her Solo came and fired, so her ring and her Starfall were mostly covered. Her party frame still shows it.
- **Call-outs are short and out of the way.** "Vexis: Starfall" shows for a second or so in the column under the key list, at the top right. It is easy to miss in a busy fight.
- **Auto-Thread stays on a hurt hero.** It will not leave a hero under 60% of their life. In a first fight with the hands off, it sat on Kael, and Lyra's and Vexis's Solos fired plain.
- **A first fight with no healing.** With the Thread left on Kael and nothing else pressed, Kael went down in both fights of the play-through, inside the first half-minute. The fights were still won. It was like this before.
- **Damage numbers pile up** over a hero or enemy hit by many Solo hits at once, and become hard to read.
- **The first-fight primer's row is titled "Cue their Solos"**, although no key Cues a Solo now.
- **The sound has not been listened to** on speakers or in a busy boss fight.
- Everything under Version 20's *What we know is off* still holds; in particular, no one has seen any of this on a real graphics card.

### What we'd like to hear

- Did you notice a Solo coming in time to move the Thread? Was it the frame's strip, the ring over the hero or the sound that told you?
- Did you ever want a key to fire a Solo yourself?
- Did a Solo ever fire at a bad moment, or not fire when you expected it?
- With Auto-Thread on, did the Thread moving on its own help, or get in the way?
- Playing the Conductor: could you make Duets and Trios on purpose?
- Did a full Crescendo come often enough to matter?
