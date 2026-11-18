# part1sheet.py <rawdir> <out.png>: the one before-and-after sheet for Part 1: a row for each kind
# of mark, two figures to a row, each at the game camera and close, "Before" (main) and "After".
import sys, json, os, subprocess
raw, out = sys.argv[1:3]
ROWS = [
    ('stun', ['Stun stars', 'Stun stars'], [('kael', 'Kael'), ('lyra', 'Lyra')]),
    ('bleed', ['Bleed pips, Wound, badge'] * 2, [('kael', 'Kael'), ('lyra', 'Lyra')]),
    ('combo', ['Pips with the Mend glyph'] * 2, [('kael', 'Kael'), ('lyra', 'Lyra')]),
    ('perfect', ['PERFECT'] * 2, [('kael', 'Kael'), ('lyra', 'Lyra')]),
    ('saved', ['SAVED'] * 2, [('kael', 'Kael'), ('lyra', 'Lyra')]),
    ('numbers', ['Heal and damage numbers'] * 2, [('kael', 'Kael'), ('lyra', 'Lyra')]),
    ('bond', ['Bond mark, Oathkeeper', "Bond mark, Hawk's Vigil"], [('kael', 'Kael'), ('lyra', 'Lyra')]),
    ('relic', ['Relic mark, Glass Halo'] * 2, [('kael', 'Kael'), ('lyra', 'Lyra')]),
    (('seren', 'oro'), ['Crossed blades (en garde)', 'Tending drop'], [('seren', 'Seren'), ('oro', 'Oro')]),
    (('relic', 'relic'), ['Cracked Metronome'], [('weaver', 'the Weaver')]),
]
panels = []
missing = 0
for scene, what, whos in ROWS:
    for i, (who, wn) in enumerate(whos):
        sc = scene[i] if isinstance(scene, tuple) else scene
        short = what[i]
        for cam, cn in (('game', 'game camera'), ('close', 'close-up')):
            for t, label in (('before', 'Before'), ('after', 'After')):
                f = f'{raw}/p1-{sc}-{who}-{cam}-{t}.png'
                if not os.path.exists(f):
                    print('missing', f); missing += 1
                    continue
                panels.append({'img': f, 'label': label, 'note': f'{short} · {wn} · {cn}'})
spec = {'out': out, 'title': 'Part 1. The marks over the larger heroes that are not aura, ornament or Calling drawing: Before (main) and After', 'cols': 8, 'width': 340, 'font': 17, 'panels': panels,
        'footer': ['Each mark is placed from the height the hero is drawn at (1.12 times the old one): 0.24 m higher on Kael, 0.22 m on Lyra and Seren, 0.20 m on Oro and the Weaver. Nothing else about it changes.',
                   'Staged in the VFX lab: the same fight, frame and camera in both builds (close-up: a camera 11 m from the head, at the game camera\'s angle). Marks over enemies are not moved.']}
json.dump(spec, open(f'{raw}/part1-sheet.json', 'w'))
if missing: print('MISSING', missing)
subprocess.run(['python3', '-I', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'panels.py'), f'{raw}/part1-sheet.json'], check=True)
