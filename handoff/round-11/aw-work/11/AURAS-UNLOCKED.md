# The aura restriction is lifted (18 November 2026)

The owner was asked, through the orchestrator, whether one line of the aura pin could change and
whether a text pass could shorten lines that describe auras. Their answer, in their words:

> "You can change the auras, remove that restriction."

and to the second question, "See previous answer".

## What this changes

- The earlier rules "Ask me before making changes on the auras" and "Propose, then I approve" no
  longer apply. Aura and ornament drawing, their text, the eight aura files and both aura pins are
  ordinary parts of the game: change them when the work calls for it, with the same care as
  anything else.
- The pins stay, as **regression pins**: `tests/aura/presentationPin.json` and
  `tests/aura/chordCardsPin.json` still catch a look, a sound or a card that moved by accident.
  Re-record an entry only when the change means to move it, compare entry by entry first, and say
  in the commit which entries moved and why. Never re-record to make an unexplained failure pass.
- The release check's rule that the eight aura files are untouched since a base commit, and that a
  pin carries only owner-approved commits (`AURA_APPROVED`, `AURA_BASE` in
  `tools/release-check.ts`, and its tests in `tests/releaseTools.test.ts`), is to be retired by
  the integration step. Until that lands, those checks will be red on any branch that touches an
  aura file or a pin; that is expected.

## What it does not change

- The owner still sees what changed: pictures and plain notes with each demo version.
- Everything else in the common briefs (commits, the trailer, no model names, stop only your own
  processes, verification before landing).
