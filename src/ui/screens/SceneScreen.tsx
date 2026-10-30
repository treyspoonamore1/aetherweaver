import { useState } from 'react';
import { useRun } from '../../app/runStore';
import { heroDef, sceneDef } from '../../content';
import type { RunState } from '../../meta/types';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Panel } from '../kit/Panel';
import { useMood } from '../kit/sound';

export interface SceneViewProps {
  run: RunState;
  /** The scene is over, with the reply chosen (0 or 1). */
  onEnd(reply: number): void;
}

/** A Bond scene at a Respite's fire (docs/phase-4e.md): its lines, a reply, the answer. */
export function SceneView({ run, onEnd }: SceneViewProps) {
  useMood('map');
  const [reply, setReply] = useState<number | null>(null);
  if (!run.scene) return null;
  const scene = sceneDef(run.scene.sceneId);
  const hero = heroDef(scene.hero);
  return (
    <ScreenFrame tone="dusk">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <ScreenHeader eyebrow={`A moment with ${hero.name}`} title={scene.title} />
        <Panel tone="solid" className="mt-8 flex flex-col gap-3 p-6" data-testid="scene">
          {scene.lines.map((line, i) =>
            line.speaker === 'hero' ? (
              <p key={i} className="text-text">
                <span className="font-semibold" style={{ color: hero.color }}>
                  {hero.name}:
                </span>{' '}
                “{line.text}”
              </p>
            ) : (
              <p key={i} className="italic text-muted">
                {line.text}
              </p>
            ),
          )}
          {reply !== null && <p className="text-text">{scene.replies[reply]!.response}</p>}
        </Panel>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {reply === null ? (
            scene.replies.map((r, i) => (
              <Button
                key={i}
                variant={i === 0 ? 'primary' : 'secondary'}
                onClick={() => setReply(i)}
              >
                “{r.text}”
              </Button>
            ))
          ) : (
            <Button variant="primary" onClick={() => onEnd(reply)}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}

export function SceneScreen() {
  const run = useRun((s) => s.run);
  const endScene = useRun((s) => s.endScene);
  if (!run) return null;
  return <SceneView run={run} onEnd={endScene} />;
}
