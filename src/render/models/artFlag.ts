/**
 * The art pass prototype (artPass.ts, docs: the in-code character pass): on in this branch. Built
 * or tested with `VITE_ART_PASS=0`, every model, the model material and the Weaver's ribbons are
 * exactly as on main.
 */
export const ART_PASS: boolean = import.meta.env.VITE_ART_PASS !== '0';

/**
 * How large the art pass draws the heroes and the Weaver (the owner's choice: 1.12×). The model
 * only (ModelBatch.drawn): their rings, radii, footprints, reach, hit shapes and every effect
 * placed by their content height are unchanged. 1 while the art pass is off.
 */
export const HERO_DRAWN = ART_PASS ? 1.12 : 1;
