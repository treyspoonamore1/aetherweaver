import { useState } from 'react';
import { relicDef } from '../../content';
import type { EnshrineResult, Reliquary, ReliquaryRelic } from '../../meta/reliquary';
import type { RunState } from '../../meta/types';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { Modal } from '../kit/Modal';
import { Panel } from '../kit/Panel';
import { RelicGlyph, RelicRarityChip } from '../kit/RelicGlyph';
import { CARRIED_LOOK, SHARD_LOOK, TEAR_LOOK } from '../kit/reliquaryLook';
import { playUi } from '../kit/sound';
import { relicInfo } from './interlude';
import {
  CarriedMark,
  InscriptionList,
  RELIQUARY_CSS,
  RelicPlate,
  TierBadge,
} from './ReliquaryParts';
import {
  capacityLine,
  enshrineChoices,
  enshrineStage,
  paidLine,
  releaseView,
  releasedLine,
  relicView,
  shardsText,
} from './reliquaryModel';
import { SectionTitle } from './shared';
import { dissonancePoints } from '../../meta/dissonance';
import { DepthChip } from './DissonanceParts';
import { wonLine } from './dissonanceModel';

/**
 * The relic a run enshrined, as the Reliquary holds it now: the very one by its uid, or (a run
 * saved before uids were kept) the newest of that relic.
 */
function enshrinedNow(
  rq: Reliquary,
  id: string | null,
  uid: string | null | undefined,
): ReliquaryRelic | null {
  if (!id) return null;
  if (uid) return rq.relics.find((r) => r.uid === uid) ?? null;
  const all = rq.relics.filter((r) => r.id === id);
  return all.reduce<ReliquaryRelic | null>(
    (best, r) => (!best || Number(r.uid.slice(1)) > Number(best.uid.slice(1)) ? r : best),
    null,
  );
}

export interface SummaryReliquary {
  /** The profile's Reliquary (its capacity, and what a full one could release). */
  reliquary: Reliquary;
  /** The run store's `enshrine`: once, for a won run. */
  onEnshrine(relicId: string): EnshrineResult;
  /** The profile store's `releaseRelic`: the shards it gave. */
  onRelease(uid: string): number;
}

/**
 * The Summary's Reliquary (Phase 4c): what the run's end paid (`run.reliquary`), and for a won
 * run the relics it found, to enshrine one (or none). Once is all. A full Reliquary releases one
 * here first: the player can't leave the Summary to do it.
 */
