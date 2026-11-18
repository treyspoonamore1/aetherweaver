# Compares two dumps of the Brann UI pin: which keys moved, and each distinct change in them.
import json, re, sys, difflib, hashlib
a = json.load(open(sys.argv[1])); b = json.load(open(sys.argv[2]))
assert list(a) == list(b)
moved = [k for k in a if a[k] != b[k]]
print(len(a), 'keys; moved', len(moved), ':', moved)
def toks(v):
    s = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    return re.split(r'(?<=>)|(?=<)', s)
seen = {}
for k in moved:
    A = toks(a[k]); B = toks(b[k])
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, A, B, autojunk=False).get_opcodes():
        if tag == 'equal': continue
        d = (''.join(A[i1:i2]), ''.join(B[j1:j2]))
        seen.setdefault(d, []).append(k)
for (x, y), ks in seen.items():
    print('\n', sorted(set(ks)), '\n  -', x[:500], '\n  +', y[:500])
print(len(seen), 'distinct changes')
if len(sys.argv) > 3:
    out = {k: hashlib.sha256(json.dumps(b[k], ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()[:16] for k in moved}
    json.dump(out, open(sys.argv[3], 'w'), indent=1)
