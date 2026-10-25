# Audio: Phase 3b additions

Everything is still synthesised, D dorian, all in `src/audio`. Earlier notes: `docs/phase-2/audio.md`, `docs/phase-3/audio.md`. The design is in [docs/phase-3b.md](../phase-3b.md).

Phase 3b adds ten UI sounds (merchants, forges, events, relic offers, the result screen's Aether), a combat sound for each relic that visibly acts, and a dull thud for a Glide refused under Heavy Score. The temporary `STAND_INS` map in `ui.ts` is gone: every `UiSound` has its own recipe.

## UI sounds (`playUi`)

All on the UI bus, so the music ducker never touches them. Group `ui:<name>` (3 voices); peaks stay well under `reward` and `rankUp`.

| Id | What it is for | How it is built |
|---|---|---|
| `buy` | A purchase at a merchant. | About 0.8 s. Two coin clinks (glass D6 then A6, each with a highpassed tick), then a D5 pluck with A5 on top and a small bell. Bright and settled. |
| `cantAfford` | Not enough Aether. A gentle refusal. | About 0.4 s. Two soft, dark plucks falling A4 to F4 (low `bright`, no overtones) and a faint low thump. Round, not a buzz: the stand-in was the saw `error`. |
| `forge` | A forge service used. | About 1.7 s. A hammer on an anvil (new `anvil` in `synth.ts`: a free-bar set of inharmonic partials 1 / 2.76 / 5.4 / 8.93 that ring and fade at different rates, a click and a body thump), a lighter rebound 0.17 s later, a hiss of quenching steam and a warm low D. |
| `eventOpen` | An event's scene opens. Mysterious, a little uneasy. | About 2 s, quiet. A D3 and the E above it rubbing against each other (a detuned second), a breath that opens and closes on a narrow band, a distant low bell and a glass B5 a touch flat. Nothing resolves. |
| `gambleWin` | The Shrine of Discord's bell rings true. | About 2 s. A clean handbell A5 then D6 a beat later, a glass A6 bloom, a pluck E6 and a rising breath. |
| `gambleLose` | The bell cracks. | About 1.1 s. The same A5 strike, then its pitch sags 18% while a second sine 38 cents away beats against it, four rattles of band-passed noise and a dull low thud when it gives up. It begins like `gambleWin`, so the two read as the same bell. |
| `relicReveal` | Relic cards revealed on an offer. | About 1 s. A rising run of three glass notes (A5 D6 F6), a soft D-A-D choir swell, a breath opening upwards and a small bell. Shorter and warmer than the result screen's `reveal`. Rate gate 0.12 s. |
| `relicPick` | A relic taken. Weightier than `pick`. | About 1.4 s. A low D thump, a short Dm choir (D A D F), a handbell and pluck on D5 and a glass A6. |
| `curseLifted` | A curse cleansed at a forge. Release, brightening. | About 1.7 s. A dark tone gliding up, a breath opening from dull to airy (350 to 5200 Hz), then the choir opening onto a bright G6 chord (G B D E), a rising pluck-and-glass run and a bell on D6. |
| `aether` | Aether counted in on the result screen. | About 0.35 s. Five tiny glass notes rising D6 to B6 (each slightly louder) and a pluck. Rate gate 0.05 s, so a fast count-up never piles up. |

`UI_SOUND_NAMES` (exported from `ui.ts`) lists every `UiSound`. It is typed with `satisfies Record<UiSound, 0>`, so adding a name to `types.ts` without a name here fails the build, and the tests then check it has its own `case` and voice group.

## Relic combat sounds (`sfx.ts`, event `relicTriggered`)

`RELIC_SOUND_GROUPS` maps each relic id the sim emits to its voice group. All are on the sfx bus, none duck anything and each has a rate gate. A relic that never visibly acts (Featherweight Robes and the others) has no sound, and an unknown id is silent.

| Relic | Group | Sound | Gate |
|---|---|---|---|
| `silver_thimble` | `relic:thimble` (2) | Light and silvery. Two tiny glass notes (the hero's own leitmotif pitch two octaves up, then a fifth above), panned to the hero. Gain 0.028, the quietest relic sound. Frequent, so rate-limited. | 0.3 s |
| `lantern_of_the_lost` | `relic:lantern` (1) | Warm and consoling, against the low `down` sound. A soft Dm choir (D A D F) and a small A5 bell and D5 pluck, starting 0.14 s after the event so it answers the down sound instead of landing on it. | 0.5 s |
| `martyrs_veil` | `relic:veil` (1) | A save: heavy and noble. A low horn fifth (D3 A3), a deep bell on D4, a thump on the blow and a D5 pluck. `big: true` (bypasses the sfx ducker the Save causes, so it stays audible under the Save phrase). Panned to the saved hero. | 1 s |
| `cracked_metronome` | `relic:metronome` (1) | A clock tick (a short click and a falling triangle blip at 1040 Hz) that lands with the Perfect Ward, then a quieter tock 0.12 s later and 5.6% flat. Slightly off-kilter, because the Ward was early. The sim pushes this event just before `perfectWard`, so the tick leads the Perfect strike. | 0.3 s |
| `tuning_fork` | `relic:fork` (1) | A pure fork tone: a sine on the current chord's root (G5 to F#6 range), ringing 1.5 s, a twin 1.3 Hz away that beats slowly and a very faint clang partial at 6.27x. Always consonant with the Perfect's glass root. | 0.3 s |
| `glass_halo` | `relic:halo` (1) | A glassy shimmer: four chord tones climbing in the top octaves (C6 and up), each 55 ms after the last, over a faint cymbal bloom. Delayed 50 ms so it sits after the Perfect strike. | 0.3 s |
| `cantors_hymnal` | `relic:hymnal` (1) | The fight opens: a short Dm chord (D A D F, choir) with a handbell D5 and A5. Always Dm, whatever the music is on, since it plays at tick 0. | 2 s |

**Refused Glide** (`techniqueRejected`, technique `glide`, reason `locked`, from Heavy Score): group `rejectLocked` (2), a dull thud. A 78 Hz pitch-dropping sine, a lowpassed noise puff and a muffled triangle at 98 Hz. It shares the generic reject's 0.22 s gate (key `reject`), so mashing the key never stacks. Any other rejection (including a locked Thread) keeps the generic sound.

## Mix notes

- Relic sounds sit on top of the existing ones and are quieter: gains between 0.02 and 0.1 (Perfect Ward's glass is 0.26, `fermataEnd` thump 0.34). The Veil is the largest (thump 0.22) and is once per fight.
- A Perfect Ward with the Metronome, Fork and Halo plays four layers: the Perfect strike (which ducks music and sfx as before), the tick at the same moment, then the fork's pure tone and the halo shimmer. The fork and halo are pitched to the chord, so they cannot clash with it.
- Telegraph windups are sustained brass, glass or swell beds (gain 0.08 to 0.1, mostly below 1 kHz or above 4 kHz). Relic sounds are short and either high (Thimble, Halo, Fork) or brief (Metronome), and none of them ducks the sfx bus, so a windup stays audible underneath.
- The voice groups stay tiny (1 or 2), so a Perfect-heavy fight with all relics adds a bounded number of nodes. A test fires 60 frames of every relic event plus a Perfect Ward and checks the groups never exceed their caps and the gates skip most events.

## Music mood

No new `AudioMood`. The merchant, forge and event screens are quiet, between-fights stops, which is exactly what `'map'` already is (sparse pad, soft pulse, a sparse melody on beats 1 and 5, 1300 Hz pad filter). A new mood would touch `types.ts`, the stem targets, the filter table and the melody and drum branches for a difference most players would not notice. The UI can stay on `'map'` for these screens. The sound that sets each stop apart is `eventOpen` for events, `forge` for forges and `buy` for merchants.

## Hearing it in the lab (`?lab=audio`)

- **UI** group: a button for each new sound (`buy`, `cantAfford`, `forge`, `eventOpen`, `gambleWin`, `gambleLose`, `relicReveal`, `relicPick`, `curseLifted`, `aether`). Try `gambleWin` then `gambleLose` back to back: they are meant to sound like the same bell, whole and cracked.
- **Phase 3b: relics and the refused Glide** group: one button per relic, each firing the sim's real event pair. Lantern also fires an ally-down so you can hear the consolation against it. Metronome, Tuning Fork and Glass Halo fire the `relicTriggered` then a `perfectWard`. The Veil fires a `save` (cause `martyr`) after it. Extra buttons: `Perfect Ward with Metronome + Fork + Halo` (the full stack), `Silver Thimble burst (20 in 1 s)` (the gate at work), `Glide refused (Heavy Score curse)` and `Generic reject (compare)`.
- "Audit every sound" and the `__audioLab` hooks (`audit`, `pitch`) include all of the new buttons. Relic buttons render 4 s offline, the burst 3 s.

## Tests (`tests/audioPhase3b.test.ts`)

- No `STAND_INS` left; every `UiSound` has a `case` of its own and plays on the UI bus in its own group (no other `ui:` group opens).
- Every relic id that the sim sources push in a `relicTriggered` (read by scanning `src/sim`) maps to a sound group, every mapped relic is in `KNOWN_RELICS`, and each plays on the sfx bus in its own group. Unknown or silent relics, a null or missing hero: no sound, no throw.
- Gating: 20 Silver Thimble triggers in one frame make one sound; 20 spread over a second make at most four, in at most two voices. All relic events spammed with a Perfect Ward stay in their group caps.
- A locked Glide uses `rejectLocked`; a cooldown or a locked Thread keeps `reject`.
- Everything is a no-op without an AudioContext, and every new lab button fires and makes sound.
