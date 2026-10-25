import { useEffect } from 'react';
import { getRuntime } from '../../app/runtimeRegistry';
import { enemyDef } from '../../content';
import type { WheelView } from '../../input/wheel';
import { countHudCommit } from '../perfCounters';
import { useUi, type Callout, type HudSnapshot } from '../store';
import { useRun } from '../../app/runStore';
import type { ActiveBoon } from '../../meta/types';
import { BossBar } from './BossBar';
import { RelicBar } from './RelicBar';
import { CallingChip } from './CallingChip';
import { Callouts } from './Callouts';
import { CoachHints } from './CoachHints';
import { DirectiveWheel, DirectiveWheelView } from './DirectiveWheel';
import { EncounterHeader } from './EncounterHeader';
import { KeyHints } from './KeyHints';
import { PartyFrames } from './PartyFrames';
import { WeaverBar } from './WeaverBar';

const NO_BOONS: readonly ActiveBoon[] = [];

export interface HudProps {
  /** Small line above the encounter name (e.g. "The Prelude · node 3 of 10"). */
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
  const boons = useRun((s) => s.run?.boons) ?? NO_BOONS;
  useEffect(() => {
    countHudCommit();
  });
  if (!hud) return null;
  return (
    <>
      <HudView
        hud={hud}
        callouts={callouts}
        decree={decree}
        subtitle={subtitle}
        keyHints={keyHints && !devOpen}
        boons={hud.encounter.kind === 'sandbox' ? NO_BOONS : boons}
      />
      <DirectiveWheel focusName={enemyName} />
    </>
  );
}

/** The live enemy's name, for the wheel's Focus spoke. */
function enemyName(id: number): string | null {
  const e = getRuntime()?.sim.state.entities.get(id);
  return e?.enemy ? enemyDef(e.enemy.defId).name : null;
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
  wheel = null,
  boons = [],
  relicFlash,
}: {
  hud: HudSnapshot;
  /** The run's boons and banes (none in the Training Grounds). */
  boons?: readonly ActiveBoon[];
  /** UI lab: relics drawn mid-flash. */
  relicFlash?: readonly string[];
  callouts: Callout[];
  decree: { name: string; text: string } | null;
  subtitle?: string;
  keyHints?: boolean;
  coach?: boolean;
  forceCoach?: boolean;
  /** A mocked open Directive wheel (UI lab); the live one is drawn by `Hud`. */
  wheel?: (WheelView & { focusName?: string | null }) | null;
}) {
  const barks = callouts.filter((c) => c.kind === 'bark' || c.kind === 'call');
  const sandbox = hud.encounter.kind === 'sandbox';
  const clockText = `${hud.seconds.toFixed(1)} s · tick ${hud.tick} · seed ${hud.seed}${hud.directive ? ` · ${hud.directive}` : ''}`;
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="hud">
      <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
        <EncounterHeader encounter={hud.encounter} subtitle={subtitle} clockText={clockText} />
        <RelicBar relics={hud.relics} boons={boons} seconds={hud.seconds} flash={relicFlash} />
        {hud.calling && <CallingChip calling={hud.calling} />}
      </div>
      {hud.boss && (
        <BossBar
          boss={hud.boss}
          decree={decree}
          decreeBanner={callouts.some((c) => c.kind === 'decree')}
        />
      )}
      <Callouts callouts={callouts} barkSpeakers={hud.party.map((p) => p.name)} />
      <PartyFrames
        party={hud.party}
        threadMode={hud.weaver.threadMode}
        barks={barks}
        chords={hud.weaver.chords}
        calling={hud.calling}
      />
      <WeaverBar hud={hud} />
      {coach && !sandbox && <CoachHints hud={hud} force={forceCoach} />}
      {keyHints && <KeyHints />}
      {wheel && <DirectiveWheelView wheel={wheel} focusName={wheel.focusName} fixed={false} />}
    </div>
  );
}
