// iOS ringer switch — the reason a drone can be "playing" and silent.
//
// By default iOS Safari treats Web Audio as *ambient* sound, so flicking the
// physical Silent switch mutes the drone and the metronome with nothing on
// screen to explain it. Safari 16.4+ exposes `navigator.audioSession`; setting
// its type to 'playback' declares this app as media, and the switch stops
// muting us. While the tuner holds the microphone we need 'play-and-record'
// instead — like 'playback' it ignores the ringer switch, but it also keeps
// capture working.
//
// Everything here is a no-op where `navigator.audioSession` is missing (every
// browser but recent Safari). There is no fallback: no browser exposes the
// system volume or the ringer switch to a page, which is why the audibility
// banner (audibility.ts) has to work from what the app itself can observe.

type AudioSessionType =
  | 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'

interface AudioSessionLike { type: AudioSessionType }

function audioSession(): AudioSessionLike | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession ?? null
}

/** True where iOS lets us opt out of the ringer switch. */
export function isAudioSessionSupported(): boolean {
  return audioSession() !== null
}

let micHolders = 0

function apply(): void {
  const session = audioSession()
  if (!session) return
  try {
    session.type = micHolders > 0 ? 'play-and-record' : 'playback'
  } catch {
    // Some engines reject the assignment mid-interruption; the previous
    // category stays in force and playback still works, just ringer-muted.
  }
}

/** Declare this app as media playback. Safe to call repeatedly. */
export function configureAudioSession(): void {
  apply()
}

/** Called around getUserMedia: capture needs the play-and-record category. */
export function acquireMicSession(): void {
  micHolders += 1
  apply()
}

export function releaseMicSession(): void {
  micHolders = Math.max(0, micHolders - 1)
  apply()
}
