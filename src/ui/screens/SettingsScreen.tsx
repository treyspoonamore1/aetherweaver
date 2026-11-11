import { useId, useState, type ReactNode } from 'react';
import { DEMO } from '../../app/demo';
import { startDemoOver } from '../../app/demoChoice';
import { useProfile } from '../../app/profileStore';
import { getAudio } from '../../audio';
import {
  GAME_SPEEDS,
  QUALITY_SETTINGS,
  REDUCED_MOTION,
  ambienceVolume,
  barksVolume,
  optionsOf,
  useSettings,
  type FramesLayout,
  type HudSettings as HudSettingsShape,
  type Settings,
  type TelegraphSettings,
} from '../../app/settings';
import {
  COLOR_VISIONS,
  COLOR_VISION_LABELS,
  applyVisionCss,
  visionPalette,
  type ColorVision,
  type VisionPalette,
} from '../../app/colorVision';
import { resetHints } from '../hud/hints';
import { Button } from '../kit/Button';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Icon, type IconName } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { applyUiScale } from '../presentation';
import { percent, t } from '../text';
import { rankPanel } from './rankText';
import { ControlsSettings } from './ControlsSettings';
import { SavesPanel } from './SavesPanel';
import { Segmented, Slider, Toggle } from '../kit/Slider';
import { useMood } from '../kit/sound';
import { useUi } from '../store';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ink-600/60 bg-ink-900/60 p-4">
      <h2 className="font-display text-base font-bold tracking-wide text-gold-300">{title}</h2>
      <div className="mt-3 flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

/**
 * All settings controls (used by the Settings screen and the pause menu). `context`: opened from
 * a fight's pause menu, which says when an assist change takes effect there.
 */
