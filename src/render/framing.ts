/**
 * Boss-fight framing (docs/phase-8.md, 8c): where the follow camera should lean, and how far it
 * should pull back, so the boss, the heroes and the Weaver all stand in the part of the screen the
 * interface leaves free. Pure geometry: no three.js, no DOM, no clock. `CameraRig` eases toward
 * what this returns and never lets the lean take the Weaver out of the safe area.
 *
 * The camera has a fixed pitch and no yaw, so north (−z) is up the screen and the two axes are
 * solved one after the other: each figure allows the focus an interval along z (its head under the
 * safe area's top, its feet over the bottom), then along x. The intervals are narrowed in order of
 * who matters most (the Weaver, the heroes already in view, the boss, the heroes out of view), and
 * the focus goes to the allowed point nearest where the camera would be anyway: no lean at all when
 * everyone is already in view.
 */

/** A figure to keep in view: where it stands and how big it is drawn (metres). */
export interface FrameSubject {
  x: number;
  z: number;
  radius: number;
  height: number;
}

/**
 * The part of the screen the interface leaves free, in fractions of the view from its top left
 * (`top` 0.2: the free part starts a fifth of the way down). The corners are panels that reach in
 * from an edge without spanning it: a figure whose feet are lower than `bottomLeft.y` keeps right
 * of `bottomLeft.x` (the party frames), one whose head is higher than `topRight.y` keeps left of
 * `topRight.x`, and likewise `topLeft`.
 */
export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
  bottomLeft?: { x: number; y: number };
  topLeft?: { x: number; y: number };
  topRight?: { x: number; y: number };
  /**
   * Something standing on the bottom panel over part of its width (the Thread dial on the Weaver
   * bar): a figure in the columns `x0`..`x1` keeps its feet above `y` instead of `bottom`.
   */
  bottomNotch?: { x0: number; x1: number; y: number };
}

/** With no panel measured: a thin margin all round. */
export const OPEN_SAFE_AREA: Readonly<SafeArea> = {
  top: 0.03,
  bottom: 0.97,
  left: 0.02,
  right: 0.98,
};

export interface FramingInput {
  weaver: FrameSubject;
  heroes: readonly FrameSubject[];
  bosses: readonly FrameSubject[];
  /** Where the camera would look without framing (the Weaver, with its look-ahead). */
  focusX: number;
  focusZ: number;
  /** The camera's distance before any pull-back (the player's zoom), its pitch and its lens. */
  distance: number;
  pitch: number;
  /** tan(vertical field of view / 2), and width / height. */
  tanHalfFov: number;
  aspect: number;
  safe: Readonly<SafeArea>;
  /** The furthest the camera may pull back, as a factor on `distance` (1: never). */
  maxPull: number;
}

export interface Framing {
  /** Metres to add to the focus. */
  leanX: number;
  leanZ: number;
  /** Factor on the camera's distance (1: as the player set it). */
  pull: number;
}

/**
 * How much of a hero may leave the safe area before they count as out of view: a hero already in
 * view is never pushed further out than this by the lean, and the pull-back lets their feet dip
 * this far under the bottom. The Weaver and a boss's head get no such slack.
 */
export const VIEW_SLACK = 0.2;

interface Lens {
  s: number;
  c: number;
  t: number;
  a: number;
  d: number;
}

/**
 * How far north of a point at height `y` the focus may be for the point to sit at `ndc` on the
 * screen's vertical axis (−1 bottom, 1 top): `fz − z`. Linear in the distance.
 */
function reach(l: Lens, ndc: number, y: number): number {
  return (ndc * l.t * (l.d - y * l.s) - y * l.c) / (l.s - ndc * l.t * l.c);
}

/** The focus z a figure allows, written to `out` as [least, most] (north is −z). */
function zInterval(
  l: Lens,
  f: FrameSubject,
  top: number,
  bottom: number,
  slack: number,
  out: [number, number],
): void {
  // Its feet (the near edge of its base) over the bottom, its head (the far edge) under the top.
  out[0] = f.z + f.radius + reach(l, bottom, f.height * slack);
  out[1] = f.z - f.radius + reach(l, top, f.height * (1 - slack));
}

/** Narrows [lo, hi] to its overlap with `j`, or to its end nearest `j` when they don't meet. */
function narrow(i: [number, number], j: readonly [number, number]): void {
  if (j[0] > i[1]) i[0] = i[1];
  else if (j[1] < i[0]) i[1] = i[0];
  else {
    i[0] = Math.max(i[0], j[0]);
    i[1] = Math.min(i[1], j[1]);
  }
}

