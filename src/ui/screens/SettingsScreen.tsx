import type { ReactNode } from 'react';
import { getAudio } from '../../audio';
import { useSettings, type Settings } from '../../app/settings';
import { resetHints } from '../hud/hints';
import { bindingLabel } from '../hud/labels';
import { Button } from '../kit/Button';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Panel } from '../kit/Panel';
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
        <Toggle
          label="Screen flashes"
          hint="Full-screen flashes on Perfect, Save and Crescendo."
          checked={settings.flashes > 0}
          onChange={(v) => update((d) => ({ ...d, flashes: v ? 1 : 0 }))}
        />
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
      <Section title="Controls">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
          {controlRows().map(([keys, what]) => (
            <div key={what} className="contents">
              <dt className="flex gap-1">
                {keys.map((k) => (
                  <KeyCap key={k} label={k} />
                ))}
              </dt>
              <dd className="text-muted">{what}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <div className={compact ? '' : 'lg:col-span-2'}>
        <Button variant="ghost" size="sm" onClick={reset}>
          Restore defaults
        </Button>
      </div>
    </div>
  );
}

function controlRows(): [string[], string][] {
  return [
    [
      (['moveUp', 'moveLeft', 'moveDown', 'moveRight'] as const).map(bindingLabel),
      'Move the Weaver',
    ],
    [['1', '2', '3', 'LMB'], 'Thread a hero (click a frame or a hero)'],
    [['RMB'], 'Switch the Thread: Mend ⇄ Empower'],
    [[bindingLabel('ward')], 'Ward (the hovered or threaded hero)'],
    [[bindingLabel('chime')], 'Chime (cleanse at your cursor)'],
    [[bindingLabel('reel')], 'Reel (pull the hero to you)'],
    [[bindingLabel('glide')], 'Glide (dash)'],
    [[bindingLabel('cue'), '⇧1–4'], 'Cue a hero’s Solo'],
    [[bindingLabel('crescendo')], 'Crescendo'],
    [
      [
        bindingLabel('directiveRally'),
        bindingLabel('directiveHold'),
        bindingLabel('directiveScatter'),
      ],
      'Rally · Hold · Scatter',
    ],
    [[bindingLabel('directiveFocus'), 'MMB'], 'Focus the enemy under the cursor'],
    [[bindingLabel('pause')], 'Pause'],
  ];
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
