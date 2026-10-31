# Health at a glance

*2026-10-31 · plan: [04 §5.2](plan/04-presentation.md#52-layout-combat) · follows [the Thread dial](thread-dial.md)*

Asked for after playing: health was hard to see in a fight, and the party frames were hard to see or click where they sat. The user also asked that the frames move wherever the player wants, as in WoW. This is what the best healer UIs do, and what changed here to match.

![The party frames in a crisis: Kael critical and glowing red, Lyra ailing and glowing violet, the life missing in big type](health-ui/frames-crisis-1280x720.jpg)

## What healer UIs share

We looked at the raid frames of top WoW raid healers, Overwatch's and Marvel Rivals' supports, and today's healer frame addons. A world-first raider's own UI write-up wasn't reachable from here: Method's guides were blocked by the session's network. What they share:

- **Frames near the middle of the screen,** not in a corner, often as a separate healer layout. They're moved there by the player: WoW's Edit Mode and the frame addons move them anywhere.
- **What's missing, not what's left.** The missing life is the number to read (as "−42k"), and low life is highlighted.
- **Prediction.** Incoming heals and shields show on the bar. Since this summer, one addon also shows which player an enemy's spell targets, on the frames. Our striped incoming-damage forecast already did that.
- **The whole frame speaks.** Dispellable debuffs colour its border, and out-of-range players fade.
- **Bars over allies' heads.** Supports in Overwatch and Marvel Rivals see them by default, with a flag on the critical.

Ours fell short on all but prediction:
- the bars over the heroes were 34 × 5 px, showed only once a hero was hurt, and wore the hero's colour, like an enemy's;
- the frames sat bottom left, their bars teal at any life (also Mend's colour), the numbers small and grey.

## The bars over the heroes

![The bars over the heroes in a fight](health-ui/bars-in-a-fight-1280x720.jpg)

- **The whole party, always,** about twice the old size, in the overlay over the fight (`PartyBarsView`, src/render/partyBars.ts).
- **The colour of how much is left,** not the hero's: soft white, then the palette's threat under half, its lethal under a quarter, glowing and pulsing. The colour-vision palettes keep threat and lethal apart.
- **The last hit** shows as a white trail: it holds 0.4 s, then drains to the life left. Shields show as a band after the life. The damage telegraphed at them shows as stripes at its end, red when it would down them.
- **Quarter ticks** show how much at a glance.
- **The key that threads them** sits on a tag in their colour, so "Lyra is low" turns into a key without a look away.
- **Faded out of reach:** beyond the techniques' range (14 m), as WoW fades out-of-range frames.
- **Placement:** just over the head, under the Thread's mode glyph and a call's bubble.

The enemies' bars are unchanged, so heroes and enemies no longer look alike.

![Close-ups: Kael threaded and hit; Lyra full; Vexis with a blow coming](health-ui/bars-closeup.jpg)

## The party frames

![The frames, calm and in a crisis](health-ui/frames-closeup.jpg)

- **The same ramp as over their heads:** soft white, threat under half, lethal under a quarter. Hero colours stay on the portrait and the key.
- **The number a healer works from,** in big type on a dark tag: the life missing by default ("−420"; nothing at full life). Settings can switch it to the percent or the life left. The exact life stays under the bar, and the bar is taller (16 → 22 px).
- **The last hit** shows as a white trail, as over their heads. Stripes still show what's coming, LETHAL when it would down them.
- **The whole frame speaks:**
  - It glows red under a quarter of their life.
  - It glows violet when they have an ailment Chime would cleanse. Not under Blind Score, which names no answer.
  - It fades when they're out of the Weaver's reach.
- **The percent left out:** the portrait's ring already shows a percent, the Solo's charge, and two percents side by side read as one.

## Moving the frames: Edit HUD layout

![Edit HUD layout over a paused fight](health-ui/edit-layout-1280x720.jpg)

Pause, then **Edit HUD layout**. The fight stays paused under it.

- **Drag the frames anywhere.** Near the screen's middle they snap to it. Arrow keys nudge them, Shift five times as far.
- **Size:** 75–150%.
- **Stacked or side by side.** A row centred under the fight is the layout many healers use.
- **Reset** puts them back bottom left. **Done**, or Esc, closes the editor; Esc doesn't end the pause.

Each drag is saved as it ends. The frames are pinned by their corner nearest the screen's edges, or by their middle if centred, as a share of the screen (`placeFor`, src/ui/hud/framesLayout.ts). So they keep their place at any resolution and grow away from the edge they're pinned to. Their speech bubbles and tooltips open toward the middle of the screen: beside a column, above or below a row. They now draw over the other panels, so wherever they're put they stay seen and clickable.

![The frames side by side, centred over the Weaver bar](health-ui/frames-row-1280x720.jpg)

## Alerts

- **A low-life sound:** two soft falling notes as a hero falls under a quarter of their life. It sounds once per fall (re-armed back over 40%), at most once every 1.5 s across the party. It plays under the heartbeat that was already there under 30%.
- **The off-screen arrow** of a hero under a quarter pulses red, as it does for a threat, its dot still in their colour.

## Settings

Settings → **Health and the HUD** (settings v4; older settings get these defaults):

| Setting | Default | Choices |
|---|---|---|
| Bars over the heroes | Always | Always · When hurt · Off |
| Party frames show | Life missing | Life missing · Percent · Life left |
| Low-life sound | On | On · Off |
| Party frame size | 100% | 75–150% |
| Party frames | Stacked | Stacked · Side by side |
| Reset frame position | | Moves them back to the default place |

Moving the frames is Edit HUD layout's, from the pause menu.

## Checks

- **tests/healthUi.test.ts:**
  - The frames' places: corners, the middle, kept on screen, snapping.
  - The side barks open on.
  - The editor's draft, and the saved settings.
  - The frames' colours, numbers and states.
  - The bars over the heroes from a real sim: the whole party with keys and colours, the trail holding and draining, critical and glowing, faded out of reach, When hurt and Off.
- **tests/audioHealth.test.ts:** the low-life alert through the real director: once per fall, re-armed, rate-limited, silent when off.
- **tests/meta/migration.test.ts:** settings v3 → v4.
- **e2e:** a bar over each hero in the Training Grounds. Edit HUD layout from the pause menu: the frames dragged to the right and turned side by side, then saved.
- **The UI lab:**
  - `?lab=ui&view=hud-layout-edit` opens the editor over a fight.
  - `hud-frames-row` shows a centred row.
  - `hud-frames-right` shows a column on the right.

## Known gaps

- **Only the party frames move.** Edit HUD layout is built so other panels can join it.
- **No incoming-heal prediction** on the bars yet: the Thread's Mend over the next second.
- **No gamepad.** Fights don't take a gamepad yet ([docs/demo.md](demo.md)), so the editor is mouse and keyboard only.
