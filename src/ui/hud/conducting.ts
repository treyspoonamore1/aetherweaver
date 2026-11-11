/**
 * The Conductor in the fight (docs/phase-5f.md), without React so the tests read it: the Cue
 * badge on a ready hero's frame, the chain ring, the A Tempo beat strip, the Grand Finale's pips
 * and each hero's turn, the Calling chip's states, and the call-outs. Every rule is the sim's own:
 * `nextCue` (what a Cue would be now), `onBeat`, `cueCostNow` and `beatAt` (the downbeat),
 * `openChain`, `finaleView` (who plays next and at what power), `finaleTurnBlock` (what stops a
 * hero's turn), `marcatoOn`, `marcatoReadyIn`, `ensembleBonus`; every number is
 * `calling.conducting` (from content, through the mods) or `field.conducting`. Nothing here
 * decides a rule.
 */
import {
  beatAt,
  cueCostNow,
  ensembleBonus,
  finaleTurnBlock,
  finaleView,
  marcatoOn,
  marcatoReadyIn,
  nextCue,
  onBeat,
  openChain,
  spotlit,
  type EntityId,
  type SimEvent,
  type WorldState,
} from '../../sim';
import { linkName, powerLabel } from '../screens/callingText';
import type { IconName } from '../kit/iconPaths';
import type {
  BeatNow,
  Callout,
  ConductingHud,
  CueBadgeHud,
  FinaleHud,
  FinaleTurnHud,
  HeroHud,
} from '../store';
import { t as txt } from '../text';

/** Float slack for sim-time comparisons. */
const EPS = 1e-9;

/** The Weaver's gold: Duets, Trios and the Finale are her acts (docs/phase-5f.md, Callouts). */
export const CONDUCT_GOLD = '#f5d78e';
/** The downbeat's white-gold: the beat strip's band and the "Free" badge. */
export const BEAT_LIGHT = '#fff4d6';

// ── The Cue badge ──────────────────────────────────────────────────────────────────────

/**
 * "Duet ×1.25", "Trio ×1.5", "Free", "Duet ×1.25 · Free"; on the beat under Silent Cues, where
 * only the surcharge is paid, "On the beat · 10". Null for a plain Cue off the beat.
 */
export function cueBadgeLabel(next: {
  link: 1 | 2 | 3;
  power: number;
  onBeat: boolean;
  cost: number;
}): string | null {
  const chained = next.link > 1 ? `${linkName(next.link)} ${powerLabel(next.power)}` : null;
  const beat = next.onBeat
    ? next.cost <= 0
      ? txt('hud.conducting.free')
      : txt('hud.conducting.onTheBeat', { cost: next.cost })
    : null;
  return [chained, beat].filter(Boolean).join(' · ') || null;
}

/** A ready hero's badge from the sim's `nextCue` (null without the Conductor). */
export function cueBadge(state: WorldState, heroId: EntityId): CueBadgeHud | null {
  const next = nextCue(state, heroId);
  if (!next) return null;
  return {
    link: next.link,
    power: next.power,
    free: next.onBeat && next.cost <= 0,
    cost: next.cost,
    label: cueBadgeLabel(next),
  };
}

// ── The beat strip (A Tempo) ───────────────────────────────────────────────────────────

/**
 * Where the strip opens: half a beat before the downbeat, so the downbeat's window is one band
 * around the first mark (the bar runs left to right, a beat a quarter of it).
 */
const BEATS = 4;
const LEAD = 1 / (2 * BEATS);

export interface BeatStripView {
  /** The four beat marks along the strip (0 … 1), the downbeat first and larger. */
  marks: { x: number; down: boolean }[];
  /** The downbeat's window, either side of its mark. */
  band: { from: number; to: number };
  /** The light, where the sim's time is in the bar (0 … 1 along the strip). */
  light: number;
  /** The light is inside the band: a Cue now is free (the sim's `onBeat`). */
  inside: boolean;
}

/**
 * The beat strip's geometry from the sim's `beatAt` (the phase through the bar) and `onBeat`
 * (`beat.on`). `stepped` (reduced motion): the light jumps from mark to mark instead of sliding.
 * It sits on the downbeat's mark exactly while `beat.on` (the window is open), so the light, the
 * band's glow and "Free" agree; it steps there as the window opens, and on to the next beat's
 * mark as it shuts. Otherwise it sits on the beat just struck.
 */
