import * as THREE from 'three';
import { heroDef } from '../content';
import { fallingFast, type ReadonlyEntity, type SimEvent, type WorldState } from '../sim';
import { ArenaView } from './arena';
import { AstrolabeView } from './astrolabe';
import { BondsView } from './bonds';
import { CallView } from './calls';
import { PartyBarsView, vowCoversAll } from './partyBars';
import { healthLevel } from '../app/healthLevels';
import { signalHex } from './crimsonCues';
import { CallingView } from './calling';
import { ChronoView } from './chrono';
import { ConductView } from './conduct';
import { crucibleSky, emptySky } from './crucibleCues';
import { DissonanceView } from './dissonance';
import { EntityLayer } from './entities';
import { FermataView } from './fermata';
import { Feedback } from './feedback';
import { FieldView } from './field';
import { FillView } from './fill';
import { FxKit } from './fx/kit';
import { GroveDiscView } from './groveDisc';
import { beyondReach } from './serenCues';
import { OWN_LOOK } from './keepsakeCues';
import { MartyrView } from './martyr';
import { PostludeView } from './postlude';
import { postludeOf, postludeSky } from './postludeCues';
import { RING } from './fx/rings';
import { createModelMaterial, type ModelMaterial } from './models/material';
import { Overlay } from './overlay';
import { C, applyVision } from './palette';
import { RelicView } from './relics';
import type { QualityTier } from './stage';
import { TelegraphLayer } from './telegraphs';
import { ThreadView } from './thread';
import { TyrantView } from './tyrant';
import type { FrameInfo, RenderContext, WorldView } from './types';
import { VariantsView } from './variants';

/**
 * The Phase 1 combat view (docs/plan/05 §5). Persistent visuals are derived from `WorldState`
 * every frame; transient feedback comes from events. Everything is drawn through a handful of
 * instanced / immediate-mode batches so a busy fight stays well inside the draw-call budget.
 */
export class CombatView implements WorldView {
  private readonly root = new THREE.Group();
  private readonly model: ModelMaterial;
  private readonly arena: ArenaView;
  readonly entities: EntityLayer;
  readonly kit: FxKit;
  readonly field: FieldView;
  readonly telegraphs: TelegraphLayer;
  readonly thread: ThreadView;
  readonly overlay: Overlay;
  readonly calls: CallView;
  /** The bars over the heroes (docs/health-ui.md). */
  readonly partyBars: PartyBarsView;
  readonly fermata: FermataView;
  readonly feedback: Feedback;
  readonly relics: RelicView;
  readonly calling: CallingView;
  readonly martyr: MartyrView;
  readonly chrono: ChronoView;
  /** The Conductor (docs/phase-5f.md): Duets and Trios, the downbeat, the Grand Finale. */
  readonly conduct: ConductView;
  readonly astrolabe: AstrolabeView;
  readonly dissonance: DissonanceView;
  readonly bonds: BondsView;
  readonly variants: VariantsView;
  /** The Cued Ancient's disc (docs/phase-5e.md, Q2): its own decal, made on the first disc. */
  readonly groveDisc: GroveDiscView;
  /** The content fill (docs/phase-5g.md): Razor Silk, Thread the Needle, trigger fires. */
  readonly fill: FillView;
  /** Phase 6 (docs/phase-6.md): Tyrant's borrowed accent and crown, the Postlude's rise and pairs. */
  readonly tyrant: TyrantView;
  readonly postlude: PostludeView;
  private quality: QualityTier;
  /** The enemies' clock for the telegraph shaders: it waits while Stasis holds them. */
  private enemyClock = 0;
  private readonly bufferSize = new THREE.Vector2();
  private readonly heroHex = new Map<number, string>();
  private disposed = false;
  /** The Crucible's sky orrery inputs (reused; read only on its floor). */
  private readonly sky = emptySky();

