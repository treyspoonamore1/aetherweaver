/**
 * Saves (docs/phase-7.md, decision 11 and W5): export and import of the profile, the settings and
 * any run in progress, and the notice for a save that wouldn't load. It sits in Settings → Progress
 * (`SettingsScreen.tsx`, after the progress panel), and in the pause menu's settings, where only
 * export is offered (an import replaces the run being played).
 *
 * The work is `src/app/saveTransfer.ts`'s; every string is `saves.*` (`src/ui/text/en/saves.ts`).
 */
import { useEffect, useId, useRef, useState } from 'react';
import {
  applyImport,
  canRestoreImport,
  compressionAvailable,
  downloadFile,
  exportSave,
  forgetKept,
  forgetRestoreImport,
  keptDownload,
  keptFileName,
  keptNoticeDue,
  keptSaves,
  markKeptNoticed,
  previewImport,
  readSaveBytes,
  readSaveCode,
  reloadAfterImport,
  restoreImport,
  saveCodeOf,
  saveFileBytes,
  type KeptSave,
} from '../../app/saveTransfer';
import {
  SAVE_FILE_MAX_BYTES,
  SAVE_FILE_NAME,
  type SaveError,
  type SavePreview,
  type SaveRead,
} from '../../meta/saveFile';
import { Button } from '../kit/Button';
import { useUi } from '../store';
import { num, plural, t, type TextKey } from '../text';

/** The words for why a file or code was refused. */
export function saveErrorText(error: SaveError): string {
  return t(`saves.error.${error}` as TextKey);
}

/** What a save holds, a line each: Rank, record, the run in progress, the settings, what's left out. */
export function holdsLines(preview: SavePreview): string[] {
  const lines = [
    t('saves.holds.rank', { rank: num(preview.rank) }),
    t('saves.holds.record', {
      runs: num(preview.runs),
      runsWord: plural(preview.runs, t('saves.holds.run'), t('saves.holds.runs')),
      wins: num(preview.wins),
    }),
  ];
  const run = preview.run;
  if (run) {
    const key = run.weekly
      ? 'saves.holds.weekly'
      : run.echo
        ? 'saves.holds.echo'
        : 'saves.holds.runInProgress';
    lines.push(t(key, { movement: num(run.movement), movements: num(run.movements) }));
  } else if (!preview.runDropped) lines.push(t('saves.holds.noRun'));
  if (preview.runDropped) lines.push(t('saves.holds.runDropped'));
  lines.push(t(preview.settingsText !== null ? 'saves.holds.settings' : 'saves.holds.noSettings'));
  if (preview.settingsDropped) lines.push(t('saves.holds.settingsDropped'));
  return lines;
}

