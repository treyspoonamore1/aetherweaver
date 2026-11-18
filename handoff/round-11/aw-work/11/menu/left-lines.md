# Lines left exactly as they were

Every line below is in a file this pass worked on, and is byte for byte what main has. The check ran on the final commit.

## About Solos, Cues, hero autonomy and Resonance (55 lines)

For the Solo stream. Lines that name a Crescendo, a Duet, a Trio or the Grand Finale are here too: they spend Resonance or chain Solos.


**`src/ui/text/en/screens/loomModel.ts`**

- `screens.loomModel.theHeroesTalentsAnd`: The heroes’ talents and Solos
- `screens.loomModel.everyFightPaysBond`: Every fight pays {bondedNames} Bond XP, more for the support you gave each. Each Bond rank opens something: talents (one of two in each tier), an alternate Solo (a hero’s big move, which they charge as they fight), or a scene by a Respite’s fire.
- `screens.loomModel.onEachHeroS`: On each hero’s page, choose one talent a tier (or neither) and which Solo they bring. Choices change freely between runs; a run keeps what it embarked with.

**`src/ui/text/en/screens/prepScreen.ts`**

- `screens.prepScreen.solo`: Solo · {name}
- `screens.prepScreen.heroAutonomy`: Hero autonomy
- `screens.prepScreen.heroesFireTheirOwn`: Heroes fire their own Solos a moment after they charge, unless you Cue them first. Kael saves his wall for a big hit, but never for more than 3 seconds.

**`src/ui/text/en/hud/howToPlay.ts`**

- `hud.howToPlay.leadThemDuetsAnd`: Lead them: Duets and Trios
- `hud.howToPlay.goodSupportFillsResonance`: Good support fills Resonance. As the Conductor a Cue costs {cueCost}{value}. Cue a second hero within {Number} s of the first and their Solo plays as a Duet, {morePct} stronger; a third in a row is a Trio, {morePct2} stronger. {crescendoName} costs {crescendoCost}: every hero plays their Solo in turn, rising, then every Solo is full again.
- `hud.howToPlay.buildResonance`: Build Resonance
- `hud.howToPlay.goodSupportFillsResonance2`: Good support fills Resonance. Spend {cost} Resonance to Cue a charged hero’s Solo ({levelName} raises it this run), or a full song on your Crescendo.
- `hud.howToPlay.goodSupportFillsResonance3`: Good support fills Resonance. Spend a segment to Cue a charged hero’s Solo, or a full song on your Crescendo.

**`src/ui/text/en/hud/hints.ts`**

- `hud.hints.yourHeroesCanT`: {crescendoName}: your heroes can’t fall below 1 life — what gets past them comes to you, softened
- `hud.hints.everyEnemyWaitsYour`: {crescendoName}: every enemy waits — your techniques have no cooldowns{value} while it lasts. Ward {Q}, Chime {E} and Rewind {F} freely
- `hud.hints.oneResonanceSegment`: one Resonance segment
- `hud.hints.cueOnTheDownbeat`: Cue on the downbeat: it costs only {downbeatCost} Resonance. The light under your Resonance shows the beat
- `hud.hints.cueOnTheDownbeat2`: Cue on the downbeat: it’s free. The light under your Resonance shows the beat
- `hud.hints.yourCrescendoCancelsIt`: {FORTISSIMO_NAME} — your Crescendo {crescendo} cancels it: press it now
- `hud.hints.holdResonanceYourCrescendo`: {FORTISSIMO_NAME}: hold {crescendoCost} Resonance — your Crescendo {crescendo} cancels it
- `hud.hints.sIsReadyPress`: {name}'s {soloName} is ready — press {{mod}{value}} now to Cue the stronger form, or it fires on its own
- `hud.hints.sIsReadyPress2`: {name}'s {soloName} is ready — press {{mod}{value}} to Cue it (costs {value2})
- `hud.hints.resonanceIsFullPress`: Resonance is full — press {{bindingLabel}} for {crescendoName}
- `hud.hints.cueAnotherWithinS`: Cue another within {Number} s for a {linkName}: {name}, {{mod}{value}}
- `hud.hints.playsEverySoloRising`: {crescendoName} {{bindingLabel}} plays every Solo, rising, then fills them all
- `hud.hints.everySoloYouLet`: Every Solo you let through feeds the Conductor’s Discord: answer it, or interrupt the soloist (Focus {{bindingLabel}})
- `hud.hints.resonance`: {cueCost} Resonance

**`src/ui/text/en/hud/sighting.ts`**

