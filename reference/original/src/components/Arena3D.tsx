import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AURA_DEFINITIONS, generateProceduralItem } from '../game/data';
import { sound } from '../game/sound';
import {
  AilmentType,
  AllyRuntime,
   CombatTelemetry,
  ComputedSupportBuild,
  CurrencyBag,
  EquipmentItem,
  ExpeditionWaystone,
  LootDrop3D,
  PartyDirective,
} from '../game/types';

export type BeamMode = 'heal' | 'amp';

export interface PlayerHudState {
  life: number;
  maxUnreservedLife: number;
  maxTotalLife: number;
  reservedLifePct: number;
  ward: number;
  maxWard: number;
  spirit: number;
  maxUnreservedSpirit: number;
  maxTotalSpirit: number;
  reservedSpiritPct: number;
  beamMode: BeamMode;
  tetheredAllyId: 'kael' | 'lyra' | 'vexis';
  dashCdRemaining: number;
  cleanseCdRemaining: number;
  sigilCdRemaining: number;
  ultCharge: number; // 0 to 100
  ultActiveRemaining: number; // >0 while Transcendence is active!
  aetherCharges: number;
  chargeCap: number;
  resonance: number;
  resonanceMax: number;
  cascadeCdRemaining: number;
  cascadeActiveRemaining: number;
  cascadeStacks: number;
  decreeName?: string;
  decreeDesc?: string;
  decreeProgress?: number;
  decreeTimeLeft?: number;
  markedAllyId?: 'kael' | 'lyra' | 'vexis' | null;
}

export interface ArenaActionHandle {
  triggerDash: () => void;
  triggerCleanse: () => void;
  triggerSigil: () => void;
  triggerUltimate: () => void;
  triggerCascade: () => void;
  toggleBeamMode: () => void;
  selectAlly: (id: 'kael' | 'lyra' | 'vexis') => void;
  collectAllLoot: () => void;
  spawnBossNow: () => void;
  resetRunStats: () => void;
}

interface FloatingPopup {
  id: number;
  text: string;
  x: number; // Screen px
  y: number; // Screen px
  color: string;
  big?: boolean;
}

interface ProjectedTag {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

interface Arena3DProps {
  build: ComputedSupportBuild;
  waystone: ExpeditionWaystone;
  directive: PartyDirective;
  autoPilotMove: boolean;
  paused: boolean;
  actionRef: React.MutableRefObject<ArenaActionHandle | null>;
  onHudUpdate: (
    playerHud: PlayerHudState,
    allies: AllyRuntime[],
    telemetry: CombatTelemetry,
    lootCount: number
  ) => void;
  onGainXp: (amount: number) => void;
  onLootCollected: (
    item?: EquipmentItem,
    currency?: { type: keyof CurrencyBag; amount: number },
    label?: string
  ) => void;
  onBossDefeated: (tier: number) => void;
  onBondXp: (deltas: Record<'kael' | 'lyra' | 'vexis', number>) => void;
  pixelRatio: 'auto' | 'low' | 'high';
}

// Create a crisp procedural astral stone + sacred geometry floor texture
function createSanctumFloorTexture(theme: ExpeditionWaystone['theme']): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const palettes = {
    sanctum: { bg1: '#0d1424', bg2: '#060a14', line: 'rgba(245, 188, 82, 0.26)', glow: 'rgba(56, 189, 248, 0.18)' },
    crimson_spire: { bg1: '#1c0c14', bg2: '#0b0509', line: 'rgba(244, 63, 94, 0.28)', glow: 'rgba(251, 146, 60, 0.16)' },
    abyssal_rift: { bg1: '#0f0c24', bg2: '#060510', line: 'rgba(168, 85, 247, 0.28)', glow: 'rgba(45, 212, 191, 0.18)' },
    celestial_crucible: { bg1: '#0c1926', bg2: '#050b12', line: 'rgba(56, 189, 248, 0.30)', glow: 'rgba(250, 204, 21, 0.22)' },
  };
  const pal = palettes[theme];

