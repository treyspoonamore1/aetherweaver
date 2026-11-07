/**
 * Telegraphs (docs/plan/04 §5.3): every big enemy attack is announced with a shape, a fill
 * from `start` to `impact`, a severity and answer tags. Resolution is where the Weaver's
 * answers pay off: Perfect Wards, warded hits, Reel dodges and counterfactual saves.
 */
import type { AttackDef } from '../../content/schema';
import type { CutResolved, TelegraphShape, ThreadCutCause } from '../events';
import type {
  DeepReadonly,
  Entity,
  EntityId,
  EntityStoreView,
  ReadonlyEntity,
  SaveCause,
  Shield,
  StatusId,
  Telegraph,
  WorldState,
} from '../state';
import type { World } from '../world';
import { SIM_DT } from '../constants';
import { distSq, len } from '../core/dmath';
import { recordSave } from './saves';
import {
  addStatus,
  applyOnHit,
  applyStatusPayload,
  releaseLink,
  dealDamage,
  getStatus,
  hasStatus,
  heal,
  isActive,
  ownShield,
  removeShield,
  removeStatus,
  scarTissueMult,
  shieldOf,
  totalShield,
} from './health';
import { bark, pushMarker, relicFired, setTimeScale } from './feedback';
import { gainResonance } from './resonance';
import { hasTalent } from '../bonds';
import { slotCost } from '../variants';
import { riposteBash } from '../systems/heroes';
import { cutThread } from '../systems/thread';
import { cutWouldLand, threadSegment } from '../rules3';

export interface TelegraphSpec {
  owner: Entity;
  attack: AttackDef;
  target: Entity | null;
  shape: TelegraphShape;
  windup: number;
  /** Flat damage per entity hit (already scaled by elite / enrage multipliers). */
  damage: number;
  /** Fraction of the victim's max HP (alternative to `damage`). */
  pctMaxHp: number;
  /** Scales the Perfect window (Lullaby widens it along with the wind-up). */
  perfectWindowMult?: number;
}

export function startTelegraph(world: World, spec: TelegraphSpec): Telegraph {
  const t: Telegraph = {
    id: world.internal.nextTelegraphId++,
    owner: spec.owner.id,
    target: spec.target?.id ?? null,
    attackId: spec.attack.id,
    name: spec.attack.name,
    kind: spec.attack.kind,
    shape: spec.shape,
    start: world.time,
    impact: world.time + spec.windup,
    perfectFrom: world.time + spec.windup - perfectWindow(world) * (spec.perfectWindowMult ?? 1),
    damage: spec.damage,
    pctMaxHp: spec.pctMaxHp,
    effect: spec.attack.effect,
    answers: [...spec.attack.answers],
    severity: 'normal',
  };
  // Movement II (docs/phase-5a.md P5, P7): set only when the attack has them.
  if (spec.attack.executeBelow !== undefined) t.executeBelow = spec.attack.executeBelow;
  if (spec.attack.kind === 'link' && spec.attack.linkStatus === 'pact') t.linkStatus = 'pact';
  // Movement III's Stitch (docs/phase-5c.md Q8).
  if (spec.attack.kind === 'link' && spec.attack.linkStatus === 'stitch') t.linkStatus = 'stitch';
  // A cut's verdict remembers whether there was a Thread to cut when it began (Q1).
  if (spec.attack.cut && threadSegment(world) !== null) t.threadAtCast = true;
  world.telegraphs.push(t);
  world.events.push({
    type: 'telegraphStarted',
    tick: world.tick,
    telegraph: t.id,
    owner: t.owner,
    target: t.target,
    name: t.name,
    kind: t.kind,
    shape: t.shape,
    start: t.start,
    impact: t.impact,
    perfectFrom: t.perfectFrom,
    damage: t.damage,
    pctMaxHp: t.pctMaxHp,
    answers: t.answers,
    effect: t.effect,
  });
  if (spec.attack.effect === 'damage') countAimed(world, t);
  return t;
}

/** Ledger: one aimed threat per hero it would hit when it starts. */
export function countAimed(world: World, t: Telegraph): void {
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (isActive(e) && contains(world, t, e)) world.ledger.telegraphsAimed++;
  }
}

