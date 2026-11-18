# Lines left exactly as they were

Every line below is byte for byte what main has. The check ran on the final commit, over every file of English text.

## About Solos, Cues, hero autonomy and Resonance (144 lines)

For the Solo stream. Lines that name a Crescendo, a Duet, a Trio or the Grand Finale are here too: they spend Resonance or chain Solos.


**`src/ui/text/en/a11y.ts`**

- `a11y.flashes.hint`: Full-screen flashes on Perfect, Save and Crescendo, and how bright bursts, impact flashes and the Thread’s pulses are. 0 turns the full-screen ones off.
- `a11y.settings.heroAutonomy`: Hero autonomy
- `a11y.settings.heroesFireTheirOwn`: Heroes fire their own Solos a moment after they charge, unless you Cue them first. Kael saves his wall for a big hit, but never for more than 3 seconds.

**`src/ui/text/en/common/chip.ts`**

- `common.chip.resonance`: Resonance

**`src/ui/text/en/hud/bloodLook.ts`**

- `hud.bloodLook.bloodAndSilkEmpower`: Blood and Silk — Empower him for Resonance

**`src/ui/text/en/hud/bossBar.ts`**

- `hud.bossBar.fasterCuesFasterDiscord`: Faster Cues, faster Discord

**`src/ui/text/en/hud/calling.ts`**

- `hud.calling.yourHeroesCanT`: {crescendoName}: your heroes can’t drop below 1 life.
- `hud.calling.everyEnemyWaitsAnd`: {crescendoName}: every enemy waits, and your techniques have no cooldowns and cost less.

**`src/ui/text/en/hud/conductParts.ts`**

- `hud.conductParts.cueAnotherHeroWithin`: {label}: Cue another hero within {left} s for {powerLabel}
- `hud.conductParts.onTheDownbeatA`: On the downbeat: a Cue now costs {downbeatCost}
- `hud.conductParts.theBeatCueOn`: The beat: Cue on the downbeat for {downbeatCost}
- `hud.conductParts.onTheDownbeatA2`: On the downbeat: a Cue now is free
- `hud.conductParts.theBeatCueOn2`: The beat: Cue on the downbeat for free
- `hud.conductParts.ofSolosPlayed`: {name}: {played} of {length} Solos played{value}. {finaleNextLabel}.
- `hud.conductParts.cueNow`: Cue {soloName} now: {label}{value}
- `hud.conductParts.spotlightIsEmpoweredAt`: Spotlight: {name} is Empowered at ×{spotlight} while their Solo lasts
- `hud.conductParts.spotlightEmpoweredAtWhile`: Spotlight: Empowered at ×{spotlight} while their Solo lasts
- `hud.conductParts.resonance`:  ({cost} Resonance)
- `hud.conductParts.noResonance`: , no Resonance

**`src/ui/text/en/hud/conducting.ts`**

- `hud.conducting.sFinaleSoloIs`: {name}'s Finale Solo is playing
- `hud.conducting.sToCueAnother`: {chainLabel}: {left} s to Cue another hero.
- `hud.conducting.triadHoldsYourResonance`: Triad holds your Resonance.
- `hud.conducting.freeCueOnThe`: Free Cue · on the beat
- `hud.conducting.repriseEverySolo`: Reprise · every Solo +{charge}%
- `hud.conducting.everySoloIsFull`: Every Solo is full
- `hud.conducting.solo`: Solo
- `hud.conducting.solos`: Solos

**`src/ui/text/en/hud/finaleLook.ts`**

- `hud.finaleLook.crescendoCancels`: {head} · Crescendo cancels {FORTISSIMO_NAME}
- `hud.finaleLook.cue`: Cue · {voiceName}: {solo}{value}
- `hud.finaleLook.cueAnswer`: interrupt the soloist, or answer its Solo

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

**`src/ui/text/en/hud/howToPlay.ts`**