export function SettingsPanel({
  compact = false,
  context,
}: {
  compact?: boolean;
  context?: 'run' | 'training';
}) {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const reset = useSettings((s) => s.reset);
  // Phase 7's options (docs/phase-7.md, *Contracts*): each absent until the player sets it.
  const options = optionsOf(settings);

  const setVolume = (key: keyof Settings['volumes'], value: number) => {
    update((d) => ({ ...d, volumes: { ...d.volumes, [key]: value } }));
    try {
      getAudio().setVolumes(useSettings.getState().settings.volumes);
    } catch {
      // Audio unavailable: the value is still saved.
    }
  };
  const setAssist = <K extends keyof Settings['assists']>(key: K, value: Settings['assists'][K]) =>
    update((d) => ({ ...d, assists: { ...d.assists, [key]: value } }));

  return (
    <div className={`mt-4 grid gap-4 ${compact ? '' : 'lg:grid-cols-2'}`}>
      <Section title={t('a11y.settings.sound')}>
        <Slider
          label={t('a11y.settings.master')}
          value={settings.volumes.master}
          onChange={(v) => setVolume('master', v)}
        />
        <Slider
          label={t('a11y.settings.music')}
          value={settings.volumes.music}
          onChange={(v) => setVolume('music', v)}
        />
        <Slider
          label={t('a11y.settings.effects')}
          value={settings.volumes.sfx}
          onChange={(v) => setVolume('sfx', v)}
        />
        <Slider
          label={t('a11y.settings.interface')}
          value={settings.volumes.ui}
          onChange={(v) => setVolume('ui', v)}
        />
        <AmbienceRow setVolume={setVolume} />
        <Slider
          label={t('a11y.sound.barks')}
          value={barksVolume(settings.volumes)}
          onChange={(v) => setVolume('barks', v)}
        />
        <Toggle
          label={t('a11y.sound.heroVoices')}
          hint={t('a11y.sound.heroVoicesHint')}
          checked={options.heroVoices}
          onChange={(v) => update((d) => ({ ...d, heroVoices: v }))}
        />
      </Section>
      <Section title={t('a11y.settings.comfort')}>
        <Slider
          label={t('a11y.settings.screenShake')}
          value={settings.screenShake}
          onChange={(v) => update((d) => ({ ...d, screenShake: v }))}
        />
        <Slider
          label={t('a11y.settings.screenFlashes')}
          value={settings.flashes}
          onChange={(v) => update((d) => ({ ...d, flashes: v }))}
          format={(v) => (v <= 0 ? t('a11y.settings.off') : `${Math.round(v * 100)}%`)}
        />
        <p className="-mt-2 text-xs text-muted">{t('a11y.flashes.hint')}</p>
        <Segmented
          label={t('a11y.motion.label')}
          hint={t('a11y.motion.hint')}
          value={options.reducedMotion}
          options={REDUCED_MOTION.map((m) => ({ value: m, label: t(`a11y.motion.${m}`) }))}
          onChange={(v) => update((d) => ({ ...d, reducedMotion: v }))}
        />
        <Toggle
          label={t('a11y.vignette.label')}
          hint={t('a11y.vignette.hint')}
          checked={options.slowmoVignette}
          onChange={(v) => update((d) => ({ ...d, slowmoVignette: v }))}
        />
        <Toggle
          label={t('a11y.settings.damageNumbers')}
          hint={t('a11y.settings.floatingNumbersOverHeroes')}
          checked={settings.damageNumbers}
          onChange={(v) => update((d) => ({ ...d, damageNumbers: v }))}
        />
        <Toggle
          label={t('a11y.numbers.important')}
          hint={t('a11y.numbers.importantHint')}
          checked={options.importantNumbersOnly}
          onChange={(v) => update((d) => ({ ...d, importantNumbersOnly: v }))}
        />
        <Toggle
          label={t('a11y.settings.captions')}
          hint={t('a11y.captions.hint')}
          checked={settings.captions}
          onChange={(v) => update((d) => ({ ...d, captions: v }))}
        />
        <Toggle
          label={t('a11y.settings.coachHints')}
          hint={t('a11y.settings.shortTipsDuringThe')}
          checked={settings.hints}
          onChange={(v) => update((d) => ({ ...d, hints: v }))}
        />
        <div>
          <Button size="sm" onClick={resetHints}>
            {t('a11y.settings.showAllHintsAgain')}
          </Button>
        </div>
      </Section>
      <Section title={t('a11y.settings.assists')}>
        <Segmented
          label={t('a11y.settings.perfectWardWindow')}
          hint={t('a11y.settings.extraTimeToLand')}
          value={settings.assists.perfectWindowBonus}
          options={[
            { value: 0, label: t('a11y.settings.standard') },
            { value: 0.1, label: '+0.1 s' },
            { value: 0.2, label: '+0.2 s' },
          ]}
          onChange={(v) => setAssist('perfectWindowBonus', v)}
        />
        <Segmented
          label={t('a11y.settings.telegraphLead')}
          hint={t('a11y.settings.enemyAttacksWindUp')}
          value={settings.assists.telegraphLead}
          options={[
            { value: 1, label: t('a11y.settings.standard') },
            { value: 1.25, label: '×1.25' },
            { value: 1.5, label: '×1.5' },
          ]}
          onChange={(v) => setAssist('telegraphLead', v)}
        />
        <Segmented
          label={t('a11y.speed.label')}
          hint={t('a11y.speed.hint')}
          value={options.aids.gameSpeed}
          options={GAME_SPEEDS.map((v) => ({ value: v, label: percent(v) }))}
          onChange={(v) => update((d) => ({ ...d, aids: { ...d.aids, gameSpeed: v } }))}
        />
        <Toggle
          label={t('a11y.settings.heroAutonomy')}
          hint={t('a11y.settings.heroesFireTheirOwn')}
          checked={settings.assists.autonomy}
          onChange={(v) => setAssist('autonomy', v)}
        />
        <p className="text-xs text-muted">{t('a11y.settings.assistsNeverBlockAnything')}</p>
        {context && (
          <p className="text-xs text-gold-200" data-testid="assists-when">
            {context === 'run'
              ? t('a11y.settings.assistChangesApplyFrom')
              : t('a11y.settings.assistChangesRestartThe')}
          </p>
        )}
      </Section>
      <Section title={t('a11y.telegraphs.title')}>
        <TelegraphSettingsRows />
      </Section>
      <Section title={t('a11y.settings.healthAndTheHud')}>
        <HudSettings />
      </Section>
      <Section title={t('a11y.settings.accessibility')}>
        <AccessibilitySettings />
      </Section>
      <Section title={t('a11y.graphics.title')}>
        <Segmented
          label={t('a11y.quality.label')}
          hint={t('a11y.quality.hint')}
          value={options.quality}
          options={QUALITY_SETTINGS.map((q) => ({ value: q, label: t(`a11y.quality.${q}`) }))}
          onChange={(v) => update((d) => ({ ...d, quality: v }))}
        />
      </Section>
      <Section title={t('a11y.settings.progress')}>
        <ProgressSettings />
        {/* Export, import and kept saves (docs/phase-7.md, W5): nothing until W5 fills it. */}
        <SavesPanel />
        {/* The playtest demo (docs/demo.md): back to its first choice, from the Settings screen. */}
        {DEMO && !compact && <DemoOver />}
      </Section>
      <div className={compact ? '' : 'lg:col-span-2'}>
        <Section title={t('a11y.settings.controls')}>
          <ControlsSettings compact={compact} />
        </Section>
      </div>
      <div className={compact ? '' : 'lg:col-span-2'}>
        <Button variant="ghost" size="sm" onClick={reset}>
          {t('a11y.settings.restoreDefaults')}
        </Button>
      </div>
    </div>
  );
}