/** The Perfect Ward window in sim seconds: base + motifs + assists. */
export function perfectWindow(world: World): number {
  return (
    world.content.techniques.ward.perfectWindow +
    world.mods.perfectWindowBonus +
    world.config.assists.perfectWindowBonus
  );
}

/**
 * Damage this telegraph would deal to `e` (before shields). Execution (`executeBelow`) deals at
 * least the target's life + 1 to a target below its threshold: through the normal damage path,
 * so a Ward, a barrier, Fermata or the Martyr can still spare them, and every forecast (the
 * lethal flag, the bots) sees it coming.
 */
export function telegraphDamage(t: DeepReadonly<Telegraph>, e: ReadonlyEntity): number {
  if (!e.health) return 0;
  const damage = t.damage + t.pctMaxHp * e.health.maxHp;
  if (t.executeBelow !== undefined && e.health.hp < e.health.maxHp * t.executeBelow)
    return Math.max(damage, e.health.hp + 1);
  return damage;
}

/** The status a link puts on the two heroes it binds: Resound, a Blood Pact, or a Stitch. */
export function linkStatusOf(t: DeepReadonly<Telegraph>): StatusId {
  return t.linkStatus ?? 'resound';
}

/**
 * The status a mark attack puts on its target (absent: Dirge; null: none, and nothing to Chime
 * away). An unknown attack (a training bell) marks with Dirge, as every mark did before.
 */
export function markStatusOf(attack: DeepReadonly<AttackDef> | null | undefined): StatusId | null {
  const status = attack?.markStatus;
  return status === undefined ? 'dirge' : status;
}

/** The mark status of a telegraph's attack (see `markStatusOf`). */
export function telegraphMarkStatus(
  world: { content: { attacks: readonly DeepReadonly<AttackDef>[] } },
  t: DeepReadonly<Telegraph>,
): StatusId | null {
  return markStatusOf(world.content.attacks.find((a) => a.id === t.attackId));
}

/** Would the telegraph hit `e` if it resolved now? (Also used by bots, on read-only state.) */
export function contains(
  world: { entities: EntityStoreView },
  t: DeepReadonly<Telegraph>,
  e: ReadonlyEntity,
): boolean {
  const s = t.shape;
  switch (s.kind) {
    case 'circle':
      return distSq(e.x, e.z, s.x, s.z) <= sq(s.r + e.radius);
    case 'donut': {
      const d = len(e.x - s.x, e.z - s.z);
      return d > s.innerR && d <= s.outerR + e.radius;
    }
    case 'cone': {
      const dx = e.x - s.x;
      const dz = e.z - s.z;
      const d = len(dx, dz);
      if (d > s.r + e.radius) return false;
      if (d <= e.radius + 0.5) return true;
      return (dx * s.dirX + dz * s.dirZ) / d >= s.halfAngleCos;
    }
    case 'line': {
      const lx = s.toX - s.x;
      const lz = s.toZ - s.z;
      const l2 = lx * lx + lz * lz;
      let u = l2 > 0 ? ((e.x - s.x) * lx + (e.z - s.z) * lz) / l2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const px = s.x + lx * u;
      const pz = s.z + lz * u;
      return distSq(e.x, e.z, px, pz) <= sq(s.width / 2 + e.radius);
    }
    case 'mark':
      return e.id === s.target;
    case 'link': {
      if (e.id !== s.a && e.id !== s.b) return false;
      const a = world.entities.get(s.a);
      const b = world.entities.get(s.b);
      if (!standing(a) || !standing(b)) return false;
      // A Chime that cleanses Resound from either hero breaks the link (a Blood Pact it can't).
      const status = linkStatusOf(t);
      if (!hasLinkStatus(a, status) || !hasLinkStatus(b, status)) return false;
      return distSq(a.x, a.z, b.x, b.z) < sq(s.r);
    }
    case 'raid':
      return !!e.hero;
    default:
      return false;
  }
}

const sq = (v: number) => v * v;

function hasLinkStatus(e: ReadonlyEntity, status: StatusId): boolean {
  return e.health!.statuses.some((x) => x.id === status);
}

function standing(e: ReadonlyEntity | undefined): e is ReadonlyEntity {
  return !!e?.health && !e.health.dead && !e.health.downed;
}

