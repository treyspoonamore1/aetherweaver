import type { Catalogue } from '../../catalogue';

/** The `hud.finaleLook.*` messages: `src/ui/hud/finaleLook.ts`. */
export const finaleLook = {
  'hud.finaleLook.crescendoCancels': '{head} · Crescendo cancels {FORTISSIMO_NAME}',
  'hud.finaleLook.inS': '{FORTISSIMO_NAME} in ~{s} s',
  'hud.finaleLook.pulseOf': '{FORTISSIMO_NAME} · pulse {pulse} of {of}',
  'hud.finaleLook.grandSilenceNotes': 'Grand Silence · {notes}/{of} notes',
  'hud.finaleLook.theCodaInS': 'The Coda in {max} s',
  'hud.finaleLook.eightNotesWakeThem': 'Eight notes wake them: {noteSources}',
  'hud.finaleLook.perfectWardsClutchChimes':
    'Perfect Wards, Clutch Chimes and a Rewind that undoes a blow',
  'hud.finaleLook.perfectWardsAndClutch': 'Perfect Wards and Clutch Chimes',
  'hud.finaleLook.perfectWardsClutchChimes2':
    'Perfect Wards, Clutch Chimes and Reel-saves (Swap takes the blow on you)',
  'hud.finaleLook.perfectWardsClutchChimes3': 'Perfect Wards, Clutch Chimes and Reel-saves',
  'hud.finaleLook.cue': 'Cue · {voiceName}: {solo}{value}',
  'hud.finaleLook.relitTheSongReturns': 'Relit · the song returns',
  'hud.finaleLook.risenTheSongBrought': 'Risen · the song brought them back',
  'hud.finaleLook.theCodaInSeconds': '; the Coda in {max} seconds',
  'hud.finaleLook.isStilledByThe':
    '{name} is stilled by the Grand Silence and waits for your song: {notes} of {of} notes{coda}',
  'hud.finaleLook.again': '{names} {value} again',
  'hud.finaleLook.theCodaYourHeroes': 'The Coda — your heroes wake without the song',
  'hud.finaleLook.notes': '{notes}/{NOTES_NEEDED} notes',
  'hud.finaleLook.cancelled': '{FORTISSIMO_NAME} — cancelled',
  'hud.finaleLook.theMusicStops': 'The music stops',
  'hud.finaleLook.noteOf': 'Note {n} of {of} · {label}',
  'hud.finaleLook.discordRises': 'Discord rises',
  'hud.finaleLook.theSongReturns': 'The song returns',
  'hud.finaleLook.tallAndRobedIn':
    'Tall and robed in a Weaver’s ribbons gone ash-grey, it carries a baton and a stilled halo of five stave lines. It was the first Weaver.',
  'hud.finaleLook.stands': 'stands',
  'hud.finaleLook.stand': 'stand',
  'hud.finaleLook.fortissimoName': 'Fortissimo Silence',
  'hud.finaleLook.discordLabel': 'Conductor’s Discord',
  'hud.finaleLook.discordHead': '{label} {value}/{max}',
  'hud.finaleLook.fortissimoNow': '{FORTISSIMO_NAME} now',
  'hud.finaleLook.cueAnswer': 'interrupt the soloist, or answer its Solo',
  'hud.finaleLook.stilledLine': 'Stilled · waits for your song',
  'hud.finaleLook.downedSongLine': 'The song will bring them back',
  'hud.finaleLook.finaleDefeatLine': 'The Conductor’s silence holds.',
  'hud.finaleLook.defeatLine': 'The song falls silent…',
} satisfies Catalogue;
