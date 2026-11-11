/**
 * The art pass prototype (artPass.ts, docs: the in-code character pass): on in this branch. Built
 * or tested with `VITE_ART_PASS=0`, every model, the model material and the Weaver's ribbons are
 * exactly as on main.
 */
export const ART_PASS: boolean = import.meta.env.VITE_ART_PASS !== '0';
