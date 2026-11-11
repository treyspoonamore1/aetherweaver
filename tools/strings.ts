/**
 * The string scanner and ratchet (docs/phase-7.md, *W3a*): finds the literal player-facing strings
 * in `src/ui` that have not gone through the text layer (`src/ui/text/`), file by file.
 *
 *   npx tsx tools/strings.ts                     each file's count, then the total
 *   npx tsx tools/strings.ts src/ui/hud/Hud.tsx  that file's strings, one a line
 *   npx tsx tools/strings.ts --all               every file's strings
 *   npx tsx tools/strings.ts --check             compares with tests/strings.baseline.json
 *   npx tsx tools/strings.ts --write-baseline    lowers the baseline to today's counts (never raises)
 *   npx tsx tools/strings.ts --rebase            records today's counts, raising where they rose
 *                                                (only when merging streams that started earlier)
 *
 * `tests/textLayer.test.ts` runs the same scan as the ratchet: no file's count may rise above the
 * baseline, and a file missing from it must have none.
 *
 * What counts (a heuristic, like the audit's scanner, made stricter where it can see context):
 * - JSX text with a letter in it;
 * - a string or template in a player-facing JSX attribute (`title`, `aria-label`, `label`, ...);
 * - a string or template elsewhere whose words read as prose: whitespace between words of two or
 *   more letters, not a class list, a CSS value or a dotted key;
 * - a capitalised single word as the value of a label-like property (`label: 'Leave'`);
 * - any string or template with a letter handed into a message's parameters (`t(key, { value:
 *   'stops' })`): words reach a message by key, never as a parameter.
 * What doesn't: imports, types, property names, comparisons and `case`s, errors and console
 * output, class names, styles, test ids and keys, and the arguments of `t`, `tc` and friends.
 * The labs (`src/ui/lab/`) are developer tools and the text layer is the catalogue: neither is
 * scanned.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const BASELINE = join(ROOT, 'tests/strings.baseline.json');

export type FoundKind = 'jsx' | 'attr' | 'literal' | 'template';

export interface Found {
  kind: FoundKind;
  line: number;
  /** The text as written (JSX text normalised as React renders it; `${…}` for a template's holes). */
  text: string;
  /** True when the string is evaluated once, when its module loads (not inside a function). */
  moduleLevel: boolean;
  node: ts.Node;
}

/** JSX attributes whose value is shown to (or read out to) the player. */
export const TEXT_ATTRS = new Set([
  'title',
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'alt',
  'placeholder',
  'label',
  'heading',
  'subtitle',
  'caption',
  'hint',
  'tip',
  'tooltip',
  'text',
  'blurb',
  'note',
  'detail',
  'description',
  'summary',
  'prompt',
  'message',
  'confirm',
  'cta',
]);

/** JSX attributes that never hold player-facing text. */
const CODE_ATTR =
  /^(className|class|style|key|id|data-.*|ref|role|type|href|src|tabIndex|htmlFor|name|value|d|viewBox|fill|stroke.*|.*[Cc]olou?r|tone|variant|kind|icon|glyph|size|width|height|transform|points|xmlns|.*[Cc]lass(Name)?|testId|testid|mode|accent|align|side|variantId|as)$/;

/** Object keys whose values are code (classes, styles, ids), never player text. */
const CODE_KEY =
  /^(className|class|cls|style|key|id|testId|kind|type|tone|variant|icon|glyph|colou?r|accent|bg|border|ring|transform|d|path|easing|transition|font|fontFamily|background|boxShadow|filter|gridTemplate\w*|.*Class|.*ClassName|.*[Cc]olou?r|.*Bg|.*Border|.*Ring|.*Glow|.*Shadow|.*Gradient|.*Css|css|mask|clip|clipPath|textShadow|animation|code|keyCode|hotkey|sound|sfx|cue|motif|mood|href|url|src)$/;

