"""Before on the left, after on the right, labelled, with the word counts in the caption.

  python3 -I sidebyside.py            every screen in SCREENS that has both pictures
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
S = '/home/user/aw-work/11/menu/pass2'
FONT = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
FONT_R = '/usr/share/fonts/opentype/inter/Inter-Regular.otf'
if not os.path.exists(FONT):
    FONT = FONT_R = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

# (file id, title, key whose count the caption gives (default: the id), note)
SCREENS = [
    ('settings', 'Settings, as it opens (first view)', 'settings-whole', 'Counts are for the whole page. The key, mouse and gamepad tables are on a Controls tab.'),
    ('astrolabe-intro-1', 'The Astrolabe’s intro, card 1 of 3', None, 'Counts include the card’s title, its "1 of 3" and its buttons.'),
    ('astrolabe-intro-2', 'The Astrolabe’s intro, card 2 of 3', None, ''),
    ('atelier-intro-1', 'The Atelier’s intro, card 1 of 3', None, ''),
    ('atelier-intro-2', 'The Atelier’s intro, card 2 of 3', None, ''),
    ('atelier-intro-3', 'The Atelier’s intro, card 3 of 3', None, ''),
    ('reliquary-intro-1', 'The Reliquary’s intro, card 1 of 3', None, ''),
    ('reliquary-intro-2', 'The Reliquary’s intro, card 2 of 3', None, ''),
    ('deeds-intro-1', 'The Hall of Deeds’ intro, card 1 of 2', None, ''),
    ('dissonance-intro-1', 'Dissonance’s intro, card 1 of 3', None, ''),
    ('atlas-intro-1', 'The Atlas’s intro, card 1 of 3', None, ''),
    ('atelier', 'The Atelier', None, 'Its shelves are content text; the opening lines are shorter.'),
    ('deeds', 'The Hall of Deeds', None, ''),
    ('dissonance', 'Dissonance (the station’s page)', 'dissonance-whole', 'Counts are for the whole page. Its tables fold.'),
    ('codex-motifs', 'Codex, Motifs', None, 'One family open, a filter, and one level a motif until "Every level".'),
    ('codex-the-reliquary', 'Codex, the Reliquary', None, 'Its rules fold into four groups.'),
    ('codex-heroes', 'Codex, Heroes', None, 'Each hero’s abilities are a fold away.'),
    ('codex-bonds', 'Codex, Bonds', None, 'The first hero’s Bond is open; the others fold.'),
    ('codex-callings', 'Codex, Callings', None, 'Each Calling’s path is a fold away.'),
    ('codex-relics', 'Codex, Relics', None, 'One rarity open.'),
    ('codex-weaver-rank', 'Codex, Weaver Rank', None, 'The list of what each Rank opens folds.'),
    ('codex-enemies', 'Codex, Enemies', None, 'One Movement open.'),
    ('codex-techniques', 'Codex, Techniques', None, 'One slot open.'),
    ('codex-events', 'Codex, Events', None, 'One Movement open; boons fold.'),
    ('prep-fresh', 'Prep, a new player (first view)', 'prep-fresh-whole', 'Counts are for the whole page. The opening paragraph is shorter; the Newly unlocked strip shows names.'),
    ('loom-welcome-intro-2', 'The welcome, card 2 of 3 (the Gate)', None, ''),
    ('atlas-intro-3', 'The Atlas’s intro, card 3 of 3 (This Week’s Song)', None, ''),
    ('codex-songs-ornaments', 'Codex, Songs & ornaments', None, 'Shorter rule cards; the ornaments fold.'),
    ('codex-the-weaver', 'Codex, The Weaver', None, 'Two cards reworded.'),
]

def font(path, size):
    return ImageFont.truetype(path, size)

def main():
    b = json.load(open(f'{S}/before/counts.json'))
    a = json.load(open(f'{S}/after/counts.json'))
    os.makedirs(f'{S}/shots', exist_ok=True)
    rows = []
    for fid, title, key, note in SCREENS:
        key = key or fid
        pb, pa = f'{S}/before/{fid}.png', f'{S}/after/{fid}.png'
        if not (os.path.exists(pb) and os.path.exists(pa) and key in b and key in a):
            print('skip', fid); continue
        wb, wa = b[key]['words'], a[key]['words']
        pct = round(100 * (wb - wa) / wb) if wb else 0
        W, H, G, TOP, BOT = 1280, 720, 24, 64, 84
        sheet = Image.new('RGB', (W * 2 + G * 3, H + TOP + BOT), (12, 16, 30))
        d = ImageDraw.Draw(sheet)
        for i, (p, label, n) in enumerate([(pb, 'BEFORE', wb), (pa, 'AFTER', wa)]):
            im = Image.open(p).convert('RGB')
            im = im.crop((0, 0, im.width, min(im.height, im.width * 9 // 16))).resize((W, H), Image.LANCZOS)
            x = G + i * (W + G)
            sheet.paste(im, (x, TOP))
            d.rectangle([x, TOP, x + W - 1, TOP + H - 1], outline=(70, 82, 120))
            d.text((x, 18), label, font=font(FONT, 26), fill=(245, 196, 86) if i else (170, 180, 205))
            d.text((x + 130, 22), f'{n} words on screen', font=font(FONT_R, 22), fill=(220, 226, 240))
        cap = f'{title}: {wb} → {wa} words ({"−" if pct >= 0 else "+"}{abs(pct)}%).'
        d.text((G, TOP + H + 14), cap, font=font(FONT, 26), fill=(240, 244, 252))
        if note:
            d.text((G, TOP + H + 50), note, font=font(FONT_R, 20), fill=(170, 180, 205))
        out = f'{S}/shots/{fid}.png'
        sheet.save(out)
        rows.append((fid, title, wb, wa, pct))
        print(out, wb, wa, f'{pct}%')
    json.dump(rows, open(f'{S}/shots/counts.json', 'w'), indent=1)

if __name__ == '__main__':
    main()
