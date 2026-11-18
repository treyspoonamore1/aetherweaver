"""settext.py <edits.json>: {key: new value | null (delete) | [newKey, value] (rename)}.
Finds each key under src/ui/text/en and rewrites its line. Run prettier after."""
import json, re, sys, glob
WT = '/home/user/aw-work/wt-p11solo-w3'
edits = json.load(open(sys.argv[1], encoding='utf8'))
files = {p: open(p, encoding='utf8').read() for p in glob.glob(f'{WT}/src/ui/text/en/**/*.ts', recursive=True)}
def lit(v):
    if "'" not in v: return "'" + v + "'"
    if '"' not in v: return '"' + v + '"'
    return "'" + v.replace("'", "\\'") + "'"
for key, new in edits.items():
    pat = re.compile(r"^  '" + re.escape(key) + r"':\s*(?:\n\s*)?(['\"])(?:\\.|(?!\1).)*\1,\n", re.M)
    hit = [(p, m) for p, s in files.items() for m in [pat.search(s)] if m]
    assert len(hit) == 1, (key, len(hit))
    p, m = hit[0]
    if new is None: line = ''
    else:
        k, v = (new if isinstance(new, list) else (key, new))
        line = f"  '{k}': {lit(v)},\n"
    files[p] = files[p][:m.start()] + line + files[p][m.end():]
for p, s in files.items():
    if s != open(p, encoding='utf8').read(): open(p, 'w', encoding='utf8').write(s); print('wrote', p.split('/en/')[1])
