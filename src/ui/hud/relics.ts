/**
 * The HUD's relic bar, derived from the sim's `WorldState.relics` (docs/phase-3b.md). Pure: the
 * bridge calls it at 15 Hz and the tests call it with hand-made states.
 */
import { relicDef, type RelicRarity } from '../../content';

export interface RelicHud {
  id: string;
  name: string;
  icon: string;
  rarity: RelicRarity;
  cleansed: boolean;
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
}

/** What the bar needs from the sim: the relics and a couple of ledger counters. */
export interface RelicSource {
  relics: {
    ids: readonly string[];
    cleansed: readonly string[];
    metronomeAt: number | null;
    thimbleAt: number | null;
    veil: boolean;
    /** How often each relic has acted this fight (the sim's `relics.triggers`). */
    triggers?: Readonly<Record<string, number>>;
  };
  time: number;
  ledger: { perfects: number; downs: number };
}

const COOLDOWN: Record<string, 'metronomeAt' | 'thimbleAt'> = {
  cracked_metronome: 'metronomeAt',
  silver_thimble: 'thimbleAt',
};

/** The relic's cooldown in seconds, from content (`values.cooldown`). */
function cooldownOf(id: string): number {
  return relicDef(id).values.cooldown ?? 0;
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
    const base = {
      id,
      name: def.name,
      icon: def.icon,
      rarity: def.rarity,
      cleansed: src.relics.cleansed.includes(id),
    };
    const field = COOLDOWN[id];
    if (field) {
      const at = src.relics[field];
      const total = cooldownOf(id);
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
    const pulse =
      src.relics.triggers?.[id] ??
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
