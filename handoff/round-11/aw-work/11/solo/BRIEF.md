# Stream SOLO, part 1: investigate and design (no game code changes yet)

Read `/home/user/aw-work/11/COMMON.md` first. Worktree `/home/user/aw-work/wt-p11solo`, branch
`p11/solo`, scratch `/home/user/aw-work/11/solo`, ports 4600-4619.

## What the owner said

> "I feel like no players will manually trigger the solos/specials of each character - so either
> remove the manual trigger or design the game around auto triggering."

Today each hero's Solo charges by fighting and, at 100, waits for the Weaver's **Cue** (T, or
Shift+1-4; it costs Resonance), which fires it in a stronger "cued" form. An assist, **Hero
autonomy**, lets heroes fire their own (weaker, uncued) Solo a moment after it charges
(`docs/hero-autonomy.md`, `AUTONOMY` in `src/sim/constants.ts`, `src/sim/systems/solos.ts`,
`heroes.ts`, `conducting.ts`). A whole Calling, the Conductor (`docs/phase-5f.md`), is built on
Cues. The Finale's boss also "Cues Solos" onto its own voices: that is an enemy mechanic and is
not what the owner means.

## The direction I intend, for you to test and sharpen

**Design the game around heroes firing their own Solos; remove the per-hero manual trigger.**
The Weaver is a support: the player already decides who gets their attention with the Thread. So:

1. Heroes always fire their own Solo when it is charged. Hero autonomy stops being an assist; it
   is how the game works. Kael's "hold for a big hit, at most 3 s" judgement stays or improves.
2. The Cue command (T, Shift+1-4, the pad's equivalent) goes away as a thing the player must do.
3. The stronger form is not thrown away. The leading idea: **a Solo fired while that hero is on
   the Weaver's Thread is the stronger form** (so "who am I threading right now" carries the
   choice, with no new key). The frame shows the Solo about to fire so the player can swing the
   Thread over in time. Resonance then feeds Crescendo only.
4. The Conductor Calling has to become something that still makes sense and is still worth
   picking. Work out what.

This is a starting point. If the code or the numbers say another shape is better (for example the
stronger form always, or the stronger form from Empower mode only, or from standing in the song
field), say so and why.

## What to deliver: `/home/user/aw-work/11/solo/DESIGN.md`

Plain language, short sections, written so the owner could read it. It must contain:

1. **How it works today**, exactly: charge, Cue, cost, the cued and uncued form of every hero's
   Solo and every alternate Solo (a table: hero, Solo, uncued, cued), what Resonance is spent on,
   what autonomy does, everything else that reads or reacts to a Cue (relics, boons, bonds and
   talents, Deeds, Astrolabe nodes, Dissonance levels, the Finale, events, tutorials and coach
   hints, the HUD, key hints, Settings, Codex pages, the gamepad wheel, bots, the weekly, replays
   and their command format, saves).
2. **Measured today**: with the Skilled and the Novice bot, across a spread of fights (a skirmish
   and a boss in each Movement, at least 6 seeds each), how many Solos charge, how many are fired
   cued, uncued or never, win rate, time to win, heroes downed, and Resonance spent on Cues against
   Crescendo. Use the repo's headless harness (`tools/`, `src/bots/`); do not write a new sim.
3. **Two or three candidate designs**, each with: the rule in two sentences, what the player does
   differently, what happens to Resonance, what the Conductor Calling becomes, what each thing in
   the list of item 1 becomes (kept, changed, removed), and its risks.
4. **Measured candidates**: prototype each candidate just far enough to measure it (on throwaway
   branches or behind a test-only switch in your worktree; nothing you commit on `p11/solo` may
   change how the game plays yet). Same table as item 2. Balance should land close to today's
   Skilled-bot results; say what tuning each needs.
5. **Your recommendation** and the full work list to build it: every file and system touched, the
   pins that will move (SIM_VERSION, contentVersion, goldens, baselines, the command snapshots,
   replay and save versions and how old replays and saves are handled), the tests to add, the text
   that changes, the order of work and what can be done in parallel.
6. **Questions only the owner can answer**, at most three, each with your recommended answer.

Do not change the aura pins or the eight aura files. If a candidate would need to, say so.

Hand back a short report: the recommendation in five lines, the measured table, the open
questions, and the path to the document. Do not start building; the orchestrator will read the
document, decide, and send you the go-ahead.
