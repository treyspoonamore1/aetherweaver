# Phase 5b UI: Brann and the roster

*Workstream W6 of [Phase 5b](../phase-5b.md), with the W7 review fixes.* With unlockAll off, an
unrecruited profile's screens equal today's: every new piece keys on the roster having more than
three heroes, on `HeroHud.blood` (present only for a hero with Blood Rage), or on a def field only
Brann has (`passive`, `needs`, `recruit`). The lab's 'Brann' group (`src/ui/lab/brannLab.tsx`)
shows every state below.

## The roster

| Piece | What it shows | Where |
| --- | --- | --- |
| Prep's picker | `prepParty(roster)` is null while the roster has 3 heroes, so a starter-only profile sees today's Prep. With 4, every roster hero is a toggle (`prep-pick-<id>`), exactly 3 chosen, in content order. Each chosen card shows the key it will take (`data-key`); with three chosen the others read "Drop one first". Embark stays disabled until the pick is legal. | `screens/PrepScreen.tsx` `PartyPicker`, `screens/rosterModel.ts` |
| Missing starters | One note per starter the pick leaves out (`prep-party-notes`): no Kael (no dome; Brann is the front line), no Lyra (only Shield Bash and Sunder Leap interrupt), no Vexis (no Gravity Well). | `rosterModel.ts` `missingStarterNotes` |
| Passive and Needs | On Prep's hero card and the Codex's hero entry, only for a def that has them (`prep-passive-brann`, `prep-needs-brann`, `codex-passive-brann`, `codex-needs-brann`). The Codex adds how his cut stacks: a quarter with a Wound or outside the Bloodmoon's pools, an eighth with both (`codex-heal-stack-brann`, `healCutStackText`). Since the rebalance the Passive row reads his lifesteal to a tenth (4.8%), and the Needs row and Codex say he steps out of blows aimed at the others, never one aimed at him. | `PrepScreen.tsx`, `CodexScreen.tsx`, `rosterModel.ts` |
| Following the roster | A run in Prep follows the profile's roster: turning *Skip the unlocks* off, or resuming a saved Prep after it went off, puts a party holding an unrecruited hero back to the default party (`followParty`), so Prep never shows a party it wouldn't embark. Embark keeps its own fallback. | `app/runStore.ts` |
| The Cell's choice | Reads against the heroes really recruited (`choiceRoster`), never *Skip the unlocks*' list: winning recruits the prisoner whatever that setting says, so the choice says he joins until he is free. `recruitedText` once recruited; `partyText` while he stands in the party. | `screens/EventScreen.tsx`, `rosterModel.ts` |
| Codex locks | A locked silhouette per unrecruited hero on the Heroes and Calls pages, and per hero-bound motif chip, with the two-route unlock text ("Free him from the Legion's cell in Movement II, or face Vharun"). | `CodexScreen.tsx`, `rosterModel.ts` `lockedHeroText` |
| Elsewhere | Bonds tabs sized by roster count; the Harmony ribbon and 'would enable' hint on Draft and shop cards; In the Red only when Brann is in the roster (`deedsInSight(seen, roster)`); the Result's 'A new ally' gain line from `recruitNotices`; FreshStrip. | |

## Brann in a fight

| Piece | What it shows | Where |
| --- | --- | --- |
| Alarm bands | No hurt tier. Critical below 15%, when falling fast, or with a lethal hit coming (`frameLevel`). Between 40% and 15%, standing and not critical, his life is the raging ember (`frameRaging`, `RAGING_COLOR`), never the alarm colours. | `hud/healthModel.ts`, `hud/bloodLook.ts`, `app/healthLevels.ts` |
| Ticks and band | Lines at 40% (Bloodlust) and 15% (critical) always; at 30% with Berserker's Hymn or Blood and Silk (one line, both named in its title); at 10% with Deathless. The raging band along the bar's foot. | `bloodLook.ts` `bloodTicks`, `PartyFrames.tsx` |
| Chips | Blood Rage's bonus (`+62%`), Bloodlust · no Rally, Bloodlet ×N, Deathless, Blood Oath, a Blood Tithe Ward (`blood-<id>`). | `bloodLook.ts` `bloodChips` |
| Bloodletting | Life he spent drops with no white hit trail (`lifeDrop`, from `HeroHud.blood.spent`) and shows as a crimson drain that fades in 0.9 s (`hp-drain`), as over his head. A hit in the same moment still trails white for its own part. | `bloodLook.ts`, `PartyFrames.tsx` `HpBar` |
| Heal cut | The permanent heal-cut hatch (`movementTwoMarks`, `healCutTitle`), through `weaverHealCut`. | `hudBridge.ts`, `hud/legionLook.ts` |
| Keys | Every frame shows its key (`frame-key`, `data-key`): a hero's key follows the party. | `PartyFrames.tsx` |
| Call | The Call prompt names its hero, with his 'B' disc. | `bloodLook.ts` `callNamed` |
| 'New ally' | His first fight beside you: who he is and the rule that changes how you play him (healing halved; Wards and barriers aren't cut; Fermata still saves him). Non-blocking, once (`ally:<id>`). | `hud/sighting.ts`, `hud/Callouts.tsx` |
| Hints | `brannLow`; a refused Rally; a Fermata hold on him. Existing hint counts unchanged. | `hud/hints.ts` |
| Decrees | No dome without a dome hero (`decreeNoDome`); Execution condemning Brann reads 'Ward him: your healing barely takes on him.' | `hudBridge.ts`, `hud/legionLook.ts` |

## Results and the Summary

- **His line:** 'Under 40%: 62% of the fight · Lifesteal 1,240 · Your healing on him: halved' on
  the Result, and the run's on the Summary (`blood-line`). With Blood Oath played, the cut reads
  'full (Blood Oath)'.
- **His downs:** each one's advice (`downAdvice`) replaces the generic answer line, in priority
  order: a refused Rally; a heal quartered with the Bloodmoon's cut on him (the down record's
  `bloodmoon`, so a Wound or Dissonance cutting as deep is not read as the pool's); Twin Cleave
  with no dome. Otherwise the generic answers, without the dome when no dome hero is present.
- **Bond XP:** a fight's result holds the XP as awarded (the late recruit's catch-up, doubled),
  so the Result and the Summary show what he earned. A Bond scene pays exactly what its choice
  and its Continue line show: the catch-up is a fight's, never a scene's.

## Known deviations

- **The frame's raging fill** is `#c2410c`; the band over his head is the pale Spire ember. The
  levels agree; the shades differ (see [vfx-audio.md](vfx-audio.md), "Known deviations").
- **The Cell's 'party' text under *Skip the unlocks*.** With Brann picked but not recruited, the
  Cell shows its `partyText` (he stops at his old cell), and a win still recruits him and says so
  on the Result. That is a tester's view, not a player's.
