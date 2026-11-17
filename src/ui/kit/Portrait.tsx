import type { ReactNode } from 'react';
import type { PortraitSubject } from '../../render/portrait';
import { portraitKey, usePortrait } from './portraitStore';

/**
 * The dark surround behind a portrait: a glow behind the figure, falling to the page's ink. A
 * hero's and the Weaver's is the page's own navy (world 0); an enemy's is its world's air
 * (Movement I's warm stone, the Spire's red, the Rift's indigo, the Crucible's blue-violet),
 * bright enough at the centre that an obsidian or void-cloth figure keeps its outline.
 */
const SURROUND: readonly string[] = ['#3a4270', '#57483a', '#6a242b', '#34318a', '#3c4296'];

/**
 * A figure's portrait (docs/phase-8.md, 8d): its real stained-glass model, drawn once and kept
 * (portraitStore.ts). While it is being drawn the frame holds its place; where portraits are not
 * to be had (no WebGL), `fallback` is shown instead: exactly what the screen showed before.
 */
export function Portrait({
  subject,
  name,
  size = 96,
  world = 0,
  fallback = null,
  wrap,
  className = '',
}: {
  subject: PortraitSubject;
  /** The entry's name: the picture's alt text. */
  name: string;
  /** The frame's side in CSS px. */
  size?: number;
  /** The Movement whose air tints the surround (1 to 4; 0, the default: the page's navy). */
  world?: number;
  /** Shown where portraits are not to be had (default: nothing). */
  fallback?: ReactNode;
  /** What the framed picture sits in (a card of its own): not shown either without portraits. */
  wrap?: (picture: ReactNode) => ReactNode;
  className?: string;
}) {
  const state = usePortrait(subject);
  if (state === 'none') return <>{fallback}</>;
  const glow = SURROUND[world] ?? SURROUND[0]!;
  const picture = (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-xl border border-ink-600/80 ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 46%, ${glow} 0%, color-mix(in srgb, ${glow} 45%, var(--color-ink-950)) 48%, var(--color-ink-950) 100%)`,
      }}
      data-testid="portrait"
      data-portrait={portraitKey(subject)}
      data-ready={state === 'pending' ? 'false' : 'true'}
      aria-hidden={state === 'pending' ? true : undefined}
    >
      {state !== 'pending' && (
        <img
          src={state.src}
          alt={name}
          width={size}
          height={size}
          draggable={false}
          className="block h-full w-full"
        />
      )}
    </span>
  );
  return <>{wrap ? wrap(picture) : picture}</>;
}
