#!/bin/bash
cd /home/user/aw-work/wt-p11solo-review && npx vitest run --config /home/user/aw-work/11/solo/review/vitest.config.mjs "$@" --maxWorkers=2 --disable-console-intercept 2>&1
