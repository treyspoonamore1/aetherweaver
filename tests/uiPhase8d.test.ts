/**
 * Phase 8d (docs/phase-8.md, 8d): portraits in the Codex.
 *
 * The framing every figure gets (a Leech and the Bellwarden both fill their frame), the
 * light each is drawn in, what a picture depends on (the Weaver's robe; her hands under a colour
 * vision), the cache's rules (what is on screen first, one studio closed when the pictures are
 * drawn, nothing beside a fight, nothing after a lost context) with a stand-in for the studio, and
 * the Codex without WebGL: exactly as it was (the unit tests' own environment).
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLOR_VISIONS } from '../src/app/colorVision';
import { CONTENT, arenaDef } from '../src/content';
import { arenaLook } from '../src/render/crimsonCues';
import { OWN_PALETTE, OWN_RIM } from '../src/render/keepsakeCues';
import { HERO_DRAWN } from '../src/render/models/artFlag';
import { buildEnemy, buildHero, buildWeaver } from '../src/render/models/library';
import type * as Portraits from '../src/render/portrait';
import {
  PORTRAIT_VIEW,
  framePortrait,
  portraitArena,
  portraitMovement,
  type PortraitSubject,
} from '../src/render/portrait';
import {
  PORTRAIT_PX,
  cancelPortraits,
  portraitKey,
  portraitState,
  portraitStats,
  portraitsPossible,
  requestPortraits,
  resetPortraits,
  showPortrait,
  weaverSubject,
} from '../src/ui/kit/portraitStore';

/** A .tsx module's export, at run time (the node test build has no JSX to import statically). */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

type CodexProps = {
  onBack(): void;
  initialTab: string;
  roster?: readonly string[];
  seen?: readonly string[];
  look?: { robe: string | null; thread: string | null };
};
const codex = () => component<CodexProps>('../src/ui/screens/CodexScreen', 'CodexView');
const EVERYONE = CONTENT.heroes.map((h) => h.id);
const hero = (id: string): PortraitSubject => ({ kind: 'hero', id });
const enemy = (id: string): PortraitSubject => ({ kind: 'enemy', id });

// ── A stand-in for the studio: the cache's rules without WebGL ────────────────────────────

const studio = {
  /** null: WebGL is refused. */
  refuse: false,
  /** The draw (1-based) at which the context is lost (0: never). */
  loseAt: 0,
  opened: 0,
  disposed: 0,
  drawn: [] as string[],
  /** Called before each draw (a test's hook into the middle of the work). */
  before: null as null | ((n: number) => void),
};

vi.mock('../src/render/portrait', async (original) => ({
  ...(await original<typeof Portraits>()),
  openPortraitStudio: (size: number) => {
    if (studio.refuse) return null;
    studio.opened++;
    return {
      size,
      lastCalls: 1,
      lastTriangles: 100,
      draw(subject: PortraitSubject) {
        const n = studio.drawn.length + 1;
        studio.before?.(n);
        if (studio.loseAt === n) return null;
        studio.drawn.push(subject.id);
        return `data:image/png;base64,${subject.id}`;
      },
      dispose() {
        studio.disposed++;
      },
    };
  },
}));

const page = { fight: false };

/** A browser's worth of globals: a document (with or without a fight's canvas) and WebGL 2. */
function browser(): void {
  vi.stubGlobal('document', {
    querySelector: (q: string) => (q.includes('game-canvas') && page.fight ? {} : null),
  });
  vi.stubGlobal('WebGL2RenderingContext', class {});
}

/** Each reading of the clock moves it 5 ms on: every picture then takes a turn of its own. */
function slowClock(): void {
  let t = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => (t += 5));
}

