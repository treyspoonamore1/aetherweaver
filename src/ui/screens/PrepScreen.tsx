import { useEffect, useMemo, useRef, useState } from 'react';
import { useProfile } from '../../app/profileStore';
import { useRun } from '../../app/runStore';
import { useSettings } from '../../app/settings';
import { CONTENT } from '../../content';
import { EVERYTHING, allowanceFor, rankOf, type Allowance, type Unlock } from '../../meta/profile';
import type { ChordLoadout, RunState } from '../../meta/types';
import { canonicalChords, type ReservePool } from '../../sim';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Chip } from '../kit/Chip';
import { Icon } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { Segmented, Toggle } from '../kit/Slider';
import { useMood } from '../kit/sound';
import { useUi } from '../store';
import { HeroDisc, SectionTitle } from './shared';
import { ROLE_LABEL } from '../hud/labels';
import { ChordBuilder, NewTag, SONG_LOOK } from './ChordBuilder';
import { freshUnlocks, loadoutProblems, mult, padChords } from './chordModel';
import { CallingPicker } from './CallingPicker';
import { fieldAuraSlots as runFieldAuraSlots, reservePool } from '../../meta/run';
import { slotBonus } from './callingText';

export interface PrepViewProps {
  run: RunState;
  /** Called with every legal loadout the builder reaches (canonical form). */
  onChords(chords: ChordLoadout[]): void;
  onEmbark(): void;
  onBack(): void;
  /** Choose the run's Calling (null: none). Omitted: no Calling picker (the UI lab's old views). */
  onCalling?(id: string | null): void;
  /** UI lab: open a Calling's path dialog. */
  openCallingPath?: string;
  /** What the player's Rank opens (default: everything). */
  allowance?: Allowance;
  /** Unlocks to introduce and mark "New" this visit. */
  fresh?: readonly Unlock[];
  /** The player's Weaver Rank, for the header (omitted: no Rank shown). */
  rank?: number;
}

/**
 * The Chord draft while editing: may be illegal for a moment, in which case the run keeps
 * its last legal Chords and Embark waits. `pool` is what the songs reserve
 * (`Run.reservePool(run)`); in Prep it follows the Calling chosen there, so when it changes
 * and the draft is legal under the new pool, the run is given the draft again (the Martyr's
 * Life holds at most 90%: a draft that only Spirit allowed waits while she's chosen).
 */
export function useChordDraft(
  initial: readonly ChordLoadout[],
  allowance: Allowance,
  onLegal?: (c: ChordLoadout[]) => void,
  /** The field song's aura slots (`Run.fieldAuraSlots(run)`; Third Voice adds one). */
  fieldAuraSlots: number = CONTENT.weaver.auraSlots,
  pool: ReservePool = 'spirit',
) {
  const [draft, setDraft] = useState(() => padChords(initial));
  const problems = loadoutProblems(draft, allowance, fieldAuraSlots, pool);
  const legal = problems.length === 0;
  const change = (next: ChordLoadout[]) => {
    setDraft(next);
    if (loadoutProblems(next, allowance, fieldAuraSlots, pool).length === 0)
      onLegal?.(canonicalChords(next));
  };
  const [lastPool, setLastPool] = useState(pool);
  const pending = useRef<ChordLoadout[] | null>(null);
  if (pool !== lastPool) {
    // Adjusting state on a change of prop (React's documented pattern); the run hears in an effect.
    setLastPool(pool);
    pending.current = legal ? canonicalChords(draft) : null;
  }
  useEffect(() => {
    if (!pending.current) return;
    const chords = pending.current;
    pending.current = null;
    onLegal?.(chords);
  });
  return { draft, change, legal };
}

/** What Prep and Retune may use, following the profile and Settings → Skip the unlocks. */
export function useAllowance(): Allowance {
  const xp = useProfile((s) => s.profile.xp);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  return useMemo(() => (unlockAll ? EVERYTHING : allowanceFor(rankOf(xp))), [xp, unlockAll]);
}

/**
 * The unlocks to mark "New" on this visit to the builder: read once when it opens, then
 * marked introduced, so the badges stay up while the player looks and are gone next time.
 */
export function useFreshUnlocks(): Unlock[] {
  const [fresh] = useState(() => {
    const p = useProfile.getState().profile;
    return freshUnlocks(p.xp, p.introduced);
  });
  useEffect(() => {
    if (fresh.length > 0) useProfile.getState().markIntroduced(fresh.map((u) => u.id));
  }, [fresh]);
  return fresh;
}

