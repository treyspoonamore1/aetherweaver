import { useEffect } from 'react';
import { countHudCommit } from '../perfCounters';
import { useUi, type Callout, type HudSnapshot } from '../store';
import { BossBar } from './BossBar';
import { Callouts } from './Callouts';
import { CoachHints } from './CoachHints';
import { EncounterHeader } from './EncounterHeader';
import { KeyHints } from './KeyHints';
import { PartyFrames } from './PartyFrames';
import { WeaverBar } from './WeaverBar';

export interface HudProps {
  /** Small line above the encounter name (e.g. "The Prelude · node 3 of 7"). */
  subtitle?: string;
  /** Show the controls reminder. */
  keyHints?: boolean;
}

/**
 * Combat HUD v2 (docs/plan/04 §5). Connected wrapper: re-renders only when the runtime
 * commits a new 15 Hz snapshot (or a callout appears), never per frame.
 */
export function Hud({ subtitle, keyHints = true }: HudProps) {
  const hud = useUi((s) => s.hud);
  const callouts = useUi((s) => s.callouts);
  const decree = useUi((s) => s.lastDecree);
  const devOpen = useUi((s) => s.devOpen);
  useEffect(() => {
    countHudCommit();
  });
  if (!hud) return null;
  return (
    <HudView
      hud={hud}
      callouts={callouts}
      decree={decree}
      subtitle={subtitle}
      keyHints={keyHints && !devOpen}
    />
  );
}

/** The presentational HUD: everything comes in as props, so the UI lab can mock it. */
export function HudView({
  hud,
  callouts,
  decree,
  subtitle,
  keyHints = true,
  coach = true,
  forceCoach = false,
}: {
  hud: HudSnapshot;
  callouts: Callout[];
  decree: { name: string; text: string } | null;
  subtitle?: string;
  keyHints?: boolean;
  coach?: boolean;
  forceCoach?: boolean;
}) {
  const barks = callouts.filter((c) => c.kind === 'bark');
  const sandbox = hud.encounter.kind === 'sandbox';
  const clockText = `${hud.seconds.toFixed(1)} s · tick ${hud.tick} · seed ${hud.seed}${hud.directive ? ` · ${hud.directive}` : ''}`;
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="hud">
      <EncounterHeader encounter={hud.encounter} subtitle={subtitle} clockText={clockText} />
      {hud.boss && (
        <BossBar
          boss={hud.boss}
          decree={decree}
          decreeBanner={callouts.some((c) => c.kind === 'decree')}
        />
      )}
      <Callouts callouts={callouts} barkSpeakers={hud.party.map((p) => p.name)} />
      <PartyFrames party={hud.party} threadMode={hud.weaver.threadMode} barks={barks} />
      <WeaverBar hud={hud} />
      {coach && !sandbox && <CoachHints hud={hud} force={forceCoach} />}
      {keyHints && <KeyHints />}
    </div>
  );
}
