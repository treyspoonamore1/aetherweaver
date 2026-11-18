"""Item 8's text edits: each (file, key, new text). A file is written only if every key in it is found."""
import re, sys, os
WT = '/home/user/aw-work/wt-p11menu/src/ui/text/en/'
E = {
 'screens/prepScreen.ts': {
  'screens.prepScreen.youAreTheWeaver': 'These three fight on their own. You keep them alive and make them hit harder. Your',
  'screens.prepScreen.ridesTheThreadWhoever': 'rides your Thread at {mult}.',
  'screens.prepScreen.surroundsYouAtFull': 'reaches everyone near you.',
 },
 'screens/chordModel.ts': {
  'screens.chordModel.reserveLifeInsteadAnd': '{who} reserve Life. With Eldritch Conduit your techniques cost Life too.',
  'screens.chordModel.reserveLifeInsteadEvery': '{who} reserve Life. All your Spirit powers Ward, Chime and {reel}.',
  'screens.chordModel.whateverSpiritYourAuras': 'Spirit your auras leave free powers Ward, Chime and {reel}.',
 },
 'screens/chordBuilder.ts': {
  'screens.chordBuilder.ofSpiritFree': '{free} of {max} Spirit free. {value}.',
  'screens.chordBuilder.ofLifeToFight': '{free} of {max} Life to fight with. {value}. Your songs may hold at most {capPct}%.',
 },
 'screens/loomModel.ts': {
  'screens.loomModel.everyRunStartsHere': 'Every run starts here. In Prep you choose your songs: the auras that heal your heroes or make them hit harder. A run you leave waits here.',
  'screens.loomModel.oneRunTheSame': 'One run, the same for everyone this week. Its seed, route, Calling, heroes and Dissonance are fixed. Your Chords are your own. Share your result as a code and replay.',
 },
 'screens/atlasParts.ts': {
  'screens.atlasParts.oneRunTheSame': 'One run, the same for everyone from Monday to Monday (UTC). Only your Chords and technique variants are your own. It scores each fight won, its grade, and a won run. Share it as a code and a replay file.',
 },
 'screens/bondsModel.ts': {
  'screens.bondsModel.afterEveryFightEach': 'Every fight pays each hero in it {base} Bond XP. They share {pool} more by your support: healing and shields on them, damage your songs and Thread added, and life your saves kept.',
 },
 'screens/callingScreen.ts': {
  'screens.callingScreen.yourFieldSongNow': 'Your field song now holds a third aura, in the slot marked {name}. Rebuild your songs for free, or fill it later at a Respite or a forge.',
 },
 'hud/weaverBar.ts': {
  'hud.weaverBar.thisFightYourAuras': 'This fight, your auras healed {compact}, shielded {compact2} and added {compact3} damage. Your Thread healed {compact4} and added {compact5}.',
 },
 'hud/hints.ts': {
  'hud.hints.fermataHoldsAt1': 'Fermata holds {name} at 1 life. One touch of the Thread saves {him}, even halved: {value}',
  'hud.hints.fermataIsHoldingAt': 'Fermata is holding {name} at 1 life. Keep Mending them, or Chime {E} on them, before it ends',
  'hud.hints.isOutsideYourField': '{name} is outside your field. Move closer so your auras reach them',
  'hud.hints.isOutsideYourField2': '{name} is outside your field. Move closer so your auras reach them, or Reel {F} them in',
  'hud.hints.yourPedalPointField': 'Your Pedal Point field stays where you plant it. Press {V} to plant it under the fight',
  'hud.hints.fermataIsHoldingAt2': 'Fermata is holding {name} at 1 life. Thread them {{value}} or Chime {E} on them before it ends',
  'hud.hints.yourAurasAreSilenced': 'Your auras are silenced. Bring the party into a hymn circle with Rally {{bindingLabel}}',
  'hud.hints.yourAurasAreSilenced2': 'Your auras are silenced. Mark the {silencerName} with {{bindingLabel}} so the party breaks its dome',
 },
 'screens/codexScreen.ts': {
  'screens.codexScreen.whereverTheyAreAnd': ', wherever they are. Its hexes hit whatever attacks them. Everyone else in its field hears an echo at',
  'screens.codexScreen.whoYouThreadDecides': '. Mend or Empower, it plays the same.',
  'screens.codexScreen.yourSecondChordSurrounds': 'Your second Chord surrounds you: everyone within {fieldRadius} m hears it at full strength. Each song holds {auraSlots} auras and up to {ornamentSlots} ornaments. An ornament changes both auras in its song. You own one copy of each.',
  'screens.codexScreen.withTheFermataAura': 'Sing Fermata and, once a fight for each hero, a hit that would down them holds them at 1 life for {value} s. Their frame shows ',
  'screens.codexScreen.withACountdownHeal': 'Mend or Chime them in time for a Save.',
  'screens.codexScreen.eachPickLastsThe': 'Each pick lasts the run. The map marks the fights that bring one. The auras never change: a Calling adds to your songs’ reach, strength or slots, and the Martyr’s reserve Life instead of Spirit. Some bring a key: the Martyr’s Bear ({bindingLabel}), and the Chronomancer’s Rewind on Reel’s ({bindingLabel2}).',
  'screens.codexScreen.tieYourThreadTo': 'Tie your Thread to a hero. Mend heals them. Empower adds damage and attack speed. Your beam song rides it. Stray too far and it snaps. As the Martyr, Bear ({bindingLabel}) takes part of the life they would lose.',
  'screens.codexScreen.whenAFightEnds': 'After a fight, the Loom replays it without you: no Thread, no auras, no techniques. Same enemies, same seed. The Result shows both side by side, and the Summary counts the fights they would have lost. Capped at {round} minutes.',
  'screens.codexScreen.everyFightEarnsWeaver': 'Every fight earns Weaver XP, won or lost. Each Rank opens one more piece of your build: the beam song first, the rest as you learn. Quitting a run never loses XP. ',
 },
}
words = lambda s: len([w for w in s.split() if re.search(r'\w', w)])
ok = True
for f, m in E.items():
    p = WT + f
    s = open(p, encoding='utf8').read()
    for k, new in m.items():
        pat = re.compile(r"('" + re.escape(k) + r"':\s*)('(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\")")
        mm = pat.search(s)
        if not mm:
            print('MISSING', k); ok = False; continue
        old = mm.group(2)
        q = "'" if "'" not in new else '"'
        assert '"' not in new or q == "'"
        s = s[:mm.start(2)] + q + new + q + s[mm.end(2):]
        print(f'{k.split(".")[-1]}: {words(old[1:-1])} -> {words(new)}')
    if ok and '--write' in sys.argv:
        open(p, 'w', encoding='utf8').write(s)
print('ok' if ok else 'FAILED')