/** The entities a telegraph can hit: heroes, and the Weaver for ground shapes. */
function candidates(world: World, t: Telegraph, out: Entity[]): Entity[] {
  out.length = 0;
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (isActive(e)) out.push(e);
  }
  const ground =
    t.shape.kind === 'circle' ||
    t.shape.kind === 'cone' ||
    t.shape.kind === 'line' ||
    t.shape.kind === 'donut';
  if (ground) {
    const w = world.entities.get(world.weaverId);
    if (isActive(w)) out.push(w);
  }
  return out;
}

const scratch: Entity[] = [];

/**
 * Martyr's Vow will still be holding the heroes at 1 life when a hit due at `impact` lands.
 * The Vow's clock runs before telegraphs resolve and a hit lands on the first tick at or
 * after its impact, so a hit in the Vow's last tick doesn't count. (The Vow also ends if the
 * Weaver goes down, which nothing can foresee.)
 */
export function vowHoldsAt(state: WorldState, impact: number): boolean {
  if (!state.field.vow) return false;
  const left = state.entities.get(state.weaverId)?.weaver?.crescendo ?? 0;
  return impact + SIM_DT < state.time + left;
}

/** Forecast stripes and live severity, every tick. */
export function updateIncoming(world: World): void {
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (e?.health) e.health.incoming = 0;
  }
  const weaver = world.entities.get(world.weaverId);
  if (weaver?.health) weaver.health.incoming = 0;
  for (const t of world.telegraphs) {
    let lethal = false;
    // No hero falls to a hit that lands while Martyr's Vow holds them.
    const vowed = vowHoldsAt(world, t.impact);
    for (const e of candidates(world, t, scratch)) {
      if (!contains(world, t, e) || spared(world, t.id, e.id)) continue;
      const dmg = telegraphDamage(t, e);
      const h = e.health!;
      h.incoming += dmg;
      if (dmg >= h.hp + totalShield(h) && !(vowed && e.hero)) lethal = true;
    }
    t.severity = lethal ? 'lethal' : 'normal';
  }
}

/** Resolves every telegraph whose impact time has come. */
export function resolveTelegraphs(world: World): void {
  if (world.telegraphs.length === 0) return;
  const due: Telegraph[] = [];
  for (let i = 0; i < world.telegraphs.length;) {
    const t = world.telegraphs[i]!;
    if (t.impact <= world.time + 1e-9) {
      due.push(t);
      world.telegraphs.splice(i, 1);
    } else i++;
  }
  for (let i = 0; i < due.length; i++) resolve(world, due[i]!, due.slice(i + 1));
}