export function beatStrip(
  beat: NonNullable<ConductingHud['beat']>,
  stepped = false,
): BeatStripView {
  const { phase } = beatAt(beat.time, beat.bar);
  const half = beat.within / beat.bar;
  const light = stepped
    ? LEAD +
      (beat.on ? 0 : Math.max(1, Math.min(BEATS - 1, Math.floor(phase * BEATS + EPS)))) / BEATS
    : (phase + LEAD) % 1;
  return {
    marks: Array.from({ length: BEATS }, (_, k) => ({ x: LEAD + k / BEATS, down: k === 0 })),
    band: { from: LEAD - half, to: LEAD + half },
    light,
    inside: beat.on,
  };
}

/**
 * A Tempo's beat as the sim stands now (`useBeatNow`): its time, whether a Cue now falls on the
 * downbeat (`onBeat`) and what it costs (`cueCostNow`). The runtime writes it every frame on A
 * Tempo runs, so the strip and the badge never wait for the HUD snapshot.
 */
export function beatNow(state: WorldState): BeatNow {
  return { time: state.time, on: onBeat(state), cost: cueCostNow(state) };
}

/** The strip's beat with the frame's live time, window and cost over the snapshot's. */
export function liveBeat(
  beat: NonNullable<ConductingHud['beat']>,
  now: BeatNow | null,
): NonNullable<ConductingHud['beat']> {
  return now ? { ...beat, time: now.time, on: now.on, cost: now.cost } : beat;
}

/** A hero's Cue badge with the frame's live window and cost over the snapshot's. */
export function liveCueBadge(
  badge: CueBadgeHud,
  now: Pick<BeatNow, 'on' | 'cost'> | null,
): CueBadgeHud {
  if (!now) return badge;
  const next = { link: badge.link, power: badge.power, onBeat: now.on, cost: now.cost };
  return { ...badge, free: now.on && now.cost <= 0, cost: now.cost, label: cueBadgeLabel(next) };
}

// ── The fight's state for the HUD ──────────────────────────────────────────────────────

const NAME_FALLBACK = '?';

/**
 * `HudSnapshot.conducting` from the sim (null without the Conductor). `nameOf`: a hero's name.
 */
export function conductingHud(
  state: WorldState,
  nameOf: (id: EntityId) => string | null,
): ConductingHud | null {
  const view = state.calling?.conducting;
  const field = state.field.conducting;
  if (!view || !field) return null;
  return {
    cueCost: view.cueCost,
    chainWindow: view.chainWindow,
    duet: view.duet,
    trio: view.trio,
    chain: chainOf(state, nameOf),
    beat: view.beat
      ? {
          time: state.time,
          bar: view.beat.bar,
          within: view.beat.within,
          on: onBeat(state),
          cost: cueCostNow(state),
          // What a Cue on the downbeat costs: Silent Cues' surcharge alone (`cueCostNow`).
          downbeatCost: state.mods.cueCostBonus,
        }
      : null,
    finale: finaleHudOf(state, nameOf),
    marcato: view.marcato ? marcatoHud(marcatoReadyIn(state) ?? 0, view.marcato) : null,
    ensemble: view.ensemble
      ? {
          heroes: field.streak?.length ?? 0,
          most: ensembleMost(view.ensemble),
          bonus: ensembleBonus(state),
        }
      : null,
    triad: view.triad > 0 ? { holding: field.triad === true, count: view.triad } : null,
  };
}

/** The chip's Marcato from the sim's `marcatoReadyIn` (0: ready) and its bonus and seconds. */
export function marcatoHud(
  readyIn: number,
  m: { pct: number; seconds: number },
): NonNullable<ConductingHud['marcato']> {
  return { ready: readyIn <= 0, readyIn, pct: m.pct, seconds: m.seconds };
}

/**
 * Ensemble's pips: how many heroes in a row raise the bonus before it reaches its cap (the last
 * may raise it by less than a step when the cap is not a whole number of steps).
 */
export function ensembleMost(e: { pct: number; max: number }): number {
  return e.pct > 0 ? Math.max(0, Math.ceil(e.max / e.pct - 1e-6)) : 0;
}

/**
 * The chain a Cue could still join, read through `nextCue`: the first party hero outside it
 * whose Cue would chain names the link and power. Null: no chain, its window passed, or full.
 */
function chainOf(
  state: WorldState,
  nameOf: (id: EntityId) => string | null,
): ConductingHud['chain'] {
  const chain = openChain(state);
  const view = state.calling?.conducting;
  if (!chain || !view) return null;
  for (const id of state.party) {
    if (chain.heroes.includes(id)) continue;
    const next = nextCue(state, id);
    if (!next || next.link === 1) continue;
    const total = view.chainWindow;
    return {
      heroes: chain.heroes.map((h) => nameOf(h) ?? NAME_FALLBACK),
      link: next.link,
      power: next.power,
      left: Math.max(0, Math.min(total, chain.at + total - state.time)),
      total,
    };
  }
  return null;
}

