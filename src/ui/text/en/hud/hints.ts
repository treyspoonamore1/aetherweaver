import type { Catalogue } from '../../catalogue';

/** The `hud.hints.*` messages: `src/ui/hud/hints.ts`. */
export const hints = {
  'hud.hints.fermataHoldsAt1':
    'Fermata holds {name} at 1 life — one touch of the Thread saves {him}, even halved: {value}',
  'hud.hints.keepMending': 'keep Mending {him}',
  'hud.hints.fermataIsHoldingAt':
    'Fermata is holding {name} at 1 life — keep Mending them, or Chime {E} on them, before it ends',
  'hud.hints.justWentDownPress':
    '{name} just went down — press {toRewind}: Rewind stands them back up, once a run ({secondsLabel} left)',
  'hud.hints.isCallingForA':
    '{name} is calling for a Ward — press {Q} on them before the ring runs out for {flourish}',
  'hud.hints.isCallingForA2':
    '{name} is calling for a Chime — press {E} on them before the ring runs out for {flourish}',
  'hud.hints.aLethalHitIs':
    'A lethal hit is coming at {name} — {wardIt} just before it lands for a Perfect',
  'hud.hints.aLethalHitIs2':
    'A lethal hit is coming at {name} — Rewind {toRewind}: Paradox undoes it',
  'hud.hints.isInALethal':
    '{name} is in a lethal zone — Rewind {toRewind} takes them back out of it',
  'hud.hints.aBigHitIs':
    'A big hit is coming at {name} — {wardIt} just before it lands for a Perfect',
  'hud.hints.isMarkedPressTo': '{name} is marked — press {E} ({variantName}) to cleanse it',
  'hud.hints.isMarkedPressTo2': '{name} is marked — press {E} to Chime it away',
  'hud.hints.isMarkedAWard': '{name} is marked — a Ward {Q} can still soak the blast',
  'hud.hints.tookABigBlow':
    '{name} took a big blow — Rewind {toRewind} gives back {amount}: their life and place from {seconds} s ago',
  'hud.hints.bearTakePartOf': '{B} Bear — take part of the big hit coming at {name} on yourself',
  'hud.hints.bearingStopsYourOn':
    'Bearing stops your {value} on {name} — press {B} again to go back',
  'hud.hints.yourHeroesCanT':
    '{crescendoName}: your heroes can’t fall below 1 life — what gets past them comes to you, softened',
  'hud.hints.everyEnemyWaitsYour':
    '{crescendoName}: every enemy waits — your techniques have no cooldowns{value} while it lasts. Ward {Q}, Chime {E} and Rewind {F} freely',
  'hud.hints.andCostLess': ' and cost {less}% less',
  'hud.hints.isOutsideYourField':
    '{name} is outside your field — move closer so your auras reach them',
  'hud.hints.isOutsideYourField2':
    '{name} is outside your field — move closer so your auras reach them, or Reel {F} them in',
  'hud.hints.yourBeamSongPours':
    'Your beam song pours into whoever you thread: {mult} on {name}. Everyone else near you hears an echo',
  'hud.hints.yourBeamSongPours2':
    'Your beam song pours into whoever you thread: {mult} on {name}, and nobody else',
  'hud.hints.oneResonanceSegment': 'one Resonance segment',
  'hud.hints.foresightIsComingFor':
    'Foresight: {name} is coming for {name2} ({value}) — be ready before it begins',
  'hud.hints.anyMoment': 'any moment',
  'hud.hints.isComingAnswerIt': '{name} is coming — answer it with {names}',
  'hud.hints.yourPedalPointField':
    'Your Pedal Point field stays where you plant it — press {V} to plant it under the fight',
  'hud.hints.rewindYourThreadedHero':
    '{F}: Rewind — your threaded hero goes back {seconds} s: where they stood and the life they had. Once a run, it stands up a hero who just fell. It replaces Reel',
  'hud.hints.bearTakePartOf2':
    '{B}: Bear — take part of a big hit on your threaded hero. Your songs hold your Life, not your Spirit',
  'hud.hints.bearHasNoKey':
    'Bear has no key — bind one in Settings → Controls to take part of a big hit on your threaded hero',
  'hud.hints.cueOnTheDownbeat':
    'Cue on the downbeat: it costs only {downbeatCost} Resonance. The light under your Resonance shows the beat',
  'hud.hints.cueOnTheDownbeat2':
    'Cue on the downbeat: it’s free. The light under your Resonance shows the beat',
  'hud.hints.isInALethal2': '{name} is in a lethal zone — {variantName} {F} on them',
  'hud.hints.isInALethal3': '{name} is in a lethal zone — Reel them out {F}',
  'hud.hints.isCondemnedWardYour':
    '{executeTarget} is condemned — Ward {Q} {obj}: your healing barely takes on {obj}',
  'hud.hints.isCondemnedLiftThem':
    '{executeTarget} is condemned — lift them above {pct}% before it lands, or Ward {Q} them',
  'hud.hints.isBleedingChimeOn':
    '{name} is bleeding ×{bleed} — Chime {E} on them to cleanse every stack',
  'hud.hints.isPinnedAWard': '{name} is pinned — a Ward {Q} soaks what the pin deals',
  'hud.hints.isPinnedReelFrees': '{name} is pinned — Reel {F} frees them',
  'hud.hints.aLeechHasLatched': 'A Leech has latched onto {name} — Chime {E} frees them',
  'hud.hints.aLeechHasLatched2':
    'A Leech has latched onto {name} — Reel {F} or Chime {E} frees them',
  'hud.hints.isWoundedHealingOn':
    '{name} is Wounded: healing on them is halved — Chime {E} before you Mend',
  'hud.hints.reelFreesAPinned': '. Reel {F} frees a pinned hero into your pool',
  'hud.hints.bloodlustWonTRally':
    'Bloodlust: {name} won’t Rally below {bloodlustPct}% — {mawRescue}',
  'hud.hints.bloodlustWonTRally2':
    'Bloodlust: {name} won’t Rally below {bloodlustPct}% — Ward {Q} {him}{value}{value2}',
  'hud.hints.ironWillBringsBack': ' (Iron Will brings {him} back)',
  'hud.hints.orReel': ' or Reel {F} {him}',
  'hud.hints.fightsHarderHurtWard': '{name} fights harder hurt — Ward {Q} {him}, don’t Mend {him}',
  'hud.hints.swapPutsYouIn': 'Swap puts you in her duel; Rally {C} brings her home',
  'hud.hints.isSurroundedRallyShe':
    '{name} is surrounded — Rally {C}: she always comes. Rewind only takes her back as the pack closes',
  'hud.hints.isSurroundedRallyShe2':
    '{name} is surrounded — Rally {C}: she always comes, and your Anchor holds while she does',
  'hud.hints.isSurroundedReelHer':
    '{name} is surrounded — Reel {F} her home, or Rally {C}: she always comes',
  'hud.hints.isBeyondYourReach':
    '{name} is beyond your reach — Glide {G} toward her so your Ward and Reel reach her',
  'hud.hints.duelsAloneWardHer':
    '{name} duels alone: Ward {Q} her before the blow lands, Reel {F} or Rally {C} when they surround her',
  'hud.hints.aPerfectWardOn': 'A Perfect Ward {Q} on {name} is a kill shot',
  'hud.hints.sSaplingsAreOutside':
    '{name}’s Saplings are outside your songs: walk back, or Rally {C} to re-plant them',
  'hud.hints.bossesAndTheBiggest': 'Bosses and the biggest foes ignore Saplings',
  'hud.hints.rewindOneItDrags': 'Rewind {F} one it drags in',
  'hud.hints.rewindHimBackOnce': 'Rewind {F} him back once it drags him',
  'hud.hints.anchorBeforeItDrags': 'Anchor {F} {who} before it drags {them} in',
  'hud.hints.theyStay': 'they stay',
  'hud.hints.heStays': 'he stays',
  'hud.hints.reelOut': 'Reel {F} {who} out',
  'hud.hints.silencingElite': 'Silencing elite',
  'hud.hints.willCutYourThread':
    '{name} will cut your Thread — Thread a hero on your side of the line, or step across it',
  'hud.hints.wonTRallyBelow': '. {name} won’t Rally below {bloodlustPct}% — {mawRescue}',
  'hud.hints.aVoidMawBreathes':
    'A Void Maw breathes in — Rally {rally} the party to you: Swap puts you in the Maw{brann}',
  'hud.hints.aVoidMawBreathes2':
    'A Void Maw breathes in — Rally {rally} the party to you before the pull, or {mawRescue}{brann}',
  'hud.hints.isPossessedChimeOn': '{name} is possessed{value} — Chime {E} on them frees them',
  'hud.hints.andStrikes': ' and strikes {victim}',
  'hud.hints.aDoubtWraithReaches':
    'A Doubt Wraith reaches for {name} — Focus it {focus} to interrupt the cast, or Chime {E} the mark',
  'hud.hints.aDoubtWraithIs': 'A Doubt Wraith is casting — Focus it {focus} to interrupt the cast',
  'hud.hints.doomIgnitesOnChime': 'Doom ignites on {name} — Chime {E} it, or Ward {Q} the blast',
  'hud.hints.carriesDoomChimeBefore':
    '{name} carries Doom {doomCount} — Chime {E} before it ignites, or Ward {Q} the blast',
  'hud.hints.areStitchedToThe':
    '{stitched} are stitched to the floor — a Chime {E} frees each one it reaches{value}',
  'hud.hints.aReelTheOne': ', a Reel {F} the one it pulls',
  'hud.hints.isStitchedToThe':
    '{name} is stitched to the floor — Chime {E} on them frees them{value}',
  'hud.hints.orReelThemFree': ', or Reel {F} them free',
  'hud.hints.spindlesShieldTheBoss':
    'Spindles shield the boss: −{spindleCutPct}% damage while one stands — Focus them {focus}',
  'hud.hints.wasStolenFocusThe':
    '{name} was stolen — Focus the Stolen Verse {focus} to take it back{value}',
  'hud.hints.yourRadianceCountsOne': ': your Radiance counts one aura fewer until then',
  'hud.hints.theUnweaverWardsIts':
    'The Unweaver Wards its champion — interrupt the Mirror Ward, and Focus the champion {focus}',
  'hud.hints.aMimicIsCopying':
    'A Mimic is copying your Ward — cast a Chime {E} instead to crack the mirror, or Focus it {focus}',
  'hud.hints.aMimicIsCopying2':
    'A Mimic is copying your Chime — cast a Ward {Q} instead to crack the mirror, or Focus it {focus}',
  'hud.hints.theGrandSilenceOnly':
    'The Grand Silence: only your {noteSources} are heard. Eight notes bring your heroes back — even the fallen',
  'hud.hints.yourCrescendoCancelsIt':
    '{FORTISSIMO_NAME} — your Crescendo {crescendo} cancels it: press it now',
  'hud.hints.holdResonanceYourCrescendo':
    '{FORTISSIMO_NAME}: hold {crescendoCost} Resonance — your Crescendo {crescendo} cancels it',
  'hud.hints.thread': 'Thread {him} {{value}}',
  'hud.hints.fermataIsHoldingAt2':
    'Fermata is holding {name} at 1 life — Thread them {{value}} or Chime {E} on them before it ends',
  'hud.hints.then': '{{bindingLabel}}, then {F}',
  'hud.hints.isCallingForEmpower':
    '{name} is calling for Empower — Thread them {{value}} in Empower {RMB} before the ring runs out for {flourish}',
  'hud.hints.isDownThreadThem':
    '{name} is down — Thread them {{value}} and let Mend revive them before they bleed out',
  'hud.hints.isHurtClickTheir':
    '{name} is hurt — click their frame or press {{value}} to Thread them',
  'hud.hints.isHurtPressTwice': '{name} is hurt — press {RMB} twice{value} to get back to Mend',
  'hud.hints.orThen': ' (or {B}, then {RMB})',
  'hud.hints.isHurtPressTo': '{name} is hurt — press {RMB} to switch the Thread back to Mend',
  'hud.hints.yourAurasAreSilenced':
    'Your auras are silenced — bring the party into a hymn circle with Rally {{bindingLabel}}',
  'hud.hints.yourAurasAreSilenced2':
    'Your auras are silenced — mark the {silencerName} with {{bindingLabel}} so the party breaks its dome',
  'hud.hints.sIsReadyPress':
    "{name}'s {soloName} is ready — press {{mod}{value}} now to Cue the stronger form, or it fires on its own",
  'hud.hints.sIsReadyPress2':
    "{name}'s {soloName} is ready — press {{mod}{value}} to Cue it (costs {value2})",
  'hud.hints.resonanceIsFullPress':
    'Resonance is full — press {{bindingLabel}} for {crescendoName}',
  'hud.hints.yourPartyIsSpread':
    'Your party is spread out — hold {{bindingLabel}} and flick toward Rally to call them to you',
  'hud.hints.holdOrTheMiddle':
    'Hold {{bindingLabel}} (or the middle mouse button) for the Directive wheel: Focus, Rally, Hold, Scatter',
  'hud.hints.holdOrTheWheelButton':
    'Hold {{bindingLabel}} (or {{wheel}}) for the Directive wheel: Focus, Rally, Hold, Scatter',
  'hud.hints.clickAPartyFrame':
    'Click a party frame or press {1} to attach your Thread — Mend heals, Empower hits harder',
  'hud.hints.everyoneIsHealthyPress':
    'Everyone is healthy — press {RMB} to switch the Thread to Empower and add damage',
  'hud.hints.cueAnotherWithinS':
    'Cue another within {Number} s for a {linkName}: {name}, {{mod}{value}}',
  'hud.hints.playsEverySoloRising':
    '{crescendoName} {{bindingLabel}} plays every Solo, rising, then fills them all',
  'hud.hints.aBloodPactScatter':
    '{pact} {value} a Blood Pact — Scatter {{bindingLabel}}: Chime can’t break it',
  'hud.hints.aCrimsonSentinelS':
    'A Crimson Sentinel’s shield blocks most of a blow from the front — Focus it {{bindingLabel}} so the party flanks',
  'hud.hints.bloodmoonHealingIsHalved':
    'Bloodmoon: healing is halved outside the pools — stand in one and Rally {{bindingLabel}} the party to you{value}',
  'hud.hints.wonTFightWithout': '{name} won’t fight without a Focus {{bindingLabel}}',
  'hud.hints.holdSoOutsideIt': 'Hold {{bindingLabel}} so {value} outside it',
  'hud.hints.youStandInA':
    'You stand in a Null rune: Ward, Chime and {value} are refused — Glide {{bindingLabel}} or walk out of it',
  'hud.hints.yourThreadWasCut':
    'Your Thread was cut — re-thread {1}–{3} the moment the lock ends ({secondsLabel})',
  'hud.hints.unravelYourMendWounds':
    'Unravel: your Mend wounds — press {RMB} for Empower, or Bear {{bindingLabel}}, until it passes',
  'hud.hints.unravelYourMendWounds2':
    'Unravel: your Mend wounds — press {RMB} for Empower until it passes',
  'hud.hints.aMimicIsCopying3':
    'A Mimic is copying your Empower — switch the Thread to Mend {RMB} to crack the mirror',
  'hud.hints.everySoloYouLet':
    'Every Solo you let through feeds the Conductor’s Discord: answer it, or interrupt the soloist (Focus {{bindingLabel}})',
  'hud.hints.mend': 'Mend',
  'hud.hints.empower': 'Empower',
  'hud.hints.resonance': '{cueCost} Resonance',
  'hud.hints.in': 'in {secondsLabel}',
  'hud.hints.share': 'share',
  'hud.hints.carries': 'carries',
  'hud.hints.rewind': 'Rewind',
  'hud.hints.reel': 'Reel',
  'hud.hints.ward': 'Ward {Q}',
  'hud.hints.mute': 'Mute',
} satisfies Catalogue;
