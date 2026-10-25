import { useState, type KeyboardEvent } from 'react';
import { CONTENT, motifText } from '../../content';
import type { AttackDef, EnemyDef, HeroDef } from '../../content';
import { AnswerGlyph } from '../hud/AnswerGlyph';
import { ROLE_LABEL } from '../hud/labels';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { CATEGORY, Chip, RARITY, RarityChip } from '../kit/Chip';
import { fmt, pct } from '../kit/format';
import { Icon } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { useMood } from '../kit/sound';
import { useUi } from '../store';
import { HeroDisc } from './shared';

const TABS = [
  { id: 'heroes', label: 'Heroes' },
  { id: 'enemies', label: 'Enemies' },
  { id: 'weaver', label: 'The Weaver' },
  { id: 'auras', label: 'Auras' },
  { id: 'motifs', label: 'Motifs' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** The Codex: everything is generated from content, so it can never drift from the game. */
export function CodexView({ onBack }: { onBack(): void }) {
  useMood('title');
  const [tab, setTab] = useState<TabId>('heroes');
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
    setTab(next.id);
    e.currentTarget.querySelector<HTMLElement>(`#tab-${next.id}`)?.focus();
    e.preventDefault();
  };
  return (
    <ScreenFrame>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ScreenHeader
          eyebrow="Reference"
          title="Codex"
          right={
            <Button variant="secondary" onClick={onBack} sound="back">
              <Icon name="back" size={16} /> Back
            </Button>
          }
        />
        <div
          role="tablist"
          aria-label="Codex sections"
          onKeyDown={onKey}
          className="mt-6 flex flex-wrap gap-2 border-b border-ink-600/60 pb-3"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id ? 'bg-gold-400 text-ink-950' : 'bg-ink-800 text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-6">
          {tab === 'heroes' && <Heroes />}
          {tab === 'enemies' && <Enemies />}
          {tab === 'weaver' && <Weaver />}
          {tab === 'auras' && <Auras />}
          {tab === 'motifs' && <Motifs />}
        </div>
      </div>
    </ScreenFrame>
  );
}

export function CodexScreen() {
  const back = useUi((s) => s.back);
  return <CodexView onBack={back} />;
}

const GRID = 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(22rem,1fr))]';

function Heroes() {
  return (
    <div className={GRID}>
      {CONTENT.heroes.map((h) => (
        <HeroEntry key={h.id} hero={h} />
      ))}
    </div>
  );
}

function HeroEntry({ hero: h }: { hero: HeroDef }) {
  return (
    <Panel tone="solid" className="p-5" style={{ borderTopColor: h.color, borderTopWidth: 3 }}>
      <div className="flex items-center gap-3">
        <HeroDisc heroId={h.id} size={46} />
        <div>
          <h2 className="font-display text-xl font-bold leading-tight">{h.name}</h2>
          <p className="text-sm text-muted">
            {h.title} · {ROLE_LABEL[h.role]}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-text">{h.codex}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip icon="heart">{fmt(h.maxHp)} life</Chip>
        {h.armor > 0 && <Chip icon="ward">{pct(h.armor)} armour</Chip>}
        <Chip>{h.attack.kind === 'melee' ? 'Melee' : 'Ranged'}</Chip>
      </div>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        {h.abilities.map((a) => (
          <div key={a.id}>
            <dt className="font-semibold">
              {a.name}{' '}
              <span className="font-mono text-xs font-normal text-muted">{a.cooldown}s</span>
            </dt>
            <dd className="text-xs leading-relaxed text-muted">{a.description}</dd>
          </div>
        ))}
        <div>
          <dt className="font-semibold text-gold-200">Solo · {h.solo.name}</dt>
          <dd className="text-xs leading-relaxed text-muted">{h.solo.description}</dd>
          <dd className="text-xs leading-relaxed text-gold-300">{h.solo.cuedDescription}</dd>
        </div>
        <div>
          <dt className="font-semibold">Quirk · {h.quirk.name}</dt>
          <dd className="text-xs leading-relaxed text-muted">{h.quirk.description}</dd>
        </div>
      </dl>
    </Panel>
  );
}

