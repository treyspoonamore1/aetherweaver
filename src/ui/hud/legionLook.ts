/**
 * Movement II's HUD looks as plain data (docs/phase-5a.md): stack emphasis, the healing cut's
 * words, the boss bar's phase ticks and cast glyphs. Testable without React.
 */
import { CONTENT, partyHasDome } from '../../content';
import type { IconName } from '../kit/iconPaths';
import type { BossHud, HeroHud, StatusHud } from '../store';

/**
 * Stacks from which a stacking status asks for its answer (Chime the bleeding at 5 stacks or
 * more). The badge glows and shows the Chime glyph from here.
 */
export const STACKS_EMPHASIS = 5;

/** A stacking status's emphasis: its count is high enough that it wants its answer now. */
export function stacksUrgent(status: Pick<StatusHud, 'stacks'>): boolean {
  return (status.stacks ?? 0) >= STACKS_EMPHASIS;
}

/** "healing received halved" (×0.5), "quartered" (×0.25), else the share. */
export function healCutTitle(cut: number): string {
  if (Math.abs(cut - 0.5) < 1e-6) return 'healing received halved';
  if (Math.abs(cut - 0.25) < 1e-6) return 'healing received quartered';
  return `healing received ×${Math.round(cut * 100) / 100}`;
}

/** Execution's line, from content (`executeBelow`), as a whole percent. */
export const EXECUTE_PCT = Math.round(
  (CONTENT.attacks.find((a) => a.executeBelow !== undefined)?.executeBelow ?? 0.4) * 100,
);

/** Each boss's cast glyph (the Movement I bosses keep their bell). */
const CAST_ICON: Readonly<Record<string, IconName>> = {
  gorehound_matriarch: 'paw',
  vharun_crimson_warden: 'crown',
};

export function bossCastIcon(defId: string | undefined): IconName {
  return (defId && CAST_ICON[defId]) || 'bell';
}

/**
 * The boss bar's phase ticks, in percent: the sim's thresholds (`phaseAt`), or an even split for
 * a snapshot without them.
 */
export function phaseTicks(boss: Pick<BossHud, 'phases' | 'phaseAt'>): number[] {
  if (boss.phaseAt) return boss.phaseAt.map((at) => at * 100);
  return Array.from(
    { length: Math.max(0, boss.phases - 1) },
    (_, i) => ((boss.phases - 1 - i) / boss.phases) * 100,
  );
}

// ── The roster (docs/phase-5b.md): decrees and answers that assume a party ───────────

/** The party's heroes as the HUD knows them: their def, and whether Execution condemns them. */
type PartyLook = readonly Pick<HeroHud, 'defId' | 'execute'>[];

/**
 * A decree as the HUD shows it to this party. The sim's text (hashed, never edited) is matched to
 * its attack def: with no dome in the party (`partyHasDome`) an attack's `decreeNoDome` replaces
 * it, and when Execution condemns a hero whose own passive halves your healing on him (Brann),
 * the decree says to Ward him. Any other text, and every default party, is returned unchanged.
 */
export function shownDecree(text: string, party: PartyLook): string {
  const attack = CONTENT.attacks.find((a) => a.decree === text);
  if (!attack) return text;
  if (attack.executeBelow !== undefined) {
    const condemned = party.find((h) => h.execute !== undefined);
    const def = condemned ? CONTENT.heroes.find((h) => h.id === condemned.defId) : undefined;
    if (def?.passive && def.passive.weaverHealMult < 1)
      return `Execution — ${def.name} is condemned. Ward him: your healing barely takes on him.`;
    return text;
  }
  if (attack.decreeNoDome !== undefined && !partyHasDome(party.map((h) => h.defId)))
    return attack.decreeNoDome;
  return text;
}

/** A decree as shown to this party (`shownDecree`): the same object when nothing changes. */
export function shownDecreeOf<D extends { text: string }>(decree: D, party: PartyLook): D {
  const text = shownDecree(decree.text, party);
  return text === decree.text ? decree : { ...decree, text };
}

/** A telegraph's answers for this party: the dome only when a party hero brings one. */
export function shownAnswers<T extends string>(
  answers: readonly T[],
  heroIds: readonly string[],
): T[] {
  return partyHasDome(heroIds) ? [...answers] : answers.filter((a) => a !== 'dome');
}
