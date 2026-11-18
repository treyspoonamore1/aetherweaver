/**
 * The Conductor in the fight (docs/phase-5f.md, docs/solos.md), without React so the tests read
 * it: the Duet or Trio badge on a hero whose Solo is coming, the chain ring, the A Tempo beat
 * strip, the Grand Finale's pips and each hero's turn, the Calling chip's states, and the
 * call-outs. Every rule is the sim's own: `nextCue` (what a Cued Solo would be now), `onBeat` and
 * `beatAt` (the downbeat), `soloQueue` (when the next Solo begins, and whose),
 * `openChain`, `finaleView` (who plays next and at what power), `finaleTurnBlock` (what stops a
 * hero's turn), `marcatoOn`, `marcatoReadyIn`, `ensembleBonus`; every number is
 * `calling.conducting` (from content, through the mods) or `field.conducting`. Nothing here
 * decides a rule.
 */
import { heroDef } from '../../content';
import {
  beatAt,
  ensembleBonus,
  finaleTurnBlock,
  finaleView,
  marcatoOn,
  marcatoReadyIn,
  nextCue,
  onBeat,
  openChain,
  resonanceScale,
  soloQueue,
  spotlit,
  threadOn,
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
/** The downbeat's white-gold: the beat strip's band when a Solo begins on it. */
export const BEAT_LIGHT = '#fff4d6';

// ── The Cue badge ──────────────────────────────────────────────────────────────────────

/** "Duet", "Trio": what a coming Solo would be if your Thread is on the hero as it fires. */
export function cueBadgeLabel(link: 2 | 3): string {
  return linkName(link);
}

/**
 * The badge of a hero whose Solo is coming, from the sim's `nextCue`: a Duet or a Trio (null for
 * a plain Cue, and without the Conductor). `dueIn` is how long until the Solo fires (the sim's
 * `soloTurnIn`; 0: now). `nextCue` answers for a Cue given now, so the badge shows only if the
 * chain will still be open when the Solo fires: a promise the Solo keeps.
 */
export function cueBadge(state: WorldState, heroId: EntityId, dueIn = 0): CueBadgeHud | null {
  const next = nextCue(state, heroId);
  if (!next || next.link === 1) return null;
  const chain = openChain(state);
  if (!chain || state.time + dueIn - chain.at > state.mods.chainWindow + EPS) return null;
  const hero = state.entities.get(heroId);
  return {
    link: next.link,
    power: next.power,
    label: cueBadgeLabel(next.link),
    // Only a Solo your Thread is on joins the chain (Hollow Crown's Cued form does not).
    on: !!hero && threadOn(state, hero),
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
  /** The light is inside the band: the heroes begin their Solos now (the sim's `onBeat`). */
  inside: boolean;
  /**
   * A Solo begins on the downbeat the light is running to (or is inside): the band is lit for it.
   * From the sim's `soloQueue` (`beat.next`).
   */
  armed: boolean;
}

/**
 * The beat strip's geometry from the sim's `beatAt` (the phase through the bar) and `onBeat`
 * (`beat.on`). `stepped` (reduced motion): the light jumps from mark to mark instead of sliding.
 * It sits on the downbeat's mark exactly while `beat.on` (the window is open), so the light and
 * the band's glow agree; it steps there as the window opens, and on to the next beat's mark as it
 * shuts. Otherwise it sits on the beat just struck.
 */
export function beatStrip(
  beat: NonNullable<ConductingHud['beat']>,
  stepped = false,
): BeatStripView {
  const at = beatAt(beat.time, beat.bar);
  const { phase } = at;
  const half = beat.within / beat.bar;
  const light = stepped
    ? LEAD +
      (beat.on ? 0 : Math.max(1, Math.min(BEATS - 1, Math.floor(phase * BEATS + EPS)))) / BEATS
    : (phase + LEAD) % 1;
  // The window the light is in, or the next one, shuts at this many seconds from now.
  const shuts = (beat.on ? at.nearest : at.next) + beat.within - beat.time;
  return {
    marks: Array.from({ length: BEATS }, (_, k) => ({ x: LEAD + k / BEATS, down: k === 0 })),
    band: { from: LEAD - half, to: LEAD + half },
    light,
    inside: beat.on,
    armed: beat.next !== null && beat.next.in <= shuts + EPS,
  };
}

/**
 * A Tempo's beat as the sim stands now (`useBeatNow`): its time and whether it is inside the
 * downbeat's window (`onBeat`). The runtime writes it every frame on A Tempo runs, so the strip
 * never waits for the HUD snapshot.
 */
export function beatNow(state: WorldState): BeatNow {
  return { time: state.time, on: onBeat(state) };
}

/**
 * The strip's beat with the frame's live time and window over the snapshot's. The next Solo's
 * seconds run down with it.
 */
export function liveBeat(
  beat: NonNullable<ConductingHud['beat']>,
  now: BeatNow | null,
): NonNullable<ConductingHud['beat']> {
  if (!now) return beat;
  const next = beat.next
    ? { ...beat.next, in: Math.max(0, beat.next.in - (now.time - beat.time)) }
    : null;
  return { ...beat, time: now.time, on: now.on, next };
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
          gift: beatGift(state),
          next: nextSolo(state, nameOf),
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

/**
 * A Tempo: the Resonance a Solo Cued on the downbeat adds to the meter (0 without it): the path's
 * number at the fight's scale (the sim's `resonanceScale`), to one decimal.
 */
export function beatGift(state: WorldState): number {
  const gift = (state.calling?.conducting?.cueResonance ?? 0) * resonanceScale(state);
  return Number(gift.toFixed(1));
}

/**
 * The next Solo to begin (A Tempo's strip): the first turn of the sim's `soloQueue` (which holds
 * no hero who cannot fire: stilled, stunned, possessed), with their colour and whether your
 * Thread is on them (`threadOn`: only then is it a Cue, and A Tempo's gift). Null: none is coming.
 */
function nextSolo(
  state: WorldState,
  nameOf: (id: EntityId) => string | null,
): NonNullable<ConductingHud['beat']>['next'] {
  const turn = soloQueue(state)[0];
  const e = turn ? state.entities.get(turn.hero) : undefined;
  if (!turn || !e?.hero) return null;
  return {
    name: nameOf(turn.hero) ?? NAME_FALLBACK,
    color: heroDef(e.hero.defId).color,
    in: turn.due,
    willCue: threadOn(state, e),
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
  hero: Pick<HeroHud, 'soloIn' | 'cueLate' | 'downed' | 'dead'>,
  heard: FinaleHeard | null = null,
): Pick<HeroHud, 'cue' | 'spotlight' | 'marcato' | 'finale'> {
  const field = state.field.conducting;
  const view = state.calling?.conducting;
  if (!field || !view) return {};
  const up = !hero.dead && !hero.downed;
  const coming = hero.soloIn !== null && hero.soloIn !== undefined;
  // No badge on a Solo that can no longer be Cued (Silent Cues): it will be no Duet.
  const badge = coming && up && !hero.cueLate ? cueBadge(state, heroId, hero.soloIn!) : null;
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
    /** A Tempo: the Resonance a Solo Cued on the downbeat adds to the meter (0 without it). */
    gift?: number;
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
      // A Tempo: a Solo Cued on the downbeat gives its Resonance (`ctx.gift`, as the meter gains it).
      if (event.onBeat && (ctx.gift ?? 0) > 0)
        out.push({
          callout: {
            kind: 'system',
            text: txt('hud.conducting.onTheBeat', { gift: ctx.gift }),
            color: gold,
          },
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
