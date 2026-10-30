import { useState } from 'react';
import { useRun } from '../../app/runStore';
import { CONTENT, encounterDef, motifDef, runEventDef } from '../../content';
import { findNode, motifLine, reachable } from '../../meta/run';
import type { MapNode, NodeKind, RunState } from '../../meta/types';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { CATEGORY, Chip, RARITY } from '../kit/Chip';
import { Icon, type IconName } from '../kit/Icon';
import { Modal } from '../kit/Modal';
import { Panel } from '../kit/Panel';
import { useMood } from '../kit/sound';
import { clock } from '../kit/format';
import { PartyHealth, Pips, SectionTitle } from './shared';
import { Glyph } from '../kit/RelicGlyph';
import { eventPreview, rewardChips, threatLine, type RewardChip } from './interlude';
import { RunStrip } from './RelicCard';
import { CallingGlyph, callingLook } from '../kit/CallingGlyph';
import { callingTierAt, milestoneLine, numeral } from './callingText';
import { callingDef } from '../../content';

export const NODE_LOOK: Record<
  NodeKind,
  { icon: IconName; label: string; color: string; size: number }
> = {
  skirmish: { icon: 'swords', label: 'Skirmish', color: '#93c5fd', size: 52 },
  elite: { icon: 'skull', label: 'Elite', color: '#fb923c', size: 56 },
  shrine: { icon: 'flame', label: 'Shrine', color: '#5eead4', size: 52 },
  respite: { icon: 'moon', label: 'Respite', color: '#86efac', size: 52 },
  merchant: { icon: 'purse', label: 'Merchant', color: '#facc15', size: 52 },
  forge: { icon: 'anvil', label: 'Forge', color: '#f97316', size: 52 },
  event: { icon: 'event', label: 'Event', color: '#c4b5fd', size: 52 },
  miniboss: { icon: 'bell', label: 'Mini-boss', color: '#fbbf24', size: 64 },
  boss: { icon: 'eye', label: 'Boss', color: '#f472b6', size: 72 },
};

const CHIP_COLOR: Record<RewardChip['tone'], string> = {
  aether: 'var(--color-gold-300)',
  relic: '#fdba74',
  heal: 'var(--color-heal)',
  common: RARITY.common.color,
  rare: RARITY.rare.color,
  epic: RARITY.epic.color,
};

const W = 1000;
const H = 460;

function nodePos(run: RunState, node: MapNode): { x: number; y: number } {
  const n = run.map.rows.length;
  return { x: ((node.row + 0.5) / n) * W, y: (0.1 + 0.8 * node.x) * H };
}

export interface MapViewProps {
  run: RunState;
  onChoose(nodeId: string): void;
  onAbandon(): void;
  /** UI lab: force a node's tooltip open, or a carried relic's. */
  peek?: string;
  peekRelic?: string;
  /** UI lab: force the Calling's tooltip in the strip open. */
  peekCalling?: boolean;
}

