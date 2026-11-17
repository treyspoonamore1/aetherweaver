/**
 * Hands the camera who to keep in view in a boss fight (docs/phase-8.md, 8c): the Weaver, the
 * heroes, and the boss or miniboss, with the part of the screen the HUD leaves free. Fights with
 * no boss or miniboss get none of this: their camera is the plain follow camera, as it always was.
 *
 * Read-only on the sim: it looks at where figures stand and never queues a command, so replays,
 * recorded inputs and the sim's hash cannot move.
 */
import { encounterDef, enemyDef } from '../content';
import type { CameraRig, FightFrame } from '../render/camera';
import type { FrameSubject, SafeArea } from '../render/framing';
import { HERO_DRAWN } from '../render/models/artFlag';
import type { ReadonlyEntity, WorldState } from '../sim';
import { bossBarTop, measureHud, safeAreaFrom } from './hudSafeArea';

/** How often the HUD's panels are measured (ms). */
const MEASURE_MS = 250;
/**
 * The boss bar grows and shrinks with every cast. The safe area's top follows it down at once and
 * back up only after this long (ms), so the camera does not nod with each cast.
 */
const TOP_HOLD_MS = 6000;
/** The director's own rule for where a boss arrives: this share of the arena's radius out. */
const BOSS_SPAWN_RADIUS = 0.35;

/**
 * The safe area a fight opens with, before its HUD has been drawn and measured: the last fight's,
 * or the default layout's at 1280 × 720.
 */
let lastSafe: SafeArea = {
  top: 0.2,
  bottom: 0.73,
  left: 0.02,
  right: 0.98,
  bottomLeft: { x: 0.26, y: 0.48 },
};

const isBoss = (defId: string): boolean => {
  const role = enemyDef(defId).role;
  return role === 'boss' || role === 'miniboss';
};

/** Whether the encounter brings a boss or a miniboss, and the first one it brings. */
export function bossOf(encounterId: string): string | null {
  for (const wave of encounterDef(encounterId).waves)
    for (const spawn of wave.spawns) if (isBoss(spawn.enemy)) return spawn.enemy;
  return null;
}

function place(out: FrameSubject, e: ReadonlyEntity, alpha: number, drawn: number): FrameSubject {
  out.x = e.px + (e.x - e.px) * alpha;
  out.z = e.pz + (e.z - e.pz) * alpha;
  out.radius = e.radius * drawn;
  out.height = e.height * drawn;
  return out;
}

const subject = (): FrameSubject => ({ x: 0, z: 0, radius: 0, height: 0 });

export class FightFraming {
  private readonly weaver = subject();
  private readonly heroPool: FrameSubject[] = [];
  private readonly bossPool: FrameSubject[] = [];
  private readonly heroes: FrameSubject[] = [];
  private readonly bosses: FrameSubject[] = [];
  private readonly fight: FightFrame = {
    weaver: this.weaver,
    heroes: this.heroes,
    bosses: this.bosses,
  };
  /** Where the boss will arrive, until one has (the director's rule; null once it has). */
  private toCome: FrameSubject | null;
  private safe: SafeArea = lastSafe;
  private sinceMeasure = MEASURE_MS;
  private measured = false;
  /** The boss bar has been on screen in this fight. */
  private barSeen = false;
  private heldTop = 0;
  private heldFor = 0;

  private constructor(
    private readonly rig: CameraRig,
    private readonly canvas: HTMLCanvasElement,
    bossId: string,
    state: WorldState,
  ) {
    const def = enemyDef(bossId);
    const w = state.entities.get(state.weaverId);
    const wx = w?.x ?? 0;
    const wz = w?.z ?? 0;
    const wl = Math.hypot(wx, wz);
    const r = state.arenaRadius * BOSS_SPAWN_RADIUS;
    this.toCome = {
      x: wl > 0.5 ? (-wx / wl) * r : 0,
      z: wl > 0.5 ? (-wz / wl) * r : -r,
      radius: def.radius,
      height: def.height,
    };
  }

  /** The framing for this fight, or null when it brings no boss or miniboss. */
  static for(
    rig: CameraRig,
    canvas: HTMLCanvasElement,
    encounterId: string,
    state: WorldState,
  ): FightFraming | null {
    const boss = bossOf(encounterId);
    return boss ? new FightFraming(rig, canvas, boss, state) : null;
  }

  /** The safe area the camera is framing in now (tools: `__AW__.framing()`). */
  get safeArea(): Readonly<SafeArea> {
    return this.safe;
  }

  /** Call once a frame, before the camera's own update. `elapsedMs` is real time. */
  update(state: WorldState, alpha: number, elapsedMs: number): void {
    this.sinceMeasure += elapsedMs;
    this.heldFor += elapsedMs;
    if (this.sinceMeasure >= MEASURE_MS) {
      this.sinceMeasure = 0;
      this.measure();
    }
    const weaver = state.entities.get(state.weaverId);
    if (!weaver) {
      this.rig.frame(null);
      return;
    }
    place(this.weaver, weaver, alpha, HERO_DRAWN);
    this.heroes.length = 0;
    for (const id of state.party) {
      const e = state.entities.get(id);
      if (!e?.hero || e.health?.dead) continue;
      const out = (this.heroPool[this.heroes.length] ??= subject());
      this.heroes.push(place(out, e, alpha, HERO_DRAWN));
    }
    this.bosses.length = 0;
    for (const e of state.entities.list()) {
      if (!e.enemy || e.health?.dead || !isBoss(e.enemy.defId)) continue;
      const out = (this.bossPool[this.bosses.length] ??= subject());
      this.bosses.push(place(out, e, alpha, 1));
    }
    if (this.bosses.length > 0) this.toCome = null;
    else if (this.toCome) this.bosses.push(this.toCome);
    this.rig.frame(this.fight, this.safe);
  }

  private measure(): void {
    if (typeof document === 'undefined') return;
    const r = this.canvas.getBoundingClientRect();
    const panels = measureHud(document, r);
    // Nothing of the HUD drawn yet: keep what the fight opened with.
    if (!panels.weaverBar && !panels.partyFrames) return;
    const safe = safeAreaFrom(panels);
    // The boss bar arrives with the boss: until it has, leave it the room it will take.
    if (!panels.bossBar && !this.barSeen) safe.top = Math.max(safe.top, bossBarTop(r.height));
    else this.barSeen = true;
    if (safe.top >= this.heldTop - 0.002 || this.heldFor > TOP_HOLD_MS) {
      this.heldTop = safe.top;
      this.heldFor = 0;
    } else safe.top = this.heldTop;
    this.safe = safe;
    lastSafe = safe;
    if (!this.measured) {
      // The first real measure: the opening framing is taken again at once, not eased to.
      this.measured = true;
      this.rig.settleFraming();
    }
  }
}