/**
 * The ambience bus's level (docs/phase-7.md, W2): absent, it follows the Effects slider, as the
 * engine always has; moved, it has its own until Follow Effects puts it back.
 */
function AmbienceRow({
  setVolume,
}: {
  setVolume: (key: keyof Settings['volumes'], value: number) => void;
}) {
  const volumes = useSettings((s) => s.settings.volumes);
  const update = useSettings((s) => s.update);
  const own = volumes.ambience !== undefined;
  return (
    <>
      <Slider
        label={t('a11y.sound.ambience')}
        value={ambienceVolume(volumes)}
        onChange={(v) => setVolume('ambience', v)}
      />
      <div className="-mt-2 flex items-center gap-3">
        <p className="min-w-0 flex-1 text-xs text-muted" data-testid="ambience-follows">
          {t(own ? 'a11y.sound.ambienceOwn' : 'a11y.sound.ambienceFollows')}
        </p>
        {own && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              update((d) => ({ ...d, volumes: followEffects(d.volumes) }));
              try {
                getAudio().setVolumes(useSettings.getState().settings.volumes);
              } catch {
                // Audio unavailable: the value is still saved.
              }
            }}
          >
            {t('a11y.sound.ambienceFollow')}
          </Button>
        )}
      </div>
    </>
  );
}

/** The volumes with no ambience level of their own: it follows Effects again. */
export function followEffects(volumes: Settings['volumes']): Settings['volumes'] {
  const out = { ...volumes };
  delete out.ambience;
  return out;
}

/**
 * The telegraphs' look (docs/phase-7.md, W2): fill opacity, outline, the Perfect band's width,
 * high contrast and the answer glyphs. Presentation only: never their timing.
 */
function TelegraphSettingsRows() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const options = optionsOf(settings);
  const tg = options.telegraphs;
  const set = (patch: Partial<TelegraphSettings>) =>
    update((d) => ({ ...d, telegraphs: { ...d.telegraphs, ...patch } }));
  const times = (v: number) => t('a11y.telegraphs.times', { n: v.toFixed(2) });
  return (
    <>
      <Slider
        label={t('a11y.telegraphs.opacity')}
        value={tg.opacity}
        min={0.6}
        max={1}
        step={0.05}
        onChange={(v) => set({ opacity: v })}
      />
      <Slider
        label={t('a11y.telegraphs.outline')}
        value={tg.outline}
        min={1}
        max={2}
        step={0.25}
        format={times}
        onChange={(v) => set({ outline: v })}
      />
      <Slider
        label={t('a11y.telegraphs.perfectBand')}
        value={tg.perfectBand}
        min={1}
        max={2}
        step={0.25}
        format={times}
        onChange={(v) => set({ perfectBand: v })}
      />
      <p className="-mt-2 text-xs text-muted">{t('a11y.telegraphs.sizesHint')}</p>
      <Toggle
        label={t('a11y.telegraphs.highContrast')}
        hint={t('a11y.telegraphs.highContrastHint')}
        checked={tg.highContrast}
        onChange={(v) => set({ highContrast: v })}
      />
      <Toggle
        label={t('a11y.telegraphs.glyphs')}
        hint={t('a11y.telegraphs.glyphsHint')}
        checked={options.answerGlyphs}
        onChange={(v) => update((d) => ({ ...d, answerGlyphs: v }))}
      />
    </>
  );
}

/**
 * The fight's health read-outs and the HUD's layout (docs/health-ui.md): the bars over the
 * heroes, the frames' big number, the low-health sound; the frames' size and direction, the
 * Weaver bar's size. Moving them is Edit HUD layout's, from the pause menu.
 */