/** Object keys whose values are player text even as a single word. */
const TEXT_KEY =
  /^(label|title|heading|subtitle|caption|hint|tip|tooltip|text|verb|cta|button|blurb|line|summary|description|desc|detail|note|placeholder|ariaLabel|short|long|prompt|message|headline|tagline|lede|body|subhead|action|word|noun|plural|singular)$/;

/** Calls whose string arguments are not player text. */
const CODE_CALL =
  /^(console\.\w+|Error|TypeError|RangeError|SyntaxError|t|tc|txt|localize|interpolate|cn|clsx|classNames|cx|require|RegExp|Symbol|.*\.(querySelector\w*|getElementById|addEventListener|removeEventListener|setAttribute|getAttribute|removeAttribute|setProperty|getPropertyValue|matchMedia|getItem|setItem|removeItem|includes|startsWith|endsWith|split|indexOf|lastIndexOf|has|get|delete|test|match|matchAll|search|postMessage|dispatchEvent|createElementNS|createElement|toLocaleString|toggle|add|remove|contains|replace|replaceAll|padStart|padEnd))$/;

const CSS_FUNC =
  /^-?(translate[XYZ3d]*|rotate[XYZ3d]*|scale[XYZ3d]*|matrix(3d)?|skew[XY]?|perspective|rgba?|hsla?|calc|min|max|clamp|url|var|linear-gradient|radial-gradient|conic-gradient|repeating-[a-z-]+|drop-shadow|blur|brightness|contrast|saturate|grayscale|sepia|invert|opacity|hue-rotate|cubic-bezier|steps|inset|polygon|circle|ellipse|repeat|minmax|fit-content|color-mix|from|to|in|oklch|oklab|lab|lch)\(/;
const CSS_WORD = new Set([
  'solid',
  'dashed',
  'dotted',
  'double',
  'none',
  'auto',
  'inset',
  'transparent',
  'currentColor',
  'currentcolor',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'linear',
  'infinite',
  'forwards',
  'backwards',
  'both',
  'alternate',
  'normal',
  'reverse',
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'at',
  'deg',
  'px',
  'rem',
  'em',
  'srgb',
  'oklab',
  'oklch',
  'important',
  '!important',
  'bold',
  'italic',
  'serif',
  'sans-serif',
  'monospace',
  'nowrap',
  'hidden',
  'visible',
  'absolute',
  'relative',
  'fixed',
  'opacity',
  'transform',
  'filter',
  'all',
  'cover',
  'contain',
  'no-repeat',
  'round',
  'butt',
  'square',
  'miter',
  'evenodd',
  'nonzero',
  'xMidYMid',
  'meet',
  'slice',
]);

/** A token of a CSS value: a number with or without a unit, a colour, a function, a keyword. */
function cssToken(tok: string): boolean {
  const s = tok.replace(/[,;)]+$/, '');
  if (s === '' || s === '/' || s === '+' || s === '-' || s === '*') return true;
  if (/^-?[\d.]+(px|rem|em|vh|vw|vmin|vmax|deg|rad|turn|ms|s|%|fr|ch|x)?$/.test(s)) return true;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return true;
  if (CSS_FUNC.test(s)) return true;
  if (/^var\(--[\w-]+/.test(s) || /^--[\w-]+:?$/.test(s)) return true;
  if (CSS_WORD.has(s)) return true;
  if (/^[\w-]+\(/.test(s) && !/[A-Z]/.test(s[0] ?? '')) return true; // any other function-like
  return false;
}

/** A Tailwind-style class list: lowercase tokens, at least one with a hyphen, colon or bracket. */
export function looksClass(s: string): boolean {
  const toks = s.trim().split(/\s+/);
  if (toks.some((tok) => PROSE_WORDS.has(tok.replace(/[,.:;!?]+$/, '')))) return false;
  return (
    toks.every((tok) => /^[a-z0-9:\-[\]/.%#_!()&>*+~=,'"@]+$/.test(tok)) &&
    toks.some((tok) => /-|\[|:[a-z[]/.test(tok))
  );
}

/** Words no class list holds, which mark a lowercase string as prose. */
const PROSE_WORDS = new Set(
  'a an the and or but not no of to in on at by for from with as is are was be it its this that these those their them they you your yours he she his her him we our us who what when where while than then once until into onto out up off over under each every all any some one two'.split(
    ' ',
  ),
);

/** An SVG path or a list of points. */
function svgPath(s: string): boolean {
  return /^[MLHVCSQTAZmlhvcsqtaz\d\s.,-]+$/.test(s.trim()) && /\d/.test(s);
}

/** Reads as prose: words of two or more letters with whitespace between, and not code. */
export function human(s: string): boolean {
  const text = s.trim();
  if (!/\s/.test(text) || !/[A-Za-z]{2,}/.test(text)) return false;
  if (looksClass(text)) return false;
  if (/^[a-z]+(\.[a-z]+)+$/.test(text)) return false;
  // A stylesheet: rules in braces.
  if (/[^{}]*\{[^{}]*:[^{}]*\}/.test(text) && /;/.test(text)) return false;
  const toks = text.split(/\s+/);
  if (toks.every(cssToken)) return false;
  if (svgPath(text)) return false;
  return true;
}

/** The text JSX gives a JSX text node, after its whitespace rules (as TypeScript and esbuild do). */
export function jsxText(raw: string): string {
  const lines = raw.split(/\r\n|\n|\r/);
  let lastNonEmpty = 0;
  for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i]!)) lastNonEmpty = i;
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!;
    if (i !== 0) line = line.replace(/^[ \t]+/, '');
    if (i !== lines.length - 1) line = line.replace(/[ \t]+$/, '');
    if (line) {
      if (i !== lastNonEmpty) line += ' ';
      out += line;
    }
  }
  return decodeEntities(out);
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  times: '×',
  middot: '·',
  rarr: '→',
  larr: '←',
  uarr: '↑',
  darr: '↓',
  bull: '•',
  deg: '°',
  plusmn: '±',
  minus: '−',
  thinsp: ' ',
  ensp: ' ',
  emsp: ' ',
  laquo: '«',
  raquo: '»',
  copy: '©',
  sect: '§',
  frac12: '½',
};

/** JSX text's HTML entities, decoded. An entity this table lacks throws, so nothing guesses. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body.startsWith('#x')) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
    const v = ENTITIES[body];
    if (v === undefined) throw new Error(`unknown JSX entity ${whole}`);
    return v;
  });
}

function isFunctionLike(n: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) ||
    ts.isSetAccessorDeclaration(n) ||
    ts.isConstructorDeclaration(n) ||
    ts.isPropertyDeclaration(n) ||
    ts.isClassStaticBlockDeclaration(n)
  );
}

export function isModuleLevel(n: ts.Node): boolean {
  for (let p = n.parent; p; p = p.parent) if (isFunctionLike(p)) return false;
  return true;
}

/** The expression a value is used as, past parentheses, casts and value-choosing operators. */
export function useSite(n: ts.Node): ts.Node {
  let cur = n;
  for (;;) {
    const p = cur.parent;
    if (!p) return cur;
    if (
      ts.isParenthesizedExpression(p) ||
      ts.isAsExpression(p) ||
      ts.isSatisfiesExpression(p) ||
      ts.isNonNullExpression(p) ||
      ts.isTypeAssertionExpression(p) ||
      (ts.isConditionalExpression(p) && p.condition !== cur) ||
      (ts.isBinaryExpression(p) &&
        [
          ts.SyntaxKind.QuestionQuestionToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.AmpersandAmpersandToken,
        ].includes(p.operatorToken.kind) &&
        !(p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && p.left === cur))
    ) {
      cur = p;
      continue;
    }
    return cur;
  }
}

function calleeName(e: ts.Expression): string {
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return `${calleeName(e.expression)}.${e.name.text}`;
  if (ts.isCallExpression(e)) return `${calleeName(e.expression)}()`;
  return '?';
}

function propName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
    return name.text;
  return null;
}

/** Where a string sits, judged from the expression it is used as. */
type Ctx = { skip: true } | { skip: false; textual: boolean };

function context(n: ts.Node): Ctx {
  // Anything inside a `style={…}` attribute, a type, or an import.
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) {
      const name = p.name.getText();
      if (name === 'style' || name === 'className') return { skip: true };
    }
    if (ts.isTypeNode(p) && !ts.isExpressionWithTypeArguments(p)) return { skip: true };
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isImportTypeNode(p))
      return { skip: true };
    if (ts.isTaggedTemplateExpression(p)) return { skip: true };
    if (ts.isEnumMember(p)) return { skip: true };
    if (isFunctionLike(p) || ts.isSourceFile(p)) break;
  }
  const site = useSite(n);
  const p = site.parent;
  if (!p) return { skip: true };
  if (ts.isExpressionStatement(p)) return { skip: true }; // 'use strict' and the like
  if (ts.isPropertyAssignment(p) && p.name === site) return { skip: true };
  if (ts.isComputedPropertyName(p) || ts.isElementAccessExpression(p)) return { skip: true };
  if (ts.isCaseClause(p)) return { skip: true };
  if (ts.isBinaryExpression(p)) {
    const op = p.operatorToken.kind;
    if (
      op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      op === ts.SyntaxKind.EqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsToken ||
      op === ts.SyntaxKind.InKeyword ||
      op === ts.SyntaxKind.InstanceOfKeyword
    )
      return { skip: true };
  }
  if ((ts.isCallExpression(p) || ts.isNewExpression(p)) && p.expression !== site) {
    if (CODE_CALL.test(calleeName(p.expression))) return { skip: true };
  }
  if (ts.isJsxAttribute(p) || (ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent))) {
    const attr = ts.isJsxAttribute(p) ? p : (p.parent as ts.JsxAttribute);
    const name = attr.name.getText();
    if (TEXT_ATTRS.has(name)) return { skip: false, textual: true };
    if (CODE_ATTR.test(name)) return { skip: true };
    return { skip: false, textual: false };
  }
  if (ts.isPropertyAssignment(p)) {
    const key = propName(p.name);
    if (key !== null && CODE_KEY.test(key)) return { skip: true };
    if (key !== null && TEXT_KEY.test(key)) return { skip: false, textual: true };
  }
  return { skip: false, textual: false };
}