- `hud.howToPlay.leadThemDuetsAnd`: Lead them: Duets and Trios
- `hud.howToPlay.goodSupportFillsResonance`: Good support fills Resonance. As the Conductor a Cue costs {cueCost}{value}. Cue a second hero within {Number} s of the first and their Solo plays as a Duet, {morePct} stronger; a third in a row is a Trio, {morePct2} stronger. {crescendoName} costs {crescendoCost}: every hero plays their Solo in turn, rising, then every Solo is full again.
- `hud.howToPlay.buildResonance`: Build Resonance
- `hud.howToPlay.goodSupportFillsResonance2`: Good support fills Resonance. Spend {cost} Resonance to Cue a charged hero’s Solo ({levelName} raises it this run), or a full song on your Crescendo.
- `hud.howToPlay.goodSupportFillsResonance3`: Good support fills Resonance. Spend a segment to Cue a charged hero’s Solo, or a full song on your Crescendo.

**`src/ui/text/en/hud/keyHints.ts`**

- `hud.keyHints.cueASoloAnother`: Cue a Solo · another within {Number} s: a Duet
- `hud.keyHints.cueASolo`: Cue a Solo
- `hud.keyHints.cueKeys`: {cue} / {mod}1–4
- `hud.keyHints.crescendoNamed`: Crescendo: {crescendoName}
- `hud.keyHints.crescendo`: Crescendo

**`src/ui/text/en/hud/legionLook.ts`**

- `hud.legionLook.mirrorChoirOthers`: Mirror Choir — the choir sings Lyra, Brann, Kael and Vexis back at you; your other heroes still sing. Discord swells: hold your Crescendo before it fills.

**`src/ui/text/en/hud/partyFrames.ts`**

- `hud.partyFrames.theirAlternateSolo`: · their alternate Solo
- `hud.partyFrames.solo`: · Solo
- `hud.partyFrames.charged`: {soloName}: {solo}% charged
- `hud.partyFrames.firesOnItsOwn`: {soloName} fires on its own in a moment. Cue it now for the stronger form.
- `hud.partyFrames.cue`: Cue {soloName}

**`src/ui/text/en/hud/sighting.ts`**

- `hud.sighting.cuedItsLamentMarks`: Cued, its Lament marks a hero. Chime it away (in its last second, a Clutch), Ward it, or interrupt the Alto.{undo}
- `hud.sighting.cuedItsBassoOstinato`: Cued, its Basso Ostinato rings a circle on its target. Ward on the beat (a Perfect), or interrupt the Bass.{value}
- `hud.sighting.cuedItsCadenzaCuts`: Cued, its Cadenza cuts a line to the farthest hero: more than their life. Rewind them back out of it, step aside, or interrupt the Tenor.{undo}
- `hud.sighting.cuedItsCadenzaCuts2`: Cued, its Cadenza cuts a line to the farthest hero: more than their life. Step aside, Ward them, or interrupt the Tenor; Anchor holds them, it can’t pull them out.
- `hud.sighting.cuedItsCadenzaCuts3`: Cued, its Cadenza cuts a line to the farthest hero: more than their life. {value} or interrupt the Tenor.
- `hud.sighting.cuedItsShatterAria`: Cued, its Shatter Aria shatters a circle around a hero. Scatter so it catches one, Ward the one it’s on, or interrupt the Soprano.
- `hud.sighting.itCuesItsMirror`: It Cues its mirror-choir; every blow you leave unanswered feeds its Discord, and at {DISCORD_MAX} it plays {FORTISSIMO_NAME}: your Crescendo cancels it. At the last it stops the music: only your {noteSources} are heard, and eight notes wake your heroes.

**`src/ui/text/en/hud/weaverBar.ts`**

- `hud.weaverBar.cue`: Cue {cueCost}
- `hud.weaverBar.s`: {crescendoName} {crescendo}s
- `hud.weaverBar.resonance`: Resonance
- `hud.weaverBar.crescendoCosts`: Crescendo: {crescendoName}. Costs {value}.
- `hud.weaverBar.crescendoReady`: , Crescendo ready
- `hud.weaverBar.enoughFor`: . {cueLine} Enough for {cues}
- `hud.weaverBar.aFullSongResonance`: a full song ({crescendoCost} Resonance)
- `hud.weaverBar.resonance2`: {crescendoCost} Resonance

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

**`src/ui/text/en/screens/astrolabeModel.ts`**

