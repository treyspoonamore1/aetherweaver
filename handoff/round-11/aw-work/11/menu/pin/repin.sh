#!/bin/bash
# Re-records tests/uiPhase5e.brann.json for the keys whose text this branch changed, after listing
# every changed line against main's (a copy of main's sources in ../main-copy).
set -e
HERE=/home/user/aw-work/11/menu/pin; WT=/home/user/aw-work/wt-p11menu; MAIN=/home/user/aw-work/11/menu/main-copy
cp $HERE/dump.test.ts $MAIN/tests/zzPinDump.test.ts
cp $HERE/dump.test.ts $WT/tests/zzPinDump.test.ts
trap 'rm -f $WT/tests/zzPinDump.test.ts' EXIT
(cd $MAIN && PIN_OUT=$HERE/main.json npx vitest run tests/zzPinDump.test.ts --testTimeout=120000 2>&1 | grep -E "Tests |FAIL|Error" | head -5)
(cd $WT && PIN_OUT=$HERE/mine.json npx vitest run tests/zzPinDump.test.ts --testTimeout=120000 2>&1 | grep -E "Tests |FAIL|Error" | head -5)
rm -f $WT/tests/zzPinDump.test.ts
python3 -I - "$1" <<'PY'
import json,re,difflib,sys
H='/home/user/aw-work/11/menu/pin'; WT='/home/user/aw-work/wt-p11menu'
a=json.load(open(H+'/main.json')); b=json.load(open(H+'/mine.json'))
want=json.load(open(WT+'/tests/uiPhase5e.brann.json'))
assert list(a['hashes'].keys())==list(b['hashes'].keys())
def strip(s): return re.sub(r'<[^>]+>','\n',s) if isinstance(s,str) else json.dumps(s,ensure_ascii=False,indent=0)
seen=[]; keys=[]
for k in a['pin']:
    if a['hashes'][k]!=b['hashes'][k]:
        keys.append(k)
        x=[l for l in strip(a['pin'][k]).split('\n') if l.strip()]; y=[l for l in strip(b['pin'][k]).split('\n') if l.strip()]
        for d in difflib.unified_diff(x,y,lineterm='',n=0):
            if d.startswith(('---','+++','@@')): continue
            if d not in seen: seen.append(d)
open(H+'/diff.txt','w').write('\n'.join(seen)+'\n')
print(len(keys),'keys moved;',len(seen),'changed lines (pin/diff.txt)')
print(keys)
if len(sys.argv)>1 and sys.argv[1]=='--write':
    for k in keys: want[k]=b['hashes'][k]
    json.dump(want,open(WT+'/tests/uiPhase5e.brann.json','w'),indent=2); open(WT+'/tests/uiPhase5e.brann.json','a').write('\n')
    print('written')
PY