const contains = (j: readonly [number, number], v: number): boolean => j[0] <= v && v <= j[1];
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const strict: [number, number] = [0, 0];
const loose: [number, number] = [0, 0];
const allowed: [number, number] = [0, 0];
const later: FrameSubject[] = [];

/** The focus x a figure allows once the focus z is `fz`. */
function xInterval(
  l: Lens,
  f: FrameSubject,
  fz: number,
  safe: Readonly<SafeArea>,
  slack: number,
  out: [number, number],
  corners = true,
): void {
  const u = fz - f.z;
  const depth = l.d + u * l.c - 0.5 * f.height * l.s;
  const half = depth * l.t * l.a;
  // Where its feet and its head fall on the screen (fractions from the top), for the corners.
  const feet = 0.5 - (0.5 * ((u - f.radius) * l.s)) / ((l.d + (u - f.radius) * l.c) * l.t);
  const headUp = (u + f.radius) * l.s + f.height * l.c;
  const head = 0.5 - (0.5 * headUp) / ((l.d + (u + f.radius) * l.c - f.height * l.s) * l.t);
  let left = safe.left;
  let right = safe.right;
  if (corners) {
    if (safe.bottomLeft && feet > safe.bottomLeft.y) left = Math.max(left, safe.bottomLeft.x);
    if (safe.topLeft && head < safe.topLeft.y) left = Math.max(left, safe.topLeft.x);
    if (safe.topRight && head < safe.topRight.y) right = Math.min(right, safe.topRight.x);
  }
  const r = f.radius * (1 - 2 * slack);
  out[0] = f.x + r - (right * 2 - 1) * half;
  out[1] = f.x - r - (left * 2 - 1) * half;
  if (out[0] > out[1]) out[0] = out[1] = (out[0] + out[1]) / 2;
}

/**
 * The distance at which everyone fits between the safe area's top and bottom, and across it.
 * Never less than `distance`.
 */
function distanceToFit(input: FramingInput, l: Lens): number {
  const { safe } = input;
  const top = 1 - 2 * safe.top;
  const bottom = 1 - 2 * safe.bottom;
  // reach(ndc, y) = alpha(ndc) * d - y * beta(ndc)
  const alphaTop = (top * l.t) / (l.s - top * l.t * l.c);
  const betaTop = (top * l.t * l.s + l.c) / (l.s - top * l.t * l.c);
  const alphaBottom = (bottom * l.t) / (l.s - bottom * l.t * l.c);
  const betaBottom = (bottom * l.t * l.s + l.c) / (l.s - bottom * l.t * l.c);
  let south = -Infinity;
  let north = Infinity;
  let west = Infinity;
  let east = -Infinity;
  // Heads wholly under the top; a hero's feet may dip `VIEW_SLACK` under the bottom.
  const take = (f: FrameSubject, slack: number): void => {
    south = Math.max(south, f.z + f.radius - f.height * slack * betaBottom);
    north = Math.min(north, f.z - f.radius - f.height * betaTop);
    west = Math.min(west, f.x - f.radius);
    east = Math.max(east, f.x + f.radius);
  };
  take(input.weaver, 0);
  for (const f of input.heroes) take(f, VIEW_SLACK);
  for (const f of input.bosses) take(f, 0);
  const deep = (south - north) / (alphaTop - alphaBottom);
  const wide = (east - west) / ((safe.right - safe.left) * 2 * l.t * l.a);
  return Math.max(input.distance, deep, wide);
}

/** The safe area's bottom for a figure (as −1..1): the notch's where it stands in its columns. */
function bottomFor(
  input: FramingInput,
  l: Lens,
  f: FrameSubject,
  bottom: number,
  fx: number,
  fz: number,
): number {
  const notch = input.safe.bottomNotch;
  if (!notch || Number.isNaN(fx)) return bottom;
  return bottomNotchFor(notch, l, f, bottom, fx, fz);
}

function bottomNotchFor(
  notch: NonNullable<SafeArea['bottomNotch']>,
  l: Lens,
  f: FrameSubject,
  bottom: number,
  fx: number,
  fz: number,
): number {
  const half = (l.d + (fz - f.z) * l.c) * l.t * l.a;
  const lo = 0.5 + (0.5 * (f.x - f.radius - fx)) / half;
  const hi = 0.5 + (0.5 * (f.x + f.radius - fx)) / half;
  return hi > notch.x0 && lo < notch.x1 ? Math.max(bottom, 1 - 2 * notch.y) : bottom;
}

