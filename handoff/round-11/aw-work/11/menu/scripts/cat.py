"""Catalogue editing helper: set or delete English messages by key, and log every change.

  python3 -I cat.py <edits.json>      edits: [[key, new_text_or_null], ...]
A null text deletes the key (its use in the source must go too).
"""
import json, re, sys, os
WT = '/home/user/aw-work/wt-p11menu'
LOG = '/home/user/aw-work/11/menu/changes.jsonl'

def file_of(key):
    area, rest = key.split('.', 1)
    base = f'{WT}/src/ui/text/en'
    if area in ('screens', 'hud', 'common'):
        name = rest.split('.', 1)[0]
        return f'{base}/{area}/{name}.ts'
    return f'{base}/{area}.ts'

def lit(text):
    if "'" not in text:
        return "'" + text.replace('\\', '\\\\') + "'"
    if '"' not in text:
        return '"' + text.replace('\\', '\\\\') + '"'
    return "'" + text.replace('\\', '\\\\').replace("'", "\\'") + "'"

def unlit(s):
    q = s[0]
    body = s[1:-1]
    return body.replace('\\' + q, q).replace('\\\\', '\\')

def apply(edits):
    out = []
    for key, new in edits:
        path = file_of(key)
        src = open(path, encoding='utf8').read()
        pat = re.compile(r"(\n\s*)'" + re.escape(key) + r"':\s*('(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"),")
        m = pat.search(src)
        if not m:
            raise SystemExit(f'key not found: {key} in {path}')
        old = unlit(m.group(2))
        if new is None:
            src = src[:m.start()] + src[m.end():]
        elif new == old:
            print('unchanged', key); continue
        else:
            src = src[:m.start()] + f"{m.group(1)}'{key}': {lit(new)}," + src[m.end():]
        open(path, 'w', encoding='utf8').write(src)
        out.append({'key': key, 'old': old, 'new': new})
        print(('DEL ' if new is None else 'SET ') + key)
    with open(LOG, 'a', encoding='utf8') as f:
        for o in out:
            f.write(json.dumps(o, ensure_ascii=False) + '\n')

if __name__ == '__main__':
    apply(json.load(open(sys.argv[1], encoding='utf8')))
