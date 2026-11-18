"""Every English message that differs from main: old and new text, and a flag on any that touch the
protected words (auras, ornaments, songs' rules; Solos, Cues, hero autonomy, Resonance).

  python3 -I changes.py            prints the flagged ones and a summary
  python3 -I changes.py --json     writes changes.json (all of them)
"""
import json, re, subprocess, sys, os, glob
WT = '/home/user/aw-work/wt-p11menu'
OUT = '/home/user/aw-work/11/menu/pass2/changes.json'
PAIR = re.compile(r"'((?:screens|hud|common|a11y|input|saves|release)\.[\w.]+)':\s*('(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\")")
PROTECTED = re.compile(
    r"\baura|Aura|beam song|field song|[Cc]hord|[Oo]rnament|Sostenuto|Ostinato|Allegro|Fortissimo|Lullaby|"
    r"Fermata|Grace Note|Reverb|Unison|Pedal Point|[Cc]horus [Pp]ulse|[Ss]olo|\b[Cc]ue[ds]?\b|[Rr]esonance|autonomy|[Cc]rescendo|"
    r"\bDuet|\bTrio|Grand Finale|\becho\b|your beam|the beam")

def unlit(s):
    q = s[0]
    return s[1:-1].replace('\\' + q, q).replace('\\\\', '\\')

def pairs(text):
    return {m.group(1): unlit(m.group(2)) for m in PAIR.finditer(text)}

def main():
    files = subprocess.run(['git', '-C', WT, 'ls-files', 'src/ui/text/en'], capture_output=True, text=True).stdout.split()
    files += [f for f in subprocess.run(['git', '-C', WT, 'ls-files', '--others', '--exclude-standard', 'src/ui/text/en'], capture_output=True, text=True).stdout.split()]
    old, new = {}, {}
    for f in sorted(set(files)):
        r = subprocess.run(['git', '-C', WT, 'show', f'main:{f}'], capture_output=True, text=True)
        if r.returncode == 0:
            old.update(pairs(r.stdout))
        p = os.path.join(WT, f)
        if os.path.exists(p):
            new.update(pairs(open(p, encoding='utf8').read()))
    rows = []
    for k in sorted(set(old) | set(new)):
        o, n = old.get(k), new.get(k)
        if o == n:
            continue
        flag = bool((o and PROTECTED.search(o)) or (n and PROTECTED.search(n)))
        rows.append({'key': k, 'old': o, 'new': n, 'protected': flag})
    if '--json' in sys.argv:
        json.dump(rows, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    words = lambda s: len([w for w in (s or '').split() if re.search(r'\w', w)])
    print(f'{len(rows)} messages changed: {sum(1 for r in rows if r["old"] and r["new"])} rewritten, '
          f'{sum(1 for r in rows if not r["new"])} removed, {sum(1 for r in rows if not r["old"])} added; '
          f'words {sum(words(r["old"]) for r in rows)} -> {sum(words(r["new"]) for r in rows)}')
    bad = [r for r in rows if r['protected']]
    print(f'{len(bad)} touch protected words:')
    for r in bad:
        print('  ', r['key'], '\n     OLD:', r['old'], '\n     NEW:', r['new'])
    return 1 if bad else 0

if __name__ == '__main__':
    sys.exit(main())
