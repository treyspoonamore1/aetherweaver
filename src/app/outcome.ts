/**
 * The fight's outcome for the run layer. `buildOutcome` lives in `src/meta/outcome.ts` since
 * Phase 6 (docs/phase-6.md, *Contracts*), so the run replay's verifier can build the same outcome
 * the combat screen does; this module re-exports it for the app's existing callers.
 */
export { buildOutcome } from '../meta/outcome';