- `hud.sighting.cuedItsLamentMarks`: Cued, its Lament marks a hero. Chime it away (in its last second, a Clutch), Ward it, or interrupt the Alto.{undo}
- `hud.sighting.cuedItsBassoOstinato`: Cued, its Basso Ostinato rings a circle on its target. Ward on the beat (a Perfect), or interrupt the Bass.{value}
- `hud.sighting.cuedItsCadenzaCuts`: Cued, its Cadenza cuts a line to the farthest hero: more than their life. Rewind them back out of it, step aside, or interrupt the Tenor.{undo}
- `hud.sighting.cuedItsCadenzaCuts2`: Cued, its Cadenza cuts a line to the farthest hero: more than their life. Step aside, Ward them, or interrupt the Tenor; Anchor holds them, it can’t pull them out.
- `hud.sighting.cuedItsCadenzaCuts3`: Cued, its Cadenza cuts a line to the farthest hero: more than their life. {value} or interrupt the Tenor.
- `hud.sighting.cuedItsShatterAria`: Cued, its Shatter Aria shatters a circle around a hero. Scatter so it catches one, Ward the one it’s on, or interrupt the Soprano.
- `hud.sighting.itCuesItsMirror`: It Cues its mirror-choir; every blow you leave unanswered feeds its Discord, and at {DISCORD_MAX} it plays {FORTISSIMO_NAME}: your Crescendo cancels it. At the last it stops the music: only your {noteSources} are heard, and eight notes wake your heroes.

**`src/ui/text/en/hud/keyHints.ts`**

- `hud.keyHints.cueASoloAnother`: Cue a Solo · another within {Number} s: a Duet
- `hud.keyHints.cueASolo`: Cue a Solo
- `hud.keyHints.cueKeys`: {cue} / {mod}1–4
- `hud.keyHints.crescendoNamed`: Crescendo: {crescendoName}
- `hud.keyHints.crescendo`: Crescendo

**`src/ui/text/en/screens/resultText.ts`**

- `screens.resultText.fortissimoSilenceCrescendoBefore`: Fortissimo Silence: Crescendo before Discord fills, or dome, Ward and heal
- `screens.resultText.cued`: Cued {cues} {cuesWord}{value}.
- `screens.resultText.andSang`:  and sang {crescendos} {crescendosWord}

**`src/ui/text/en/screens/summaryScreen.ts`**

- `screens.summaryScreen.cues`: Cues
- `screens.summaryScreen.cuedSungToSafety`: {cues} {cuesWord} cued, {crescendos} {crescendosWord} sung, {reels} {reelsWord} to safety.

**`src/ui/text/en/a11y.ts`**

- `a11y.flashes.hint`: Full-screen flashes on Perfect, Save and Crescendo, and how bright bursts, impact flashes and the Thread’s pulses are. 0 turns the full-screen ones off.
- `a11y.settings.heroAutonomy`: Hero autonomy
- `a11y.settings.heroesFireTheirOwn`: Heroes fire their own Solos a moment after they charge, unless you Cue them first. Kael saves his wall for a big hit, but never for more than 3 seconds.

**`src/ui/text/en/input.ts`**

- `input.padAction.cueReticle`: Cue the reticle’s hero
- `input.controls.pressModifierAria`: Press the Cue modifier (Escape cancels)
- `input.controls.modifierName`: the Cue modifier
- `input.controls.cueHint`: With {mod}: Cue their Solo
- `input.options.mouseover.hint`: Ward, Reel, Chime and Cue go to the hero under the cursor. Off: always the threaded hero.
- `input.options.cueModifier`: Cue modifier
- `input.options.cueModifier.hint`: Held with a hero’s Thread key, Cues their Solo
- `input.pad.sticks`: Left stick: move. Right stick: flick the reticle between heroes, or aim the Directive wheel while it’s open. The reticle’s hero is the one your techniques and Cues go to.
- `input.labels.waitsForYourSong`: Waits for your song: frozen by the Grand Silence, it can’t move, attack, take a call or a Cue. Your Ward, Chime, Reel and Mend still reach them.
- `input.labels.crescendo`: Crescendo

## Naming or describing an aura, an ornament or a song’s rule (42 lines)

The owner’s. Some of these sit on screens this pass rewrote, and are why those screens lost fewer words.


**`src/ui/text/en/screens/loomModel.ts`**

- `screens.loomModel.everyRunStartsHere`: Every run starts here. Through the Gate is Prep, where you choose your songs (the auras you sing to your heroes as they fight: healing them, or making them hit harder), then set out on the road. A run you leave waits at the Gate to be continued.
- `screens.loomModel.oneRunTheSame`: One run, the same for everyone this week: its seed, route, Calling, heroes and Dissonance are fixed, and your Chords are your own. Share your result as a code and a replay; add a friend’s, and this device plays it through to check it.

**`src/ui/text/en/screens/prepScreen.ts`**

- `screens.prepScreen.ridesTheThreadWhoever`: rides the Thread: whoever you thread hears it at {mult}, and everyone else near you hears an echo.
- `screens.prepScreen.beamSong`: beam song
- `screens.prepScreen.fieldSong`: field song

**`src/ui/text/en/screens/mapScreen.ts`**

- `screens.mapScreen.chord`: Chord
- `screens.mapScreen.noAurasChosen`: No auras chosen.

**`src/ui/text/en/hud/howToPlay.ts`**

- `hud.howToPlay.walkWithTheKeys`: Walk with the keys. Your party follows, fights on its own, and fights better inside your aura field.
- `hud.howToPlay.clickAPartyFrame`: Click a party frame (or press its number) to tie your Thread to that hero. Mend heals them; right-click switches to Empower for extra damage. Your beam song pours into whoever you thread.{value}
- `hud.howToPlay.clickAPartyFrameMode`: Click a party frame (or press its number) to tie your Thread to that hero. Mend heals them; {mode} switches to Empower for extra damage. Your beam song pours into whoever you thread.{value}

