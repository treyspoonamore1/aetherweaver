"""sheets.py [which...]: builds the sheets in w3/shots from the raw pictures (panels.py lays them out)."""
import json, os, subprocess, sys
from PIL import Image
W = '/home/user/aw-work/11/solo/w3'
RAW, OUT = f'{W}/raw', f'{W}/shots'
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
def build(name, spec):
    spec['out'] = f'{OUT}/{name}.png'
    missing = [p['img'] for p in spec['panels'] if not os.path.exists(p['img'])]
    if missing:
        print(name, 'MISSING', missing); return
    path = f'{RAW}/{name}.json'
    json.dump(spec, open(path, 'w'))
    subprocess.run(['python3', '-I', f'{HERE}/panels.py', path], check=True)
STATE = {'1charging': ('Charging', 'no mark yet'), '2coming': ('Solo coming', 'last 3 s of charge: quiet'),
         '3now': ('Solo full: the 1 s wait', 'Thread elsewhere'),
         '4cued': ('Your Thread on them', 'it will be Cued'), '5fired': ('The Solo fires, Cued', 'the mark is gone')}
def crop_game(src, dst):
    """The game-camera crops are small: scale them up 2x so they sit beside the close-ups."""
    im = Image.open(src); im.resize((im.width * 2, im.height * 2), Image.LANCZOS).save(dst)
which = sys.argv[1:]
want = lambda n: not which or n in which

if want('1'):
    panels = []
    for cam, cn in (('close', 'close-up'), ('game', 'game camera, enlarged')):
        for st in ['1charging', '2coming', '3now', '4cued', '5fired']:
            panels.append({'img': f'{RAW}/m-lyra-{st}-{cam}.png', 'label': STATE[st][0], 'note': f'{STATE[st][1]} · {cn}'})
    build('1-the-mark-tell-wait-thread', {
        'title': 'The mark over a hero whose Solo is coming: the tell, the wait, and your Thread on them (Lyra)',
        'cols': 5, 'width': 420, 'font': 19, 'panels': panels,
        'footer': ['Before this change there was no mark, and a Solo nobody Cued never fired. Now every hero fires their own, and the ring says one is coming.',
                   'Thread elsewhere: a dashed ring round a note. It fills clockwise until the Solo fires. Quiet while the Solo charges; full size, brighter and breathing once it is full.',
                   'Thread on them: the ring turns solid, grows a third, gains eight rays and a light, and sits round the Thread\'s own glyph. That Solo will be Cued.',
                   'Staged in the VFX lab\'s real fight. Close-up: a camera 11 m from the head at the game camera\'s angle. Second row: the game camera\'s own view, enlarged about 1.8 times (sheet 3 shows it at its real size).']})
if want('2'):
    panels = []
    for who, name in (('kael', 'Kael'), ('lyra', 'Lyra'), ('vexis', 'Vexis'), ('brann', 'Brann (the largest)')):
        for st in ['2coming', '3now', '4cued']:
            for cam, cn in (('close', 'close-up'), ('game', 'game camera, enlarged')):
                panels.append({'img': f'{RAW}/m-{who}-{st}-{cam}.png', 'label': f'{name}', 'note': f'{STATE[st][0]} · {cn}'})
    build('2-four-heroes', {
        'title': 'The same mark on Kael, Lyra, Vexis and Brann: coming, full (Thread elsewhere), and with your Thread on them',
        'cols': 6, 'width': 360, 'font': 16, 'panels': panels,
        'footer': ['The mark is anchored at each hero\'s drawn height (r.height x HERO_DRAWN), in the slot the Thread\'s glyph takes, so it clears every head, the tallest included.',
                   'Kael may raise his wall sooner than the ring says (when he is hurt, or a big hit is coming), so his party frame shows no seconds.']})
if want('3'):
    panels = [{'img': f'{RAW}/boss-{"" if k.startswith("first") else "cantor-"}{k}.png', 'label': l, 'note': n} for k, l, n in (
        ('first-a', '0:27. Kael\'s wall will be Cued; Vexis\'s Solo is full too', 'Kael: the rayed ring round the Thread\'s glyph. Vexis: "Thread to Cue 0.9"; her ring stands above her call\'s bubble, here partly behind Kael.'),
        ('a', '0:27, a moment later: Kael\'s dome is up', 'A limit: under the dome\'s bright shells the ring over Vexis is hard to see. Her frame still says "Thread to Cue 1.0".'),
        ('b', '0:56. Kael\'s wall will be Cued; Vexis\'s Solo will not', 'Kael: the rayed ring round the Thread\'s glyph, the gold "Cued" strip. Vexis: the dashed ring above her Chime call, "Thread to Cue 0.5".'),
        ('c', '1:20. Four choristers round the boss; Lyra\'s Solo will be Cued', 'The rayed ring round the Thread\'s glyph on Lyra (top right), beside the enemies\' red outlines. Her frame: "Cued Gale Barrage 0.5".'),
        ('d', '1:24. Vexis\'s Solo coming, the Thread elsewhere', 'The quiet stage: a dashed strip with the Solo\'s name and its seconds, the smaller ring over her.'))
        ]
    build('3-boss-fight', {
        'title': 'In a boss fight: the real game and its whole HUD, the Skilled bot playing (its Thread follows the Solos)',
        'cols': 2, 'width': 1280, 'font': 22, 'panels': panels,
        'footer': ['The Hollow Cantor, seed 4242. Frozen on the first frames that showed each state. Nothing is staged: the enemies, their red outlines, the calls, the decree and the numbers are the fight\'s own.',
                   'Pictures are 1280 x 720 at twice the pixels, shown here at half that.']})
