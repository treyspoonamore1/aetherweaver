"""Fills the audit's template with the measured counts and writes AUDIT.md."""
import json, re, subprocess
S = '/home/user/aw-work/11/menu'
MAIN = f'{S}/main-copy/src/ui/text/en'
c = json.load(open(f'{S}/before/counts.json'))
w = lambda k: c[k]['words']
v = lambda k: c[k]['inView']

def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()

# (label, count key, must read, reference, said twice)
ROWS = [
 ('Prep, veteran', 'prep-veteran-whole', 'Embark. The three heroes, if you want others.', 'Every variant of every technique, open by default; four Callings in full; each hero’s kit; the Chord builder’s cards.', 'The beam song’s rule, three times (header, builder, its card). “Choose your three under Your party”, three times.'),
 ('Prep, new player', 'prep-fresh-whole', 'Embark. Nothing else: a preset is already loaded.', 'Four locked Callings and their rules; a locked Dissonance panel; each hero’s kit; the Chord builder’s cards.', 'The beam song’s rule, three times (header, Newly unlocked, builder). “Settings → Skip the unlocks”, six times.'),
 ('Settings', 'settings-whole', 'The one switch you came for.', 'The key table, the mouse table and the gamepad table: about half the page.', '“Hero voices” twice in a row. “With Shift: Cue their Solo” four times. “Esc cancels” three times.'),
 ('Codex, Motifs', 'codex-motifs', 'Nothing. It is the reference.', 'All of it.', '—'),
 ('Codex, the Reliquary', 'codex-the-reliquary', 'Nothing.', 'All of it.', '—'),
 ('Codex, Heroes', 'codex-heroes', 'Nothing.', 'All of it.', 'The same hero text as Prep’s cards.'),
 ('Codex, Bonds', 'codex-bonds', 'Nothing.', 'All of it.', '—'),
 ('Codex, Callings', 'codex-callings', 'Nothing.', 'All of it.', 'Prep’s Calling cards and their path dialogs.'),
 ('Codex, Relics', 'codex-relics', 'Nothing.', 'All of it.', '—'),
 ('Codex, Weaver Rank', 'codex-weaver-rank', 'Nothing.', 'All of it.', 'The rank-up cards.'),
 ('Codex, Enemies', 'codex-enemies', 'Nothing.', 'All of it.', '—'),
 ('Codex, Techniques', 'codex-techniques', 'Nothing.', 'All of it.', 'Prep’s techniques panel and the Atelier’s shelf.'),
 ('The Atelier', 'atelier', 'A price and Buy.', 'What each variant does; how variants reach the shelf.', 'How Starlight is earned: here, in its intro, in the Loom’s tooltip, on every Result.'),
 ('Dissonance', 'dissonance-whole', 'Nothing: its levels are set in Prep.', 'All of it: records, levels, what points pay.', 'Prep’s Dissonance panel.'),
 ('Codex, The Weaver', 'codex-the-weaver', 'Nothing.', 'All of it.', '—'),
 ('Codex, Events', 'codex-events', 'Nothing.', 'All of it.', '—'),
 ('Codex, Songs & ornaments', 'codex-songs-ornaments', 'Nothing.', 'All of it. (The owner’s: not changed.)', 'The Chord builder.'),
 ('Summary, a run won', 'summary-win-whole', 'The Loom, or New run.', 'Everything else. It is a report.', 'Weaver XP three ways. Under each of eight numbers, a sentence that repeats the number.'),
 ('Codex, the Astrolabe', 'codex-the-astrolabe', 'Nothing.', 'All of it.', '—'),
 ('Hall of Deeds (the Codex’s Deeds page)', 'deeds', 'Nothing.', 'All of it.', '—'),
 ('Summary, a run set down', 'summary-abandon-whole', 'The Loom, or New run.', 'Everything else.', 'As above. Eight rows that say “0” and then “0 …” in words.'),
 ('Bonds', 'bonds', 'A talent to choose, when one is open.', 'Every talent’s rule; both Solos.', 'Kael’s name, twelve times on his page.'),
 ('Codex, Calls', 'codex-calls', 'Nothing.', 'All of it.', '—'),
 ('The Atlas of Echoes', 'atlas-whole', 'An Echo to begin.', 'Each Echo’s twists; the weekly’s rules.', '—'),
 ('The Reliquary', 'reliquary', 'The relic to carry.', 'Crafting odds, Instability, tiers.', 'Fracture’s risk, three times.'),
 ('A Calling’s path (dialog)', 'calling-path', 'Choose, or Close.', 'Eight options’ rules.', 'The Calling’s summary, also on its card.'),
 ('Merchant', 'merchant', 'Each price, and your Aether.', 'Relic flavour lines.', 'That it is a merchant: small line, title and first sentence.'),
 ('Result', 'result-win-whole', 'Continue.', 'The coaching lines; the chart; three reward breakdowns.', 'The grade, three times. Weaver XP, twice.'),
 ('How to Play', 'howto', 'All of it, once. It does not fit the window: the first row scrolls off.', '—', '“You are the Weaver” (also the Title and Prep). “The fight is paused until you begin” over a button that says Begin the fight.'),
 ('Codex, Auras', 'codex-auras', 'Nothing.', 'All of it. (The owner’s: not changed.)', 'The Chord builder.'),
 ('The Loom’s welcome (three cards)', None, 'Next, or Later.', 'What the drill teaches; what songs are.', 'Each station named here is named again on its card.'),
 ('The Loom, veteran', 'loom-veteran', 'The Gate.', 'What each station is for.', 'A banner lists five stations that each wear a New badge.'),
 ('The Loom, new player', 'loom-fresh', 'The Gate.', 'What seven closed stations are.', 'The Atelier’s Rank, twice. Esc, twice.'),
 ('The Astrolabe', 'astrolabe', 'A star to take.', 'The legend; the key list.', 'Points to spend, three times.'),
 ('Relic offer', 'relic-offer', 'Three relics’ rules.', 'Their flavour lines.', '—'),
 ('The map', 'map-fresh', 'The glowing stop.', 'The names of the stops you cannot reach yet; the legend.', '“0 owned” over “None yet”.'),
 ('A first fight (HUD)', 'fight-first', 'The coach hint.', 'The key reminders.', '—'),
 ('Respite', 'respite', 'Three choices.', 'What Shaken is, when nobody is.', 'The header lists the three choices that the three cards below it are.'),
 ('Shrine (a draft)', 'shrine', 'Three motifs.', 'Tags; Harmony notes.', '—'),
 ('Title, the demo’s first choice', 'title-choice', 'Two cards.', 'What the veteran start contains.', '—'),
 ('Codex, Dissonance (closed)', 'codex-dissonance', 'Nothing.', 'When it opens.', 'The Loom’s Dissonance card.'),
 ('Draft', 'draft', 'Three motifs.', 'Tags.', 'The small line, the title and the first sentence all say “choose a motif”.'),
 ('Forge', 'forge', 'Three services and their prices.', '—', '“One service per visit”, twice.'),
 ('Event', 'event', 'The choices.', '—', '—'),
 ('Title, veteran', 'title-veteran', 'Enter the Loom.', 'What the next Rank opens.', 'Rank, here and in the Loom.'),
 ('The pause menu’s Controls', 'pause-controls', 'The key you forgot.', 'The other nine.', '—'),
 ('Title, new player', 'title-fresh', 'Enter the Loom.', '“No runs yet”.', 'Rank, here and in the Loom.'),
 ('Codex, the Atlas (closed)', 'codex-atlas-of-echoes', 'Nothing.', 'When it opens.', '—'),
 ('Abandon run?', 'pause-abandon', 'Yes or no.', '—', '—'),
 ('The pause menu', 'pause', 'Resume.', '—', '“Paused”, then “The simulation is frozen.”'),
]