function attackDamage(a: AttackDef): string {
  if (a.effect === 'healAllies') return 'heals allies';
  if (a.effect === 'summon')
    return `summons ${a.summon?.count ?? ''} ${a.summon?.enemy.replace(/_/g, ' ') ?? ''}`;
  if (a.effect === 'suppress') return 'silences auras';
  if (a.pctMaxHp !== undefined) return `${Math.round(a.pctMaxHp * 100)}% of max life`;
  return `${fmt(a.damage)} damage`;
}

function Enemies() {
  return (
    <div className={GRID}>
      {CONTENT.enemies.map((e) => (
        <EnemyEntry key={e.id} enemy={e} />
      ))}
    </div>
  );
}

function EnemyEntry({ enemy: e }: { enemy: EnemyDef }) {
  const attacks = e.specials.map((id) => CONTENT.attacks.find((a) => a.id === id)!).filter(Boolean);
  const boss = e.role === 'boss' || e.role === 'miniboss';
  return (
    <Panel
      tone="solid"
      className={`p-5 ${boss ? 'md:col-span-2' : ''}`}
      style={{ borderTopColor: e.accent, borderTopWidth: 3 }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{e.name}</h2>
        <Chip color={e.accent} icon={boss ? 'eye' : 'skull'}>
          {e.role}
        </Chip>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text">{e.codex}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip icon="heart">{fmt(e.hp)} life</Chip>
        <Chip>
          {e.basic.kind === 'melee' ? 'Melee' : 'Ranged'} · {e.basic.damage} per hit
        </Chip>
        {e.suppressRadius > 0 && (
          <Chip icon="mute">silences auras within {e.suppressRadius} m</Chip>
        )}
      </div>
      {attacks.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {attacks.map((a) => (
            <li key={a.id} className="rounded-lg bg-ink-900/60 p-3">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-semibold">
                {a.name}
                <span className="font-mono text-xs font-normal text-muted">
                  {a.kind} · {a.windup}s wind-up · {attackDamage(a)}
                </span>
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                Answer:
                {a.answers.map((tag) => (
                  <AnswerGlyph key={tag} tag={tag} />
                ))}
              </p>
              {a.decree && (
                <p className="mt-1.5 text-xs italic leading-relaxed text-violet-200">
                  “{a.decree}”
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Weaver() {
  const t = CONTENT.techniques;
  const r = CONTENT.resonance;
  const th = CONTENT.thread;
  const entries: {
    name: string;
    icon: 'ward' | 'chime' | 'reel' | 'glide' | 'thread' | 'note';
    keys: string;
    body: string;
    stats: string[];
  }[] = [
    {
      name: 'Thread',
      icon: 'thread',
      keys: '1–4 / click, RMB',
      body: 'Tie your Thread to a hero. Mend heals them; Empower adds damage and attack speed. Stray too far and it snaps.',
      stats: [
        `Mend ${th.mendPerSec}/s`,
        `Empower +${pct(th.empowerMore)} damage`,
        `Full strength to ${th.comfortRange} m`,
        `Snaps at ${th.snapRange} m`,
      ],
    },
    {
      name: t.ward.name,
      icon: 'ward',
      keys: 'Q',
      body: `A barrier worth ${pct(t.ward.barrierPct)} of the hero's life plus ${t.ward.barrierFlat}. Cast it just before a hit lands (within ${t.ward.perfectWindow}s) for a Perfect Ward: the hit is negated, the attacker staggers and you get ${pct(t.ward.perfectRefund)} of the Spirit back.`,
      stats: [`${t.ward.cost} Spirit`, `${t.ward.cooldown}s cooldown`, `${t.ward.range} m range`],
    },
    {
      name: t.chime.name,
      icon: 'chime',
      keys: 'E',
      body: `A bell lands under your cursor, cleanses every ailment in ${t.chime.radius} m and leaves heroes immune for ${t.chime.immunity}s. Clutch Chimes (within ${t.chime.clutchWindow}s of a mark's end) feed Resonance.`,
      stats: [
        `${t.chime.cost} Spirit`,
        `${t.chime.cooldown}s cooldown`,
        `${t.chime.range} m range`,
      ],
    },
    {
      name: t.reel.name,
      icon: 'reel',
      keys: 'F',
      body: 'Yank a hero to your side along a ribbon. Out of a lethal zone or a beam, and into your aura field.',
      stats: [`${t.reel.cost} Spirit`, `${t.reel.cooldown}s cooldown`, `${t.reel.range} m range`],
    },
    {
      name: t.glide.name,
      icon: 'glide',
      keys: 'Space',
      body: `A short dash with ${t.glide.iframes}s of invulnerability. Free to use.`,
      stats: [`${t.glide.cooldown}s cooldown`, `${t.glide.distance} m`],
    },
    {
      name: 'Resonance',
      icon: 'note',
      keys: 'T / R',
      body: `Good support fills the Resonance arc (${r.max} in segments of ${r.segment}). A Cue (T, or Shift + a hero's number) spends one segment to fire a charged Solo with a bonus. Crescendo (R) spends it all on ${CONTENT.crescendo.name}: ${CONTENT.crescendo.description}`,
      stats: [
        `Perfect Ward +${r.gains.perfectWard}`,
        `Save +${r.gains.save}`,
        `Clutch Chime +${r.gains.clutchChime}`,
        `Reel dodge +${r.gains.reelDodge}`,
      ],
    },
  ];
  return (
    <div className={GRID}>
      {entries.map((e) => (
        <Panel key={e.name} tone="solid" className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
              <Icon name={e.icon} size={22} /> {e.name}
            </h2>
            <span className="font-mono text-xs text-muted">{e.keys}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-text">{e.body}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {e.stats.map((s) => (
              <Chip key={s}>{s}</Chip>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function Auras() {
  return (
    <div className={GRID}>
      {CONTENT.auras.map((a) => (
        <Panel
          key={a.id}
          tone="solid"
          className="p-5"
          style={{ borderTopColor: a.color, borderTopWidth: 3 }}
        >
          <h2
            className="flex items-center gap-2 font-display text-xl font-bold"
            style={{ color: a.color }}
          >
            <Icon name="note" size={20} /> {a.name}
          </h2>
          <p className="text-sm text-muted">{a.subtitle}</p>
          <p className="mt-2 text-sm leading-relaxed text-text">{a.description}</p>
          <div className="mt-3">
            <Chip icon="sparkle">reserves {pct(a.reserve)} of Spirit</Chip>
          </div>
        </Panel>
      ))}
    </div>
  );
}

function Motifs() {
  const categories = Object.keys(CATEGORY) as (keyof typeof CATEGORY)[];
  return (
    <div className="flex flex-col gap-8">
      {categories.map((cat) => {
        const motifs = CONTENT.motifs.filter((m) => m.category === cat);
        if (motifs.length === 0) return null;
        const c = CATEGORY[cat];
        return (
          <section key={cat} aria-label={c.label}>
            <h2
              className="mb-3 flex items-center gap-2 font-display text-lg font-bold"
              style={{ color: c.color }}
            >
              <Icon name={c.icon} size={20} /> {c.label}
              <span className="text-sm font-normal text-muted">{c.blurb}</span>
            </h2>
            <div className={GRID}>
              {motifs.map((m) => (
                <Panel
                  key={m.id}
                  tone="solid"
                  className="p-4"
                  style={{ borderLeftColor: RARITY[m.rarity].color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{m.name}</h3>
                    <RarityChip rarity={m.rarity} />
                  </div>
                  <ol className="mt-2 flex flex-col gap-1 text-sm leading-snug text-muted">
                    {m.values.map((_, i) => (
                      <li key={i}>
                        <span className="mr-1.5 font-mono text-xs text-gold-300">Lv {i + 1}</span>
                        {motifText(m, i + 1)}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.requires.aura && (
                      <Chip icon="note">
                        needs {CONTENT.auras.find((a) => a.id === m.requires.aura)?.name}
                      </Chip>
                    )}
                    {m.requires.hero && (
                      <Chip icon="link">
                        needs {CONTENT.heroes.find((h) => h.id === m.requires.hero)?.name}
                      </Chip>
                    )}
                    {m.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded border border-ink-500 px-1.5 py-px font-mono text-xs text-muted"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </Panel>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
