# Solos: the orchestrator's decision (18 November 2026)

Read after `/home/user/aw-work/11/solo/DESIGN.md`. This overrides it where they differ.

## Decided

1. **Build design A, "your Thread is the Cue"**, with rules 1 to 7 of section 5 as written.
2. **The Conductor stays a Calling of skill** (question 2: yes). "Cues cost 20" goes; A Tempo
   becomes "your heroes begin their Solos on the downbeat; each Cued Solo gives 10 Resonance".
3. **The fights are left alone** (question 3). The Skilled results are held where they are today;
   the Novice's bands are re-set to the new results in tuning, and the docs say so plainly.
4. **The word stays**: "Cue" and "Cued" for the stronger form.
5. **Question 1 (the aura pin's `simVersion` line) is the orchestrator's to handle.** No agent
   edits anything under `tests/aura/`, either pin file, the eight aura files, or the
   `AURA_APPROVED` list in `tools/release-check.ts`. After `SIM_VERSION` moves, exactly one
   assertion fails: `tests/aura/presentationPin.test.ts`, "expect(PIN.simVersion).toBe(SIM_VERSION)".
   Report it as the one expected failure. If any *other* aura test fails, stop and report: that
   means a look or a sound moved, and that needs the owner.

## Added to the design

- **It must work for hands, not only for bots.** The bots move the Thread in one tick. Add to the
  study a "person" follower: it starts moving the Thread 350 ms after the tell appears (the tell
  is the last 3 s of charge plus the wait), misses one Solo in six altogether, and does not leave
  a hero under 30% life. Keep the wait (`1 s`) and the gap (`1 s`) as named constants. In tuning,
  the target is that this follower gets at least 70% of Solos Cued in boss fights; if it does not
  with a 1 s wait, lengthen the wait or widen the rule (for example, Cued if the Thread was on
  the hero for the last half second before firing *or* arrives in the first 0.3 s after) and say
  what you chose and why.
- **Recorded results that depend on how the bots play are recorded once**, after the bots' Thread
  rule exists. So the bots' rule (design W1's first half: `src/bots/*`) moves into W0. The
  baselines in `tools/` and the tuning stay in the later step.
- **The mark over a hero whose Solo is coming** is new drawing, not an aura, an ornament or a
  Calling's drawing, so it does not need the owner's approval per change, but the owner will be
  shown it. It is built in the later HUD-and-picture step, in a new file under `src/render/`,
  anchored at `r.height * HERO_DRAWN` like the marks landed in Version 19. It must not edit
  `src/render/field.ts`, `songs.ts` or `fermata.ts`.
- **A wasted Solo is the thing a player will notice.** The three pieces of judgement the design
  lists as "to try" (Kael's wall for a party-wide hit, Lyra and Vexis not rooting into a hit, no
  Solo on the last nearly dead enemy) and "no Solo into a boss that cannot be hurt" are in scope
  for tuning: measure each, keep the ones that help.

## Steps

- **W0 (one agent, first):** the sim's rules 1 to 6, the content changes, the three bots' Thread
  rule, the versions, the goldens and the other recorded results that follow from them. Whatever
  must change elsewhere for typecheck and lint to pass is done minimally (the Cue key removed
  from input, a setting dropped) and listed for the later steps to finish properly.
  Finish line: typecheck and lint clean; the unit suite green except (a) the one aura assertion
  above and (b) tests named in the hand-off file as belonging to a later step, each with the
  reason. Write `/home/user/aw-work/11/solo/W0-HANDOFF.md`: what is done, what each later step
  owns **by file**, so four agents can work at once without touching the same file.
- **Then in parallel:** W1 tools, baselines and tuning (W5); W2 input, settings, saves, replay
  formats, Auto-Thread; W3 HUD, hints, text, and the new mark; W4 sound. Then W6: tests, browser
  tests, docs, an independent review, full verification.
- Text under `src/ui/text/en` is shared with the menu stream, which is rewriting first-hour
  screens now and leaving every Solo, Cue, autonomy and Resonance line alone. W0 touches no file
  under `src/ui/text/en` except where a deleted key will not compile; W3 does the wording after
  the menu branch is merged in, in the voice of `docs/voice.md`.

## Standing rules (as in the common brief)

Commit often on `p11/solo`; no model names anywhere; the commit trailer from the common brief;
stop only your own processes by pid; the machine has 4 CPUs and two other agents are running
tests, so use `--maxWorkers=2` and expect slow runs.