  constructor(
    private readonly ctx: RenderContext,
    state: WorldState,
  ) {
    this.root.name = 'combat-view';
    ctx.stage.scene.add(this.root);
    this.model = createModelMaterial();
    this.arena = new ArenaView(ctx.arena, ctx.stage, this.model);
    this.root.add(this.arena.group);
    this.entities = new EntityLayer(this.model);
    this.root.add(this.entities.group);
    this.kit = new FxKit();
    this.root.add(this.kit.group);
    this.field = new FieldView(this.entities);
    this.root.add(this.field.mesh);
    this.telegraphs = new TelegraphLayer(this.entities);
    this.overlay = new Overlay(ctx.overlay, ctx.stage.camera);
    this.thread = new ThreadView(this.entities, this.overlay);
    this.calls = new CallView(this.entities);
    this.partyBars = new PartyBarsView(this.entities);
    this.fermata = new FermataView(this.entities);
    this.feedback = new Feedback({
      calls: this.calls,
      fermata: this.fermata,
      kit: this.kit,
      entities: this.entities,
      telegraphs: this.telegraphs,
      thread: this.thread,
      field: this.field,
      overlay: this.overlay,
      rig: ctx.rig,
      stage: ctx.stage,
    });
    this.relics = new RelicView({
      kit: this.kit,
      recs: this.entities.recs,
      overlay: this.overlay,
      rig: ctx.rig,
    });
    this.calling = new CallingView({
      kit: this.kit,
      recs: this.entities.recs,
      overlay: this.overlay,
    });
    this.martyr = new MartyrView({
      kit: this.kit,
      recs: this.entities.recs,
      thread: this.thread,
      entities: this.entities,
      overlay: this.overlay,
    });
    this.chrono = new ChronoView({
      kit: this.kit,
      recs: this.entities.recs,
      entities: this.entities,
      telegraphs: this.telegraphs,
      overlay: this.overlay,
    });
    this.conduct = new ConductView({ kit: this.kit, recs: this.entities.recs });
    this.astrolabe = new AstrolabeView({
      kit: this.kit,
      recs: this.entities.recs,
      entities: this.entities,
    });
    this.dissonance = new DissonanceView({ kit: this.kit, recs: this.entities.recs });
    this.bonds = new BondsView({
      kit: this.kit,
      recs: this.entities.recs,
      overlay: this.overlay,
      rig: ctx.rig,
    });
    this.variants = new VariantsView({
      kit: this.kit,
      recs: this.entities.recs,
      overlay: this.overlay,
      rig: ctx.rig,
      models: this.entities,
    });
    this.groveDisc = new GroveDiscView(this.root);
    this.fill = new FillView({
      kit: this.kit,
      recs: this.entities.recs,
      thread: this.thread,
      overlay: this.overlay,
    });
    this.tyrant = new TyrantView({ kit: this.kit, recs: this.entities.recs });
    this.postlude = new PostludeView({
      kit: this.kit,
      recs: this.entities.recs,
      finale: (s) => this.feedback.crucible.finale(s),
    });
    this.quality = ctx.quality;
    this.setQuality(ctx.quality);
    void state;
  }

