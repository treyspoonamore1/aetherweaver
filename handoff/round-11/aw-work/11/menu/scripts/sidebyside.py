"""Before on the left, after on the right, labelled, with the word counts in the caption.

  python3 -I sidebyside.py            every screen in SCREENS that has both pictures
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
S = '/home/user/aw-work/11/menu'
FONT = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
FONT_R = '/usr/share/fonts/opentype/inter/Inter-Regular.otf'
if not os.path.exists(FONT):
    FONT = FONT_R = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

# (file id, title, key whose count the caption gives (default: the id), note)
SCREENS = [
    ('title-choice', 'Title: the demo’s first choice', None, ''),
    ('title-fresh', 'Title', None, ''),
    ('title-veteran', 'Title, veteran', None, ''),
    ('loom-welcome-intro-1', 'The Loom’s welcome, card 1 of 3', None, ''),
    ('loom-welcome-intro-2', 'The Loom’s welcome, card 2 of 3', None, 'It describes auras, so it was left as it is.'),
    ('loom-welcome-intro-3', 'The Loom’s welcome, card 3 of 3', None, ''),
    ('loom-fresh', 'The Loom, new player', None, 'A closed station says when it opens. Point at it for the rest.'),
    ('loom-veteran', 'The Loom, veteran', None, ''),
    ('prep-fresh', 'Prep, new player (first view)', 'prep-fresh-whole', 'Counts are for the whole screen, scrolled.'),
    ('prep-veteran', 'Prep, veteran (first view)', 'prep-veteran-whole', 'Counts are for the whole screen, scrolled.'),
    ('map-fresh', 'The map', None, 'A fight out of reach shows its name on hover.'),
    ('howto', 'How to Play', None, 'All six rows fit the window now. Three of them describe songs or Resonance and were left.'),
    ('pause', 'The pause menu', None, ''),
    ('pause-controls', 'The pause menu’s Controls', None, 'The key table is the HUD’s and was left.'),
    ('fight-first', 'A first fight: the HUD with a coach hint', None, ''),
    ('result-win', 'Result (first view)', 'result-win-whole', 'Counts are for the whole screen.'),
    ('summary-abandon', 'Summary, a run set down (first view)', 'summary-abandon-whole', 'Counts are for the whole screen.'),
    ('summary-win', 'Summary, a run won (first view)', 'summary-win-whole', 'Counts are for the whole screen.'),
    ('draft', 'Draft', None, 'The cards are content text, which this pass may not change.'),
    ('respite', 'Respite', None, ''),
    ('merchant', 'Merchant', None, 'Item text is content, which this pass may not change.'),
    ('forge', 'Forge', None, ''),
    ('event', 'Event', None, 'An event’s text is content, which this pass may not change.'),
    ('shrine', 'Shrine', None, ''),
    ('relic-offer', 'Relic offer', None, 'Relic text is content, which this pass may not change.'),
    ('settings', 'Settings (first view)', 'settings-whole', 'Counts are for the whole page.'),
    ('calling-path', 'A Calling’s path', None, ''),
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
