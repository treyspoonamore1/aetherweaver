# pindiff.py <pin.json> <now.json>: which entries of the aura presentation pin differ.
import sys, json
a, b = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
moved = 0; total = 0
for k in a:
    if k == 'cases': continue
    if a[k] != b.get(k): print('top-level', k, 'differs')
for case, ca in a['cases'].items():
    cb = b['cases'].get(case, {})
    parts = []
    for stream, va in ca.items():
        vb = cb.get(stream)
        if isinstance(va, list):
            idx = [i for i, (x, y) in enumerate(zip(va, vb)) if x != y]
            total += len(va); moved += len(idx)
            if idx: parts.append(f"{stream}: samples {','.join(str(i + 1) for i in idx)} of {len(va)}")
        else:
            total += 1
            if va != vb: moved += 1; parts.append(f'{stream}: differs')
    if parts: print(f'{case:32s}', '; '.join(parts))
print(f'{moved} of {total} entries differ')