  sync(state: WorldState, frame: FrameInfo): void {
    if (this.disposed) return;
    const realDt = Math.min(0.1, Math.max(0, frame.realDt));
    // World FX slow down with the sim's hit-stop / slow-mo, but never freeze entirely.
    // Seren's kill shot (docs/phase-5e.md) holds them a moment more (1 in every other party).
    const fxDt =
      realDt * (0.3 + 0.7 * Math.min(1, state.timeScale)) * this.feedback.seren.hitStop(realDt);
    const camera = this.ctx.stage.camera;
    camera.updateMatrixWorld();

    // Accessibility settings, live: colour-vision palette and full-screen flash strength.
    if (applyVision(frame.settings.colorVision)) this.overlay.setPalette();
    this.overlay.setFlashScale(frame.settings.flashes);
    // What the Weaver wears (Phase 4g), live too: her robe, her Thread's look.
    const look = frame.look ?? OWN_LOOK;
    this.entities.setLook(look);
    this.thread.setLook(look.thread);

    // The telegraphs' shader clock is the enemies': Stasis holds it (docs/phase-3e/vfx.md).
    if (!state.field.stasis) this.enemyClock += realDt;
    this.kit.begin(frame.time, camera.position, this.enemyClock);
    this.overlay.beginFrame();
    this.entities.sync(state, frame, this.kit, fxDt);
    this.field.sync(state, this.kit, fxDt, frame.time);
    this.groveDisc.sync(state, frame.time);
    this.telegraphs.sync(state, this.kit, this.overlay, fxDt, true);
    this.thread.sync(state, this.kit, fxDt, frame.time);
    this.calls.sync(state, this.kit, this.overlay, fxDt);
    this.partyBars.sync(
      state,
      this.overlay,
      fxDt,
      frame.time,
      frame.settings.allyBars,
      frame.settings.slotKeys,
    );
    this.fermata.sync(state, this.kit, this.overlay, fxDt, frame.time);
    this.feedback.sunWarmth = this.calling.warmth;
    this.feedback.stasisCool = this.chrono.cool;
    this.feedback.sync(state, frame, fxDt);
    this.relics.sync(state, fxDt, frame.time, frame.settings.flashes);
    this.calling.sync(state, fxDt, frame.time, frame.settings.flashes);
    this.martyr.sync(state, fxDt, frame.time, frame.settings.flashes);
    this.chrono.sync(state, fxDt, frame.time, frame.settings.flashes, frame.settings.damageNumbers);
    this.conduct.sync(state, fxDt, frame.time, frame.settings.flashes);
    this.astrolabe.sync(state, fxDt, frame.time, frame.settings.flashes);
    this.dissonance.sync(state, fxDt, frame.time, frame.settings.flashes);
    this.bonds.sync(state, fxDt, frame.time, frame.settings.flashes);
    this.variants.sync(state, fxDt, frame.time, frame.settings.flashes);
    this.fill.sync(state, fxDt, frame.time, frame.settings.flashes);
    this.tyrant.sync(state, fxDt, frame.time, frame.settings.flashes);
    this.postlude.sync(state, fxDt, frame.time, frame.settings.flashes);
    this.overlay.setStasis(this.chrono.cool);
    this.offscreen(state);
    this.aimMarker(state, frame);

    this.ctx.stage.renderer.getDrawingBufferSize(this.bufferSize);
    const pointScale = this.bufferSize.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    // The Celestial Crucible's sky orrery (the Finale): the music's beat and stems, or the sim's,
    // held at full a while after Reignite. Phase 6: the Postlude's rise darkens it and re-lights
    // it ring by ring (postludeSky leaves it as it is without one).
    const finale = this.arena.look === 'crucible' ? this.feedback.crucible.finale(state) : null;
    const sky =
      this.arena.look === 'crucible'
        ? postludeSky(
            postludeOf(finale),
            state.time,
            crucibleSky(
              finale,
              frame.music,
              state.time,
              this.sky,
              this.feedback.crucible.orreryFull,
            ),
          )
        : undefined;
    this.arena.update(frame.time, pointScale, this.quality, sky);
    this.kit.end(fxDt, this.overlay.width, this.overlay.height, this.bufferSize.y, camera.fov);
    this.overlay.setSlowmo(state.timeScale < 0.98 ? Math.min(0.8, (1 - state.timeScale) * 1.1) : 0);
    this.overlay.update(realDt);
  }

  onEvents(events: readonly SimEvent[], state: WorldState): void {
    if (this.disposed) return;
    this.feedback.handle(events, state);
    this.relics.handle(events, state);
    this.calling.handle(events, state);
    this.martyr.handle(events, state);
    this.chrono.handle(events, state);
    this.conduct.handle(events, state);
    this.astrolabe.handle(events, state);
    this.dissonance.handle(events, state);
    this.bonds.handle(events, state);
    this.variants.handle(events, state);
    this.fill.handle(events, state);
    this.tyrant.handle(events, state);
    this.postlude.handle(events, state);
  }

