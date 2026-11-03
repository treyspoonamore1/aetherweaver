/**
 * The Perfect-Ward trainer (docs/phase-4g.md): a drill in the Training Grounds. A training bell
 * telegraphs a blow at a hero (the sim's `drill` debug op) on a steady beat, and you Ward it. As
 * each blow starts the sim heals its hero and readies the Ward and Spirit, so the blows don't
 * hurt and the beat never waits on the Ward's recharge. Each try says how it went: Perfect,
 * early or late by how many milliseconds (the Ward's cast against the Perfect window), warded but
 * not Perfect, or missed (a Reel that takes the hero clear is a miss). The drill counts the
 * streak and keeps the best per mode.
 *
 * Pure: `WardDrill` reads the sim's events and state after each batch of ticks (the runtime's
 * `listen`) and returns the commands to queue. It picks mixed mode's hero and speed with
 * `random`; the command carries them, so the sim stays deterministic.
 */
import { SIM_DT, type Command, type PartySlot, type SimEvent, type WorldState } from '../../sim';

export type DrillSpeed = 'slow' | 'normal' | 'quick';
export type DrillMode = DrillSpeed | 'mixed';

/** The three speeds: how long the bell's blow winds up. */
export const DRILL_SPEEDS: Readonly<Record<DrillSpeed, { label: string; windup: number }>> = {
  slow: { label: 'Slow', windup: 2 },
  normal: { label: 'Normal', windup: 1.4 },
  quick: { label: 'Quick', windup: 0.9 },
};
export const DRILL_MODES: readonly DrillMode[] = ['slow', 'normal', 'quick', 'mixed'];
const SPEEDS: readonly DrillSpeed[] = ['slow', 'normal', 'quick'];

export function modeLabel(mode: DrillMode): string {
  return mode === 'mixed' ? 'Mixed' : DRILL_SPEEDS[mode].label;
}

/** Seconds from Start to the first blow: time to Thread its hero. */
export const DRILL_LEAD = 1.5;
/**
 * The beat: seconds from a blow landing to the next one's start, whatever the try was. Time to
 * read the try, and (mixed) to Thread the next hero, announced as soon as the try is judged.
 */
export const DRILL_GAP = 2.4;
/** A Ward this long after the blow landed (s) is late; any later, the try was missed. */
export const LATE_GRACE = 0.6;
/** How long a sent blow may take to telegraph before it's sent again (s): its hero was down. */
const QUEUE_TIMEOUT = 0.5;
/** Ward casts older than this before a blow can't touch it (a Ward lasts 3 s). */
const CAST_MEMORY = 4;
/** How many tries the history shows. */
export const DRILL_HISTORY = 10;
const EPS = 1e-6;

const HEAL: Command = { t: 'debug', op: { op: 'healParty' } };

// ── One try ──────────────────────────────────────────────────────────────────────────

export type TryKind = 'perfect' | 'early' | 'late' | 'warded' | 'missed';

/** Why a miss (or an early Ward) went the way it did. */
export type TryNote =
  | { kind: 'elsewhere'; slot: number }
  | { kind: 'refused'; reason: string }
  | { kind: 'faded' }
  | { kind: 'slipped' };

export interface DrillTry {
  kind: TryKind;
  /** Early or late by this much (ms); a Perfect's: how long before the blow landed. */
  ms: number | null;
  /** The hero the blow was aimed at (party slot), and its speed. */
  slot: number;
  speed: DrillSpeed;
  /** The Perfect window (ms): the last part of the windup. */
  windowMs: number;
  /** The Ward's cast in seconds from the impact (negative: before it). Null: no Ward on them. */
  castAt: number | null;
  note: TryNote | null;
}

export type BlowOutcome = 'hit' | 'dodged' | 'warded' | 'perfect' | 'absorbed' | 'cancelled';

/** What happened around one blow, in sim seconds. */
export interface BlowFacts {
  outcome: BlowOutcome;
  slot: number;
  speed: DrillSpeed;
  start: number;
  perfectFrom: number;
  impact: number;
  /** Ward casts around the blow: when, and on which hero (slot). */
  casts: readonly { time: number; slot: number }[];
  /** Why the Ward was refused while the blow wound up (the sim's reasons), in order. */
  refused: readonly string[];
}