function HudSettings() {
  const hud = useSettings((s) => s.settings.hud);
  const update = useSettings((s) => s.update);
  const set = (patch: Partial<HudSettingsShape>) =>
    update((d) => ({ ...d, hud: { ...d.hud, ...patch } }));
  const frames = (patch: Partial<FramesLayout>) => set({ frames: { ...hud.frames, ...patch } });
  const moved = hud.frames.at !== null || hud.weaverBar.at !== null;
  return (
    <>
      <Segmented
        label={t('a11y.settings.barsOverTheHeroes')}
        hint={t('a11y.settings.theirLifeOverTheir')}
        value={hud.allyBars}
        options={[
          { value: 'always', label: t('a11y.settings.always') },
          { value: 'hurt', label: t('a11y.settings.whenHurt') },
          { value: 'off', label: t('a11y.settings.off') },
        ]}
        onChange={(v) => set({ allyBars: v })}
      />
      <Segmented
        label={t('a11y.settings.partyFramesShow')}
        hint={t('a11y.settings.theBigNumberOn')}
        value={hud.healthText}
        options={[
          { value: 'missing', label: t('a11y.settings.lifeMissing') },
          { value: 'percent', label: t('a11y.settings.percent') },
          { value: 'current', label: t('a11y.settings.lifeLeft') },
        ]}
        onChange={(v) => set({ healthText: v })}
      />
      <Toggle
        label={t('a11y.settings.lowLifeSound')}
        hint={t('a11y.settings.aSoftToneWhen')}
        checked={hud.lowHealthSound}
        onChange={(v) => set({ lowHealthSound: v })}
      />
      <Slider
        label={t('a11y.settings.partyFrameSize')}
        value={hud.frames.scale}
        min={0.75}
        max={1.5}
        step={0.05}
        onChange={(v) => frames({ scale: v })}
      />
      <Segmented
        label={t('a11y.settings.partyFrames')}
        value={hud.frames.orientation}
        options={[
          { value: 'vertical', label: t('a11y.settings.stacked') },
          { value: 'horizontal', label: t('a11y.settings.sideBySide') },
        ]}
        onChange={(v) => frames({ orientation: v })}
      />
      <Slider
        label={t('a11y.settings.weaverBarSize')}
        value={hud.weaverBar.scale}
        min={0.75}
        max={1.25}
        step={0.05}
        onChange={(v) => set({ weaverBar: { ...hud.weaverBar, scale: v } })}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          onClick={() =>
            set({
              frames: { ...hud.frames, at: null },
              weaverBar: { ...hud.weaverBar, at: null },
            })
          }
          disabled={!moved}
          data-testid="hud-reset-places"
        >
          {t('a11y.settings.resetPositions')}
        </Button>
        <p className="min-w-0 flex-1 text-xs text-muted">{t('a11y.settings.putsThePartyFrames')}</p>
      </div>
    </>
  );
}

/** Weaver Rank: skip the unlocks, or start over at Rank 1. */
function ProgressSettings() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const profile = useProfile((s) => s.profile);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const p = rankPanel(profile);
  return (
    <>
      <p className="text-sm text-text">
        {t('a11y.settings.weaverRank')} <b className="text-gold-300">{p.rank}</b>
        <span className="ml-2 font-mono text-xs text-muted">
          {p.progressText} · {p.record}
        </span>
      </p>
      <Toggle
        label={t('a11y.settings.skipTheUnlocks')}
        hint={t('a11y.settings.everySongAuraOrnament')}
        checked={settings.unlockAll}
        onChange={(v) => update((d) => ({ ...d, unlockAll: v }))}
      />
      {confirm ? (
        <div
          className="rounded-lg border border-lethal/60 bg-lethal/10 p-3"
          role="alertdialog"
          aria-labelledby="reset-progress-q"
        >
          <p id="reset-progress-q" className="text-sm text-rose-100">
            {t('a11y.settings.backToRank1')}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => setConfirm(false)} sound="back" autoFocus>
              {t('a11y.settings.keepMyProgress')}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                useProfile.getState().resetProgress();
                setConfirm(false);
                setDone(true);
              }}
            >
              {t('a11y.settings.resetToRank1')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>
            {t('a11y.settings.resetProgress')}
          </Button>
          {done && (
            <span className="text-xs text-muted" role="status">
              {t('a11y.settings.progressResetYouRe')}
            </span>
          )}
        </div>
      )}
    </>
  );
}

