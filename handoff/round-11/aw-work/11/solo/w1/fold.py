# Folds the Resonance scale (0.5) into the content's numbers: every gain is written as what it
# gives. Run once, from the worktree root: python3 -I /home/user/aw-work/11/solo/w1/fold.py
import io

def edit(path, pairs):
    s = io.open(path, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a, s.count(a))
        s = s.replace(a, b)
    io.open(path, 'w', encoding='utf8').write(s)

edit('src/content/weaver.ts', [
    ("""    perfectWard: 20,
    save: 25,
    clutchChime: 15,
    reelDodge: 15,
    cleanse: 5,
    wardAbsorb: 5,
    empowerPerSec: 1,
    empoweredKill: 2,
    response: 10,
""", """    perfectWard: 10,
    save: 12.5,
    clutchChime: 7.5,
    reelDodge: 7.5,
    cleanse: 2.5,
    wardAbsorb: 2.5,
    empowerPerSec: 0.5,
    empoweredKill: 1,
    response: 5,
"""),
    ("""  // Halved when Cues stopped costing Resonance (docs/solos.md): it lands the Crescendo about as
  // often as before. Tuning's lever; when it settles, fold it into the gains and their texts.
  gainScale: 0.5,
""", """  // Every gain above, and every gain a motif, relic, Bond or Calling names, is half what it was
  // while a Cue cost Resonance (docs/solos.md): the meter now pays for the Crescendo alone. The
  // numbers are written as what they give, so this stays 1; the Solo study varies it for a run
  // (tools/solo-study.ts `--gain-scale`).
  gainScale: 1,
"""),
])
edit('src/content/astrolabe.ts', [
    ("values: { pct: 25, resonance: 2.5 },", "values: { pct: 25, resonance: 1.25 },"),
    ("""    effect: 'ready_answer',
    values: { resonance: 2.5 },""", """    effect: 'ready_answer',
    values: { resonance: 1.25 },"""),
])
edit('src/content/fill/aegis.ts', [
    ("""    values: [5, 8, 10],
    text: 'A Clutch Cleanse gives {v} more Resonance.',""", """    values: [2.5, 4, 5],
    text: 'A Clutch Cleanse gives {v} more Resonance.',"""),
])
edit('src/content/fill/silk.ts', [
    ("""    values: [2, 3, 4],
    text: 'Kills by an Empowered hero give {v} more Resonance.',""", """    values: [1, 1.5, 2],
    text: 'Kills by an Empowered hero give {v} more Resonance.',"""),
])
edit('src/content/fill/finale.ts', [
    ("""    values: [10, 15, 25],
    text: 'Your first Cue in each fight gives {v} Resonance.',""", """    values: [5, 7.5, 12.5],
    text: 'Your first Cue in each fight gives {v} Resonance.',"""),
    ("""    values: [5, 8, 10],
    text: 'Each Save gives {v} more Resonance.',""", """    values: [2.5, 4, 5],
    text: 'Each Save gives {v} more Resonance.',"""),
    ("""    values: [1, 1.5, 2],
    text: 'Mending a hero below 30% of their life makes {v} Resonance a second.',""", """    values: [0.5, 0.75, 1],
    text: 'Mending a hero below 30% of their life makes {v} Resonance a second.',"""),
    ("""    values: [3, 5, 7],
    text: 'Cueing a hero within 4 s of Cueing another gives {v} Resonance.',""", """    values: [1.5, 2.5, 3.5],
    text: 'Cueing a hero within 4 s of Cueing another gives {v} Resonance.',"""),
])
edit('src/content/fill/relics.ts', [
    ("""    values: { resonance: 5 },
    icon: 'whistle',
    empowered: { values: { resonance: 8 } },""", """    values: { resonance: 2.5 },
    icon: 'whistle',
    empowered: { values: { resonance: 4 } },"""),
    ("""    values: { resonance: 25 },
    icon: 'pin',
    empowered: { values: { resonance: 35 } },""", """    values: { resonance: 12.5 },
    icon: 'pin',
    empowered: { values: { resonance: 17.5 } },"""),
    ("""    values: { resonance: 10, slower: 3 },
    icon: 'redink',
    empowered: { values: { resonance: 15 } },""", """    values: { resonance: 5, slower: 3 },
    icon: 'redink',
    empowered: { values: { resonance: 7.5 } },"""),
])
edit('src/content/fill/harmonies.ts', [
    ("text: 'One Cue in every {v} gives a whole segment of Resonance.',",
     "text: 'One Cue in every {v} gives half a segment of Resonance.',"),
])
edit('src/content/bonds.ts', [
    ("values: { range: 2, resonance: 1 },", "values: { range: 2, resonance: 0.5 },"),
])
edit('src/content/motifs.ts', [
    ("""    values: [3],
    text: 'While Brann is below 30% life and you Empower him, your Thread makes {v} Resonance a second.',""",
     """    values: [1.5],
    text: 'While Brann is below 30% life and you Empower him, your Thread makes {v} Resonance a second.',"""),
    ("""    values: [8, 10, 12],
    text: 'Each parry Seren makes grants {v} Resonance. Her kill shots count as parries.',""",
     """    values: [4, 5, 6],
    text: 'Each parry Seren makes grants {v} Resonance. Her kill shots count as parries.',"""),
])
edit('src/content/relics.ts', [
    ("values: { pct: 50, resonance: 10 },", "values: { pct: 50, resonance: 5 },"),
])
edit('src/content/callings.ts', [
    ("""            text: 'Damage you Bear fills Resonance: {per} for every 100.',
            values: { per: 4 },""", """            text: 'Damage you Bear fills Resonance: {per} for every 100.',
            values: { per: 2 },"""),
    ("values: { seconds: 2, resonance: 10 },", "values: { seconds: 2, resonance: 5 },"),
    ("values: { beat: 0.15, resonance: 10 },", "values: { beat: 0.15, resonance: 5 },"),
])
print('content folded')
