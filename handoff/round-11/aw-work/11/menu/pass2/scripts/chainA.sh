#!/bin/bash
S=/home/user/aw-work/11/menu/pass2
cd $S/scripts
for sec in settings veteran codex endgame fresh; do node capture.mjs $S/dist-after $S/after 4621 $sec; done
node capture.mjs $S/dist-before $S/before 4620 fresh
echo finished