/** `pending`: the rest of this tick's due batch, not yet resolved. */
function resolve(world: World, t: Telegraph, pending: readonly Telegraph[] = []): void {
  const attack = world.content.attacks.find((a) => a.id === t.attackId);
  const effect = attack?.effect ?? 'damage';
  const owner = world.entities.get(t.owner);
  if (effect === 'damage') {
    let hitAnyone = false;
    // A Severing owner's blow on a cut telegraph waits for the cut's own verdict (below).
    let severPending = false;
    // The Finale (docs/phase-5d.md Q1): one verdict for a telegraph whose attack has `discord`.
    const verdict: Verdict | undefined = attack?.discord !== undefined ? { failed: [] } : undefined;
    const victims = candidates(world, t, []);
    for (const e of victims) {
      // Paradox: a Rewind took them out of its reach.
      if (spared(world, t.id, e.id)) {
        hitAnyone = true;
        answered(world);
        // Bonds (docs/phase-4e.md): the life your Rewind kept out of its reach.
        if (e.hero) e.hero.supportReceived += Math.min(telegraphDamage(t, e), e.health!.hp);
        emitResolved(world, t, e.id, 'dodged', 0);
        continue;
      }
      const reeled = world.internal.reelDodges.some((r) => r.telegraph === t.id && r.hero === e.id);
      const inside = contains(world, t, e);
      // A Reel counts whether the hero is already out of the shape or still mid-flight
      // (protected by the pull) when it lands: the last-moment Reel is the best one.
      if (reeled && (!inside || e.health!.invulnerable > 0)) {
        hitAnyone = true;
        reelDodged(world, t, e);
        continue;
      }
      if (!inside) continue;
      hitAnyone = true;
      const mark = t.shape.kind === 'mark' ? markStatusOf(attack) : null;
      if (mark !== null && !t.drill && !hasStatus(e, mark)) {
        // Chimed away in time.
        answered(world);
        emitResolved(world, t, e.id, 'cancelled', 0);
        continue;
      }
      if (hitEntity(world, t, e, attack ?? null, owner ?? null, verdict)) severPending = true;
    }
    if (!hitAnyone) {
      // Execution's condemned hero already fell before it landed: it names them (`fallen`).
      const condemned =
        t.executeBelow !== undefined && t.shape.kind === 'mark' ? t.shape.target : null;
      emitResolved(world, t, condemned, 'dodged', 0);
    }
    // A cut (Movement III, docs/phase-5c.md Q1): after its victims, whoever it hit. Severing on
    // the same blow comes after the verdict, so a Thread this telegraph cut is never reported
    // 'held' because its owner's Severing got there first (with the Thread gone, it does nothing).
    // One blow, one Strand: a dash Guard Strand turned aside takes its Severing with it.
    if (attack?.cut) {
      const verdict = resolveCut(world, t, attack);
      if (severPending && onSever && owner) onSever(world, owner, verdict === 'strand');
    }
    // Its status comes off both heroes, unless another live link still binds one.
    releaseLink(world, t, 'detonated', pending);
    // The Finale's verdict (Q1): failed when enough victims took damage nobody answered. Only an
    // attack with `discord` builds one; a lint keeps it off every Movement I-III attack.
    if (verdict && onTelegraphVerdict)
      onTelegraphVerdict(
        world,
        t,
        verdict.failed.length >= (attack!.discordQuorum ?? 1),
        verdict.failed,
      );
  }
  forgetTelegraph(world, t.id);
  // The caster's script follows up: heals, summons, suppression, chained tolls.
  if (owner?.enemy && onCastComplete) onCastComplete(world, owner, t);
  world.events.push({ type: 'telegraphEnded', tick: world.tick, telegraph: t.id });
}

/** What each cut attack is called in `threadSnapped.cause` (the Severing affix's is its own). */
const CUT_CAUSE: Readonly<Record<string, ThreadCutCause>> = {
  shears_dash: 'shears',
  unweaver_snip: 'snip',
  seamstress_unpick: 'unpick',
};

/**
 * A cut telegraph's verdict (docs/phase-5c.md Q1, the Execution verdict's pattern), one per
 * telegraph: an `always` cut (the Unpick) cuts whatever it hit; a line cuts only if it crosses
 * the Thread as it lands (`held` if not). With no Thread as it lands: `none` if there was none
 * at cast start either, else `held` (it snapped or was let go in the windup: not this cut's
 * doing). `strand`: Guard Strand turned it aside (`cutThread`).
 */
function resolveCut(world: World, t: Telegraph, attack: AttackDef): CutResolved['result'] {
  const cut = attack.cut!;
  const cause = CUT_CAUSE[attack.id] ?? (cut.always ? 'unpick' : 'shears');
  let result: CutResolved['result'];
  if (threadSegment(world) === null) result = t.threadAtCast ? 'held' : 'none';
  else if (cut.always || cutWouldLand(world, t))
    result = cutThread(world, cause, cut.lock, t.owner);
  else result = 'held';
  world.events.push({ type: 'cutResolved', tick: world.tick, telegraph: t.id, cause, result });
  return result;
}

/** Drops bookkeeping for a telegraph that resolved or was removed. */
export function forgetTelegraph(world: World, id: number): void {
  if (world.internal.reelDodges.length > 0)
    world.internal.reelDodges = world.internal.reelDodges.filter((r) => r.telegraph !== id);
  if (world.internal.spared.length > 0)
    world.internal.spared = world.internal.spared.filter((r) => r.telegraph !== id);
}

/** Paradox (the Chronomancer) spared `hero` from this telegraph. */
function spared(world: World, telegraph: number, hero: number): boolean {
  const list = world.internal.spared;
  return list.length > 0 && list.some((r) => r.telegraph === telegraph && r.hero === hero);
}

