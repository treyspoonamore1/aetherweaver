# W3: the lines this step changed, with word counts

Base `8572e48`. A placeholder such as `{name}` counts as one word. Counted by `scripts/words.py`.

## Totals

| | Lines | Words before | Words after |
|---|---|---|---|
| Reworded | 35 | 635 | 451 |
| Removed | 35 | 287 | 0 |
| New | 31 | 0 | 286 |
| **All** | 101 | **922** | **737** |

## Reworded

| Key | Before | After | Words |
|---|---|---|---|
| `a11y.flashes.hint` | Full-screen flashes on Perfect, Save and Crescendo, and how bright bursts, impact flashes and the Thread’s pulses are. 0 turns the full-screen ones off. | How bright flashes, bursts and the Thread’s pulses are. 0 turns full-screen flashes off. | 24 → 14 |
| `hud.conductParts.cueAnotherHeroWithin` | {label}: Cue another hero within {left} s for {powerLabel} | {label}: {left} s to Cue another hero for {powerLabel} | 9 → 9 |
| `hud.conducting.onTheBeat` | On the beat · {cost} | On the beat · +{gift} Resonance | 4 → 5 |
| `hud.hints.yourHeroesCanT` | {crescendoName}: your heroes can’t fall below 1 life — what gets past them comes to you, softened | {crescendoName}: no hero falls below 1 life. The rest comes to you, softened | 16 → 13 |
| `hud.hints.everyEnemyWaitsYour` | {crescendoName}: every enemy waits — your techniques have no cooldowns{value} while it lasts. Ward {Q}, Chime {E} and Rewind {F} freely | {crescendoName}: every enemy waits. Your techniques have no cooldowns{value} | 20 → 9 |
| `hud.hints.yourCrescendoCancelsIt` | {FORTISSIMO_NAME} — your Crescendo {crescendo} cancels it: press it now | {FORTISSIMO_NAME}. Press {crescendo}: your Crescendo cancels it | 9 → 7 |
| `hud.hints.holdResonanceYourCrescendo` | {FORTISSIMO_NAME}: hold {crescendoCost} Resonance — your Crescendo {crescendo} cancels it | Save {crescendoCost} Resonance: your Crescendo {crescendo} cancels {FORTISSIMO_NAME} | 9 → 8 |
| `hud.hints.resonanceIsFullPress` | Resonance is full — press {{bindingLabel}} for {crescendoName} | Resonance is full. Press {{bindingLabel}} for {crescendoName} | 7 → 7 |
| `hud.hints.playsEverySoloRising` | {crescendoName} {{bindingLabel}} plays every Solo, rising, then fills them all | {crescendoName} {{bindingLabel}} plays every Solo, then refills them | 10 → 8 |
| `hud.hints.everySoloYouLet` | Every Solo you let through feeds the Conductor’s Discord: answer it, or interrupt the soloist (Focus {{bindingLabel}}) | An unanswered Solo feeds Discord. Answer it, or Focus {{bindingLabel}} the soloist to interrupt | 17 → 14 |
| `hud.howToPlay.leadThemDuetsAnd` | Lead them: Duets and Trios | Duets and Trios | 5 → 3 |
| `hud.sighting.cuedItsLamentMarks` | Cued, its Lament marks a hero. Chime it away (in its last second, a Clutch), Ward it, or interrupt the Alto.{undo} | Cued, its Lament marks a hero. Chime it away, Ward it, or interrupt the Alto.{undo} | 21 → 15 |
| `hud.sighting.cuedItsBassoOstinato` | Cued, its Basso Ostinato rings a circle on its target. Ward on the beat (a Perfect), or interrupt the Bass.{value} | Cued, its Basso Ostinato rings a circle on its target. Ward on the beat, or interrupt the Bass.{value} | 20 → 18 |
| `hud.sighting.cuedItsCadenzaCuts` | Cued, its Cadenza cuts a line to the farthest hero: more than their life. Rewind them back out of it, step aside, or interrupt the Tenor.{undo} | Cued, its Cadenza cuts a lethal line to the farthest hero. Rewind them out, step aside, or interrupt the Tenor.{undo} | 26 → 20 |
| `hud.sighting.cuedItsCadenzaCuts2` | Cued, its Cadenza cuts a line to the farthest hero: more than their life. Step aside, Ward them, or interrupt the Tenor; Anchor holds them, it can’t pull them out. | Cued, its Cadenza cuts a lethal line to the farthest hero. Step aside, Ward them or interrupt the Tenor. Anchor holds them: it can’t pull them out. | 30 → 27 |
| `hud.sighting.cuedItsCadenzaCuts3` | Cued, its Cadenza cuts a line to the farthest hero: more than their life. {value} or interrupt the Tenor. | Cued, its Cadenza cuts a lethal line to the farthest hero. {value} or interrupt the Tenor. | 19 → 16 |
| `hud.sighting.cuedItsShatterAria` | Cued, its Shatter Aria shatters a circle around a hero. Scatter so it catches one, Ward the one it’s on, or interrupt the Soprano. | Cued, its Shatter Aria bursts a circle round a hero. Scatter, Ward that hero, or interrupt the Soprano. | 24 → 18 |
| `hud.sighting.itCuesItsMirror` | It Cues its mirror-choir; every blow you leave unanswered feeds its Discord, and at {DISCORD_MAX} it plays {FORTISSIMO_NAME}: your Crescendo cancels it. At the last it stops the music: only your {noteSources} are heard, and eight notes wake your heroes. | It Cues its mirror-choir. Unanswered blows feed Discord. At {DISCORD_MAX} it plays {FORTISSIMO_NAME}: your Crescendo cancels it. | 40 → 17 |
| `hud.weaverBar.ofSegments` | {full} of {segments} segments{value}{value2} | {full} of {segments} segments{value} | 4 → 4 |
| `input.options.mouseover.hint` | Ward, Reel, Chime and Cue go to the hero under the cursor. Off: always the threaded hero. | Ward, Reel and Chime go to the hero under the cursor. Off: the threaded hero. | 17 → 15 |
| `input.options.autoThread.hint` | After 2 s with no input, the Thread moves to the hero lowest on life. Shown as an assist. | After 2 s with no input, the Thread follows a Solo about to fire, or goes to the hero lowest on life. Counts as an assist. | 19 → 26 |
| `input.pad.sticks` | Left stick: move. Right stick: flick the reticle between heroes, or aim the Directive wheel while it’s open. The reticle’s hero is the one your techniques and Cues go to. | Left stick: move. Right stick: flick the reticle between heroes, or aim the Directive wheel. Your techniques go to the reticle’s hero. | 30 → 22 |
| `input.labels.waitsForYourSong` | Waits for your song: frozen by the Grand Silence, it can’t move, attack, take a call or a Cue. Your Ward, Chime, Reel and Mend still reach them. | Frozen by the Grand Silence. Your Ward, Chime, Reel and Mend still reach them. | 28 → 14 |
| `screens.callingText.noDuetThisRun` | No Duet this run: Cue a second hero within {value} s of the first, and their Solo plays {value2}% stronger. | No Duet this run. Cue two Solos within {value} s: the second plays {value2}% stronger. | 20 → 15 |
| `screens.callingText.yourCallingAddedNothing` | Your Calling added nothing this run: Cue a second hero within {value} s of the first for a Duet, and a third for a Trio. | Your Calling added nothing this run. Cue two Solos within {value} s for a Duet, three for a Trio. | 25 → 19 |
| `screens.codexScreen.goodSupportFillsThe` | Good support fills the Resonance arc ({max} in segments of {segment}). A Cue ({key}, or {cueMod} + a hero's number) spends one segment to fire a charged Solo with a bonus. Crescendo ({key2}) spends it all on {name}: {description}{value} | Good support fills Resonance. At {cost}, Crescendo ({key2}) spends it on {name}: {description}{value} | 38 → 13 |
| `screens.codexScreen.onARunA` |  On a {name} run a Cue costs {value}, and a Cue within {value2} s of the last plays as a Duet, {value3}% stronger; a third in a row is a Trio, {value4}% stronger. His Crescendo is {crescendoName}. |  On a {name} run, a Solo Cued within {value2} s of the last is a Duet, {value3}% stronger. A third is a Trio, {value4}% stronger. | 37 → 25 |
| `screens.loomModel.theHeroesTalentsAnd` | The heroes’ talents and Solos | Hero talents and Solos | 5 → 4 |
| `screens.loomModel.everyFightPaysBond` | Every fight pays {bondedNames} Bond XP, more for the support you gave each. Each Bond rank opens something: talents (one of two in each tier), an alternate Solo (a hero’s big move, which they charge as they fight), or a scene by a Respite’s fire. | Fights pay {bondedNames} Bond XP. Each Bond rank opens a talent, an alternate Solo (a hero’s big move) or a scene. | 45 → 21 |
| `screens.loomModel.onEachHeroS` | On each hero’s page, choose one talent a tier (or neither) and which Solo they bring. Choices change freely between runs; a run keeps what it embarked with. | Choose one talent a tier and a Solo for each hero. A run keeps what it set out with. | 28 → 19 |
| `screens.resultText.fortissimoSilenceCrescendoBefore` | Fortissimo Silence: Crescendo before Discord fills, or dome, Ward and heal | Fortissimo Silence: sing your Crescendo before Discord fills | 11 → 8 |
| `screens.resultText.cued` | Cued {cues} {cuesWord}{value}. | {cues} {cuesWord} Cued{value}. | 3 → 3 |
| `screens.resultText.andSang` |  and sang {crescendos} {crescendosWord} | , {crescendos} {crescendosWord} sung | 4 → 3 |
| `screens.summaryScreen.cues` | Cues | Cued Solos | 1 → 2 |
| `screens.summaryScreen.cuedSungToSafety` | {cues} {cuesWord} cued, {crescendos} {crescendosWord} sung, {reels} {reelsWord} to safety. | {cues} {cuesWord} Cued, {crescendos} {crescendosWord} sung, {reels} {reelsWord} to safety. | 10 → 10 |

## Removed

| Key | Was | Words |
|---|---|---|
| `hud.conductParts.onTheDownbeatA` | On the downbeat: a Cue now costs {downbeatCost} | 8 |
| `hud.conductParts.theBeatCueOn` | The beat: Cue on the downbeat for {downbeatCost} | 8 |
| `hud.conductParts.onTheDownbeatA2` | On the downbeat: a Cue now is free | 8 |
| `hud.conductParts.theBeatCueOn2` | The beat: Cue on the downbeat for free | 8 |
| `hud.conductParts.cueNow` | Cue {soloName} now: {label}{value} | 4 |
| `hud.conductParts.free` | Free | 1 |
| `hud.conductParts.resonance` |  ({cost} Resonance) | 2 |
| `hud.conductParts.noResonance` | , no Resonance | 2 |
| `hud.conducting.freeCueOnThe` | Free Cue · on the beat | 5 |
| `hud.conducting.free` | Free | 1 |
| `hud.hints.oneResonanceSegment` | one Resonance segment | 3 |
| `hud.hints.cueOnTheDownbeat` | Cue on the downbeat: it costs only {downbeatCost} Resonance. The light under your Resonance shows the beat | 17 |
| `hud.hints.cueOnTheDownbeat2` | Cue on the downbeat: it’s free. The light under your Resonance shows the beat | 14 |
| `hud.hints.sIsReadyPress` | {name}'s {soloName} is ready — press {{mod}{value}} now to Cue the stronger form, or it fires on its own | 18 |
| `hud.hints.sIsReadyPress2` | {name}'s {soloName} is ready — press {{mod}{value}} to Cue it (costs {value2}) | 11 |
| `hud.hints.cueAnotherWithinS` | Cue another within {Number} s for a {linkName}: {name}, {{mod}{value}} | 10 |
| `hud.hints.resonance` | {cueCost} Resonance | 2 |
| `hud.howToPlay.goodSupportFillsResonance` | Good support fills Resonance. As the Conductor a Cue costs {cueCost}{value}. Cue a second hero within {Number} s of the first and their Solo plays as a Duet, {morePct} stronger; a third in a row is a Trio, {morePct2} stronger. {crescendoName} costs {crescendoCost}: every hero plays their Solo in turn, rising, then every Solo is full again. | 57 |
| `hud.howToPlay.raisesItThisRun` |  ({levelName} raises it this run) | 5 |
| `hud.howToPlay.buildResonance` | Build Resonance | 2 |
| `hud.howToPlay.goodSupportFillsResonance2` | Good support fills Resonance. Spend {cost} Resonance to Cue a charged hero’s Solo ({levelName} raises it this run), or a full song on your Crescendo. | 25 |
| `hud.howToPlay.goodSupportFillsResonance3` | Good support fills Resonance. Spend a segment to Cue a charged hero’s Solo, or a full song on your Crescendo. | 20 |
| `hud.keyHints.cueASoloAnother` | Cue a Solo · another within {Number} s: a Duet | 9 |
| `hud.keyHints.cueASolo` | Cue a Solo | 3 |
| `hud.keyHints.cueKeys` | {cue} / {mod}1–4 | 2 |
| `hud.partyFrames.firesOnItsOwn` | {soloName} fires on its own in a moment. Cue it now for the stronger form. | 15 |
| `hud.partyFrames.cue` | Cue {soloName} | 2 |
| `hud.partyFrames.auto` | AUTO | 1 |
| `hud.weaverBar.cue` | Cue {cueCost} | 2 |
| `hud.weaverBar.enoughFor` | . {cueLine} Enough for {cues} | 4 |
| `screens.callingText.cheapCuesDuetsAnd` | Cheap Cues, Duets and Trios | 5 |
| `screens.callingText.freeCues` | Free Cues | 2 |
| `screens.callingText.freeCue` | free Cue | 2 |
| `screens.callingText.freeCues2` | free Cues | 2 |
| `screens.dissonanceModel.aCueCostsResonance` | A Cue costs {cueCost} Resonance this fight. | 7 |

## New

| Key | Line | Words |
|---|---|---|
| `hud.conductParts.beat` | The beat. Solos begin on the downbeat | 7 |
| `hud.conductParts.beatNext` | The beat. {name}’s Solo begins in {in} s. Thread them to Cue it | 13 |
| `hud.conductParts.beatNextCued` | The beat. {name}’s Solo begins in {in} s, Cued | 9 |
| `hud.conductParts.cuedItIsA` | {soloName}, Cued, is a {label}: {powerLabel} | 6 |
| `hud.hints.solosBeginOnThe` | Solos begin on the downbeat. Each one you Cue gives {gift} Resonance | 12 |
| `hud.hints.solosBeginOnThe2` | Solos begin on the downbeat. The light under your Resonance shows it | 12 |
| `hud.hints.aHitIsComingFor` | A hit is coming for the party. Thread {name} {{key}}: Cued, his wall shields everyone | 15 |
| `hud.hints.soloIsComing` | {name}’s {soloName} is coming. Thread them {{key}} to Cue it: the stronger form | 13 |
| `hud.hints.threadForALink` | {linkName} next. Thread {name} {{key}} as their Solo fires | 9 |
| `hud.howToPlay.aSoloFiredDuet` | A Solo fired with your Thread on them is Cued. Cue two within {Number} s for a Duet, three for a Trio. | 22 |
| `hud.howToPlay.cueTheirSolos` | Cue their Solos | 3 |
| `hud.howToPlay.heroesFire` | Heroes fire their own Solos. A Solo fired with your Thread on them is Cued: the stronger form. | 18 |
| `hud.howToPlay.heroesFireHold` | Heroes fire their own Solos. {levelName}: a Solo is Cued, the stronger form, if your Thread was on them {hold} s before it fires. | 24 |
| `hud.partyFrames.threadToCue` | Thread to Cue | 3 |
| `hud.partyFrames.cued` | Cued | 1 |
| `hud.partyFrames.hold` | Hold {hold} s | 3 |
| `hud.partyFrames.cuedMeans` | Cued: fired with your Thread on them. The stronger form. | 10 |
| `hud.partyFrames.soloThread` | {name}’s {soloName} is coming. Thread them to Cue it | 9 |
| `hud.partyFrames.soloCued` | {name}’s {soloName} is coming, Cued: your Thread is on them | 10 |
| `hud.partyFrames.soloHold` | {name}’s {soloName} is coming. Hold your Thread on them {hold} more seconds to Cue it | 15 |
| `screens.atlasModel.replayTooOld` | This replay is from an earlier version. It can’t be played back. | 12 |
| `screens.callingText.duetsAndTrios` | Duets and Trios | 3 |
| `screens.callingText.onTheBeat` | On the beat | 3 |
| `screens.callingText.soloOnTheBeat` | Solo Cued on the beat | 5 |
| `screens.callingText.solosOnTheBeat` | Solos Cued on the beat | 5 |
| `screens.codexScreen.hisCrescendoIs` |  The {name}’s Crescendo is {crescendoName}. | 5 |
| `screens.codexScreen.solos` | Solos | 1 |
| `screens.codexScreen.heroesFireTheirOwn` | Heroes fire their own Solos. A Solo fired with your Thread on them is Cued: the stronger form.{value} | 18 |
| `screens.codexScreen.firesAfter` | Fires {wait} s after it fills | 6 |
| `screens.codexScreen.kaelHolds` | Kael holds his wall up to {kaelHold} s | 8 |
| `screens.codexScreen.oneEach` | One Solo starts each {gap} s | 6 |

## The menu pass's 55 left lines

| Key | Then | Now | Words |
|---|---|---|---|
| `screens.loomModel.theHeroesTalentsAnd` | The heroes’ talents and Solos | Hero talents and Solos | 5 → 4 |
| `screens.loomModel.everyFightPaysBond` | Every fight pays {bondedNames} Bond XP, more for the support you gave each. Each Bond rank opens something: talents (one of two in each tier), an alternate Solo (a hero’s big move, which they charge as they fight), or a scene by a Respite’s fire. | Fights pay {bondedNames} Bond XP. Each Bond rank opens a talent, an alternate Solo (a hero’s big move) or a scene. | 45 → 21 |
| `screens.loomModel.onEachHeroS` | On each hero’s page, choose one talent a tier (or neither) and which Solo they bring. Choices change freely between runs; a run keeps what it embarked with. | Choose one talent a tier and a Solo for each hero. A run keeps what it set out with. | 28 → 19 |
| `screens.prepScreen.solo` | Solo · {name} | kept: a label | 2 |
| `screens.prepScreen.heroAutonomy` | Hero autonomy | goes when the input step lands: its screen still reads the key | 2 |
| `screens.prepScreen.heroesFireTheirOwn` | Heroes fire their own Solos a moment after they charge, unless you Cue them first. Kael saves his wall for a big hit, but never for more than 3 seconds. | goes when the input step lands: its screen still reads the key | 30 |
| `hud.howToPlay.leadThemDuetsAnd` | Lead them: Duets and Trios | Duets and Trios | 5 → 3 |
| `hud.howToPlay.goodSupportFillsResonance` | Good support fills Resonance. As the Conductor a Cue costs {cueCost}{value}. Cue a second hero within {Number} s of the first and their Solo plays as a Duet, {morePct} stronger; a third in a row is a Trio, {morePct2} stronger. {crescendoName} costs {crescendoCost}: every hero plays their Solo in turn, rising, then every Solo is full again. | gone | 57 → 0 |
| `hud.howToPlay.buildResonance` | Build Resonance | gone | 2 → 0 |
| `hud.howToPlay.goodSupportFillsResonance2` | Good support fills Resonance. Spend {cost} Resonance to Cue a charged hero’s Solo ({levelName} raises it this run), or a full song on your Crescendo. | gone | 25 → 0 |
| `hud.howToPlay.goodSupportFillsResonance3` | Good support fills Resonance. Spend a segment to Cue a charged hero’s Solo, or a full song on your Crescendo. | gone | 20 → 0 |
| `hud.hints.yourHeroesCanT` | {crescendoName}: your heroes can’t fall below 1 life — what gets past them comes to you, softened | {crescendoName}: no hero falls below 1 life. The rest comes to you, softened | 16 → 13 |
| `hud.hints.everyEnemyWaitsYour` | {crescendoName}: every enemy waits — your techniques have no cooldowns{value} while it lasts. Ward {Q}, Chime {E} and Rewind {F} freely | {crescendoName}: every enemy waits. Your techniques have no cooldowns{value} | 20 → 9 |
| `hud.hints.oneResonanceSegment` | one Resonance segment | gone | 3 → 0 |
| `hud.hints.cueOnTheDownbeat` | Cue on the downbeat: it costs only {downbeatCost} Resonance. The light under your Resonance shows the beat | gone | 17 → 0 |
| `hud.hints.cueOnTheDownbeat2` | Cue on the downbeat: it’s free. The light under your Resonance shows the beat | gone | 14 → 0 |
| `hud.hints.yourCrescendoCancelsIt` | {FORTISSIMO_NAME} — your Crescendo {crescendo} cancels it: press it now | {FORTISSIMO_NAME}. Press {crescendo}: your Crescendo cancels it | 9 → 7 |
| `hud.hints.holdResonanceYourCrescendo` | {FORTISSIMO_NAME}: hold {crescendoCost} Resonance — your Crescendo {crescendo} cancels it | Save {crescendoCost} Resonance: your Crescendo {crescendo} cancels {FORTISSIMO_NAME} | 9 → 8 |
| `hud.hints.sIsReadyPress` | {name}'s {soloName} is ready — press {{mod}{value}} now to Cue the stronger form, or it fires on its own | gone | 18 → 0 |
| `hud.hints.sIsReadyPress2` | {name}'s {soloName} is ready — press {{mod}{value}} to Cue it (costs {value2}) | gone | 11 → 0 |
| `hud.hints.resonanceIsFullPress` | Resonance is full — press {{bindingLabel}} for {crescendoName} | Resonance is full. Press {{bindingLabel}} for {crescendoName} | 7 → 7 |
| `hud.hints.cueAnotherWithinS` | Cue another within {Number} s for a {linkName}: {name}, {{mod}{value}} | gone | 10 → 0 |
| `hud.hints.playsEverySoloRising` | {crescendoName} {{bindingLabel}} plays every Solo, rising, then fills them all | {crescendoName} {{bindingLabel}} plays every Solo, then refills them | 10 → 8 |
| `hud.hints.everySoloYouLet` | Every Solo you let through feeds the Conductor’s Discord: answer it, or interrupt the soloist (Focus {{bindingLabel}}) | An unanswered Solo feeds Discord. Answer it, or Focus {{bindingLabel}} the soloist to interrupt | 17 → 14 |
| `hud.hints.resonance` | {cueCost} Resonance | gone | 2 → 0 |
| `hud.sighting.cuedItsLamentMarks` | Cued, its Lament marks a hero. Chime it away (in its last second, a Clutch), Ward it, or interrupt the Alto.{undo} | Cued, its Lament marks a hero. Chime it away, Ward it, or interrupt the Alto.{undo} | 21 → 15 |
| `hud.sighting.cuedItsBassoOstinato` | Cued, its Basso Ostinato rings a circle on its target. Ward on the beat (a Perfect), or interrupt the Bass.{value} | Cued, its Basso Ostinato rings a circle on its target. Ward on the beat, or interrupt the Bass.{value} | 20 → 18 |
| `hud.sighting.cuedItsCadenzaCuts` | Cued, its Cadenza cuts a line to the farthest hero: more than their life. Rewind them back out of it, step aside, or interrupt the Tenor.{undo} | Cued, its Cadenza cuts a lethal line to the farthest hero. Rewind them out, step aside, or interrupt the Tenor.{undo} | 26 → 20 |
| `hud.sighting.cuedItsCadenzaCuts2` | Cued, its Cadenza cuts a line to the farthest hero: more than their life. Step aside, Ward them, or interrupt the Tenor; Anchor holds them, it can’t pull them out. | Cued, its Cadenza cuts a lethal line to the farthest hero. Step aside, Ward them or interrupt the Tenor. Anchor holds them: it can’t pull them out. | 30 → 27 |
| `hud.sighting.cuedItsCadenzaCuts3` | Cued, its Cadenza cuts a line to the farthest hero: more than their life. {value} or interrupt the Tenor. | Cued, its Cadenza cuts a lethal line to the farthest hero. {value} or interrupt the Tenor. | 19 → 16 |
| `hud.sighting.cuedItsShatterAria` | Cued, its Shatter Aria shatters a circle around a hero. Scatter so it catches one, Ward the one it’s on, or interrupt the Soprano. | Cued, its Shatter Aria bursts a circle round a hero. Scatter, Ward that hero, or interrupt the Soprano. | 24 → 18 |
| `hud.sighting.itCuesItsMirror` | It Cues its mirror-choir; every blow you leave unanswered feeds its Discord, and at {DISCORD_MAX} it plays {FORTISSIMO_NAME}: your Crescendo cancels it. At the last it stops the music: only your {noteSources} are heard, and eight notes wake your heroes. | It Cues its mirror-choir. Unanswered blows feed Discord. At {DISCORD_MAX} it plays {FORTISSIMO_NAME}: your Crescendo cancels it. | 40 → 17 |
| `hud.keyHints.cueASoloAnother` | Cue a Solo · another within {Number} s: a Duet | gone | 9 → 0 |
| `hud.keyHints.cueASolo` | Cue a Solo | gone | 3 → 0 |
| `hud.keyHints.cueKeys` | {cue} / {mod}1–4 | gone | 2 → 0 |
| `hud.keyHints.crescendoNamed` | Crescendo: {crescendoName} | kept: a label | 2 |
| `hud.keyHints.crescendo` | Crescendo | kept: a label | 1 |
| `screens.resultText.fortissimoSilenceCrescendoBefore` | Fortissimo Silence: Crescendo before Discord fills, or dome, Ward and heal | Fortissimo Silence: sing your Crescendo before Discord fills | 11 → 8 |
| `screens.resultText.cued` | Cued {cues} {cuesWord}{value}. | {cues} {cuesWord} Cued{value}. | 3 → 3 |
| `screens.resultText.andSang` |  and sang {crescendos} {crescendosWord} | , {crescendos} {crescendosWord} sung | 4 → 3 |
| `screens.summaryScreen.cues` | Cues | Cued Solos | 1 → 2 |
| `screens.summaryScreen.cuedSungToSafety` | {cues} {cuesWord} cued, {crescendos} {crescendosWord} sung, {reels} {reelsWord} to safety. | {cues} {cuesWord} Cued, {crescendos} {crescendosWord} sung, {reels} {reelsWord} to safety. | 10 → 10 |
| `a11y.flashes.hint` | Full-screen flashes on Perfect, Save and Crescendo, and how bright bursts, impact flashes and the Thread’s pulses are. 0 turns the full-screen ones off. | How bright flashes, bursts and the Thread’s pulses are. 0 turns full-screen flashes off. | 24 → 14 |
| `a11y.settings.heroAutonomy` | Hero autonomy | goes when the input step lands: its screen still reads the key | 2 |
| `a11y.settings.heroesFireTheirOwn` | Heroes fire their own Solos a moment after they charge, unless you Cue them first. Kael saves his wall for a big hit, but never for more than 3 seconds. | goes when the input step lands: its screen still reads the key | 30 |
| `input.padAction.cueReticle` | Cue the reticle’s hero | goes when the input step lands: its screen still reads the key | 4 |
| `input.controls.pressModifierAria` | Press the Cue modifier (Escape cancels) | goes when the input step lands: its screen still reads the key | 6 |
| `input.controls.modifierName` | the Cue modifier | goes when the input step lands: its screen still reads the key | 3 |
| `input.controls.cueHint` | With {mod}: Cue their Solo | goes when the input step lands: its screen still reads the key | 5 |
| `input.options.mouseover.hint` | Ward, Reel, Chime and Cue go to the hero under the cursor. Off: always the threaded hero. | Ward, Reel and Chime go to the hero under the cursor. Off: the threaded hero. | 17 → 15 |
| `input.options.cueModifier` | Cue modifier | goes when the input step lands: its screen still reads the key | 2 |
| `input.options.cueModifier.hint` | Held with a hero’s Thread key, Cues their Solo | goes when the input step lands: its screen still reads the key | 9 |
| `input.pad.sticks` | Left stick: move. Right stick: flick the reticle between heroes, or aim the Directive wheel while it’s open. The reticle’s hero is the one your techniques and Cues go to. | Left stick: move. Right stick: flick the reticle between heroes, or aim the Directive wheel. Your techniques go to the reticle’s hero. | 30 → 22 |
| `input.labels.waitsForYourSong` | Waits for your song: frozen by the Grand Silence, it can’t move, attack, take a call or a Cue. Your Ward, Chime, Reel and Mend still reach them. | Frozen by the Grand Silence. Your Ward, Chime, Reel and Mend still reach them. | 28 → 14 |
| `input.labels.crescendo` | Crescendo | kept: a label | 1 |

Of the 55: 23 shorter, 14 gone, 3 same, 1 longer, 14 kept.