/** The Prelude's map, left to right: reachable nodes glow, the path walked is gold. */
export function MapView({
  run,
  onChoose,
  onAbandon,
  peek,
  peekRelic,
  peekCalling = false,
}: MapViewProps) {
  useMood('map');
  const [confirm, setConfirm] = useState(false);
  const options = reachable(run);
  const optionIds = new Set(options.map((n) => n.id));
  const current = run.path.length > 0 ? run.path[run.path.length - 1]! : null;
  const walked = new Set(run.path);
  const rows = run.map.rows;

  // Edges: walked (gold), live options (bright dashed), the rest (dim).
  const edges: { key: string; d: string; kind: 'walked' | 'option' | 'dim' }[] = [];
  for (const row of rows) {
    for (const node of row) {
      const a = nodePos(run, node);
      for (const nextId of node.next) {
        const next = findNode(run, nextId);
        if (!next) continue;
        const b = nodePos(run, next);
        const mid = (a.x + b.x) / 2;
        const kind =
          walked.has(node.id) && walked.has(next.id)
            ? 'walked'
            : node.id === current && optionIds.has(next.id)
              ? 'option'
              : 'dim';
        edges.push({
          key: `${node.id}-${next.id}`,
          d: `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`,
          kind,
        });
      }
    }
  }
  // Starting edges from the "party" marker into row 0.
  const stepNumber = run.path.length;

  return (
    <ScreenFrame>
      <div className="mx-auto max-w-[88rem] px-6 py-8">
        <ScreenHeader
          eyebrow={`The Prelude · Movement I · step ${Math.min(stepNumber + 1, rows.length)} of ${rows.length}`}
          title="The Reliquary Road"
          right={
            <Button variant="ghost" onClick={() => setConfirm(true)}>
              <Icon name="flag" size={16} /> Abandon run
            </Button>
          }
        >
          <p className="mt-2 text-sm text-muted">
            {options.length > 0
              ? 'Choose where to go next. Glowing nodes are within reach; hover one to see what it offers.'
              : 'No path forward.'}
          </p>
        </ScreenHeader>
        <RunStrip
          className="mt-4 w-fit"
          aether={run.aether}
          relics={run.relics}
          carried={run.carried}
          boons={run.boons}
          openRelic={peekRelic}
          calling={run.calling}
          map={run.map}
          openCalling={peekCalling}
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
          <Panel tone="solid" className="flex flex-col justify-center p-4 sm:p-6">
            <div
              role="group"
              className="relative mx-auto w-full"
              style={{ aspectRatio: `${W} / ${H}`, maxWidth: 1100 }}
              aria-label="Map"
            >
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                {edges
                  .filter((e) => e.kind === 'dim')
                  .map((e) => (
                    <path
                      key={e.key}
                      d={e.d}
                      fill="none"
                      stroke="var(--color-ink-500)"
                      strokeWidth={2}
                      strokeOpacity={0.55}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                {edges
                  .filter((e) => e.kind !== 'dim')
                  .map((e) => (
                    <path
                      key={e.key}
                      d={e.d}
                      fill="none"
                      stroke={
                        e.kind === 'walked' ? 'var(--color-gold-400)' : 'var(--color-gold-200)'
                      }
                      strokeWidth={e.kind === 'walked' ? 4 : 2.5}
                      strokeDasharray={e.kind === 'option' ? '7 6' : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
              </svg>
              {rows.flat().map((node) => (
                <MapNodeView
                  key={node.id}
                  run={run}
                  node={node}
                  state={
                    node.id === current
                      ? 'current'
                      : walked.has(node.id)
                        ? 'visited'
                        : optionIds.has(node.id)
                          ? 'option'
                          : 'locked'
                  }
                  onChoose={onChoose}
                  peek={peek === node.id}
                />
              ))}
            </div>
            <Legend />
          </Panel>

          <aside className="flex flex-col gap-4" aria-label="Run status">
            <Panel tone="solid" className="p-4">
              <SectionTitle>Party</SectionTitle>
              <div className="flex flex-col gap-3.5">
                {run.party.map((h) => (
                  <PartyHealth key={h.heroId} hero={h} />
                ))}
              </div>
            </Panel>
            <Panel tone="solid" className="p-4">
              <SectionTitle>Chord</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {run.chords.every((c) => c.auras.length === 0) && (
                  <span className="text-sm text-muted">No auras chosen.</span>
                )}
                {run.chords
                  .flatMap((c) => c.auras)
                  .map((id) => {
                    const a = CONTENT.auras.find((x) => x.id === id)!;
                    return (
                      <Chip key={id} color={a.color} icon="note" title={a.description}>
                        {a.name}
                      </Chip>
                    );
                  })}
              </div>
            </Panel>
            <Panel tone="solid" className="p-4">
              <SectionTitle
                right={
                  <span className="font-mono text-xs text-muted">{run.motifs.length} owned</span>
                }
              >
                Motifs
              </SectionTitle>
              {run.motifs.length === 0 ? (
                <p className="text-sm text-muted">None yet. Win a fight and choose one.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {run.motifs.map((m) => {
                    const def = motifDef(m.id);
                    const cat = CATEGORY[def.category];
                    return (
                      <li key={m.id} className="text-sm">
                        <p
                          className="flex items-center justify-between gap-2 font-semibold"
                          style={{ color: cat.color }}
                        >
                          <span className="flex items-center gap-1.5">
                            <Icon name={cat.icon} size={14} /> {def.name}
                          </span>
                          <Pips level={m.level} max={def.values.length} color={cat.color} />
                        </p>
                        <p className="text-xs leading-relaxed text-muted">
                          {motifLine(m.id, m.level)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </aside>
        </div>
      </div>
      {confirm && (
        <Modal
          title="Abandon this run?"
          width="max-w-md"
          onClose={() => setConfirm(false)}
          closeOnEscape
        >
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The Prelude ends here and you go to the summary. This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button data-autofocus onClick={() => setConfirm(false)} sound="back">
              Keep going
            </Button>
            <Button variant="danger" onClick={onAbandon} sound="confirm">
              Abandon run
            </Button>
          </div>
        </Modal>
      )}
    </ScreenFrame>
  );
}

function Legend() {
  return (
    <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1.5 border-t border-ink-600/50 pt-3 text-xs text-muted">
      {(Object.keys(NODE_LOOK) as NodeKind[]).map((k) => (
        <li key={k} className="flex items-center gap-1.5" style={{ color: NODE_LOOK[k].color }}>
          <Icon name={NODE_LOOK[k].icon} size={14} /> {NODE_LOOK[k].label}
        </li>
      ))}
    </ul>
  );
}

function MapNodeView({
  run,
  node,
  state,
  onChoose,
  peek = false,
}: {
  run: RunState;
  node: MapNode;
  state: 'current' | 'visited' | 'option' | 'locked';
  onChoose(id: string): void;
  peek?: boolean;
}) {
  const look = NODE_LOOK[node.kind];
  const pos = nodePos(run, node);
  const rows = run.map.rows.length;
  const enc = node.encounterId ? encounterDef(node.encounterId) : null;
  const ev = node.kind === 'event' ? eventPreview(node.eventId) : null;
  const eventIcon = node.eventId ? runEventDef(node.eventId).icon : null;
  const title = enc?.name ?? ev?.name ?? look.label;
  const threat = threatLine(node.reward.threat, node.kind === 'event');
  // Phase 3c: a fight on a milestone row whose tier of the Calling is still open.
  const tier = callingTierAt(run, node);
  const milestone = milestoneLine(run, node);
  const calling = run.calling ? callingDef(run.calling.id) : null;
  const cLook = callingLook(run.calling?.id);
  const shop = node.kind === 'merchant' || node.kind === 'forge';
  const left = (pos.x / W) * 100;
  const top = (pos.y / H) * 100;
  const below = node.x < 0.5;
  const alignClass =
    node.row === 0 ? 'left-0' : node.row === rows - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2';
  const active = state === 'option';
  const body = (
    <span
      className={`relative flex items-center justify-center rounded-full border-2 transition-transform ${
        active
          ? 'bg-ink-700 hover:scale-110'
          : state === 'current'
            ? 'bg-gold-400/20'
            : state === 'visited'
              ? 'bg-ink-800'
              : 'bg-ink-900/80'
      } ${state === 'locked' ? 'opacity-45' : ''}`}
      style={{
        width: look.size,
        height: look.size,
        borderColor:
          state === 'visited'
            ? 'var(--color-gold-500)'
            : state === 'current'
              ? 'var(--color-gold-300)'
              : look.color,
        color: look.color,
        boxShadow: active
          ? `0 0 0 4px color-mix(in srgb, ${look.color} 25%, transparent), 0 0 18px ${look.color}`
          : undefined,
      }}
    >
      <Icon name={look.icon} size={look.size * 0.5} />
      {state === 'visited' && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold-400 text-ink-950">
          <Icon name="check" size={12} />
        </span>
      )}
      {state === 'current' && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-gold-400 px-1.5 text-xs font-bold leading-4 text-ink-950">
          You
        </span>
      )}
      {tier !== null && calling && (
        <span
          className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border bg-ink-950"
          style={{
            color: cLook.light,
            borderColor: cLook.color,
            boxShadow: `0 0 10px color-mix(in srgb, ${cLook.color} 60%, transparent)`,
          }}
          title={`Your Calling grows after this fight (tier ${numeral(tier)})`}
          data-testid="calling-mark"
        >
          <CallingGlyph icon={calling.icon} size={15} />
        </span>
      )}
      {active && (
        <span
          className="animate-pulse-soft absolute inset-[-7px] rounded-full border border-dashed"
          style={{ borderColor: look.color }}
          aria-hidden
        />
      )}
    </span>
  );
  const label = (
    <span
      className={`pointer-events-none mt-1 block w-[5.4rem] text-center text-xs leading-tight ${state === 'locked' ? 'text-muted/70' : 'text-text'}`}
    >
      {title}
    </span>
  );
  return (
    <div
      className={`group absolute -translate-x-1/2 -translate-y-1/2 focus-within:z-30 hover:z-30 ${peek ? 'z-30' : ''}`}
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      {active ? (
        <button
          type="button"
          onClick={() => onChoose(node.id)}
          aria-label={`${title}, ${look.label}. ${ev ? ev.teaser : node.reward.text}${
            rewardChips(node.reward).length
              ? ` ${rewardChips(node.reward)
                  .map((c) => c.text)
                  .join('. ')}.`
              : ''
          }${threat ? ` ${threat}.` : ''}${milestone ? ` ${milestone.title}: ${milestone.text}` : ''}`}
          className="flex flex-col items-center focus-visible:outline-offset-4"
        >
          {body}
          {label}
        </button>
      ) : (
        <div
          className="flex flex-col items-center"
          aria-label={`${title}, ${look.label}${state === 'visited' ? ', visited' : state === 'locked' ? ', not reachable yet' : ', you are here'}`}
          role="img"
        >
          {body}
          {label}
        </div>
      )}
      <div
        role="tooltip"
        className={`pointer-events-none absolute z-30 w-72 rounded-xl border border-gold-500/50 bg-ink-900/97 p-3 text-left shadow-2xl shadow-black/70 transition-opacity ${peek ? 'visible opacity-100' : 'invisible opacity-0 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100'} ${alignClass} ${below ? 'top-full mt-8' : 'bottom-full mb-8'}`}
      >
        <p className="flex items-center gap-2 font-display text-base font-bold text-gold-200">
          {eventIcon && <Glyph icon={eventIcon} size={20} style={{ color: look.color }} />}
          {title}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Chip color={look.color} icon={look.icon}>
            {look.label}
          </Chip>
          {enc && enc.par > 0 && <Chip icon="clock">par {clock(enc.par)}</Chip>}
          {enc && enc.waves.length > 1 && <Chip>{enc.waves.length} waves</Chip>}
        </div>
        {enc && <p className="mt-2 text-xs italic leading-relaxed text-muted">{enc.flavor}</p>}
        <p className="mt-2 text-sm leading-snug text-text">{ev ? ev.teaser : node.reward.text}</p>
        <ul className="mt-2 flex flex-col gap-1">
          {rewardChips(node.reward).map((c) => (
            <li
              key={c.text}
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: CHIP_COLOR[c.tone] }}
            >
              <Icon name={c.icon} size={13} /> {c.text}
            </li>
          ))}
          {shop && (
            <li className="flex items-center gap-1.5 text-xs text-muted">
              <Icon name="aether" size={13} /> You carry {run.aether} Aether
            </li>
          )}
        </ul>
        {milestone && calling && (
          <p
            className="mt-2 flex items-start gap-2 rounded-lg border px-2 py-1.5 text-xs leading-relaxed"
            style={{
              borderColor: `color-mix(in srgb, ${cLook.color} 45%, transparent)`,
              background: `color-mix(in srgb, ${cLook.color} 9%, transparent)`,
            }}
          >
            <CallingGlyph
              icon={calling.icon}
              size={16}
              className="mt-0.5 shrink-0"
              style={{ color: cLook.color }}
            />
            <span>
              <b className="font-semibold" style={{ color: cLook.color }}>
                {milestone.title}
              </b>{' '}
              <span className="text-text">{milestone.text}</span>
            </span>
          </p>
        )}
        {threat && <p className="mt-2 font-mono text-xs text-muted">{threat}</p>}
      </div>
    </div>
  );
}

export function MapScreen() {
  const run = useRun((s) => s.run);
  const choose = useRun((s) => s.chooseNode);
  const abandon = useRun((s) => s.abandon);
  if (!run) return null;
  return <MapView run={run} onChoose={choose} onAbandon={abandon} />;
}