/** "New since last time": each unlock the player hasn't met yet, with its sentence. */
export function FreshStrip({ fresh }: { fresh: readonly Unlock[] }) {
  if (fresh.length === 0) return null;
  return (
    <Panel tone="gold" className="anim-rise mt-5 p-4" aria-label="Newly unlocked">
      <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-gold-300">
        <Icon name="sparkle" size={15} /> Newly unlocked
      </p>
      <ul className="mt-2 grid gap-x-6 gap-y-2 md:grid-cols-2">
        {fresh.map((u) => (
          <li key={u.id} className="flex items-start gap-2 text-sm leading-relaxed">
            <NewTag />
            <span>
              <b className="text-gold-100">{u.name}</b> <span className="text-muted">{u.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Expedition prep: the party's kits and the Chord builder. */
export function PrepView({
  run,
  onChords,
  onEmbark,
  onBack,
  onCalling,
  openCallingPath,
  allowance = EVERYTHING,
  fresh = [],
  rank,
}: PrepViewProps) {
  useMood('map');
  // Always the content's two at Prep (the path is empty), but read from the run like Retune.
  const slots = runFieldAuraSlots(run);
  // The Calling chosen above decides the pool: the Martyr's songs reserve Life.
  const pool = reservePool(run);
  const { draft, change, legal } = useChordDraft(run.chords, allowance, onChords, slots, pool);
  const [freshIds] = useState(() => new Set(fresh.map((u) => u.id)));
  const w = CONTENT.weaver;
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  return (
    <ScreenFrame>
      <div className="mx-auto max-w-7xl px-6 pb-28 pt-8">
        <ScreenHeader
          eyebrow="The Prelude · Movement I"
          title="Prepare your songs"
          right={
            <>
              {rank !== undefined && (
                <span
                  className="flex items-center gap-1.5 rounded-lg border border-gold-500/50 bg-ink-900/80 px-3 py-1.5 text-sm font-semibold text-gold-200"
                  title={allowance.all ? 'Settings: the unlocks are skipped' : undefined}
                >
                  <Icon name="crown" size={15} /> Weaver Rank {rank}
                  {allowance.all && <span className="font-normal text-muted">· all unlocked</span>}
                </span>
              )}
              <Button variant="ghost" onClick={onBack} sound="back">
                <Icon name="back" size={16} /> Title
              </Button>
            </>
          }
        >
          <p className="mt-2 max-w-3xl text-sm text-muted">
            You are the Weaver. These three fight on their own; you keep them alive and make them
            hit harder. Your <b style={{ color: SONG_LOOK.beam.color }}>beam song</b> rides the
            Thread: whoever you thread hears it at {mult(w.beamFocus)}, and everyone else near you
            hears an echo.
            {allowance.songs > 1 || allowance.all ? (
              <>
                {' '}
                Your <b style={{ color: SONG_LOOK.field.color }}>field song</b> surrounds you, at
                full strength for everyone near you.
              </>
            ) : null}{' '}
            {pool === 'life'
              ? 'As the Martyr, your auras reserve Life instead: every point of Spirit powers Ward, Chime and Reel, and you fight with the Life your songs leave you.'
              : 'Whatever Spirit your auras leave free powers Ward, Chime and Reel.'}
          </p>
        </ScreenHeader>

        <FreshStrip fresh={fresh} />

        {onCalling && (
          <CallingPicker
            chosen={run.calling?.id ?? null}
            allowance={allowance}
            fresh={freshIds}
            onChoose={onCalling}
            openPath={openCallingPath}
          />
        )}

        <section className="mt-6" aria-label="Songs">
          <ChordBuilder
            value={draft}
            onChange={change}
            allowance={allowance}
            fresh={freshIds}
            fieldAuraSlots={slots}
            bonus={slotBonus(run)}
            pool={pool}
            calling={run.calling}
          />
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <section aria-labelledby="party-title">
            <SectionTitle>
              <span id="party-title">Your party</span>
            </SectionTitle>
            <div className="flex flex-col gap-3">
              {run.party.map((p) => (
                <HeroCard key={p.heroId} heroId={p.heroId} />
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-6">
            <Panel tone="solid" className="p-4">
              <h2 className="font-display text-base font-bold text-gold-300">Quick assists</h2>
              <p className="mb-3 text-xs text-muted">
                Change any time in Settings. Assists never block anything.
              </p>
              <div className="flex flex-col gap-3.5">
                <Segmented
                  label="Telegraph lead"
                  hint="Enemy attacks wind up longer."
                  value={settings.assists.telegraphLead}
                  options={[
                    { value: 1, label: 'Standard' },
                    { value: 1.25, label: '×1.25' },
                    { value: 1.5, label: '×1.5' },
                  ]}
                  onChange={(v) =>
                    update((d) => ({ ...d, assists: { ...d.assists, telegraphLead: v } }))
                  }
                />
                <Segmented
                  label="Perfect Ward window"
                  value={settings.assists.perfectWindowBonus}
                  options={[
                    { value: 0, label: 'Standard' },
                    { value: 0.1, label: '+0.1 s' },
                    { value: 0.2, label: '+0.2 s' },
                  ]}
                  onChange={(v) =>
                    update((d) => ({ ...d, assists: { ...d.assists, perfectWindowBonus: v } }))
                  }
                />
                <Toggle
                  label="Hero autonomy"
                  hint="Heroes fire their own Solos when charged."
                  checked={settings.assists.autonomy}
                  onChange={(v) =>
                    update((d) => ({ ...d, assists: { ...d.assists, autonomy: v } }))
                  }
                />
              </div>
            </Panel>
          </div>
        </div>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-end bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent px-6 pb-5 pt-10">
        <div className="pointer-events-auto flex items-center gap-4">
          <p className="text-sm text-muted">
            Seed <span className="font-mono text-text">{run.seed}</span>
          </p>
          {!legal && (
            <p className="text-sm font-semibold text-rose-200" role="status">
              Fix your songs to embark
            </p>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={onEmbark}
            sound="confirm"
            disabled={!legal}
            autoFocus
          >
            Embark <Icon name="arrow" size={18} />
          </Button>
        </div>
      </div>
    </ScreenFrame>
  );
}

function HeroCard({ heroId }: { heroId: string }) {
  const def = CONTENT.heroes.find((h) => h.id === heroId)!;
  return (
    <article
      className="rounded-xl border border-ink-600/70 bg-ink-800/80 p-4"
      style={{ borderTopColor: def.color, borderTopWidth: 3 }}
    >
      <div className="flex items-center gap-3">
        <HeroDisc heroId={heroId} size={48} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-tight">
            {def.name} <span className="text-sm font-normal text-muted">{def.title}</span>
          </h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip color={def.color}>{ROLE_LABEL[def.role]}</Chip>
            <Chip>
              <Icon name="heart" size={12} /> {def.maxHp.toLocaleString('en-US')} life
            </Chip>
            {def.armor > 0 && <Chip icon="ward">{Math.round(def.armor * 100)}% armour</Chip>}
          </div>
        </div>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {def.abilities.map((a) => (
          <div key={a.id} className="rounded-lg bg-ink-900/60 px-3 py-2">
            <dt className="font-semibold text-text">
              {a.name}{' '}
              <span className="font-mono text-xs font-normal text-muted">{a.cooldown}s</span>
            </dt>
            <dd className="text-xs leading-relaxed text-muted">{a.description}</dd>
          </div>
        ))}
        <div className="rounded-lg bg-gold-400/5 px-3 py-2 ring-1 ring-gold-500/30 sm:col-span-2">
          <dt className="flex items-center gap-1.5 font-semibold text-gold-200">
            <Icon name="note" size={14} /> Solo · {def.solo.name}
          </dt>
          <dd className="text-xs leading-relaxed text-muted">
            {def.solo.description} <span className="text-gold-300">{def.solo.cuedDescription}</span>
          </dd>
        </div>
        <div className="rounded-lg bg-ink-900/60 px-3 py-2 sm:col-span-2">
          <dt className="font-semibold text-text">Quirk · {def.quirk.name}</dt>
          <dd className="text-xs leading-relaxed text-muted">{def.quirk.description}</dd>
        </div>
      </dl>
    </article>
  );
}

export function PrepScreen() {
  const run = useRun((s) => s.run);
  const setChords = useRun((s) => s.setChords);
  const setCalling = useRun((s) => s.setCalling);
  const embark = useRun((s) => s.embark);
  const setScreen = useUi((s) => s.setScreen);
  const xp = useProfile((s) => s.profile.xp);
  const allowance = useAllowance();
  const fresh = useFreshUnlocks();
  if (!run) return null;
  return (
    <PrepView
      run={run}
      onChords={setChords}
      onCalling={setCalling}
      onEmbark={embark}
      onBack={() => setScreen('title')}
      allowance={allowance}
      fresh={fresh}
      rank={rankOf(xp)}
    />
  );
}