/**
 * How a try went. The sim says whether it was Perfect (or Warded, or a hit); the Ward's cast time
 * says by how much it was early or late. Null: the blow never came (cancelled), so it isn't a try.
 */
export function judgeBlow(f: BlowFacts): DrillTry | null {
  if (f.outcome === 'cancelled') return null;
  const windowMs = Math.round((f.impact - f.perfectFrom) * 1000);
  const mine = f.casts.filter((c) => c.slot === f.slot);
  const before = mine.filter((c) => c.time <= f.impact + EPS).at(-1) ?? null;
  const after =
    mine.find((c) => c.time > f.impact + EPS && c.time <= f.impact + LATE_GRACE + EPS) ?? null;
  const base = { slot: f.slot, speed: f.speed, windowMs };
  const ms = (s: number) => Math.max(1, Math.round(s * 1000));
  const at = (c: { time: number } | null) => (c ? c.time - f.impact : null);
  if (f.outcome === 'perfect')
    return {
      ...base,
      kind: 'perfect',
      ms: before ? Math.round((f.impact - before.time) * 1000) : null,
      castAt: at(before),
      note: null,
    };
  if (f.outcome === 'warded' || f.outcome === 'absorbed') {
    if (before && before.time < f.perfectFrom - EPS)
      return {
        ...base,
        kind: 'early',
        ms: ms(f.perfectFrom - before.time),
        castAt: at(before),
        note: null,
      };
    return { ...base, kind: 'warded', ms: null, castAt: at(before), note: null };
  }
  // A Reel took them clear: the drill wants a Ward, so it's a miss whatever else was cast.
  if (f.outcome === 'dodged')
    return { ...base, kind: 'missed', ms: null, castAt: null, note: { kind: 'slipped' } };
  // It landed: a Ward after it is late, one long before it had faded.
  if (after)
    return { ...base, kind: 'late', ms: ms(after.time - f.impact), castAt: at(after), note: null };
  if (before && before.time < f.perfectFrom - EPS)
    return {
      ...base,
      kind: 'early',
      ms: ms(f.perfectFrom - before.time),
      castAt: at(before),
      note: { kind: 'faded' },
    };
  const elsewhere = f.casts.find(
    (c) => c.slot !== f.slot && c.time >= f.start - EPS && c.time <= f.impact + LATE_GRACE,
  );
  const note: TryNote | null = elsewhere
    ? { kind: 'elsewhere', slot: elsewhere.slot }
    : f.refused.length > 0
      ? { kind: 'refused', reason: f.refused.at(-1)! }
      : null;
  return { ...base, kind: 'missed', ms: null, castAt: null, note };
}

/** The try's headline: "Perfect", "Early · 180 ms", "Late · 90 ms"… */
export function tryTitle(t: Pick<DrillTry, 'kind' | 'ms'>): string {
  switch (t.kind) {
    case 'perfect':
      return 'Perfect';
    case 'early':
      return `Early · ${t.ms ?? 0} ms`;
    case 'late':
      return `Late · ${t.ms ?? 0} ms`;
    case 'warded':
      return 'Warded, not Perfect';
    case 'missed':
      return 'Missed';
  }
}

/** The sim's reasons for refusing a Ward, as the HUD's callouts say them. */
const REFUSED: Record<string, string> = {
  cooldown: 'it wasn’t back yet',
  spirit: 'not enough Spirit',
  range: 'out of range',
  target: 'no hero to Ward',
  silenced: 'you were silenced',
  down: 'you were down',
  life: 'not enough Life',
};