/**
 * One victim's hit. Returns true when a Severing check is owed but deferred: the blow landed, its
 * owner carries affixes, and the attack is a cut, whose verdict must come first (`resolve`).
 * `verdict` (the Finale's, docs/phase-5d.md Q1) is given only for an attack with `discord`: a
 * victim (a hero or the Weaver) who took damage nobody answered is listed in `failed`.
 */
function hitEntity(
  world: World,
  t: Telegraph,
  e: Entity,
  attack: AttackDef | null,
  owner: Entity | null,
  verdict?: Verdict,
): boolean {
  const h = e.health!;
  const damage = telegraphDamage(t, e);
  // A mark's status goes off with it, however it's answered.
  const mark = t.shape.kind === 'mark' ? markStatusOf(attack) : null;
  if (h.invulnerable > 0) {
    emitResolved(world, t, e.id, 'dodged', 0);
    return false;
  }
  const wouldDie = damage >= h.hp + ownShield(h);

  // Perfect Ward: a Ward cast inside the window before impact negates the hit outright (a
  // Chorale's on the hero you Warded too; its others only absorb). The Cracked Metronome makes an
  // early one Perfect, every so often.
  const shield = e.hero ? shieldOf(h, 'ward') : undefined;
  const ward = shield?.plain ? undefined : shield;
  const inWindow = !!ward && within(t, ward.appliedAt);
  if (ward && (inWindow || metronome(world, e))) {
    perfect(world, t, e, ward, damage, owner, wouldDie, !!ward.stasis);
    if (mark !== null) removeStatus(world, e, mark, 'detonated');
    return false;
  }
  // Aegis Link (a Ward variant): linked in the window, the first hit is negated and you join the
  // link. Once a cast, as a Ward's barrier is spent by its Perfect.
  const link = world.internal.link;
  if (
    e.hero &&
    link &&
    !link.weaver &&
    (link.a === e.id || link.b === e.id) &&
    within(t, link.appliedAt)
  ) {
    perfect(world, t, e, null, damage, owner, wouldDie, !!link.stasis);
    if (mark !== null) removeStatus(world, e, mark, 'detonated');
    if (!link.weaver) {
      link.weaver = true;
      world.events.push({
        type: 'linked',
        tick: world.tick,
        a: link.a,
        b: link.b,
        weaver: true,
        until: link.until,
      });
    }
    return false;
  }

  const result = dealDamage(world, e, {
    source: t.owner,
    sourceName: t.name,
    amount: damage,
    telegraph: t,
    kind: t.shape.kind === 'mark' ? 'detonation' : 'hit',
  });
  if (mark !== null) removeStatus(world, e, mark, 'detonated');
  if (verdict && (e.hero || e.weaver) && failedVictim(world, e, result)) verdict.failed.push(e.id);

  let outcome: 'hit' | 'warded' | 'absorbed' = 'hit';
  if (result.dealt <= 0 && result.absorbed > 0)
    outcome = result.absorbedByWard > 0 ? 'warded' : 'absorbed';
  if (result.absorbedByWeaver > 0) answered(world);
  if (e.hero && result.absorbedByWard > 0) {
    gainResonance(world, world.content.resonance.gains.wardAbsorb, 'ward absorb');
  }
  emitResolved(world, t, e.id, outcome, result.dealt);

  // Martyr's Veil, Bear or the Vow already logged their own Save for this hit.
  if (e.hero && wouldDie && !result.downed && !result.saved && result.absorbedByWeaver > 0) {
    const cause: SaveCause =
      result.absorbedByWard > 0 ? 'ward' : result.absorbedByDome > 0 ? 'dome' : 'other';
    if (cause !== 'other') recordSave(world, e, cause, damage, t.name);
  }
  if (attack?.status && result.dealt > 0 && !result.downed) {
    applyStatusPayload(world, e, attack.status, t.owner);
  }
  // On-hit payloads (docs/phase-5a.md P3): the caster's affixes' (Vampiric's Wound). Nothing on
  // a Movement I hit.
  if (owner && result.dealt > 0 && !result.downed) applyOnHit(world, owner, e, result.dealt);
  // Severing (Movement III): a blow it lands may cut the Thread (no affix has a cut before it).
  // On a cut telegraph it waits for the telegraph's own verdict.
  let severPending = false;
  if (
    onSever &&
    owner?.enemy &&
    owner.enemy.affixes.length > 0 &&
    result.dealt + result.absorbed > 0
  ) {
    if (attack?.cut) severPending = true;
    else onSever(world, owner);
  }
  // Oathkeeper (Bonds): Kael took the hit, and what it carries.
  if (result.takenBy !== undefined && (result.takenDealt ?? 0) > 0) {
    const kael = world.entities.get(result.takenBy);
    if (kael && attack?.status) applyStatusPayload(world, kael, attack.status, t.owner);
    if (kael && owner) applyOnHit(world, owner, kael, result.takenDealt ?? 0);
  }
  return severPending;
}

