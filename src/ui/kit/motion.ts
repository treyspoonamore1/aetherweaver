import { useState } from 'react';

/** The player asked for less motion (the OS setting). Read once: safe outside the browser. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * `prefersReducedMotion()`, read when the component mounts. The global stylesheet already cuts
 * every animation short; this is for what CSS can't undo: staggered delays and timed reveals.
 */
export function useReducedMotion(): boolean {
  const [reduced] = useState(prefersReducedMotion);
  return reduced;
}
