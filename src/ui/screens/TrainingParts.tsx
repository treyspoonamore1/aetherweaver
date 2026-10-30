import { useState } from 'react';
import { getRuntime } from '../../app/runtimeRegistry';
import { CONTENT, auraDef, ornamentDef } from '../../content';
import { CHORD_PRESETS } from '../../meta/run';
import { TECHNIQUE_SLOTS, type Techniques } from '../../meta/variants';
import { songName, type DebugOp } from '../../sim';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Panel } from '../kit/Panel';
import { playUi } from '../kit/sound';
import { VARIANT_SOUNDS } from '../kit/variantLook';
import { useUi } from '../store';
import type { TechniqueKey } from '../types';
import { defaultName, slotKey, trainingOptions } from './variantsModel';

/**
 * The Training Grounds' tools (split from the screen, so the UI lab can show them without the 3D
 * view): the Chords preset, the technique variants (Phase 4f), the enemy spawner and the staged
 * situations.
 */
const debug = (op: DebugOp) => getRuntime()?.queue({ t: 'debug', op });

/** The chosen preset, song by song (Training has everything, whatever the Rank). */
function PresetSongs({ id }: { id: string }) {
  const preset = CHORD_PRESETS.find((p) => p.id === id);
  if (!preset) return null;
  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-xs leading-snug text-muted">
      {preset.chords.map((c, i) =>
        c.auras.length === 0 ? null : (
          <li key={i}>
            <span className="text-text">{songName(i)}:</span>{' '}
            {c.auras.map((a) => auraDef(a).name).join(' + ')}
            {c.ornaments.length > 0 &&
              ` (${c.ornaments.map((o) => ornamentDef(o).name).join(', ')})`}
          </li>
        ),
      )}
    </ul>
  );
}

/**
 * The technique variants to train with (Phase 4f): each slot's default and variants, every one
 * open here. A change starts a new session, as a loadout's does.
 */
function TrainingTechniques({
  techniques,
  onChange,
}: {
  techniques: Techniques;
  onChange(slot: TechniqueKey, id: string | null): void;
}) {
  return (
    <div className="mt-2" data-testid="training-techniques">
      <p
        className="flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted"
        title="Prep keeps your own choice"
      >
        Techniques
        <span className="text-[11px] font-normal normal-case tracking-normal">
          every variant open
        </span>
      </p>
      <div className="mt-1 flex flex-col gap-1">
        {TECHNIQUE_SLOTS.map((slot) => {
          const options = trainingOptions(slot, techniques);
          const chosen = options.find((o) => o.chosen) ?? options[0]!;
          return (
            <label key={slot} className="flex items-center gap-1.5" title={chosen.text}>
              <KeyCap label={slotKey(slot)} />
              <span className="sr-only">{defaultName(slot)}</span>
              <select
                className="min-w-0 flex-1 rounded-md border border-ink-500 bg-ink-800 px-1.5 py-0.5 text-xs font-medium text-text"
                value={chosen.id ?? ''}
                data-testid={`training-technique-${slot}`}
                onChange={(e) => {
                  const id = e.target.value || null;
                  playUi(id ? VARIANT_SOUNDS.choose : VARIANT_SOUNDS.clear);
                  onChange(slot, id);
                  // Give the keyboard back to the game (a focused select would eat WASD).
                  e.currentTarget.blur();
                }}
              >
                {options.map((o) => (
                  <option key={o.id ?? 'default'} value={o.id ?? ''}>
                    {o.id ? o.name : `${o.name} (default)`}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Spawn any enemy next to the Weaver, try a loadout, stage a call or a hold. */
export function SpawnPalette({
  loadout,
  onLoadout,
  techniques,
  onTechnique,
}: {
  loadout: string;
  onLoadout(id: string): void;
  techniques: Techniques;
  onTechnique(slot: TechniqueKey, id: string | null): void;
}) {
  const [elite, setElite] = useState(false);
  const [open, setOpen] = useState(true);
  const [caller, setCaller] = useState(0);
  const spawn = (defId: string) => {
    const w = useUi.getState().hud?.weaver;
    // The UI picks a spot; the command carries it, so the sim stays deterministic.
    const angle = Math.random() * Math.PI * 2;
    const dist = 7 + Math.random() * 3;
    debug({
      op: 'spawnEnemy',
      defId,
      x: (w?.x ?? 0) + Math.cos(angle) * dist,
      z: (w?.z ?? 0) + Math.sin(angle) * dist,
      elite,
    });
  };
  return (
    <Panel
      // Never over the Weaver bar: on a short screen the tools scroll instead.
      className="pointer-events-auto absolute right-4 top-4 max-h-[calc(100%-12rem)] w-60 overflow-y-auto p-3"
      aria-label="Spawn palette"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between text-left font-display text-sm font-bold tracking-wide text-gold-300"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Training tools
        <span className="text-xs font-normal text-muted">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <>
          <label className="mt-2 block text-xs font-semibold uppercase tracking-wider text-muted">
            Chords
            <select
              className="mt-1 block w-full rounded-md border border-ink-500 bg-ink-800 px-2 py-1 text-xs font-medium normal-case tracking-normal text-text"
              value={loadout}
              onChange={(e) => {
                onLoadout(e.target.value);
                // Give the keyboard back to the game (a focused select would eat WASD).
                e.currentTarget.blur();
              }}
            >
              {CHORD_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.difficulty})
                </option>
              ))}
            </select>
          </label>
          <PresetSongs id={loadout} />
          <TrainingTechniques techniques={techniques} onChange={onTechnique} />
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted">Spawn</p>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {CONTENT.enemies.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => spawn(e.id)}
                title={`${e.name} (${e.role})`}
                className="rounded-md border border-ink-500 bg-ink-800 px-2 py-1 text-left text-xs font-medium leading-tight text-text hover:border-gold-400 hover:text-gold-200"
              >
                {e.name.replace(/^The /, '')}
              </button>
            ))}
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-text">
            <input type="checkbox" checked={elite} onChange={(e) => setElite(e.target.checked)} />
            Spawn as elite
          </label>
          <div className="mt-2.5 flex flex-col gap-1.5 border-t border-ink-600/60 pt-2.5">
            <Button size="sm" onClick={() => debug({ op: 'killEnemies' })}>
              <Icon name="skull" size={14} /> Kill all enemies
            </Button>
            <Button size="sm" onClick={() => debug({ op: 'healParty' })}>
              <Icon name="heart" size={14} /> Heal party
            </Button>
            <Button size="sm" onClick={() => debug({ op: 'setResonance', value: 100 })}>
              <Icon name="note" size={14} /> Resonance 100
            </Button>
            <Button
              size="sm"
              onClick={() => {
                // Kael, Lyra, Vexis in turn: each asks for a different answer.
                debug({ op: 'forceCall', slot: (caller % 3) as 0 | 1 | 2 });
                setCaller(caller + 1);
              }}
            >
              <Icon name="call" size={14} /> Stage a call
            </Button>
            <Button size="sm" onClick={() => debug({ op: 'forceHold', slot: 1 })}>
              <Icon name="fermata" size={14} /> Stage a Fermata hold
            </Button>
            <Button size="sm" onClick={() => debug({ op: 'spawnDummies', count: 20 })}>
              + 20 dummies
            </Button>
            <Button size="sm" onClick={() => debug({ op: 'clearDummies' })}>
              Clear dummies
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}
