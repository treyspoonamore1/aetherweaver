# Phase 3b UI: relics, merchants, forges and events

*Owner: the UI workstream (`src/ui/**`). Builds on [Phase 3's UI](../phase-3/ui.md). Spec: [docs/phase-3b.md](../phase-3b.md).*

Everything here can be reviewed without playing: open **`/?lab=ui`** (sidebar groups **Relics & stops** and **Events**, plus two new **Combat HUD** views) or `/?lab=ui&view=<id>&nav=0`. The lab's **Flow** (whole run, fake combats) now goes through relic offers, merchants, forges and events with the real screens.

Every number on these screens is read from content, the run state or `meta/economy.ts` (`relicText`, `relicCurse`, `boonText`, `FIGHT_AETHER`, `GRADE_AETHER`, `RELIC_OFFERS`, `RELIC_PRICE`, `FORGE_PRICE`, `SHOP_HEAL`, `node.reward.threat`), and every "why not" sentence comes from the run's own checks (`eventChoiceProblem`, `forgeTargets`) or from the price and the purse. The screenshots show content as it was during this session (Hymnal 50 Resonance, Prism Loom 5 m / 60%, the Threat rate of the day); the lead's tuning flows through.

`src/ui/screens/InterludeStub.tsx` is gone.

## What changed, by screen

| Where | What | Files |
|---|---|---|
| Map | Real glyphs for **merchant** (purse), **forge** (anvil), **event** (diamond with a question); event nodes are labelled with the event's name; a **run strip** (Aether, relics with tooltips, boons/banes with fights left) under the header; tooltips list **+N Aether, more for a good grade**, **Choose 1 of N relics**, the draft and healing, the event's name, glyph and teaser, "You carry N Aether" at merchants and forges, and a quiet **Threat** line | `screens/MapScreen.tsx`, `screens/RelicCard.tsx` (`RunStrip`), `screens/interlude.ts` |
| Relic offer (`relic`) | 2–3 relic cards (glyph, name, rarity, rule, curse, flavour), keys 1–3, **Leave them**; titled by `relicOffer.reason` (elite / the Bellwarden / the event's name) | `screens/RelicScreen.tsx` |
| Merchant (`merchant`) | Relic cards, motif cards (the Draft's card: new vs upgrade, level, `motifLine`), the healing with the party's bars and the hatched preview; each footer has the price and **Buy / Weave in / Strengthen / Drink**, or the reason ("Needs 35 more Aether", "Sold: yours now"); a status line announces each purchase or refusal | `screens/MerchantScreen.tsx` |
| Forge (`forge`) | Three service cards with price and availability; **Temper** → motif picker (level n → n+1, the line now struck through and after); **Retune** → the Respite's builder; **Lift a curse** → cursed relic cards with the curse previewed struck through; after the one service, "The forge has cooled" and what changed | `screens/ForgeScreen.tsx`, `screens/MotifPicker.tsx` |
| Event (`event`) | The scene (glyph, text), choice cards with their text, tags (cost, odds bar, "An elite fight", "A rare relic", "−20% life"…), greyed with `eventChoiceProblem`; motif choices open the picker (only motifs below their last level for `upgradable`), retune choices open the builder; after choosing: the gamble's result, the outcome, relics gained as cards, a **What changed** list and the party's bars after heal/hurt, **Continue** | `screens/EventScreen.tsx` |
| Result | **+N Aether** under the XP panel ("35 for the win × 1.5 for grade S", "113 in your purse"), the Threat line, and Continue says what's next (**Continue: choose a relic** / **choose a motif**) | `screens/ResultScreen.tsx` |
| Summary | **Relics and Aether**: each relic carried (curses struck through if cleansed), Aether earned in fights and left unspent | `screens/SummaryScreen.tsx` |
| Draft | With the Star Chart's fourth option: a 2×2 / 4-wide grid and "Your Star Chart adds a fourth choice." | `screens/DraftScreen.tsx` |
| Codex | **Relics** tab (by rarity with merchant prices, how relics are found, what a forge does to curses) and **Events** tab (every event, its choices and their tags; boons and banes with how long they last) | `screens/CodexScreen.tsx` |
| HUD | A **relic bar** under the encounter header; boon/bane chips | `hud/RelicBar.tsx`, `hud/relics.ts`, `hudBridge.ts`, `store.ts`, `hud/Hud.tsx`, `hud/EncounterHeader.tsx` |
| Kit | Relic / boon / event glyph set and rarity looks; a CSS tooltip; `aether`, `purse`, `anvil`, `event`, `relic` icons | `kit/RelicGlyph.tsx`, `kit/Tip.tsx`, `kit/iconPaths.ts` |

## Relic glyphs and rarity

One 24×24 line-art glyph per content `icon` key (relics: thimble, lantern, robe (a feather), key, fork, baton, bell (cracked), veil, hymnal, star (a chart), loom, metronome, spindle, score, halo; boons: note, frayed, loom; events: cantor, discord, pool, hood, reliquary, loom), same stroke and caps as the Icon kit. `RelicGlyph` draws one in a disc ringed in its rarity's colour; colour is never alone:

| Rarity | Look |
|---|---|
| Common | silver ring, one diamond |
| Rare | blue ring, two diamonds |
| Legendary | amber ring with a glow, three stars |
| Cursed | **dashed rose ring**, a red wash, a skull badge, the curse in rose with a skull |
| Cursed, cleansed | **calm indigo solid ring**, a check badge, "Cursed · cleansed", the curse kept but struck through ("Curse lifted: ~~You can't Glide.~~") |

## Map

| Run strip and new nodes | An event's tooltip |
|---|---|
| ![](ui/map-3b.jpg) | ![](ui/map-tip-event.jpg) |

| The Bellwarden: Aether, 1 of 3 relics, Threat | A carried relic's tooltip (a cleansed curse) |
|---|---|
| ![](ui/map-tip-miniboss.jpg) | ![](ui/map-relic-tip.jpg) |

- Node labels are narrower (5.4 rem) so ten rows don't run into each other at 1280 px. The hovered or focused node is raised above its neighbours (each node's transform made its own stacking context, so tooltips were drawn under the next column).
- **Threat**: "Threat: enemies +23% life" for fights, "Threat: any fight here, enemies +N% life" for events, from `node.reward.threat`; nothing at ×1. Small mono text under the chips: context, not a warning. Also on the Result screen under the time (from the fight's node).
- Relic badges and boon chips are focusable (`tabIndex 0`) with the same tooltip on focus; their aria label is the whole sentence.

## Relic offers

| After an elite (1 of 2) | The Bellwarden (1 of 3) |
|---|---|
| ![](ui/relic-elite.jpg) | ![](ui/relic-boss.jpg) |

![The Unsung Choir's reliquary](ui/relic-event.jpg)

- Titles: elite "A relic for the taking"; boss "The Warden's hoard" ("Only rare and legendary relics lie here."); event: the event's name as the eyebrow, "The reliquary opens".
- After the Unsung Choir's fight the Result's button reads **Continue: choose a relic** (the event is kept through its fight, so `nextStep` reads `run.event.relics`), then the offer, then the map.

![The result after the Unsung Choir](ui/result-event.jpg)

## Merchant

![Merchant: an affordable rare, a legendary too dear, a sold curse, an upgrade, a new motif, healing](ui/merchant.jpg)

- Unaffordable and sold cards stay focusable (`aria-disabled`): a click plays `cantAfford` (or `error` for sold) and the status line says why; a purchase plays `buy` and says "Bought Choirmaster's Baton for 80 Aether."
- The healing card shows each hero's bar with the 30% preview hatched, and "Everyone is at full life: it would do nothing." when it would.

## Forge

| Three services | Short of Aether, no curse |
|---|---|
| ![](ui/forge.jpg) | ![](ui/forge-poor.jpg) |

| Temper: choose a motif | Lift a curse: the curse previewed struck through |
|---|---|
| ![](ui/forge-temper-pick.jpg) | ![](ui/forge-cleanse-pick.jpg) |

| After Temper | After Lift a curse | After Retune |
|---|---|---|
| ![](ui/forge-temper-done.jpg) | ![](ui/forge-cleanse-done.jpg) | ![](ui/forge-retune-done.jpg) |

- Reasons, in order: "Done" / "The forge has cooled: one service per visit." once used; "You have no motifs yet." / "Every motif you have is at its last level." / "You carry no curse."; then "Needs N more Aether". Available cards say "3 motifs can grow", "1 curse to lift", "Same rules as Prep".
- Retune is the Respite's builder (`RetuneView`, now exported with its copy as a prop): "Retune for 20 Aether", "Back to the forge".
- Sounds: `forge` for temper and retune, `curseLifted` for a cleanse, `cantAfford` on a closed card. Keys 1–3.

## Events

| The choice | A choice you can't afford (25 Aether) |
|---|---|
| ![](ui/event-wounded_cantor.jpg) | ![](ui/event-broken_loom.jpg) |

| The Shrine of Discord: choose a motif | A fight choice |
|---|---|
| ![](ui/event-shrine-pick.jpg) | ![](ui/event-unsung_choir.jpg) |

| Gamble won | Gamble lost |
|---|---|
| ![](ui/event-shrine_of_discord-offer-won.jpg) | ![](ui/event-shrine_of_discord-offer-lost.jpg) |

| A relic and a bane | Paid in blood |
|---|---|
| ![](ui/event-wounded_cantor-mend.jpg) | ![](ui/event-merchant_of_silences-blood.jpg) |

- Gambles show their odds as a bar ("60% it works / 40% it doesn't") on the card and on every motif in the picker ("60%: … / 40%: it shatters, and is lost."); after it, "It worked: the 60% came up." or "It went wrong: the 40% came up." with `gambleWin` / `gambleLose`.
- `eventOpen` on arrival, `relicReveal` when an outcome brings relics. Keys 1–3.
- A fight choice moves the run to `combat` by itself; RunScreen shows the fight, then the Result, then the relic offer.

## HUD

| Metronome ready, Thimble cooling, Veil spent, a cleansed Heavy Score | Metronome cooling, Veil ready, the Lantern flashing |
|---|---|
| ![](ui/hud-relics-bar.png) | ![](ui/hud-relics-waiting-bar.png) |

![The relic bar in the HUD](ui/hud-relics.jpg)

- A small glass row under the encounter header (top-left, the quietest corner), 32 px tiles, built from `WorldState.relics` by `hud/relics.ts` (`relicHuds`) into `HudSnapshot.relics`:
  - **Cracked Metronome / Silver Thimble**: a ring that fills until `metronomeAt` / `thimbleAt` with the seconds left under it; when ready the ring turns gold and the tile glows. The cooldown length is the relic's `values.cooldown`.
  - **Martyr's Veil**: glowing while available; greyed and struck through once spent.
  - Others: passive glyphs. Run-only relics (Star Chart) aren't shown in a fight.
- **Flash**: a tile scales up with a ring of its colour for 0.9 s when the relic acts. `relicHuds` gives every relic a `pulse` that changes exactly when it acts (the Metronome's and Thimble's next-ready time, the Veil being spent, `ledger.perfects` for the Tuning Fork and the Glass Halo, `ledger.downs` for the Lantern); `RelicBar` flashes whatever changed between two snapshots, and the Hymnal on the bar's first appearance in the first 4 s. See Contract notes for why it isn't driven by `relicTriggered`.
- **Boon chips** after the relics (The Last Note ·1, Frayed Spirit dashed in rose), from the run's `boons` (none in the Training Grounds).
- Aria labels: "Cracked Metronome: ready", "Silver Thimble: 2.3 s", "Martyr's Veil: spent this fight".

## Codex

| Relics | Events, boons and banes |
|---|---|
| ![](ui/codex-relics.jpg) | ![](ui/codex-events.jpg) |

## Summary

![Relics and Aether on the summary](ui/summary-relics.jpg)

## Lab views

New: `hud-relics`, `hud-relics-waiting`; **Relics & stops**: `map-3b`, `map-relic-tip`, `map-tip-{merchant,forge,event,elite,miniboss}`, `relic-{elite,boss,event}`, `result-event`, `merchant` (click to buy), `forge` (click through), `forge-poor`, `forge-{temper,cleanse,retune}-pick`, `forge-{temper,retune,cleanse}-done`, `codex-relics`, `codex-events`; **Events**: `event-<id>` for all six (interactive), `event-shrine-pick`, `event-pool-retune`, and after-views `event-<id>-<choice>` for eleven choices including `event-shrine_of_discord-offer-won` and `-offer-lost`. `flow` routes the four new phases to the real views.

Mock builders in `lab/mock.ts`: `lootRun`, `mapRun3b`, `merchantRun`, `forgeRun({aether, curse})`, `forgeAfter(service)`, `eventRun(id, aether)`, `eventAfter(id, choice, {won})` (searches the map's node ids for a seed/node that rolls the wanted way), `relicOfferRun(reason)`, `eventFightResultRun`, `nodeOf`; HUD scenarios `relics` and `relics-waiting`. `fakeOutcome` uses the event's encounter on event nodes.

## Tests

`tests/uiPhase3b.test.ts` (28 tests, numbers from content/economy):

- Aether: wording, the fight line from `FIGHT_AETHER` × `GRADE_AETHER`, losses, the Cantor (no line), Aether earned.
- Map: reward chips for a hand-made elite and for every node of a real map (Aether iff `reward.aether`, relics iff `reward.relics`, counts from `RELIC_OFFERS`), event previews, the Threat line (quiet at ×1, `threatFor`).
- Relics and boons: rule and curse equal `relicText` / `relicCurse` for every relic, cleansed sentences, fights left, offer titles, "Continue: choose a relic" after the Unsung Choir and the run then offering 3 relics for reason `event`.
- Merchant: sold / short / affordable with the shortfall, agreeing with `Run.buy`.
- Forge: every service open, each closed reason, one service per visit, temper's n → n+1 lines, the cap.
- Events: greyed sentence equals `eventChoiceProblem`, odds, fight and retune flags, upgradable motif targets, gain lines for a relic + bane, a won and a lost gamble, heal, hurt, Aether, retune and nothing.
- HUD: `relicHuds` cooldowns / Veil / passive / run-only, `pulsed` for the Metronome, the Veil and the Tuning Fork, `buildHudSnapshot` on a real sim with relics (and none without), the lab mocks cover every state.

`e2e/smoke.spec.ts` gains "Phase 3b: a merchant through the test hook": embark, `__AWRUN__.warp('merchant', 200)`, click the healing card, the purse drops, "Sold: yours now", Leave → map (9.5 s, passes against the production build). The run hook gains `warp(kind, aether?)` (test-only: walks the map's links to the first node of that kind and enters it), `aether()`, `relics()`, `buy`, `leaveShop`, `chooseEvent(id, motifId?)`, `leaveEvent`, `pickRelic`, `leaveForge`.

Also checked by clicking through the lab with Playwright: buying at the merchant (purse 95 → 15; the legendary refused with its reason), temper → done, Shrine → picker → outcome, the greyed Loom choice staying put, and the Flow from Prep through a fight, the Shrine of Discord, a merchant and on.

`npm run typecheck`, `eslint src/ui tests`, `prettier --check src/ui tests docs/phase-3b`, `vite build` pass. The full vitest suite passes except `tests/renderRelics.test.ts` (the VFX workstream's file, in progress during this session; it tests `src/render` only).

## Known gaps

- **The relic flash is derived, not event-driven.** It's exact for the Metronome, Thimble and Veil; for the Tuning Fork and the Glass Halo it follows Perfect Wards (the Fork doesn't act on a hero whose Solo is full or playing, so it can flash once where the sim didn't charge anything), and for the Lantern it follows downs (it doesn't act when nobody else is standing).
- The forge's "after" view knows which motif was tempered or which curse lifted only from the visit itself; after a reload mid-visit it says what the service does instead of what it did.
- `useFreshUnlocks` runs on the forge and event screens (so the builder can mark New), which marks unlocks introduced even if Retune isn't opened, as the Respite already did.
- Merchant items aren't on number keys (the relic offer, forge services and event choices are).
- HUD relic tiles have aria labels but no hover tooltip (the HUD is pointer-transparent); names and rules are on the map's strip and in the Codex.
- Heal/hurt outcomes show the party's bars after the event, not the before → after difference (the event state doesn't keep the old values).

## Contract notes

No changes to `src/sim`, `src/content` or `src/meta`. What I'd ask of the lead:

- **`relicTriggered` into the UI store.** The runtime (`app/runtime.ts`, not mine) drains events into callouts but not into anything the HUD can read. One line in `callouts()` — `case 'relicTriggered': useUi.getState().flashRelic?.(event.relic, now)` with a small `flashRelic` in `ui/store.ts` — would let `RelicBar` flash on the real event; the `pulse` derivation could then go.
- **`ForgeState` could record the target** (`used: { service, motifId?, relicId? }` or a `last` field) so the "after" view survives a reload.
- **`EventGains.motif` could carry the old level** (`from`) so the outcome reads "level 1 → 3" without the screen remembering it; same for heal/hurt (party HP before).
- `HudSnapshot.relics` is a UI-side addition to the store's snapshot (filled by `buildHudSnapshot`); anything that builds a snapshot by hand needs `relics: []` (the lab mocks do).