/** One sentence on the try: where the Ward fell against the window, or why there was none. */
export function tryDetail(t: DrillTry, heroName: (slot: number) => string): string {
  const window = `the ${t.windowMs} ms window`;
  const last = `the window is the last ${t.windowMs} ms before it lands`;
  switch (t.kind) {
    case 'perfect':
      return t.ms === null ? `Inside ${window}.` : `${t.ms} ms before it landed, inside ${window}.`;
    case 'early':
      return t.note?.kind === 'faded'
        ? `Your Ward had faded before it landed: ${last}.`
        : `Your Ward held it, but too soon for a Perfect: ${last}.`;
    case 'late':
      return `It landed before your Ward: ${last}.`;
    case 'warded':
      return 'A barrier took it, but not a Ward cast in the window.';
    case 'missed':
      switch (t.note?.kind) {
        case 'elsewhere':
          return `Your Ward went to ${heroName(t.note.slot)}, not ${heroName(t.slot)}.`;
        case 'refused':
          return `Your Ward was refused: ${REFUSED[t.note.reason] ?? t.note.reason}.`;
        case 'slipped':
          return 'It never landed (a Reel took them clear), but the drill wants a Ward.';
        default:
          return `No Ward reached ${heroName(t.slot)}.`;
      }
  }
}

/** The last try's timing bar: from a second before the impact to just after it (seconds). */
export const BAR_FROM = -1;
export const BAR_TO = 0.6;

/** Where `seconds` (from the impact) falls on the timing bar, 0–100, clamped. */
export function barPercent(seconds: number): number {
  const p = ((seconds - BAR_FROM) / (BAR_TO - BAR_FROM)) * 100;
  return Math.max(0, Math.min(100, p));
}

// ── Bests, per mode ───────────────────────────────────────────────────────────────────

export type DrillBests = Partial<Record<DrillMode, number>>;

/** Where the bests live: the browser's storage (a convenience: no save needed). */
export interface BestStore {
  load(): DrillBests;
  save(bests: DrillBests): void;
}

const BEST_KEY = 'aetherweaver.drill.best';

export const localBests: BestStore = {
  load() {
    try {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(BEST_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return {};
      const out: DrillBests = {};
      for (const mode of DRILL_MODES) {
        const n = (parsed as Record<string, unknown>)[mode];
        if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[mode] = Math.floor(n);
      }
      return out;
    } catch {
      return {};
    }
  },
  save(bests) {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(bests));
    } catch {
      // Private mode: the best lasts this visit.
    }
  },
};

/** Bests kept in memory (tests, the UI lab). */
export function memoryBests(initial: DrillBests = {}): BestStore {
  let bests = { ...initial };
  return {
    load: () => ({ ...bests }),
    save: (b) => void (bests = { ...b }),
  };
}

// ── The drill ─────────────────────────────────────────────────────────────────────────

/** What the drill is doing now. */
export type DrillStatus =
  | { kind: 'idle' }
  /** The next blow, its hero and speed, in so many seconds. */
  | { kind: 'next'; slot: number; speed: DrillSpeed; seconds: number }
  /** A blow winding up. */
  | { kind: 'blow'; slot: number; speed: DrillSpeed };

export interface DrillView {
  running: boolean;
  mode: DrillMode;
  /** The hero the blows come at (mixed mode picks its own). */
  target: PartySlot;
  status: DrillStatus;
  last: DrillTry | null;
  /** The last tries, oldest first (at most `DRILL_HISTORY`). */
  history: readonly TryKind[];
  /** Perfects in a row. */
  streak: number;
  /** This mode's best streak, kept between visits. */
  best: number;
  /** The streak running now set a new best (it goes when the streak breaks). */
  newBest: boolean;
  /** The Perfect window is widened (Settings → Assists): no best is kept. */
  assisted: boolean;
  tries: number;
  perfects: number;
}

interface Planned {
  slot: PartySlot;
  speed: DrillSpeed;
}

interface Blow extends Planned {
  id: number;
  startTick: number;
  start: number;
  perfectFrom: number;
  impact: number;
  outcome: BlowOutcome | null;
  ended: boolean;
}

export interface WardDrillOptions {
  /** Mixed mode's hero and speed (default Math.random: the UI picks; the command carries it). */
  random?: () => number;
  bests?: BestStore;
  mode?: DrillMode;
  target?: PartySlot;
}

/**
 * The drill, fed by the runtime after each batch of ticks. `step` returns the commands to queue:
 * the next blow, with a heal first if its hero is down (the sim's drill heals only a standing
 * one), and a heal after a blow Stop left in flight (no next blow will).
 */
