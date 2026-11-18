#!/bin/bash
# Round 2: after the review's fixes. Everyone again; the Novice's new hands; Silent Cues; the Crown.
cd /home/user/aw-work/wt-p11solo || exit 1
D=/home/user/aw-work/11/solo/w1/data
S="npx tsx tools/solo-study.ts --seeds 20"
$S --out $D/r2-all.jsonl --label none --players skilled,novice,person,person-ready,ignore
$S --out $D/r2-all.jsonl --label condA --calling conductor --path marcato,reprise,ensemble,triad --players skilled,novice,person-ready
$S --out $D/r2-all.jsonl --label condB --calling conductor --path a_tempo,upbeat,spotlight,maestro --players skilled,novice,person-ready
$S --out $D/r2-silent.jsonl --label silent --dissonance silent_cues --players skilled,person,person-ready,novice
$S --out $D/r2-silent.jsonl --label silent-condA --dissonance silent_cues --calling conductor --path marcato,reprise,ensemble,triad --players skilled,person-ready
$S --out $D/r2-crown.jsonl --label crown-condA --relics hollow_crown --calling conductor --path marcato,reprise,ensemble,triad --players skilled,ignore
$S --out $D/r2-crown.jsonl --label crown --relics hollow_crown --players skilled,ignore
echo SWEEP DONE
