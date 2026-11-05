/**
 * An enemy special in a few words, for the Codex's enemy entries (after its kind and wind-up).
 * Pure, so the tests read it without the screen.
 */
import type { AttackDef } from '../../content';
import { fmt } from '../kit/format';

/**
 * What a Movement III boss script does when it lands (docs/phase-5c.md): none of them deals
 * damage, so '0 damage' would misread them. Movement II's scripts read as they always did.
 */
const SCRIPT_EFFECT: Readonly<Record<string, string>> = {
  unweaver_steal_verse: 'steals one of your auras',
  unweaver_unravel: 'turns your Mend to harm',
  unweaver_mirror_ward: 'Wards its champion',
};

/** An enemy special's effect, in a few words, after its kind and wind-up. */
export function attackDamage(a: AttackDef): string {
  if (a.effect === 'healAllies') return 'heals allies';
  if (a.effect === 'summon')
    return `summons ${a.summon?.count ?? ''} ${a.summon?.enemy.replace(/_/g, ' ') ?? ''}`;
  if (a.effect === 'suppress') return 'silences auras';
  // Movement III's fields, mirror and scripts (docs/phase-5c.md): what they do, not '0 damage'.
  if (a.effect === 'zone' && a.zone) {
    const z = a.zone;
    const hurt = z.status?.dps ? `, ${fmt(z.status.dps)} damage a second` : '';
    if (z.kind === 'pull') return `pulls ${z.pullSpeed ?? 0} m/s within ${fmt(z.radius)} m${hurt}`;
    return `refuses Ward, Chime and Reel (or Rewind) within ${fmt(z.radius)} m${hurt}`;
  }
  if (a.effect === 'mimic') return 'copies your Empower, or your last Ward or Chime';
  if (a.effect === 'script' && SCRIPT_EFFECT[a.id]) return SCRIPT_EFFECT[a.id]!;
  if (a.pctMaxHp !== undefined) return `${Math.round(a.pctMaxHp * 100)}% of max life`;
  return `${fmt(a.damage)} damage`;
}
