# The meter doubles and every gain goes back to the whole number it was: the same economy as the
# halved gains, with every Resonance value twice as large. Run once from the worktree root.
import io

def edit(path, pairs):
    s = io.open(path, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a, s.count(a))
        s = s.replace(a, b)
    io.open(path, 'w', encoding='utf8').write(s)

edit('src/content/weaver.ts', [
    ("""  max: 100,
  segment: 25,
  gains: {
    perfectWard: 10,
    save: 12.5,
    clutchChime: 7.5,
    reelDodge: 7.5,
    cleanse: 2.5,
    wardAbsorb: 2.5,
    empowerPerSec: 0.5,
    empoweredKill: 1,
    response: 5,
  },
  decayDelay: 5,
  decayPerSec: 4,
  // Every gain above, and every gain a motif, relic, Bond or Calling names, is half what it was
  // while a Cue cost Resonance (docs/solos.md): the meter now pays for the Crescendo alone. The
  // numbers are written as what they give, so this stays 1; the Solo study varies it for a run
  // (tools/solo-study.ts `--gain-scale`).
  gainScale: 1,
  crescendoCost: 100,
""", """  // The meter holds 200 in four segments of 50, and a full song costs all of it. It was 100 while a
  // Cue cost Resonance too (docs/solos.md): now that the meter pays for the Crescendo alone it is
  // twice as deep, so a song comes about as often as before with every gain left the whole number
  // it always was. What is a share of the meter doubled with it: the fade, every "start with N",
  // Da Capo, Prompt Book, Maestro's price.
  max: 200,
  segment: 50,
  gains: {
    perfectWard: 20,
    save: 25,
    clutchChime: 15,
    reelDodge: 15,
    cleanse: 5,
    wardAbsorb: 5,
    empowerPerSec: 1,
    empoweredKill: 2,
    response: 10,
  },
  decayDelay: 5,
  decayPerSec: 8,
  // 1: the gains are written as what they give. The Solo study varies it for a run
  // (tools/solo-study.ts `--gain-scale`).
  gainScale: 1,
  crescendoCost: 200,
"""),
])
edit('src/content/astrolabe.ts', [
    ("values: { pct: 25, resonance: 1.25 },", "values: { pct: 25, resonance: 2.5 },"),
    ("""    effect: 'ready_answer',
    values: { resonance: 1.25 },""", """    effect: 'ready_answer',
    values: { resonance: 2.5 },"""),
])
edit('src/content/fill/aegis.ts', [
    ("""    values: [2.5, 4, 5],
    text: 'A Clutch Cleanse gives {v} more Resonance.',""", """    values: [5, 8, 10],
    text: 'A Clutch Cleanse gives {v} more Resonance.',"""),
])
edit('src/content/fill/silk.ts', [
    ("""    values: [1, 1.5, 2],
    text: 'Kills by an Empowered hero give {v} more Resonance.',""", """    values: [2, 3, 4],
    text: 'Kills by an Empowered hero give {v} more Resonance.',"""),
])
edit('src/content/fill/finale.ts', [
    ("""    values: [5, 7.5, 12.5],
    text: 'The first Solo Cued in each fight gives {v} Resonance.',""", """    values: [10, 15, 25],
    text: 'The first Solo Cued in each fight gives {v} Resonance.',"""),
    ("""    values: [2.5, 4, 5],
    text: 'Each Save gives {v} more Resonance.',""", """    values: [5, 8, 10],
    text: 'Each Save gives {v} more Resonance.',"""),
    ("""    values: [0.5, 0.75, 1],
    text: 'Mending a hero below 30% of their life makes {v} Resonance a second.',""", """    values: [1, 1.5, 2],
    text: 'Mending a hero below 30% of their life makes {v} Resonance a second.',"""),
    ("""    values: [1.5, 2.5, 3.5],
    text: 'A Solo Cued within 4 s of another gives {v} Resonance.',""", """    values: [3, 5, 7],
    text: 'A Solo Cued within 4 s of another gives {v} Resonance.',"""),
])
edit('src/content/fill/relics.ts', [
    ("""    values: { resonance: 2.5 },
    icon: 'whistle',
    empowered: { values: { resonance: 4 } },""", """    values: { resonance: 5 },
    icon: 'whistle',
    empowered: { values: { resonance: 8 } },"""),
    ("""    values: { resonance: 12.5 },
    icon: 'pin',
    empowered: { values: { resonance: 17.5 } },""", """    values: { resonance: 25 },
    icon: 'pin',
    empowered: { values: { resonance: 35 } },"""),
    ("""    values: { resonance: 5, slower: 3 },
    icon: 'redink',
    empowered: { values: { resonance: 7.5 } },""", """    values: { resonance: 10, slower: 3 },
    icon: 'redink',
    empowered: { values: { resonance: 15 } },"""),
    ("""    values: { cost: 15 },
    icon: 'promptbook',
    empowered: { values: { cost: 20 } },""", """    values: { cost: 30 },
    icon: 'promptbook',
    empowered: { values: { cost: 40 } },"""),
])
edit('src/content/bonds.ts', [
    ("values: { range: 2, resonance: 0.5 },", "values: { range: 2, resonance: 1 },"),
])
edit('src/content/motifs.ts', [
    ("""    values: [1.5],
    text: 'While Brann is below 30% life and you Empower him, your Thread makes {v} Resonance a second.',""",
     """    values: [3],
    text: 'While Brann is below 30% life and you Empower him, your Thread makes {v} Resonance a second.',"""),
    ("""    values: [4, 5, 6],
    text: 'Each parry Seren makes grants {v} Resonance. Her kill shots count as parries.',""",
     """    values: [8, 10, 12],
    text: 'Each parry Seren makes grants {v} Resonance. Her kill shots count as parries.',"""),
    ("""    values: [25],
    text: 'When the Crescendo ends, you keep {v} Resonance.',""", """    values: [50],
    text: 'When the Crescendo ends, you keep {v} Resonance.',"""),
])
edit('src/content/relics.ts', [
    ("values: { pct: 50, resonance: 5 },", "values: { pct: 50, resonance: 10 },"),
    ("""    values: { resonance: 50 },""", """    values: { resonance: 100 },"""),
    ("""    empowered: { values: { resonance: 75 } },""", """    empowered: { values: { resonance: 150 } },"""),
])
edit('src/content/callings.ts', [
    ("""            text: 'Damage you Bear fills Resonance: {per} for every 100.',
            values: { per: 2 },""", """            text: 'Damage you Bear fills Resonance: {per} for every 100.',
            values: { per: 4 },"""),
    ("values: { seconds: 2, resonance: 5 },", "values: { seconds: 2, resonance: 10 },"),
    ("values: { beat: 0.15, resonance: 15 },", "values: { beat: 0.15, resonance: 30 },"),
    ("""            text: 'Every fight begins with {resonance} Resonance.',
            values: { resonance: 50 },""", """            text: 'Every fight begins with {resonance} Resonance.',
            values: { resonance: 100 },"""),
    ("values: { cost: 75, loops: 2 },", "values: { cost: 150, loops: 2 },"),
])
edit('src/content/reliquary.ts', [
    ("effects: [{ effect: 'start_resonance', value: 12 }],", "effects: [{ effect: 'start_resonance', value: 24 }],"),
])
edit('src/content/crucible.ts', [
    ("No dome: keep 100 Resonance and cancel it with your Crescendo", "No dome: keep 200 Resonance and cancel it with your Crescendo"),
])
edit('src/bots/skilled.ts', [
    ("const FINALE_RESONANCE_RATE = 1;", "const FINALE_RESONANCE_RATE = 2;"),
])
print('meter doubled')
