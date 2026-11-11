/**
 * The art pass prototype (artPass.ts, docs: the in-code character pass): on in this branch. Built
 * or tested with `VITE_ART_PASS=0`, every model, the model material and the Weaver's ribbons are
 * exactly as on main.
 */
// Under Node (the tests) the switch is read from the process's environment at run time: Vitest's
// on-disk module cache stores a module with `import.meta.env` baked in and is not keyed by the
// environment, so it would replay an earlier run's switch. In the browser build Vite fills
// `import.meta.env` (read through a local type: tsconfig.node.json has no Vite client types).
const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
export const ART_PASS: boolean = (proc?.env ? proc.env.VITE_ART_PASS : meta?.VITE_ART_PASS) !== '0';

/**
 * How large the art pass draws the heroes and the Weaver (the owner's choice: 1.12×). The model
 * only (ModelBatch.drawn): their rings, radii, footprints, reach, hit shapes and every effect
 * placed by their content height are unchanged. 1 while the art pass is off.
 */
export const HERO_DRAWN = ART_PASS ? 1.12 : 1;