**`src/ui/text/en/hud/hints.ts`**

- `hud.hints.fermataHoldsAt1`: Fermata holds {name} at 1 life — one touch of the Thread saves {him}, even halved: {value}
- `hud.hints.fermataIsHoldingAt`: Fermata is holding {name} at 1 life — keep Mending them, or Chime {E} on them, before it ends
- `hud.hints.isOutsideYourField`: {name} is outside your field — move closer so your auras reach them
- `hud.hints.isOutsideYourField2`: {name} is outside your field — move closer so your auras reach them, or Reel {F} them in
- `hud.hints.yourBeamSongPours`: Your beam song pours into whoever you thread: {mult} on {name}. Everyone else near you hears an echo
- `hud.hints.yourBeamSongPours2`: Your beam song pours into whoever you thread: {mult} on {name}, and nobody else
- `hud.hints.yourPedalPointField`: Your Pedal Point field stays where you plant it — press {V} to plant it under the fight
- `hud.hints.yourRadianceCountsOne`: : your Radiance counts one aura fewer until then
- `hud.hints.fermataIsHoldingAt2`: Fermata is holding {name} at 1 life — Thread them {{value}} or Chime {E} on them before it ends
- `hud.hints.yourAurasAreSilenced`: Your auras are silenced — bring the party into a hymn circle with Rally {{bindingLabel}}
- `hud.hints.yourAurasAreSilenced2`: Your auras are silenced — mark the {silencerName} with {{bindingLabel}} so the party breaks its dome

**`src/ui/text/en/hud/sighting.ts`**

- `hud.sighting.itFleesWithAn`: It flees with an aura it tore from your song. Focus it to take the aura back.
- `hud.sighting.fermataStillSavesHim`: Fermata still saves him: one touch of the Thread during the hold.

**`src/ui/text/en/hud/keyHints.ts`**

- `hud.keyHints.plantPedalPoint`: Plant Pedal Point

**`src/ui/text/en/screens/resultText.ts`**

- `screens.resultText.bassoOstinatoWardOn`: Basso Ostinato: Ward on the beat, or interrupt the Bass
- `screens.resultText.yourAurasOfEverything`: Your auras {verbs}: {auraShare} of everything you did.
- `screens.resultText.yourAurasDidNothing`: Your auras did nothing this time. Sing them where the party is: the beam song on whoever you thread, the field song around you.
- `screens.resultText.damageNeverLandedStopped`: {fmt} damage never landed: {shielded} stopped by your shields and auras, and {negated} negated by {perfects} Perfect {perfectsWord}.
- `screens.resultText.fermataCaughtLethalAnd`: Fermata caught {holds} lethal {holdsWord} and held the hero at 1 life{value}.

**`src/ui/text/en/screens/summaryScreen.ts`**

- `screens.summaryScreen.youAddedDamageAuras`: You added {amplified} damage (auras {auraAmplified}, Empower {threadAmplified}): {pct} of everything your party dealt.
- `screens.summaryScreen.yourThreadStayedOn`: Your Thread stayed on Mend and no aura added damage. Empower adds damage when the party is healthy.
- `screens.summaryScreen.youHealedLifeAcross`: You healed {healing} life across {encounters} {encountersWord} (auras {auraHealing}, your beam {threadHealing}){value}.
- `screens.summaryScreen.damageNeverLandedStopped`: {mitigated} damage never landed: {shielded} stopped by your shields and auras, and {negated} negated by {perfects} Perfect {perfectsWord}.
- `screens.summaryScreen.fermataHolds`: Fermata holds
- `screens.summaryScreen.lethalCaughtByFermata`: {holds} lethal {holdsWord} caught by Fermata and held at 1 life{value}.
- `screens.summaryScreen.fermataNeverHadTo`: Fermata never had to hold anyone. Slot it to catch a lethal hit once per fight.
- `screens.summaryScreen.dealtDamageYourAuras`: Dealt {damage} damage. Your auras and Empower accounted for {share} of it.

**`src/ui/text/en/screens/draftScreen.ts`**

- `screens.draftScreen.worksWithYourAura`: Works with your {name} aura

**`src/ui/text/en/screens/respiteScreen.ts`**

- `screens.respiteScreen.rebuildYourSongsAuras`: Rebuild your songs: auras, ornaments, presets. Now singing {value}.

**`src/ui/text/en/screens/interlude.ts`**

- `screens.interlude.rebuildYourSongsAuras`: Rebuild your songs: auras, ornaments, presets.

**`src/ui/text/en/a11y.ts`**

- `a11y.settings.everySongAuraOrnament`: Every song, aura, ornament and Calling from the start. You still earn XP and Rank.

**`src/ui/text/en/input.ts`**

- `input.labels.fermataCaughtALethal`: Fermata caught a lethal hit: heal them before it runs out or they go down.
