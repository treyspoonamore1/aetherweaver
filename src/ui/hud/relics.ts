/**
 * The HUD's relic bar, derived from the sim's `WorldState.relics` (docs/phase-3b.md). Pure: the
 * bridge calls it at 15 Hz and the tests call it with hand-made states.
 */
import { relicDef, relicValues, type RelicRarity } from '../../content';
import { relicAwake } from '../../sim';
import { glyphKey } from '../kit/iconPaths';
import { movementPlace } from '../screens/routeText';

export interface RelicHud {
  id: string;
  name: string;
  icon: string;
  rarity: RelicRarity;
  cleansed: boolean;
  /** A Dissonate Empowered it (docs/phase-4c.md): its numbers are its empowered ones. */
  empowered: boolean;
  /**
   * 'cooldown': Metronome / Thimble (ready, or seconds left of `total`); 'once': Martyr's
   * Veil (available or spent this fight); 'passive': everything else.
   */
  kind: 'cooldown' | 'once' | 'passive';
  /** Cooldown relics: ready now. Once relics: still available. Passive: always true. */
  ready: boolean;
  /** Cooldown relics: seconds until ready (0 when ready). */
  remaining: number;
  total: number;
  /**
   * Changes exactly when the relic acts, so the bar can flash it without seeing events: the
   * Metronome's and Thimble's next-ready time, the Veil being spent, Perfect Wards for the
   * Tuning Fork and the Glass Halo, downs for the Lantern.
   */
  pulse: number;
  /** One line for the aria label: "Cracked Metronome: ready", "Silver Thimble: 2.1 s". */
  label: string;
  /**
   * A Movement-gated relic asleep in this fight (docs/phase-5c.md): "Wakes in the Abyssal Rift".
   * The sim keeps it in `relics.ids` but resolves none of its effect. Absent: awake.
   */
  asleep?: string;
}

/** What the bar needs from the sim: the relics and a couple of ledger counters. */
export interface RelicSource {
  relics: {
    ids: readonly string[];
    cleansed: readonly string[];
    /** Relics a Dissonate Empowered (the sim's `relics.empowered`): their own numbers grow. */
    empowered?: readonly string[];
    metronomeAt: number | null;
    thimbleAt: number | null;
    veil: boolean;
    /** How often each relic has acted this fight (the sim's `relics.triggers`). */
    triggers?: Readonly<Record<string, number>>;
  };
  time: number;
  /**
   * `triggers` (Phase 5g): the trigger system's fires this fight by source (the sim's
   * `ledger.triggers`), the pulse of a relic whose rule is a trigger.
   */
  ledger: { perfects: number; downs: number; triggers?: Readonly<Record<string, number>> };
  /**
   * Phase 5g: once-a-fight relics the sim tracks outside `relics` (Spare Strings, Water Clock),
   * by id: true while still available this fight. Absent: none.
   */
  once?: Readonly<Record<string, boolean>>;
  /** The fight's Movement (the sim's `fightMovement`); absent: every relic reads awake. */
  movement?: number;
}

const COOLDOWN: Record<string, 'metronomeAt' | 'thimbleAt'> = {
  cracked_metronome: 'metronomeAt',
  silver_thimble: 'thimbleAt',
};

/** The relic's cooldown in seconds, from content (`values.cooldown`; Empowered, its own). */
function cooldownOf(id: string, empowered = false): number {
  return relicValues(relicDef(id), empowered).cooldown ?? 0;
}

export function relicHuds(src: RelicSource): RelicHud[] {
  const out: RelicHud[] = [];
  for (const id of src.relics.ids) {
    let def;
    try {
      def = relicDef(id);
    } catch {
      continue;
    }
    // Run-only relics (Star Chart) do nothing in a fight.
    if (def.runOnly) continue;
    const empowered = !!def.empowered && (src.relics.empowered ?? []).includes(id);
    const base = {
      id,
      name: def.name,
      icon: glyphKey(def),
      rarity: def.rarity,
      cleansed: src.relics.cleansed.includes(id),
      empowered,
    };
    // A Rift relic carried into an earlier Movement's fight sleeps: no effect, so no live tile.
    if (src.movement !== undefined && !relicAwake(def, src.movement)) {
      const wakes = `Wakes in ${movementPlace(def.movement ?? 1)}`;
      out.push({
        ...base,
        kind: 'passive',
        ready: false,
        remaining: 0,
        total: 0,
        pulse: 0,
        label: `${def.name}: asleep in this fight. ${wakes}`,
        asleep: wakes,
      });
      continue;
    }
    const field = COOLDOWN[id];
    if (field) {
      const at = src.relics[field];
      const total = cooldownOf(id, empowered);
      const remaining = at === null ? 0 : Math.max(0, at - src.time);
      const ready = remaining <= 0;
      out.push({
        ...base,
        kind: 'cooldown',
        ready,
        remaining,
        total,
        pulse: at ?? 0,
        label: `${def.name}: ${ready ? 'ready' : `${remaining.toFixed(1)} s`}`,
      });
      continue;
    }
    // Phase 5g: Spare Strings and the Water Clock act once a fight, as the Veil does.
    const once = src.once?.[id];
    if (once !== undefined) {
      out.push({
        ...base,
        kind: 'once',
        ready: once,
        remaining: 0,
        total: 0,
        pulse: once ? 0 : 1,
        label: `${def.name}: ${once ? 'ready, once this fight' : 'spent this fight'}`,
      });
      continue;
    }
    if (id === 'martyrs_veil') {
      out.push({
        ...base,
        kind: 'once',
        ready: src.relics.veil,
        remaining: 0,
        total: 0,
        pulse: src.relics.veil ? 0 : 1,
        label: `${def.name}: ${src.relics.veil ? 'ready, once this fight' : 'spent this fight'}`,
      });
      continue;
    }
    // The sim counts each relic's moments; without them (mocks), Perfects and downs stand in.
    // A trigger relic (Phase 5g) pulses on its fires (`ledger.triggers`).
    const pulse =
      src.relics.triggers?.[id] ??
      src.ledger.triggers?.[id] ??
      (id === 'tuning_fork' || id === 'glass_halo'
        ? src.ledger.perfects
        : id === 'lantern_of_the_lost'
          ? src.ledger.downs
          : 0);
    out.push({
      ...base,
      kind: 'passive',
      ready: true,
      remaining: 0,
      total: 0,
      pulse,
      label: def.name,
    });
  }
  return out;
}

/** Relics that act once at the start of a fight (flashed when the bar first appears). */
export const START_RELICS: readonly string[] = ['cantors_hymnal'];

/**
 * Which relics flashed between two snapshots: those whose `pulse` changed. A relic that just
 * appeared doesn't count (except the start-of-fight ones, handled by the bar).
 */
export function pulsed(prev: readonly RelicHud[], next: readonly RelicHud[]): string[] {
  const before = new Map(prev.map((r) => [r.id, r.pulse]));
  return next.filter((r) => before.has(r.id) && before.get(r.id) !== r.pulse).map((r) => r.id);
}
