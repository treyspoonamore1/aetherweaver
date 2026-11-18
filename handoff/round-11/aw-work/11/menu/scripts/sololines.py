"""Lists the English messages about Solos, Cues, hero autonomy and Resonance in the files this pass
worked on, and checks each is byte-for-byte as on main. Also lists the lines left because they name
or describe an aura, an ornament or a song's rule. Writes left-lines.md."""
import re, subprocess, sys, os
sys.path.insert(0, '/home/user/aw-work/11/menu/scripts')
import changes
WT = changes.WT
FILES = ['screens/titleScreen', 'screens/loomScreen', 'screens/loomModel', 'screens/loomParts', 'screens/prepScreen', 'screens/callingPicker', 'screens/callingParts',
         'screens/mapScreen', 'screens/routeText', 'hud/howToPlay', 'hud/hints', 'hud/sighting', 'hud/pauseMenu', 'hud/keyHints', 'screens/resultScreen', 'screens/resultText',
         'screens/summaryScreen', 'screens/draftScreen', 'screens/respiteScreen', 'screens/merchantScreen', 'screens/forgeScreen', 'screens/eventScreen', 'screens/relicScreen',
         'screens/relicCard', 'screens/interlude', 'screens/rank', 'screens/rankText', 'screens/starlightModel', 'screens/variantsModel', 'a11y', 'input', 'saves']
SOLO = re.compile(r'[Ss]olo|\b[Cc]ue[ds]?\b|\b[Cc]ues\b|[Rr]esonance|autonomy|[Cc]rescendo|\bDuet|\bTrio|Grand Finale')
AURA = re.compile(r"\baura|Aura|beam song|field song|[Cc]hord|[Oo]rnament|Sostenuto|Ostinato|Allegro|Fortissimo|Lullaby|Fermata|Grace Note|Reverb|Unison|Pedal Point|[Cc]horus [Pp]ulse|\becho\b|your beam|the beam")
out = ['# Lines left exactly as they were', '',
       'Every line below is in a file this pass worked on, and is byte for byte what main has. The check ran on the final commit.', '']
solo, aura, bad = [], [], []
for f in FILES:
    path = f'src/ui/text/en/{f}.ts'
    if not os.path.exists(f'{WT}/{path}'):
        continue
    new = changes.pairs(open(f'{WT}/{path}', encoding='utf8').read())
    r = subprocess.run(['git', '-C', WT, 'show', f'main:{path}'], capture_output=True, text=True)
    old = changes.pairs(r.stdout) if r.returncode == 0 else {}
    for k, v in old.items():
        s, a = SOLO.search(v), AURA.search(v)
        if not (s or a):
            continue
        if new.get(k) != v:
            bad.append((k, v, new.get(k)))
        (solo if s else aura).append((f, k, v))
out += [f'## About Solos, Cues, hero autonomy and Resonance ({len(solo)} lines)', '',
        'For the Solo stream. Lines that name a Crescendo, a Duet, a Trio or the Grand Finale are here too: they spend Resonance or chain Solos.', '']
cur = None
for f, k, v in solo:
    if f != cur:
        out += ['', f'**`src/ui/text/en/{f}.ts`**', '']; cur = f
    out.append(f'- `{k}`: {v}')
out += ['', f'## Naming or describing an aura, an ornament or a song’s rule ({len(aura)} lines)', '',
        'The owner’s. Some of these sit on screens this pass rewrote, and are why those screens lost fewer words.', '']
cur = None
for f, k, v in aura:
    if f != cur:
        out += ['', f'**`src/ui/text/en/{f}.ts`**', '']; cur = f
    out.append(f'- `{k}`: {v}')
open('/home/user/aw-work/11/menu/left-lines.md', 'w', encoding='utf8').write('\n'.join(out) + '\n')
print(len(solo), 'solo lines,', len(aura), 'aura lines,', len(bad), 'CHANGED (must be 0)')
for b in bad: print('  CHANGED', b)
sys.exit(1 if bad else 0)