function copyText(text: string): boolean {
  try {
    void navigator.clipboard?.writeText(text).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Export, import, the saves from before an import, and kept unreadable saves. */
export function SavesPanel() {
  const screen = useUi((s) => s.screen);
  // An import replaces the run being played: from a fight's pause menu (the run's or the
  // Training Grounds' screen), export only.
  return <SavesPanelView canImport={screen !== 'run' && screen !== 'training'} />;
}

/** The panel, with import offered or not. */
export function SavesPanelView({ canImport }: { canImport: boolean }) {
  return (
    <div className="flex flex-col gap-3 border-t border-ink-600/60 pt-3" data-testid="saves-panel">
      <h3 className="text-sm font-semibold text-text">{t('saves.title')}</h3>
      <p className="text-xs text-muted">{t('saves.intro')}</p>
      <KeptSaves />
      <ExportSaves />
      {canImport ? (
        <>
          <ImportSaves />
          <RestoreImport />
        </>
      ) : (
        <p className="text-xs text-muted">{t('saves.import.inFight')}</p>
      )}
    </div>
  );
}

function ExportSaves() {
  const [code, setCode] = useState<string | null>(null);
  const [noCode, setNoCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gold-200">
        {t('saves.export.heading')}
      </h4>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          data-testid="saves-export-file"
          onClick={() =>
            downloadFile(SAVE_FILE_NAME, saveFileBytes(exportSave()), 'application/json')
          }
        >
          {t('saves.export.file')}
        </Button>
        <Button
          size="sm"
          data-testid="saves-export-code"
          disabled={!compressionAvailable()}
          onClick={() => {
            setCopied(false);
            void saveCodeOf(exportSave()).then((c) => {
              setCode(c);
              setNoCode(c === null);
            });
          }}
        >
          {t('saves.export.code')}
        </Button>
      </div>
      {(noCode || !compressionAvailable()) && (
        <p className="text-xs text-muted">{t('saves.export.noCode')}</p>
      )}
      {code !== null && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-xs text-muted">
            {t('saves.export.codeLabel')}
          </label>
          <textarea
            id={id}
            readOnly
            value={code}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-y break-all rounded-lg border border-ink-500 bg-ink-950 p-2 font-mono text-xs text-text"
            data-testid="saves-code-out"
          />
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={() => setCopied(copyText(code))}>
              {t('saves.export.copy')}
            </Button>
            {copied && (
              <span className="text-xs text-muted" role="status">
                {t('saves.export.copied')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type Reading = { kind: 'idle' } | { kind: 'reading' } | { kind: 'error'; error: SaveError };

function ImportSaves() {
  const fileRef = useRef<HTMLInputElement>(null);
  const codeId = useId();
  const [codeText, setCodeText] = useState('');
  const [reading, setReading] = useState<Reading>({ kind: 'idle' });
  const [preview, setPreview] = useState<SavePreview | null>(null);
  const [withSettings, setWithSettings] = useState(false);
  const [done, setDone] = useState(false);
  // Whether an earlier import's copy is kept, as it was when this file was read: the import itself
  // makes a copy, which must not change the warning shown while it applies.
  const [earlierKept, setEarlierKept] = useState(false);

  const took = (read: SaveRead) => {
    if (!read.ok) {
      setReading({ kind: 'error', error: read.error });
      return;
    }
    const judged = previewImport(read.file);
    if (!judged.ok) {
      setReading({ kind: 'error', error: judged.error });
      return;
    }
    setReading({ kind: 'idle' });
    setWithSettings(false);
    setEarlierKept(canRestoreImport());
    setPreview(judged.preview);
  };
  const start = () => {
    setPreview(null);
    setReading({ kind: 'reading' });
  };

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gold-200">
        {t('saves.import.heading')}
      </h4>
      <div>
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          {t('saves.import.file')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.gz,application/json,application/gzip"
          className="sr-only"
          tabIndex={-1}
          data-testid="saves-import-file"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (!file) return;
            start();
            // A file larger than any save is refused before it is read.
            if (file.size > SAVE_FILE_MAX_BYTES) {
              setReading({ kind: 'error', error: 'tooLarge' });
              return;
            }
            void file
              .arrayBuffer()
              .then(readSaveBytes)
              .then(took, () => setReading({ kind: 'error', error: 'notSave' }));
          }}
        />
      </div>
      <label htmlFor={codeId} className="text-xs text-muted">
        {t('saves.import.codeLabel')}
      </label>
      <textarea
        id={codeId}
        value={codeText}
        rows={2}
        spellCheck={false}
        onChange={(e) => setCodeText(e.currentTarget.value)}
        className="w-full resize-y break-all rounded-lg border border-ink-500 bg-ink-950 p-2 font-mono text-xs text-text"
        data-testid="saves-code-in"
      />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          data-testid="saves-read-code"
          disabled={codeText.trim() === '' || reading.kind === 'reading'}
          onClick={() => {
            start();
            void readSaveCode(codeText).then(took, () =>
              setReading({ kind: 'error', error: 'notSave' }),
            );
          }}
        >
          {t('saves.import.read')}
        </Button>
        {reading.kind === 'reading' && (
          <span className="text-xs text-muted" role="status">
            {t('saves.import.reading')}
          </span>
        )}
      </div>
      {reading.kind === 'error' && (
        <p className="text-xs text-rose-200" role="alert" data-testid="saves-error">
          {saveErrorText(reading.error)}
        </p>
      )}
      {preview && (
        <div
          className="rounded-lg border border-gold-500/60 bg-gold-400/10 p-3"
          role="alertdialog"
          aria-labelledby="saves-preview-q"
          data-testid="saves-preview"
        >
          <p id="saves-preview-q" className="text-sm text-gold-100">
            {t('saves.import.preview')}
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-text">
            {holdsLines(preview).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {preview.settingsText !== null && (
            <label className="mt-2 flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={withSettings}
                onChange={(e) => setWithSettings(e.currentTarget.checked)}
                data-testid="saves-with-settings"
              />
              {t('saves.import.withSettings')}
            </label>
          )}
          <p className="mt-2 text-xs text-muted" data-testid="saves-import-warning">
            {t(earlierKept ? 'saves.import.warningKept' : 'saves.import.warning')}
          </p>
          {done ? (
            <p className="mt-2 text-xs text-gold-200" role="status">
              {t('saves.import.done')}
            </p>
          ) : (
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => setPreview(null)} sound="back" autoFocus>
                {t('saves.import.cancel')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                data-testid="saves-import-confirm"
                onClick={() => {
                  const result = applyImport(preview, withSettings);
                  if (!result.ok) {
                    setPreview(null);
                    setReading({ kind: 'error', error: result.error });
                    return;
                  }
                  setDone(true);
                  reloadAfterImport();
                }}
              >
                {t('saves.import.confirm')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The saves from before the last import, offered back. */
function RestoreImport() {
  const [can, setCan] = useState(() => canRestoreImport());
  const [confirm, setConfirm] = useState<'restore' | 'forget' | null>(null);
  const [failed, setFailed] = useState(false);
  if (!can) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="saves-restore">
      <p className="text-xs text-muted">{t('saves.restore.offer')}</p>
      {confirm === 'restore' ? (
        <div className="rounded-lg border border-lethal/60 bg-lethal/10 p-3" role="alertdialog">
          <p className="text-sm text-rose-100">{t('saves.restore.question')}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => setConfirm(null)} sound="back" autoFocus>
              {t('saves.restore.keep')}
            </Button>
            <Button
              size="sm"
              variant="danger"
              data-testid="saves-restore-confirm"
              onClick={() => {
                if (restoreImport()) reloadAfterImport();
                else {
                  setConfirm(null);
                  setFailed(true);
                }
              }}
            >
              {t('saves.restore.confirm')}
            </Button>
          </div>
        </div>
      ) : confirm === 'forget' ? (
        <div className="rounded-lg border border-lethal/60 bg-lethal/10 p-3" role="alertdialog">
          <p className="text-sm text-rose-100">{t('saves.restore.forgetQuestion')}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => setConfirm(null)} sound="back" autoFocus>
              {t('saves.restore.keep')}
            </Button>
            <Button
              size="sm"
              variant="danger"
              data-testid="saves-restore-forget-confirm"
              onClick={() => {
                setConfirm(null);
                if (forgetRestoreImport()) setCan(false);
                else setFailed(true);
              }}
            >
              {t('saves.restore.forgetConfirm')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            data-testid="saves-restore-button"
            onClick={() => setConfirm('restore')}
          >
            {t('saves.restore.button')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="saves-restore-forget"
            onClick={() => setConfirm('forget')}
          >
            {t('saves.restore.forget')}
          </Button>
        </div>
      )}
      {failed && (
        <p className="text-xs text-rose-200" role="alert">
          {t('saves.restore.failed')}
        </p>
      )}
    </div>
  );
}

function keptLine(kept: KeptSave): string {
  const text = t(kept.kind === 'profile' ? 'saves.kept.profile' : 'saves.kept.run');
  const parts = [text];
  if (kept.backup) parts.push(t('saves.kept.backup'));
  if (kept.latest) parts.push(t('saves.kept.latest'));
  return parts.join(' ');
}

function downloadKept(kept: KeptSave): void {
  downloadFile(keptFileName(kept), keptDownload(kept), 'application/json');
  markKeptNoticed();
}

/** Unreadable saves the game kept (raw), each to download or, after a confirm, forget. */
function KeptSaves() {
  const [kept, setKept] = useState(() => keptSaves());
  const [forgetting, setForgetting] = useState<string | null>(null);
  if (kept.length === 0) return null;
  return (
    <div
      className="rounded-lg border border-gold-500/60 bg-gold-400/10 p-3"
      data-testid="saves-kept"
    >
      <p className="text-sm font-semibold text-gold-100">{t('saves.kept.heading')}</p>
      <ul className="mt-1 flex flex-col gap-2">
        {kept.map((k) => (
          <li key={k.key} className="flex flex-col gap-1.5">
            <span className="text-sm text-text">{keptLine(k)}</span>
            {forgetting === k.key ? (
              <div className="flex flex-wrap items-center gap-2" role="alertdialog">
                <span className="text-xs text-rose-100">{t('saves.kept.forgetQuestion')}</span>
                <Button size="sm" onClick={() => setForgetting(null)} sound="back" autoFocus>
                  {t('saves.kept.keep')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    forgetKept(k.key);
                    setForgetting(null);
                    setKept(keptSaves());
                  }}
                >
                  {t('saves.kept.forgetConfirm')}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => downloadKept(k)} data-testid="saves-kept-download">
                  {t('saves.kept.download')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setForgetting(k.key)}>
                  {t('saves.kept.forget')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The one-time notice for a save that wouldn't load (docs/phase-7.md, W5): over any screen, once
 * for the saves kept now, with each offered for download. It needs a place over every screen
 * (`src/app/App.tsx`, beside `DeedToasts`), which is another stream's file.
 */
export function KeptSaveNotice() {
  const [kept, setKept] = useState<KeptSave[]>([]);
  // Read after the first render: the Title's own look for a saved run may be what kept one.
  useEffect(() => {
    if (keptNoticeDue()) setKept(keptSaves());
  }, []);
  if (kept.length === 0) return null;
  const close = () => {
    markKeptNoticed();
    setKept([]);
  };
  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-gold-500/60 bg-ink-900/95 p-4 shadow-lg"
      role="alertdialog"
      aria-labelledby="kept-notice-title"
      data-testid="saves-kept-notice"
    >
      <p id="kept-notice-title" className="font-display text-sm font-bold text-gold-300">
        {t('saves.notice.title')}
      </p>
      <ul className="mt-1 flex flex-col gap-1 text-sm text-text">
        {kept.map((k) => (
          <li key={k.key}>{keptLine(k)}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{t('saves.notice.body')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {kept.map((k) => (
          <Button key={k.key} size="sm" onClick={() => downloadKept(k)}>
            {t('saves.kept.download')}
            {k.backup ? ` ${t('saves.kept.backup')}` : ''}
            {k.latest ? ` ${t('saves.kept.latest')}` : ''}
          </Button>
        ))}
        <Button size="sm" variant="primary" onClick={close} autoFocus>
          {t('saves.notice.ok')}
        </Button>
      </div>
    </div>
  );
}
