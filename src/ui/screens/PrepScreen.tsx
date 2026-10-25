import { useRun } from '../../app/runStore';
import { useSettings } from '../../app/settings';
import { CONTENT } from '../../content';
import { CHORD_SLOTS } from '../../meta/run';
import type { RunState } from '../../meta/types';
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

export interface PrepViewProps {
  run: RunState;
  onAuras(ids: string[]): void;
  onEmbark(): void;
  onBack(): void;
}

/** Expedition prep: the party's kits, the Chord's two auras and the Spirit they reserve. */
export function PrepView({ run, onAuras, onEmbark, onBack }: PrepViewProps) {
  useMood('map');
  const maxSpirit = CONTENT.weaver.maxSpirit;
  const chosen = run.auras.map((id) => CONTENT.auras.find((a) => a.id === id)).filter((a) => !!a);
  const reservedPct = chosen.reduce((sum, a) => sum + a.reserve, 0);
  const free = Math.round(maxSpirit * (1 - reservedPct));
  const ward = CONTENT.techniques.ward.cost;
  const reel = CONTENT.techniques.reel.cost;
  const toggleAura = (id: string) => {
    if (run.auras.includes(id)) onAuras(run.auras.filter((a) => a !== id));
    // Choosing a third drops the oldest, so there is never a dead end.
    else onAuras([...run.auras, id].slice(-CHORD_SLOTS));
  };
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  return (
    <ScreenFrame>
      <div className="mx-auto max-w-7xl px-6 pb-28 pt-8">
        <ScreenHeader
          eyebrow="The Prelude · Movement I"
          title="Prepare the Chord"
          right={
            <Button variant="ghost" onClick={onBack} sound="back">
              <Icon name="back" size={16} /> Title
            </Button>
          }
        >
          <p className="mt-2 max-w-2xl text-sm text-muted">
            You are the Weaver. These three fight on their own; you keep them alive and make them
            hit harder. Choose which auras your Chord sings.
          </p>
        </ScreenHeader>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
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
            <section aria-labelledby="chord-title">
              <SectionTitle
                right={
                  <span className="font-mono text-xs text-muted">
                    {run.auras.length} / {CHORD_SLOTS} chosen
                  </span>
                }
              >
                <span id="chord-title">Chord I · Auras</span>
              </SectionTitle>
              <SpiritBudget
                auras={chosen}
                free={free}
                maxSpirit={maxSpirit}
                ward={ward}
                reel={reel}
              />
              <ul className="mt-3 flex flex-col gap-2">
                {CONTENT.auras.map((a) => {
                  const on = run.auras.includes(a.id);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleAura(a.id)}
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                          on ? 'bg-ink-700/80' : 'bg-ink-900/70 hover:bg-ink-800'
                        }`}
                        style={{ borderColor: on ? a.color : 'var(--color-ink-600)' }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className="flex items-center gap-2 font-semibold"
                            style={{ color: a.color }}
                          >
                            <Icon name={on ? 'check' : 'note'} size={16} />
                            {a.name}
                            <span className="text-xs font-normal text-muted">{a.subtitle}</span>
                          </span>
                          <span
                            className="font-mono text-xs text-muted"
                            title="Spirit reserved while active"
                          >
                            reserves {Math.round(a.reserve * 100)}%
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-text">{a.description}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

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
          <Button variant="primary" size="lg" onClick={onEmbark} sound="confirm" autoFocus>
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

/** The live Spirit budget: reserved slices, and what is left for techniques. */
function SpiritBudget({
  auras,
  free,
  maxSpirit,
  ward,
  reel,
}: {
  auras: { id: string; name: string; color: string; reserve: number }[];
  free: number;
  maxSpirit: number;
  ward: number;
  reel: number;
}) {
  const wards = Math.floor(free / ward);
  const tight = free < ward + reel;
  return (
    <Panel tone="solid" className="p-3.5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-text">Spirit budget</p>
        <p className="font-mono text-xs text-muted">
          {free} free of {maxSpirit}
        </p>
      </div>
      <div
        className="mt-2 flex h-5 overflow-hidden rounded-full border border-ink-500 bg-ink-700"
        role="img"
        aria-label={`${free} of ${maxSpirit} Spirit free; ${auras.map((a) => `${a.name} reserves ${Math.round(a.reserve * 100)} percent`).join(', ')}`}
      >
        <div
          className="h-full transition-[width] duration-200"
          style={{ width: `${(free / maxSpirit) * 100}%`, background: 'var(--color-spirit)' }}
        />
        {auras.map((a) => (
          <div
            key={a.id}
            className="stripes h-full border-l border-ink-950 transition-[width] duration-200"
            style={{ width: `${a.reserve * 100}%`, backgroundColor: a.color }}
            title={`${a.name}: ${Math.round(a.reserve * 100)}% reserved`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: 'var(--color-spirit)' }}
            aria-hidden
          />
          Free for techniques
        </span>
        {auras.map((a) => (
          <span key={a.id} className="flex items-center gap-1.5" style={{ color: a.color }}>
            <span
              className="stripes h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: a.color }}
              aria-hidden
            />
            {a.name} {Math.round(a.reserve * 100)}%
          </span>
        ))}
      </div>
      <p className={`mt-2 text-xs leading-relaxed ${tight ? 'text-threat' : 'text-muted'}`}>
        {tight
          ? `Only ${free} Spirit stays free: not enough for a Ward (${ward}) and a Reel (${reel}) together.`
          : `${free} Spirit stays free: enough for ${wards} ${wards === 1 ? 'Ward' : 'Wards'} in a row (${ward} each).`}
      </p>
    </Panel>
  );
}

export function PrepScreen() {
  const run = useRun((s) => s.run);
  const setAuras = useRun((s) => s.setAuras);
  const embark = useRun((s) => s.embark);
  const setScreen = useUi((s) => s.setScreen);
  if (!run) return null;
  return (
    <PrepView run={run} onAuras={setAuras} onEmbark={embark} onBack={() => setScreen('title')} />
  );
}