- `screens.astrolabeModel.solosChargeFaster`: Solos charge {v}% faster
- `screens.astrolabeModel.cuedSolosLastLonger`: Cued Solos last {v}% longer

**`src/ui/text/en/screens/bondsCodex.ts`**

- `screens.bondsCodex.solos`: Solos
- `screens.bondsCodex.alternateBondRank`: · alternate, Bond rank {soloRank}

**`src/ui/text/en/screens/bondsModel.ts`**

- `screens.bondsModel.theAlternateSolo`: the alternate Solo, {name}
- `screens.bondsModel.theAlternateSoloOpens`: The alternate Solo opens at Bond rank {rank}.
- `screens.bondsModel.settingsSkipTheUnlocks`: Settings → Skip the unlocks: every talent and Solo can be chosen, as if each Bond were at rank {maxBondRank}. Scenes still wait for real ranks.
- `screens.bondsModel.alternateSoloChooseWhich`: {owner} alternate Solo. Choose which Solo {name} brings {WHERE_TO_CHOOSE}.
- `screens.bondsModel.theirBondRanksOpen`: Their Bond ranks open talents (at ranks {listAnd}: one of two each), an alternate Solo (rank {soloRank}) and {countWord} scenes each (ranks {listAnd2}), told at a Respite instead of resting.
- `screens.bondsModel.chooseTalentsAndSolos`: Choose talents and Solos {WHERE_TO_CHOOSE}. They change freely between runs; a run keeps the ones it embarks with.
- `screens.bondsModel.theAlternateSolo2`: The alternate Solo
- `screens.bondsModel.yourRunUnderWay`: Your run under way keeps the talents and Solos it embarked with: what you change here is for the next one.
- `screens.bondsModel.skipTheUnlocksEvery`: Skip the unlocks: every talent and Solo can be chosen already. Scenes wait for these ranks.

**`src/ui/text/en/screens/bondsParts.ts`**

- `screens.bondsParts.sSolo`: {name}’s Solo
- `screens.bondsParts.chooseYourHeroesTalents`: Choose your heroes’ talents and Solos

**`src/ui/text/en/screens/bondsScreen.ts`**

- `screens.bondsScreen.solo`: Solo

**`src/ui/text/en/screens/callingText.ts`**

- `screens.callingText.moreSolos`: More Solos
- `screens.callingText.solosComeRoundSooner`: Solos come round sooner
- `screens.callingText.cheapCuesDuetsAnd`: Cheap Cues, Duets and Trios
- `screens.callingText.damageYourDuetsTrios`: damage your Duets, Trios and path added
- `screens.callingText.duets`: Duets
- `screens.callingText.duet`: Duet
- `screens.callingText.trios`: Trios
- `screens.callingText.trio`: Trio
- `screens.callingText.solosPlayed`: Solos {finale} played
- `screens.callingText.freeCues`: Free Cues
- `screens.callingText.freeCue`: free Cue
- `screens.callingText.freeCues2`: free Cues
- `screens.callingText.noDuetThisRun`: No Duet this run: Cue a second hero within {value} s of the first, and their Solo plays {value2}% stronger.
- `screens.callingText.yourCallingAddedNothing`: Your Calling added nothing this run: Cue a second hero within {value} s of the first for a Duet, and a third for a Trio.
- `screens.callingText.cue`: Cue

**`src/ui/text/en/screens/chordBuilder.ts`**

- `screens.chordBuilder.chorusAurasSoEvery`: Chorus: {auraCount} auras, so every Cue releases a pulse that heals {pct} and shields {pct2} of life.
- `screens.chordBuilder.withAurasEveryCue`: With {minAuras}+ auras, every Cue also releases a chorus pulse (heal + barrier).

**`src/ui/text/en/screens/codexScreen.ts`**

