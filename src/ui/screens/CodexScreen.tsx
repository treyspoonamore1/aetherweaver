import { useState, type KeyboardEvent } from 'react';
import { CONTENT, motifText, ornamentDef } from '../../content';
import {
  FIGHT_XP,
  GRADE_XP,
  LOSS_XP,
  RANK_XP,
  RUN_WIN_XP,
  UNLOCKS,
  unlockRank,
} from '../../meta/profile';
import { CHORD_PRESETS } from '../../meta/run';
import { WITHOUT_YOU_MAX_SECONDS } from '../../sim';
import type { AttackDef, EnemyDef, HeroDef } from '../../content';
import { AnswerGlyph } from '../hud/AnswerGlyph';
import { ROLE_LABEL } from '../hud/labels';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { CATEGORY, Chip, RARITY, RarityChip } from '../kit/Chip';
import { fmt, pct } from '../kit/format';
import { Icon, type IconName } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { useMood } from '../kit/sound';
import { useUi } from '../store';
import { HeroDisc } from './shared';

const TABS = [
  { id: 'heroes', label: 'Heroes' },
  { id: 'enemies', label: 'Enemies' },
  { id: 'weaver', label: 'The Weaver' },
  { id: 'auras', label: 'Auras' },
  { id: 'chords', label: 'Songs & ornaments' },
  { id: 'rank', label: 'Weaver Rank' },
  { id: 'calls', label: 'Calls' },
  { id: 'motifs', label: 'Motifs' },
] as const;
export type TabId = (typeof TABS)[number]['id'];

/** The Codex: everything is generated from content, so it can never drift from the game. */
export function CodexView({
  onBack,
  initialTab = 'heroes',
}: {
  onBack(): void;
  initialTab?: TabId;
}) {
  useMood('title');
  const [tab, setTab] = useState<TabId>(initialTab);
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
          {tab === 'chords' && <Chords />}
          {tab === 'rank' && <Ranks />}
          {tab === 'calls' && <Calls />}
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
          <dt className="flex items-center gap-1.5 font-semibold" style={{ color: CALL }}>
            <Icon name="call" size={14} /> Call · {CALL_ANSWER[h.call.answer]} →{' '}
            {h.call.flourish.name}
          </dt>
          <dd className="text-xs leading-relaxed text-muted">{h.call.flourish.description}</dd>
        </div>
        <div>
          <dt className="font-semibold">Quirk · {h.quirk.name}</dt>
          <dd className="text-xs leading-relaxed text-muted">{h.quirk.description}</dd>
        </div>
      </dl>
    </Panel>
  );
}

const CALL = 'var(--color-call, #fde68a)';
const CALL_ANSWER = { ward: 'Ward', empower: 'Empower', chime: 'Chime' } as const;
const CALL_ICON = { ward: 'ward', empower: 'empower', chime: 'chime' } as const;

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
    icon: IconName;
    keys: string;
    body: string;
    stats: string[];
  }[] = [
    {
      name: 'Thread',
      icon: 'thread',
      keys: '1–4 / click, RMB',
      body: 'Tie your Thread to a hero. Mend heals them; Empower adds damage and attack speed. Your beam song rides it in both modes. Stray too far and it snaps.',
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
        `Answered call +${r.gains.response}`,
      ],
    },
    {
      name: 'Directives',
      icon: 'wheel',
      keys: 'hold C / MMB',
      body: 'Hold C or the middle mouse button for the Directive wheel, move toward a spoke and let go: Focus (the enemy under your cursor), Rally (regroup on you), Hold (stay put) or Scatter (spread out). Let go in the centre to cancel. A quick middle-click on an enemy Focuses it.',
      stats: ['Focus · Rally · Hold · Scatter', 'G: Focus', 'Z: Rally', 'X: Hold'],
    },
    {
      name: 'Without you',
      icon: 'eye',
      keys: 'after each fight',
      body: `When a fight ends, the Loom replays it with the same enemies and the same seed, but with you absent: no Thread, no auras, no techniques. The result screen shows the two side by side ("Without you, the party falls at 0:41 in wave 2"), and the run summary counts the fights they would have lost alone. The re-run is capped at ${Math.round(WITHOUT_YOU_MAX_SECONDS / 60)} minutes.`,
      stats: ['Same seed, same enemies', 'Shown on Result and Summary'],
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
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip icon="sparkle">reserves {pct(a.reserve)} of Spirit</Chip>
            <Chip icon="lock">Rank {unlockRank('aura', a.id)}</Chip>
          </div>
        </Panel>
      ))}
    </div>
  );
}

const ANCHOR_TEXT = {
  weaver: 'Around you',
  planted: 'Planted where you put it',
} as const;

