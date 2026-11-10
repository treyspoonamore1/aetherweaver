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
      <Section title="Sound">
        <Slider
          label="Master"
          value={settings.volumes.master}
          onChange={(v) => setVolume('master', v)}
        />
        <Slider
          label="Music"
          value={settings.volumes.music}
          onChange={(v) => setVolume('music', v)}
        />
        <Slider
          label="Effects"
          value={settings.volumes.sfx}
          onChange={(v) => setVolume('sfx', v)}
        />
        <Slider
          label="Interface"
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
      <Section title="Comfort">
        <Slider
          label="Screen shake"
          value={settings.screenShake}
          onChange={(v) => update((d) => ({ ...d, screenShake: v }))}
        />
        <Slider
          label="Screen flashes"
          value={settings.flashes}
          onChange={(v) => update((d) => ({ ...d, flashes: v }))}
          format={(v) => (v <= 0 ? 'Off' : `${Math.round(v * 100)}%`)}
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
          label="Damage numbers"
          hint="Floating numbers over heroes and enemies."
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
          label="Captions"
          hint="Key sounds in words: when the music stops, each note you play, Discord rising."
          checked={settings.captions}
          onChange={(v) => update((d) => ({ ...d, captions: v }))}
        />
        <Toggle
          label="Coach hints"
          hint="Short tips during the first fights; each shows at most three times."
          checked={settings.hints}
          onChange={(v) => update((d) => ({ ...d, hints: v }))}
        />
        <div>
          <Button size="sm" onClick={resetHints}>
            Show all hints again
          </Button>
        </div>
      </Section>
      <Section title="Assists">
        <Segmented
          label="Perfect Ward window"
          hint="Extra time to land a Perfect Ward."
          value={settings.assists.perfectWindowBonus}
          options={[
            { value: 0, label: 'Standard' },
            { value: 0.1, label: '+0.1 s' },
            { value: 0.2, label: '+0.2 s' },
          ]}
          onChange={(v) => setAssist('perfectWindowBonus', v)}
        />
        <Segmented
          label="Telegraph lead"
          hint="Enemy attacks wind up for longer."
          value={settings.assists.telegraphLead}
          options={[
            { value: 1, label: 'Standard' },
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
          label="Hero autonomy"
          hint="Heroes fire their own Solos a moment after they charge, unless you Cue them first. Kael saves his wall for a big hit, but never for more than 3 seconds."
          checked={settings.assists.autonomy}
          onChange={(v) => setAssist('autonomy', v)}
        />
        <p className="text-xs text-muted">
          Assists never block anything. They show as a small badge on the run summary.
        </p>
        {context && (
          <p className="text-xs text-gold-200" data-testid="assists-when">
            {context === 'run'
              ? 'Assist changes apply from your next fight.'
              : 'Assist changes restart the Training Grounds when you resume.'}
          </p>
        )}
      </Section>
      <Section title={t('a11y.telegraphs.title')}>
        <TelegraphSettingsRows />
      </Section>
      <Section title="Health and the HUD">
        <HudSettings />
      </Section>
      <Section title="Accessibility">
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
      <Section title="Progress">
        <ProgressSettings />
        {/* Export, import and kept saves (docs/phase-7.md, W5): nothing until W5 fills it. */}
        <SavesPanel />
        {/* The playtest demo (docs/demo.md): back to its first choice, from the Settings screen. */}
        {DEMO && !compact && <DemoOver />}
      </Section>
      <div className={compact ? '' : 'lg:col-span-2'}>
        <Section title="Controls">
          <ControlsSettings compact={compact} />
        </Section>
      </div>
      <div className={compact ? '' : 'lg:col-span-2'}>
        <Button variant="ghost" size="sm" onClick={reset}>
          Restore defaults
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
        label="Bars over the heroes"
        hint="Their life over their heads, coloured by how much is left."
        value={hud.allyBars}
        options={[
          { value: 'always', label: 'Always' },
          { value: 'hurt', label: 'When hurt' },
          { value: 'off', label: 'Off' },
        ]}
        onChange={(v) => set({ allyBars: v })}
      />
      <Segmented
        label="Party frames show"
        hint="The big number on each frame."
        value={hud.healthText}
        options={[
          { value: 'missing', label: 'Life missing' },
          { value: 'percent', label: 'Percent' },
          { value: 'current', label: 'Life left' },
        ]}
        onChange={(v) => set({ healthText: v })}
      />
      <Toggle
        label="Low-life sound"
        hint="A soft tone when a hero falls under a quarter of their life."
        checked={hud.lowHealthSound}
        onChange={(v) => set({ lowHealthSound: v })}
      />
      <Slider
        label="Party frame size"
        value={hud.frames.scale}
        min={0.75}
        max={1.5}
        step={0.05}
        onChange={(v) => frames({ scale: v })}
      />
      <Segmented
        label="Party frames"
        value={hud.frames.orientation}
        options={[
          { value: 'vertical', label: 'Stacked' },
          { value: 'horizontal', label: 'Side by side' },
        ]}
        onChange={(v) => frames({ orientation: v })}
      />
      <Slider
        label="Weaver bar size"
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
          Reset positions
        </Button>
        <p className="min-w-0 flex-1 text-xs text-muted">
          Puts the party frames and the Weaver bar back. Move them anywhere in a fight: pause, then
          Edit HUD layout.
        </p>
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
        Weaver Rank <b className="text-gold-300">{p.rank}</b>
        <span className="ml-2 font-mono text-xs text-muted">
          {p.progressText} · {p.record}
        </span>
      </p>
      <Toggle
        label="Skip the unlocks"
        hint="Every song, aura, ornament and Calling from the start. You still earn XP and Rank."
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
            Back to Rank 1? Your Weaver XP, Deeds, Astrolabe, Reliquary (its relics and materials),
            Dissonance (its levels and records), runs and wins are cleared and everything locks
            again. Settings and a run in progress stay.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => setConfirm(false)} sound="back" autoFocus>
              Keep my progress
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
              Reset to Rank 1
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>
            Reset progress…
          </Button>
          {done && (
            <span className="text-xs text-muted" role="status">
              Progress reset: you’re Rank 1 again.
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
          <Icon name="reroll" size={14} /> Start the demo over…
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
        Back to the demo’s first choice? You’ll choose again how to start, fresh or as a veteran,
        and that replaces this Weaver’s progress and any run in progress. Settings stay.
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={() => setConfirm(false)} sound="back" autoFocus>
          Keep playing
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
          Start over
        </Button>
      </div>
    </div>
  );
}

const SWATCHES: { key: keyof VisionPalette; label: string; icon: IconName }[] = [
  { key: 'heal', label: 'Life', icon: 'mend' },
  { key: 'threat', label: 'Threat', icon: 'sparkle' },
  { key: 'lethal', label: 'Lethal', icon: 'skull' },
  { key: 'empower', label: 'Empower', icon: 'empower' },
  { key: 'call', label: 'Call', icon: 'note' },
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
          Colour vision
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
      <ul
        className="flex flex-wrap gap-1.5"
        aria-label="How the danger, life and call colours look with this palette"
      >
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
      <p className="-mt-1.5 text-xs text-muted">
        Danger, life and calls get colours that stay apart for this kind of colour vision. Every
        colour also has a glyph.
      </p>
      <Slider
        label="Interface size"
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
          eyebrow="Options"
          title="Settings"
          right={
            <Button variant="secondary" onClick={back} sound="back">
              <Icon name="back" size={16} /> Back
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
