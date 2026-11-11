import * as THREE from 'three';

/**
 * Procedural low-poly model builder. Primitives are transformed and merged into ONE
 * non-indexed BufferGeometry with per-vertex `color` and `aGlow` (emissive share), so each
 * model renders in a single (instanced) draw call with one shared material.
 */
export interface PartOptions {
  /** 0 = matte body, 1 = fully emissive accent. */
  glow?: number;
  p?: [number, number, number];
  r?: [number, number, number];
  s?: [number, number, number] | number;
  /**
   * Secondary motion (material.ts, `RIG`): the part moves in the vertex shader about `at` (model
   * space, feet at y = 0) by kind `k`, scaled by `a`. Rigid parts of one model share a pivot.
   */
  rig?: { k: number; at: [number, number, number]; a?: number };
  /**
   * Stained glass (a `glass` builder only): the part's leading. 1 dark lead between its panes (the
   * default), 2 gold came (the Weaver's own), 0 none (a face, a smooth glaze).
   */
  lead?: number;
  /** Stained glass: a dark outline shell round the part (default on in a `glass` builder). */
  shell?: boolean;
  /** Stained glass: the share of the part's panes lit from inside (glow `litGlow`). */
  lit?: number;
  litGlow?: number;
  /** Stained glass: how much each pane's glass differs in tone from its neighbours (default 0.07). */
  jit?: number;
  /**
   * Stained glass: cut the part into irregular panes about `cell` metres across (in the shader),
   * `lit` of them lit from inside; with `lead` 3 (porcelain), `lit` of their borders crack violet.
   */
  cell?: number;
}

interface Part {
  geometry: THREE.BufferGeometry;
  color: THREE.Color;
  glow: number;
  matrix: THREE.Matrix4;
  rig: [number, number, number, number, number];
  lead: number;
  shell: boolean;
  lit: number;
  litGlow: number;
  jit: number;
  cell: number;
}

