/**
 * Tyrant (docs/phase-6.md, "Tyrant"): each boss and phase takes up its table's attack, announced
 * once as the phase begins, first cast `first` s in and then on its cooldown × `cooldown`%, under
 * the cap on damaging telegraphs shown at once; a phase shift replaces it. Every entry is cast
 * from its boss in a fight (the doc's check, which swapped the Leech's Latch out: see
 * `TYRANT_TABLE`). The Silent Conductor plays one of its own closing attacks more often, on one
 * clock, and leaves the Grand Silence as built. Without the level nothing moves: no key, no event,
 * the golden's hash.
 */
import { describe, expect, it } from 'vitest';
import { attackDef, dissonanceLevel, enemyDef } from '../../src/content';
import { BURN_EVERY, TYRANT_BURN, TYRANT_OWN } from '../../src/content/crucible';
import { CONDUCTOR, DOWNBEAT, GRAND_SILENCE, SFORZANDO } from '../../src/content/crucibleIds';
import { makeBot } from '../../src/bots';
import { createSim, type Command, type Sim, type SimConfig, type SimEvent } from '../../src/sim';
import { parseReplay, runReplay } from '../../src/sim/replay';
import type { Entity, EntityId, Telegraph } from '../../src/sim/state';
import { bossPhaseTable } from '../../src/sim/systems/bosses';
import {
  TYRANT_TABLE,
  tryTyrant,
  tyrantAttackOf,
  tyrantDecreeOf,
} from '../../src/sim/systems/tyrant';
import type { World } from '../../src/sim/world';
import { blindDecree } from '../../src/ui/screens/dissonanceModel';
import { runScenario } from '../../tools/runScenario';
import {
  SCENARIO_BELLWARDEN,
  SCENARIO_CANTOR,
  SCENARIO_CONDUCTOR,
  SCENARIO_MATRIARCH,
  SCENARIO_NOVICE_SILENCE,
  SCENARIO_SEAMSTRESS,
  SCENARIO_UNWEAVER,
  SCENARIO_VHARUN,
  type Scenario,
} from '../../tools/scenarios';
import golden from './golden.json';
import { ofType, worldOf } from './helpers';

const TYRANT = [{ id: 'tyrant', rank: 1 }];
const values = dissonanceLevel('tyrant').values;
const COOLDOWN = values.cooldown! / 100;
const FIRST = values.first!;
const setBossHp = (pct: number): Command => ({ t: 'debug', op: { op: 'setBossHp', pct } });

/** Each boss's golden fight: its encounter, kit and bot. */
const FIGHTS: Record<string, Scenario> = {
  the_bellwarden: SCENARIO_BELLWARDEN,
  the_hollow_cantor: SCENARIO_CANTOR,
  gorehound_matriarch: SCENARIO_MATRIARCH,
  vharun_crimson_warden: SCENARIO_VHARUN,
  the_seamstress: SCENARIO_SEAMSTRESS,
  the_unweaver: SCENARIO_UNWEAVER,
};

/** A scenario's fight with Tyrant (and debug commands, to stage the boss's phase). */
function tyrantSim(s: Scenario, extra: Partial<SimConfig> = {}): Sim {
  return createSim({ seed: s.seed, ...s.config, debug: true, dissonance: TYRANT, ...extra });
}

function bossOf(w: World): Entity | undefined {
  const id = w.encounter.bossId;
  return id === null ? undefined : w.entities.get(id);
}

function damagingLive(w: World): number {
  return w.telegraphs.filter((t) => t.effect === 'damage').length;
}

interface Cast {
  at: number;
  phase: number;
  telegraph: Telegraph;
  /** Damaging telegraphs live as it began, itself included. */
  live: number;
  readyAfter: number;
}

/**
 * Plays `s` with Tyrant, the boss's life set into `phase` once it stands, until the boss has cast
 * its borrowed attack of that phase (or `seconds` pass); every edict and borrowed cast on the way.
 */