function Chords() {
  const w = CONTENT.weaver;
  const c = CONTENT.chorus;
  const fermata = CONTENT.auras.find((a) => a.id === 'fermata');
  const unison = CONTENT.ornaments.find((o) => o.id === 'unison');
  const mult = (v: number) => `×${Number(v.toFixed(2))}`;
  return (
    <div className="flex flex-col gap-8">
      <div className={GRID}>
        <Panel tone="gold" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="thread" size={22} /> The beam song
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            Your first Chord rides the Thread. The hero you thread hears it at{' '}
            <b>{mult(w.beamFocus)}</b>, wherever they are, and its hexes hit whatever attacks them.
            Everyone else in its field hears an echo at <b>{mult(w.beamEcho)}</b>. Who you thread
            decides who becomes the monster; right-click (Mend ⇄ Empower) doesn’t change it.
            {unison && (
              <>
                {' '}
                With <b style={{ color: unison.color }}>{unison.name}</b> it goes all in:{' '}
                {mult(w.beamFocus * unison.focusMult)} on your threaded hero, and nobody hears an
                echo.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip icon="thread">{mult(w.beamFocus)} on your threaded hero</Chip>
            <Chip icon="scatter">
              echo {mult(w.beamEcho)} within {w.fieldRadius} m
            </Chip>
            <Chip icon="lock">Rank {unlockRank('song', 'beam')}</Chip>
          </div>
        </Panel>
        <Panel
          tone="solid"
          className="p-5"
          style={{ borderTopColor: '#93c5fd', borderTopWidth: 3 }}
        >
          <h2
            className="flex items-center gap-2 font-display text-xl font-bold"
            style={{ color: '#93c5fd' }}
          >
            <Icon name="scatter" size={22} /> The field song
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            Your second Chord surrounds you: everyone within {w.fieldRadius} m hears it at full
            strength. Make one ally a monster with the beam, and the whole party stronger just by
            being near you with the field. Each song holds {w.auraSlots} auras and up to{' '}
            {w.ornamentSlots} ornaments, and an ornament changes both auras in its song. You own one
            copy of each aura and each ornament. Auras reserve Spirit; what they leave free powers
            Ward ({CONTENT.techniques.ward.cost}), Chime ({CONTENT.techniques.chime.cost}) and Reel
            ({CONTENT.techniques.reel.cost}). Change your songs in Prep, or Retune at a Respite.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip>×1 within {w.fieldRadius} m</Chip>
            <Chip>{w.fieldRadiusCap} m at most</Chip>
            <Chip icon="lock">Rank {unlockRank('song', 'field')}</Chip>
          </div>
        </Panel>
        <Panel tone="solid" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="sparkle" size={22} /> Chorus pulse
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            Sing {c.minAuras} or more auras and every Cue also releases a chorus pulse from your
            field: each hero it reaches heals {pct(c.healPctPerAura)} of their life and gains a
            barrier of {pct(c.barrierPctPerAura)} of their life for {c.barrierDuration} s, per aura
            you sing. Grace Note is how you fit the third aura.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip icon="mend">{pct(c.healPctPerAura)} heal per aura</Chip>
            <Chip icon="ward">{pct(c.barrierPctPerAura)} barrier per aura</Chip>
          </div>
        </Panel>
        {fermata && (
          <Panel
            tone="solid"
            className="p-5"
            style={{ borderTopColor: fermata.color, borderTopWidth: 3 }}
          >
            <h2
              className="flex items-center gap-2 font-display text-xl font-bold"
              style={{ color: fermata.color }}
            >
              <Icon name="fermata" size={22} /> Fermata hold
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text">
              With the Fermata aura sung, once per fight per hero, a hit that would down them holds
              them at 1 life for {fermata.effects.holdTime ?? 1.5} s instead. Their frame shows{' '}
              <b>HELD · Heal!</b> with a countdown: heal them in time (Mend on the Thread, or a
              Chime on them) and it counts as a Save. Let it run out and they go down.
            </p>
          </Panel>
        )}
      </div>
      <section aria-label="Ornaments">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-gold-300">
          <Icon name="diamond" size={20} /> Ornaments
        </h2>
        <div className={GRID}>
          {CONTENT.ornaments.map((o) => (
            <Panel
              key={o.id}
              tone="solid"
              className="p-5"
              style={{ borderTopColor: o.color, borderTopWidth: 3 }}
            >
              <h3
                className="flex items-center gap-2 font-display text-xl font-bold"
                style={{ color: o.color }}
              >
                <Icon name="diamond" size={20} /> {o.name}
              </h3>
              <p className="text-sm text-muted">{o.subtitle}</p>
              <p className="mt-2 text-sm leading-relaxed text-text">{o.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {o.reserveMult !== 1 && <Chip icon="sparkle">reserve {mult(o.reserveMult)}</Chip>}
                {o.effectMult !== 1 && <Chip icon="empower">effect {mult(o.effectMult)}</Chip>}
                {o.radiusMult !== 1 && <Chip icon="scatter">radius {mult(o.radiusMult)}</Chip>}
                {o.focusMult !== 1 && (
                  <Chip icon="thread">beam {mult(w.beamFocus * o.focusMult)}</Chip>
                )}
                <Chip icon={o.echoMult === 0 ? 'thread' : o.anchor === 'planted' ? 'pin' : 'note'}>
                  {o.echoMult === 0 ? 'Only your threaded hero' : ANCHOR_TEXT[o.anchor]}
                </Chip>
                {o.roles.length === 1 && (
                  <Chip icon="info">{o.roles[0] === 'beam' ? 'beam song' : 'field song'} only</Chip>
                )}
                <Chip icon="lock">Rank {unlockRank('ornament', o.id)}</Chip>
                {o.excludes.map((x) => (
                  <Chip key={x} icon="close" color="var(--color-threat)">
                    not with {ornamentDef(x).name}
                  </Chip>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}

function Ranks() {
  const kinds = (['skirmish', 'elite', 'miniboss', 'boss'] as const).map((k) => ({
    k,
    label: { skirmish: 'Skirmish', elite: 'Elite', miniboss: 'Mini-boss', boss: 'Boss' }[k],
  }));
  return (
    <div className="flex flex-col gap-6">
      <div className={GRID}>
        <Panel tone="gold" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="crown" size={22} /> Weaver Rank
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            Every fight earns Weaver XP, won or lost, and XP raises your Rank. Each Rank opens one
            more piece of the build layer, so you meet the beam song first and the rest as you
            learn. XP is kept as each fight ends: quitting a run never loses it. Settings →{' '}
            <b>Skip the unlocks</b> opens everything at once; the Training Grounds always have
            everything.
          </p>
        </Panel>
        <Panel tone="solid" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="star" size={22} /> Weaver XP
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {kinds.map(({ k, label }) => (
              <li key={k} className="flex justify-between gap-3">
                <span className="text-text">{label} won</span>
                <span className="font-mono text-gold-300">+{FIGHT_XP[k]}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3">
              <span className="text-text">A fight lost</span>
              <span className="font-mono text-gold-300">{pct(LOSS_XP)} of it</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-text">Grade S · A · B</span>
              <span className="font-mono text-gold-300">
                ×{GRADE_XP.S} · ×{GRADE_XP.A} · ×{GRADE_XP.B}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-text">Winning the run</span>
              <span className="font-mono text-gold-300">+{RUN_WIN_XP}</span>
            </li>
          </ul>
        </Panel>
      </div>
      <section aria-label="Ranks">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-gold-300">
          <Icon name="lock" size={20} /> What each Rank opens
        </h2>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {RANK_XP.map((xp, i) => {
            const rank = i + 1;
            const preset = CHORD_PRESETS.find((p) => p.rank === rank);
            return (
              <li key={rank}>
                <Panel tone="solid" className="h-full p-4">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-lg font-bold text-gold-200">
                      Rank {rank}
                    </span>
                    <span className="font-mono text-xs text-muted">{fmt(xp)} XP</span>
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                    {UNLOCKS.filter((u) => u.rank === rank).map((u) => (
                      <li key={u.id} className="leading-snug">
                        <b className="text-text">{u.name}</b>{' '}
                        <span className="text-xs text-muted">{u.text}</span>
                      </li>
                    ))}
                  </ul>
                  {preset && <p className="mt-2 text-xs text-gold-300">Preset · {preset.name}</p>}
                </Panel>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Calls() {
  const calls = CONTENT.calls;
  return (
    <div className="flex flex-col gap-6">
      <Panel tone="gold" className="p-5">
        <h2
          className="flex items-center gap-2 font-display text-xl font-bold"
          style={{ color: CALL }}
        >
          <Icon name="call" size={22} /> Call and Response
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-text">
          Before a big move, a hero calls for a specific answer: their frame shows a gold glyph, the
          key that answers it and a countdown. Answer in time and the move becomes a{' '}
          <b style={{ color: CALL }}>Flourish</b>, a stronger version of it, and you gain{' '}
          {CONTENT.resonance.gains.response} Resonance. Ignoring a call costs nothing but a short
          delay: they use the plain move when the window closes.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip>first call after {calls.firstAfter} s</Chip>
          <Chip>a hero calls at most every {calls.heroCooldown} s</Chip>
        </div>
      </Panel>
      <div className={GRID}>
        {CONTENT.heroes.map((h) => {
          const ability = h.abilities[h.call.ability];
          return (
            <Panel
              key={h.id}
              tone="solid"
              className="p-5"
              style={{ borderTopColor: h.color, borderTopWidth: 3 }}
            >
              <div className="flex items-center gap-3">
                <HeroDisc heroId={h.id} size={40} />
                <div>
                  <h3 className="font-display text-lg font-bold leading-tight">{h.name}</h3>
                  <p className="text-sm text-muted">calls before {ability?.name ?? 'a big move'}</p>
                </div>
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-muted">Wants:</span>
                <Chip icon={CALL_ICON[h.call.answer]} color={CALL}>
                  {CALL_ANSWER[h.call.answer]}
                </Chip>
                <span className="text-muted">within {h.call.answerTime} s</span>
              </p>
              <p className="mt-2 font-semibold" style={{ color: CALL }}>
                Flourish · {h.call.flourish.name}
              </p>
              <p className="text-sm leading-relaxed text-text">{h.call.flourish.description}</p>
              {h.call.lines[0] && (
                <p className="mt-2 text-xs italic text-muted">“{h.call.lines[0]}”</p>
              )}
            </Panel>
          );
        })}
      </div>
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
