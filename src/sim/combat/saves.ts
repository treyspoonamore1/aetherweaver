/**
 * Counterfactual saves (docs/plan/02 §4.10): the Weaver prevented a hit that would have downed
 * a hero. Logged in the ledger, rewarded with Resonance and a beat of slow-motion; the view
 * shows the hero's ghost falling where they would have died.
 */
import type { Entity, SaveCause } from '../state';
import type { World } from '../world';
import { bark, pushMarker, setTimeScale } from './feedback';
import { gainResonance } from './resonance';

export function recordSave(
  world: World,
  hero: Entity,
  cause: SaveCause,
  prevented: number,
  attack: string,
): void {
  if (!hero.hero) return;
  world.ledger.saves.push({
    time: world.time - world.encounter.startedAt,
    hero: hero.id,
    heroDefId: hero.hero.defId,
    cause,
    prevented,
    attack,
  });
  pushMarker(world, 'save', hero.hero.slot);
  world.events.push({
    type: 'save',
    tick: world.tick,
    target: hero.id,
    cause,
    counterfactualDamage: prevented,
    attack,
  });
  gainResonance(world, world.content.resonance.gains.save, 'save');
  setTimeScale(world, 0.35, 15, 'save');
  bark(world, hero, 'saved', true);
}
