### How big is the test work?

We switched rule A on for the whole unit suite and ran it. (The rule only: the Cue keys still
worked in that run.) **5,309 of 5,443 tests still pass. 122 fail, in 33 of the 260 test files.**

- **94 are recorded results** that need recording again and nothing else: the golden fights (52
  checks), the Dissonance pins (9), the bots' command snapshots (4), the fill pins (13), the
  Prelude, Expedition and hand-off pins (10), two audio snapshots, and four lists of recorded keys.
- **28 are tests of behaviour** to read one at a time: the two autonomy tests, six of the
  Conductor's (bots, HUD, render), nine of the harness tools', and eleven others.
- **Both aura pin tests pass.**

On top of that, 22 test files send a Cue command themselves. They are rewritten when the command
goes. So about 55 of the 260 files are touched; the rest should not notice.