/** Calls that fill a message's `{placeholders}` (`t(key, params)` under its local names). */
const MESSAGE_CALL = /^(t|txt|tt)$/;

/**
 * Is this string a value handed into a message's parameters (`t(key, { value: n === 1 ? 'stop' :
 * 'stops' })`)? Every word of it reaches the player inside the translated message, so even a
 * single word counts: words belong in the catalogue, chosen by key or `plural`.
 */
function inMessageParams(n: ts.Node): boolean {
  const site = useSite(n);
  const p = site.parent;
  if (!p || !ts.isPropertyAssignment(p) || p.initializer !== site) return false;
  const obj = p.parent;
  const call = obj.parent;
  return (
    !!call &&
    ts.isCallExpression(call) &&
    call.arguments[1] === obj &&
    ts.isIdentifier(call.expression) &&
    MESSAGE_CALL.test(call.expression.text)
  );
}

/** A template's text with `${…}` in its holes. */
export function templateText(n: ts.TemplateExpression): string {
  return n.head.text + n.templateSpans.map((s) => '${…}' + s.literal.text).join('');
}

/** The literal player-facing strings of one source file, in source order. */
export function scanSource(fileName: string, source: string): Found[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out: Found[] = [];
  const add = (kind: FoundKind, node: ts.Node, text: string) =>
    out.push({
      kind,
      node,
      text,
      line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
      moduleLevel: isModuleLevel(node),
    });
  const visit = (n: ts.Node): void => {
    if (ts.isJsxText(n)) {
      const text = jsxText(n.text);
      if (/[A-Za-z]/.test(text)) add('jsx', n, text);
      return;
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const ctx = context(n);
      if (!ctx.skip) {
        const attr = n.parent && ts.isJsxAttribute(n.parent);
        const text = n.text;
        const textual =
          ctx.textual && /[A-Za-z]/.test(text) && (attr || /^[A-Z]/.test(text)) && !svgPath(text);
        if (textual || human(text) || (inMessageParams(n) && /[A-Za-z]/.test(text)))
          add(attr ? 'attr' : 'literal', n, text);
      }
      return;
    }
    if (ts.isTemplateExpression(n)) {
      const ctx = context(n);
      if (!ctx.skip) {
        const text = templateText(n);
        const words = text.replace(/\$\{…\}/g, ' ');
        if (
          (ctx.textual && /[A-Za-z]{2,}/.test(words)) ||
          human(words) ||
          (inMessageParams(n) && /[A-Za-z]/.test(words))
        )
          add('template', n, text);
      }
      // Holes may hold strings of their own.
      for (const s of n.templateSpans) visit(s.expression);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** The files the ratchet covers: `src/ui/**` but the labs and the text layer itself. */
export function uiFiles(root = ROOT): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== 'lab' && name !== 'text') walk(p);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) {
        out.push(relative(root, p));
      }
    }
  };
  walk(join(root, 'src/ui'));
  return out;
}