  const grad = ctx.createRadialGradient(512, 512, 40, 512, 512, 512);
  grad.addColorStop(0, pal.bg1);
  grad.addColorStop(1, pal.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle tile stonework
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let i = 0; i <= 1024; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // Concentric astrolabe rings
  ctx.save();
  ctx.translate(512, 512);
  [110, 210, 320, 430, 485].forEach((r, idx) => {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = idx % 2 === 0 ? pal.line : pal.glow;
    ctx.lineWidth = idx === 4 ? 5 : 2.5;
    ctx.stroke();
  });

  // 12 Star Spokes
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 110, Math.sin(a) * 110);
    ctx.lineTo(Math.cos(a) * 485, Math.sin(a) * 485);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

const BOSS_NAMES = [
  'Malakor, Choirbreaker Archon',
  'Vespera of the Sundered Halo',
  'Xylaroth, Sovereign of Silence',
  'Ignis-Vael, Cinder Adjudicator',
  'Nyxarion, Abyssal Resonator',
];

export const Arena3D: React.FC<Arena3DProps> = ({
  build,
  waystone,
  directive,
  autoPilotMove,
  paused,
  actionRef,
  onHudUpdate,
  onGainXp,
  onLootCollected,
    onBossDefeated,
    onBondXp,
    pixelRatio,
  }) => {
    const pixelRatioRef = useRef(pixelRatio);
    pixelRatioRef.current = pixelRatio;
    const applyPixelRatio = (renderer: THREE.WebGLRenderer) => {
      const pr =
        pixelRatioRef.current === 'low'
          ? 1
          : pixelRatioRef.current === 'high'
          ? Math.min(2.5, window.devicePixelRatio)
          : Math.min(2, window.devicePixelRatio);
      renderer.setPixelRatio(pr);
    };
    const containerRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

    // Live-apply the chosen render resolution whenever the setting changes
    useEffect(() => {
      if (rendererRef.current) applyPixelRatio(rendererRef.current);
    }, [pixelRatio]);

    // Latest props stored in refs so our 60fps loop never restarts or loses state!
    const buildRef = useRef(build);
    buildRef.current = build;

  const waystoneRef = useRef(waystone);
  waystoneRef.current = waystone;

  const directiveRef = useRef(directive);
  directiveRef.current = directive;

  const autoPilotRef = useRef(autoPilotMove);
  autoPilotRef.current = autoPilotMove;

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const callbacksRef = useRef({ onHudUpdate, onGainXp, onLootCollected, onBossDefeated, onBondXp });
  callbacksRef.current = { onHudUpdate, onGainXp, onLootCollected, onBossDefeated, onBondXp };

  // Screen-projected UI overlays (Floating Combat Numbers & Loot Labels & Ally Microplates)
  const [popups, setPopups] = useState<FloatingPopup[]>([]);
  const [lootScreenTags, setLootScreenTags] = useState<
    (ProjectedTag & { drop: LootDrop3D })[]
  >([]);
  const [allyScreenTags, setAllyScreenTags] = useState<
    (ProjectedTag & { ally: AllyRuntime })[]
  >([]);

  const collectSingleLootRef = useRef<(id: string) => void>(() => {});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- THREE.JS SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#040710');
    scene.fog = new THREE.FogExp2('#040710', 0.017);

    const camera = new THREE.PerspectiveCamera(
      44,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.5,
      140
    );
    let cameraZoom = 25; // Adjustable via scroll wheel (16 to 36)
    camera.position.set(0, 22, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    applyPixelRatio(renderer);
    rendererRef.current = renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight('#8da8d6', 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#fff2d6', 1.35);
    dirLight.position.set(14, 28, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    const d = 26;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight('#6366f1', 0.65);
    rimLight.position.set(-18, 14, -16);
    scene.add(rimLight);

    // Arena Floor (Radius 23)
    const ARENA_RADIUS = 22.5;
    const WARDEN_RADIUS = 11.0; // Dissonant Warden Aura-Collapse field radius
    let currentFloorTheme = waystoneRef.current.theme;
    const floorMat = new THREE.MeshStandardMaterial({
      map: createSanctumFloorTexture(currentFloorTheme),
      roughness: 0.68,
      metalness: 0.22,
    });
    const floorMesh = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS + 0.8, ARENA_RADIUS + 1.4, 0.9, 64), floorMat);
    floorMesh.position.y = -0.45;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Outer Golden Rim & 12 Floating Astral Pillars
    const borderRing = new THREE.Mesh(
      new THREE.TorusGeometry(ARENA_RADIUS + 0.5, 0.22, 12, 96),
      new THREE.MeshStandardMaterial({ color: '#d99b38', emissive: '#784812', roughness: 0.3, metalness: 0.8 })
    );
    borderRing.rotation.x = Math.PI / 2;
    borderRing.position.y = 0.05;
    scene.add(borderRing);

    const outerCrystals: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI * 2) / 12;
      const px = Math.cos(ang) * (ARENA_RADIUS + 2.2);
      const pz = Math.sin(ang) * (ARENA_RADIUS + 2.2);

      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.65, 4.2, 6),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5, metalness: 0.4 })
      );
      pillar.position.set(px, 1.4, pz);
      pillar.castShadow = true;
      scene.add(pillar);

      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? '#fbbf24' : '#38bdf8',
          emissive: i % 2 === 0 ? '#b45309' : '#0284c7',
          emissiveIntensity: 0.8,
          roughness: 0.2,
        })
      );
      crystal.position.set(px, 4.3, pz);
      scene.add(crystal);
      outerCrystals.push(crystal);
    }

    // Ambient Floating Starfield Motes
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      const r = 10 + Math.random() * 32;
      const theta = Math.random() * Math.PI * 2;
      starPositions[i * 3] = Math.cos(theta) * r;
      starPositions[i * 3 + 1] = 0.5 + Math.random() * 14;
      starPositions[i * 3 + 2] = Math.sin(theta) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: '#fde68a', size: 0.18, transparent: true, opacity: 0.55 })
    );
    scene.add(starPoints);

    // --- PLAYER (THE AETHERWEAVER) 3D MODEL ---
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, 0, 4.5);
    scene.add(playerGroup);

    // Weaver Robes & Mantle
    const weaverRobe = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 1.65, 12),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#1e3a8a', emissiveIntensity: 0.25, roughness: 0.35 })
    );
    weaverRobe.position.y = 1.0;
    weaverRobe.castShadow = true;
    playerGroup.add(weaverRobe);

    const weaverMantle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.68, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#92400e', emissiveIntensity: 0.35, metalness: 0.7, roughness: 0.25 })
    );
    weaverMantle.position.y = 1.55;
    playerGroup.add(weaverMantle);

    const weaverHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshStandardMaterial({ color: '#fef3c7', emissive: '#fbbf24', emissiveIntensity: 0.4 })
    );
    weaverHead.position.y = 2.02;
    playerGroup.add(weaverHead);

    // Floating Censer Orb in front of Weaver
    const censerOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.26, 0),
      new THREE.MeshStandardMaterial({ color: '#34d399', emissive: '#10b981', emissiveIntensity: 1.2 })
    );
    censerOrb.position.set(0.5, 1.5, 0.55);
    playerGroup.add(censerOrb);

    const playerLight = new THREE.PointLight('#fbbf24', 1.8, 12);
    playerLight.position.set(0, 2.2, 0);
    playerGroup.add(playerLight);

    // Dynamic Back-Mounted Seraphic Halo Container (Adds 1 spinning 3D ring per Active Aura!)
    const backHaloGroup = new THREE.Group();
    backHaloGroup.position.set(0, 1.75, -0.35);
    playerGroup.add(backHaloGroup);

    // Ground Aura Boundary Rings Container (Shows exact build.auraRadius + layered active aura rings!)
    const groundAuraGroup = new THREE.Group();
    groundAuraGroup.position.y = 0.04;
    playerGroup.add(groundAuraGroup);

    const primaryAuraOuterRing = new THREE.Mesh(
      new THREE.RingGeometry(0.985, 1.0, 96),
      new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
      })
    );
    primaryAuraOuterRing.rotation.x = -Math.PI / 2;
    groundAuraGroup.add(primaryAuraOuterRing);

    const primaryAuraFillDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 64),
      new THREE.MeshBasicMaterial({
        color: '#f59e0b',
        transparent: true,
        opacity: 0.055,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    primaryAuraFillDisc.rotation.x = -Math.PI / 2;
    groundAuraGroup.add(primaryAuraFillDisc);

    // Sub-rings synced dynamically when active auras change
    let lastAuraSignature = '';
    const backHaloMeshes: THREE.Mesh[] = [];
    const groundSubRings: THREE.Mesh[] = [];

    function syncVisualAuraRings() {
      const b = buildRef.current;
      const sig = b.activeAuras.map((a) => `${a.auraId}:${a.pool}`).join('|');
      if (sig === lastAuraSignature) return;
      lastAuraSignature = sig;

      // Clear previous
      while (backHaloGroup.children.length > 0) {
        backHaloGroup.remove(backHaloGroup.children[0]);
      }
      backHaloMeshes.length = 0;

      groundSubRings.forEach((m) => groundAuraGroup.remove(m));
      groundSubRings.length = 0;

      b.activeAuras.forEach((inst, idx) => {
        const def = AURA_DEFINITIONS[inst.auraId];
        // 1. Back Seraphic Halo Ring!
        const haloMesh = new THREE.Mesh(
          new THREE.TorusGeometry(0.55 + idx * 0.16, 0.032, 8, 48),
          new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.88 })
        );
        backHaloGroup.add(haloMesh);
        backHaloMeshes.push(haloMesh);

        // 2. Ground Concentric Rune Ring!
        const frac = 0.94 - idx * 0.055;
        if (frac > 0.3) {
          const gRing = new THREE.Mesh(
            new THREE.RingGeometry(frac - 0.012, frac, 72),
            new THREE.MeshBasicMaterial({
              color: def.color,
              transparent: true,
              opacity: 0.35,
              side: THREE.DoubleSide,
              depthWrite: false,
            })
          );
          gRing.rotation.x = -Math.PI / 2;
          groundAuraGroup.add(gRing);
          groundSubRings.push(gRing);
        }
      });
    }

    // --- 3 HERO ALLIES SETUP ---
    interface AllyInternal extends AllyRuntime {
      meshGroup: THREE.Group;
      inAuraRing: THREE.Mesh;
      suzuSphere: THREE.Mesh;
      ailmentRing: THREE.Mesh;
      damageWindow: { time: number; total: number; attributed: number }[];
    }

    function createHeroMesh(role: 'Tank' | 'Ranger' | 'Arcanist', color: string) {
      const g = new THREE.Group();

      if (role === 'Tank') {
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.58, 0.52, 1.55, 8),
          new THREE.MeshStandardMaterial({ color: '#3b82f6', metalness: 0.65, roughness: 0.3 })
        );
        body.position.y = 0.85;
        body.castShadow = true;
        g.add(body);

        const shield = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 1.25, 0.18),
          new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#b45309', emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.2 })
        );
        shield.position.set(0.4, 0.95, 0.55);
        g.add(shield);

        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.48, 0.48, 0.48),
          new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.7 })
        );
        head.position.y = 1.85;
        g.add(head);
      } else if (role === 'Ranger') {
        const cloak = new THREE.Mesh(
          new THREE.ConeGeometry(0.48, 1.5, 8),
          new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.45 })
        );
        cloak.position.y = 0.82;
        cloak.castShadow = true;
        g.add(cloak);

        const bow = new THREE.Mesh(
          new THREE.TorusGeometry(0.52, 0.05, 8, 24, Math.PI),
          new THREE.MeshStandardMaterial({ color: '#fde047', emissive: '#ca8a04', emissiveIntensity: 0.5 })
        );
        bow.rotation.z = -Math.PI / 2;
        bow.rotation.y = Math.PI / 2;
        bow.position.set(0, 1.1, 0.35);
        g.add(bow);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 12, 12),
          new THREE.MeshStandardMaterial({ color: '#d1fae5' })
        );
        head.position.y = 1.75;
        g.add(head);
      } else {
        const robe = new THREE.Mesh(
          new THREE.ConeGeometry(0.5, 1.55, 10),
          new THREE.MeshStandardMaterial({ color: '#8b5cf6', emissive: '#4c1d95', emissiveIntensity: 0.35 })
        );
        robe.position.y = 0.95;
        robe.castShadow = true;
        g.add(robe);

        const orb = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.26, 0),
          new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 1.1 })
        );
        orb.position.set(0.45, 1.55, 0.4);
        g.add(orb);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.29, 12, 12),
          new THREE.MeshStandardMaterial({ color: '#ede9fe' })
        );
        head.position.y = 1.9;
        g.add(head);
      }

      // Foot indicator when buffed by Player's Aura Ring!
      const inAuraRing = new THREE.Mesh(
        new THREE.RingGeometry(0.72, 0.88, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
      );
      inAuraRing.rotation.x = -Math.PI / 2;
      inAuraRing.position.y = 0.05;
      g.add(inAuraRing);

      // Suzu / Cleanse Invulnerability Barrier Sphere
      const suzuSphere = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.25, 1),
        new THREE.MeshBasicMaterial({
          color: '#fef08a',
          wireframe: true,
          transparent: true,
          opacity: 0.85,
        })
      );
      suzuSphere.position.y = 1.05;
      suzuSphere.visible = false;
      g.add(suzuSphere);

      // Crimson/Violet Ailment Warning Ring
      const ailmentRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.06, 8, 28),
        new THREE.MeshBasicMaterial({ color: '#f43f5e' })
      );
      ailmentRing.rotation.x = Math.PI / 2;
      ailmentRing.position.y = 0.25;
      ailmentRing.visible = false;
      g.add(ailmentRing);

      scene.add(g);
      return { g, inAuraRing, suzuSphere, ailmentRing };
    }

    const heroDefs: {
      id: 'kael' | 'lyra' | 'vexis';
      name: string;
      title: string;
      role: 'Tank' | 'Ranger' | 'Arcanist';
      color: string;
      hp: number;
      dps: number;
      range: number;
      x: number;
      z: number;
    }[] = [
      { id: 'kael', name: 'Vanguard Kael', title: 'Solar Juggernaut', role: 'Tank', color: '#38bdf8', hp: 1350, dps: 78, range: 2.9, x: 0, z: -1.5 },
      { id: 'lyra', name: 'Lyra Windshot', title: 'Tempest Ranger', role: 'Ranger', color: '#34d399', hp: 780, dps: 122, range: 10.5, x: -3.8, z: 2.2 },
      { id: 'vexis', name: 'Vexis Starcaller', title: 'Astral Arcanist', role: 'Arcanist', color: '#c084fc', hp: 720, dps: 135, range: 9.8, x: 3.8, z: 2.2 },
    ];

    const allies: AllyInternal[] = heroDefs.map((h) => {
      const m = createHeroMesh(h.role, h.color);
      m.g.position.set(h.x, 0, h.z);
      return {
        id: h.id,
        name: h.name,
        title: h.title,
        role: h.role,
        color: h.color,
        hp: h.hp,
        maxHp: h.hp,
        overshield: 0,
        maxOvershield: Math.round(h.hp * 0.65),
        x: h.x,
        z: h.z,
        vx: 0,
        vz: 0,
        facing: 0,
        baseDps: h.dps,
        attackRange: h.range,
        attackCooldown: 0.3,
        inAura: true,
        inSigil: false,
        isTetheredPrimary: h.id === 'kael',
        isTetheredSecondary: false,
        invulnerableTimer: 0,
        ailments: [],
        recentDps: 0,
        recentSupportAttributedDps: 0,
        alive: true,
        reviveProgress: 0,
        meshGroup: m.g,
        inAuraRing: m.inAuraRing,
        suzuSphere: m.suzuSphere,
        ailmentRing: m.ailmentRing,
        damageWindow: [],
      };
    });

    // --- 3D CADUCEUS TETHER BEAMS (Up to 3 simultaneous beams for Triad Bond / Transcendence!) ---
    function createBeamVisual() {
      const mat = new THREE.MeshBasicMaterial({
        color: '#34d399',
        transparent: true,
        opacity: 0.88,
      });
      const dummyCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 2, -2),
        new THREE.Vector3(0, 1, -4)
      );
      const geo = new THREE.TubeGeometry(dummyCurve, 20, 0.11, 8, false);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);

      // Traveling energy beads along the beam!
      const beads: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 8, 8),
          new THREE.MeshBasicMaterial({ color: '#fef08a' })
        );
        b.visible = false;
        scene.add(b);
        beads.push(b);
      }
      return { mesh, mat, beads };
    }

    const tetherBeams = [createBeamVisual(), createBeamVisual(), createBeamVisual()];

    function updateBeamMesh(
      visual: ReturnType<typeof createBeamVisual>,
      start: THREE.Vector3,
      end: THREE.Vector3,
      mode: BeamMode,
      time: number,
      isUlt: boolean,
      thickness = 0.11
    ) {
      visual.mesh.visible = true;
      const mid = start.clone().lerp(end, 0.5);
      mid.y += 1.15 + Math.sin(time * 5.5) * 0.22;
      mid.x += Math.cos(time * 4.0) * 0.25;

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      visual.mesh.geometry.dispose();
      visual.mesh.geometry = new THREE.TubeGeometry(curve, 22, thickness, 8, false);

      if (isUlt) {
        visual.mat.color.set('#fde047');
      } else if (mode === 'heal') {
        visual.mat.color.set('#34d399');
      } else {
        visual.mat.color.set('#38bdf8');
      }

      visual.beads.forEach((bead, idx) => {
        bead.visible = true;
        const t = (time * 1.9 + idx * 0.25) % 1;
        curve.getPoint(t, bead.position);
        (bead.material as THREE.MeshBasicMaterial).color.set(
          isUlt ? '#ffffff' : mode === 'heal' ? '#fde68a' : '#e879f9'
        );
      });
    }

    function hideBeam(visual: ReturnType<typeof createBeamVisual>) {
      visual.mesh.visible = false;
      visual.beads.forEach((b) => (b.visible = false));
    }

    // --- ENEMIES, TELEGRAPHS, PROJECTILES, SIGILS & LOOT ---
    interface EnemyInternal {
      id: number;
      name: string;
      tier: 'normal' | 'elite' | 'boss';
      archetype: 'brute' | 'lancer' | 'warden' | 'soulbinder';
      suppressField?: THREE.Mesh;
      drainBeam?: THREE.Mesh;
      affixes: string[];
      hp: number;
      maxHp: number;
      dmg: number;
      speed: number;
      range: number;
      x: number;
      z: number;
      attackCd: number;
      specialCd: number;
      mesh: THREE.Group;
      hexRing: THREE.Mesh;
    }

    interface TelegraphRing {
      x: number;
      z: number;
      radius: number;
      elapsed: number;
      duration: number;
      damage: number;
      ailment: AilmentType;
      outerMesh: THREE.Mesh;
      fillMesh: THREE.Mesh;
    }

    interface ProjectileVisual {
      start: THREE.Vector3;
      end: THREE.Vector3;
      t: number;
      speed: number;
      mesh: THREE.Mesh;
      onArrive?: () => void;
    }

    interface ActiveSigil {
      x: number;
      z: number;
      radius: number;
      remaining: number;
      meshGroup: THREE.Group;
    }

    interface LootVisual3D {
      drop: LootDrop3D;
      group: THREE.Group;
    }

    const enemies: EnemyInternal[] = [];
    const telegraphs: TelegraphRing[] = [];
    const projectiles: ProjectileVisual[] = [];
    const sigils: ActiveSigil[] = [];
    const lootVisuals: LootVisual3D[] = [];
    let enemyIdSeq = 1;
    let popupIdSeq = 1;

    // Player Dynamic Runtime Resources
    let playerLife = buildRef.current.unreservedLifeMax;
    let playerWard = buildRef.current.maxWard;
    let playerSpirit = buildRef.current.unreservedSpiritMax;
    let wardDamageDelay = 0; // Seconds before Ward rapidly recharges if hit directly

    let beamMode: BeamMode = 'heal';
    let tetheredAllyId: 'kael' | 'lyra' | 'vexis' = 'kael';

    let dashCd = 0;
    let cleanseCd = 0;
    let sigilCd = 0;
    let dashTimer = 0;
    let dashDirX = 0;
    let dashDirZ = 0;

    let ultCharge = 35; // Start at 35% so player gets to experience Ultimate quickly!
    let ultActiveRemaining = 0;

    // --- AETHER CHARGES, RESONANCE COMBO & RESONANT CASCADE ---
    let aetherCharges = buildRef.current.startCharges;
    let resonance = buildRef.current.startResonance;
    let resonanceFresh = 0; // seconds since last support action
    let cascadeActiveRemaining = 0;
    let cascadeStacks = 0;
    let cascadeCd = 0;
    let cascadeCount = 0;
    let ultRadiusMult = 1;
    let spiritVoid = false;
    const cascadePower = () =>
      (cascadeActiveRemaining > 0 ? 1 + (cascadeStacks * buildRef.current.cascadePotencyPct) / 100 : 1) *
      (1 + resonance / 260);

    function gainAetherCharge(n = 1) {
      const cap = buildRef.current.chargeCap;
      const before = aetherCharges;
      aetherCharges = Math.min(cap, aetherCharges + n);
      if (aetherCharges > before) {
        const p = new THREE.Vector3();
        playerGroup.getWorldPosition(p);
        spawnFloatingPopup(p.x, 3.1, p.z, `◆ AETHER ${aetherCharges}/${cap}`, '#2dd4bf');
      }
    }

    function addResonance(amount: number) {
      const b = buildRef.current;
      resonance = Math.min(b.resonanceMax, resonance + (amount * b.chargeGainPct) / 100);
      resonanceFresh = 0;
    }

    function triggerCascade() {
      const b = buildRef.current;
      if (aetherCharges <= 0 || cascadeCd > 0) {
        if (aetherCharges <= 0) {
          spawnFloatingPopup(
            playerGroup.position.x,
            2.5,
            playerGroup.position.z,
            'NO AETHER CHARGES',
            '#2dd4bf'
          );
        }
        return;
      }
      cascadeStacks = aetherCharges;
      aetherCharges = 0;
      cascadeActiveRemaining = b.cascadeDuration + cascadeStacks * 0.5;
      cascadeCount += 1;
      cascadeCd = 6.0;

      // Banked charges instantly reset your utility cooldowns
      cleanseCd = 0;
      sigilCd = Math.max(0, sigilCd - cascadeStacks * 2.5);
      dashCd = 0;
      ultCharge = Math.min(100, ultCharge + cascadeStacks * 7);
      resonance = Math.min(b.resonanceMax, resonance + cascadeStacks * 4);

      sound.playCascade();
      spawnShockwave(playerGroup.position.x, playerGroup.position.z, '#2dd4bf', b.auraRadius * 1.1, 0.7);
      spawnFloatingPopup(
        playerGroup.position.x,
        3.2,
        playerGroup.position.z,
        `✧ RESONANT CASCADE ×${cascadeStacks} ✧`,
        '#5eead4',
        true
      );

      // Cascade refunds a slice of life/ward to the whole party
      for (const ally of allies) {
        if (!ally.alive) continue;
        const heal = ally.maxHp * 0.07 * cascadeStacks;
        const act = Math.min(ally.maxHp - ally.hp, heal);
        ally.hp += act;
        totalHealingDone += act;
        ally.overshield = Math.min(ally.maxOvershield, ally.overshield + 40 * cascadeStacks);
      }
    }

    // --- BOSS DECREES: authored support skillchecks ---
    type DecreeState = {
      key: 'convergence' | 'single_thread' | 'spirit_void' | 'shatter_halo';
      name: string;
      desc: string;
      timeLeft: number;
      duration: number;
      progress: number;
    };
    let decree: DecreeState | null = null;
    let decreeTimer = 11;
    let decreesAnswered = 0;
    let markedAllyId: 'kael' | 'lyra' | 'vexis' | null = null;

    function endDecree(answered: boolean) {
      const d = decree;
      decree = null;
      markedAllyId = null;
      if (!d) return;
      const boss = enemies.find((e) => e.tier === 'boss');
      if (answered) {
        decreesAnswered += 1;
        ultCharge = Math.min(100, ultCharge + 30);
        addResonance(buildRef.current.resonancePerAction * 3);
        gainAetherCharge(2);
        sound.playLifesaverChord();
        spawnFloatingPopup(playerGroup.position.x, 3.4, playerGroup.position.z, '✦ DECREE ANSWERED ✦', '#fde047', true);
        if (boss) {
          const trueDmg = Math.round(boss.maxHp * 0.07);
          boss.hp -= trueDmg;
          spawnFloatingPopup(boss.x, 3.2, boss.z, `${trueDmg.toLocaleString()} TRUE`, '#fde047', true);
        }
      } else {
        spawnFloatingPopup(playerGroup.position.x, 3.2, playerGroup.position.z, 'DECREE FAILED', '#f43f5e', true);
        for (const ally of allies) {
          if (!ally.alive) continue;
          ally.hp = Math.max(1, ally.hp - ally.maxHp * 0.22);
        }
        playerLife = Math.max(1, playerLife - buildRef.current.unreservedLifeMax * 0.2);
      }
    }

    // Telemetry State
    let totalHealingDone = 0;
    let totalOvershieldGranted = 0;
    let totalAttributedDamage = 0;
    let clutchSaves = 0;
    let ailmentsCleansed = 0;
    let waveKillsScore = 0;
    let bossActive = false;
    let suppressionActive = false;
    let wardsSlain = 0;
    const bossTiersCleared = new Set<number>();
    let resonancesPeaked = 0;
    let undyingCd = 0;
    const bondXpAccum: Record<'kael' | 'lyra' | 'vexis', number> = { kael: 0, lyra: 0, vexis: 0 };

    // Start a fresh expedition run: clear leftover monsters + reset this-run stats
    function resetRunStats() {
      for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i];
        scene.remove(en.mesh);
        if (en.drainBeam) scene.remove(en.drainBeam);
        enemies.splice(i, 1);
      }
      for (const tel of telegraphs) {
        scene.remove(tel.outerMesh);
        scene.remove(tel.fillMesh);
      }
      telegraphs.length = 0;
      totalHealingDone = 0;
      totalOvershieldGranted = 0;
      totalAttributedDamage = 0;
      clutchSaves = 0;
      ailmentsCleansed = 0;
      cascadeCount = 0;
      decreesAnswered = 0;
      resonancesPeaked = 0;
      wardsSlain = 0;
      waveKillsScore = 0;
      bossActive = false;
      decree = null;
      markedAllyId = null;
      decreeTimer = 11;
      resonance = buildRef.current.startResonance;
      aetherCharges = buildRef.current.startCharges;
      cascadeActiveRemaining = 0;
      cascadeStacks = 0;
      cascadeCd = 0;
      for (const ally of allies) {
        ally.alive = true;
        ally.hp = ally.maxHp;
        ally.overshield = 0;
        ally.ailments = [];
        ally.reviveProgress = 0;
      }
      // Re-seed a fresh opening pack
      for (let i = 0; i < 5; i++) spawnEnemy('normal');
      spawnEnemy('elite');
    }

    // Popup helper
    function spawnFloatingPopup(worldX: number, worldY: number, worldZ: number, text: string, color: string, big = false) {
      const v = new THREE.Vector3(worldX, worldY, worldZ);
      v.project(camera);
      if (v.z > 1) return;
      const sx = (v.x * 0.5 + 0.5) * container!.clientWidth;
      const sy = (-v.y * 0.5 + 0.5) * container!.clientHeight;
      const id = ++popupIdSeq;
      setPopups((prev) => [...prev.slice(-22), { id, text, x: sx, y: sy, color, big }]);
      setTimeout(() => {
        setPopups((prev) => prev.filter((p) => p.id !== id));
      }, 1050);
    }

    // Spawn 3D Shockwave Ring effect (for Cleanse Suzu, Ultimate, Boss Slam)
    const transientEffects: { mesh: THREE.Mesh; age: number; maxAge: number; maxScale: number }[] = [];
    function spawnShockwave(x: number, z: number, color: string, maxRadius: number, duration = 0.45) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.75, 1.0, 48),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.14, z);
      scene.add(m);
      transientEffects.push({ mesh: m, age: 0, maxAge: duration, maxScale: maxRadius });
    }

    // Spawn Loot Drop in 3D with PoE-style Vertical Light Beam!
    function spawnLootDrop(
      x: number,
      z: number,
      sourceTier: 'normal' | 'elite' | 'boss',
      forcedCurrency?: keyof CurrencyBag
    ) {
      const ws = waystoneRef.current;
      const rarityRoll = Math.random() * (1 + ws.totalRarityPct / 150);

      // Guaranteed currency drop (used for boss Vaal Tear rewards)
      if (forcedCurrency) {
        const labels: Record<string, [string, LootDrop3D['rarityColor']]> = {
          vaalTears: ['☠ VAAL TEAR ☠', 'currency'],
          divineTears: ['★ DIVINE TEAR ★', 'currency'],
          exaltedSparks: ['✦ EXALTED SPARK ✦', 'currency'],
          chaosPrisms: ['Chaos Prism', 'rare'],
          astraloes: ['Astral Rune Shard', 'currency'],
          transmuteShards: ['Transmute Shard', 'magic'],
        };
        const [label, rColor] = labels[forcedCurrency] ?? ['Chaos Prism', 'rare'];
        sound.playLootFilter(rColor === 'magic' ? 'magic' : rColor);
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        const hex = rColor === 'currency' ? '#f43f5e' : rColor === 'rare' ? '#facc15' : '#60a5fa';
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), new THREE.MeshBasicMaterial({ color: hex }));
        crystal.position.y = 0.55;
        g.add(crystal);
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.24, 6.5, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
        );
        beam.position.y = 3.25;
        g.add(beam);
        scene.add(g);
        lootVisuals.push({
          drop: {
            id: `loot_${Date.now()}_${Math.random()}`,
            x,
            z,
            createdAt: performance.now(),
            kind: 'currency',
            currencyType: forcedCurrency,
            currencyAmount: 1,
            label,
            rarityColor: rColor,
          },
          group: g,
        });
        return;
      }

      let drop: LootDrop3D | null = null;
        if (sourceTier === 'boss' || (sourceTier === 'elite' && Math.random() < 0.72) || Math.random() < 0.22) {
        // Decide Currency vs Equipment
        if (Math.random() < 0.55 && sourceTier !== 'boss') {
          const cRoll = Math.random() + (sourceTier === 'elite' ? 0.12 : 0);
          let cType: keyof CurrencyBag = 'chaosPrisms';
          let label = 'Chaos Prism';
          let rColor: LootDrop3D['rarityColor'] = 'rare';
          if (cRoll > 1.02) {
            cType = 'vaalTears';
            label = '☠ VAAL TEAR ☠';
            rColor = 'currency';
          } else if (cRoll > 0.84) {
            cType = 'divineTears';
            label = '★ DIVINE TEAR ★';
            rColor = 'currency';
          } else if (cRoll > 0.56) {
            cType = 'astraloes';
            label = 'Astral Rune Shard';
            rColor = 'currency';
          } else if (cRoll > 0.30) {
            cType = 'exaltedSparks';
            label = '✦ EXALTED SPARK ✦';
            rColor = 'currency';
          } else if (cRoll > 0.14) {
            cType = 'transmuteShards';
            label = 'Transmute Shard';
            rColor = 'magic';
          } else {
            cType = 'chaosPrisms';
            label = 'Chaos Prism';
            rColor = 'rare';
          }
          drop = {
            id: `loot_${Date.now()}_${Math.random()}`,
            x: x + (Math.random() - 0.5) * 1.6,
            z: z + (Math.random() - 0.5) * 1.6,
            createdAt: performance.now(),
            kind: 'currency',
            currencyType: cType,
            currencyAmount: sourceTier === 'elite' ? 2 : 1,
            label,
            rarityColor: rColor,
          };
        } else {
          const forcedRarity =
            sourceTier === 'boss' && rarityRoll > 0.55
              ? 'unique'
              : rarityRoll > 0.98
              ? 'unique'
              : rarityRoll > 0.42 || sourceTier === 'boss'
              ? 'rare'
              : 'magic';
          const sourceName =
            sourceTier === 'boss'
              ? 'the Sanctum Archon'
              : sourceTier === 'elite'
              ? 'an Abyssal Elite'
              : 'a Sanctum pack';
          const item = generateProceduralItem(ws.tier, forcedRarity, undefined, sourceName);
          // Bosses and elites always leave something worth the fight
          if (sourceTier === 'boss' && item.sockets < 3) item.sockets = 3;
          drop = {
            id: item.uid,
            x: x + (Math.random() - 0.5) * 1.8,
            z: z + (Math.random() - 0.5) * 1.8,
            createdAt: performance.now(),
            kind: 'equipment',
            item,
            label:
              item.rarity === 'unique'
                ? `★ ${item.name}`
                : `${item.name} ${item.sockets}◇${item.quality > 0 ? ` Q${item.quality}` : ''}`,
            rarityColor: item.rarity,
          };
        }
      }

      if (!drop) return;

      // Play PoE Loot Filter chime!
      if (drop.rarityColor === 'unique' || drop.rarityColor === 'currency') {
        sound.playLootFilter(drop.rarityColor);
      } else if (drop.rarityColor === 'rare') {
        sound.playLootFilter('rare');
      }

      const colorMap = {
        magic: '#60a5fa',
        rare: '#facc15',
        unique: '#f97316',
        currency: '#2dd4bf',
      };
      const hex = colorMap[drop.rarityColor];

      const g = new THREE.Group();
      g.position.set(drop.x, 0, drop.z);

      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.34, 0),
        new THREE.MeshBasicMaterial({ color: hex })
      );
      crystal.position.y = 0.55;
      g.add(crystal);

      // Vertical PoE Light Pillar!
      const beamHeight = drop.rarityColor === 'unique' || drop.rarityColor === 'currency' ? 6.5 : 3.6;
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.24, beamHeight, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: hex,
          transparent: true,
          opacity: drop.rarityColor === 'magic' ? 0.28 : 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      beam.position.y = beamHeight / 2;
      g.add(beam);

      const baseRing = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.52, 24),
        new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
      );
      baseRing.rotation.x = -Math.PI / 2;
      baseRing.position.y = 0.05;
      g.add(baseRing);

      scene.add(g);
      lootVisuals.push({ drop, group: g });
    }

    function collectLootByIndex(idx: number) {
      const lv = lootVisuals[idx];
      if (!lv) return;
      scene.remove(lv.group);
      lootVisuals.splice(idx, 1);

      const d = lv.drop;
      if (d.kind === 'equipment' && d.item) {
        callbacksRef.current.onLootCollected(d.item, undefined, d.label);
      } else if (d.kind === 'currency' && d.currencyType) {
        callbacksRef.current.onLootCollected(
          undefined,
          { type: d.currencyType, amount: d.currencyAmount ?? 1 },
          d.label
        );
      }
      spawnFloatingPopup(playerGroup.position.x, 2.5, playerGroup.position.z, `+ ${d.label}`, '#fde047', false);
    }

    collectSingleLootRef.current = (id: string) => {
      const idx = lootVisuals.findIndex((l) => l.drop.id === id);
      if (idx !== -1) collectLootByIndex(idx);
    };

    // --- ENEMY & BOSS SPAWNER ---
    function spawnEnemy(tier: 'normal' | 'elite' | 'boss') {
      const ws = waystoneRef.current;
      // BALANCE (audited): the old 1.42^tier HP curve reached x23 while hero DPS grew
      // ~x3.3, so T9-T10 were mathematically impossible, not hard.
      // Enemy HP softened to 1.33^tier (x13 at T10) against hero power ~x4.9.
      // Damage keeps its 1.24^tier curve (x6.9 at T10 vs hero HP x5.1) so the top tiers
      // REQUIRE mitigation from Grace / Purity / Sigils rather than being free.
      const tierMultHp = Math.pow(1.33, ws.tier - 1);
      const tierMultDmg = Math.pow(1.24, ws.tier - 1);

      let modHp = 1;
      let modDmg = 1;
      let modSpd = 1;
      for (const m of ws.modifiers) {
        if (m.enemyHpMult) modHp *= m.enemyHpMult;
        if (m.enemyDmgMult) modDmg *= m.enemyDmgMult;
        if (m.enemySpeedMult) modSpd *= m.enemySpeedMult;
      }

      const ang = Math.random() * Math.PI * 2;
      const spawnDist = tier === 'boss' ? 13 : ARENA_RADIUS - 2.2;
      const sx = Math.cos(ang) * spawnDist;
      const sz = Math.sin(ang) * spawnDist;

      const g = new THREE.Group();
      g.position.set(sx, 0, sz);

      const scale = tier === 'boss' ? 2.15 : tier === 'elite' ? 1.38 : 0.95;
      const bodyColor = tier === 'boss' ? '#e11d48' : tier === 'elite' ? '#f59e0b' : '#64748b';
      const emisColor = tier === 'boss' ? '#9f1239' : tier === 'elite' ? '#b45309' : '#334155';

      const torso = new THREE.Mesh(
        tier === 'boss'
          ? new THREE.OctahedronGeometry(0.8 * scale, 1)
          : new THREE.ConeGeometry(0.55 * scale, 1.45 * scale, 6),
        new THREE.MeshStandardMaterial({
          color: bodyColor,
          emissive: emisColor,
          emissiveIntensity: 0.55,
          roughness: 0.35,
          metalness: 0.55,
        })
      );
      torso.position.y = 0.95 * scale;
      torso.castShadow = true;
      g.add(torso);

      if (tier !== 'normal') {
        const crown = new THREE.Mesh(
          new THREE.TorusGeometry(0.65 * scale, 0.06 * scale, 8, 24),
          new THREE.MeshBasicMaterial({ color: tier === 'boss' ? '#fb7185' : '#fde047' })
        );
        crown.rotation.x = Math.PI / 2;
        crown.position.y = 1.85 * scale;
        g.add(crown);
      }

      // Red Malediction Hex Indicator Ring (shows when enemy is inside Player's Malediction Aura!)
      const hexRing = new THREE.Mesh(
        new THREE.RingGeometry(0.75 * scale, 0.9 * scale, 24),
        new THREE.MeshBasicMaterial({ color: '#ef4444', side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
      );
      hexRing.rotation.x = -Math.PI / 2;
      hexRing.position.y = 0.05;
      hexRing.visible = false;
      g.add(hexRing);

      // --- CHOOSE SUPPORT-COUNTERPLAY ARCHETYPE ---
      let archetype: EnemyInternal['archetype'] = 'brute';
      if (tier === 'elite') {
        archetype = Math.random() < 0.55 ? 'warden' : 'brute';
      } else if (tier === 'normal') {
        const r = Math.random();
        archetype = r < 0.2 ? 'soulbinder' : r < 0.5 ? 'lancer' : 'brute';
      }
      const isRanged = archetype === 'lancer' || archetype === 'soulbinder';

      let suppressField: THREE.Mesh | undefined;
      let drainBeam: THREE.Mesh | undefined;

      if (archetype === 'warden') {
        // Giant violet Aura-Collapse field that shrinks your Aura Ring while it lives!
        suppressField = new THREE.Mesh(
          new THREE.RingGeometry(WARDEN_RADIUS - 0.35, WARDEN_RADIUS, 64),
          new THREE.MeshBasicMaterial({
            color: '#a855f7',
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
          })
        );
        suppressField.rotation.x = -Math.PI / 2;
        suppressField.position.y = 0.03;
        g.add(suppressField);

        const spire = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.42, 0),
          new THREE.MeshStandardMaterial({
            color: '#c084fc',
            emissive: '#7e22ce',
            emissiveIntensity: 1.1,
          })
        );
        spire.position.y = 2.65;
        g.add(spire);
      }

      if (archetype === 'soulbinder') {
        drainBeam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 1, 6),
          new THREE.MeshBasicMaterial({ color: '#7e22ce', transparent: true, opacity: 0.8 })
        );
        drainBeam.visible = false;
        scene.add(drainBeam);
      }

      scene.add(g);

      const baseHp =
        tier === 'boss' ? 5400 : tier === 'elite' ? 1150 : archetype === 'soulbinder' ? 430 : 340;
      const baseDmg = tier === 'boss' ? 135 : tier === 'elite' ? 56 : 26;

      const affixes: string[] = [];
      if (tier === 'elite') affixes.push(archetype === 'warden' ? 'Aura Suppressor' : 'Sanguine', 'Hasted');
      if (tier === 'boss') affixes.push('Void Slammer', 'Corrupting Nova', 'Soul Siphon');

      const archName =
        archetype === 'warden'
          ? 'Dissonant Warden'
          : archetype === 'soulbinder'
          ? 'Soulbinder Acolyte'
          : archetype === 'lancer'
          ? 'Crimson Lancer'
          : 'Void Stalker';

      enemies.push({
        id: enemyIdSeq++,
        name:
          tier === 'boss'
            ? BOSS_NAMES[(ws.tier - 1) % BOSS_NAMES.length]
            : tier === 'elite' && archetype !== 'warden'
            ? 'Abyssal Choir-Slayer'
            : archName,
        tier,
        archetype,
        suppressField,
        drainBeam,
        affixes,
        hp: Math.round(baseHp * tierMultHp * modHp),
        maxHp: Math.round(baseHp * tierMultHp * modHp),
        dmg: Math.round(baseDmg * tierMultDmg * modDmg),
        speed: (tier === 'boss' ? 3.1 : isRanged ? 2.8 : 4.2) * modSpd,
        range: isRanged ? 9.0 : tier === 'boss' ? 3.6 : 2.1,
        x: sx,
        z: sz,
        attackCd: 0.8 + Math.random() * 0.6,
        specialCd: tier === 'boss' ? 3.2 : 5.5,
        mesh: g,
        hexRing,
      });

      if (tier === 'boss') {
        bossActive = true;
        spawnShockwave(sx, sz, '#f43f5e', 9.0, 0.8);
      }
    }

    // Spawn Boss/Elite Ground Telegraph Circle!
    function createTelegraph(x: number, z: number, radius: number, damage: number, ailment: AilmentType) {
      const outerMesh = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.14, radius, 48),
        new THREE.MeshBasicMaterial({ color: '#f43f5e', side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      outerMesh.rotation.x = -Math.PI / 2;
      outerMesh.position.set(x, 0.08, z);
      scene.add(outerMesh);

      const fillMesh = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 48),
        new THREE.MeshBasicMaterial({
          color: ailment === 'void_rot' ? '#a855f7' : '#ef4444',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        })
      );
      fillMesh.rotation.x = -Math.PI / 2;
      fillMesh.position.set(x, 0.07, z);
      fillMesh.scale.setScalar(0.05);
      scene.add(fillMesh);

      telegraphs.push({
        x,
        z,
        radius,
        elapsed: 0,
        duration: 1.65, // 1.65s window for player to Cleanse (Suzu) or Dash!
        damage,
        ailment,
        outerMesh,
        fillMesh,
      });
    }

    // Initial pack so action starts immediately!
    for (let i = 0; i < 5; i++) spawnEnemy('normal');
    spawnEnemy('elite');

    // --- INPUT & RAYCASTING + 3D GROUND AIM RETICLE ---
    const keys = new Set<string>();
    const mouseNdc = new THREE.Vector2(0, 0);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const raycaster = new THREE.Raycaster();
    const cursorWorld = new THREE.Vector3(0, 0, 0);

    const cursorReticle = new THREE.Group();
    const retOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.78, 32),
      new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    retOuter.rotation.x = -Math.PI / 2;
    cursorReticle.add(retOuter);
    const retInner = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.28, 4),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    );
    retInner.rotation.x = -Math.PI / 2;
    cursorReticle.add(retInner);
    cursorReticle.position.y = 0.06;
    scene.add(cursorReticle);

    function updateCursorWorld() {
      raycaster.setFromCamera(mouseNdc, camera);
      raycaster.ray.intersectPlane(groundPlane, cursorWorld);
    }

    // Ability Implementations
    function spendActiveSkillCost(baseSpiritCost: number): boolean {
      const b = buildRef.current;
      const costMult =
        (b.keystones.has('sovereign_conductor') ? 1.35 : 1.0) * (spiritVoid ? 1.6 : 1.0);
      const cost = Math.round(baseSpiritCost * costMult);

      if (b.keystones.has('eldritch_conduit')) {
        // Spend Energy Ward instead of Spirit!
        if (playerWard < cost) {
          spawnFloatingPopup(playerGroup.position.x, 2.3, playerGroup.position.z, 'LOW WARD!', '#38bdf8');
          return false;
        }
        playerWard -= cost;
        return true;
      }

      // If player reserved nearly all Spirit, cap cost gracefully or require minimal unreserved Spirit
      if (playerSpirit < Math.min(cost, Math.max(8, b.unreservedSpiritMax))) {
        spawnFloatingPopup(playerGroup.position.x, 2.3, playerGroup.position.z, 'NO UNRESERVED SPIRIT!', '#60a5fa');
        return false;
      }
      playerSpirit = Math.max(0, playerSpirit - cost);
      return true;
    }

    function triggerDash() {
      if (dashCd > 0) return;
      updateCursorWorld();
      const tethered = allies.find((a) => a.id === tetheredAllyId);
      // Dash toward cursor (or toward tethered ally if cursor wasn't moved)
      let dx = cursorWorld.x - playerGroup.position.x;
      let dz = cursorWorld.z - playerGroup.position.z;
      if (Math.hypot(dx, dz) < 0.8 && tethered) {
        dx = tethered.x - playerGroup.position.x;
        dz = tethered.z - playerGroup.position.z;
      }
      const len = Math.max(0.01, Math.hypot(dx, dz));
      dashDirX = dx / len;
      dashDirZ = dz / len;
      dashTimer = 0.24;
      dashCd = buildRef.current.dashCooldown;
      addResonance(buildRef.current.resonancePerAction * 0.5);
      gainAetherCharge(buildRef.current.abilities.dash.chargeOnUse);
      sound.playDash();
      spawnShockwave(playerGroup.position.x, playerGroup.position.z, '#fef08a', 2.4, 0.3);
    }

    function resolveChime(tx: number, tz: number, castR: number) {
      sound.playCleanseChime();
      spawnShockwave(tx, tz, '#fef08a', castR, 0.52);
      spawnShockwave(tx, tz, '#38bdf8', castR * 0.8, 0.42);

      const b = buildRef.current;
      let heroic = false;

      // Affect the Player if they cast on themselves
      if (Math.hypot(playerGroup.position.x - tx, playerGroup.position.z - tz) <= castR) {
        playerLife = Math.min(b.unreservedLifeMax, playerLife + b.cleanseBurstHeal * 0.6);
        playerWard = Math.min(b.maxWard, playerWard + b.maxWard * 0.25);
        heroic = true;
      }

      for (const ally of allies) {
        if (!ally.alive) {
          if (Math.hypot(ally.x - tx, ally.z - tz) <= castR) {
            ally.alive = true;
            ally.hp = ally.maxHp * 0.45;
            ally.invulnerableTimer = 1.4;
            clutchSaves += 1;
            heroic = true;
            sound.playLifesaverChord();
            spawnFloatingPopup(ally.x, 2.6, ally.z, '★ REVIVED! ★', '#fde047', true);
          }
          continue;
        }
        if (Math.hypot(ally.x - tx, ally.z - tz) <= castR) {
          const wasCritical = ally.hp / ally.maxHp < 0.32;
          const hadAilments = ally.ailments.length > 0;
          if (hadAilments) {
            ailmentsCleansed += ally.ailments.length;
            ally.ailments = [];
            heroic = true;
          }
          ally.invulnerableTimer = Math.max(ally.invulnerableTimer, 1.15); // 1.15s Suzu Immunity!

          const healAmt = Math.round(
            b.cleanseBurstHeal * b.allyBuffs.incomingHealMultiplier * (1 + resonance / 220)
          );
          const missing = ally.maxHp - ally.hp;
          const effective = Math.min(missing, healAmt);
          const over = Math.max(0, healAmt - missing);
          ally.hp += effective;
          const shieldGain = Math.round(over * b.overhealToOvershieldRatio + 65);
          ally.overshield = Math.min(ally.maxOvershield, ally.overshield + shieldGain);

          totalHealingDone += effective;
          totalOvershieldGranted += shieldGain;

          if (wasCritical || hadAilments) {
            clutchSaves += 1;
            ultCharge = Math.min(100, ultCharge + 12 * b.ultChargeMultiplier);
            sound.playLifesaverChord();
            spawnFloatingPopup(
              ally.x,
              2.5,
              ally.z,
              hadAilments ? '✦ CLEANSED & IMMUNE! ✦' : '★ CLUTCH SAVE! ★',
              '#fde047',
              true
            );
          } else {
            spawnFloatingPopup(ally.x, 2.2, ally.z, `+${healAmt} IMMUNE`, '#fef08a');
          }
        }
      }

      // A chime always snaps every Soulbinder siphon tether in range
      for (const en of enemies) {
        if (en.drainBeam?.visible && Math.hypot(en.x - tx, en.z - tz) <= castR + 1.5) {
          en.drainBeam.visible = false;
        }
      }

      // Resonance & Aether Charge payoff — perfect cleanses are RICHLY rewarded
      if (heroic) {
        addResonance(b.resonancePerAction * 2.2);
        gainAetherCharge(1);
      } else {
        addResonance(b.resonancePerAction);
      }

      // Knockback nearby enemies + Sovereign Symphony (6 Active Auras) Astral Supernova!
      const isSymphony = b.chorusTier === 3;
      if (isSymphony) {
        spawnShockwave(tx, tz, '#c084fc', castR + 1, 0.55);
      }
      for (const en of enemies) {
        const dx = en.x - tx;
        const dz = en.z - tz;
        const dist = Math.hypot(dx, dz);
        if (dist <= castR) {
          if (dist > 0.01 && en.tier !== 'boss') {
            en.x += (dx / dist) * 2.4;
            en.z += (dz / dist) * 2.4;
            en.mesh.position.set(en.x, 0, en.z);
          }
          if (isSymphony) {
            const novaDmg = Math.round(
              b.cleanseBurstHeal * 2.4 * b.allyBuffs.moreDamageMultiplier * cascadePower()
            );
            en.hp -= novaDmg;
            totalAttributedDamage += novaDmg;
            spawnFloatingPopup(en.x, 2.3, en.z, `✦ ${novaDmg.toLocaleString()} SUPERNOVA!`, '#e879f9', true);
          }
        }
      }
    }

    function triggerCleanse() {
      if (cleanseCd > 0) return;
      const cb = buildRef.current;
      if (!spendActiveSkillCost(18)) return;

      updateCursorWorld();
      // Smart-assist: fall back to the tethered ally if the cursor is outside the arena
      let tx = cursorWorld.x;
      let tz = cursorWorld.z;
      if (Math.hypot(tx, tz) > ARENA_RADIUS + 2) {
        const tAlly = allies.find((a) => a.id === tetheredAllyId) ?? allies[0];
        tx = tAlly.x;
        tz = tAlly.z;
      }

      cleanseCd = cb.cleanseCooldown;
      const castR = 5.8 * cb.abilities.cleanse.radiusMult;
      const chimes = 1 + cb.abilities.cleanse.extraTargets;

      // Launch glowing sacred bell projectile(s)!
      for (let c = 0; c < chimes; c++) {
        const ang = (c * Math.PI * 2) / Math.max(1, chimes);
        const ox = chimes > 1 ? Math.cos(ang) * 2.7 : 0;
        const oz = chimes > 1 ? Math.sin(ang) * 2.7 : 0;
        const bellMesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.32, 1),
          new THREE.MeshBasicMaterial({ color: '#fef08a' })
        );
        const start = playerGroup.position.clone().add(new THREE.Vector3(0, 1.7, 0));
        const end = new THREE.Vector3(tx + ox, 0.4, tz + oz);
        bellMesh.position.copy(start);
        scene.add(bellMesh);

        projectiles.push({
          start,
          end,
          t: 0,
          speed: 4.2,
          mesh: bellMesh,
          onArrive: () => resolveChime(tx + ox, tz + oz, castR),
        });
      }
    }

    let sigilVulnMult = 1.25;
    let sigilCritBonus = 0.3;

    function placeSigilAt(x: number, z: number, radius: number, durBonus: number) {
      const g = new THREE.Group();
      g.position.set(x, 0.06, z);

      const outer = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.14, radius, 48),
        new THREE.MeshBasicMaterial({ color: '#38bdf8', side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
      );
      outer.rotation.x = -Math.PI / 2;
      g.add(outer);

      const innerSquare = new THREE.Mesh(
        new THREE.RingGeometry(radius * 0.58, radius * 0.65, 6),
        new THREE.MeshBasicMaterial({ color: '#fde047', side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
      );
      innerSquare.rotation.x = -Math.PI / 2;
      g.add(innerSquare);

      const fill = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 48),
        new THREE.MeshBasicMaterial({
          color: '#0ea5e9',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        })
      );
      fill.rotation.x = -Math.PI / 2;
      g.add(fill);

      scene.add(g);
      sigils.push({ x, z, radius, remaining: 7.0 + durBonus, meshGroup: g });
    }

    function triggerSigil() {
      if (sigilCd > 0) return;
      const sb = buildRef.current;
      if (!spendActiveSkillCost(22)) return;

      updateCursorWorld();
      const sx = Math.max(-ARENA_RADIUS + 2, Math.min(ARENA_RADIUS - 2, cursorWorld.x));
      const sz = Math.max(-ARENA_RADIUS + 2, Math.min(ARENA_RADIUS - 2, cursorWorld.z));
      sigilCd = sb.sigilCooldown;
      sound.playSigilCast();

      const am = sb.abilities.sigil;
      sigilVulnMult = 1.25 * (1 + (am.potencyMult - 1) * 0.7);
      sigilCritBonus = 0.3 * am.potencyMult;
      const radius = 5.4 * am.radiusMult;

      placeSigilAt(sx, sz, radius, am.extraTargets > 0 ? 2.5 : 0);
      for (let e2 = 0; e2 < am.extraTargets; e2++) {
        const ang = ((e2 + 1) * Math.PI * 2) / (am.extraTargets + 1);
        placeSigilAt(
          sx + Math.cos(ang) * radius * 0.92,
          sz + Math.sin(ang) * radius * 0.92,
          radius * 0.8,
          1.2
        );
      }

      // Casting a rune ON TOP of a monster line is rewarded heavily
      const landedOnPack = enemies.some((en) => Math.hypot(en.x - sx, en.z - sz) <= radius * 1.15);
      addResonance(sb.resonancePerAction * (landedOnPack ? 1.6 : 0.7));
      if (landedOnPack || am.chargeOnUse > 0) gainAetherCharge(Math.max(1, am.chargeOnUse));
    }

    function triggerUltimate() {
      if (ultCharge < 100 || ultActiveRemaining > 0) return;
      const ua = buildRef.current.abilities.ult;
      ultCharge = 0;
      ultActiveRemaining =
        (8.0 + buildRef.current.ultDurationBonus) * (1 + (ua.potencyMult - 1) * 0.6);
      ultRadiusMult = ua.radiusMult;
      addResonance(buildRef.current.resonancePerAction * 2.5);
      gainAetherCharge(2 + ua.chargeOnUse);
      sound.playUltimate();
      spawnShockwave(playerGroup.position.x, playerGroup.position.z, '#fde047', 16.0, 0.85);
      spawnFloatingPopup(
        playerGroup.position.x,
        3.0,
        playerGroup.position.z,
        '☀ SANCTUARY APOTHEOSIS! ☀',
        '#fde047',
        true
      );

      // Instantly revive downed allies & cleanse all!
      for (const ally of allies) {
        ally.alive = true;
        ally.ailments = [];
        ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.5);
        ally.overshield = ally.maxOvershield;
        ally.invulnerableTimer = Math.max(ally.invulnerableTimer, 1.8);
      }
    }

    function toggleBeamMode() {
      beamMode = beamMode === 'heal' ? 'amp' : 'heal';
    }

    function selectAlly(id: 'kael' | 'lyra' | 'vexis') {
      tetheredAllyId = id;
    }

    function collectAllLoot() {
      while (lootVisuals.length > 0) {
        collectLootByIndex(0);
      }
    }

    function spawnBossNow() {
      if (!bossActive) {
        waveKillsScore = 100;
        spawnEnemy('boss');
      }
    }

    actionRef.current = {
      triggerDash,
      triggerCleanse,
      triggerSigil,
      triggerUltimate,
      triggerCascade,
      toggleBeamMode,
      selectAlly,
      collectAllLoot,
      spawnBossNow,
      resetRunStats,
    };

    // --- DOM EVENT LISTENERS ---
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const k = e.key.toLowerCase();
      keys.add(k);

      if (pausedRef.current) return;

      if (k === 'q') {
        e.preventDefault();
        toggleBeamMode();
      } else if (e.code === 'Space') {
        e.preventDefault();
        triggerDash();
      } else if (k === 'e') {
        e.preventDefault();
        triggerCleanse();
      } else if (k === 'f') {
        e.preventDefault();
        triggerSigil();
      } else if (k === 'r') {
        e.preventDefault();
        triggerUltimate();
      } else if (k === 'x') {
        e.preventDefault();
        triggerCascade();
      } else if (k === '1') {
        selectAlly('kael');
      } else if (k === '2') {
        selectAlly('lyra');
      } else if (k === '3') {
        selectAlly('vexis');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (pausedRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      updateCursorWorld();

      if (e.button === 2) {
        // Right click toggles Heal ⇄ Damage Amp stream (just like Mercy!)
        e.preventDefault();
        toggleBeamMode();
        return;
      }

      if (e.button === 0) {
        // Check if clicking near a loot drop first
        for (let i = 0; i < lootVisuals.length; i++) {
          const lv = lootVisuals[i];
          if (Math.hypot(lv.drop.x - cursorWorld.x, lv.drop.z - cursorWorld.z) < 1.8) {
            collectLootByIndex(i);
            return;
          }
        }

        // Snap tether to nearest ally to cursor!
        let bestId: 'kael' | 'lyra' | 'vexis' = tetheredAllyId;
        let bestDist = 5.5; // Generous Overwatch-style tether snap cone!
        for (const ally of allies) {
          const dAlly = Math.hypot(ally.x - cursorWorld.x, ally.z - cursorWorld.z);
          if (dAlly < bestDist) {
            bestDist = dAlly;
            bestId = ally.id;
          }
        }
        tetheredAllyId = bestId;
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onWheel = (e: WheelEvent) => {
      cameraZoom = Math.max(15, Math.min(35, cameraZoom + e.deltaY * 0.015));
    };

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', onResize);

    // --- MAIN 60FPS GAME SIMULATION & RENDER LOOP ---
    let animFrameId = 0;
    let lastTime = performance.now();
    let elapsedTotal = 0;
    let hudSyncTimer = 0;
    let spawnWaveTimer = 0;
    let beamPopupTimer = 0;
    let chorusNovaTimer = 0;

    function animate(now: number) {
      animFrameId = requestAnimationFrame(animate);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      // Check floor theme updates if user changed Waystone
      if (waystoneRef.current.theme !== currentFloorTheme) {
        currentFloorTheme = waystoneRef.current.theme;
        floorMat.map?.dispose();
        floorMat.map = createSanctumFloorTexture(currentFloorTheme);
        floorMat.needsUpdate = true;
      }

      syncVisualAuraRings();
      const b = buildRef.current;

      // Clamp Player resources cleanly to current build caps
      playerLife = Math.min(b.unreservedLifeMax, playerLife);
      playerWard = Math.min(b.maxWard, playerWard);
      playerSpirit = Math.min(b.unreservedSpiritMax, playerSpirit);

      if (!pausedRef.current) {
        elapsedTotal += dt;

        // Update 3D Ground Aim Reticle
        updateCursorWorld();
        const retDist = Math.hypot(cursorWorld.x, cursorWorld.z);
        if (retDist <= ARENA_RADIUS + 2) {
          cursorReticle.position.set(cursorWorld.x, 0.06, cursorWorld.z);
          cursorReticle.rotation.y += dt * 1.8;
        }

        // Scale Heroes with Weaver Level AND their personal Hero Bond Affinity Ranks + Talents!
        const heroHpScale = 1 + (b.playerLevel - 1) * 0.14;
        const heroDpsScale = 1 + (b.playerLevel - 1) * 0.12;
        allies.forEach((ally, idx) => {
          const baseDef = heroDefs[idx];
          const hb = b.heroBonuses[ally.id];
          const newMaxHp = Math.round(baseDef.hp * heroHpScale * hb.hpMult);
          if (newMaxHp !== ally.maxHp) {
            const ratio = ally.maxHp > 0 ? ally.hp / ally.maxHp : 1;
            ally.maxHp = newMaxHp;
            ally.maxOvershield = Math.round(newMaxHp * b.allyMaxOvershieldMult);
            if (ally.alive) ally.hp = Math.round(newMaxHp * ratio);
          }
          ally.baseDps = Math.round(baseDef.dps * heroDpsScale * hb.dmgMult);
        });

        // Dissonant Wardens collapse your Aura Field while they live (unless Shatterproof Legacy!)
        undyingCd = Math.max(0, undyingCd - dt);
        cascadeCd = Math.max(0, cascadeCd - dt);
        if (cascadeActiveRemaining > 0) {
          cascadeActiveRemaining = Math.max(0, cascadeActiveRemaining - dt);
          if (cascadeActiveRemaining === 0) cascadeStacks = 0;
        }
        suppressionActive =
          !b.wardenProof &&
          enemies.some(
            (e) =>
              e.archetype === 'warden' &&
              Math.hypot(e.x - playerGroup.position.x, e.z - playerGroup.position.z) <= WARDEN_RADIUS
          );
        const suppressRadiusFactor = suppressionActive ? 0.58 : 1.0;
        const suppressHealFactor = suppressionActive ? 0.72 : 1.0;

        // --- RESONANCE COMBO: decays if you stop supporting! ---
        resonanceFresh += dt;
        if (resonanceFresh > b.resonanceDecayTime && resonance > 0) {
          resonance = Math.max(0, resonance - (b.resonanceMax / b.resonanceDecayTime) * dt * 0.85);
        }
        if (resonance >= b.resonanceMax * 0.995) {
          // Full Resonance converts into a banked Aether Charge — the reward loop
          resonance = b.resonanceMax * 0.15;
          resonancesPeaked += 1;
          gainAetherCharge(1);
          sound.playChargeBank();
          spawnShockwave(playerGroup.position.x, playerGroup.position.z, '#5eead4', 3.4, 0.35);
          spawnFloatingPopup(
            playerGroup.position.x,
            3.25,
            playerGroup.position.z,
            '◆ RESONANCE PEAKED — CHARGE BANKED',
            '#5eead4',
            true
          );
        }

        // --- BOSS DECREE ORCHESTRATION ---
        const bossNow = enemies.find((e) => e.tier === 'boss');
        spiritVoid = decree?.key === 'spirit_void';
        if (bossNow) {
          if (!decree) {
            decreeTimer -= dt;
            if (decreeTimer <= 0) {
              const pool: DecreeState[] = [
                {
                  key: 'convergence',
                  name: 'DECREE: CONVERGENCE',
                  desc: 'Keep ALL heroes inside your Aura Ring for 6s or they burn',
                  timeLeft: 10,
                  duration: 10,
                  progress: 0,
                },
                {
                  key: 'single_thread',
                  name: 'DECREE: SINGLE THREAD',
                  desc: 'Keep your beam locked on the MARKED hero — or they shatter',
                  timeLeft: 9,
                  duration: 9,
                  progress: 0,
                },
                {
                  key: 'spirit_void',
                  name: 'DECREE: SPIRIT VOID',
                  desc: 'Your Spirit wells run dry — cast from Ward & Aether Charges',
                  timeLeft: 8,
                  duration: 8,
                  progress: 0,
                },
                {
                  key: 'shatter_halo',
                  name: 'DECREE: SHATTER HALO',
                  desc: 'Halo fractured — slay the summoned Wardens to restore it',
                  timeLeft: 12,
                  duration: 12,
                  progress: 0,
                },
              ];
              const pick = pool[Math.floor(Math.random() * pool.length)];
              decree = pick;
              sound.playUltimate();
              spawnFloatingPopup(playerGroup.position.x, 3.6, playerGroup.position.z, pick.name, '#f43f5e', true);

              if (pick.key === 'single_thread') {
                const living = allies.filter((a) => a.alive);
                markedAllyId = living[Math.floor(Math.random() * living.length)]?.id ?? null;
              }
              if (pick.key === 'shatter_halo') {
                spawnEnemy('elite');
                spawnEnemy('elite');
              }
            }
          } else {
            decree.timeLeft -= dt;
            if (decree.key === 'convergence') {
              const allIn = allies
                .filter((a) => a.alive)
                .every((a) => Math.hypot(a.x - playerGroup.position.x, a.z - playerGroup.position.z) <= b.auraRadius * 1.05);
              if (allIn) {
                decree.progress += (100 / 6) * dt;
                for (const a of allies) if (a.alive) a.overshield = Math.min(a.maxOvershield, a.overshield + 40 * dt);
              } else {
                for (const a of allies) {
                  if (a.alive && Math.hypot(a.x - playerGroup.position.x, a.z - playerGroup.position.z) > b.auraRadius * 1.05) {
                    a.hp -= a.maxHp * 0.05 * dt;
                  }
                }
              }
            } else if (decree.key === 'single_thread') {
              const marked = allies.find((a) => a.id === markedAllyId);
              if (marked && marked.alive) {
                if (marked.isTetheredPrimary || marked.isTetheredSecondary || ultActiveRemaining > 0) {
                  decree.progress += (100 / 5.5) * dt;
                } else {
                  marked.hp -= marked.maxHp * 0.075 * dt;
                }
              } else {
                decree.progress += 30 * dt;
              }
            } else {
              // Void / Halo decrees are survived by continuing to fight
              decree.progress += (100 / decree.duration) * dt * (spiritVoid ? 1 : 0.9);
              if (decree.key === 'spirit_void') {
                playerSpirit = Math.max(0, playerSpirit - 4 * dt);
              }
            }

            if (decree.progress >= 100) {
              endDecree(true);
              decreeTimer = 15 + Math.random() * 7;
            } else if (decree.timeLeft <= 0) {
              endDecree(false);
              decreeTimer = 13 + Math.random() * 6;
            }
          }
        } else if (decree) {
          endDecree(true);
          decree = null;
        }

        // Cooldowns & Timers
        dashCd = Math.max(0, dashCd - dt);
        cleanseCd = Math.max(0, cleanseCd - dt);
        sigilCd = Math.max(0, sigilCd - dt);
        if (ultActiveRemaining > 0) {
          ultActiveRemaining = Math.max(0, ultActiveRemaining - dt);
        }

        // Player Spirit & Ward Regeneration (a Spirit Void decree halts the wells!)
        if (!spiritVoid) {
          playerSpirit = Math.min(b.unreservedSpiritMax, playerSpirit + (16 + b.maxSpirit * 0.06) * dt);
        }
        if (wardDamageDelay > 0) {
          wardDamageDelay -= dt;
        } else {
          playerWard = Math.min(b.maxWard, playerWard + b.wardRechargePerSec * dt);
        }
        playerLife = Math.min(b.unreservedLifeMax, playerLife + b.unreservedLifeMax * 0.03 * dt);

        // --- 1. PLAYER MOVEMENT (WASD or Dash or Optional Auto-Positioning) ---
        if (dashTimer > 0) {
          dashTimer -= dt;
          playerGroup.position.x += dashDirX * 24 * dt;
          playerGroup.position.z += dashDirZ * 24 * dt;
        } else {
          let mx = 0;
          let mz = 0;
          if (keys.has('w') || keys.has('arrowup')) mz -= 1;
          if (keys.has('s') || keys.has('arrowdown')) mz += 1;
          if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
          if (keys.has('d') || keys.has('arrowright')) mx += 1;

          if (mx !== 0 || mz !== 0) {
            const len = Math.hypot(mx, mz);
            playerGroup.position.x += (mx / len) * b.playerMoveSpeed * dt;
            playerGroup.position.z += (mz / len) * b.playerMoveSpeed * dt;
            playerGroup.rotation.y = Math.atan2(mx, mz);
          } else if (autoPilotRef.current) {
            // Auto-position cleanly near centroid of living allies while dodging telegraphs!
            const living = allies.filter((a) => a.alive);
            if (living.length > 0) {
              let cx = living.reduce((s, a) => s + a.x, 0) / living.length;
              let cz = living.reduce((s, a) => s + a.z, 0) / living.length + 2.2;
              for (const tel of telegraphs) {
                const dx = playerGroup.position.x - tel.x;
                const dz = playerGroup.position.z - tel.z;
                const dTel = Math.hypot(dx, dz);
                if (dTel < tel.radius + 1.5 && dTel > 0.01) {
                  cx = playerGroup.position.x + (dx / dTel) * 5;
                  cz = playerGroup.position.z + (dz / dTel) * 5;
                }
              }
              const dx = cx - playerGroup.position.x;
              const dz = cz - playerGroup.position.z;
              const dist = Math.hypot(dx, dz);
              if (dist > 0.7) {
                playerGroup.position.x += (dx / dist) * b.playerMoveSpeed * 0.82 * dt;
                playerGroup.position.z += (dz / dist) * b.playerMoveSpeed * 0.82 * dt;
              }
            }
          }
        }

        // Clamp player inside Arena
        const pDist = Math.hypot(playerGroup.position.x, playerGroup.position.z);
        if (pDist > ARENA_RADIUS - 1.0) {
          playerGroup.position.x = (playerGroup.position.x / pDist) * (ARENA_RADIUS - 1.0);
          playerGroup.position.z = (playerGroup.position.z / pDist) * (ARENA_RADIUS - 1.0);
        }

        // Scale Ground Aura Ring to exact computed Aura Radius (boosted during Ultimate, shrunk by Wardens!)
        const activeAuraRad =
          b.auraRadius *
          (ultActiveRemaining > 0 ? 1.85 * ultRadiusMult : 1.0) *
          (cascadeActiveRemaining > 0 ? 1.15 : 1.0) *
          suppressRadiusFactor *
          (decree?.key === 'shatter_halo' ? 0.6 : 1.0);
        primaryAuraOuterRing.material.color.set(suppressionActive ? '#a855f7' : '#fbbf24');
        groundAuraGroup.scale.set(activeAuraRad, 1, activeAuraRad);
        groundAuraGroup.rotation.y += dt * 0.35;

        // Animate Back Seraphic Halo Rings
        backHaloMeshes.forEach((hm, idx) => {
          hm.rotation.z = elapsedTotal * (0.8 + idx * 0.25) * (idx % 2 === 0 ? 1 : -1);
          hm.rotation.x = Math.sin(elapsedTotal * 1.2 + idx) * 0.32;
        });
        censerOrb.position.y = 1.48 + Math.sin(elapsedTotal * 4.2) * 0.12;
        censerOrb.rotation.y += dt * 2.6;
        (censerOrb.material as THREE.MeshStandardMaterial).color.set(
          cascadeActiveRemaining > 0
            ? '#2dd4bf'
            : ultActiveRemaining > 0
            ? '#fde047'
            : beamMode === 'heal'
            ? '#34d399'
            : '#38bdf8'
        );
        // Resonant Cascade & high Resonance make the Censer visibly surge
        const surge =
          (cascadeActiveRemaining > 0 ? 0.35 : 0) + Math.min(0.3, (resonance / Math.max(1, b.resonanceMax)) * 0.3);
        censerOrb.scale.setScalar(1 + surge + Math.sin(elapsedTotal * 9) * surge * 0.35);

        // Auto-vacuum nearby 3D Loot Drops within 4.4 units!
        for (let i = lootVisuals.length - 1; i >= 0; i--) {
          const lv = lootVisuals[i];
          lv.group.children[0].rotation.y += dt * 2.5;
          const dx = playerGroup.position.x - lv.drop.x;
          const dz = playerGroup.position.z - lv.drop.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 4.5) {
            if (dist < 1.1) {
              collectLootByIndex(i);
            } else {
              lv.drop.x += (dx / dist) * 14 * dt;
              lv.drop.z += (dz / dist) * 14 * dt;
              lv.group.position.set(lv.drop.x, 0, lv.drop.z);
            }
          }
        }

        // --- 2. UPDATE CONSECRATED SIGILS ---
        for (let i = sigils.length - 1; i >= 0; i--) {
          const sig = sigils[i];
          sig.remaining -= dt;
          sig.meshGroup.rotation.y += dt * 0.9;
          if (sig.remaining <= 0) {
            scene.remove(sig.meshGroup);
            sigils.splice(i, 1);
          }
        }

        // --- 3. DETERMINE TETHER TARGETS (Primary + Triad Bond Secondary + Transcendence All-3!) ---
        const isUlt = ultActiveRemaining > 0;
        let primaryAlly = allies.find((a) => a.id === tetheredAllyId && a.alive);
        if (!primaryAlly) {
          primaryAlly = allies.find((a) => a.alive) ?? allies[0];
          tetheredAllyId = primaryAlly.id;
        }

        let secondaryAlly: AllyInternal | null = null;
        if (!isUlt && b.secondaryTetherPotency > 0) {
          // Pick most injured other living ally (in heal mode) or highest baseDps ally (in amp mode)
          const others = allies.filter((a) => a.alive && a.id !== primaryAlly!.id);
          if (others.length > 0) {
            others.sort((a, bAlly) =>
              beamMode === 'heal' ? a.hp / a.maxHp - bAlly.hp / bAlly.maxHp : bAlly.baseDps - a.baseDps
            );
            secondaryAlly = others[0];
          }
        }

        // Triad Chorus (3+ Active Auras): Pulse Mending & Overshield Nova around Primary Tethered Hero every 3.5s!
        if (b.chorusTier >= 1 && primaryAlly && primaryAlly.alive) {
          chorusNovaTimer += dt;
          if (chorusNovaTimer >= 3.5) {
            chorusNovaTimer = 0;
            spawnShockwave(primaryAlly.x, primaryAlly.z, '#34d399', 5.6, 0.45);
            const pulseHeal = Math.round(b.tetherHealPerSec * 0.65);
            for (const al of allies) {
              if (al.alive && Math.hypot(al.x - primaryAlly.x, al.z - primaryAlly.z) <= 5.8) {
                const act = Math.min(al.maxHp - al.hp, pulseHeal);
                al.hp += act;
                al.overshield = Math.min(al.maxOvershield, al.overshield + 45);
                totalHealingDone += act;
                totalOvershieldGranted += 45;
              }
            }
            spawnFloatingPopup(primaryAlly.x, 2.35, primaryAlly.z, `✦ CHORUS PULSE +${pulseHeal}`, '#6ee7b7');
          }
        }

        // Update Tether Visuals & Apply Continuous Mending Stream!
        beamPopupTimer += dt;
        const emitHealNumberNow = beamPopupTimer >= 0.42;
        if (emitHealNumberNow) beamPopupTimer = 0;

        const censerWorldPos = new THREE.Vector3();
        censerOrb.getWorldPosition(censerWorldPos);

        allies.forEach((ally, idx) => {
          ally.isTetheredPrimary = isUlt || ally.id === primaryAlly?.id;
          ally.isTetheredSecondary = !isUlt && ally.id === secondaryAlly?.id;

          if (!ally.alive) {
            // Revive ally if player stands within 3.5u or tethers them!
            if (ally.id === primaryAlly?.id || Math.hypot(ally.x - playerGroup.position.x, ally.z - playerGroup.position.z) < 3.8) {
              ally.reviveProgress += dt * 0.42;
              if (ally.reviveProgress >= 1) {
                ally.alive = true;
                ally.reviveProgress = 0;
                ally.hp = ally.maxHp * 0.5;
                ally.invulnerableTimer = 1.2;
                sound.playLifesaverChord();
                spawnFloatingPopup(ally.x, 2.4, ally.z, '★ HERO REVIVED! ★', '#fde047', true);
              }
            }
            hideBeam(tetherBeams[idx]);
            return;
          }

          const hasBeam = ally.isTetheredPrimary || ally.isTetheredSecondary;
          if (hasBeam) {
            const targetPos = new THREE.Vector3(ally.x, 1.25, ally.z);
            updateBeamMesh(
              tetherBeams[idx],
              censerWorldPos,
              targetPos,
              beamMode,
              elapsedTotal,
              isUlt,
              ally.isTetheredSecondary ? 0.075 : 0.12
            );

            // Apply Mending Stream if in 'heal' mode OR Ultimate is active (Ultimate grants BOTH Heal & Amp!)
            if (beamMode === 'heal' || isUlt) {
              const potency = ally.isTetheredSecondary ? b.secondaryTetherPotency : 1.0;
              const rawHeal =
                b.tetherHealPerSec *
                potency *
                b.allyBuffs.incomingHealMultiplier *
                suppressHealFactor *
                cascadePower() *
                (isUlt ? 1.55 : 1.0) *
                dt;

              const prevRatio = ally.hp / ally.maxHp;
              const missing = ally.maxHp - ally.hp;
              const actualHeal = Math.min(missing, rawHeal);
              const overheal = Math.max(0, rawHeal - missing);

              ally.hp += actualHeal;
              const newRatio = ally.hp / ally.maxHp;

              const shieldAdded = overheal * b.overhealToOvershieldRatio;
              ally.overshield = Math.min(ally.maxOvershield, ally.overshield + shieldAdded);

              if (actualHeal > 0) {
                totalHealingDone += actualHeal;
                // Sustained Mending Stream keeps the Resonance combo alive
                if (ally.isTetheredPrimary) {
                  addResonance(b.resonancePerAction * 0.85 * dt * 2.2);
                }
                bondXpAccum[ally.id] += actualHeal * 0.12;
                ultCharge = Math.min(100, ultCharge + (actualHeal / ally.maxHp) * 18 * b.ultChargeMultiplier);
                if (ally.isTetheredPrimary) {
                  sound.playHealTick(newRatio, prevRatio < 0.99 && newRatio >= 0.995);
                }
                if (emitHealNumberNow && actualHeal > 1.5) {
                  spawnFloatingPopup(
                    ally.x + (Math.random() - 0.5) * 0.5,
                    2.15,
                    ally.z,
                    `+${Math.round(b.tetherHealPerSec * potency * 0.42)} ♥`,
                    '#34d399'
                  );
                }
              }
              if (shieldAdded > 0) {
                totalOvershieldGranted += shieldAdded;
              }
            }
          } else {
            hideBeam(tetherBeams[idx]);
          }
        });

        // --- 4. ALLY AI, AURA BUFFS, AILMENTS & ATTACKS ---
        for (const ally of allies) {
          ally.meshGroup.visible = true;
          if (!ally.alive) {
            ally.meshGroup.scale.set(1, 0.25, 1);
            continue;
          }
          ally.meshGroup.scale.set(1, 1, 1);

          if (ally.invulnerableTimer > 0) {
            ally.invulnerableTimer = Math.max(0, ally.invulnerableTimer - dt);
          }
          ally.suzuSphere.visible = ally.invulnerableTimer > 0;
          if (ally.suzuSphere.visible) {
            ally.suzuSphere.rotation.y += dt * 3.5;
          }

          // Check if inside Player's Aura Ring & Ground Sigils
          const distToPlayer = Math.hypot(ally.x - playerGroup.position.x, ally.z - playerGroup.position.z);
          ally.inAura = distToPlayer <= activeAuraRad;
          const isMarked = markedAllyId === ally.id;
          ally.inAuraRing.visible = (ally.inAura && b.activeAuras.length > 0) || isMarked;
          (ally.inAuraRing.material as THREE.MeshBasicMaterial).color.set(
            isMarked ? '#f43f5e' : ally.color
          );
          ally.inAuraRing.scale.setScalar(isMarked ? 1.18 + Math.sin(elapsedTotal * 7) * 0.14 : 1);

          ally.inSigil = sigils.some((s) => Math.hypot(ally.x - s.x, ally.z - s.z) <= s.radius);

          // Apply Passive Aura Regeneration & Discipline Overshield!
          if (ally.inAura) {
            const regen =
              ally.maxHp * (b.allyBuffs.regenPctPerSec / 100) * b.allyBuffs.incomingHealMultiplier * dt;
            const actualRegen = Math.min(ally.maxHp - ally.hp, regen);
            ally.hp += actualRegen;
            totalHealingDone += actualRegen;

            if (b.allyBuffs.overshieldPerSec > 0) {
              const os = b.allyBuffs.overshieldPerSec * dt;
              ally.overshield = Math.min(ally.maxOvershield, ally.overshield + os);
              totalOvershieldGranted += os;
            }
          }
          if (ally.inSigil) {
            ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.055 * dt);
          }

          // Process Ailments (Bleed & Void Rot deal heavy DoT unless Cleansed!)
          let speedPenalty = 1.0;
          for (let i = ally.ailments.length - 1; i >= 0; i--) {
            const ail = ally.ailments[i];
            const resFactor = ally.inAura ? Math.max(0.35, 1 - b.allyBuffs.elemResPct / 140) : 1.0;
            ail.duration -= dt / resFactor;
            if (ail.type === 'freeze') speedPenalty = 0.45;
            if (ally.invulnerableTimer <= 0 && (ail.type === 'bleed' || ail.type === 'void_rot')) {
              const dot = ally.maxHp * (ail.type === 'void_rot' ? 0.085 : 0.06) * ail.stacks * resFactor * dt;
              ally.hp -= dot;
            }
            if (ail.duration <= 0) ally.ailments.splice(i, 1);
          }
          ally.ailmentRing.visible = ally.ailments.length > 0;
          if (ally.ailmentRing.visible) {
            ally.ailmentRing.rotation.z += dt * 4;
          }

          // Check Caduceus Prime Immortal Ult protection & Martyr "Undying Devotion"!
          if (ally.hp <= 0) {
            if (isUlt && b.uniques.has('caduceus_prime')) {
              ally.hp = 1;
            } else if (b.undyingDevotion && ally.inAura && undyingCd <= 0) {
              undyingCd = 22;
              ally.hp = 1;
              ally.overshield = ally.maxOvershield;
              ally.invulnerableTimer = Math.max(ally.invulnerableTimer, 1.3);
              clutchSaves += 1;
              sound.playLifesaverChord();
              spawnShockwave(ally.x, ally.z, '#f43f5e', 6.2, 0.6);
              spawnFloatingPopup(ally.x, 2.7, ally.z, '✞ UNDYING DEVOTION! ✞', '#fda4af', true);
            } else {
              ally.hp = 0;
              ally.alive = false;
              spawnFloatingPopup(ally.x, 2.2, ally.z, `${ally.name} DOWN!`, '#ef4444', true);
              continue;
            }
          }

          // Choose Target Enemy based on Directive
          let targetEnemy: EnemyInternal | null = null;
          if (enemies.length > 0) {
            if (directiveRef.current === 'focus_boss') {
              targetEnemy = enemies.find((e) => e.tier === 'boss') ?? enemies.find((e) => e.tier === 'elite') ?? null;
            }
            if (!targetEnemy) {
              let best = Infinity;
              for (const en of enemies) {
                const dEn = Math.hypot(en.x - ally.x, en.z - ally.z);
                if (dEn < best) {
                  best = dEn;
                  targetEnemy = en;
                }
              }
            }
          }

          // Ally Tactical Positioning
          const allyMoveSpd =
            4.6 * (1 + (ally.inAura ? b.allyBuffs.moveSpeedPct : 0) / 100) * speedPenalty;

          if (directiveRef.current === 'formation' && distToPlayer > activeAuraRad * 0.78) {
            // Pull neatly inside Player's Aura Ring!
            const dx = playerGroup.position.x - ally.x;
            const dz = playerGroup.position.z - ally.z;
            const dP = Math.max(0.01, Math.hypot(dx, dz));
            ally.x += (dx / dP) * allyMoveSpd * 1.15 * dt;
            ally.z += (dz / dP) * allyMoveSpd * 1.15 * dt;
          } else if (targetEnemy) {
            const dx = targetEnemy.x - ally.x;
            const dz = targetEnemy.z - ally.z;
            const dist = Math.max(0.01, Math.hypot(dx, dz));
            ally.facing = Math.atan2(dx, dz);
            ally.meshGroup.rotation.y = ally.facing;

            if (dist > ally.attackRange * 0.88) {
              ally.x += (dx / dist) * allyMoveSpd * dt;
              ally.z += (dz / dist) * allyMoveSpd * dt;
            } else if (ally.role !== 'Tank' && dist < 3.6) {
              // Ranged heroes smartly kite back slightly!
              ally.x -= (dx / dist) * allyMoveSpd * 0.65 * dt;
              ally.z -= (dz / dist) * allyMoveSpd * 0.65 * dt;
            }
          }

          // Keep allies separated slightly & inside Arena
          for (const other of allies) {
            if (other.id === ally.id || !other.alive) continue;
            const sx = ally.x - other.x;
            const sz = ally.z - other.z;
            const sd = Math.hypot(sx, sz);
            if (sd < 1.5 && sd > 0.01) {
              ally.x += (sx / sd) * 2.2 * dt;
              ally.z += (sz / sd) * 2.2 * dt;
            }
          }
          const aRad = Math.hypot(ally.x, ally.z);
          if (aRad > ARENA_RADIUS - 1.2) {
            ally.x = (ally.x / aRad) * (ARENA_RADIUS - 1.2);
            ally.z = (ally.z / aRad) * (ARENA_RADIUS - 1.2);
          }
          ally.meshGroup.position.set(ally.x, 0, ally.z);

          // --- ALLY ATTACKS & EXACT SUPPORT ATTRIBUTION MATH! ---
          ally.attackCooldown -= dt * speedPenalty;
          if (targetEnemy && ally.attackCooldown <= 0) {
            const distToTarget = Math.hypot(targetEnemy.x - ally.x, targetEnemy.z - ally.z);
            if (distToTarget <= ally.attackRange + 1.0) {
              const isAmpTethered =
                isUlt ||
                (beamMode === 'amp' && (ally.isTetheredPrimary || ally.isTetheredSecondary));
              const ampPotency =
                ally.isTetheredSecondary && !isUlt ? b.secondaryTetherPotency : 1.0;
              const hb = b.heroBonuses[ally.id];

              // Attack Speed Scaling (Base 1.0 attack/sec)
              const atkSpdBonusPct =
                (ally.inAura ? b.allyBuffs.attackSpeedPct : 0) +
                (isAmpTethered ? b.tetherAmpAttackSpeedPct * ampPotency : 0) +
                (ally.inSigil && b.ascNodes.has('chr_rift') ? 22 : 0);
              const attacksPerSec = Math.max(0.6, 1.15 * (1 + atkSpdBonusPct / 100));
              ally.attackCooldown = 1 / attacksPerSec;

              // Base Unbuffed Hit vs Support-Amplified Hit!
              const rawUnbuffedHit = ally.baseDps / 1.15;

              const flatAdded = ally.inAura ? b.allyBuffs.flatDamage : 0;
              const auraMoreMult = ally.inAura ? b.allyBuffs.moreDamageMultiplier : 1.0;
              const ampBeamMult = isAmpTethered
                ? 1 + (b.tetherAmpMoreDamagePct * ampPotency) / 100
                : 1.0;

              // Crit calculation
              const critChance =
                0.1 +
                (ally.inAura ? b.allyBuffs.critChancePct / 100 : 0) +
                (ally.inSigil ? sigilCritBonus : 0);
              const isCrit = Math.random() < Math.min(0.95, critChance);
              const critMult = isCrit
                ? 1.65 +
                  (isAmpTethered ? (b.tetherCritMultiBonus * ampPotency) / 100 : 0) +
                  hb.critMultiBonus / 100
                : 1.0;

              // Enemy Vulnerability (Malediction Halo Aura + Consecrated Sigil!)
              const enemyInMalediction =
                Math.hypot(targetEnemy.x - playerGroup.position.x, targetEnemy.z - playerGroup.position.z) <=
                activeAuraRad;
              const enemyInSigil = sigils.some(
                (s) => Math.hypot(targetEnemy!.x - s.x, targetEnemy!.z - s.z) <= s.radius
              );
              const vulnMult =
                (enemyInMalediction ? b.allyBuffs.enemyDamageTakenMultiplier : 1.0) *
                (enemyInSigil ? sigilVulnMult : 1.0) *
                (isAmpTethered ? cascadePower() : 1) *
                (targetEnemy.tier === 'boss' && b.uniques.has('caduceus_prime') ? 1.08 : 1) *
                (ally.inAura && resonance > 40 ? 1 + resonance / 400 : 1);

              const finalHit = Math.round(
                (rawUnbuffedHit + flatAdded) * auraMoreMult * ampBeamMult * critMult * vulnMult
              );
              const supportAddedPortion = Math.max(0, finalHit - rawUnbuffedHit * (isCrit ? 1.65 : 1.0));

              // Overshield on Hit from Aegis Overflow Support Rune!
              if (ally.inAura && b.allyBuffs.overshieldOnHit > 0) {
                ally.overshield = Math.min(ally.maxOvershield, ally.overshield + b.allyBuffs.overshieldOnHit);
                totalOvershieldGranted += b.allyBuffs.overshieldOnHit;
              }

              // Launch crisp visual projectile / cleave!
              const projMesh = new THREE.Mesh(
                new THREE.SphereGeometry(ally.role === 'Tank' ? 0.24 : 0.16, 8, 8),
                new THREE.MeshBasicMaterial({
                  color: isAmpTethered ? '#38bdf8' : ally.color,
                })
              );
              const pStart = new THREE.Vector3(ally.x, 1.2, ally.z);
              const pEnd = new THREE.Vector3(targetEnemy.x, 1.0, targetEnemy.z);
              projMesh.position.copy(pStart);
              scene.add(projMesh);

              const capturedTargetId = targetEnemy.id;
              projectiles.push({
                start: pStart,
                end: pEnd,
                t: 0,
                speed: ally.role === 'Tank' ? 9.0 : 5.5,
                mesh: projMesh,
                onArrive: () => {
                  const en = enemies.find((e) => e.id === capturedTargetId);
                  if (!en) return;
                  en.hp -= finalHit;
                  totalAttributedDamage += supportAddedPortion;
                  bondXpAccum[ally.id] += supportAddedPortion * 0.05;

                  // Hero Talent: Splash Damage (Tempest Cadence / Astral Echo)
                  if (hb.splashPct > 0) {
                    const splashDmg = Math.round(finalHit * (hb.splashPct / 100));
                    for (const other of enemies) {
                      if (other.id === en.id) continue;
                      if (Math.hypot(other.x - en.x, other.z - en.z) <= 3.4) {
                        other.hp -= splashDmg;
                        totalAttributedDamage += splashDmg * 0.5;
                      }
                    }
                    spawnShockwave(en.x, en.z, ally.color, 3.2, 0.22);
                  }

                  ally.damageWindow.push({
                    time: elapsedTotal,
                    total: finalHit,
                    attributed: supportAddedPortion,
                  });

                  if (isAmpTethered) {
                    sound.playAmpHitTick(isCrit);
                    if (isCrit) addResonance(b.resonancePerAction * 0.55);
                    ultCharge = Math.min(100, ultCharge + (isCrit ? 2.6 : 1.2) * b.ultChargeMultiplier);
                    if (isCrit || Math.random() < 0.35) {
                      spawnFloatingPopup(
                        en.x + (Math.random() - 0.5) * 0.6,
                        2.1,
                        en.z,
                        isCrit ? `⚡ ${finalHit.toLocaleString()}!` : `${finalHit.toLocaleString()}`,
                        isCrit ? '#e879f9' : '#38bdf8',
                        isCrit && finalHit > 600
                      );
                    }
                  }
                },
              });

              // Seraphic Pentad (5+ Active Auras): Ranged Heroes fire a Chained Secondary Astral Bolt!
              if ((b.chorusTier >= 2 || hb.extraChain > 0) && ally.role !== 'Tank' && enemies.length > 1) {
                const chainTarget = enemies.find(
                  (e) => e.id !== targetEnemy!.id && Math.hypot(e.x - targetEnemy!.x, e.z - targetEnemy!.z) <= 8.5
                );
                if (chainTarget) {
                  const chainMesh = new THREE.Mesh(
                    new THREE.SphereGeometry(0.14, 8, 8),
                    new THREE.MeshBasicMaterial({ color: '#fde047' })
                  );
                  const cStart = new THREE.Vector3(ally.x, 1.35, ally.z);
                  const cEnd = new THREE.Vector3(chainTarget.x, 1.0, chainTarget.z);
                  chainMesh.position.copy(cStart);
                  scene.add(chainMesh);
                  const cId = chainTarget.id;
                  const chainDmg = Math.round(finalHit * 0.58);
                  projectiles.push({
                    start: cStart,
                    end: cEnd,
                    t: 0,
                    speed: 6.5,
                    mesh: chainMesh,
                    onArrive: () => {
                      const ce = enemies.find((e) => e.id === cId);
                      if (!ce) return;
                      ce.hp -= chainDmg;
                      totalAttributedDamage += chainDmg;
                      ally.damageWindow.push({ time: elapsedTotal, total: chainDmg, attributed: chainDmg });
                    },
                  });
                }
              }
            }
          }

          // Update rolling 2.5s DPS window for smooth UI meters
          ally.damageWindow = ally.damageWindow.filter((w) => elapsedTotal - w.time <= 2.5);
          const sumTotal = ally.damageWindow.reduce((s, w) => s + w.total, 0);
          const sumAttr = ally.damageWindow.reduce((s, w) => s + w.attributed, 0);
          ally.recentDps = Math.round(sumTotal / 2.5);
          ally.recentSupportAttributedDps = Math.round(sumAttr / 2.5);
        }

        // --- 5. ENEMY AI, BOSS TELEGRAPHS & DEATH / LOOT ---
        const ailmentModBonus = waystoneRef.current.modifiers.reduce(
          (s, m) => s + (m.ailmentChanceBonus ?? 0),
          0
        );

        for (let i = enemies.length - 1; i >= 0; i--) {
          const en = enemies[i];

          // Check Death!
          if (en.hp <= 0) {
            scene.remove(en.mesh);
            if (en.drainBeam) scene.remove(en.drainBeam);
            if (en.archetype === 'warden') {
              wardsSlain += 1;
              gainAetherCharge(1);
              addResonance(buildRef.current.resonancePerAction * 1.5);
              spawnShockwave(en.x, en.z, '#c084fc', 7.5, 0.6);
              spawnFloatingPopup(en.x, 2.8, en.z, '✦ AURA FIELD RESTORED! ✦', '#d8b4fe', true);
            }
            enemies.splice(i, 1);

            const ws = waystoneRef.current;
            const xpMult = 1 + ws.totalXpBonusPct / 100;
            const baseXp = en.tier === 'boss' ? 420 : en.tier === 'elite' ? 95 : 26;
            callbacksRef.current.onGainXp(Math.round(baseXp * xpMult * (1 + (ws.tier - 1) * 0.25)));

            spawnLootDrop(en.x, en.z, en.tier);

            if (en.tier === 'boss') {
              bossActive = false;
              waveKillsScore = 0;
              // Shower extra Boss Loot + guaranteed Vaal Tear & Astral Shards.
              // BALANCE: 52 Astral Shards are needed to unlock every aura/rune/sigil,
              // so bosses pay out reliably instead of drip-feeding 1-3 per kill.
              spawnLootDrop(en.x + 1.2, en.z, 'boss');
              spawnLootDrop(en.x - 1.2, en.z + 0.8, 'elite');
              spawnLootDrop(en.x, en.z - 1.4, 'elite', 'vaalTears');
              spawnLootDrop(en.x + 1.6, en.z - 1.0, 'elite', 'astraloes');
              spawnLootDrop(en.x - 1.6, en.z - 1.0, 'elite', 'astraloes');
              bossTiersCleared.add(ws.tier);
              spawnFloatingPopup(en.x, 3.0, en.z, '★ SANCTUM BOSS VANQUISHED! ★', '#fde047', true);
              callbacksRef.current.onBossDefeated(ws.tier);
            } else if (!bossActive) {
              waveKillsScore = Math.min(100, waveKillsScore + (en.tier === 'elite' ? 24 : 9));
              if (waveKillsScore >= 100) {
                spawnEnemy('boss');
              }
            }
            continue;
          }

          // Malediction Halo Slow & Indicator
          const inMalediction =
            b.allyBuffs.enemyDamageTakenMultiplier > 1.01 &&
            Math.hypot(en.x - playerGroup.position.x, en.z - playerGroup.position.z) <= activeAuraRad;
          en.hexRing.visible = inMalediction;

          // Temporal Rift Ascendancy: Consecrated Sigils slow every monster standing inside
          const inRiftSigil =
            b.ascNodes.has('chr_rift') &&
            sigils.some((s) => Math.hypot(en.x - s.x, en.z - s.z) <= s.radius);
          const slowMult =
            (inMalediction ? 1 - b.allyBuffs.enemySlowPct / 100 : 1.0) * (inRiftSigil ? 0.55 : 1.0);

          // Spin the Warden's Aura-Collapse field for readability
          if (en.suppressField) {
            en.suppressField.rotation.z += dt * 0.8;
          }

          // Target nearest living Ally (Tank Kael has higher threat weight; Bulwark Protocol hard-taunts!)
          let bestTarget: AllyInternal | null = null;
          let bestScore = Infinity;
          for (const ally of allies) {
            if (!ally.alive) continue;
            const dAlly = Math.hypot(ally.x - en.x, ally.z - en.z);
            const tauntWeight = b.heroBonuses[ally.id].taunt ? 0.18 : ally.role === 'Tank' ? 0.52 : 1;
            const threatScore = dAlly * tauntWeight;
            if (threatScore < bestScore) {
              bestScore = threatScore;
              bestTarget = ally;
            }
          }

          if (bestTarget) {
            const dx = bestTarget.x - en.x;
            const dz = bestTarget.z - en.z;
            const dist = Math.max(0.01, Math.hypot(dx, dz));
            en.mesh.rotation.y = Math.atan2(dx, dz);

            if (dist > en.range) {
              en.x += (dx / dist) * en.speed * slowMult * dt;
              en.z += (dz / dist) * en.speed * slowMult * dt;
              en.mesh.position.set(en.x, 0, en.z);
            } else {
              en.attackCd -= dt * slowMult;
              if (en.attackCd <= 0) {
                en.attackCd = en.tier === 'boss' ? 1.35 : 1.55;
                const inflicts: AilmentType | null =
                  en.archetype === 'soulbinder'
                    ? 'void_rot'
                    : Math.random() < 0.18 + ailmentModBonus
                    ? 'bleed'
                    : null;
                applyDamageToAlly(bestTarget, en.dmg, inflicts);
              }
            }

            // Soulbinder Acolytes keep a visible siphon tether on their victim — break it with [E] Cleanse!
            if (en.drainBeam) {
              const from = new THREE.Vector3(en.x, 1.1, en.z);
              const to = new THREE.Vector3(bestTarget.x, 1.1, bestTarget.z);
              const span = from.distanceTo(to);
              if (span <= 11 && bestTarget.alive) {
                en.drainBeam.visible = true;
                en.drainBeam.position.copy(from.clone().lerp(to, 0.5));
                en.drainBeam.scale.set(1, span, 1);
                en.drainBeam.quaternion.setFromUnitVectors(
                  new THREE.Vector3(0, 1, 0),
                  to.clone().sub(from).normalize()
                );
                if (bestTarget.invulnerableTimer <= 0) {
                  bestTarget.hp -= en.dmg * 0.22 * dt;
                }
              } else {
                en.drainBeam.visible = false;
              }
            }

            // Boss & Elite Ground Slam / Void Nova Telegraphs!
            if (en.tier === 'boss' || en.tier === 'elite') {
              en.specialCd -= dt;
              if (en.specialCd <= 0) {
                en.specialCd = en.tier === 'boss' ? 4.4 : 7.0;
                const targetVictim =
                  Math.random() < 0.35
                    ? { x: playerGroup.position.x, z: playerGroup.position.z }
                    : { x: bestTarget.x, z: bestTarget.z };
                createTelegraph(
                  targetVictim.x,
                  targetVictim.z,
                  en.tier === 'boss' ? 5.2 : 3.6,
                  Math.round(en.dmg * (en.tier === 'boss' ? 2.3 : 1.7)),
                  en.tier === 'boss' ? 'void_rot' : 'bleed'
                );
              }
            }
          }
        }

        // Helper for applying mitigated damage + Martyr's Aegis Keystone redirection!
        function applyDamageToAlly(ally: AllyInternal, rawDamage: number, ailment: AilmentType | null) {
          if (!ally.alive) return;
          if (ally.invulnerableTimer > 0) {
            spawnFloatingPopup(ally.x, 2.2, ally.z, 'IMMUNE!', '#fef08a');
            return;
          }

          const talentDr = b.heroBonuses[ally.id].damageReductionPct;
          let dmg =
            rawDamage *
            (1 - Math.min(85, (ally.inAura ? b.allyBuffs.damageReductionPct : 0) + talentDr) / 100);

          // Martyr's Aegis / Aegis Transfusion: redirect ally hit damage into your Energy Ward at 50% value!
          if (ally.inAura && b.allyDamageRedirectPct > 0 && playerWard > 5) {
            const redirected = dmg * (b.allyDamageRedirectPct / 100);
            dmg -= redirected;
            const wardCost = redirected * 0.5;
            playerWard = Math.max(0, playerWard - wardCost);
            wardDamageDelay = 1.1;
            ultCharge = Math.min(100, ultCharge + 2.2 * b.ultChargeMultiplier);
          }

          // Overshield absorbs first!
          if (ally.overshield > 0) {
            const absorbed = Math.min(ally.overshield, dmg);
            ally.overshield -= absorbed;
            dmg -= absorbed;
          }

          ally.hp = Math.max(0, ally.hp - dmg);

          if (ailment && ally.ailments.length < 3) {
            const existing = ally.ailments.find((a) => a.type === ailment);
            if (existing) {
              existing.stacks = Math.min(3, existing.stacks + 1);
              existing.duration = 4.5;
            } else {
              ally.ailments.push({ type: ailment, duration: 4.5, stacks: 1 });
            }
          }
        }

        // --- 6. UPDATE TELEGRAPH DETONATIONS ---
        for (let i = telegraphs.length - 1; i >= 0; i--) {
          const tel = telegraphs[i];
          tel.elapsed += dt;
          const progress = Math.min(1, tel.elapsed / tel.duration);
          tel.fillMesh.scale.setScalar(Math.max(0.05, progress));

          if (tel.elapsed >= tel.duration) {
            scene.remove(tel.outerMesh);
            scene.remove(tel.fillMesh);
            telegraphs.splice(i, 1);

            spawnShockwave(tel.x, tel.z, '#f43f5e', tel.radius, 0.35);

            // Hit Allies inside circle
            for (const ally of allies) {
              if (ally.alive && Math.hypot(ally.x - tel.x, ally.z - tel.z) <= tel.radius) {
                applyDamageToAlly(ally, tel.damage, tel.ailment);
              }
            }

            // Hit Player if Player didn't Dash out!
            if (
              dashTimer <= 0 &&
              Math.hypot(playerGroup.position.x - tel.x, playerGroup.position.z - tel.z) <= tel.radius
            ) {
              const pDmg = tel.damage * 0.55;
              const voidProtected =
                b.keystones.has('prism_covenant') || b.uniques.has('shavronnes_robe');
              if (playerWard > 0 && (voidProtected || tel.ailment !== 'void_rot')) {
                const abs = Math.min(playerWard, pDmg);
                playerWard -= abs;
                playerLife -= Math.max(0, pDmg - abs);
              } else {
                // Void bypasses half of Ward unless Shavronne's / Prism Covenant!
                playerWard = Math.max(0, playerWard - pDmg * 0.5);
                playerLife -= pDmg * 0.5;
              }
              wardDamageDelay = 1.6;
              if (playerLife <= 0) {
                // Sanctum Grace Respawn penalty: reset ult charge slightly & respawn at center
                playerLife = b.unreservedLifeMax * 0.75;
                playerWard = b.maxWard * 0.75;
                ultCharge = Math.max(0, ultCharge - 20);
                spawnFloatingPopup(
                  playerGroup.position.x,
                  2.5,
                  playerGroup.position.z,
                  'SANCTUM AEGIS TRIGGERED!',
                  '#f43f5e',
                  true
                );
              }
            }
          }
        }

        // --- 7. UPDATE PROJECTILES & SHOCKWAVES ---
        for (let i = projectiles.length - 1; i >= 0; i--) {
          const p = projectiles[i];
          p.t += dt * p.speed;
          if (p.t >= 1) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            projectiles.splice(i, 1);
            p.onArrive?.();
          } else {
            p.mesh.position.lerpVectors(p.start, p.end, p.t);
            p.mesh.position.y += Math.sin(p.t * Math.PI) * 1.1;
          }
        }

        for (let i = transientEffects.length - 1; i >= 0; i--) {
          const ef = transientEffects[i];
          ef.age += dt;
          const r = ef.age / ef.maxAge;
          if (r >= 1) {
            scene.remove(ef.mesh);
            ef.mesh.geometry.dispose();
            transientEffects.splice(i, 1);
          } else {
            ef.mesh.scale.setScalar(0.3 + r * ef.maxScale);
            (ef.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - r) * 0.85;
          }
        }

        // --- 8. CONTINUOUS MONSTER WAVE SPAWNING ---
        spawnWaveTimer += dt;
        const packDensityMult =
          1 +
          waystoneRef.current.modifiers.reduce((s, m) => s + (m.extraPackSizePct ?? 0), 0) / 100;
        const maxConcurrent = Math.round((bossActive ? 7 : 10) * packDensityMult);
        if (spawnWaveTimer >= 2.1 && enemies.length < maxConcurrent) {
          spawnWaveTimer = 0;
          const count = Math.random() < 0.5 ? 2 : 1;
          for (let c = 0; c < count; c++) {
            spawnEnemy(Math.random() < 0.2 ? 'elite' : 'normal');
          }
        }
      }

      // Smooth Damped Tactical Camera Tracking Player
      outerCrystals.forEach((c, idx) => {
        c.rotation.y += dt * 1.1;
        c.position.y = 4.2 + Math.sin(elapsedTotal * 2 + idx) * 0.22;
      });

      const desiredCamX = playerGroup.position.x * 0.65;
      const desiredCamZ = playerGroup.position.z * 0.65 + cameraZoom * 0.78;
      const desiredCamY = cameraZoom * 0.88;
      camera.position.x += (desiredCamX - camera.position.x) * Math.min(1, dt * 6);
      camera.position.y += (desiredCamY - camera.position.y) * Math.min(1, dt * 6);
      camera.position.z += (desiredCamZ - camera.position.z) * Math.min(1, dt * 6);
      camera.lookAt(playerGroup.position.x * 0.55, 0.8, playerGroup.position.z * 0.55 - 1.2);

      renderer.render(scene, camera);

      // --- 9. THROTTLED HUD & 2D PROJECTION SYNC (~12Hz) ---
      hudSyncTimer += dt;
      if (hudSyncTimer >= 0.085) {
        hudSyncTimer = 0;

        // Flush accumulated Hero Bond Affinity XP
        if (bondXpAccum.kael + bondXpAccum.lyra + bondXpAccum.vexis >= 1) {
          callbacksRef.current.onBondXp({
            kael: Math.round(bondXpAccum.kael),
            lyra: Math.round(bondXpAccum.lyra),
            vexis: Math.round(bondXpAccum.vexis),
          });
          bondXpAccum.kael = 0;
          bondXpAccum.lyra = 0;
          bondXpAccum.vexis = 0;
        }

        const w = container!.clientWidth;
        const h = container!.clientHeight;

        // Project Loot Labels
        const nextLootTags = lootVisuals.slice(-10).map((lv) => {
          const v = new THREE.Vector3(lv.drop.x, 1.35, lv.drop.z).project(camera);
          return {
            id: lv.drop.id,
            x: (v.x * 0.5 + 0.5) * w,
            y: (-v.y * 0.5 + 0.5) * h,
            visible: v.z < 1,
            drop: lv.drop,
          };
        });
        setLootScreenTags(nextLootTags);

        // Project Ally World Nameplates
        const nextAllyTags = allies.map((ally) => {
          const v = new THREE.Vector3(ally.x, 2.55, ally.z).project(camera);
          return {
            id: ally.id,
            x: (v.x * 0.5 + 0.5) * w,
            y: (-v.y * 0.5 + 0.5) * h,
            visible: v.z < 1,
            ally: { ...ally, ailments: [...ally.ailments] },
          };
        });
        setAllyScreenTags(nextAllyTags);

        const activeBoss = enemies.find((e) => e.tier === 'boss');
        const partyTotalDps = allies.reduce((s, a) => s + a.recentDps, 0);
        const supportAttributedDps = allies.reduce((s, a) => s + a.recentSupportAttributedDps, 0);

        callbacksRef.current.onHudUpdate(
          {
            life: Math.round(playerLife),
            maxUnreservedLife: b.unreservedLifeMax,
            maxTotalLife: b.maxLife,
            reservedLifePct: b.reservedLifePct,
            ward: Math.round(playerWard),
            maxWard: b.maxWard,
            spirit: Math.round(playerSpirit),
            maxUnreservedSpirit: b.unreservedSpiritMax,
            maxTotalSpirit: b.maxSpirit,
            reservedSpiritPct: b.reservedSpiritPct,
            beamMode,
            tetheredAllyId,
            dashCdRemaining: Number(dashCd.toFixed(1)),
            cleanseCdRemaining: Number(cleanseCd.toFixed(1)),
            sigilCdRemaining: Number(sigilCd.toFixed(1)),
            ultCharge: Math.floor(ultCharge),
            ultActiveRemaining: Number(ultActiveRemaining.toFixed(1)),
            aetherCharges,
            chargeCap: b.chargeCap,
            resonance: Math.round(resonance),
            resonanceMax: b.resonanceMax,
            cascadeCdRemaining: Number(cascadeCd.toFixed(1)),
            cascadeActiveRemaining: Number(cascadeActiveRemaining.toFixed(1)),
            cascadeStacks,
            decreeName: decree?.name,
            decreeDesc: decree?.desc,
            decreeProgress: decree ? Math.min(100, Math.round(decree.progress)) : undefined,
            decreeTimeLeft: decree ? Math.max(0, Number(decree.timeLeft.toFixed(1))) : undefined,
            markedAllyId,
          },
          allies.map((a) => ({
            id: a.id,
            name: a.name,
            title: a.title,
            role: a.role,
            color: a.color,
            hp: Math.round(a.hp),
            maxHp: a.maxHp,
            overshield: Math.round(a.overshield),
            maxOvershield: a.maxOvershield,
            x: a.x,
            z: a.z,
            vx: a.vx,
            vz: a.vz,
            facing: a.facing,
            baseDps: a.baseDps,
            attackRange: a.attackRange,
            attackCooldown: a.attackCooldown,
            inAura: a.inAura,
            inSigil: a.inSigil,
            isTetheredPrimary: a.isTetheredPrimary,
            isTetheredSecondary: a.isTetheredSecondary,
            invulnerableTimer: a.invulnerableTimer,
            ailments: [...a.ailments],
            recentDps: a.recentDps,
            recentSupportAttributedDps: a.recentSupportAttributedDps,
            alive: a.alive,
            reviveProgress: a.reviveProgress,
          })),
          {
            totalHealingDone: Math.round(totalHealingDone),
            totalOvershieldGranted: Math.round(totalOvershieldGranted),
            totalAttributedDamage: Math.round(totalAttributedDamage),
            clutchSaves,
            ailmentsCleansed,
            partyTotalDps,
            supportAttributedDps,
            waveProgress: Math.min(100, waveKillsScore),
            suppressionActive,
            aetherCharges,
            chargeCap: b.chargeCap,
            resonance: Math.round(resonance),
            cascadeCdRemaining: Number(cascadeCd.toFixed(1)),
            decreesAnswered,
            cascadeCount,
            wardsSlain,
            resonancesPeaked,
            bossDecree: decree
              ? {
                  key: decree.key,
                  name: decree.name,
                  desc: decree.desc,
                  timeLeft: decree.timeLeft,
                  duration: decree.duration,
                  progress: Math.min(100, decree.progress),
                }
              : null,
            bossActive: Boolean(activeBoss),
            bossName: activeBoss?.name,
            bossHp: activeBoss ? Math.max(0, Math.round(activeBoss.hp)) : undefined,
            bossMaxHp: activeBoss?.maxHp,
            bossAffixes: activeBoss?.affixes,
          },
          lootVisuals.length
        );
      }
    }

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      rendererRef.current = null;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden cursor-crosshair">
      {/* 3D-Projected Ally Floating Micro-Plates */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {allyScreenTags.map(
          (tag) =>
            tag.visible && (
              <div
                key={tag.id}
                style={{ left: tag.x, top: tag.y }}
                className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center gap-0.5 transition-transform duration-75"
              >
                {tag.ally.ailments.length > 0 && (
                  <div className="px-1.5 py-0.5 rounded bg-rose-600/95 text-[10px] font-bold tracking-wider text-white animate-bounce shadow-lg">
                    CLEANSE [E]! ({tag.ally.ailments.map((a) => a.type.replace('_', ' ').toUpperCase()).join(' + ')})
                  </div>
                )}
                {tag.ally.invulnerableTimer > 0 && (
                  <div className="px-1.5 py-0.5 rounded bg-amber-300 text-slate-950 text-[10px] font-extrabold tracking-wider shadow">
                    IMMUNE ★
                  </div>
                )}
                <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-700/80 px-2 py-0.5 rounded-full shadow">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: tag.ally.inAura ? '#fbbf24' : '#475569' }}
                  />
                  <span className="text-[11px] font-semibold text-slate-100">{tag.ally.name.split(' ')[0]}</span>
                </div>
                <div className="w-20 h-2 bg-slate-900/95 rounded-full overflow-hidden border border-slate-700/90 relative">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-100"
                    style={{ width: `${Math.max(0, (tag.ally.hp / tag.ally.maxHp) * 100)}%` }}
                  />
                  {tag.ally.overshield > 0 && (
                    <div
                      className="absolute top-0 right-0 h-full bg-cyan-300/85"
                      style={{
                        width: `${Math.min(100, (tag.ally.overshield / tag.ally.maxHp) * 100)}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            )
        )}
      </div>

      {/* PoE-Style Clickable Loot Filter Plates */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {lootScreenTags.map((lt) => {
          if (!lt.visible) return null;
          const styles = {
            magic: 'bg-slate-950/85 border-blue-400 text-blue-300',
            rare: 'bg-slate-950/90 border-amber-400 text-amber-300',
            unique: 'bg-amber-950/95 border-orange-500 text-orange-300 ring-1 ring-orange-400/60 scale-105',
            currency: 'bg-teal-950/95 border-teal-300 text-teal-200 ring-1 ring-teal-300/60 scale-105',
          }[lt.drop.rarityColor];

          return (
            <button
              key={lt.id}
              onClick={() => collectSingleLootRef.current(lt.id)}
              style={{ left: lt.x, top: lt.y }}
              className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-0.5 rounded border text-[11px] font-bold tracking-wide shadow-xl hover:brightness-125 transition ${styles}`}
            >
              {lt.drop.label}
            </button>
          );
        })}
      </div>

      {/* Floating Heal, Damage Amp & Clutch Save Popups */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {popups.map((p) => (
          <div
            key={p.id}
            style={{ left: p.x, top: p.y, color: p.color }}
            className={`absolute font-mono-num font-extrabold drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] animate-float-up whitespace-nowrap ${
              p.big ? 'text-base tracking-wider' : 'text-xs'
            }`}
          >
            {p.text}
          </div>
        ))}
      </div>
    </div>
  );
};
