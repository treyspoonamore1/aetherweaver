import * as THREE from 'three';
import { heroDef } from '../content';
import type { SimEvent, WorldState } from '../sim';
import { ArenaView } from './arena';
import { EntityLayer } from './entities';
import { Feedback } from './feedback';
import { FieldView } from './field';
import { FxKit } from './fx/kit';
import { RING } from './fx/rings';
import { createModelMaterial, type ModelMaterial } from './models/material';
import { Overlay } from './overlay';
import { C } from './palette';
import type { QualityTier } from './stage';
import { TelegraphLayer } from './telegraphs';
import { ThreadView } from './thread';
import type { FrameInfo, RenderContext, WorldView } from './types';

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
  readonly feedback: Feedback;
  private quality: QualityTier;
  private readonly bufferSize = new THREE.Vector2();
  private readonly heroHex = new Map<number, string>();
  private disposed = false;

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
    this.thread = new ThreadView(this.entities);
    this.overlay = new Overlay(ctx.overlay, ctx.stage.camera);
    this.feedback = new Feedback({
      kit: this.kit,
      entities: this.entities,
      telegraphs: this.telegraphs,
      thread: this.thread,
      field: this.field,
      overlay: this.overlay,
      rig: ctx.rig,
      stage: ctx.stage,
    });
    this.quality = ctx.quality;
    this.setQuality(ctx.quality);
    void state;
  }

  sync(state: WorldState, frame: FrameInfo): void {
    if (this.disposed) return;
    const realDt = Math.min(0.1, Math.max(0, frame.realDt));
    // World FX slow down with the sim's hit-stop / slow-mo, but never freeze entirely.
    const fxDt = realDt * (0.3 + 0.7 * Math.min(1, state.timeScale));
    const camera = this.ctx.stage.camera;
    camera.updateMatrixWorld();

    this.kit.begin(frame.time, camera.position);
    this.overlay.beginFrame();
    this.entities.sync(state, frame, this.kit, fxDt);
    this.field.sync(state, this.kit, fxDt, frame.time);
    this.telegraphs.sync(state, this.kit, this.overlay, fxDt, true);
    this.thread.sync(state, this.kit, fxDt, frame.time);
    this.feedback.sync(state, frame, fxDt);
    this.offscreen(state);
    this.aimMarker(state, frame);

    this.ctx.stage.renderer.getDrawingBufferSize(this.bufferSize);
    const pointScale = this.bufferSize.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.arena.update(frame.time, pointScale, this.quality);
    this.kit.end(fxDt, this.overlay.width, this.overlay.height, this.bufferSize.y, camera.fov);
    this.overlay.setSlowmo(state.timeScale < 0.98 ? Math.min(0.8, (1 - state.timeScale) * 1.1) : 0);
    this.overlay.update(realDt);
  }

  onEvents(events: readonly SimEvent[], state: WorldState): void {
    if (this.disposed) return;
    this.feedback.handle(events, state);
  }

  setQuality(quality: QualityTier): void {
    this.quality = quality;
    this.kit.setQuality(quality);
    this.entities.setShadows(quality !== 'low');
  }

  private offscreen(state: WorldState): void {
    for (const id of state.party) {
      const e = state.entities.get(id);
      const r = this.entities.recs.get(id);
      if (!e?.hero || !r || e.health?.dead) continue;
      let hex = this.heroHex.get(id);
      if (!hex) {
        hex = heroDef(e.hero.defId).color;
        this.heroHex.set(id, hex);
      }
      const danger = this.telegraphs.threatened.get(id) ?? 0;
      this.overlay.edgeArrow(r.x, r.height * 0.5, r.z, e.health?.downed ? '#94a3b8' : hex, danger);
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
