/**
 * An enemy special in a few words, for the Codex's enemy entries (after its kind and wind-up).
 * Pure, so the tests read it without the screen.
 */
import type { AttackDef } from '../../content';
import { fmt } from '../kit/format';
import { t } from '../text';

/**
 * What a Movement III boss script does when it lands (docs/phase-5c.md): none of them deals
 * damage, so '0 damage' would misread them. Movement II's scripts read as they always did.
 */
const SCRIPT_EFFECT: Readonly<Record<string, string>> = {
  get unweaver_steal_verse() {
    return t('screens.codexAttack.stealsOneOfYour');
  },
  get unweaver_unravel() {
    return t('screens.codexAttack.turnsYourMendTo');
  },
  get unweaver_mirror_ward() {
    return t('screens.codexAttack.wardsItsChampion');
  },
};

/** An enemy special's effect, in a few words, after its kind and wind-up. */
export function attackDamage(a: AttackDef): string {
  if (a.effect === 'healAllies') return t('screens.codexAttack.healsAllies');
  if (a.effect === 'summon')
    return `summons ${a.summon?.count ?? ''} ${a.summon?.enemy.replace(/_/g, ' ') ?? ''}`;
  if (a.effect === 'suppress') return t('screens.codexAttack.silencesAuras');
  // Movement III's fields, mirror and scripts (docs/phase-5c.md): what they do, not '0 damage'.
  if (a.effect === 'zone' && a.zone) {
    const z = a.zone;
    const hurt = z.status?.dps
      ? t('screens.codexAttack.damageASecond', { dps: fmt(z.status.dps) })
      : '';
    if (z.kind === 'pull')
      return t('screens.codexAttack.pullsMSWithin', {
        value: z.pullSpeed ?? 0,
        radius: fmt(z.radius),
        hurt,
      });
    return t('screens.codexAttack.refusesWardChimeAnd', { radius: fmt(z.radius), hurt });
  }
  if (a.effect === 'mimic') return t('screens.codexAttack.copiesYourEmpowerOr');
  if (a.effect === 'script' && SCRIPT_EFFECT[a.id]) return SCRIPT_EFFECT[a.id]!;
  if (a.pctMaxHp !== undefined)
    return t('screens.codexAttack.ofMaxLife', { round: Math.round(a.pctMaxHp * 100) });
  return `${fmt(a.damage)} damage`;
}