/** The focus z nearest the camera's own that the figures allow, in order of who matters most. */
function solveZ(input: FramingInput, l: Lens, top: number, bottom: number, fx: number): number {
  const at = input.focusZ;
  // The Weaver first: wholly in the safe area, whatever else happens.
  zInterval(l, input.weaver, top, bottomFor(input, l, input.weaver, bottom, fx, at), 0, allowed);
  if (allowed[0] > allowed[1]) allowed[0] = allowed[1] = (allowed[0] + allowed[1]) / 2;
  const z0 = clamp(input.focusZ, allowed[0], allowed[1]);
  later.length = 0;
  for (const h of input.heroes) {
    // A hero in view before any lean stays in view (all but `VIEW_SLACK` of them).
    zInterval(l, h, top, bottomFor(input, l, h, bottom, fx, at), VIEW_SLACK, loose);
    if (contains(loose, z0)) narrow(allowed, loose);
    else later.push(h);
  }
  for (const b of input.bosses) {
    // All of the boss if it can be had; if not, as much as the Weaver and those heroes allow
    // (`narrow` goes to the allowed end nearest the boss).
    zInterval(l, b, top, bottomFor(input, l, b, bottom, fx, at), 0, strict);
    narrow(allowed, strict);
  }
  for (const h of later) {
    zInterval(l, h, top, bottomFor(input, l, h, bottom, fx, at), VIEW_SLACK, loose);
    narrow(allowed, loose);
  }
  return clamp(z0, allowed[0], allowed[1]);
}

/** The focus x likewise, once the focus z is `fz`. */
function solveX(input: FramingInput, l: Lens, fz: number): number {
  const { safe } = input;
  xInterval(l, input.weaver, fz, safe, 0, allowed);
  const x0 = clamp(input.focusX, allowed[0], allowed[1]);
  later.length = 0;
  for (const h of input.heroes) {
    xInterval(l, h, fz, safe, VIEW_SLACK, loose);
    if (contains(loose, x0)) narrow(allowed, loose);
    else later.push(h);
  }
  for (const b of input.bosses) {
    xInterval(l, b, fz, safe, 0, strict);
    narrow(allowed, strict);
  }
  for (const h of later) {
    xInterval(l, h, fz, safe, VIEW_SLACK, loose);
    narrow(allowed, loose);
  }
  return clamp(x0, allowed[0], allowed[1]);
}

/** The lean and pull-back that best frame the fight. */
export function frameFight(input: FramingInput, out: Framing): Framing {
  const l: Lens = {
    s: Math.sin(input.pitch),
    c: Math.cos(input.pitch),
    t: input.tanHalfFov,
    a: input.aspect,
    d: input.distance,
  };
  out.leanX = 0;
  out.leanZ = 0;
  out.pull = 1;
  if (input.bosses.length === 0) return out;
  const { safe } = input;
  out.pull = clamp(distanceToFit(input, l) / input.distance, 1, Math.max(1, input.maxPull));
  l.d = input.distance * out.pull;
  const top = 1 - 2 * safe.top;
  const bottom = 1 - 2 * safe.bottom;

  // North and south, then east and west at that depth, then north and south once more now that
  // each figure's column is known (the bottom's notch).
  let fz = solveZ(input, l, top, bottom, NaN);
  const fx = solveX(input, l, fz);
  if (safe.bottomNotch) fz = solveZ(input, l, top, bottom, fx);
  out.leanZ = fz - input.focusZ;
  out.leanX = fx - input.focusX;
  return out;
}

/**
 * The lean nearest (`leanX`, `leanZ`) that keeps the Weaver wholly in the safe area at this
 * distance: what the rig applies every frame, however far its eased lean lags behind.
 */
export function keepWeaverInView(
  input: Omit<FramingInput, 'heroes' | 'bosses' | 'maxPull'>,
  leanX: number,
  leanZ: number,
  out: { leanX: number; leanZ: number },
): void {
  const l: Lens = {
    s: Math.sin(input.pitch),
    c: Math.cos(input.pitch),
    t: input.tanHalfFov,
    a: input.aspect,
    d: input.distance,
  };
  // The plain rectangle only: a corner or the notch would make this limit jump as she crossed
  // its line, and the camera with it. The eased framing keeps her clear of those.
  const low = 1 - 2 * input.safe.bottom;
  zInterval(l, input.weaver, 1 - 2 * input.safe.top, low, 0, allowed);
  if (allowed[0] > allowed[1]) allowed[0] = allowed[1] = (allowed[0] + allowed[1]) / 2;
  const fz = clamp(input.focusZ + leanZ, allowed[0], allowed[1]);
  xInterval(l, input.weaver, fz, input.safe, 0, allowed, false);
  out.leanZ = fz - input.focusZ;
  out.leanX = clamp(input.focusX + leanX, allowed[0], allowed[1]) - input.focusX;
}
