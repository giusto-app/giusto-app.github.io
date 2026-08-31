import { useReducer } from 'react'
import { resumeAudioContext } from '../audio/audioContext'
import { isAudioSessionSupported } from '../audio/audioSession'
import { type AudibilityIssue } from '../audio/audibility'
import { useAudibility } from '../hooks/useAudibility'

// Dismissals live outside React so a tab switch or a re-render doesn't bring a
// banner the user already waved off back to the top of the screen. They are
// per issue kind and last the session: dismissing "your volume is at zero"
// says nothing about a later interruption.
const dismissed = new Set<AudibilityIssue>()

interface Copy {
  title: string
  body: string
  action?: string
}

// iOS only mutes Web Audio from the ringer switch on Safari too old for
// navigator.audioSession — where we have it, audioSession.ts has already opted
// out of the switch and pointing at it would send the user chasing nothing.
const RINGER_HINT = ' On iPhone or iPad, check the side Silent switch too.'

function copyFor(issue: AudibilityIssue): Copy {
  switch (issue) {
    case 'blocked':
      return {
        title: 'Sound is switched off',
        body: 'Your browser is holding Giusto’s audio until you tap.',
        action: 'Turn sound on',
      }
    case 'interrupted':
      return {
        title: 'Audio was interrupted',
        body: 'A call or another app took over the sound. Tap to take it back.',
        action: 'Resume sound',
      }
    case 'silent':
      return {
        title: 'You won’t hear this',
        body:
          'Giusto is playing, but no sound is leaving the app. A volume slider is probably at zero —' +
          ' check the drone, backing and metronome levels, then your device volume.' +
          (isAudioSessionSupported() ? '' : RINGER_HINT),
      }
  }
}

export default function SoundAlertBanner() {
  const issue = useAudibility()
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  // A new kind of problem earns a fresh look, even if the last one was waved off.
  if (issue === null || dismissed.has(issue)) return null

  const { title, body, action } = copyFor(issue)

  const dismiss = () => {
    dismissed.add(issue)
    rerender()
  }

  return (
    <div
      id="sound-alert-banner"
      role="status"
      aria-live="polite"
      className="shrink-0 px-4 pt-3 md:px-10"
    >
      <div className="neu-surface rounded-2xl px-4 py-3 flex items-start gap-3 border-l-4 border-amber-400">
        <SpeakerOffIcon />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[color:var(--neu-fg)]">{title}</p>
          <p className="text-xs text-[color:var(--neu-fg2)] leading-relaxed mt-0.5">{body}</p>

          {action && (
            <button
              onClick={() => { void resumeAudioContext() }}
              className="mt-2 px-4 py-1.5 neu-btn rounded-full text-xs font-semibold text-[color:var(--neu-fg)]"
            >
              {action}
            </button>
          )}
        </div>

        <button
          onClick={dismiss}
          aria-label="Dismiss sound warning"
          className="shrink-0 w-7 h-7 rounded-full neu-btn flex items-center justify-center text-[color:var(--neu-fg2)]"
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function SpeakerOffIcon() {
  return (
    <svg
      className="shrink-0 mt-0.5 text-amber-400"
      width={20} height={20} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  )
}