def main():
    welcome = sum(w(f'loom-welcome-intro-{i}') for i in (1, 2, 3))
    lines = []
    for i, (label, key, must, ref, twice) in enumerate(ROWS, 1):
        if key is None:
            n, f = welcome, welcome
        elif key not in c:
            print('missing', key); continue
        else:
            n = w(key)
            first = key.replace('-whole', '')
            f = v(first) if first in c else v(key)
        lines.append(f'| {i} | {label} | {n:,} | {f:,} | {must} | {ref} | {twice} |')
    t = open(f'{S}/scripts/audit_tpl.md', encoding='utf8').read()
    vals = re.findall(r"'(?:screens|hud|common|a11y|input|saves|release)\.[\w.]+':\s*('(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\")", sh(f"cat $(find {MAIN} -name '*.ts')"))
    words = sum(len([x for x in s[1:-1].split() if re.search(r'\w', x)]) for s in vals)
    subs = {
        'MESSAGES': f'{len(vals):,}', 'WORDS': f'{round(words, -2):,}', 'TABLE': '\n'.join(lines),
        'welcome': str(welcome),
        'NOT_COUNT': sh(f"grep -rhoE \"[^.'\\\"]*(, not |, never )[^.'\\\"]*\" {MAIN} | wc -l"),
        'PAREN_COUNT': sh(f"grep -rhoE '\\([^)]{{8,}}\\)' {MAIN} | wc -l"),
        'DASH_COUNT': sh(f"grep -rho '—' {MAIN} | wc -l"), 'DASH_HINTS': sh(f"grep -o '—' {MAIN}/hud/hints.ts | wc -l"),
        'FORNOW': sh(f"grep -rho 'for now' {MAIN} | wc -l"), 'THISTIME': sh(f"grep -rho 'this time' {MAIN} | wc -l"),
        'SKIP': sh(f"grep -rho 'Skip the unlocks' {MAIN} | wc -l"), 'SKIPFILES': sh(f"grep -rl 'Skip the unlocks' {MAIN} | wc -l"),
        'NODE': sh(f"grep -rhoE '\\bnodes?\\b' {MAIN} | wc -l"), 'STEP': sh(f"grep -rhoE '\\bsteps?\\b' {MAIN} | wc -l"), 'STOP': sh(f"grep -rhoE '\\bstops?\\b' {MAIN} | wc -l"),
        'SEMI': sh(f"grep -rhoE \"'[^']*;[^']*'\" {MAIN} | wc -l"),
    }
    for k in c:
        subs[k] = f'{w(k):,}'
    def fill(m):
        k = m.group(1)
        if k not in subs: raise SystemExit('no value for ' + k)
        return subs[k]
    t = re.sub(r'\{([A-Za-z][\w-]*)\}', fill, t)
    open(f'{S}/AUDIT.md', 'w', encoding='utf8').write(t)
    print('AUDIT.md', len(t.split()), 'words')

main()
