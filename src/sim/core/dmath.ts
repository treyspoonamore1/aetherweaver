/**
 * Deterministic math for the simulation.
 *
 * ECMAScript only guarantees exact results for + - * / and Math.sqrt/round/floor/abs/min/max.
 * Transcendental functions (sin, cos, atan2, pow, hypot…) are "implementation-approximated"
 * and may differ in the last bit between engines, which would break browser↔Node replays.
 * Everything here is built from exact operations only. ESLint bans the Math.* versions in
 * src/sim and src/content.
 */

export const PI = 3.141592653589793;
export const TWO_PI = 6.283185307179586;
export const HALF_PI = 1.5707963267948966;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Length of (x, z). Math.sqrt is exactly rounded; Math.hypot is not. */
export function len(x: number, z: number): number {
  return Math.sqrt(x * x + z * z);
}

export function distSq(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

/** sin(x), |error| < 1e-7. Range-reduced, then an odd Taylor polynomial on [-π/2, π/2]. */
export function dsin(x: number): number {
  let r = x - TWO_PI * Math.round(x / TWO_PI);
  if (r > HALF_PI) r = PI - r;
  else if (r < -HALF_PI) r = -PI - r;
  const r2 = r * r;
  return (
    r *
    (1 +
      r2 * (-1 / 6 + r2 * (1 / 120 + r2 * (-1 / 5040 + r2 * (1 / 362880 + r2 * (-1 / 39916800))))))
  );
}

export function dcos(x: number): number {
  return dsin(x + HALF_PI);
}

/** atan(z) for z in [0, 1] (Abramowitz & Stegun 4.4.47, |error| ≤ 1e-5). */
function atanUnit(z: number): number {
  const z2 = z * z;
  return z * (0.999866 + z2 * (-0.3302995 + z2 * (0.180141 + z2 * (-0.085133 + z2 * 0.0208351))));
}

/** atan2(y, x), |error| ≤ 1e-5 rad. */
export function datan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const swap = ay > ax;
  let a = atanUnit(swap ? ax / ay : ay / ax);
  if (swap) a = HALF_PI - a;
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}

/**
 * Quantize a value to a fixed grid. Inputs that enter the sim (move vectors, aim points)
 * are quantized so replays stay compact and exact.
 */
export function quantize(v: number, step: number): number {
  // `+ 0` turns -0 into +0: the sim hashes exact float bits, and JSON can't carry -0.
  return Math.round(v / step) * step + 0;
}

/**
 * Rotates the unit vector (hx, hz) toward the unit vector (tx, tz) by at most `maxAngle`
 * radians and writes the result into `out`. Exact reversals turn toward a fixed side.
 */
export function rotateToward(
  hx: number,
  hz: number,
  tx: number,
  tz: number,
  maxAngle: number,
  out: { x: number; z: number },
): void {
  const c = dcos(maxAngle);
  const dot = hx * tx + hz * tz;
  if (dot >= c) {
    out.x = tx;
    out.z = tz;
    return;
  }
  const s = dsin(maxAngle) * (hx * tz - hz * tx >= 0 ? 1 : -1);
  const nx = hx * c - hz * s;
  const nz = hx * s + hz * c;
  const m = len(nx, nz);
  out.x = nx / m;
  out.z = nz / m;
}