/**
 * The Finale's victim table (docs/phase-5d.md, "The verdict, victim by victim"): a victim (a hero,
 * or the Weaver caught in a ground shape) fails when damage landed (`dealt > 0`) and nothing
 * answered it: no Weaver shield or Ward barrier took part (a partial Ward, the dome, her Swap
 * barrier), the Martyr bore none of it (`borne`), no save caught it (the Lamb, the Vow's floor),
 * Oathkeeper or the sphere didn't take it (`takenBy`), Fermata isn't holding them, and they aren't
 * in a live Aegis Link (the Weaver once a Perfect brought her in). Fermata's guard alone answers
 * nothing: an aura isn't an answer.
 */
function failedVictim(
  world: World,
  e: Entity,
  result: {
    dealt: number;
    absorbedByWeaver: number;
    absorbedByWard: number;
    borne?: number;
    saved: boolean;
    takenBy?: EntityId;
  },
): boolean {
  if (result.dealt <= 0) return false;
  if (result.absorbedByWeaver > 0 || result.absorbedByWard > 0) return false;
  if ((result.borne ?? 0) > 0 || result.saved) return false;
  if (result.takenBy !== undefined || e.hero?.hold) return false;
  const link = world.internal.link;
  if (!link || link.until <= world.time) return true;
  return !(link.a === e.id || link.b === e.id || (link.weaver && e.id === world.weaverId));
}

function perfect(
  world: World,
  t: Telegraph,
  e: Entity,
  ward: Shield | null,
  damage: number,
  owner: Entity | null,
  wouldDie: boolean,
  /** Cast during Stasis (Eternal Moment). */
  stasis: boolean,
): void {
  const tech = world.content.techniques.ward;
  // An Aegis Link's Perfect (`ward` null) has no barrier to spend or echo.
  if (ward) removeShield(world, e, 'ward', true);
  // Echo Ward (the Chronomancer): it comes back a moment later, weaker. An echo doesn't echo.
  if (ward && world.mods.echoWardPct > 0 && !ward.echo && e.hero) {
    // Scar Tissue (docs/phase-5b.md) is already in the Ward's max; the echo's addShield adds it.
    const scar = scarTissueMult(world, e);
    const amount = ward.max * world.mods.echoWardPct;
    world.internal.echoWards.push({
      hero: e.id,
      at: world.time + world.mods.echoWardDelay,
      amount: scar !== 1 ? amount / scar : amount,
    });
  }
  world.ledger.perfects++;
  world.ledger.negated += damage;
  // Bonds: the life it kept (a hit bigger than the hero counts for what they had).
  if (e.hero) e.hero.supportReceived += Math.min(damage, e.health!.hp);
  answered(world);
  pushMarker(world, 'perfect', e.hero?.slot ?? null);
  const weaver = world.entities.get(world.weaverId);
  if (weaver?.weaver) {
    const w = weaver.weaver;
    const refund =
      slotCost(world, 'ward', tech.cost) * world.mods.techCostMult * tech.perfectRefund;
    // Eldritch Conduit (the Astrolabe): what was paid in Life comes back as Life.
    if (world.mods.techniquesCostLife) w.selfHealAcc += heal(world, weaver, refund, 'self', false);
    else w.spirit = Math.min(w.maxSpirit - w.reservedSpirit, w.spirit + refund);
  }
  // Ringing Parry (the Astrolabe): a longer stagger.
  if (owner?.health && !owner.health.dead)
    addStatus(world, owner, 'stagger', tech.staggerTime * world.mods.staggerMult, world.weaverId);
  // Riposte Bash (Bonds): Kael answers a Perfect Ward on him with his Shield Bash.
  if (owner && hasTalent(e, 'riposte_bash')) riposteBash(world, e, owner, damage);
  world.events.push({
    type: 'perfectWard',
    tick: world.tick,
    target: e.id,
    telegraph: t.id,
    negated: damage,
  });
  emitResolved(world, t, e.id, 'perfect', 0);
  gainResonance(
    world,
    world.content.resonance.gains.perfectWard + world.mods.perfectResonance,
    'perfect ward',
  );
  // Eternal Moment: a Ward (or Link) cast during Stasis that turned out Perfect.
  if (stasis && world.mods.stasisPerfectResonance > 0)
    gainResonance(world, world.mods.stasisPerfectResonance, 'eternal moment');
  setTimeScale(world, 0.2, 6, 'perfect');
  bark(world, e, 'perfect');
  if (world.mods.ripostePower > 0) riposte(world, e);
  perfectRelics(world, e);
  if (wouldDie) recordSave(world, e, 'ward', damage, t.name);
}

