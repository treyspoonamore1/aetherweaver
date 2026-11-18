# panels.py <spec.json>: a labelled sheet. Spec: {"out": path, "title": str, "cols": n, "width": px,
# "panels": [{"img": path, "label": str, "crop": [x0, y0, x1, y1] (optional, in the image's own
# pixels), "note": str (optional second line)}], "footer": [str, ...] (optional)}.
# Every panel is scaled to `width` wide; rows take the tallest panel's height.
import sys, json
from PIL import Image, ImageDraw, ImageFont

spec = json.load(open(sys.argv[1]))
W = spec.get('width', 1280)
cols = spec['cols']
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
fs = spec.get('font', max(16, W // 48))
F = ImageFont.truetype(BOLD, fs)
FN = ImageFont.truetype(FONT, int(fs * 0.82))
FT = ImageFont.truetype(BOLD, int(fs * 1.15))
pad = 8
ims = []
for p in spec['panels']:
    im = Image.open(p['img']).convert('RGB')
    if p.get('crop'):
        im = im.crop(tuple(p['crop']))
    im = im.resize((W, max(1, round(im.height * W / im.width))), Image.LANCZOS)
    ims.append(im)
rows = (len(ims) + cols - 1) // cols
lab_h = fs + 12 + (int(fs * 0.82) + 6 if any(p.get('note') for p in spec['panels']) else 0)
row_h = [max(im.height for im in ims[r * cols:(r + 1) * cols]) + lab_h for r in range(rows)]
title_h = int(fs * 1.15) + 18 if spec.get('title') else 0
foot = spec.get('footer', [])
foot_h = len(foot) * (int(fs * 0.82) + 8) + (10 if foot else 0)
sheet = Image.new('RGB', (cols * W + (cols + 1) * pad, title_h + sum(row_h) + (rows + 1) * pad + foot_h), (18, 18, 22))
d = ImageDraw.Draw(sheet)
if spec.get('title'):
    d.text((pad, 8), spec['title'], fill=(240, 240, 240), font=FT)
y = title_h + pad
for r in range(rows):
    for c in range(cols):
        i = r * cols + c
        if i >= len(ims):
            break
        x = pad + c * (W + pad)
        p = spec['panels'][i]
        d.text((x + 2, y + 4), p['label'], fill=(255, 226, 120), font=F)
        if p.get('note'):
            d.text((x + 2, y + fs + 10), p['note'], fill=(215, 215, 215), font=FN)
        sheet.paste(ims[i], (x, y + lab_h))
    y += row_h[r] + pad
for i, line in enumerate(foot):
    d.text((pad, y + 4 + i * (int(fs * 0.82) + 8)), line, fill=(215, 215, 215), font=FN)
sheet.save(spec['out'])
print(spec['out'], sheet.size)
