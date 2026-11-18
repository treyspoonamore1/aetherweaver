#!/bin/bash
# propcommits.sh: one commit per proposal, stacked in order on the proposals branch (run in wt-prop
# on a clean tree at the Part 1 commit).
set -e
S=/home/user/aw-work/11/marks/scripts
TRAIL=$'Co-Authored-By: Claude <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01MH5PPqLtisvhfXmhxM3BPg'
commit() { # <spec> <subject> <body>
  python3 -I $S/apply.py . $S/$1.py
  npx prettier --write $(git diff --name-only) > /dev/null
  git add -A
  git commit -q -m "$(printf '%s\n\n%s\n\n%s\n' "$2" "$3" "$TRAIL")"
  echo "$1 -> $(git rev-parse --short HEAD)"
}
commit p2a_pour "Proposal P1: the pour's label over the drawn head" "The label a pour shows over the hero the Thread moved to is lifted from the hero's drawn height (1.12), keeping its lift. Proposal only: it moves the aura presentation pin's beam stream, and that test is left failing for the owner."
commit p2b_luminary "Proposal P2: the Luminary's Dawn callout, Radiance shaft and Sovereign circlet from the drawn height" "The Dawn callout over a hero, the top of the shaft of light on a hero in the field and the circlet over the Weaver are placed from the drawn height. Proposal only."
commit p2c_martyr "Proposal P3: the Martyr's seals and ember over the drawn head" "The Vow's seal over each hero (with the bursts placed with it), the ember over the Weaver while Undying Devotion is unused and its UNDYING callout are lifted from the drawn height. Proposal only."
commit p2d_chrono "Proposal P4: the Chronomancer's mastery mark and Stasis clock over the Weaver's drawn head" "Temporal Mastery's clock over the Weaver and the clock that flashes over her as Stasis starts are lifted from her drawn height. Proposal only."
commit p2e_conductor "Proposal P5: the Conductor's sigil, Marcato mark and Spotlight from the drawn height" "The chain sigil over a Cued hero (and the lines drawn between sigils), Marcato's accent beside a hero's head and the top of the Spotlight's cone are placed from the drawn height. Proposal only."
commit p2f_mark "Proposal P6: the target mark over a hero, with Foresight's outline of it, over the drawn head" "The mark an attack puts over the hero it is aimed at (with Doom's pips round it and its answer badge), a raid's mark over every hero, and the Chronomancer's drawing of that mark (Foresight's outline, Paradox's mark flying back) are lifted from the drawn height together. Proposal only."
git log --oneline | head -7