/** A Ward (or Link) applied at `at` is inside the attack's Perfect window. */
function within(t: Telegraph, at: number): boolean {
  return at >= t.perfectFrom - 1e-9 && at <= t.impact + 1e-9;
}

/** Cracked Metronome: spends its charge on an early Ward, if it's ready. */
function metronome(world: World, hero: Entity): boolean {
  const relics = world.relics;
  if (relics.metronomeAt === null || world.time < relics.metronomeAt) return false;
  relics.metronomeAt = world.time + world.mods.metronomeCooldown;
  relicFired(world, 'cracked_metronome', hero.id);
  return true;
}

/** Relics that answer a Perfect Ward: the Tuning Fork and the Glass Halo. */
function perfectRelics(world: World, hero: Entity): void {
  const charge = world.mods.perfectSoloCharge;
  const h = hero.hero;
  if (charge > 0 && h && h.soloActive <= 0 && h.solo < 100) {
    h.solo = Math.min(100, h.solo + charge);
    relicFired(world, 'tuning_fork', hero.id);
    if (h.solo >= 100) world.events.push({ type: 'soloReady', tick: world.tick, hero: hero.id });
  }
  const pct = world.mods.perfectHealPct;
  if (pct > 0) {
    const healed: EntityId[] = [];
    for (const id of world.party) {
      const ally = world.entities.get(id);
      if (!isActive(ally)) continue;
      heal(world, ally, ally.health.maxHp * pct, 'other');
      healed.push(ally.id);
    }
    relicFired(world, 'glass_halo', hero.id, healed);
  }
}

function riposte(world: World, hero: Entity): void {
  const power = world.mods.ripostePower;
  world.events.push({
    type: 'abilityUsed',
    tick: world.tick,
    source: world.weaverId,
    ability: 'riposteBloom',
    name: 'Riposte Bloom',
    x: hero.x,
    z: hero.z,
    radius: 4,
  });
  for (const enemy of world.entities.list()) {
    if (!enemy.enemy || !isActive(enemy)) continue;
    if (distSq(enemy.x, enemy.z, hero.x, hero.z) > sq(4 + enemy.radius)) continue;
    const r = dealDamage(world, enemy, {
      source: world.weaverId,
      sourceName: 'Riposte Bloom',
      amount: power,
    });
    world.ledger.amplified += r.dealt + r.absorbed;
  }
}

function reelDodged(world: World, t: Telegraph, e: Entity): void {
  answered(world);
  // The ledger counts heroes Reeled out of danger, not Reel casts.
  world.ledger.reels++;
  gainResonance(world, world.content.resonance.gains.reelDodge, 'reel dodge');
  emitResolved(world, t, e.id, 'dodged', 0);
  const h = e.health;
  // Bonds (docs/phase-4e.md): the life your Reel kept out of its reach.
  if (h && e.hero) e.hero.supportReceived += Math.min(telegraphDamage(t, e), h.hp);
  if (h && telegraphDamage(t, e) >= h.hp + ownShield(h))
    recordSave(world, e, 'reel', telegraphDamage(t, e), t.name);
}

