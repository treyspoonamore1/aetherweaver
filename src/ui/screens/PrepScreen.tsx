import { useState } from 'react';
import { useRun } from '../../app/runStore';
import { useSettings } from '../../app/settings';
import { CONTENT } from '../../content';
import type { ChordLoadout, RunState } from '../../meta/types';
import { canonicalChords } from '../../sim';
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
import { ChordBuilder } from './ChordBuilder';
import { loadoutProblems, padChords } from './chordModel';

export interface PrepViewProps {
  run: RunState;
  /** Called with every legal loadout the builder reaches (canonical form). */
  onChords(chords: ChordLoadout[]): void;
  onEmbark(): void;
  onBack(): void;
}

/**
 * The Chord draft while editing: may be illegal for a moment, in which case the run keeps
 * its last legal Chords and Embark waits.
 */
export function useChordDraft(
  initial: readonly ChordLoadout[],
  onLegal?: (c: ChordLoadout[]) => void,
) {
  const [draft, setDraft] = useState(() => padChords(initial));
  const problems = loadoutProblems(draft);
  const change = (next: ChordLoadout[]) => {
    setDraft(next);
    if (loadoutProblems(next).length === 0) onLegal?.(canonicalChords(next));
  };
  return { draft, change, legal: problems.length === 0 };
}

/** Expedition prep: the party's kits and the Chord builder. */
export function PrepView({ run, onChords, onEmbark, onBack }: PrepViewProps) {
  useMood('map');
  const { draft, change, legal } = useChordDraft(run.chords, onChords);
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  return (
    <ScreenFrame>
      <div className="mx-auto max-w-7xl px-6 pb-28 pt-8">
        <ScreenHeader
          eyebrow="The Prelude · Movement I"
          title="Prepare your Chords"
          right={
            <Button variant="ghost" onClick={onBack} sound="back">
              <Icon name="back" size={16} /> Title
            </Button>
          }
        >
          <p className="mt-2 max-w-3xl text-sm text-muted">
            You are the Weaver. These three fight on their own; you keep them alive and make them
            hit harder. Your Chords decide what your field sings: pick a preset, or fill the slots
            yourself. Whatever Spirit your auras leave free powers Ward, Chime and Reel.
          </p>
        </ScreenHeader>

        <section className="mt-6" aria-label="Chords">
          <ChordBuilder value={draft} onChange={change} />
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
              Fix your Chords to embark
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
  const embark = useRun((s) => s.embark);
  const setScreen = useUi((s) => s.setScreen);
  if (!run) return null;
  return (
    <PrepView run={run} onChords={setChords} onEmbark={embark} onBack={() => setScreen('title')} />
  );
}
