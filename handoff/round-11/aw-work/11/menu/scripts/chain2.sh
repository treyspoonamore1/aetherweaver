#!/bin/bash
S=/home/user/aw-work/11/menu
cd $S/scripts
for sec in fresh veteran settings summary road fight; do node capture.mjs $S/dist-final $S/after-final 4622 $sec; done
echo finished