/** One more enemy attack aimed at the party was answered. */
export function answered(world: World): void {
  world.ledger.telegraphsAnswered++;
}

function emitResolved(
  world: World,
  t: Telegraph,
  target: EntityId | null,
  outcome: 'hit' | 'dodged' | 'warded' | 'perfect' | 'absorbed' | 'cancelled',
  damage: number,
): void {
  world.events.push({
    type: 'telegraphResolved',
    tick: world.tick,
    telegraph: t.id,
    target,
    outcome,
    damage,
    ...(t.executeBelow !== undefined
      ? { execution: executionVerdict(world, target, outcome) }
      : {}),
  });
}

/**
 * An Execution's verdict on its one resolution (docs/phase-5a.md): `executed` when it landed and
 * the condemned hero went down to it; `fallen` when they were already down (no hit); `spared`
 * otherwise (above the line, Warded, out of it, Chimed away).
 */
function executionVerdict(
  world: World,
  target: EntityId | null,
  outcome: 'hit' | 'dodged' | 'warded' | 'perfect' | 'absorbed' | 'cancelled',
): 'executed' | 'spared' | 'fallen' {
  const e = target === null ? undefined : world.entities.get(target);
  const down = !!e?.health && (e.health.downed || e.health.dead);
  if (outcome === 'hit') return down ? 'executed' : 'spared';
  return down && outcome === 'dodged' ? 'fallen' : 'spared';
}

/** Removes a telegraph early (caster interrupted or killed). */
export function cancelTelegraph(world: World, id: number, answeredFor?: EntityId): void {
  const index = world.telegraphs.findIndex((t) => t.id === id);
  if (index < 0) return;
  const t = world.telegraphs[index]!;
  world.telegraphs.splice(index, 1);
  forgetTelegraph(world, id);
  // A cancelled link's status goes with it (a Blood Pact's ×1.2 is only "while linked").
  releaseLink(world, t, 'expired');
  // An Execution answered away for its condemned hero (a Paradox Rewind) spares them; one whose
  // caster was interrupted, killed or phase-shifted gives no verdict.
  const spared = answeredFor !== undefined && t.executeBelow !== undefined;
  world.events.push({
    type: 'telegraphResolved',
    tick: world.tick,
    telegraph: id,
    target: spared ? answeredFor : null,
    outcome: 'cancelled',
    damage: 0,
    ...(spared ? { execution: 'spared' as const } : {}),
  });
  world.events.push({ type: 'telegraphEnded', tick: world.tick, telegraph: id });
}

/** The dirge status remaining on `e` (for clutch Chimes), or Infinity. */
export function dirgeRemaining(e: Entity): number {
  return getStatus(e, 'dirge')?.remaining ?? Infinity;
}

/** Installed by the enemy system: completes non-damage casts (heals, summons, suppression). */
let onCastComplete: ((world: World, owner: Entity, t: Telegraph) => void) | null = null;
export function setOnCastComplete(fn: (world: World, owner: Entity, t: Telegraph) => void): void {
  onCastComplete = fn;
}

/**
 * Installed by the enemy system (docs/phase-5d.md Q1): a Finale telegraph's verdict, forwarded to
 * the fight's boss script. Called only for an attack with `discord`, so never in Movements I-III.
 */
type VerdictHook = (
  world: World,
  t: Telegraph,
  failed: boolean,
  victims: readonly EntityId[],
) => void;
/** One Finale telegraph's verdict: the victims who took damage nobody answered, in hit order. */
interface Verdict {
  failed: EntityId[];
}
let onTelegraphVerdict: VerdictHook | null = null;
export function setOnTelegraphVerdict(fn: VerdictHook): void {
  onTelegraphVerdict = fn;
}

/**
 * Installed by the enemy system: Severing's cut on a blow its elite lands (Movement III).
 * `stranded`: the same blow's cut telegraph was just turned aside by Guard Strand.
 */
type SeverHook = (world: World, owner: Entity, stranded?: boolean) => void;
let onSever: SeverHook | null = null;
export function setOnSever(fn: SeverHook): void {
  onSever = fn;
}

export { recordSave };