/** Each covered file's count of literal player-facing strings (files with none included). */
export function counts(root = ROOT): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of uiFiles(root)) out[f] = scanSource(f, readFileSync(join(root, f), 'utf8')).length;
  return out;
}

export function readBaseline(): Record<string, number> {
  return JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, number>;
}

/** The ratchet's findings: files whose count rose above the baseline (or that it lacks). */
export function ratchet(
  now: Record<string, number>,
  base: Record<string, number>,
): { file: string; count: number; allowed: number }[] {
  const bad: { file: string; count: number; allowed: number }[] = [];
  for (const [file, count] of Object.entries(now)) {
    const allowed = base[file] ?? 0;
    if (count > allowed) bad.push({ file, count, allowed });
  }
  return bad;
}

function writeBaseline(next: Record<string, number>): void {
  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE, `${JSON.stringify(sorted, null, 2)}\n`);
}

function main(argv: string[]): number {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const files = argv.filter((a) => !a.startsWith('--'));
  if (flags.has('--check') || flags.has('--write-baseline') || flags.has('--rebase')) {
    const now = counts();
    let base: Record<string, number>;
    try {
      base = readBaseline();
    } catch {
      base = {};
    }
    if (flags.has('--rebase')) {
      writeBaseline(now);
      console.log(`baseline recorded: ${Object.values(now).reduce((a, b) => a + b, 0)} strings`);
      return 0;
    }
    const bad = ratchet(now, base);
    for (const b of bad)
      console.log(`${b.file}: ${b.count} strings, the baseline allows ${b.allowed}`);
    if (flags.has('--write-baseline')) {
      if (bad.length > 0) {
        console.log('not written: counts may only fall');
        return 1;
      }
      const next: Record<string, number> = {};
      for (const [f, c] of Object.entries(now)) if (c > 0 || f in base) next[f] = c;
      writeBaseline(next);
      console.log(`baseline lowered: ${Object.values(next).reduce((a, b) => a + b, 0)} strings`);
      return 0;
    }
    console.log(bad.length === 0 ? 'strings: within the baseline' : 'strings: above the baseline');
    return bad.length === 0 ? 0 : 1;
  }
  const list = flags.has('--all') ? uiFiles() : files;
  if (list.length === 0) {
    const now = counts();
    let total = 0;
    for (const [f, c] of Object.entries(now)) {
      total += c;
      if (c > 0) console.log(`${String(c).padStart(5)}  ${f}`);
    }
    console.log(`${String(total).padStart(5)}  total`);
    return 0;
  }
  for (const f of list) {
    const found = scanSource(f, readFileSync(resolve(ROOT, f), 'utf8'));
    for (const s of found)
      console.log(
        `${f}:${s.line}\t${s.kind}${s.moduleLevel ? '*' : ''}\t${JSON.stringify(s.text)}`,
      );
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
