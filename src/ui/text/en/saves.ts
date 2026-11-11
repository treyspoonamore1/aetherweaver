import type { Catalogue } from '../catalogue';

/**
 * The English catalogue's `saves.*` keys (docs/phase-7.md, *Contracts*): W5's file, the Saves
 * panel in Settings → Progress and the notice for a save that wouldn't load
 * (`src/ui/screens/SavesPanel.tsx`). Every key here starts with `saves.`
 * (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const saves = {
  'saves.title': 'Saves',
  'saves.intro':
    'Take your profile, your settings and any run in progress to another browser, or keep a copy: as a file, or as a code to paste.',

  // What a save holds.
  'saves.holds.rank': 'Weaver Rank {rank}',
  'saves.holds.record': '{runs} {runsWord}, {wins} won',
  'saves.holds.run': 'run',
  'saves.holds.runs': 'runs',
  'saves.holds.runInProgress': 'A run in progress: Movement {movement} of {movements}',
  'saves.holds.weekly': 'A weekly run in progress: Movement {movement} of {movements}',
  'saves.holds.echo': 'An Echo’s run in progress: Movement {movement} of {movements}',
  'saves.holds.noRun': 'No run in progress',
  'saves.holds.settings': 'Its settings',
  'saves.holds.noSettings': 'No settings',
  'saves.holds.runDropped':
    'Its run in progress can’t be continued in this version of the game, so it isn’t imported.',
  'saves.holds.settingsDropped':
    'Its settings can’t be read by this version of the game, so they aren’t imported.',

  // Export.
  'saves.export.heading': 'Export',
  'saves.export.file': 'Download save file',
  'saves.export.code': 'Show save code',
  'saves.export.codeLabel': 'Your save code',
  'saves.export.copy': 'Copy code',
  'saves.export.copied': 'Copied.',
  'saves.export.noCode': 'This browser can’t make save codes. The save file works.',

  // Import.
  'saves.import.heading': 'Import',
  'saves.import.file': 'Open a save file…',
  'saves.import.codeLabel': 'Or paste a save code',
  'saves.import.read': 'Read code',
  'saves.import.reading': 'Reading…',
  'saves.import.preview': 'This save holds:',
  'saves.import.withSettings': 'Also import its settings',
  'saves.import.warning':
    'Importing replaces this browser’s profile and any run in progress. They’re kept first, and you can put them back from here.',
  'saves.import.confirm': 'Import, replacing my saves',
  'saves.import.cancel': 'Cancel',
  'saves.import.done': 'Imported. Starting again on the imported saves…',
  'saves.import.inFight': 'Saves can be imported from the Settings screen, outside a fight.',

  // Restore what an import replaced.
  'saves.restore.offer': 'Your saves from before the last import are kept.',
  'saves.restore.button': 'Put them back…',
  'saves.restore.question':
    'Put back the saves from before the import? The profile, run and settings you have now are replaced by them.',
  'saves.restore.confirm': 'Put them back',
  'saves.restore.keep': 'Keep these',
  'saves.restore.failed': 'This browser’s storage refused the change. Nothing was changed.',

  // Why a file or code is refused.
  'saves.error.notSave': 'This isn’t an Aetherweaver save, so nothing was imported.',
  'saves.error.newer':
    'This save was made by a newer version of the game, which this one can’t read. Nothing was imported.',
  'saves.error.tooLarge': 'This is far larger than any save can be, so it wasn’t read.',
  'saves.error.saveTooLarge':
    'A save in this file is far longer than any save can be, so nothing was imported.',
  'saves.error.typo':
    'This code has a typo, or it was cut short: its check value doesn’t match. Nothing was imported.',
  'saves.error.damaged': 'This save is damaged: its compressed data doesn’t open.',
  'saves.error.empty': 'This save holds nothing to import.',
  'saves.error.profile':
    'The profile in this save can’t be read by this version of the game. Nothing was imported.',
  'saves.error.run':
    'This save holds only a run, which can’t be continued in this version of the game. Nothing was imported.',
  'saves.error.unsupported': 'This browser can’t open compressed saves. Try the save file instead.',
  'saves.error.storage':
    'This browser’s storage refused the import (it may be full). Nothing was changed.',

  // A save that wouldn't load (kept raw).
  'saves.kept.heading': 'A save that couldn’t be loaded',
  'saves.kept.profile':
    'Your profile couldn’t be loaded, so a new one started. The old one is kept here, as it was.',
  'saves.kept.run':
    'Your run in progress couldn’t be loaded, so it was set aside. It’s kept here, as it was.',
  'saves.kept.backup': '(its backup copy)',
  'saves.kept.download': 'Download it',
  'saves.kept.forget': 'Forget it…',
  'saves.kept.forgetQuestion': 'Forget this save for good? Download it first if you may want it.',
  'saves.kept.forgetConfirm': 'Forget it',
  'saves.kept.keep': 'Keep it',
  'saves.notice.title': 'A save couldn’t be loaded',
  'saves.notice.body':
    'It’s kept as it was, and nothing will overwrite it. You can download it here, or later from Settings → Progress.',
  'saves.notice.ok': 'OK',
} satisfies Catalogue;
