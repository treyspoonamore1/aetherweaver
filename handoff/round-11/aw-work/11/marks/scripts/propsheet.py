# propsheet.py <rawdir> <outdir>: one "Now / Proposed" sheet per proposal: the hero or the Weaver
# the mark sits on, at the game camera and close. "Now" is the game with Part 1; "Proposed" adds
# the proposal.
import sys, json, os, subprocess
raw, out = sys.argv[1:3]
os.makedirs(out, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
# name, title, proposed tag, rows of (scene, who, caption)
SHEETS = [
    ('P1-pour-label', "P1. The pour's label over the hero the Thread moved to", 'prop',
     [('pour', 'kael', "Pour's label · Kael"), ('pour', 'lyra', "Pour's label · Lyra")]),
    ('P2-luminary', "P2. The Luminary: the Dawn callout, the Radiance shaft, the Sovereign circlet", 'prop',
     [({'game': 'dawn2', 'close': 'dawn3'}, 'kael', 'Dawn callout · Kael'), ({'game': 'dawn2', 'close': 'dawn3'}, 'lyra', 'Dawn callout · Lyra'),
      ('radiance', 'kael', 'Radiance shaft · Kael'), ('circlet', 'weaver', 'Sovereign circlet · the Weaver')]),
    ('P3-martyr', "P3. The Martyr: the Vow's seals over the heroes, the ember over the Weaver", 'prop',
     [('vow', 'kael', "Vow's seal · Kael"), ('vow', 'lyra', "Vow's seal · Lyra"), ('ember', 'weaver', 'Ember · the Weaver')]),
    ('P4-chronomancer', "P4. The Chronomancer: the mastery mark and the Stasis clock over the Weaver", 'prop',
     [('mastery', 'weaver', 'Temporal Mastery · the Weaver'), ('stasis', 'weaver', 'Stasis starting · the Weaver')]),
    ('P5-conductor', "P5. The Conductor: the chain sigil, Marcato's mark, the Spotlight", 'prop',
     [('sigil', 'kael', 'Chain sigil (a Duet) · Kael'), ('sigil', 'lyra', 'Chain sigil (a Duet) · Lyra'),
      ('marcato', 'kael', "Marcato's mark · Kael"), ('spotlight', 'lyra', 'Spotlight · Lyra')]),
    ('P6-target-mark', "P6. The target mark over a marked hero, and Foresight's outline of it", 'prop', 'MARK'),
    ('P7-fermata-shell', "P7. Fermata's shell round a held hero (the one chest anchor whose move shows)", 'chest',
     [('shell', 'kael', "Fermata's shell · Kael"), ('shell', 'lyra', "Fermata's shell · Lyra")]),
]
only = sys.argv[3] if len(sys.argv) > 3 else None
for name, title, tag, rows in SHEETS:
    if only and only not in name: continue
    if rows == 'MARK':
        rows = []
        for who in ('kael', 'lyra', 'vexis'):
            if os.path.exists(f'{raw}/p2-mark-{who}-game-now.png'):
                rows.append(('foreseen', who, f"Foresight's outline · {who.capitalize()}"))
                rows.append(('mark', who, f'The mark · {who.capitalize()}'))
    panels = []
    for scene, who, cap in rows:
        for cam, cn in (('game', 'game camera'), ('close', 'close-up')):
            for t, label in (('now', 'Now'), (tag, 'Proposed')):
                sc = scene[cam] if isinstance(scene, dict) else scene
                f = f'{raw}/p2-{sc}-{who}-{cam}-{t}.png'
                if not os.path.exists(f):
                    print('missing', f); continue
                panels.append({'img': f, 'label': label, 'note': f'{cap} · {cn}'})
    if len(panels) < 4:
        print('skip', name, len(panels)); continue
    spec = {'out': f'{out}/{name}.png', 'title': title, 'cols': 4, 'width': 420, 'font': 19, 'panels': panels,
            'footer': ['"Now" is the game with Part 1 landed; "Proposed" places this mark from the height the figure is drawn at (1.12 times the old one) and changes nothing else.']}
    json.dump(spec, open(f'{raw}/{name}.json', 'w'))
    subprocess.run(['python3', '-I', f'{HERE}/panels.py', f'{raw}/{name}.json'], check=True)
