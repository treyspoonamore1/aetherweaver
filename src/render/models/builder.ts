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
}

interface Part {
  geometry: THREE.BufferGeometry;
  color: THREE.Color;
  glow: number;
  matrix: THREE.Matrix4;
}

const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

export class ModelBuilder {
  private readonly parts: Part[] = [];

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

  /** Lathe profile: [radius, y] pairs from bottom to top. */
  lathe(profile: [number, number][], hex: string, opts?: PartOptions, seg = 10): this {
    const pts = profile.map(([x, y]) => new THREE.Vector2(x, y));
    return this.add(new THREE.LatheGeometry(pts, seg), hex, opts);
  }

  build(): THREE.BufferGeometry {
    let vertexCount = 0;
    const prepared: { geo: THREE.BufferGeometry; part: Part }[] = [];
    for (const part of this.parts) {
      const geo = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      geo.applyMatrix4(part.matrix);
      prepared.push({ geo, part });
      vertexCount += geo.getAttribute('position').count;
    }
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const glows = new Float32Array(vertexCount);
    let offset = 0;
    for (const { geo, part } of prepared) {
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      geo.computeVertexNormals();
      const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const o = (offset + i) * 3;
        positions[o] = pos.getX(i);
        positions[o + 1] = pos.getY(i);
        positions[o + 2] = pos.getZ(i);
        normals[o] = nor.getX(i);
        normals[o + 1] = nor.getY(i);
        normals[o + 2] = nor.getZ(i);
        colors[o] = part.color.r;
        colors[o + 1] = part.color.g;
        colors[o + 2] = part.color.b;
        glows[offset + i] = part.glow;
      }
      offset += pos.count;
      geo.dispose();
      part.geometry.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    out.setAttribute('aGlow', new THREE.BufferAttribute(glows, 1));
    out.computeBoundingSphere();
    this.parts.length = 0;
    return out;
  }
}