  /** The sky orrery's rings lit as last drawn (−1: following the stems, or not the Crucible). */
  orreryNotes(): number {
    return this.arena.look === 'crucible' ? this.sky.notes : -1;
  }

  setQuality(quality: QualityTier): void {
    this.quality = quality;
    this.kit.setQuality(quality);
    this.entities.setShadows(quality !== 'low');
  }

  private offscreen(state: WorldState): void {
    // The bars' lethal gate (partyBars.ts): under the Martyr's Vow no hit is lethal.
    const vow = vowCoversAll(state);
    for (const id of state.party) {
      const e = state.entities.get(id);
      const r = this.entities.recs.get(id);
      if (!e?.hero || !r || e.health?.dead) continue;
      let hex = this.heroHex.get(id);
      if (!hex) {
        // Brann's arrow is his brass: his crimson would read as the danger ring (crimsonCues.ts).
        hex = signalHex(e.hero.defId, heroDef(e.hero.defId).color);
        this.heroHex.set(id, hex);
      }
      // Off screen and under a quarter of their life (docs/health-ui.md): the arrow pulses red,
      // as it does for a threat, its dot still in their colour.
      const h = e.health;
      const danger = edgeDanger(e, this.telegraphs.threatened.get(id) ?? 0, vow);
      // Seren beyond your reach (docs/phase-5e.md): her arrow wears a dashed ring.
      const beyond = !!e.hero.duel && !h?.downed && beyondReach(state, e);
      this.overlay.edgeArrow(r.x, r.height * 0.5, r.z, h?.downed ? '#94a3b8' : hex, danger, beyond);
    }
  }

  private aimMarker(state: WorldState, frame: FrameInfo): void {
    const aim = frame.aim ?? state.entities.get(state.weaverId)?.weaver ?? null;
    if (!aim) return;
    const x = 'aimX' in aim ? aim.aimX : aim.x;
    const z = 'aimZ' in aim ? aim.aimZ : aim.z;
    this.kit.rings.push(x, 0.035, z, 0.32, 0.05, 0.06, RING.plain, C.gold, 0.55);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.feedback.dispose();
    this.groveDisc.dispose();
    this.telegraphs.dispose();
    this.field.dispose();
    this.kit.dispose();
    this.entities.dispose();
    this.arena.dispose();
    this.overlay.dispose();
    this.model.material.dispose();
    this.root.removeFromParent();
  }
}

/**
 * How loudly a hero's off-screen arrow warns (0: not at all): the telegraphs aimed at them, or
 * 0.8 while they are critical. Critical is the shared ramp's (under a quarter) for the default
 * heroes, exactly as before; for Brann (docs/phase-5b.md) it is his own: below 15%, falling fast,
 * or a lethal hit on its way, so an arrow never calls you back to a berserker kept low on purpose.
 * `vowCovers` is the bars' gate (partyBars.ts `vowCoversAll`): under the Martyr's Vow no hit on its
 * way is lethal, so neither his bar nor his arrow calls it one.
 */
export function edgeDanger(e: ReadonlyEntity, threatened: number, vowCovers = false): number {
  const h = e.health;
  let critical = false;
  if (h && !h.downed) {
    if (e.hero?.blood) {
      let shield = 0;
      for (const s of h.shields) shield += s.amount;
      const lethal = !vowCovers && h.incoming > 0 && h.incoming >= h.hp + shield;
      critical = healthLevel(h.hp, h.maxHp, e.hero.defId, fallingFast(e)) === 2 || lethal;
    } else critical = healthLevel(h.hp, h.maxHp) === 2;
  }
  return Math.max(threatened, critical ? 0.8 : 0);
}