/**
 * The Finale's pips: one a turn, from what the sim keeps (turns played, turns lost, the queue
 * left), in that order.
 */
export function finalePips(f: { fired: number; lost: number; left: number }): FinaleHud['pips'] {
  return [
    ...Array<'played'>(f.fired).fill('played'),
    ...Array<'lost'>(f.lost).fill('lost'),
    ...Array<'due'>(f.left).fill('due'),
  ];
}

function finaleHudOf(state: WorldState, nameOf: (id: EntityId) => string | null): FinaleHud | null {
  const finale = state.field.conducting?.finale;
  const view = finaleView(state);
  if (!finale || !view) return null;
  return {
    pips: finalePips({ fired: finale.fired, lost: finale.lost, left: finale.queue.length }),
    next:
      view.next === null
        ? null
        : {
            name: nameOf(view.next) ?? NAME_FALLBACK,
            slot: state.party.indexOf(view.next),
            power: view.power,
          },
  };
}

/**
 * The Grand Finale's turns as the runtime heard them (its events): who has played a turn, and
 * who has lost one, since the Finale began. A played turn stays played, whatever befalls the hero
 * after; a turn is lost only when the sim says so (`finaleTurnLost`).
 */
export interface FinaleHeard {
  played: EntityId[];
  lost: EntityId[];
}

/**
 * Folds a batch of events into what the Finale has heard: a Grand Finale's start clears it,
 * `finaleTurn` adds a played hero, `finaleTurnLost` a lost one. The same object back when the
 * batch held none of them.
 */
export function heardFinale(
  events: readonly SimEvent[],
  prev: FinaleHeard | null,
): FinaleHeard | null {
  let out = prev;
  for (const e of events) {
    if (e.type === 'crescendoStart') out = { played: [], lost: [] };
    else if (e.type === 'finaleTurn')
      out = { played: [...(out?.played ?? []), e.hero], lost: out?.lost ?? [] };
    else if (e.type === 'finaleTurnLost')
      out = { played: out?.played ?? [], lost: [...(out?.lost ?? []), e.hero] };
  }
  return out;
}

/**
 * A hero's turn while the Finale plays (null when it doesn't). Who plays next is the sim's
 * (`finaleView.next`), and what stops a hero is the sim's `finaleTurnBlock`: down, possessed or
 * stilled with a turn still queued is `losing` (the sim drops it when it comes due); mid-Solo,
 * held or being Reeled ahead of the next is `waits` (the turn is kept). With no turn left:
 * playing it, played, or lost (`heard`, from the sim's `finaleTurn` and `finaleTurnLost`).
 */
export function finaleTurnOf(
  state: WorldState,
  heroId: EntityId,
  heard: FinaleHeard | null = null,
): FinaleTurnHud | null {
  const field = state.field.conducting;
  const view = finaleView(state);
  if (!field?.finale || !view) return null;
  const at = view.queue.indexOf(heroId);
  const playing = field.solos.some((s) => s.hero === heroId && s.finale);
  if (at < 0) {
    const played = heard?.played.filter((h) => h === heroId).length ?? 0;
    const lost = heard?.lost.filter((h) => h === heroId).length ?? 0;
    if (playing) return { place: null, state: 'plays' };
    return lost > 0
      ? { place: null, state: 'lost', played, lost }
      : { place: null, state: 'done', played, lost };
  }
  if (view.next === heroId) return { place: at + 1, state: 'next' };
  const block = finaleTurnBlock(state, heroId);
  if (block !== null && block !== 'wait') return { place: at + 1, state: 'losing', block };
  if (playing) return { place: at + 1, state: 'plays' };
  const nextAt = view.next === null ? view.queue.length : view.queue.indexOf(view.next);
  return { place: at + 1, state: at < nextAt ? 'waits' : 'due' };
}

/** A hero's Conductor marks for their frame (none on other runs). */
export function heroConducting(
  state: WorldState,
  heroId: EntityId,
  hero: Pick<HeroHud, 'soloReady' | 'downed' | 'dead' | 'possessed' | 'stilled'>,
  heard: FinaleHeard | null = null,
): Pick<HeroHud, 'cue' | 'spotlight' | 'marcato' | 'finale'> {
  const field = state.field.conducting;
  const view = state.calling?.conducting;
  if (!field || !view) return {};
  const up = !hero.dead && !hero.downed;
  const badge = hero.soloReady && up && !hero.possessed ? cueBadge(state, heroId) : null;
  const light = up ? spotlit(state, heroId) : 0;
  const held = field.marcato;
  const marcato =
    view.marcato && held && up && marcatoOn(state, heroId)
      ? {
          pct: view.marcato.pct,
          left: held.until - state.time,
          total: view.marcato.seconds,
        }
      : null;
  const turn = finaleTurnOf(state, heroId, heard);
  return {
    ...(badge ? { cue: badge } : {}),
    ...(light > 0 ? { spotlight: light } : {}),
    ...(marcato ? { marcato } : {}),
    ...(turn ? { finale: turn } : {}),
  };
}

