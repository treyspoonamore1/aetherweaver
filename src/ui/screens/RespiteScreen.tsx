import { useEffect, useState, type ReactNode } from 'react';
import { useRun } from '../../app/runStore';
import { auraDef, motifDef } from '../../content';
import { EVERYTHING, type Allowance, type Unlock } from '../../meta/profile';
import type { ChordLoadout, RunState } from '../../meta/types';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Icon, type IconName } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Panel } from '../kit/Panel';
import { playUi, useMood } from '../kit/sound';
import { ChordBuilder } from './ChordBuilder';
import { sameLoadout } from './chordModel';
import { FreshStrip, useAllowance, useChordDraft, useFreshUnlocks } from './PrepScreen';
import {
  carriedPassives,
  fieldAuraSlots as runFieldAuraSlots,
  reserveMult as runReserveMult,
  reservePool,
} from '../../meta/run';
import { slotBonus } from './callingText';
import { PartyHealth, SectionTitle } from './shared';

const REST_HEAL = 0.4;

export interface RespiteViewProps {
  run: RunState;
  onChoose(choice: 'rest' | 'meditate'): void;
  /** Retune instead of resting: new Chords, then travel on. */
  onRetune(chords: ChordLoadout[]): void;
  /** Open straight into the Retune builder (UI lab). */
  initialRetune?: boolean;
  /** What the player's Rank opens (default: everything). */
  allowance?: Allowance;
  /** Unlocks to mark "New" in the builder. */
  fresh?: readonly Unlock[];
}