- `screens.codexScreen.isTheWeaverS`: is the Weaver’s class for a run, chosen in Prep. It brings a passive and its own Crescendo, and a
- `screens.codexScreen.solo`: Solo · {name}
- `screens.codexScreen.singOrMoreAuras`: Sing {minAuras} or more auras and every Cue also releases a chorus pulse from your field: each hero it reaches heals {healPctPerAura} of their life and gains a barrier of {barrierPctPerAura} of their life for {barrierDuration} s, per aura you sing. Grace Note is how you fit the third aura.
- `screens.codexScreen.aStrongerVersionOf`: , a stronger version of it, and you gain {response} Resonance. Ignoring a call costs nothing but a short delay: they use the plain move when the window closes.
- `screens.codexScreen.aBellLandsUnder`: A bell lands under your cursor, cleanses every ailment in {radius} m and leaves heroes immune for {immunity}s. Clutch Chimes (within {clutchWindow}s of a mark's end) feed Resonance.
- `screens.codexScreen.goodSupportFillsThe`: Good support fills the Resonance arc ({max} in segments of {segment}). A Cue ({key}, or {cueMod} + a hero's number) spends one segment to fire a charged Solo with a bonus. Crescendo ({key2}) spends it all on {name}: {description}{value}
- `screens.codexScreen.onARunA`:  On a {name} run a Cue costs {value}, and a Cue within {value2} s of the last plays as a Duet, {value3}% stronger; a third in a row is a Trio, {value4}% stronger. His Crescendo is {crescendoName}.
- `screens.codexScreen.resonance`: Resonance

**`src/ui/text/en/screens/dissonanceModel.ts`**

- `screens.dissonanceModel.aCueCostsResonance`: A Cue costs {cueCost} Resonance this fight.

**`src/ui/text/en/screens/loomModel.ts`**

- `screens.loomModel.theHeroesTalentsAnd`: The heroes’ talents and Solos
- `screens.loomModel.everyFightPaysBond`: Every fight pays {bondedNames} Bond XP, more for the support you gave each. Each Bond rank opens something: talents (one of two in each tier), an alternate Solo (a hero’s big move, which they charge as they fight), or a scene by a Respite’s fire.
- `screens.loomModel.onEachHeroS`: On each hero’s page, choose one talent a tier (or neither) and which Solo they bring. Choices change freely between runs; a run keeps what it embarked with.

**`src/ui/text/en/screens/prepScreen.ts`**

- `screens.prepScreen.solo`: Solo · {name}
- `screens.prepScreen.heroAutonomy`: Hero autonomy
- `screens.prepScreen.heroesFireTheirOwn`: Heroes fire their own Solos a moment after they charge, unless you Cue them first. Kael saves his wall for a big hit, but never for more than 3 seconds.

**`src/ui/text/en/screens/resultText.ts`**

- `screens.resultText.fortissimoSilenceCrescendoBefore`: Fortissimo Silence: Crescendo before Discord fills, or dome, Ward and heal
- `screens.resultText.cued`: Cued {cues} {cuesWord}{value}.
- `screens.resultText.andSang`:  and sang {crescendos} {crescendosWord}

**`src/ui/text/en/screens/rosterModel.ts`**

- `screens.rosterModel.oroSSoloA`: Oro’s Solo: a {maxHp}-life tree that rises for the rest of {name}’s {duration} s (Cued, it stands {life} s from rising), roots and taunts the lesser enemies within {tauntRadius} m and slams them. Cued, its disc counts as your field.
- `screens.rosterModel.oroSSoloA2`: Oro’s Solo: a tree that rises for a few seconds.
- `screens.rosterModel.theAncientLifeAfter`: The Ancient ({name}): {maxHp} life, after a ground warning, for the rest of {name}’s {duration} s (Cued, {life} s from rising). It roots and taunts the lesser enemies within {tauntRadius} m, and slams everything within {radius} m for {damage}.

**`src/ui/text/en/screens/summaryScreen.ts`**

- `screens.summaryScreen.cues`: Cues
- `screens.summaryScreen.cuedSungToSafety`: {cues} {cuesWord} cued, {crescendos} {crescendosWord} sung, {reels} {reelsWord} to safety.

**`src/ui/text/en/screens/timeline.ts`**

- `screens.timeline.cue`: Cue
- `screens.timeline.crescendo`: Crescendo

**`src/ui/text/en/screens/trainingParts.ts`**

- `screens.trainingParts.resonance100`: Resonance 100

## Naming an aura, an ornament or a song’s rule, and not changed (84 lines)

The owner lifted the rule that these are left alone, and this pass reworded 23 of them. The ones below stay: they are on How to Play, the Result or the Summary, or a hero card (out of this pass), or they already fit the guide.


**`src/ui/text/en/a11y.ts`**

- `a11y.settings.everySongAuraOrnament`: Every song, aura, ornament and Calling from the start. You still earn XP and Rank.

**`src/ui/text/en/common/chip.ts`**

- `common.chip.auras`: Auras

**`src/ui/text/en/hud/calling.ts`**

- `hud.calling.sovereignSymphonyEveryAura`: Sovereign Symphony: every aura is stronger.

**`src/ui/text/en/hud/finaleLook.ts`**

- `hud.finaleLook.fortissimoName`: Fortissimo Silence

**`src/ui/text/en/hud/hints.ts`**

- `hud.hints.yourBeamSongPours`: Your beam song pours into whoever you thread: {mult} on {name}. Everyone else near you hears an echo
- `hud.hints.yourBeamSongPours2`: Your beam song pours into whoever you thread: {mult} on {name}, and nobody else
- `hud.hints.yourRadianceCountsOne`: : your Radiance counts one aura fewer until then

**`src/ui/text/en/hud/howToPlay.ts`**

- `hud.howToPlay.walkWithTheKeys`: Walk with the keys. Your party follows, fights on its own, and fights better inside your aura field.
- `hud.howToPlay.clickAPartyFrame`: Click a party frame (or press its number) to tie your Thread to that hero. Mend heals them; right-click switches to Empower for extra damage. Your beam song pours into whoever you thread.{value}
- `hud.howToPlay.clickAPartyFrameMode`: Click a party frame (or press its number) to tie your Thread to that hero. Mend heals them; {mode} switches to Empower for extra damage. Your beam song pours into whoever you thread.{value}

**`src/ui/text/en/hud/keyHints.ts`**

- `hud.keyHints.plantPedalPoint`: Plant Pedal Point

**`src/ui/text/en/hud/partyFrames.ts`**

- `hud.partyFrames.fermataHoldsAt1`: Fermata holds {name} at 1 life: heal them within {remaining} seconds
- `hud.partyFrames.echo`:  (echo{value})
- `hud.partyFrames.aurasOnThem`: Auras on them: {names}
- `hud.partyFrames.yourBeamSongPours`: Your beam song pours into {name} at {focus}
- `hud.partyFrames.outsideYourAuraField`: Outside your aura field
- `hud.partyFrames.inYourAuraField`: In your aura field
- `hud.partyFrames.yourBeamSongPours2`: . Your beam song pours into them at {focus}

**`src/ui/text/en/hud/sighting.ts`**

- `hud.sighting.itFleesWithAn`: It flees with an aura it tore from your song. Focus it to take the aura back.
- `hud.sighting.fermataStillSavesHim`: Fermata still saves him: one touch of the Thread during the hold.

**`src/ui/text/en/hud/weaverBar.ts`**

- `hud.weaverBar.aurasSilenced`: Auras silenced
- `hud.weaverBar.reservedByYourActive`: Reserved by your active auras
- `hud.weaverBar.ofReservedByAuras`: {spirit} of {freeMax}, {reserved} reserved by auras
- `hud.weaverBar.thisFightAurasThread`: This fight: auras {compact}, Thread {compact2}
- `hud.weaverBar.yourBeamSongPours`: Your beam song pours into {targetName} at {mult}
- `hud.weaverBar.noOne13`: no one (1–3): beam song idle

**`src/ui/text/en/input.ts`**

- `input.labels.fermataCaughtALethal`: Fermata caught a lethal hit: heal them before it runs out or they go down.

**`src/ui/text/en/screens/astrolabeModel.ts`**

- `screens.astrolabeModel.auraEffect`: Aura effect +{v}%

**`src/ui/text/en/screens/atlasModel.ts`**

- `screens.atlasModel.yourChordsAndTechnique`: Your Chords and technique variants are yours to choose, from every aura and ornament. No Astrolabe, no carried relics, no Bond talents.
- `screens.atlasModel.chords`: Chords

**`src/ui/text/en/screens/callingScreen.ts`**

- `screens.callingScreen.aThirdVoiceFor`: A third voice for your field song

**`src/ui/text/en/screens/callingText.ts`**

- `screens.callingText.radianceAddedNothingThis`: Radiance added nothing this run: bring your heroes into your field, and give them auras to hear.

**`src/ui/text/en/screens/chordBuilder.ts`**

- `screens.chordBuilder.auras`: Auras
- `screens.chordBuilder.addsASlotIt`:  · {name} adds a {value} slot: it needs {poolWord}, and Grace Note helps
- `screens.chordBuilder.ornamentsStrength`: ornaments {mult} strength
- `screens.chordBuilder.noAuras`: no auras
- `screens.chordBuilder.ornaments`: Ornaments 
- `screens.chordBuilder.changeBothAuras`: · change both auras

**`src/ui/text/en/screens/chordModel.ts`**

- `screens.chordModel.asTheMartyrYour`: As the Martyr, your auras
- `screens.chordModel.withSanguineFontYour`: With Sanguine Font, your auras
- `screens.chordModel.ridesYourThreadThe`: Rides your Thread: the hero you thread hears it at {mult}, wherever they are. Everyone else near you hears an echo.
- `screens.chordModel.allInItPours`: All in: it pours into the hero you thread at {mult}, and nobody else hears an echo.
- `screens.chordModel.noEcho`: No echo

**`src/ui/text/en/screens/codexAttack.ts`**

- `screens.codexAttack.stealsOneOfYour`: steals one of your auras
- `screens.codexAttack.silencesAuras`: silences auras

**`src/ui/text/en/screens/codexScreen.ts`**

- `screens.codexScreen.silencesAurasWithinM`: silences auras within {suppressRadius} m
- `screens.codexScreen.theBeamSong`: The beam song
- `screens.codexScreen.yourFirstChordRides`: Your first Chord rides the Thread. The hero you thread hears it at 
- `screens.codexScreen.echoWithinM`: echo {mult} within {fieldRadius} m
- `screens.codexScreen.theFieldSong`: The field song
- `screens.codexScreen.chorusPulse`: Chorus pulse
- `screens.codexScreen.healPerAura`: {healPctPerAura} heal per aura
- `screens.codexScreen.barrierPerAura`: {barrierPctPerAura} barrier per aura
- `screens.codexScreen.fermataHold`: Fermata hold
- `screens.codexScreen.ornaments`: Ornaments
- `screens.codexScreen.auras`: Auras
- `screens.codexScreen.songsOrnaments`: Songs & ornaments
- `screens.codexScreen.yankAHeroTo`: Yank a hero to your side along a ribbon. Out of a lethal zone or a beam, and into your aura field.{value}
- `screens.codexScreen.beamSong`: beam song
- `screens.codexScreen.fieldSong`: field song

**`src/ui/text/en/screens/contributionBar.ts`**

- `screens.contributionBar.auras`: Auras

**`src/ui/text/en/screens/draftScreen.ts`**

- `screens.draftScreen.worksWithYourAura`: Works with your {name} aura

**`src/ui/text/en/screens/interlude.ts`**

- `screens.interlude.rebuildYourSongsAuras`: Rebuild your songs: auras, ornaments, presets.

**`src/ui/text/en/screens/mapScreen.ts`**

- `screens.mapScreen.chord`: Chord
- `screens.mapScreen.noAurasChosen`: No auras chosen.

**`src/ui/text/en/screens/prepScreen.ts`**

- `screens.prepScreen.beamSong`: beam song
- `screens.prepScreen.fieldSong`: field song

**`src/ui/text/en/screens/respiteScreen.ts`**

- `screens.respiteScreen.rebuildYourSongsAuras`: Rebuild your songs: auras, ornaments, presets. Now singing {value}.

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

**`src/ui/text/en/screens/timeline.ts`**

- `screens.timeline.fermataHold`: Fermata hold

**`src/ui/text/en/screens/trainingParts.ts`**

- `screens.trainingParts.chords`: Chords
- `screens.trainingParts.stageAFermataHold`: Stage a Fermata hold
