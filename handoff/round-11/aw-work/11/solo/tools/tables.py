"""Markdown tables for DESIGN.md from the study's JSON lines. python3 -I tables.py"""
import json, sys, os
D = '/home/user/aw-work/11/solo/data'
rows = []
for f in ['today', 'cand1', 'cand2', 'tune', 'tune2', 'cond', 'callings', 'parties']:
    p = f'{D}/{f}.jsonl'
    if os.path.exists(p):
        rows += [json.loads(l) for l in open(p) if l.strip()]

def grp(r):
    return 'bosses' if r['kind'] in ('boss', 'miniboss') else 'skirmishes'

def mean(xs):
    return sum(xs) / len(xs) if xs else float('nan')

def f(x, d=1):
    return '-' if x != x else f'{x:.{d}f}'

HEAD = ['Rules', 'Bot', 'Fights', 'Win', 'Seconds to win', 'Heroes downed', 'Solos charged',
        'Fired Cued', 'Fired plain', 'Never fired', 'Resonance on Cues', 'Resonance on Crescendos', 'Crescendos']

def line(name, bot, g, sel):
    wins = [r for r in sel if r['outcome'] == 'victory']
    return [name, bot, f'{g} ({len(sel)})', f"{100*len(wins)/len(sel):.0f}%", f(mean([r['duration'] for r in wins]), 0),
            f(mean([r['downs'] for r in sel]), 2), f(mean([r['charged'] for r in sel])),
            f(mean([r['strong'] for r in sel])), f(mean([r['plain'] for r in sel])), f(mean([r['left'] for r in sel])),
            f(mean([r['cueSpent'] for r in sel]), 0), f(mean([r['crescendoSpent'] for r in sel]), 0),
            f(mean([r['crescendos'] for r in sel]), 2)]

def table(variants, bots=('skilled', 'novice'), groups=('skirmishes', 'bosses'), head=HEAD, extra=None):
    out = ['| ' + ' | '.join(head + (extra[0] if extra else [])) + ' |', '|' + '---|' * (len(head) + (len(extra[0]) if extra else 0))]
    for v, name in variants:
        for bot in bots:
            for g in groups:
                sel = [r for r in rows if r['variant'] == v and r['bot'] == bot and grp(r) == g]
                if not sel:
                    continue
                l = line(name, bot.capitalize(), g, sel)
                if extra:
                    l += extra[1](sel)
                out.append('| ' + ' | '.join(l) + ' |')
    return '\n'.join(out)

def perfight(v, bot):
    out = ['| Fight | Movement | Win | Seconds to win | Heroes downed | Solos charged | Fired Cued | Fired plain | Never fired | Resonance on Cues | on Crescendos |', '|' + '---|' * 11]
    fights = []
    for r in rows:
        if r['variant'] == v and r['fight'] not in fights:
            fights.append(r['fight'])
    for fi in fights:
        sel = [r for r in rows if r['variant'] == v and r['bot'] == bot and r['fight'] == fi]
        l = line('', '', '', sel)
        out.append('| ' + ' | '.join([fi.replace('_', ' '), f"{sel[0]['movement']} · {sel[0]['kind']}"] + l[3:12]) + ' |')
    return '\n'.join(out)


