#!/bin/bash
S=/home/user/aw-work/11/menu
cd $S/scripts
node capture.mjs $S/dist-after $S/after 4621 fresh
node capture.mjs $S/dist-after $S/after 4621 veteran
node capture.mjs $S/dist-after $S/after 4621 settings
node capture.mjs $S/dist-after $S/after 4621 summary
node capture.mjs $S/dist-after $S/after 4621 road
node capture.mjs $S/dist-before $S/before 4620 fresh
node capture.mjs $S/dist-before $S/before 4620 veteran
node capture.mjs $S/dist-after $S/after 4621 fight
node capture.mjs $S/dist-before $S/before 4620 fight
echo finished
