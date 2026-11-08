/**
 * Movement II's HUD looks as plain data (docs/phase-5a.md): stack emphasis, the healing cut's
 * words, the boss bar's phase ticks and cast glyphs. Testable without React.
 */
import { heroPronouns } from '../screens/rosterModel';
import { CONTENT, bloodRageOf, partyHasDome } from '../../content';
import { CONDUCTOR_DECREES } from '../../content/crucible';
import type { IconName } from '../kit/iconPaths';
import type { BossHud, HeroHud, StatusHud } from '../store';
import { DOOM_EMPHASIS } from './riftLook';

/**
 * Stacks from which a stacking status asks for its answer (Chime the bleeding at 5 stacks or
 * more). The badge glows and shows the Chime glyph from here.
 */
export const STACKS_EMPHASIS = 5;

/**
 * A stacking status's emphasis: its count is high enough that it wants its answer now. Doom
 * (Movement III) wants it a stack before it ignites (`DOOM_EMPHASIS`); every other stacking
 * status from STACKS_EMPHASIS, as before.
 */
export function stacksUrgent(
  status: Pick<StatusHud, 'stacks'> & { id?: StatusHud['id'] },
): boolean {
  const at = status.id === 'doom' ? DOOM_EMPHASIS : STACKS_EMPHASIS;
  return (status.stacks ?? 0) >= at;
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
  // Movement III (docs/phase-5c.md): the Seamstress's needle, the Unweaver's shears.
  the_seamstress: 'needle',
  the_unweaver: 'scissors',
  // The Finale (docs/phase-5d.md): the Silent Conductor's baton.
  the_silent_conductor: 'baton',
};

/**
 * Fortissimo Silence's own cast glyph (docs/phase-5d.md): the music cut off, over the Conductor's
 * baton while its three pulses are played.
 */
export const FORTISSIMO_CAST_ICON: IconName = 'mute';

/** A boss's cast glyph; `fortissimo`: Fortissimo Silence is being played (the Finale only). */
export function bossCastIcon(defId: string | undefined, fortissimo = false): IconName {
  if (fortissimo) return FORTISSIMO_CAST_ICON;
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

/**
 * The party's heroes as the HUD knows them: their def, whether Execution condemns them, and the
 * healing cut on them now (`healCut`: absent when your healing takes in full).
 */
export type PartyLook = readonly (Pick<HeroHud, 'defId' | 'execute'> &
  Partial<Pick<HeroHud, 'healCut'>>)[];

/**
 * Whether your healing barely takes on this condemned hero right now: a hero whose own passive
 * cuts the Weaver's healing (Brann), while the live cut still holds. Blood Oath lifts his, so the
 * frame shows no hatch and Mending him above the line works: the generic answer stands.
 */
export function healBarelyTakes(h: PartyLook[number] | undefined): boolean {
  if (!h) return false;
  const def = CONTENT.heroes.find((d) => d.id === h.defId);
  const rage = def ? bloodRageOf(def) : null;
  return !!rage && rage.weaverHealMult < 1 && (h.healCut ?? 1) < 1;
}

/**
 * The heroes the Finale's mirror-choir sings back (docs/phase-5d.md: Alto Lyra, Bass Brann, Tenor
 * Kael, Soprano Vexis; `crucible.ts`). Phase 5e's Seren and Oro have no voice there.
 */
const MIRRORED: ReadonlySet<string> = new Set(['lyra', 'brann', 'kael', 'vexis']);

/**
 * The Mirror Choir's Decree for a party with a hero the choir doesn't mirror (Seren, Oro;
 * docs/phase-5e.md 'Known gaps'): 'every voice of your party' would be inexact, so it names the
 * four it sings and says your other heroes still sing.
 */
export const MIRROR_CHOIR_OTHERS =
  'Mirror Choir — the choir sings Lyra, Brann, Kael and Vexis back at you; your other heroes still sing. Discord swells: hold your Crescendo before it fills.';

/**
 * A decree as the HUD shows it to this party. The sim's text (hashed, never edited) is matched to
 * its attack def: with no dome in the party (`partyHasDome`) an attack's `decreeNoDome` replaces
 * it, and when Execution condemns a hero whose own passive cuts your healing on him (Brann) while
 * that cut holds (`healBarelyTakes`), the decree says to Ward him. The Mirror Choir's says your
 * other heroes still sing when the party has one it doesn't mirror. Any other text, and every
 * default party, is returned unchanged.
 */
export function shownDecree(text: string, party: PartyLook): string {
  if (text === CONDUCTOR_DECREES.mirrorChoir && party.some((h) => !MIRRORED.has(h.defId)))
    return MIRROR_CHOIR_OTHERS;
  const attack = CONTENT.attacks.find((a) => a.decree === text);
  if (!attack) return text;
  if (attack.executeBelow !== undefined) {
    const condemned = party.find((h) => h.execute !== undefined);
    if (condemned && healBarelyTakes(condemned)) {
      const him = heroPronouns(condemned.defId).obj;
      return `Execution — ${heroName(condemned.defId)} is condemned. Ward ${him}: your healing barely takes on ${him}.`;
    }
    return text;
  }
  if (attack.decreeNoDome !== undefined && !partyHasDome(party.map((h) => h.defId)))
    return attack.decreeNoDome;
  return text;
}

function heroName(id: string): string {
  return CONTENT.heroes.find((h) => h.id === id)?.name ?? id;
}

/**
 * The decree the boss bar keeps showing: the one latched when it was announced (the store's
 * `lastDecree`, worded for the party at that moment) over the bridge's, which rewords it from the
 * live party and so falls back to the generic text once Execution has resolved. The bridge's
 * when they name different decrees (or nothing was latched).
 */
export function bossDecreeShown<D extends { name: string; text: string }>(
  live: D | null | undefined,
  latched: D | null | undefined,
): D | null {
  if (live && latched && live.name === latched.name) return latched;
  return live ?? latched ?? null;
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