function playPhase(s: Scenario, phase: number, seconds = 50) {
  const sim = tyrantSim(s);
  const w = worldOf(sim);
  const player = makeBot(s.name.startsWith('novice') ? 'novice' : 'skilled', s.seed);
  const def = Object.keys(FIGHTS).find((k) => FIGHTS[k] === s)!;
  const at = bossPhaseTable(def)[phase - 1]!.at;
  let staged = phase === 1;
  const edicts: SimEvent[] = [];
  const casts: Cast[] = [];
  const resolved = new Map<number, string>();
  /** Life the boss's casts gave back to its side (the Mending Hymn's). */
  let healed = 0;
  for (let tick = 0; tick < seconds * 60; tick++) {
    const commands = player.decide(sim.state);
    if (!staged && bossOf(w) && w.time > 2) {
      commands.push(setBossHp(at - 0.02));
      staged = true;
    }
    const known = new Set(w.telegraphs.map((t) => t.id));
    sim.step(commands);
    const events = sim.drainEvents();
    edicts.push(...ofType(events, 'tyrantEdict'));
    for (const r of ofType(events, 'telegraphResolved')) resolved.set(r.telegraph, r.outcome);
    // A zone or a heal ends without a verdict.
    for (const r of ofType(events, 'telegraphEnded'))
      if (!resolved.has(r.telegraph)) resolved.set(r.telegraph, 'ended');
    const boss = bossOf(w);
    for (const h of ofType(events, 'healApplied')) if (h.source === boss?.id) healed += h.amount;
    const hold = boss?.enemy?.tyrant;
    for (const t of w.telegraphs) {
      if (known.has(t.id) || t.owner !== boss?.id || t.attackId !== hold?.attack) continue;
      casts.push({
        at: w.time,
        phase: boss.enemy!.phase,
        telegraph: t,
        live: damagingLive(w),
        readyAfter: hold.readyAt,
      });
    }
    if (casts.some((c) => c.phase === phase && resolved.has(c.telegraph.id))) break;
  }
  return { sim, w, edicts, casts, resolved, healed };
}