export function RespiteView({
  run,
  onChoose,
  onRetune,
  initialRetune = false,
  allowance = EVERYTHING,
  fresh = [],
}: RespiteViewProps) {
  useMood('map');
  const [retuning, setRetuning] = useState(initialRetune);
  const upgradable = run.motifs.filter((m) => m.level < motifDef(m.id).values.length).length;
  const shaken = run.party.filter((h) => h.shaken).length;
  useEffect(() => {
    if (retuning) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '1') {
        playUi('confirm');
        onChoose('rest');
      } else if (e.key === '2') {
        playUi('confirm');
        onChoose('meditate');
      } else if (e.key === '3') {
        playUi('click');
        setRetuning(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onChoose, retuning]);
  if (retuning) {
    return (
      <RetuneView
        run={run}
        onBack={() => setRetuning(false)}
        onRetune={onRetune}
        allowance={allowance}
        fresh={fresh}
      />
    );
  }
  const sung = run.chords.flatMap((c) => c.auras).map((id) => auraDef(id).name);
  return (
    <ScreenFrame tone="dusk">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <ScreenHeader eyebrow="A moment's quiet" title="Respite">
          <p className="mt-2 max-w-xl text-sm text-muted">
            The choir cannot reach this alcove. Take one: tend to your wounds, sit with the song, or
            retune your songs.
          </p>
        </ScreenHeader>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <Choice
            keyLabel="1"
            icon="moon"
            title="Rest"
            color="#86efac"
            lines={[
              `Every hero recovers ${Math.round(REST_HEAL * 100)}% of their life.`,
              shaken > 0
                ? `Steadies ${shaken} Shaken ${shaken === 1 ? 'hero' : 'heroes'} (their life is back to full size).`
                : 'No one is Shaken right now.',
            ]}
            onClick={() => onChoose('rest')}
          />
          <Choice
            keyLabel="2"
            icon="note"
            title="Meditate"
            color="#c4b5fd"
            lines={[
              upgradable > 0
                ? `Choose one of your ${upgradable} motifs to strengthen.`
                : 'You have nothing to strengthen yet, so you will be offered new motifs.',
              'No healing, and the Shaken stay Shaken.',
            ]}
            onClick={() => onChoose('meditate')}
          />
          <Choice
            keyLabel="3"
            icon="tune"
            title="Retune"
            color="#fcd98a"
            lines={[
              `Rebuild your songs: auras, ornaments, presets. Now singing ${sung.length ? sung.join(', ') : 'nothing'}.`,
              'No healing and no motif.',
            ]}
            onClick={() => setRetuning(true)}
          />
        </div>
        <Panel tone="solid" className="mx-auto mt-8 max-w-2xl p-5">
          <SectionTitle>Your party</SectionTitle>
          <div className="flex flex-col gap-4">
            {run.party.map((h) => (
              <PartyHealth key={h.heroId} hero={h} preview={REST_HEAL} />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            The hatched part of each bar is what Rest would restore.
          </p>
        </Panel>
      </div>
    </ScreenFrame>
  );
}

function Choice({
  keyLabel,
  icon,
  title,
  color,
  lines,
  onClick,
}: {
  keyLabel: string;
  icon: IconName;
  title: string;
  color: string;
  lines: string[];
  onClick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="anim-rise group flex flex-col items-start rounded-2xl border-2 bg-ink-800/90 p-6 text-left shadow-xl shadow-black/40 transition-all hover:-translate-y-1 hover:bg-ink-700/90"
      style={{ borderColor: color }}
    >
      <div className="flex w-full items-center justify-between">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full border-2"
          style={{ borderColor: color, color }}
        >
          <Icon name={icon} size={30} />
        </span>
        <KeyCap label={keyLabel} />
      </div>
      <h2 className="mt-4 font-display text-3xl font-bold" style={{ color }}>
        {title}
      </h2>
      <ul className="mt-3 flex flex-col gap-2 text-base leading-relaxed text-text">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </button>
  );
}

/** What the Retune view says around the builder (Respite, a forge, the Tuning Pool). */
export interface RetuneCopy {
  eyebrow: string;
  title: string;
  blurb: string;
  back: string;
  confirm: string;
  /** Shown next to the confirm button (e.g. the price). */
  note?: ReactNode;
}

const RESPITE_RETUNE: RetuneCopy = {
  eyebrow: 'Respite · Retune',
  title: 'Retune your songs',
  blurb:
    'Retuning takes the whole respite: no healing and no motif. Your motifs stay; only the songs change.',
  back: 'Rest or meditate instead',
  confirm: 'Retune and travel on',
};

/** The Chord builder as a screen, confirmed with `onRetune` (Respite, forge, Tuning Pool). */
export function RetuneView({
  run,
  onBack,
  onRetune,
  allowance,
  fresh,
  copy = RESPITE_RETUNE,
  tone = 'dusk',
  extra,
  confirmVariant = 'primary',
}: {
  /** The run as the songs will be sung: its Calling's path decides the field song's slots. */
  run: RunState;
  onBack(): void;
  onRetune(chords: ChordLoadout[]): void;
  allowance: Allowance;
  fresh: readonly Unlock[];
  copy?: RetuneCopy;
  tone?: 'navy' | 'gold' | 'dusk';
  /** Another way out, next to the confirm button (Third Voice's "Keep my songs"). */
  extra?: ReactNode;
  confirmVariant?: 'primary' | 'secondary';
}) {
  // Third Voice's third field aura: the run layer accepts it only with `Run.fieldAuraSlots`.
  const slots = runFieldAuraSlots(run);
  // The Martyr's songs reserve Life (at most 90%), and so do Sanguine Font's; the run's tree
  // makes them lighter (Phase 4). The run checks the same pool and share.
  const pool = reservePool(run);
  const lighter = runReserveMult(run);
  const [legalDraft, setLegalDraft] = useState<ChordLoadout[]>(run.chords);
  const { draft, change, legal } = useChordDraft(
    run.chords,
    allowance,
    setLegalDraft,
    slots,
    pool,
    lighter,
  );
  const [freshIds] = useState(() => new Set(fresh.map((u) => u.id)));
  const unchanged = sameLoadout(draft, run.chords);
  return (
    <ScreenFrame tone={tone}>
      <div className="mx-auto max-w-7xl px-6 pb-28 pt-8">
        <ScreenHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          right={
            <Button variant="ghost" onClick={onBack} sound="back">
              <Icon name="back" size={16} /> {copy.back}
            </Button>
          }
        >
          <p className="mt-2 max-w-2xl text-sm text-muted">{copy.blurb}</p>
        </ScreenHeader>
        <FreshStrip fresh={fresh} />
        <div className="mt-6">
          <ChordBuilder
            value={draft}
            onChange={change}
            allowance={allowance}
            fresh={freshIds}
            fieldAuraSlots={slots}
            bonus={slotBonus(run)}
            pool={pool}
            calling={run.calling}
            reserveMult={lighter}
            astrolabe={run.astrolabe}
            passives={carriedPassives(run)}
          />
        </div>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-end bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent px-6 pb-5 pt-10">
        <div className="pointer-events-auto flex items-center gap-4">
          <p className="text-sm text-muted" role="status">
            {!legal
              ? 'Fix your songs first'
              : unchanged
                ? 'Same songs as before'
                : 'Ready to sing the new songs'}
          </p>
          {copy.note}
          {extra}
          <Button
            variant={confirmVariant}
            size="lg"
            disabled={!legal || unchanged}
            onClick={() => onRetune(legalDraft)}
            sound="confirm"
          >
            {copy.confirm} <Icon name="arrow" size={18} />
          </Button>
        </div>
      </div>
    </ScreenFrame>
  );
}

export function RespiteScreen() {
  const run = useRun((s) => s.run);
  const respite = useRun((s) => s.respite);
  const retune = useRun((s) => s.retune);
  const allowance = useAllowance();
  const fresh = useFreshUnlocks();
  if (!run) return null;
  return (
    <RespiteView
      run={run}
      onChoose={respite}
      onRetune={retune}
      allowance={allowance}
      fresh={fresh}
    />
  );
}