if want('4'):
    panels = [{'img': f'{RAW}/m-marks-{k}-close.png', 'label': l, 'note': n}
              for k, l, n in (
        ('call-now', 'With a call open', 'the mark stands above the bubble'),
        ('call-cued', 'A call, Thread on them', 'the rayed ring above the bubble'),
        ('bleed-now', 'Bleed pips and a Wound', 'the pips sit inside the ring'),
        ('bleed-cued', 'Bleed, Thread on them', 'the Chime badge stays clear above'))]
    build('4-beside-other-marks', {
        'title': 'Beside the other marks over a head: a call\'s bubble, bleed pips, a Wound, the answer badge (close-ups)',
        'cols': 4, 'width': 440, 'font': 18, 'panels': panels,
        'footer': ['A call\'s bubble takes the same slot, so the mark moves up while a call is open. While a Fermata holds a hero the mark stands down: the hold\'s own marks have the slot.',
                   'Bleed pips overlap the note, as they already overlap the Thread\'s glyph (Version 19). The ring, its fill and its rays still read. A known overlap, not solved here.',
                   'Sheet 3 shows a call and the mark together at the game camera\'s real size.']})
if want('5'):
    panels = [{'img': f'{RAW}/m-vision-{v}.png', 'label': l, 'note': n, 'crop': [180, 130, 1780, 1320]} for v, l, n in (
        ('normal', 'Colour vision: normal', 'gold'),
        ('protanopia', 'Protanopia palette', 'white (the palette\'s call colour)'),
        ('deuteranopia', 'Deuteranopia palette', 'white'),
        ('tritanopia', 'Tritanopia palette', 'white'))]
    build('5-colour-vision', {
        'title': 'The colour-vision settings: Lyra\'s mark with the Thread elsewhere (left), Vexis\'s with the Thread on her (top)',
        'cols': 2, 'width': 900, 'font': 20, 'panels': panels,
        'footer': ['The mark takes the palette\'s "call" colour, as a hero\'s call does: gold, or white under the three colour-vision palettes.',
                   'Measured as that eye sees it (the game\'s own simulation): 30 or more (CIE Lab distance) from the lethal and threat colours, Mend, Empower and the enemies\' red outline, in every palette.',
                   'The two looks differ in shape and size, not hue: dashed with a note, or solid with rays. Reduced motion: the ring neither breathes nor pops; only its fill moves.']})
if want('6'):
    panels = [{'img': f'{RAW}/ui-{v}.png', 'label': l, 'note': n, 'crop': c} for v, l, n, c in (
        ('hud-solos', 'Coming · Thread to Cue · Cued', 'Kael coming, Lyra full, Vexis threaded.', [555, 440, 1095, 1180]),
        ('hud-solos-more', 'Kael full · coming · Silent Cues', 'No seconds for Kael. Silent Cues: hold 1 s.', [555, 440, 1095, 1180]),
        ('hud-conduct-open', 'The Conductor: "Duet"', 'One Solo Cued: the next would be a Duet.', [555, 440, 1095, 1180]),
        ('hud-conduct-duet', 'The Conductor: "Trio"', 'Two Cued: Kael\'s would be a Trio.', [555, 440, 1095, 1180]))]
    build('6-party-frames', {
        'title': 'On the party frames: a countdown, and what your Thread makes of the Solo. No AUTO tag, no key cap, no Cue key.',
        'cols': 4, 'width': 520, 'font': 19, 'panels': panels,
        'footer': ['Coming: the Solo\'s name in a dashed outline, and the seconds. Full: a solid gold outline that glows, "Thread to Cue". Thread on them: a filled gold strip, a tick, "Cued", and the portrait\'s ring doubles.',
                   'Shape and words carry each state, not colour alone. Kael may raise his wall sooner than any count, so his strip shows no seconds.',
                   'From the UI lab. The first two are staged scenes; the Conductor\'s two are a real fight, the Thread following each Solo, read by the HUD.']})
if want('7'):
    panels = [{'img': f'{RAW}/ui-{v}.png', 'label': l, 'note': n, 'crop': c} for v, l, n, c in (
        ('hud-solos', 'The Resonance meter', 'No Cue ticks, no "Cue 25": it buys the Crescendo only.', [2180, 880, 2560, 1090]),
        ('hud-conduct-offbeat', 'A Tempo: the next Solo begins on the downbeat', 'The band (left) is lit; the hero\'s initial stands by the strip.', [2180, 840, 2560, 1050]),
        ('hud-conduct-beat', 'A Tempo: your Thread on that hero', 'The initial is ringed gold: it will be Cued.', [2180, 840, 2560, 1050]))]
    build('7-meter-and-beat-strip', {
        'title': 'The Resonance meter without the Cue\'s price, and the Conductor\'s beat strip (enlarged)',
        'cols': 3, 'width': 620, 'font': 18, 'panels': panels,
        'footer': ['The strip is a bar of four beats with a light running along it. The heroes begin their Solos in the band round the first beat.',
                   'No "Free", no price. The Conductor\'s badge on a frame says Duet or Trio and nothing else.']})
if want('8'):
    panels = [{'img': f'{RAW}/ui-{v}.png', 'label': l, 'note': n, 'crop': [1030, 50, 2120, 1170]} for v, l, n in (
        ('howto', 'The first-fight primer', 'Its last row: "Cue their Solos".'),
        ('howto-conduct', 'On a Conductor run', 'Its last row: "Duets and Trios".'))]
    build('8-primer', {
        'title': 'The primer: "Cued" is explained as "fired with your Thread on them". No key, no price.',
        'cols': 2, 'width': 900, 'font': 20, 'panels': panels, 'footer': []})
