"""Item 8's worklist: every English message that names an aura, an ornament or a song's rule, and is
not a Solo/Cue/Resonance/Crescendo line, not How to Play, not the Result or the Summary."""
import re, subprocess, os, sys
WT = '/home/user/aw-work/wt-p11menu'
PAIR = re.compile(r"'((?:screens|hud|common|a11y|input|saves|release)\.[\w.]+)':\s*('(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\")")
AURA = re.compile(r"\baura|Aura|beam song|field song|\bsongs?\b|[Cc]hord|[Oo]rnament|Sostenuto|Ostinato|Allegro|Fortissimo|Lullaby|Fermata|Grace Note|Reverb|Unison|Pedal Point|[Cc]horus [Pp]ulse|\becho\b|your beam|the beam|[Pp]reset")
SOLO = re.compile(r"[Ss]olo|\b[Cc]ue[ds]?\b|[Rr]esonance|autonomy|[Cc]rescendo|\bDuet|\bTrio|Grand Finale")
SKIP = ('howToPlay', 'resultText', 'resultScreen', 'summaryScreen', 'withoutYou', 'contributionBar', 'reliquarySummary')
def unlit(s):
    q = s[0]; return s[1:-1].replace('\\' + q, q).replace('\\\\', '\\')
words = lambda s: len([w for w in s.split() if re.search(r'\w', w)])
files = subprocess.run(['git', '-C', WT, 'ls-files', 'src/ui/text/en'], capture_output=True, text=True).stdout.split()
minw = int(sys.argv[1]) if len(sys.argv) > 1 else 0
n = 0
for f in sorted(files):
    if any(s in f for s in SKIP): continue
    out = []
    for m in PAIR.finditer(open(os.path.join(WT, f), encoding='utf8').read()):
        k, v = m.group(1), unlit(m.group(2))
        if not AURA.search(v) or SOLO.search(v): continue
        w = words(v)
        mark = ('—' in v) * 'DASH ' + (';' in v) * 'SEMI ' + ('(' in v) * 'PAREN '
        if w >= minw or mark:
            out.append(f'  [{w:3}] {mark}{k.split(".")[-1]}: {v}')
    if out:
        print(f.replace('src/ui/text/en/', '')); print('\n'.join(out)); n += len(out)
print(n, 'lines')