describe('Tyrant (docs/phase-6.md)', () => {
  it('the level, its mods and its table', () => {
    const level = dissonanceLevel('tyrant');
    expect([level.effect, level.points, level.ranks]).toEqual(['tyrant', 4, 1]);
    const sim = tyrantSim(SCENARIO_BELLWARDEN);
    expect(worldOf(sim).mods.tyrant).toBe(true);
    expect(worldOf(sim).mods.tyrantCooldownMult).toBe(COOLDOWN);
    expect(worldOf(sim).mods.tyrantFirst).toBe(FIRST);
    for (const [boss, rows] of Object.entries(TYRANT_TABLE)) {
      expect(rows.length, boss).toBe(bossPhaseTable(boss).length);
      for (const row of rows) {
        if (!row) continue;
        const attack = attackDef(row.attack);
        // Never a summon, and nothing that touches an aura (decision 5): no suppression.
        expect(attack.effect, row.attack).not.toBe('summon');
        expect(attack.effect, row.attack).not.toBe('suppress');
        expect(attack.zone?.kind ?? 'none', row.attack).not.toBe('mute');
        const from = enemyDef(row.from);
        if (boss === CONDUCTOR) expect(row.from).toBe(CONDUCTOR);
        else {
          expect(['boss', 'miniboss'], row.from).not.toContain(from.role);
          expect(from.specials, row.from).toContain(row.attack);
        }
      }
    }
    expect(tyrantAttackOf('the_bellwarden', 1)?.attack).toBe('lancer_lance');
    expect(tyrantAttackOf(CONDUCTOR, 3)).toBeNull();
    expect(tyrantAttackOf('nobody', 1)).toBeNull();
  });

  // Every entry from its boss in its fight: one edict a phase, the first cast `first` s in, its
  // next due its cooldown × 1.5 on, under the cap, and resolved (it began: in reach, aimed).
  for (const [boss, s] of Object.entries(FIGHTS))
    for (let phase = 1; phase <= TYRANT_TABLE[boss]!.length; phase++)
      it(`${boss} phase ${phase} casts its borrowed attack`, () => {
        const entry = tyrantAttackOf(boss, phase)!;
        const { edicts, casts, resolved, healed } = playPhase(s, phase);
        const mine = ofType(edicts, 'tyrantEdict');
        // One edict a phase entered, in order, each naming its table's attack.
        expect(mine.map((e) => e.phase)).toEqual(
          Array.from({ length: phase }, (_, i) => i + 1).filter((p) => tyrantAttackOf(boss, p)),
        );
        const edict = mine.at(-1)!;
        expect([edict.attack, edict.from]).toEqual([entry.attack, entry.from]);
        const cast = casts.find((c) => c.phase === phase);
        expect(cast, `${entry.attack} was cast`).toBeDefined();
        const edictAt = edict.tick / 60;
        expect(cast!.at).toBeGreaterThanOrEqual(edictAt + FIRST - 1e-6);
        expect(cast!.readyAfter).toBeCloseTo(
          cast!.at + attackDef(entry.attack).cooldown * COOLDOWN,
          6,
        );
        expect(cast!.live).toBeLessThanOrEqual(2);
        expect(resolved.has(cast!.telegraph.id)).toBe(true);
        // The Mending Hymn heals the boss's side (the doc's "Focus it or the boss's side heals").
        if (attackDef(entry.attack).effect === 'healAllies') expect(healed).toBeGreaterThan(0);
      }, 120_000);

  it('the cap on damaging telegraphs holds it back; then it is cast', () => {
    const sim = tyrantSim(SCENARIO_BELLWARDEN);
    const w = worldOf(sim);
    const player = makeBot('skilled', SCENARIO_BELLWARDEN.seed);
    while (!(bossOf(w)?.enemy?.tyrant && w.telegraphs.length > 0))
      sim.step(player.decide(sim.state));
    const boss = bossOf(w)!;
    const hold = boss.enemy!.tyrant!;
    hold.readyAt = w.time;
    boss.enemy!.cast = null;
    const target = w.entities.get(w.party[0]!)!;
    const fake = (id: number): Telegraph => ({ ...w.telegraphs[0]!, id, effect: 'damage' });
    w.telegraphs.push(fake(90001), fake(90002));
    const before = w.telegraphs.length;
    expect(tryTyrant(w, boss, target)).toBe(false);
    expect(w.telegraphs.length).toBe(before);
    expect(hold.readyAt).toBeCloseTo(w.time + 1.5, 9);
    w.telegraphs.splice(w.telegraphs.length - 2, 2);
    hold.readyAt = w.time;
    expect(tryTyrant(w, boss, target)).toBe(true);
    expect(w.telegraphs.some((t) => t.owner === boss.id && t.attackId === hold.attack)).toBe(true);
  });

  it('the Decree: what the boss takes up, then the answers, which Blind Score cuts', () => {
    const text = tyrantDecreeOf('the_bellwarden', { attack: 'lancer_lance', from: 'glass_lancer' });
    expect(text).toBe(
      'Tyrant — the Bellwarden takes up the Glass Lancer’s Glass Lance. Ward it, Reel the target, or step aside.',
    );
    expect(blindDecree(text)).toBe(
      'Tyrant — the Bellwarden takes up the Glass Lancer’s Glass Lance.',
    );
    expect(tyrantDecreeOf(CONDUCTOR, { attack: SFORZANDO, from: CONDUCTOR })).toBe(
      'Tyrant — the Silent Conductor plays its Sforzando more often. Step aside, or Reel the target.',
    );
    for (const [boss, rows] of Object.entries(TYRANT_TABLE))
      for (const row of rows) {
        if (!row) continue;
        const t = tyrantDecreeOf(boss, row);
        expect(blindDecree(t).length, t).toBeLessThan(t.length);
        expect(t, row.attack).not.toMatch(/\d/);
      }
  });

  it('without Tyrant: the golden hash, and no hold or edict', () => {
    const plain = runScenario(SCENARIO_BELLWARDEN);
    expect(plain.hash).toBe(golden.scenarios['skilled-bellwarden']);
    const sim = createSim({ seed: SCENARIO_BELLWARDEN.seed, ...SCENARIO_BELLWARDEN.config });
    const player = makeBot('skilled', SCENARIO_BELLWARDEN.seed);
    let edicts = 0;
    for (let t = 0; t < 60 * 20; t++) {
      sim.step(player.decide(sim.state));
      edicts += ofType(sim.drainEvents(), 'tyrantEdict').length;
      const boss = bossOf(worldOf(sim));
      expect(boss?.enemy && 'tyrant' in boss.enemy).toBeFalsy();
    }
    expect(edicts).toBe(0);
  });

  it('an Idle Weaver fails a borrowed attack, and a Ward on the hero it strikes answers it', () => {
    // The Bellwarden's Glass Lance, played with no Weaver input; then again, with one Ward on
    // the hero its line struck, cast just before it lands (all else is the same until then).
    const play = (ward: EntityId | null) => {
      const sim = tyrantSim(SCENARIO_BELLWARDEN);
      const w = worldOf(sim);
      let lance: Telegraph | undefined;
      let warded = false;
      for (let t = 0; t < 60 * 30; t++) {
        const commands: Command[] = [];
        if (ward !== null && lance && !warded && w.time >= lance.impact - 0.4) {
          commands.push({ t: 'tech', id: 'ward', slot: w.entities.get(ward)!.hero!.slot as 0 });
          warded = true;
        }
        sim.step(commands);
        const events = sim.drainEvents();
        lance ??= w.telegraphs.find(
          (x) => x.attackId === 'lancer_lance' && x.owner === w.encounter.bossId,
        );
        const verdict = lance
          ? ofType(events, 'telegraphResolved').find((r) => r.telegraph === lance!.id)
          : undefined;
        if (verdict) return verdict;
      }
      throw new Error('no Glass Lance');
    };
    const idle = play(null);
    expect(idle.outcome).toBe('hit');
    expect(idle.damage).toBeGreaterThan(0);
    const answered = play(idle.target);
    expect(answered.target).toBe(idle.target);
    expect(['warded', 'perfect']).toContain(answered.outcome);
  });

  it('the Silent Conductor: its own closing attacks more often, never more than two damaging live', () => {
    const sim = tyrantSim(SCENARIO_CONDUCTOR);
    const w = worldOf(sim);
    const player = makeBot('skilled', SCENARIO_CONDUCTOR.seed);
    const seen = new Set<number>();
    const held: { phase: number; attack: string; live: number }[] = [];
    for (let t = 0; t < 60 * 120 && (bossOf(w)?.enemy?.phase ?? 1) < 3; t++) {
      sim.step(player.decide(sim.state));
      sim.drainEvents();
      const boss = bossOf(w);
      for (const tg of w.telegraphs) {
        if (seen.has(tg.id)) continue;
        seen.add(tg.id);
        if (tg.owner === boss?.id && tg.attackId === boss.enemy?.tyrant?.attack)
          held.push({ phase: boss.enemy.phase, attack: tg.attackId, live: damagingLive(w) });
      }
    }
    expect(held.filter((h) => h.phase === 1).map((h) => h.attack)).toContain(SFORZANDO);
    expect(held.filter((h) => h.phase === 2).map((h) => h.attack)).toContain(DOWNBEAT);
    expect(held.every((h) => h.attack === (h.phase === 1 ? SFORZANDO : DOWNBEAT))).toBe(true);
    expect(held.every((h) => h.live <= 2)).toBe(true);
    // Its cadences, one clock each (`TYRANT_OWN`), in the Overture and the Mirror Choir.
    expect(tyrantAttackOf(CONDUCTOR, 1)?.every).toBe(TYRANT_OWN.sforzando);
    expect(tyrantAttackOf(CONDUCTOR, 2)?.every).toBe(TYRANT_OWN.downbeat);
  }, 120_000);

  it('the Grand Silence as built, then the last burn on Tyrant’s cadences', () => {
    const s = SCENARIO_NOVICE_SILENCE;
    const run = (dissonance: { id: string; rank: number }[]) => {
      const sim = createSim({ seed: s.seed, ...s.config, dissonance });
      const w = worldOf(sim);
      const drive = s.driver();
      const program: string[] = [];
      let burn: { downbeat: number; sforzando: number } | null = null;
      let held = false;
      const seen = new Set<number>();
      for (let t = 0; t < s.ticks && !burn; t++) {
        sim.step(drive(t, sim.state));
        sim.drainEvents();
        for (const tg of w.telegraphs)
          if (!seen.has(tg.id) && w.field.finale?.silence) {
            seen.add(tg.id);
            program.push(tg.attackId);
          }
        if (w.field.finale?.silence && bossOf(w)?.enemy?.tyrant) held = true;
        const m4 = w.internal.m4;
        if (m4?.nextDownbeatAt !== undefined && !w.field.finale?.silence)
          burn = { downbeat: m4.nextDownbeatAt - w.time, sforzando: m4.nextSforzandoAt! - w.time };
      }
      return { program, burn, held };
    };
    const plain = run([]);
    const tyrant = run(TYRANT);
    // The silence's program is the same attacks in the same order (none of them borrowed).
    expect(tyrant.program.filter((id) => id !== GRAND_SILENCE)).toEqual(
      plain.program.filter((id) => id !== GRAND_SILENCE),
    );
    expect(tyrant.program).not.toContain(DOWNBEAT);
    expect(tyrant.held).toBe(false);
    expect(plain.burn).toEqual({ downbeat: BURN_EVERY.downbeat, sforzando: BURN_EVERY.sforzando });
    expect(tyrant.burn!.downbeat).toBeCloseTo(TYRANT_BURN.downbeat, 6);
    expect(tyrant.burn!.sforzando).toBeCloseTo(TYRANT_BURN.sforzando, 6);
  }, 120_000);

  it('a Tyrant fight runs twice to the same hash and round-trips as a fight replay', () => {
    const s: Scenario = {
      ...SCENARIO_BELLWARDEN,
      name: 'tyrant-bellwarden',
      config: { ...SCENARIO_BELLWARDEN.config, dissonance: TYRANT },
    };
    const a = runScenario(s);
    const b = runScenario(s);
    expect(b.hash).toBe(a.hash);
    expect(a.hash).not.toBe(golden.scenarios['skilled-bellwarden']);
    const result = runReplay(parseReplay(JSON.parse(JSON.stringify(a.replay))));
    expect(result.hash).toBe(a.hash);
    expect(result.matches).toBe(true);
  }, 120_000);
});