// ── Words ─────────────────────────────────────────────────────────────────────────────

/** "+10%" (whole percent). */
export function pctLabel(share: number): string {
  return `+${Math.round(share * 100)}%`;
}

/** The chain ring's label: "Duet next", "Trio next". */
export function chainLabel(chain: NonNullable<ConductingHud['chain']>): string {
  return txt('hud.conducting.next', { linkName: linkName(chain.link) });
}

/** "Lyra next ×1.44"; "every hero left waits" when none can play yet. */
export function finaleNextLabel(finale: FinaleHud): string {
  return finale.next
    ? txt('hud.conducting.next2', {
        name: finale.next.name,
        powerLabel: powerLabel(finale.next.power),
      })
    : txt('hud.conducting.waiting');
}

/**
 * A Finale turn on a frame: its place ("1"), "waits", "can't play" (its turn will be lost),
 * "lost", "played · lost" (Maestro: one played, one lost), "plays", "played".
 */
export function finaleTurnLabel(t: FinaleTurnHud): string {
  switch (t.state) {
    case 'waits':
      return 'waits';
    case 'losing':
      return txt('hud.conducting.canTPlay');
    case 'lost':
      return (t.played ?? 0) > 0 ? txt('hud.conducting.playedLost') : 'lost';
    case 'plays':
      return 'plays';
    case 'done':
      return 'played';
    default:
      return t.place === null ? '' : `${t.place}`;
  }
}

/** The frame chip's sentence for a Finale turn (its aria label and title). */
export function finaleTurnSentence(name: string, t: FinaleTurnHud): string {
  switch (t.state) {
    case 'next':
      return txt('hud.conducting.playsTheNextTurn', { name });
    case 'waits':
      return txt('hud.conducting.waitsTheirTurnIs', { name });
    case 'losing':
      return txt('hud.conducting.canTPlayTheir', { name, value: LOST_REASON[t.block ?? 'down'] });
    case 'lost':
      return (t.played ?? 0) > 0
        ? txt('hud.conducting.playedATurnOf', {
            name,
            value: t.lost === 1 ? txt('hud.conducting.one') : t.lost,
          })
        : txt('hud.conducting.lostTheirTurn', { name });
    case 'plays':
      return txt('hud.conducting.sFinaleSoloIs', { name });
    case 'done':
      return txt('hud.conducting.hasNoTurnLeft', { name });
    default:
      return txt('hud.conducting.playsTurnOfThe', { name, place: t.place });
  }
}

/** The Calling chip's Marcato: "Marcato" when ready, "Marcato 5s" while it comes back. */
export function marcatoChipLabel(m: NonNullable<ConductingHud['marcato']>): string {
  return m.ready
    ? txt('hud.conducting.marcato')
    : txt('hud.conducting.marcatoS', { ceil: Math.ceil(m.readyIn - EPS) });
}