export function EnshrinePanel({
  run,
  reliquary: rq,
  onEnshrine,
  onRelease,
  initialArrived = null,
}: SummaryReliquary & {
  run: RunState;
  /** UI lab: the relic as it arrived. */
  initialArrived?: ReliquaryRelic | null;
}) {
  const [arrived, setArrived] = useState<ReliquaryRelic | null>(initialArrived);
  const [releasing, setReleasing] = useState<ReliquaryRelic | null>(null);
  const [say, setSay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const stage = enshrineStage(run, rq);
  if (stage === 'closed' || !run.reliquary) return null;
  const paid = run.reliquary;
  const choices = enshrineChoices(run);
  const shown = arrived ?? enshrinedNow(rq, paid.enshrined, paid.enshrinedUid);
  // Phase 4d: what it enshrines remembers the run's Dissonance (its depth).
  const depth = dissonancePoints(run.dissonance ?? []);

  const enshrine = (id: string) => {
    const result = onEnshrine(id);
    if (!result.ok) {
      playUi('error');
      setError(result.reason);
      setSay(result.reason);
      return;
    }
    playUi('enshrine');
    setError(null);
    setArrived(result.relic);
    const v = relicView(result.relic);
    setSay(
      `Enshrined ${v.name}. It arrives with ${v.inscriptions.map((i) => `${i.name} ${i.tierLabel}: ${i.text}`).join('; ') || 'no Inscription'}.`,
    );
  };

  const release = () => {
    if (!releasing) return;
    const name = relicDef(releasing.id).name;
    const shards = onRelease(releasing.uid);
    setReleasing(null);
    if (shards <= 0) {
      playUi('error');
      return;
    }
    playUi('release');
    setSay(releasedLine(name, shards));
  };

  return (
    <Panel tone="solid" className="mt-6 p-5" data-testid="summary-reliquary" data-stage={stage}>
      <style>{RELIQUARY_CSS}</style>
      <SectionTitle
        right={
          <span
            className="flex items-center gap-3 font-mono text-xs text-muted"
            data-testid="summary-paid"
          >
            <span className="flex items-center gap-1">
              <Icon name="shard" size={13} style={{ color: SHARD_LOOK.color }} />+{paid.shards}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="tear" size={13} style={{ color: TEAR_LOOK.color }} />+{paid.tears}
            </span>
          </span>
        }
      >
        <span className="flex items-center gap-2">
          <Icon name="reliquary" size={20} /> The Reliquary
        </span>
      </SectionTitle>
      <p className="text-sm text-text">
        This run paid <b className="text-gold-200">{paidLine(paid)}</b>.
      </p>
      {stage === 'lost' && (
        <p className="mt-1 text-sm text-muted">Win a run to enshrine one of the relics it found.</p>
      )}
      {stage === 'none' && (
        <p className="mt-1 text-sm text-muted">
          It found no relic of its own to enshrine: only those it carried in.
        </p>
      )}
      {stage === 'full' && <FullReliquary rq={rq} onRelease={(r) => setReleasing(r)} />}
      {(stage === 'choose' || stage === 'full') && (
        <>
          <p className="mt-3 text-sm text-text">
            <b className="text-gold-200">Enshrine one relic it found</b>{' '}
            <span className="text-muted">
              to craft between runs and carry into the next. Once, and only one; leave to keep none.
            </span>
          </p>
          {depth > 0 && (
            <p
              className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-text"
              data-testid="enshrine-depth"
              data-depth={depth}
            >
              <DepthChip depth={depth} />
              {wonLine(depth)}
            </p>
          )}
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-orange-200" role="alert">
              <Icon name="info" size={14} /> {error}
            </p>
          )}
          <ul
            className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="enshrine-options"
          >
            {choices.map((c) => {
              const info = relicInfo(c.id, c.cleansed);
              return (
                <li
                  key={c.id}
                  className="flex flex-col rounded-xl border border-ink-600 bg-ink-900/70 p-3"
                  data-relic={c.id}
                >
                  <div className="flex items-start gap-3">
                    <RelicGlyph
                      icon={info.icon}
                      rarity={info.rarity}
                      cleansed={info.cleansed}
                      size={42}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-base font-bold leading-tight text-text">
                        {info.name}
                      </p>
                      <div className="mt-1">
                        <RelicRarityChip rarity={info.rarity} cleansed={info.cleansed} />
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-snug text-text">{info.rule}</p>
                  {info.curse && (
                    <p
                      className={`mt-1 text-xs ${info.cleansed ? 'text-muted line-through' : 'text-rose-200'}`}
                    >
                      Curse: {info.curse}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted">{c.arrivesLine}</p>
                  <Button
                    className="mt-auto w-full"
                    variant={stage === 'full' ? 'secondary' : 'primary'}
                    size="sm"
                    sound={null}
                    aria-disabled={stage === 'full' || undefined}
                    onClick={() =>
                      stage === 'full'
                        ? (playUi('error'),
                          setError('Release a relic first: the Reliquary is full.'))
                        : enshrine(c.id)
                    }
                    data-testid="enshrine"
                  >
                    <Icon name="reliquary" size={15} /> Enshrine {info.name}
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {stage === 'done' && shown && <Arrival relic={shown} />}
      {stage === 'done' && !shown && paid.enshrined && (
        <p className="mt-2 text-sm text-text">
          This run enshrined {relicDef(paid.enshrined).name}.
        </p>
      )}
      <div className="sr-only" role="status" aria-live="polite">
        {say}
      </div>
      {releasing && (
        <Modal
          title={`Release ${relicDef(releasing.id).name}?`}
          onClose={() => setReleasing(null)}
          closeOnEscape
        >
          <p className="mt-3 text-sm leading-relaxed text-text">
            It leaves the Reliquary for good, to make room. You get{' '}
            <b className="text-gold-200">{releaseView(releasing).line}</b>
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setReleasing(null)}
              sound="back"
              data-autofocus
            >
              Keep it
            </Button>
            <Button variant="danger" onClick={release} sound={null} data-testid="release-confirm">
              <Icon name="release" size={16} /> Release for{' '}
              {shardsText(releaseView(releasing).total)}
            </Button>
          </div>
        </Modal>
      )}
    </Panel>
  );
}

/** A full Reliquary: say so, and offer each relic to release (asked first). */
function FullReliquary({
  rq,
  onRelease,
}: {
  rq: Reliquary;
  onRelease(relic: ReliquaryRelic): void;
}) {
  return (
    <div
      className="mt-3 rounded-xl border border-threat/50 bg-threat/10 p-3"
      data-testid="reliquary-full"
    >
      <p className="flex items-start gap-2 text-sm text-orange-100">
        <Icon name="info" size={16} className="mt-0.5 shrink-0 text-threat" />
        <span>
          <b>Your Reliquary is full</b> ({capacityLine(rq.relics.length)}). Release one to make room
          for a relic this run found. It gives Tuning Shards; you can do it here.
        </span>
      </p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {rq.relics.map((r) => {
          const v = relicView(r);
          return (
            <li
              key={r.uid}
              className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-900/80 px-2 py-1.5"
              data-relic={r.uid}
            >
              <span className="relative inline-flex">
                <RelicGlyph icon={v.icon} rarity={v.rarity} cleansed={v.cleansed} size={28} />
                {rq.carry.includes(r.uid) && (
                  <CarriedMark dormant={rq.carry.indexOf(r.uid) > 0} size={12} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text">{v.name}</span>
                <span className="flex gap-0.5">
                  {v.inscriptions.map((i) => (
                    <TierBadge key={i.id} tier={i.tier} size="sm" />
                  ))}
                  {v.state && <span className="text-[11px] text-muted">{v.state.label}</span>}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 !px-2"
                sound="click"
                onClick={() => onRelease(r)}
                aria-label={`Release ${v.name} for ${shardsText(v.release)}`}
                title={`Release it for ${shardsText(v.release)}`}
                data-testid="summary-release"
              >
                <Icon name="release" size={14} /> Release
                <span className="flex items-center gap-0.5 font-mono text-xs">
                  <Icon name="shard" size={12} style={{ color: SHARD_LOOK.color }} />
                  {v.release}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The relic as it arrived: its plate, its first Inscriptions, an etch over all of them. */
function Arrival({ relic }: { relic: ReliquaryRelic }) {
  const v = relicView(relic);
  return (
    <div
      className="rq-etch mt-3 flex flex-wrap items-start gap-4 rounded-xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${CARRIED_LOOK.color} 55%, transparent)`,
        background: `linear-gradient(120deg, color-mix(in srgb, ${CARRIED_LOOK.color} 10%, rgb(10 16 34 / 0.9)), rgb(10 16 34 / 0.85) 70%)`,
      }}
      data-testid="enshrined"
      data-relic={relic.id}
      data-uid={relic.uid}
    >
      <RelicPlate view={v} size={56} effect="etch" />
      <div className="min-w-0 flex-1">
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: CARRIED_LOOK.color }}
        >
          Enshrined
        </p>
        <p className="flex flex-wrap items-center gap-2 font-display text-xl font-bold text-gold-100">
          {v.name}
          {relic.depth > 0 && <DepthChip depth={relic.depth} className="font-sans" />}
        </p>
        {relic.depth > 0 && (
          <p className="text-xs text-muted" data-testid="arrival-depth">
            {wonLine(relic.depth)}
          </p>
        )}
        <p className="mt-0.5 text-sm text-text">{v.text}</p>
        {v.ownCurse && (
          <p
            className={`mt-0.5 text-xs ${v.ownCurse.lifted ? 'text-muted line-through' : 'text-rose-200'}`}
          >
            {v.ownCurse.lifted ? 'Curse lifted: ' : 'Its curse: '}
            {v.ownCurse.text}
          </p>
        )}
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Its first Inscriptions
        </p>
        <InscriptionList view={v} className="mt-1 max-w-xl" />
        <p className="mt-2 text-xs text-muted">
          It waits in the Reliquary: craft it and choose to carry it from the Title or from Prep.
        </p>
      </div>
    </div>
  );
}