/** A small deterministic hash in [0, 1) (pane tones, lit panes). */
function hash01(a: number, b: number): number {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

const Q = 1e4;
function vkey(p: Float32Array | ArrayLike<number>, i: number): string {
  return `${Math.round(p[i * 3]! * Q)},${Math.round(p[i * 3 + 1]! * Q)},${Math.round(p[i * 3 + 2]! * Q)}`;
}

/**
 * The panes of a triangle soup: triangles joined across a shared, coplanar edge are one pane (a
 * box face, a lathe facet, a cylinder cap). Returns, per triangle, its pane index and which of its
 * three edges are soft (inside a pane: no lead), and per vertex position a smoothed normal.
 */
function panesOf(pos: ArrayLike<number>, count: number) {
  const tris = count / 3;
  const fn = new Float32Array(tris * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const keys: string[] = new Array(count);
  for (let i = 0; i < count; i++) keys[i] = vkey(pos, i);
  const smooth = new Map<string, THREE.Vector3>();
  for (let t = 0; t < tris; t++) {
    a.set(pos[t * 9]!, pos[t * 9 + 1]!, pos[t * 9 + 2]!);
    b.set(pos[t * 9 + 3]!, pos[t * 9 + 4]!, pos[t * 9 + 5]!);
    c.set(pos[t * 9 + 6]!, pos[t * 9 + 7]!, pos[t * 9 + 8]!);
    b.sub(a);
    c.sub(a);
    b.cross(c);
    const len = b.length();
    if (len > 1e-10) b.multiplyScalar(1 / len);
    else b.set(0, 0, 0);
    fn[t * 3] = b.x;
    fn[t * 3 + 1] = b.y;
    fn[t * 3 + 2] = b.z;
    if (len > 1e-10)
      for (let k = 0; k < 3; k++) {
        const key = keys[t * 3 + k]!;
        const v = smooth.get(key);
        if (v) v.add(b);
        else smooth.set(key, b.clone());
      }
  }
  const edges = new Map<string, number[]>();
  for (let t = 0; t < tris; t++)
    for (let e = 0; e < 3; e++) {
      // Edge e lies opposite vertex e.
      const k1 = keys[t * 3 + ((e + 1) % 3)]!;
      const k2 = keys[t * 3 + ((e + 2) % 3)]!;
      if (k1 === k2) continue;
      const key = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      const list = edges.get(key);
      if (list) list.push(t * 3 + e);
      else edges.set(key, [t * 3 + e]);
    }
  const parent = new Int32Array(tris);
  for (let t = 0; t < tris; t++) parent[t] = t;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  const soft = new Uint8Array(tris * 3);
  for (const list of edges.values()) {
    if (list.length !== 2) continue;
    const t1 = (list[0]! / 3) | 0;
    const t2 = (list[1]! / 3) | 0;
    const dot =
      fn[t1 * 3]! * fn[t2 * 3]! +
      fn[t1 * 3 + 1]! * fn[t2 * 3 + 1]! +
      fn[t1 * 3 + 2]! * fn[t2 * 3 + 2]!;
    const degenerate =
      (fn[t1 * 3] === 0 && fn[t1 * 3 + 1] === 0 && fn[t1 * 3 + 2] === 0) ||
      (fn[t2 * 3] === 0 && fn[t2 * 3 + 1] === 0 && fn[t2 * 3 + 2] === 0);
    if (dot > 0.9995 || degenerate) {
      soft[list[0]!] = 1;
      soft[list[1]!] = 1;
      parent[find(t1)] = find(t2);
    }
  }
  const pane = new Int32Array(tris);
  const ids = new Map<number, number>();
  for (let t = 0; t < tris; t++) {
    const r = find(t);
    let id = ids.get(r);
    if (id === undefined) ids.set(r, (id = ids.size));
    pane[t] = id;
  }
  for (const v of smooth.values()) v.normalize();
  return { pane, soft, keys, smooth, fn };
}

function rigOf(r: PartOptions['rig']): Part['rig'] {
  return r ? [r.k, r.at[0], r.at[1], r.at[2], r.a ?? 1] : [0, 0, 0, 0, 0];
}

const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

export class ModelBuilder {
  private readonly parts: Part[] = [];
  private group: PartOptions['rig'] = undefined;

  /**
   * `glass`: build as stained glass (the art pass): each part's flat panes keep a lead line between
   * them in the material (`aBary`), each pane's glass differs a little in tone, a share of panes can
   * be lit from inside, and a dark outline shell (the part's faces turned inside out, pushed out by
   * a constant on-screen width in the vertex shader) leads the whole figure. One geometry, one draw.
   */
  constructor(private readonly glass = false) {}

  /** Every part added inside `fn` moves with `rig` (unless it names its own). */
  rigged(rig: NonNullable<PartOptions['rig']>, fn: () => void): this {
    const before = this.group;
    this.group = rig;
    fn();
    this.group = before;
    return this;
  }

  add(geometry: THREE.BufferGeometry, hex: string | THREE.Color, opts: PartOptions = {}): this {
    const matrix = new THREE.Matrix4();
    const p = opts.p ?? [0, 0, 0];
    const r = opts.r ?? [0, 0, 0];
    const s = opts.s ?? 1;
    tmpPos.set(p[0], p[1], p[2]);
    tmpQuat.setFromEuler(tmpEuler.set(r[0], r[1], r[2]));
    if (typeof s === 'number') tmpScale.set(s, s, s);
    else tmpScale.set(s[0], s[1], s[2]);
    matrix.compose(tmpPos, tmpQuat, tmpScale);
    this.parts.push({
      geometry,
      color: typeof hex === 'string' ? new THREE.Color(hex) : hex.clone(),
      glow: opts.glow ?? 0,
      matrix,
      rig: rigOf(opts.rig ?? this.group),
      lead: this.glass ? (opts.lead ?? 1) : 0,
      shell: this.glass && (opts.shell ?? true),
      lit: opts.lit ?? 0,
      litGlow: opts.litGlow ?? 0.6,
      jit: this.glass ? (opts.jit ?? 0.07) : 0,
      cell: this.glass ? (opts.cell ?? 0) : 0,
    });
    return this;
  }

  box(w: number, h: number, d: number, hex: string, opts?: PartOptions): this {
    return this.add(new THREE.BoxGeometry(w, h, d), hex, opts);
  }

  cyl(rTop: number, rBottom: number, h: number, hex: string, opts?: PartOptions, seg = 8): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1), hex, opts);
  }

  sphere(r: number, hex: string, opts?: PartOptions, w = 8, h = 6): this {
    return this.add(new THREE.SphereGeometry(r, w, h), hex, opts);
  }

  ico(r: number, hex: string, opts?: PartOptions, detail = 0): this {
    return this.add(new THREE.IcosahedronGeometry(r, detail), hex, opts);
  }

  octa(r: number, hex: string, opts?: PartOptions): this {
    return this.add(new THREE.OctahedronGeometry(r, 0), hex, opts);
  }

  torus(
    r: number,
    tube: number,
    hex: string,
    opts?: PartOptions,
    arc = Math.PI * 2,
    seg = 16,
  ): this {
    return this.add(new THREE.TorusGeometry(r, tube, 4, seg, arc), hex, opts);
  }

  cone(r: number, h: number, hex: string, opts?: PartOptions, seg = 8): this {
    return this.add(new THREE.ConeGeometry(r, h, seg, 1), hex, opts);
  }

  /** An open slice of a (tapered) cylinder: a cloak or a train, `start`..`start + len` rad round. */
  arc(
    rTop: number,
    rBottom: number,
    h: number,
    start: number,
    len: number,
    hex: string,
    opts?: PartOptions,
    seg = 6,
  ): this {
    // Open: no outline shell (its inside would show), and an inner face so it is seen from both sides.
    const o = { ...opts, shell: false };
    this.add(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, true, start, len), hex, o);
    const inner = new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, true, start, len);
    const idx = inner.index!.array as Uint16Array | Uint32Array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1]!;
      idx[i + 1] = idx[i + 2]!;
      idx[i + 2] = t;
    }
    return this.add(inner, hex, o);
  }

  /** Lathe profile: [radius, y] pairs from bottom to top. */
  lathe(profile: [number, number][], hex: string, opts?: PartOptions, seg = 10): this {
    const pts = profile.map(([x, y]) => new THREE.Vector2(x, y));
    return this.add(new THREE.LatheGeometry(pts, seg), hex, opts);
  }

  build(): THREE.BufferGeometry {
    let vertexCount = 0;
    const prepared: {
      geo: THREE.BufferGeometry;
      part: Part;
      panes: ReturnType<typeof panesOf> | null;
    }[] = [];
    for (const part of this.parts) {
      const geo = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      geo.applyMatrix4(part.matrix);
      const n = geo.getAttribute('position').count;
      const panes =
        part.lead > 0 || part.shell ? panesOf(geo.getAttribute('position').array, n) : null;
      prepared.push({ geo, part, panes });
      vertexCount += n * (part.shell ? 2 : 1);
    }
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const glows = new Float32Array(vertexCount);
    const rigs = new Float32Array(vertexCount * 4);
    const misc = new Float32Array(vertexCount * 4);
    const bary = new Float32Array(vertexCount * 3);
    const tone = new THREE.Color();
    let offset = 0;
    let partIndex = 0;
    for (const { geo, part, panes } of prepared) {
      partIndex++;
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      geo.computeVertexNormals();
      const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
      const put = (o: number, i: number, shell: boolean, k: number) => {
        positions[o * 3] = pos.getX(i);
        positions[o * 3 + 1] = pos.getY(i);
        positions[o * 3 + 2] = pos.getZ(i);
        const g = o * 4;
        rigs[g] = part.rig[0];
        rigs[g + 1] = part.rig[1];
        rigs[g + 2] = part.rig[2];
        rigs[g + 3] = part.rig[3];
        misc[g] = part.rig[4];
        misc[g + 1] = part.lead + (part.cell > 0 ? Math.min(0.95, part.lit) : 0);
        misc[g + 2] = shell ? 1 : 0;
        misc[g + 3] = part.cell;
        const t = (i / 3) | 0;
        if (shell) {
          const sm = panes!.smooth.get(panes!.keys[i]!);
          const nx = sm ? sm.x : panes!.fn[t * 3]!;
          const ny = sm ? sm.y : panes!.fn[t * 3 + 1]!;
          const nz = sm ? sm.z : panes!.fn[t * 3 + 2]!;
          bary[o * 3] = nx;
          bary[o * 3 + 1] = ny;
          bary[o * 3 + 2] = nz;
          normals[o * 3] = -nor.getX(i);
          normals[o * 3 + 1] = -nor.getY(i);
          normals[o * 3 + 2] = -nor.getZ(i);
          colors[o * 3] = 0.02;
          colors[o * 3 + 1] = 0.02;
          colors[o * 3 + 2] = 0.03;
          glows[o] = 0;
          return;
        }
        normals[o * 3] = nor.getX(i);
        normals[o * 3 + 1] = nor.getY(i);
        normals[o * 3 + 2] = nor.getZ(i);
        tone.copy(part.color);
        let glow = part.glow;
        if (panes) {
          const pane = panes.pane[t]!;
          const j = hash01(partIndex, pane) * 2 - 1;
          if (part.jit > 0) tone.offsetHSL(j * 0.012, 0, j * part.jit * 0.5);
          if (part.cell === 0 && part.lit > 0 && hash01(pane + 101, partIndex * 7 + 3) < part.lit)
            glow = Math.max(glow, part.litGlow);
          // Barycentric corners; a soft edge's coordinate is lifted by 1 so it never leads.
          for (let c = 0; c < 3; c++) bary[o * 3 + c] = (c === k ? 1 : 0) + panes.soft[t * 3 + c]!;
        } else {
          bary[o * 3] = 2;
          bary[o * 3 + 1] = 2;
          bary[o * 3 + 2] = 2;
        }
        colors[o * 3] = tone.r;
        colors[o * 3 + 1] = tone.g;
        colors[o * 3 + 2] = tone.b;
        glows[o] = glow;
      };
      for (let i = 0; i < pos.count; i++) put(offset + i, i, false, i % 3);
      offset += pos.count;
      if (part.shell) {
        // The outline shell: the same triangles wound the other way (their back shows).
        for (let i = 0; i < pos.count; i += 3) {
          put(offset + i, i, true, 0);
          put(offset + i + 1, i + 2, true, 0);
          put(offset + i + 2, i + 1, true, 0);
        }
        offset += pos.count;
      }
      geo.dispose();
      part.geometry.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    out.setAttribute('aGlow', new THREE.BufferAttribute(glows, 1));
    out.setAttribute('aRig', new THREE.BufferAttribute(rigs, 4));
    out.setAttribute('aMisc', new THREE.BufferAttribute(misc, 4));
    out.setAttribute('aBary', new THREE.BufferAttribute(bary, 3));
    out.computeBoundingSphere();
    this.parts.length = 0;
    return out;
  }
}
