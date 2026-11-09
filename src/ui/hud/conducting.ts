/**
 * The Conductor in the fight (docs/phase-5f.md), without React so the tests read it: the Cue
 * badge on a ready hero's frame, the chain ring, the A Tempo beat strip, the Grand Finale's pips
 * and each hero's turn, the Calling chip's states, and the call-outs. Every rule is the sim's own:
 * `nextCue` (what a Cue would be now), `onBeat` and `beatAt` (the downbeat), `finaleView` (who
 * plays next and at what power), `crescendoCostOf`; every number is `calling.conducting` (from
 * content, through the mods) or `field.conducting`. Nothing here decides a rule.
 */
import {
  beatAt,
  cueCostNow,
  finaleView,
  nextCue,
  onBeat,
  spotlit,
  type EntityId,
  type SimEvent,
  type WorldState,
} from '../../sim';
import { linkName, powerLabel } from '../screens/callingText';
import type { IconName } from '../kit/iconPaths';
import type {
  Callout,
  ConductingHud,
  CueBadgeHud,
  FinaleHud,
  FinaleTurnHud,
  HeroHud,
} from '../store';

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
  const beat = next.onBeat ? (next.cost <= 0 ? 'Free' : `On the beat · ${next.cost}`) : null;
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
 * (`beat.on`). `stepped` (reduced motion): the light sits on the beat just struck instead of
 * sliding; the band's glow still opens with the window.
 */
export function beatStrip(
  beat: NonNullable<ConductingHud['beat']>,
  stepped = false,
): BeatStripView {
  const { phase } = beatAt(beat.time, beat.bar);
  const half = beat.within / beat.bar;
  const light = stepped
    ? LEAD + Math.min(BEATS - 1, Math.floor(phase * BEATS + EPS)) / BEATS
    : (phase + LEAD) % 1;
  return {
    marks: Array.from({ length: BEATS }, (_, k) => ({ x: LEAD + k / BEATS, down: k === 0 })),
    band: { from: LEAD - half, to: LEAD + half },
    light,
    inside: beat.on,
  };
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
          cost: onBeat(state) ? cueCostNow(state) : view.cueCost,
        }
      : null,
    finale: finaleHudOf(state, nameOf),
    marcato: view.marcato
      ? {
          ...marcatoReady(field.marcato?.readyAt ?? null, state.time),
          pct: view.marcato.pct,
          seconds: view.marcato.seconds,
        }
      : null,
    ensemble: view.ensemble
      ? {
          heroes: field.streak?.length ?? 0,
          most: Math.round(view.ensemble.max / view.ensemble.pct),
          bonus: Math.min(view.ensemble.max, view.ensemble.pct * (field.streak?.length ?? 0)),
        }
      : null,
    triad: view.triad > 0 ? { holding: field.triad === true, count: view.triad } : null,
  };
}

/** Marcato is ready (never given, or past its `readyAt`), or back in so many seconds. */
export function marcatoReady(
  readyAt: number | null,
  time: number,
): { ready: boolean; readyIn: number } {
  const readyIn = readyAt === null ? 0 : Math.max(0, readyAt - time);
  return { ready: readyIn <= EPS, readyIn };
}

/**
 * The chain a Cue could still join, read through `nextCue`: the first party hero outside it
 * whose Cue would chain names the link and power. Null: no chain, its window passed, or full.
 */
function chainOf(
  state: WorldState,
  nameOf: (id: EntityId) => string | null,
): ConductingHud['chain'] {
  const chain = state.field.conducting?.chain;
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
 * (`finaleView.next`); a hero ahead of them in the queue is passed over and waits. With no turn
 * left: playing it, played (`heard`), or lost (`heard`, from the sim's `finaleTurnLost`).
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
    const played = heard?.played.includes(heroId) ?? false;
    const lost = heard?.lost.includes(heroId) ?? false;
    return { place: null, state: playing ? 'plays' : !played && lost ? 'lost' : 'done' };
  }
  const nextAt = view.next === null ? view.queue.length : view.queue.indexOf(view.next);
  return {
    place: at + 1,
    state: view.next === heroId ? 'next' : playing ? 'plays' : at < nextAt ? 'waits' : 'due',
  };
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
    view.marcato && held && up && held.heroes.includes(heroId) && state.time < held.until - EPS
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
  return `${linkName(chain.link)} next`;
}