async function settled(): Promise<void> {
  for (let i = 0; i < 200 && (portraitStats().open || i < 3); i++)
    await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  resetPortraits();
  Object.assign(studio, { refuse: false, loseAt: 0, opened: 0, disposed: 0, before: null });
  studio.drawn = [];
  page.fight = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Framing ───────────────────────────────────────────────────────────────────────────────

describe('every figure fills its frame, whatever its size', () => {
  const fill = 1 - 2 * PORTRAIT_VIEW.margin;
  const figures: [string, () => ArrayLike<number>, number][] = [
    ...CONTENT.heroes.map((h): [string, () => ArrayLike<number>, number] => [
      h.id,
      () => buildHero(h).getAttribute('position').array,
      HERO_DRAWN,
    ]),
    ['weaver', () => buildWeaver(OWN_PALETTE).getAttribute('position').array, HERO_DRAWN],
    ...CONTENT.enemies.map((e): [string, () => ArrayLike<number>, number] => [
      e.id,
      () => buildEnemy(e).getAttribute('position').array,
      1,
    ]),
  ];

  it('covers every hero, the Weaver and every enemy', () => {
    expect(figures.length).toBe(CONTENT.heroes.length + 1 + CONTENT.enemies.length);
    expect(figures.length).toBeGreaterThanOrEqual(37);
  });

  it('the longer side of each spans the frame but for the margin; none is cropped', () => {
    for (const [id, positions, scale] of figures) {
      const f = framePortrait(positions(), scale);
      expect(Math.max(f.fillU, f.fillV), id).toBeCloseTo(fill, 6);
      expect(Math.min(f.fillU, f.fillV), id).toBeGreaterThan(0.2);
      expect(f.half, id).toBeGreaterThan(0);
      expect(f.near, id).toBeGreaterThan(f.far);
    }
  });

  it('a Leech and the Bellwarden fill the same share of very different frames', () => {
    const at = (id: string) => {
      const [, positions, scale] = figures.find((f) => f[0] === id)!;
      return framePortrait(positions(), scale);
    };
    const leech = at('leech');
    const bell = at('the_bellwarden');
    expect(Math.max(leech.fillU, leech.fillV)).toBeCloseTo(Math.max(bell.fillU, bell.fillV), 6);
    // The frame itself is the figure's size: the bell's is several times the leech's.
    expect(bell.half / leech.half).toBeGreaterThan(2);
  });

  it('frames a known box exactly, and an empty model harmlessly', () => {
    // A 2 m wide, 1 m tall, flat card facing the camera, seen level and unturned.
    const card = [-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0];
    const f = framePortrait(card, 1, 0, 0, 0.1);
    expect(f.u).toBeCloseTo(0, 9);
    expect(f.v).toBeCloseTo(0.5, 9);
    expect(f.half).toBeCloseTo(1.25, 9);
    expect(f.fillU).toBeCloseTo(0.8, 9);
    expect(f.fillV).toBeCloseTo(0.4, 9);
    // Drawn 1.12×, the frame grows with it.
    expect(framePortrait(card, 1.12, 0, 0, 0.1).half).toBeCloseTo(1.4, 9);
    expect(framePortrait([]).fillU).toBe(0);
  });
});

describe('each figure stands in its own world’s light', () => {
  it('a hero and the Weaver in Movement I’s; an enemy in its Movement’s', () => {
    expect(portraitMovement(hero('kael'))).toBe(1);
    expect(portraitMovement({ kind: 'weaver', id: 'weaver' })).toBe(1);
    for (const e of CONTENT.enemies) expect(portraitMovement(enemy(e.id))).toBe(e.movement ?? 1);
  });

  it('Movement I is the Reliquary’s warm light; the three dark worlds are their own', () => {
    expect(portraitArena(1)).toBe('reliquary_hall');
    expect(arenaLook(arenaDef(portraitArena(1)))).toBe('warm');
    expect(arenaLook(arenaDef(portraitArena(2)))).toBe('crimson');
    expect(arenaLook(arenaDef(portraitArena(3)))).toBe('abyss');
    expect(arenaLook(arenaDef(portraitArena(4)))).toBe('crucible');
    // Every Movement an enemy belongs to has an arena to be lit by.
    for (const e of CONTENT.enemies)
      expect(() => arenaDef(portraitArena(e.movement ?? 1))).not.toThrow();
  });
});

// ── What a picture depends on ─────────────────────────────────────────────────────────────

describe('a picture is kept by what it shows', () => {
  it('a hero’s and an enemy’s by id alone', () => {
    expect(portraitKey(hero('kael'))).toBe('hero|kael');
    expect(portraitKey(enemy('leech'))).toBe('enemy|leech');
  });

  it('the Weaver’s by her robe: each robe is another picture, with its own resting rim', () => {
    const own = weaverSubject();
    expect(own.palette).toEqual(OWN_PALETTE);
    expect(own.rim).toEqual(OWN_RIM);
    const keys = new Set([portraitKey(own)]);
    for (const robe of CONTENT.cosmetics.robes) {
      const worn = weaverSubject({ robe: robe.id, thread: null });
      expect(worn.palette!.body, robe.id).toBe(robe.colors.body);
      expect(worn.rim!.hex, robe.id).toBe(robe.colors.trim);
      keys.add(portraitKey(worn));
    }
    expect(keys.size).toBe(CONTENT.cosmetics.robes.length + 1);
  });

  it('colour vision changes her exactly as it does in a fight: her hands, in a Thread look', () => {
    // Her own robe and Thread: the same picture under every colour vision (as the figures are).
    const plain = new Set(COLOR_VISIONS.map((v) => portraitKey(weaverSubject(undefined, v))));
    expect(plain.size).toBe(1);
    // A Thread look is fitted to the colour vision (app/threadLook.ts): her hands follow it.
    let moved = 0;
    for (const t of CONTENT.cosmetics.threads) {
      const look = { robe: null, thread: t.id };
      const normal = weaverSubject(look, 'normal');
      expect(normal.palette!.hand, t.id).not.toBe(OWN_PALETTE.hand);
      for (const v of COLOR_VISIONS) {
        const seen = weaverSubject(look, v);
        // Only her hands: the robe is the robe.
        expect({ ...seen.palette, hand: '' }).toEqual({ ...normal.palette, hand: '' });
        if (portraitKey(seen) !== portraitKey(normal)) moved++;
      }
    }
    expect(moved).toBeGreaterThan(0);
  });
});

// ── Without WebGL: exactly as before ──────────────────────────────────────────────────────

describe('without WebGL the Codex shows what it showed before portraits', () => {
  it('nothing can be drawn here, and nothing is asked for', async () => {
    expect(typeof document).toBe('undefined');
    expect(portraitsPossible()).toBe(false);
    // The real studio (this file's stand-in aside): no document, so none opens.
    const real = await vi.importActual<typeof Portraits>('../src/render/portrait');
    expect(real.openPortraitStudio(PORTRAIT_PX)).toBeNull();
    requestPortraits([hero('kael')]);
    showPortrait(hero('lyra'))();
    await settled();
    expect(portraitState(hero('kael'))).toBe('none');
    expect(studio.opened).toBe(0);
    expect(portraitStats()).toMatchObject({ drawn: 0, held: 0, sessions: 0, open: false });
  });

  it('heroes keep their letter discs; enemies and the Weaver’s page have no picture', async () => {
    const CodexView = await codex();
    const page = (props: Omit<CodexProps, 'onBack'>) =>
      renderToStaticMarkup(createElement(CodexView, { onBack: () => {}, ...props }));
    const heroes = page({ initialTab: 'heroes', roster: EVERYONE });
    expect(heroes).not.toContain('data-testid="portrait"');
    expect(heroes).not.toContain('<img');
    for (const h of CONTENT.heroes)
      expect(heroes, h.id).toContain(
        `<span class="flex shrink-0 items-center justify-center rounded-full font-display font-bold text-ink-950" style="width:46px;height:46px;background:${h.color};font-size:20.7px" aria-hidden="true">${h.name.slice(0, 1)}</span>`,
      );
    const enemies = page({ initialTab: 'enemies' });
    expect(enemies).not.toContain('data-testid="portrait"');
    expect(enemies).not.toContain('<img');
    const weaver = page({ initialTab: 'weaver', look: { robe: 'robe_dusk', thread: null } });
    expect(weaver).not.toContain('codex-weaver-card');
    expect(weaver).not.toContain('data-testid="portrait"');
  });
});

// ── The cache's rules ─────────────────────────────────────────────────────────────────────

describe('the portraits’ cache', () => {
  it('draws what is on screen first, then the rest, in one studio that is then closed', async () => {
    browser();
    slowClock();
    requestPortraits([enemy('leech'), enemy('mute'), hero('kael')]);
    showPortrait(hero('kael'));
    showPortrait(enemy('the_bellwarden'));
    expect(portraitState(hero('kael'))).toBe('pending');
    await settled();
    expect(studio.drawn).toEqual(['kael', 'the_bellwarden', 'leech', 'mute']);
    expect(studio.opened).toBe(1);
    expect(studio.disposed).toBe(1);
    expect(portraitState(hero('kael'))).toEqual({ src: 'data:image/png;base64,kael' });
    const stats = portraitStats();
    expect(stats).toMatchObject({ drawn: 4, held: 4, sessions: 1, open: false });
    expect(stats.bytes).toBe(
      ['kael', 'the_bellwarden', 'leech', 'mute'].reduce(
        (n, id) => n + `data:image/png;base64,${id}`.length,
        0,
      ),
    );
  });

  it('a picture held is never drawn again, and asks for no studio', async () => {
    browser();
    showPortrait(hero('kael'));
    await settled();
    requestPortraits([hero('kael')]);
    showPortrait(hero('kael'));
    await settled();
    expect(studio.drawn).toEqual(['kael']);
    expect(studio.opened).toBe(1);
    expect(studio.disposed).toBe(1);
  });

  it('closing the screen drops what it asked for later; the studio closes', async () => {
    browser();
    slowClock();
    studio.before = (n) => {
      if (n === 2) cancelPortraits();
    };
    requestPortraits([enemy('leech'), enemy('mute'), enemy('shears'), enemy('spindle')]);
    await settled();
    // The picture in hand is finished; the rest are let go.
    expect(studio.drawn).toEqual(['leech', 'mute']);
    expect(studio.disposed).toBe(1);
    expect(portraitStats().open).toBe(false);
  });

  it('a frame gone before its picture is drawn no longer asks for it', async () => {
    browser();
    slowClock();
    const release = showPortrait(enemy('mute'));
    showPortrait(enemy('leech'));
    release();
    await settled();
    expect(studio.drawn).toEqual(['leech']);
  });

  it('never beside a fight: nothing is asked for, opened or drawn', async () => {
    browser();
    page.fight = true;
    requestPortraits([hero('kael'), enemy('leech')]);
    showPortrait(hero('lyra'));
    await settled();
    expect(studio.opened).toBe(0);
    expect(studio.drawn).toEqual([]);
    // The screen shows what it showed before portraits.
    expect(portraitState(hero('lyra'))).toBe('none');
    // The fight over, the next screen that asks is served.
    page.fight = false;
    showPortrait(hero('lyra'));
    await settled();
    expect(studio.drawn).toEqual(['lyra']);
    expect(portraitState(hero('lyra'))).not.toBe('none');
  });

  it('a fight that opens mid-way stops the work and closes the studio', async () => {
    browser();
    slowClock();
    studio.before = (n) => {
      if (n === 2) page.fight = true;
    };
    requestPortraits([enemy('leech'), enemy('mute'), enemy('shears'), enemy('spindle')]);
    await settled();
    expect(studio.drawn).toEqual(['leech', 'mute']);
    expect(studio.disposed).toBe(1);
    expect(portraitStats().open).toBe(false);
    expect(portraitState(enemy('spindle'))).toBe('none');
    expect(portraitState(enemy('leech'))).toEqual({ src: 'data:image/png;base64,leech' });
  });

  it('a refused context: every portrait is `none`, and it is not tried again', async () => {
    browser();
    studio.refuse = true;
    showPortrait(hero('kael'));
    await settled();
    expect(portraitState(hero('kael'))).toBe('none');
    expect(portraitsPossible()).toBe(false);
    studio.refuse = false;
    showPortrait(hero('lyra'));
    await settled();
    expect(studio.opened).toBe(0);
  });

  it('a lost context: what is drawn is kept, the rest is `none`, the studio is closed', async () => {
    browser();
    slowClock();
    studio.loseAt = 2;
    requestPortraits([enemy('leech'), enemy('mute'), enemy('shears')]);
    await settled();
    expect(studio.drawn).toEqual(['leech']);
    expect(studio.disposed).toBe(1);
    expect(portraitState(enemy('leech'))).toEqual({ src: 'data:image/png;base64,leech' });
    expect(portraitState(enemy('mute'))).toBe('none');
    expect(portraitState(enemy('shears'))).toBe('none');
  });

  it('the Weaver’s pictures are bounded: the oldest robes are let go', async () => {
    browser();
    const looks: PortraitSubject[] = [];
    for (let i = 0; i < 20; i++)
      looks.push({
        kind: 'weaver',
        id: `w${i}`,
        palette: { ...OWN_PALETTE, body: `#0000${String(i).padStart(2, '0')}` },
        rim: OWN_RIM,
      });
    requestPortraits(looks);
    await settled();
    expect(studio.drawn.length).toBe(20);
    expect(portraitStats().held).toBe(16);
    expect(portraitState(looks[0]!)).toBe('pending');
    expect(portraitState(looks[19]!)).not.toBe('pending');
  });
});

// ── The Codex with portraits ──────────────────────────────────────────────────────────────

describe('the Codex with portraits', () => {
  it('each picture is in its frame with the entry’s name as its alt text', async () => {
    browser();
    const CodexView = await codex();
    const seen = ['hollow_chorister', 'the_bellwarden', 'leech'];
    requestPortraits([
      ...EVERYONE.map(hero),
      ...seen.map(enemy),
      weaverSubject({ robe: 'robe_dusk', thread: null }),
    ]);
    await settled();
    const page = (props: Omit<CodexProps, 'onBack'>) =>
      renderToStaticMarkup(createElement(CodexView, { onBack: () => {}, ...props }));

    const heroes = page({ initialTab: 'heroes', roster: EVERYONE });
    for (const h of CONTENT.heroes) {
      expect(heroes, h.id).toContain(`data-portrait="hero|${h.id}" data-ready="true"`);
      expect(heroes, h.id).toContain(
        `<img src="data:image/png;base64,${h.id}" alt="${h.name}" width="88" height="88"`,
      );
    }
    // The letter discs give way to the pictures.
    expect(heroes).not.toContain('font-size:20.7px');

    const enemies = page({ initialTab: 'enemies', seen });
    // A foe is 96 px, a boss or miniboss 128; an enemy not met stays a silhouette.
    expect(enemies).toContain(
      '<img src="data:image/png;base64,hollow_chorister" alt="Hollow Chorister" width="96" height="96"',
    );
    expect(enemies).toContain(
      '<img src="data:image/png;base64,the_bellwarden" alt="The Bellwarden" width="128" height="128"',
    );
    expect(enemies).toContain('alt="Leech"');
    expect(enemies.match(/data-testid="portrait"/g)!.length).toBe(seen.length);
    expect(enemies.match(/data-testid="codex-enemy-locked"/g)!.length).toBe(
      CONTENT.enemies.length - seen.length,
    );

    const look = { robe: 'robe_dusk', thread: null };
    const weaver = page({ initialTab: 'weaver', look });
    expect(weaver).toContain('data-testid="codex-weaver-card"');
    expect(weaver).toContain(`data-portrait="${portraitKey(weaverSubject(look))}"`);
    expect(weaver).toContain('alt="The Weaver" width="112" height="112"');
    expect(weaver).toContain('Robe · Dusk');
    expect(weaver).toContain('Thread · The Thread’s own');
  });

  it('a picture still being drawn holds its place, unseen by a screen reader', async () => {
    browser();
    const CodexView = await codex();
    const heroes = renderToStaticMarkup(
      createElement(CodexView, { onBack: () => {}, initialTab: 'heroes' }),
    );
    expect(heroes).toContain(
      'data-testid="portrait" data-portrait="hero|kael" data-ready="false" aria-hidden="true"',
    );
    expect(heroes).toContain('width:88px;height:88px');
    expect(heroes).not.toContain('<img');
  });

  it('the Auras and Songs pages show no portrait', async () => {
    browser();
    const CodexView = await codex();
    for (const tab of ['auras', 'chords']) {
      const html = renderToStaticMarkup(
        createElement(CodexView, { onBack: () => {}, initialTab: tab }),
      );
      expect(html, tab).not.toContain('data-testid="portrait"');
    }
  });
});