def section(which):
    if which == 'today':
        return table([('today', 'As shipped: the bot Cues, autonomy off'), ('today-auto', 'The bot Cues, autonomy on'),
                      ('nocue', 'Never Cues, autonomy off (the default)'), ('nocue-auto', 'Never Cues, autonomy on')])
    if which == 'today-fights':
        return '**Skilled bot**\n\n' + perfight('today', 'skilled') + '\n\n**Novice bot**\n\n' + perfight('today', 'novice') + \
            '\n\n**Design A, followed, Skilled bot** (no tuning)\n\n' + perfight('thread+lead+gap1', 'skilled')
    if which == 'cands':
        return table([('today', 'Today (the bot Cues)'),
                      ('thread+gap1', 'A. Thread, ignored'), ('thread+lead+gap1', 'A. Thread, follows the Solos'),
                      ('thread+lead+gap1+eager', 'A. …and sings every full song'),
                      ('thread+lead+gap1+eager+gain0.5', 'A tuned: Resonance gains halved'),
                      ('always', 'B. Always the stronger form'), ('always+eager', 'B. …and sings every full song'),
                      ('field', 'C. In your field'), ('field+eager', 'C. …and sings every full song')])
    if which == 'others':
        return table([('empower+gap1', 'Empower only, ignored'), ('empower+lead+gap1', 'Empower only, followed'),
                      ('pay+lead+gap1', 'Thread, and it takes a segment'),
                      ('thread+lead-nogap', 'A without the one-second gap, followed'),
                      ('thread+lead+grace2', 'A with a 2 s wait and no gap, followed')], groups=('bosses',))
    if which == 'cond':
        ex = (['Duets', 'Trios', 'Finale Solos'], lambda sel: [f(mean([r.get('duets', 0) for r in sel])), f(mean([r.get('trios', 0) for r in sel])), f(mean([r['finaleSolos'] for r in sel]))])
        return table([('cond-today-A', 'Today, path A'), ('cond-thread+gap1+tog4-A', 'Design A, path A, ignored'),
                      ('cond-thread+lead+gap1-A', 'Design A, path A, followed'),
                      ('cond-thread+lead+gap1+gain0.5-A', 'Design A tuned (Resonance halved), path A, followed'),
                      ('cond-today-B', 'Today, path B'), ('cond-thread+lead+gap1-B', 'Design A, path B, followed')],
                     groups=('bosses',), extra=ex)
    if which == 'callings':
        return table([('today', 'No Calling, today'), ('thread+lead+gap1', 'No Calling, design A'),
                      ('lum-today', 'Luminary, today'), ('lum-thread+lead+gap1', 'Luminary, design A'),
                      ('mar-today', 'Martyr, today'), ('mar-thread+lead+gap1', 'Martyr, design A'),
                      ('chr-today', 'Chronomancer, today'), ('chr-thread+lead+gap1', 'Chronomancer, design A'),
                      ('cond-today-A', 'Conductor (path A), today'), ('cond-thread+lead+gap1-A', 'Conductor (path A), design A')],
                     bots=('skilled',), groups=('bosses',))
    if which == 'tuned':
        return table([('today', 'Today (the bot Cues)'),
                      ('thread+lead+gap1+eager+gain0.5', 'A tuned, followed'),
                      ('thread+gap1+eager+gain0.5', 'A tuned, ignored'),
                      ('always+eager+charge0.85+gain0.5', 'B tuned'),
                      ('field+eager+charge0.87+gain0.5', 'C tuned')], groups=('bosses',))
    if which == 'parties':
        return table([('pA-today', 'Kael, Vexis, Brann: today'), ('pA-thread+lead+gap1', 'Kael, Vexis, Brann: design A'),
                      ('pSA-today', 'Kael, Vexis, Seren: today'), ('pSA-thread+lead+gap1', 'Kael, Vexis, Seren: design A'),
                      ('pOA-today', 'Kael, Vexis, Oro: today'), ('pOA-thread+lead+gap1', 'Kael, Vexis, Oro: design A')],
                     bots=('skilled',), groups=('bosses',))
    raise SystemExit(which)

which = sys.argv[1]
if which == 'build':
    import re
    tpl = open('/home/user/aw-work/11/solo/DESIGN.tpl.md').read()
    def sub(m):
        k = m.group(1)
        extra = '/home/user/aw-work/11/solo/parts/' + k + '.md'
        if os.path.exists(extra):
            return open(extra).read().rstrip('\n')
        return section(k)
    out = re.sub(r'\{\{([a-z-]+)\}\}', sub, tpl)
    open('/home/user/aw-work/11/solo/DESIGN.md', 'w').write(out)
    print(len(out.split('\n')), 'lines')
else:
    print(section(which))
