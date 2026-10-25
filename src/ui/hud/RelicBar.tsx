import { useEffect, useRef, useState } from 'react';
import type { ActiveBoon } from '../../meta/types';
import { Glyph, RelicGlyph, relicColor } from '../kit/RelicGlyph';
import { Ring } from '../kit/Ring';
import { boonInfo } from '../screens/interlude';
import { START_RELICS, pulsed, type RelicHud } from './relics';

const FLASH_MS = 900;

/**
 * The relics carried this fight, small, under the encounter header: cooldown rings for the
 * Metronome and the Thimble (lit when ready), the Veil available or spent, the rest passive.
 * A relic flashes when it acts. Boon and bane chips follow.
 */
export function RelicBar({
  relics,
  boons = [],
  seconds,
  flash = [],
}: {
  relics: readonly RelicHud[];
  boons?: readonly Pick<ActiveBoon, 'id' | 'fights'>[];
  seconds: number;
  /** UI lab: relics drawn mid-flash. */
  flash?: readonly string[];
}) {
  const [lit, setLit] = useState<Record<string, number>>({});
  const prev = useRef<readonly RelicHud[] | null>(null);
  // One timer per flashing relic. The HUD sends a new snapshot ~15 times a second, so the timers
  // must outlive the effect below: a cleanup there would cancel every flash before it ends.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const t of all.values()) clearTimeout(t);
      all.clear();
    };
  }, []);
  useEffect(() => {
    const before = prev.current;
    prev.current = relics;
    const ids =
      before === null
        ? seconds < 4
          ? relics.filter((r) => START_RELICS.includes(r.id)).map((r) => r.id)
          : []
        : pulsed(before, relics);
    if (ids.length === 0) return;
    const now = performance.now();
    setLit((l) => {
      const next = { ...l };
      for (const id of ids) next[id] = now;
      return next;
    });
    for (const id of ids) {
      const running = timers.current.get(id);
      if (running !== undefined) clearTimeout(running);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setLit((l) => {
            const next = { ...l };
            delete next[id];
            return next;
          });
        }, FLASH_MS),
      );
    }
  }, [relics, seconds]);
  if (relics.length === 0 && boons.length === 0) return null;
  return (
    <div
      className="flex max-w-[30rem] flex-wrap items-center gap-1.5 rounded-xl border border-ink-600/70 bg-ink-900/80 px-2 py-1.5 shadow-lg shadow-black/40 backdrop-blur-sm"
      data-testid="relic-bar"
      role="group"
      aria-label="Relics"
    >
      {relics.map((r) => (
        <RelicTile key={r.id} relic={r} flashing={flash.includes(r.id) || r.id in lit} />
      ))}
      {boons.map((b) => {
        const info = boonInfo(b);
        const color = info.kind === 'bane' ? '#fb7185' : '#86efac';
        return (
          <span
            key={b.id}
            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium"
            style={{
              color,
              borderColor: `color-mix(in srgb, ${color} 50%, transparent)`,
              borderStyle: info.kind === 'bane' ? 'dashed' : 'solid',
            }}
            role="img"
            aria-label={`${info.name}: ${info.text} ${info.left}.`}
          >
            <Glyph icon={info.icon} size={13} />
            {info.name}
            {b.fights !== null && <span className="font-mono opacity-80">·{b.fights}</span>}
          </span>
        );
      })}
    </div>
  );
}

function RelicTile({ relic: r, flashing }: { relic: RelicHud; flashing: boolean }) {
  const color = relicColor(r.rarity, r.cleansed);
  const cooling = r.kind === 'cooldown' && !r.ready;
  const spent = r.kind === 'once' && !r.ready;
  const lit = r.kind !== 'passive' && r.ready;
  const glyph = (
    <RelicGlyph
      icon={r.icon}
      rarity={r.rarity}
      cleansed={r.cleansed}
      size={r.kind === 'cooldown' ? 24 : 28}
      style={{ opacity: cooling || spent ? 0.45 : 1, filter: spent ? 'grayscale(1)' : undefined }}
    />
  );
  return (
    <span
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-200"
      style={{
        transform: flashing ? 'scale(1.3)' : undefined,
        boxShadow: flashing
          ? `0 0 0 2px ${color}, 0 0 16px ${color}`
          : lit
            ? `0 0 10px color-mix(in srgb, ${color} 60%, transparent)`
            : undefined,
      }}
      role="img"
      aria-label={r.label}
      data-relic={r.id}
      data-state={
        flashing ? 'flash' : r.kind === 'passive' ? 'passive' : r.ready ? 'ready' : 'waiting'
      }
    >
      {r.kind === 'cooldown' ? (
        <Ring
          value={r.total > 0 ? 1 - r.remaining / r.total : 1}
          size={32}
          stroke={2.5}
          color={r.ready ? 'var(--color-gold-300)' : color}
        >
          {glyph}
        </Ring>
      ) : (
        glyph
      )}
      {cooling && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-ink-950/90 px-0.5 font-mono text-[10px] leading-3 text-text">
          {Math.ceil(r.remaining)}
        </span>
      )}
      {spent && (
        <span
          className="absolute inset-1 rotate-45 border-t-2 border-rose-300/80"
          style={{ top: '50%' }}
          aria-hidden
        />
      )}
    </span>
  );
}
