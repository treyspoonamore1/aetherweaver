# Hero autonomy

*2026-11-03 · plan: [02 §Solos](plan/02-game-design.md) · follows [health at a glance](health-ui.md)*

From playtesting: "If you turn on hero autonomy, do they actually cast their Solos? I feel like the tank doesn't." He often didn't, and in the Training Grounds nobody did.

## What was wrong

- **The Training Grounds ignored the assists.** Their fight was built without the player's assists, so Hero autonomy, the wider Perfect window and the slower telegraphs were all off there, whatever Settings said. Run fights were fine.
- **Kael sat on a full Solo.** With autonomy on, Lyra and Vexis fired as soon as they charged. Kael fired only under half his life or with a big telegraphed hit coming at him, so a Weaver who kept him healthy kept him from ever using it. His frame said READY the whole time.
- **What it said didn't match.** The setting said "Heroes fire their own Solos when charged", with no word about Kael.
- **His uncued wall was easy to miss.** Fired on his own, Aegis Wall is a shield on himself, not the dome a Cue raises, and nothing named it.
- **Autonomy beat the player's Cue.** Lyra and Vexis fired on the tick they charged, so with autonomy on a Cue (the stronger form) almost never landed.

Measured headless before the fix: 6 encounters × 8 seeds, the bot never Cueing, as an autonomy player plays.

| Bot | Kael fired | Kael waiting at full |
|---|---|---|
| Skilled | 69% of charge-ups | 9.3 s a fight |
| Novice | 84% | 4.4 s |

## What changed

- **A Cue window.** A charged Solo waits 1 s for the player's Cue, then the hero fires it (`AUTONOMY.cueGrace`, src/sim/constants.ts).
- **Kael holds at most 3 s.** Hurt (under half his life) or with a big hit coming, he raises his wall at once. Otherwise he waits for one, but never more than 3 s while he has someone to fight (`AUTONOMY.kaelHold`).
- **No one to fight, no Solo.** The wait only counts with a target, and starts over after any gap: between waves, downed, stunned or Reeled (`soloHeld`, src/sim/systems/heroes.ts).
- **The Training Grounds use your assists.** A change made from the pause menu restarts them as the fight resumes, as a loadout change does. Under the wider Perfect window the Ward trainer's streaks still count, but no best is kept ("assisted · not kept").
- **Said plainly:**
  - The setting now says "Heroes fire their own Solos a moment after they charge, unless you Cue them first. Kael saves his wall for a big hit, but never for more than 3 seconds."
  - The pause menu says when an assist change applies: from the next fight in a run; on resume in the Training Grounds.
  - A ready Solo shows **AUTO** instead of READY on its frame while there's someone to fight, and the coach's hint says it will fire on its own.
  - A Solo a hero fires on their own is named as it goes up ("Kael: Aegis Wall").

With autonomy off nothing changed: every event of 72 real fights and of the golden scenarios is identical.

## After

The same measurement:

| Bot | Kael fired | Kael waiting at full | Lyra, Vexis fired | Win rate |
|---|---|---|---|---|
| Skilled | 89% | 3.3 s a fight | 99% | 96% → 100% |
| Novice | 90% | 2.1 s | 97–99% | 85% → 90% |

The Solos left unfired charged in a fight's last seconds.

An independent review found four more problems, all fixed: the wait carried over a gap between waves, AUTO showed with no one to fight, the callout could name the wrong Solo, and assisted drill streaks would have been kept as bests.

## Checks

- **tests/sim/autonomy.test.ts:**
  - Lyra and Vexis fire 1 s after charging, Kael 3 s.
  - Hurt, Kael fires at once.
  - A Cue in the window gives the stronger form.
  - With no one to fight, nothing fires; after a gap, the next enemy gets the full wait.
  - With autonomy off, nobody healthy fires on their own.
- **Goldens:** updated for SIM_VERSION 22. The hashes changed because hero state gained a field; the events are the same.
