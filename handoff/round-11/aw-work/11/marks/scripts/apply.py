# apply.py <worktree> <edits.py>: exact string replacements, each asserted to occur exactly `n` times.
import sys, runpy
wt, spec = sys.argv[1:3]
EDITS = runpy.run_path(spec)['EDITS']
bad = 0
for f, pairs in EDITS.items():
    p = f'{wt}/{f}'
    s = open(p).read()
    for item in pairs:
        old, new = item[0], item[1]
        n = item[2] if len(item) > 2 else 1
        c = s.count(old)
        if c != n:
            print(f'!! {f}: expected {n}, found {c}: {old[:70]!r}'); bad += 1; continue
        s = s.replace(old, new)
    if not bad:
        open(p, 'w').write(s)
print('FAILED' if bad else 'ok')
sys.exit(1 if bad else 0)
