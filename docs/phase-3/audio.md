# Audio: Phase 3 additions

Everything is still synthesised, D dorian, all in `src/audio`. Phase 2 notes are in `docs/phase-2/audio.md`.

## The beam song in the Thread's hum

The old Unison-anchor logic (`anchor === 'thread'`) is gone. The hum now keys off the beam song: a Chord with `role: 'beam'`, at least one aura and a `threadHero`.

- Focus x2 (normal): a subtle harmony. A fifth above at low level, plus the octave when the beam song has two auras. Hum floor 0.008, so it never goes silent while the beam sings.
- Focus >= 2.5 (Unison x3): the fuller Phase 2 hum (fifth 0.7, octave 0.45, floor 0.012).
- Pitch is snapped to the scale whenever the beam song sings. No beam song: the hum is as before.
- No per-frame allocation (a plain loop over `state.field.chords`).

**Beam pour** (`threadAttached` while a beam song sings): a quiet rising arpeggio of chord tones (3 plucks, 4 with Unison), a glass note on top and a short breath, panned to the new hero. Voice group `pour` (1), rate gate 0.2 s. Peak about -20 dBFS. No beam song: no pour (the attach pluck plays as before).

## Aura heals

`healApplied` with `via: 'aura'` makes no sound (only `via: 'mend'` does). A test guards it. Nothing is added as texture; the beam song's hum and the Chorus Pulse already carry the aura feel.

## New UI sounds (`playUi`)

| Id | Sound |
|---|---|
| `rankUp` | About 2 s. Warm choir on D A F (Dm), a rising pluck-and-glass run D5 E5 F5 A5 to a long D6, a handbell on A5, a low D, a rising breath. Group `ui:rankUp` (3). |
| `unlock` | One per unlock card. A small handbell A5, a D6 pluck with a glass sparkle, a gentle rising whoosh (about 1 s). Rate gate 0.06 s, so staggered cards can each call it. Group `ui:unlock` (3). |

`UiSound` in `src/audio/types.ts` gained `'rankUp' | 'unlock'` (types.ts is not CONTRACT v4).

## Hearing it in the lab (`?lab=audio`)

- UI group: `rankUp`, `unlock`.
- Phase 2 group: `Beam pour (beam song x2)` and `(x3, Unison)`.
- The old Unison checkbox is a select, **Beam song on the Thread**: off, x2, x3. Raise Thread tension to hear the hum harmony.
- "Audit every sound" and the `__audioLab` hooks include the new buttons.

## Mix notes

Everything new sits well under the Perfect Ward (the loudest one-shot). The pour is the quietest of all, as it plays on every beam move; `rankUp` is a UI-bus sting like `reveal`.
