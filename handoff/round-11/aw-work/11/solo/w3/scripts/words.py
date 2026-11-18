"""words.py: every English message this step changed, removed or added, with word counts before
(the base commit) and after (the worktree), and what became of each of the menu pass's 55 left
lines. Writes w3/WORDS.md."""
import re, subprocess, glob, sys
sys.path.insert(0, '/home/user/aw-work/11/solo/w3/scripts')
from lines import pairs, words
WT = '/home/user/aw-work/wt-p11solo-w3'
BASE = '8572e48'
new, old, where = {}, {}, {}
for path in sorted(glob.glob(f'{WT}/src/ui/text/en/**/*.ts', recursive=True)):
    rel = path[len(WT) + 1:]
    ps = pairs(open(path, encoding='utf8').read())
    new.update(ps)
    for k in ps: where[k] = rel
    r = subprocess.run(['git', '-C', WT, 'show', f'{BASE}:{rel}'], capture_output=True, text=True)
    if r.returncode == 0:
        po = pairs(r.stdout)
        old.update(po)
        for k in po: where.setdefault(k, rel)
changed = [k for k in old if k in new and old[k] != new[k]]
removed = [k for k in old if k not in new]
added = [k for k in new if k not in old]
left = re.findall(r'^- `([\w.]+)`: (.*)$', open('/home/user/aw-work/11/menu/left-lines.md', encoding='utf8').read().split('## Naming or describing an aura')[0], re.M)
out = ['# W3: the lines this step changed, with word counts', '',
       f'Base `{BASE}`. A placeholder such as `{{name}}` counts as one word. Counted by `scripts/words.py`.', '']
wb = sum(words(old[k]) for k in changed); wa = sum(words(new[k]) for k in changed)
wr = sum(words(old[k]) for k in removed); wn = sum(words(new[k]) for k in added)
out += ['## Totals', '',
        '| | Lines | Words before | Words after |', '|---|---|---|---|',
        f'| Reworded | {len(changed)} | {wb} | {wa} |',
        f'| Removed | {len(removed)} | {wr} | 0 |',
        f'| New | {len(added)} | 0 | {wn} |',
        f'| **All** | {len(changed) + len(removed) + len(added)} | **{wb + wr}** | **{wa + wn}** |', '']
def esc(s): return s.replace('|', '\\|')
out += ['## Reworded', '', '| Key | Before | After | Words |', '|---|---|---|---|']
for k in sorted(changed, key=lambda k: where[k]):
    out.append(f'| `{k}` | {esc(old[k])} | {esc(new[k])} | {words(old[k])} → {words(new[k])} |')
out += ['', '## Removed', '', '| Key | Was | Words |', '|---|---|---|']
for k in sorted(removed, key=lambda k: where[k]):
    out.append(f'| `{k}` | {esc(old[k])} | {words(old[k])} |')
out += ['', '## New', '', '| Key | Line | Words |', '|---|---|---|']
for k in sorted(added, key=lambda k: where[k]):
    out.append(f'| `{k}` | {esc(new[k])} | {words(new[k])} |')
out += ['', f'## The menu pass\'s {len(left)} left lines', '',
        '| Key | Then | Now | Words |', '|---|---|---|---|']
tally = {'shorter': 0, 'gone': 0, 'same': 0, 'longer': 0, 'kept': 0}
WAIT = {'screens.prepScreen.heroAutonomy', 'screens.prepScreen.heroesFireTheirOwn', 'a11y.settings.heroAutonomy',
        'a11y.settings.heroesFireTheirOwn', 'input.padAction.cueReticle', 'input.controls.pressModifierAria',
        'input.controls.modifierName', 'input.controls.cueHint', 'input.options.cueModifier', 'input.options.cueModifier.hint'}
for k, v in left:
    if k not in new:
        tally['gone'] += 1; out.append(f'| `{k}` | {esc(v)} | gone | {words(v)} → 0 |')
    elif new[k] == old.get(k):
        tally['kept'] += 1
        why = 'goes when the input step lands: its screen still reads the key' if k in WAIT else 'kept: a label'
        out.append(f'| `{k}` | {esc(v)} | {why} | {words(v)} |')
    else:
        a, b = words(old[k]), words(new[k])
        tally['shorter' if b < a else 'same' if b == a else 'longer'] += 1
        out.append(f'| `{k}` | {esc(v)} | {esc(new[k])} | {a} → {b} |')
out += ['', 'Of the ' + str(len(left)) + ': ' + ', '.join(f'{n} {k}' for k, n in tally.items()) + '.', '']
open('/home/user/aw-work/11/solo/w3/WORDS.md', 'w', encoding='utf8').write('\n'.join(out))
print('reworded', len(changed), wb, '->', wa, '| removed', len(removed), wr, '| new', len(added), wn, '| left', tally)