export class WardDrill {
  private running = false;
  private mode: DrillMode;
  private target: PartySlot;
  private readonly random: () => number;
  private readonly bests: BestStore;
  private best: DrillBests;
  /** The next blow and when it comes (sim s). */
  private planned: { plan: Planned; at: number } | null = null;
  /** A blow sent, waiting for its telegraph. */
  private queued: { plan: Planned; at: number } | null = null;
  private blow: Blow | null = null;
  /** A blow left in flight by Stop: the party is healed after it, as no next blow will. */
  private orphan: number | null = null;
  private casts: { tick: number; time: number; slot: number }[] = [];
  private refusals: { tick: number; reason: string }[] = [];
  /** When the next blow starts (sim s): the beat after the last one landed; null, a lead. */
  private nextAt: number | null = null;
  private lastTime = 0;
  private healNext = false;
  private status: DrillStatus = { kind: 'idle' };
  private last: DrillTry | null = null;
  private history: TryKind[] = [];
  private streak = 0;
  private newBest = false;
  /** The Perfect window is widened (an assist): bests aren't kept. */
  private assisted = false;
  private tries = 0;
  private perfects = 0;
  private snapshot: DrillView;
  private readonly listeners = new Set<() => void>();

  constructor(opts: WardDrillOptions = {}) {
    this.random = opts.random ?? Math.random;
    this.bests = opts.bests ?? localBests;
    this.best = this.bests.load();
    this.mode = opts.mode ?? 'slow';
    this.target = opts.target ?? 0;
    this.snapshot = this.build();
  }

  /** The Perfect window's assist is on: streaks still count, but no best is kept. */
  setAssisted(on: boolean): void {
    if (on === this.assisted) return;
    this.assisted = on;
    this.newBest = false;
    this.snapshot = this.build();
    for (const l of this.listeners) l();
  }

  /** The view to draw (a new object whenever something shown changes). */
  view(): DrillView {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Starts a drill (the streak from nothing). */
  start(): void {
    this.drop();
    this.running = true;
    this.streak = 0;
    this.newBest = false;
    this.tries = 0;
    this.perfects = 0;
    this.history = [];
    this.last = null;
    this.nextAt = null;
    this.publish();
  }

  stop(): void {
    this.drop();
    this.running = false;
    this.status = { kind: 'idle' };
    this.publish();
  }

  /** A new speed (or mixed): a running drill starts over in it. */
  setMode(mode: DrillMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.running) this.start();
    else this.publish();
  }

  /** The hero the blows come at; a running drill keeps its streak. */
  setTarget(slot: PartySlot): void {
    if (slot === this.target) return;
    this.target = slot;
    // A blow lined up for the old hero waits for the new one.
    if (this.planned && this.mode !== 'mixed')
      this.planned = { ...this.planned, plan: { ...this.planned.plan, slot } };
    this.publish();
  }

  /** One batch of ticks: what happened, and the state after it. Returns the commands to queue. */
  step(events: readonly SimEvent[], state: WorldState): Command[] {
    const now = state.time;
    // A new fight (the Training Grounds restart theirs when a loadout changes): start over. The
    // old fight's blow went with it, and so does its heal.
    if (now + EPS < this.lastTime) {
      this.drop();
      this.orphan = null;
      this.nextAt = null;
    }
    this.lastTime = now;
    for (const e of events) this.hear(e, state);
    const out: Command[] = [];
    if (this.healNext) {
      out.push(HEAL);
      this.healNext = false;
    }
    if (!this.running) {
      this.publish();
      return out;
    }
    const blow = this.blow;
    if (blow?.ended) {
      // A hit waits a moment for a late Ward; anything else (a Reel's dodge too) is judged as it
      // ends.
      const late = blow.outcome === 'hit';
      if (!late || now >= blow.impact + LATE_GRACE - EPS) {
        this.judge(blow);
        this.blow = null;
      }
    }
    if (this.queued && now - this.queued.at > QUEUE_TIMEOUT) {
      // It never telegraphed (its hero was down): heal, and line it up again after a lead.
      this.queued = null;
      this.nextAt = now + DRILL_LEAD;
      out.push(HEAL);
    }
    if (!this.blow && !this.queued) {
      // The next blow, on the beat (the first a lead after Start), its hero and speed announced
      // as soon as the last try is judged.
      this.planned ??= {
        plan: this.plan(state),
        at: this.nextAt === null ? now + DRILL_LEAD : Math.max(now, this.nextAt),
      };
      const { plan, at } = this.planned;
      if (now >= at - EPS) {
        if (!standing(state, plan.slot)) out.push(HEAL);
        out.push({
          t: 'debug',
          op: { op: 'drill', slot: plan.slot, windup: DRILL_SPEEDS[plan.speed].windup },
        });
        this.queued = { plan, at: now };
        this.planned = null;
        this.status = { kind: 'blow', slot: plan.slot, speed: plan.speed };
      } else {
        this.status = { kind: 'next', ...plan, seconds: at - now };
      }
    }
    if (this.blow) this.status = { kind: 'blow', slot: this.blow.slot, speed: this.blow.speed };
    this.publish();
    return out;
  }

