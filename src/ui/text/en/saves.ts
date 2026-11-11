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
  'saves.export.copyRefused':
    'This page isn’t allowed to copy here. Select the code above and copy it by hand.',
  // After a download is asked for: a blocked download gives the page no sign, so this says it first.
  'saves.export.fileAsked':
    'If no file appeared, your browser or the frame this page is in may have blocked the download. “Show save code” gives the same save as text.',
  'saves.export.fileAskedNoCode':
    'If no file appeared, your browser or the frame this page is in may have blocked the download.',
  'saves.export.fileFailed':
    'The download failed, so no file was made. “Show save code” gives the same save as text.',
  'saves.export.fileFailedNoCode': 'The download failed, so no file was made.',

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
  'saves.import.warningKept':
    'Importing replaces this browser’s profile and any run in progress. The saves from before your earlier import stay kept instead, so the ones you have now aren’t: export them first if you may want them.',
  'saves.import.confirm': 'Import, replacing my saves',
  'saves.import.cancel': 'Cancel',
  'saves.import.done': 'Imported. Starting again on the imported saves…',
  'saves.import.inFight': 'Saves can be imported from the Settings screen, outside a fight.',

  // Restore what an import replaced.
  'saves.restore.offer':
    'Your saves from before you imported are kept until you put them back or forget them. Importing again keeps these, not the saves you have then.',
  'saves.restore.button': 'Put them back…',
  'saves.restore.question':
    'Put back the saves from before the import? The profile, run and settings you have now are replaced by them.',
  'saves.restore.confirm': 'Put them back',
  'saves.restore.keep': 'Keep these',
  'saves.restore.failed': 'This browser’s storage refused the change. Nothing was changed.',
  'saves.restore.forget': 'Forget them…',
  'saves.restore.forgetQuestion':
    'Forget the saves from before the import for good? The next import keeps the saves you have then.',
  'saves.restore.forgetConfirm': 'Forget them',

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
  'saves.kept.latest': '(a later one, kept beside the first)',
  'saves.kept.download': 'Download it',
  'saves.kept.downloadAsked':
    'If no file appeared, your browser or the frame this page is in may have blocked the download. The save stays kept until you forget it, so you can try again where downloads are allowed.',
  'saves.kept.downloadFailed':
    'The download failed, so no file was made. The save stays kept until you forget it.',
  'saves.kept.forget': 'Forget it…',
  'saves.kept.forgetQuestion': 'Forget this save for good? Download it first if you may want it.',
  'saves.kept.forgetConfirm': 'Forget it',
  'saves.kept.keep': 'Keep it',
  'saves.notice.title': 'A save couldn’t be loaded',
  'saves.notice.body':
    'It’s kept as it was. The first save that couldn’t be loaded stays until you forget it; if another can’t be loaded later, the latest is kept beside it. You can download it here, or later from Settings → Progress.',
  'saves.notice.ok': 'OK',
} satisfies Catalogue;
