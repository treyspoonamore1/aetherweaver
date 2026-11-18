#!/bin/bash
S=/home/user/aw-work/11/menu/pass2
cd $S/scripts
for sec in settings veteran codex endgame; do node capture.mjs $S/dist-before $S/before 4620 $sec; done
echo finished
