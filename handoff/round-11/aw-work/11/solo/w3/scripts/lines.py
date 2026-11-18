"""Lists the English messages that speak of Solos, Cues, autonomy or Resonance, with word counts."""
import re, sys, os, glob
WT = '/home/user/aw-work/wt-p11solo-w3'
PAIR = re.compile(r"^\s*'([\w.]+)':\s*(?:\n\s*)?(['\"`])((?:\\.|(?!\2).)*)\2,?\s*$", re.M)
def pairs(text):
    out = {}
    for m in PAIR.finditer(text):
        out[m.group(1)] = m.group(3).replace("\\'", "'").replace('\\"', '"')
    return out
def words(v):
    v = re.sub(r'\{\{?\w+\}?\}', 'X', v)
    return len([w for w in re.split(r'\s+', v.strip()) if re.search(r'\w', w)])
SOLO = re.compile(r'[Ss]olo|\b[Cc]ue[ds]?\b|\b[Cc]ues\b|[Rr]esonance|autonomy|[Cc]rescendo|\bDuet|\bTrio|Grand Finale')
if __name__ == '__main__':
    only = sys.argv[1:] 
    for path in sorted(glob.glob(f'{WT}/src/ui/text/en/**/*.ts', recursive=True)):
        rel = path.split('/en/')[1][:-3]
        if only and not any(o in rel for o in only): continue
        ps = pairs(open(path, encoding='utf8').read())
        hit = [(k, v) for k, v in ps.items() if SOLO.search(v)]
        if not hit: continue
        print(f'\n## {rel}')
        for k, v in hit: print(f'- {k} [{words(v)}]: {v}')