/**
 * The playtest demo's "Start the demo over…" (docs/demo.md): after a confirm, the Title asks again
 * how to start (fresh, or a veteran). The choice there replaces this Weaver's progress.
 */
function DemoOver() {
  const [confirm, setConfirm] = useState(false);
  if (!confirm)
    return (
      <div className="border-t border-ink-600/60 pt-3">
        <Button size="sm" onClick={() => setConfirm(true)} data-testid="demo-over">
          <Icon name="reroll" size={14} /> {t('a11y.settings.startTheDemoOver')}
        </Button>
      </div>
    );
  return (
    <div
      className="rounded-lg border border-gold-500/60 bg-gold-400/10 p-3"
      role="alertdialog"
      aria-labelledby="demo-over-q"
    >
      <p id="demo-over-q" className="text-sm text-gold-100">
        {t('a11y.settings.backToTheDemo')}
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={() => setConfirm(false)} sound="back" autoFocus>
          {t('a11y.settings.keepPlaying')}
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            startDemoOver();
            useUi.getState().setScreen('title');
          }}
          data-testid="demo-over-confirm"
        >
          {t('a11y.settings.startOver')}
        </Button>
      </div>
    </div>
  );
}

const SWATCHES: { key: keyof VisionPalette; label: string; icon: IconName }[] = [
  {
    key: 'heal',
    get label() {
      return t('a11y.settings.life');
    },
    icon: 'mend',
  },
  {
    key: 'threat',
    get label() {
      return t('a11y.settings.threat');
    },
    icon: 'sparkle',
  },
  {
    key: 'lethal',
    get label() {
      return t('a11y.settings.lethal');
    },
    icon: 'skull',
  },
  {
    key: 'empower',
    get label() {
      return t('a11y.settings.empower');
    },
    icon: 'empower',
  },
  {
    key: 'call',
    get label() {
      return t('a11y.settings.call');
    },
    icon: 'note',
  },
];

/** Colour vision, UI scale. Applied to the page immediately. */
function AccessibilitySettings() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const id = useId();
  const vision = settings.colorVision;
  const palette = visionPalette(vision);
  return (
    <>
      <div className="grid grid-cols-[8rem_1fr] items-center gap-3">
        <label htmlFor={id} className="text-sm text-text">
          {t('a11y.settings.colourVision')}
        </label>
        <select
          id={id}
          value={vision}
          onChange={(e) => {
            const v = e.target.value as ColorVision;
            update((d) => ({ ...d, colorVision: v }));
            applyVisionCss(v);
          }}
          className="rounded-lg border border-ink-500 bg-ink-800 px-2.5 py-1.5 text-sm text-text"
        >
          {COLOR_VISIONS.map((v) => (
            <option key={v} value={v}>
              {COLOR_VISION_LABELS[v]}
            </option>
          ))}
        </select>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label={t('a11y.settings.howTheDangerLife')}>
        {SWATCHES.map((sw) => (
          <li
            key={sw.key}
            className="flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs"
            style={{ color: palette[sw.key] }}
          >
            <Icon name={sw.icon} size={13} />
            {sw.label}
          </li>
        ))}
      </ul>
      <p className="-mt-1.5 text-xs text-muted">{t('a11y.settings.dangerLifeAndCalls')}</p>
      <Slider
        label={t('a11y.settings.interfaceSize')}
        value={settings.uiScale}
        min={0.8}
        max={1.5}
        step={0.05}
        onChange={(v) => {
          update((d) => ({ ...d, uiScale: v }));
          applyUiScale(v);
        }}
      />
    </>
  );
}

/** Settings from the Title or the Loom (or anywhere that routes `screen = 'settings'`). */
export function SettingsScreen() {
  useMood('title');
  const back = useUi((s) => s.back);
  return (
    <ScreenFrame>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <ScreenHeader
          eyebrow={t('a11y.settings.options')}
          title={t('a11y.settings.settings')}
          right={
            <Button variant="secondary" onClick={back} sound="back">
              <Icon name="back" size={16} /> {t('a11y.settings.back')}
            </Button>
          }
        />
        <Panel tone="solid" className="mt-4 p-5">
          <SettingsPanel />
        </Panel>
      </div>
    </ScreenFrame>
  );
}