/** "Lyra next ×1.44"; "every hero left waits" when none can play yet. */
export function finaleNextLabel(finale: FinaleHud): string {
  return finale.next ? `${finale.next.name} next ${powerLabel(finale.next.power)}` : 'Waiting';
}

/** A Finale turn on a frame: its place ("1"), "waits", "lost", "plays", "played". */
export function finaleTurnLabel(t: FinaleTurnHud): string {
  switch (t.state) {
    case 'waits':
      return 'waits';
    case 'lost':
      return 'lost';
    case 'plays':
      return 'plays';
    case 'done':
      return 'played';
    default:
      return t.place === null ? '' : `${t.place}`;
  }
}

/** The Calling chip's Marcato: "Marcato" when ready, "Marcato 5s" while it comes back. */
export function marcatoChipLabel(m: NonNullable<ConductingHud['marcato']>): string {
  return m.ready ? 'Marcato' : `Marcato ${Math.ceil(m.readyIn - EPS)}s`;
}

/** The chip's sentence for the Conductor's states (the chip's aria label adds it). */
export function conductingChipSentence(c: ConductingHud, crescendoName: string): string {
  return [
    c.finale ? `${crescendoName}: ${finaleNextLabel(c.finale)}.` : '',
    c.chain ? `${chainLabel(c.chain)}: ${Math.ceil(c.chain.left)} s to Cue another hero.` : '',
    c.marcato
      ? c.marcato.ready
        ? `Marcato ready: your next Directive gives ${pctLabel(c.marcato.pct)} for ${Number(c.marcato.seconds.toFixed(1))} s.`
        : `Marcato back in ${Math.ceil(c.marcato.readyIn)} s.`
      : '',
    c.ensemble ? `Ensemble ${pctLabel(c.ensemble.bonus)}, ${c.ensemble.heroes} in a row.` : '',
    c.triad?.holding ? 'Triad holds your Resonance.' : '',
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
  time: 'out of time',
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
            text: `TRIO · ${who} ${powerLabel(event.power)}`,
            color: gold,
            icon: 'chain' as IconName,
          },
          ttl: 1800,
        });
      else if (event.link === 2)
        out.push({
          callout: {
            kind: 'system',
            text: `DUET · ${who} ${powerLabel(event.power)}`,
            color: gold,
            key: 'conduct:duet',
          },
          ttl: 1600,
        });
      // Free only when it cost nothing (under Silent Cues a Cue on the beat pays the surcharge).
      if (event.onBeat && event.cost <= 0)
        out.push({
          callout: { kind: 'system', text: 'Free Cue · on the beat', color: gold },
          ttl: 1300,
        });
      return out;
    }
    case 'reprised':
      return [
        {
          callout: { kind: 'system', text: `Reprise · every Solo +${event.charge}%`, color: gold },
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
      const who = ctx.name(event.hero) ?? 'A hero';
      return [
        {
          callout: {
            kind: 'system',
            text: `${who} can’t play — ${LOST_REASON[event.reason]}`,
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
            text: 'Every Solo is full',
            detail: `${ctx.crescendoName ?? 'The Finale'} played ${event.fired} ${event.fired === 1 ? 'Solo' : 'Solos'}${event.lost > 0 ? ` · ${event.lost} lost` : ''}`,
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
      text: `Marcato · ${pctLabel(pct)} for ${Number(seconds.toFixed(1))} s`,
      color: CONDUCT_GOLD,
    },
    ttl: 1500,
  };
}
