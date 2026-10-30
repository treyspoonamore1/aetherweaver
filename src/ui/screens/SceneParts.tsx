import { heroDef, type SceneDef } from '../../content';
import { heroInk } from '../kit/bondLook';

/**
 * A Bond scene's words (docs/phase-4e.md): the lines (a hero's quoted, as their own words;
 * narration as prose), then, once a reply is chosen, the Weaver's reply and the hero's answer.
 * The scene screen plays it; the Bonds screen and the Codex read a seen one again.
 */
export function SceneBody({
  scene,
  reply,
  stagger = false,
  compact = false,
}: {
  scene: SceneDef;
  /** The reply chosen (0 or 1); null: not yet. */
  reply: number | null;
  /** The lines rise in one after another (the scene screen, motion allowed). */
  stagger?: boolean;
  /** Smaller type: the reader and the Codex. */
  compact?: boolean;
}) {
  const hero = heroDef(scene.hero);
  const ink = heroInk(scene.hero);
  const size = compact ? 'text-sm leading-relaxed' : 'text-base leading-relaxed sm:text-lg';
  const chosen = reply === null ? null : (scene.replies[reply] ?? null);
  const rise = stagger ? 'anim-rise' : '';
  const delay = (i: number) => (stagger ? `${120 + i * 140}ms` : undefined);
  return (
    <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'}`} data-testid="scene-body">
      {scene.lines.map((line, i) =>
        line.speaker === 'hero' ? (
          <p
            key={i}
            className={`${rise} border-l-2 pl-3 ${size} text-text`}
            style={{ animationDelay: delay(i), borderColor: hero.color }}
            data-speaker="hero"
          >
            <span
              className="mr-2 font-display text-sm font-bold tracking-wide"
              style={{ color: ink }}
            >
              {hero.name}
            </span>
            “{line.text}”
          </p>
        ) : (
          <p
            key={i}
            className={`${rise} ${size} italic text-muted`}
            style={{ animationDelay: delay(i) }}
            data-speaker="narration"
          >
            {line.text}
          </p>
        ),
      )}
      {chosen && (
        <>
          <p
            className={`anim-fade border-l-2 border-gold-400 pl-3 ${size} text-text`}
            data-speaker="weaver"
            data-testid="scene-reply"
          >
            <span className="mr-2 font-display text-sm font-bold tracking-wide text-gold-300">
              You
            </span>
            “{chosen.text}”
          </p>
          <p
            className={`anim-fade ${size} text-text`}
            style={{ animationDelay: stagger ? '220ms' : undefined }}
            data-testid="scene-response"
          >
            {chosen.response}
          </p>
        </>
      )}
    </div>
  );
}