  private hear(e: SimEvent, state: WorldState): void {
    switch (e.type) {
      case 'telegraphStarted': {
        if (!this.queued || !isDrill(e.telegraph, e.name, state)) return;
        const slot = e.target === null ? -1 : state.party.indexOf(e.target);
        this.blow = {
          ...this.queued.plan,
          slot: (slot >= 0 ? slot : this.queued.plan.slot) as PartySlot,
          id: e.telegraph,
          startTick: e.tick,
          start: e.start,
          perfectFrom: e.perfectFrom,
          impact: e.impact,
          outcome: null,
          ended: false,
        };
        this.queued = null;
        return;
      }
      case 'telegraphResolved':
        if (this.blow && e.telegraph === this.blow.id && this.blow.outcome === null)
          this.blow.outcome = e.outcome;
        return;
      case 'telegraphEnded':
        if (this.blow && e.telegraph === this.blow.id) {
          this.blow.ended = true;
          // The beat: the next blow a fixed while after this one landed, whatever the try. It
          // heals its hero as it starts, so this one doesn't hurt for long.
          this.nextAt = this.blow.impact + DRILL_GAP;
        } else if (e.telegraph === this.orphan) {
          this.orphan = null;
          this.healNext = true;
        }
        return;
      case 'techniqueCast':
        if (e.technique !== 'ward' || e.target === null) return;
        this.casts.push({
          tick: e.tick,
          time: tickTime(e.tick, state),
          slot: state.party.indexOf(e.target),
        });
        this.forget(state.time);
        return;
      case 'techniqueRejected':
        if (e.technique === 'ward') this.refusals.push({ tick: e.tick, reason: e.reason });
        return;
      default:
        return;
    }
  }

  /** Drops what's older than any blow could use. */
  private forget(now: number): void {
    if (this.casts.length > 8) this.casts = this.casts.filter((c) => c.time > now - CAST_MEMORY);
    if (this.refusals.length > 8) this.refusals = this.refusals.slice(-8);
  }

  private judge(blow: Blow): void {
    // Times from ticks against the blow's own start: exact, whatever the batch.
    const timeAt = (tick: number) => blow.start + (tick - blow.startTick) * SIM_DT;
    const t = judgeBlow({
      outcome: blow.outcome ?? 'hit',
      slot: blow.slot,
      speed: blow.speed,
      start: blow.start,
      perfectFrom: blow.perfectFrom,
      impact: blow.impact,
      casts: this.casts
        .map((c) => ({ time: timeAt(c.tick), slot: c.slot }))
        .filter((c) => c.time > blow.start - CAST_MEMORY),
      refused: this.refusals
        .filter((r) => r.tick >= blow.startTick && timeAt(r.tick) <= blow.impact + LATE_GRACE)
        .map((r) => r.reason),
    });
    this.casts = [];
    this.refusals = [];
    if (!t) return;
    this.last = t;
    this.tries++;
    this.history = [...this.history, t.kind].slice(-DRILL_HISTORY);
    if (t.kind === 'perfect') {
      this.perfects++;
      this.streak++;
      if (!this.assisted && this.streak > (this.best[this.mode] ?? 0)) {
        this.best = { ...this.best, [this.mode]: this.streak };
        this.newBest = true;
        this.bests.save(this.best);
      }
    } else {
      // A streak that breaks takes "New best" with it; the next has to beat the record again.
      this.streak = 0;
      this.newBest = false;
    }
  }

