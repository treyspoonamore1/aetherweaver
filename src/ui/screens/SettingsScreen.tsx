import { useId, useState, type ReactNode } from 'react';
import { useProfile } from '../../app/profileStore';
import { getAudio } from '../../audio';
import { useSettings, type Settings } from '../../app/settings';
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
import { rankPanel } from './rankText';
import { ControlsSettings } from './ControlsSettings';
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

/** All settings controls (used by the Settings screen and the pause menu). */
export function SettingsPanel({ compact = false }: { compact?: boolean }) {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const reset = useSettings((s) => s.reset);

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
        <p className="-mt-2 text-xs text-muted">
          Full-screen flashes on Perfect, Save and Crescendo. 0 turns them off.
        </p>
        <Toggle
          label="Damage numbers"
          hint="Floating numbers over heroes and enemies."
          checked={settings.damageNumbers}
          onChange={(v) => update((d) => ({ ...d, damageNumbers: v }))}
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
        <Toggle
          label="Hero autonomy"
          hint="Heroes fire their own Solos when charged."
          checked={settings.assists.autonomy}
          onChange={(v) => setAssist('autonomy', v)}
        />
        <p className="text-xs text-muted">
          Assists never block anything. They show as a small badge on the run summary.
        </p>
      </Section>
      <Section title="Accessibility">
        <AccessibilitySettings />
      </Section>
      <Section title="Progress">
        <ProgressSettings />
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
            Back to Rank 1? Your Weaver XP, Deeds, Astrolabe, runs and wins are cleared and
            everything locks again. Settings and a run in progress stay.
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

/** Settings from the Title (or anywhere that routes `screen = 'settings'`). */
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