/** The chip's sentence for the Conductor's states (the chip's aria label adds it). */
export function conductingChipSentence(c: ConductingHud, crescendoName: string): string {
  return [
    c.finale ? `${crescendoName}: ${finaleNextLabel(c.finale)}.` : '',
    c.chain
      ? txt('hud.conducting.sToCueAnother', {
          chainLabel: chainLabel(c.chain),
          left: Math.ceil(c.chain.left),
        })
      : '',
    c.marcato
      ? c.marcato.ready
        ? txt('hud.conducting.marcatoReadyYourNext', {
            pctLabel: pctLabel(c.marcato.pct),
            Number: Number(c.marcato.seconds.toFixed(1)),
          })
        : txt('hud.conducting.marcatoBackInS', { readyIn: Math.ceil(c.marcato.readyIn) })
      : '',
    c.ensemble
      ? txt('hud.conducting.ensembleInARow', {
          pctLabel: pctLabel(c.ensemble.bonus),
          heroes: c.ensemble.heroes,
        })
      : '',
    c.triad?.holding ? txt('hud.conducting.triadHoldsYourResonance') : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// ── Call-outs ─────────────────────────────────────────────────────────────────────────

/** A call-out and how long it stays (ms), as the runtime pushes them. */
export interface ConductingCallout {
  callout: Omit<Callout, 'id' | 'expiresAt'>;
  ttl: number;
}

/** The Finale's turns build one toast: "Kael ×1 · Lyra ×1.2 · Vexis ×1.44". */
export const FINALE_TURNS_KEY = 'finale:turns';

/** The words for a lost turn's reason. */
const LOST_REASON: Record<'down' | 'possessed' | 'stilled' | 'time', string> = {
  down: 'down',
  possessed: 'possessed',
  stilled: 'stilled',
  get time() {
    return txt('hud.conducting.outOfTime');
  },
};

/**
 * The call-outs a Conductor event raises (none for any other event). `name`: a hero's name.
 * `turns`: the Finale's toast so far (the runtime finds it by `FINALE_TURNS_KEY`), to build on.
 */
export function conductingCallouts(
  event: SimEvent,
  ctx: {
    name: (id: EntityId) => string | null;
    time: number;
    turns?: string | null;
    crescendoName?: string;
    /** Marcato's bonus and seconds this fight (`calling.conducting.marcato`). */
    marcato?: { pct: number; seconds: number } | null;
  },
): ConductingCallout[] {
  const gold = CONDUCT_GOLD;
  switch (event.type) {
    case 'cueChained': {
      const out: ConductingCallout[] = [];
      const who = ctx.name(event.hero) ?? '';
      if (event.link === 3)
        out.push({
          callout: {
            kind: 'perfect',
            text: txt('hud.conducting.trio', { who, powerLabel: powerLabel(event.power) }),
            color: gold,
            icon: 'chain' as IconName,
          },
          ttl: 1800,
        });
      else if (event.link === 2)
        out.push({
          callout: {
            kind: 'system',
            text: txt('hud.conducting.duet', { who, powerLabel: powerLabel(event.power) }),
            color: gold,
            key: 'conduct:duet',
          },
          ttl: 1600,
        });
      // Free only when it cost nothing (under Silent Cues a Cue on the beat pays the surcharge).
      if (event.onBeat && event.cost <= 0)
        out.push({
          callout: { kind: 'system', text: txt('hud.conducting.freeCueOnThe'), color: gold },
          ttl: 1300,
        });
      return out;
    }
    case 'reprised':
      return [
        {
          callout: {
            kind: 'system',
            text: txt('hud.conducting.repriseEverySolo', { charge: event.charge }),
            color: gold,
          },
          ttl: 1600,
        },
      ];
    case 'marcato':
      return ctx.marcato ? [marcatoCallout(ctx.marcato.pct, ctx.marcato.seconds)] : [];
    case 'finaleTurn': {
      const who = ctx.name(event.hero) ?? '';
      const turn = `${who} ${powerLabel(event.power)}`;
      return [
        {
          callout: {
            kind: 'system',
            text: ctx.turns ? `${ctx.turns} · ${turn}` : turn,
            color: gold,
            key: FINALE_TURNS_KEY,
          },
          ttl: 2600,
        },
      ];
    }
    case 'finaleTurnLost': {
      const who = ctx.name(event.hero) ?? txt('hud.conducting.aHero');
      return [
        {
          callout: {
            kind: 'system',
            text: txt('hud.conducting.canTPlay2', { who, value: LOST_REASON[event.reason] }),
            color: '#cbd5e1',
            // One toast a hero: Maestro's second turn lost on the same tick replaces the first.
            key: `finale:lost:${event.hero}`,
          },
          ttl: 1800,
        },
      ];
    }
    case 'finaleEnded':
      return [
        {
          callout: {
            kind: 'perfect',
            text: txt('hud.conducting.everySoloIsFull'),
            detail: txt('hud.conducting.played', {
              value: ctx.crescendoName ?? txt('hud.conducting.theFinale'),
              fired: event.fired,
              value2: event.fired === 1 ? txt('hud.conducting.solo') : txt('hud.conducting.solos'),
              value3: event.lost > 0 ? txt('hud.conducting.lost', { lost: event.lost }) : '',
            }),
            color: gold,
            icon: 'finale' as IconName,
          },
          ttl: 2000,
        },
      ];
    default:
      return [];
  }
}

/** Marcato's call-out: "Marcato · +10% for 4 s" (its bonus from `calling.conducting`). */
export function marcatoCallout(pct: number, seconds: number): ConductingCallout {
  return {
    callout: {
      kind: 'system',
      text: txt('hud.conducting.marcatoForS', {
        pctLabel: pctLabel(pct),
        Number: Number(seconds.toFixed(1)),
      }),
      color: CONDUCT_GOLD,
    },
    ttl: 1500,
  };
}