  /** The next blow: the chosen hero at the mode's speed, or (mixed) any standing hero, any speed. */
  private plan(state: WorldState): Planned {
    if (this.mode !== 'mixed') return { slot: this.target, speed: this.mode };
    const slots = state.party.map((_, i) => i as PartySlot);
    const up = slots.filter((s) => standing(state, s));
    const pool = up.length > 0 ? up : slots;
    const pick = <T>(list: readonly T[]) =>
      list[Math.min(list.length - 1, Math.floor(this.random() * list.length))]!;
    return { slot: pool.length > 0 ? pick(pool) : 0, speed: pick(SPEEDS) };
  }

  /** Forgets the blow in flight and what's lined up (a blow already telegraphed is still healed). */
  private drop(): void {
    if (this.blow && !this.blow.ended) this.orphan = this.blow.id;
    this.blow = null;
    this.queued = null;
    this.planned = null;
    this.casts = [];
    this.refusals = [];
  }

  private build(): DrillView {
    return {
      running: this.running,
      mode: this.mode,
      target: this.target,
      status: this.running ? this.status : { kind: 'idle' },
      last: this.last,
      history: this.history,
      streak: this.streak,
      best: this.best[this.mode] ?? 0,
      newBest: this.newBest,
      assisted: this.assisted,
      tries: this.tries,
      perfects: this.perfects,
    };
  }

  /** A new view when something shown changes (countdowns to a tenth of a second). */
  private publish(): void {
    const next = this.build();
    if (viewKey(next) === viewKey(this.snapshot)) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}

function viewKey(v: DrillView): string {
  const s = v.status;
  const seconds = 'seconds' in s ? Math.ceil(s.seconds * 10) : 0;
  return JSON.stringify([
    v.running,
    v.mode,
    v.target,
    s.kind,
    'slot' in s ? s.slot : null,
    'speed' in s ? s.speed : null,
    seconds,
    v.last,
    v.history,
    v.streak,
    v.best,
    v.newBest,
    v.tries,
  ]);
}

/** Is this telegraph a training bell's blow? */
function isDrill(id: number, name: string, state: WorldState): boolean {
  const t = state.telegraphs.find((x) => x.id === id);
  return t ? t.drill === true : name === 'Training Toll';
}

/** The sim time a tick began at, from the state after the batch it was in. */
function tickTime(tick: number, state: WorldState): number {
  return state.time - (state.tick - tick) * SIM_DT;
}

/** Is the hero in this slot standing (not down, not fallen)? */
function standing(state: WorldState, slot: number): boolean {
  const id = state.party[slot];
  const h = id === undefined ? undefined : state.entities.get(id)?.health;
  return !!h && !h.dead && !h.downed;
}

/** "Kael (1)": a hero and the key that Threads them. */
export function statusLine(
  v: DrillView,
  heroName: (slot: number) => string,
  heroKey: (slot: number) => string,
  wardKey: string,
): string {
  const s = v.status;
  switch (s.kind) {
    case 'idle':
      return v.tries > 0
        ? `${v.perfects} Perfect of ${v.tries}. Start again when you’re ready.`
        : `Choose a speed and a hero, then Start. ${heroKey(v.target)} Threads ${heroName(v.target)}, ${wardKey} Wards them.`;
    case 'next':
      return `Next: ${heroName(s.slot)} (${heroKey(s.slot)}), ${DRILL_SPEEDS[s.speed].label.toLowerCase()}, in ${Math.max(0, s.seconds).toFixed(1)} s, your Ward readied for it.`;
    case 'blow':
      return `${heroName(s.slot)}! ${wardKey} as the mark closes.`;
  }
}
