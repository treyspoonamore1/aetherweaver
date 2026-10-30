import { useEffect, useState } from 'react';
import { useProfile } from '../../app/profileStore';
import { useRun } from '../../app/runStore';
import { heroDef, sceneDef } from '../../content';
import { bondRank } from '../../meta/bonds';
import type { RunState } from '../../meta/types';
import { ScreenFrame } from '../kit/Backdrop';
import { BOND_LOOK, BOND_SOUNDS, heroInk } from '../kit/bondLook';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Panel } from '../kit/Panel';
import { useReducedMotion } from '../kit/motion';
import { playUi, useMood } from '../kit/sound';
import { BONDS_CSS, BondGlyph, HeroPortrait } from './BondsParts';
import { sceneXpLine } from './bondsModel';
import { SceneBody } from './SceneParts';

export interface SceneViewProps {
  run: RunState;
  /** The scene is over, with the reply chosen (0 or 1). */
  onEnd(reply: number): void;
  /** The hero's Bond rank (omitted: not shown). */
  rank?: number;
  /** UI lab: a reply already chosen. */
  initialReply?: number | null;
}

/**
 * A Bond scene at a Respite's fire (docs/phase-4e.md): the hero's portrait by the fire, the lines,
 * two replies (keys 1 and 2), the hero's answer, then Continue (Enter), which pays its Bond XP.
 * The lines rise in one after another, unless the player asked for less motion; a scene reads in
 * well under 20 seconds.
 */
export function SceneView({ run, onEnd, rank, initialReply = null }: SceneViewProps) {
  useMood('map');
  const reduced = useReducedMotion();
  const [reply, setReply] = useState<number | null>(initialReply);
  const scene = run.scene ? sceneDef(run.scene.sceneId) : null;
  const heroId = scene?.hero;
  useEffect(() => {
    if (heroId) playUi(BOND_SOUNDS.sceneOpen, { hero: heroId });
  }, [heroId]);
  useEffect(() => {
    if (!scene) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (reply === null && (e.key === '1' || e.key === '2')) {
        e.preventDefault();
        playUi(BOND_SOUNDS.reply, { hero: scene.hero });
        setReply(Number(e.key) - 1);
      } else if (reply !== null && e.key === 'Enter') {
        // Not the focused button's click as well: the scene ends once.
        e.preventDefault();
        playUi('confirm');
        onEnd(reply);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene, reply, onEnd]);
  if (!scene) return null;
  const hero = heroDef(scene.hero);
  return (
    <ScreenFrame tone="dusk">
      <style>{BONDS_CSS}</style>
      <div
        className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-8"
        data-testid="scene"
        data-scene={scene.id}
        data-reply={reply ?? ''}
      >
        <header className="flex items-center gap-5">
          <HeroPortrait heroId={scene.hero} size={92} rank={rank ?? null} lit />
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-muted">
              <Icon name="scene" size={14} style={{ color: BOND_LOOK.color }} /> Respite · by the
              fire
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-wide text-gold-300 sm:text-4xl">
              {scene.title}
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: heroInk(scene.hero) }}>
              {hero.name}, {hero.title}
            </p>
          </div>
        </header>
        <Panel tone="solid" className="mt-6 p-6">
          <SceneBody scene={scene} reply={reply} stagger={!reduced} />
        </Panel>
        <div className="mt-5 min-h-[3.5rem]" aria-live="polite">
          {reply === null ? (
            <div className="flex flex-col gap-2 sm:flex-row" role="group" aria-label="Your reply">
              {scene.replies.map((r, i) => (
                <Button
                  key={i}
                  variant="secondary"
                  size="lg"
                  className={`flex-1 justify-start text-left ${reduced ? '' : 'anim-fade'}`}
                  style={
                    reduced ? undefined : { animationDelay: `${200 + scene.lines.length * 140}ms` }
                  }
                  onClick={() => {
                    playUi(BOND_SOUNDS.reply, { hero: scene.hero });
                    setReply(i);
                  }}
                  sound={null}
                  autoFocus={i === 0}
                  data-testid={`scene-reply-${i + 1}`}
                >
                  <KeyCap label={String(i + 1)} />
                  <span className="font-normal">“{r.text}”</span>
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-4">
              <p
                className="flex items-center gap-1.5 font-mono text-sm font-semibold"
                style={{ color: BOND_LOOK.color }}
                data-testid="scene-xp"
              >
                <BondGlyph size={15} /> {sceneXpLine(scene)}
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => onEnd(reply)}
                sound="confirm"
                autoFocus
                data-testid="scene-continue"
              >
                Continue <KeyCap label="Enter" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}

export function SceneScreen() {
  const run = useRun((s) => s.run);
  const endScene = useRun((s) => s.endScene);
  const bonds = useProfile((s) => s.profile.bonds);
  if (!run) return null;
  const heroId = run.scene?.heroId;
  return (
    <SceneView
      run={run}
      onEnd={endScene}
      rank={heroId ? bondRank(bonds[heroId]?.xp ?? 0) : undefined}
    />
  );
}
