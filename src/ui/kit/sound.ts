import { useEffect } from 'react';
import { getAudio, type AudioMood, type UiSound } from '../../audio';

/** UI sounds never throw: audio is garnish (it can be missing, locked or muted). */
export function playUi(sound: UiSound): void {
  try {
    getAudio().playUi(sound);
  } catch {
    // No audio context: silence is fine.
  }
}

/** Unlocks audio from a user gesture (browsers require one). Cheap to call repeatedly. */
export function unlockAudio(): void {
  try {
    const audio = getAudio();
    if (!audio.unlocked) void audio.unlock();
  } catch {
    // Same as above.
  }
}

/** Sets the music mood while a screen is mounted (non-combat screens only). */
export function useMood(mood: AudioMood): void {
  useEffect(() => {
    try {
      getAudio().setMood(mood);
    } catch {
      // Silent.
    }
  }, [mood]);
}
