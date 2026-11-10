/**
 * A catalogue: message keys to English templates. A template may hold `{name}` placeholders,
 * filled from `t`'s parameters (numbers and words already formatted by the text layer's
 * formatters). Keys are namespaced by their area: `input.`, `a11y.`, `saves.`, `release.`, and
 * `hud.`, `screens.`, `common.` (docs/phase-7.md, *Contracts*).
 */
export type Catalogue = Readonly<Record<string, string>>;
