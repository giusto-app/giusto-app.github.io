import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createSvgPlaybackBinding,
  parseSource,
  type MusicDocumentBlock,
  type ScoreLike,
  type SvgPlaybackBinding,
} from 'lilyjs'
import LilyScore from './LilyScore'
import ExercisePicker, { recordRecentExercise } from './ExercisePicker'
import {
  exerciseUrl,
  useExerciseCatalog,
  type ExerciseCatalogEntry,
} from '../../hooks/useExerciseCatalog'
import {
  playAlongExerciseIdFromHash,
  playAlongUrl,
} from './playAlongLinks'
import { resumeAudioContext } from '../../audio/audioContext'
import { PlaybackClock } from '../../audio/playbackClock'
import { playWoodblock } from '../../audio/woodblock'
import { ChordDrone, type ChordDroneSoundType } from '../../audio/chordDrone'
import { StringsInstrument } from '../../audio/stringsInstrument'
import { arpNotesInWindow, buildArpeggioSchedule, type ArpNote } from '../../audio/arpeggioSchedule'
import { buildChordBackingSchedule, chordBlocksInWindow, type ChordBlock } from '../../audio/chordBacking'
import {
  buildChordSchedule,
  chordSoundingAtBeat,
  chordsStartingInWindow,
  type ChordScheduleResult,
} from '../../audio/chordSchedule'
import {
  buildNoteSchedule,
  noteEventIdsAtBeat,
  type NotePlaybackEvent,
} from '../../audio/noteSchedule'
import { bpmAtElapsed, bpmForLoop, plannedSteps, rampFraction, type TempoPlan } from '../../audio/tempoPlan'
import { clicksInWindow } from '../../audio/meter'
import type { ConcertPitchHz } from '../../utils/concertPitch'

// Practice Playback: renders a LilyPond exercise with lilyJS and plays a
// woodblock metronome plus a drone that changes on every chord change.
// One PlaybackClock owns time; the metronome and the chord drone are both
// scheduled from its beat events, so they can never drift apart.

interface PracticePlaybackProps {
  /** The catalog entry to load (selection is owned by PracticeTab). */
  exercise: ExerciseCatalogEntry
  onSelectExercise: (entry: ExerciseCatalogEntry) => void
  concertPitch?: ConcertPitchHz
}

const DEFAULT_BPM = 80

function isScoreBlock(b: MusicDocumentBlock): b is { type: 'score'; score: ScoreLike } {
  return b.type === 'score' && 'score' in b
}

type BackingMode = 'off' | 'drone' | 'chords' | 'arpeggio'

const BACKING_MODES: Array<[BackingMode, string]> = [
  ['off', 'Off'], ['drone', 'Drone'], ['chords', 'Chords'], ['arpeggio', 'Arpeggio'],
]

// The play-along drone uses the sampled cello (steady, no wavy detune); the
// tuning-voice choice lives in the Drone tab. Chords/arpeggio use the strings.
const DRONE_SOUND: ChordDroneSoundType = 'cello'
// Fixed, tasteful arpeggio shape — no UI knobs.
const ARP_CONFIG = { pattern: 'up', rhythm: 'eighth', octaves: 1 } as const

/** A labeled row of mutually-exclusive pill buttons. */
function SegRow<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: Array<[T, string]>
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-gray-500">{label}</span>
      <div className="flex gap-1 flex-wrap">
        {options.map(([val, lbl]) => (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={[
              'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
              value === val ? 'bg-gray-700 text-gray-100' : 'bg-gray-800/60 text-gray-500 hover:text-gray-300',
            ].join(' ')}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PracticePlayback({
  exercise,
  onSelectExercise,
  concertPitch = 440,
}: PracticePlaybackProps) {
  const [source, setSource] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [countIn, setCountIn] = useState(true)
  const [loop, setLoop] = useState(false)
  const [metronomeVol, setMetronomeVol] = useState(0.85)
  // Backing: one of Off / Drone / Chords / Arpeggio, with a single volume.
  const [backingMode, setBackingMode] = useState<BackingMode>('drone')
  const [backingVol, setBackingVol] = useState(0.5)
  const [activeChordLabel, setActiveChordLabel] = useState<string | null>(null)
  const [isCountingIn, setIsCountingIn] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const [sharedLinkError, setSharedLinkError] = useState<string | null>(null)
  const [trainerCompleted, setTrainerCompleted] = useState(false)
  const catalog = useExerciseCatalog()

  // Tempo Trainer (see src/audio/tempoPlan.ts for the ramp math)
  const [trainerOn, setTrainerOn] = useState(false)
  const [trainerMode, setTrainerMode] = useState<'perLoop' | 'timed'>('perLoop')
  const [trainerStart, setTrainerStart] = useState(60)
  const [trainerEnd, setTrainerEnd] = useState(120)
  const [trainerStep, setTrainerStep] = useState(4)
  const [trainerMin, setTrainerMin] = useState(5)
  const trainerPlan: TempoPlan | null = useMemo(() => {
    if (!trainerOn) return null
    return trainerMode === 'perLoop'
      ? { mode: 'perLoop', startBpm: trainerStart, endBpm: trainerEnd, stepBpm: trainerStep }
      : { mode: 'timed', startBpm: trainerStart, endBpm: trainerEnd, durationMin: trainerMin }
  }, [trainerOn, trainerMode, trainerStart, trainerEnd, trainerStep, trainerMin])

  const clockRef = useRef<PlaybackClock | null>(null)
  const droneRef = useRef<ChordDrone | null>(null)
  const stringsRef = useRef<StringsInstrument | null>(null)
  // Read live inside the clock's onBeat closure so switching backing mode takes
  // effect without restarting playback.
  const backingModeRef = useRef(backingMode)
  backingModeRef.current = backingMode
  const arpScheduleRef = useRef<ArpNote[]>([])
  const chordBackingRef = useRef<ChordBlock[]>([])
  const metronomeVolRef = useRef(metronomeVol)
  metronomeVolRef.current = metronomeVol
  // Mirror of the bpm state, so trainer ramps re-anchor after a manual slider
  // drag instead of snapping back (the ramp steps FROM the latest value).
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const scoreContainerRef = useRef<HTMLDivElement | null>(null)

  // Note highlight state (see the lilyJS editor's useScorePlayback): a rAF
  // loop maps the audio clock to a fractional beat and stamps the sounding
  // note's SVG elements via the lilyjs playback binding.
  const noteBindingRef = useRef<SvgPlaybackBinding | null>(null)
  const noteAnchorRef = useRef<{ beat: number; time: number } | null>(null)
  const noteRafRef = useRef<number | null>(null)
  const noteKeyRef = useRef('')

  // ── Load + parse the exercise ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setSource(null)
    setLoadError(null)
    fetch(exerciseUrl(exercise))
      .then(r => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(text => { if (!cancelled) setSource(text) })
      .catch(err => { if (!cancelled) setLoadError(`Could not load exercise: ${err.message}`) })
    return () => { cancelled = true }
  }, [exercise])

  const parsed = useMemo(() => {
    if (!source) return null
    try {
      const doc = parseSource(source).document
      const scoreBlocks = doc?.blocks.filter(isScoreBlock) ?? []
      const block = scoreBlocks[exercise.scoreIndex] ?? scoreBlocks[0]
      if (!block) return null
      return {
        score: block.score,
        chords: buildChordSchedule(block.score),
        notes: buildNoteSchedule(block.score),
        // Always render just the selected score block: whole-document renders
        // paginate to a full letter page (huge empty area below short
        // exercises), and LilyScore injects the catalog title anyway.
        renderScoreIndex: Math.min(exercise.scoreIndex, scoreBlocks.length - 1),
      }
    } catch (err) {
      console.error('exercise parse failed', err)
      return null
    }
  }, [source, exercise.scoreIndex])
  const schedule: ChordScheduleResult | null = parsed?.chords ?? null
  const noteEvents: NotePlaybackEvent[] = parsed?.notes ?? []
  const hasChordTrack = (schedule?.events.length ?? 0) > 0

  // Backing schedules (chords + arpeggio) — rebuilt per exercise, read live via
  // refs inside the clock's onBeat closure.
  const arpSchedule = useMemo<ArpNote[]>(
    () => (parsed?.score ? buildArpeggioSchedule(parsed.score, ARP_CONFIG) : []),
    [parsed],
  )
  arpScheduleRef.current = arpSchedule
  const chordBacking = useMemo<ChordBlock[]>(
    () => (parsed?.score ? buildChordBackingSchedule(parsed.score) : []),
    [parsed],
  )
  chordBackingRef.current = chordBacking

  // Score \tempo (when present) beats the UI default, once per exercise —
  // clamped to the slider's range in case a file carries an extreme marking.
  useEffect(() => {
    if (schedule?.bpm) setBpm(Math.min(208, Math.max(40, schedule.bpm)))
  }, [schedule])

  /** Stamp exactly `ids` as the active note events in the rendered SVG. */
  const applyNoteHighlight = useCallback((ids: string[]) => {
    const key = ids.join('\0')
    if (key === noteKeyRef.current) return
    noteKeyRef.current = key
    const container = scoreContainerRef.current
    if (!container) return
    if (!noteBindingRef.current) noteBindingRef.current = createSvgPlaybackBinding(container)
    noteBindingRef.current.setActiveEvents(ids)
  }, [])

  // ── Transport ───────────────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    clockRef.current?.stop()
    clockRef.current = null
    droneRef.current?.dispose()
    droneRef.current = null
    stringsRef.current?.dispose()
    stringsRef.current = null
    if (noteRafRef.current !== null) cancelAnimationFrame(noteRafRef.current)
    noteRafRef.current = null
    noteAnchorRef.current = null
    applyNoteHighlight([])
    setIsPlaying(false)
    setIsCountingIn(false)
    setActiveChordLabel(null)
  }, [applyNoteHighlight])

  const startPlayback = useCallback(async () => {
    if (!schedule || schedule.totalBeats === 0) return
    stopPlayback()
    setTrainerCompleted(false)
    const ctx = await resumeAudioContext()

    // Both backing instruments are created up front; the active one is chosen
    // live by backingModeRef, and each is enable-gated by volume (see effects).
    const droneActive = backingMode === 'drone'
    const stringsActive = backingMode === 'chords' || backingMode === 'arpeggio'
    const drone = new ChordDrone(ctx, {
      soundType: DRONE_SOUND,
      concertPitchHz: concertPitch,
      volume: droneActive ? backingVol * 0.4 : 0,
    })
    await drone.prepare(schedule.events.map(e => e.rootPc))
    const strings = new StringsInstrument(ctx, {
      concertPitchHz: concertPitch,
      volume: stringsActive ? backingVol : 0,
    })
    await strings.prepare([
      ...arpScheduleRef.current.map(n => n.midi),
      ...chordBackingRef.current.flatMap(b => b.midis),
    ])

    // Tempo training repeats the exercise until its target is completed.
    const plan = trainerPlan
    const shouldLoop = loop || plan !== null
    const startBpm = plan ? plan.startBpm : bpm
    if (plan) setBpm(startBpm)
    const total = schedule.totalBeats
    const clock = new PlaybackClock(ctx, {
      bpm: startBpm,
      beatsPerMeasure: schedule.beatsPerBar,
      // Whole clock beats only (9/8 bars are 4.5 QN — round up).
      countInBeats: countIn ? Math.ceil(schedule.beatsPerBar) : 0,
      // A zero-span trainer still plays one complete target repetition.
      totalBeats: plan && plan.startBpm === plan.endBpm
        ? total
        : shouldLoop ? undefined : total,
    })

    // Trainer ramp state. Timed offset re-anchors the ramp after a manual
    // slider drag: the drag shifts the whole remaining ramp, it doesn't fight it.
    let rampStartTime: number | null = null
    let timedOffset = 0
    let lastTimedBpm: number | null = null

    clock.onBeat(e => {
      // Metronome clicks live on the meter's pulse grid, not the quarter-note
      // clock grid: a 6/8 jig clicks twice per bar (dotted quarters), and the
      // second click falls BETWEEN clock beats (offset scheduled below).
      const secondsPerQN = 60 / clock.bpm
      for (const click of clicksInWindow(e.beat, e.beat + 1, schedule.pulseBeats, schedule.beatsPerBar)) {
        playWoodblock(
          ctx, ctx.destination,
          e.time + (click.beat - e.beat) * secondsPerQN,
          click.isDownbeat,
          metronomeVolRef.current,
        )
      }
      if (e.beat < 0) return // count-in: clicks only

      if (plan) {
        if (rampStartTime === null) rampStartTime = e.time
        let next: number | null = null
        if (plan.mode === 'perLoop') {
          // Step FROM the current value (bpmRef) so slider drags re-anchor.
          if (e.beat > 0 && e.beat % total === 0) {
            next = bpmForLoop({ ...plan, startBpm: bpmRef.current }, 1)
            // Once the target tempo is set, play that repetition in full and
            // let the clock end naturally at its final boundary.
            if (next === plan.endBpm) clock.setTotalBeats(e.beat + total)
          }
        } else if (e.isDownbeat) {
          const raw = bpmAtElapsed(plan, e.time - rampStartTime)
          if (lastTimedBpm !== null && bpmRef.current !== lastTimedBpm) {
            timedOffset = bpmRef.current - raw // slider moved since last step
          }
          const shifted = Math.max(20, Math.min(300, raw + timedOffset))
          const reachedTarget = plan.endBpm >= plan.startBpm
            ? shifted >= plan.endBpm
            : shifted <= plan.endBpm
          next = reachedTarget ? plan.endBpm : shifted
          if (reachedTarget) {
            clock.setTotalBeats(e.beat + Math.ceil(schedule.beatsPerBar))
          }
          lastTimedBpm = next
        }
        if (next !== null && next !== clock.bpm) {
          clock.setBpm(next)
          setBpm(next)
          bpmRef.current = next
        }
      }

      const beat = shouldLoop ? e.beat % total : e.beat
      const secondsPer = 60 / clock.bpm
      const mode = backingModeRef.current

      if (mode === 'drone') {
        for (const chord of chordsStartingInWindow(schedule.events, beat, beat + 1)) {
          drone.setChord(chord.rootPc, chord.quality, e.time + (chord.startBeat - beat) * secondsPer)
        }
        // ChordDrone's same-chord guard handles the non-change case; a loop
        // back to Gm from Bb is a real change and re-articulates.
      } else if (mode === 'chords') {
        for (const block of chordBlocksInWindow(chordBackingRef.current, beat, beat + 1)) {
          const at = e.time + (block.startBeat - beat) * secondsPer
          for (const midi of block.midis) {
            strings.playNote(midi, at, block.durationBeats * secondsPer, block.velocity)
          }
        }
      } else if (mode === 'arpeggio') {
        for (const note of arpNotesInWindow(arpScheduleRef.current, beat, beat + 1)) {
          strings.playNote(
            note.midi,
            e.time + (note.startBeat - beat) * secondsPer,
            note.durationBeats * secondsPer,
            note.velocity,
          )
        }
      }
    })

    clock.onVisualBeat(rawBeat => {
      setIsCountingIn(rawBeat < 0)
      // Anchor for the sub-beat note cursor: this beat became audible ~now.
      noteAnchorRef.current = { beat: rawBeat, time: ctx.currentTime }
      if (rawBeat < 0) return
      const beat = shouldLoop ? rawBeat % total : rawBeat
      setActiveChordLabel(chordSoundingAtBeat(schedule.events, beat)?.label ?? null)
    })

    // Note cursor: interpolate the fraction into the current beat from the
    // audio clock, then highlight whatever note (or rest) sounds there.
    const noteTick = () => {
      const anchor = noteAnchorRef.current
      if (!anchor || anchor.beat < 0) {
        applyNoteHighlight([])
      } else {
        const secondsPer = 60 / clock.bpm
        const frac = Math.min(0.999, Math.max(0, (ctx.currentTime - anchor.time) / secondsPer))
        const beat = (shouldLoop ? anchor.beat % total : anchor.beat) + frac
        applyNoteHighlight(noteEventIdsAtBeat(noteEvents, beat))
      }
      noteRafRef.current = requestAnimationFrame(noteTick)
    }
    noteRafRef.current = requestAnimationFrame(noteTick)

    clock.onEnded(() => {
      drone.stop()
      strings.stop()
      if (plan) setTrainerCompleted(true)
      stopPlayback()
    })

    clockRef.current = clock
    droneRef.current = drone
    stringsRef.current = strings
    clock.start()
    setIsPlaying(true)
  }, [schedule, noteEvents, concertPitch, backingMode, backingVol, loop, bpm, countIn, trainerPlan, stopPlayback, applyNoteHighlight])

  // Live control forwarding
  useEffect(() => { clockRef.current?.setBpm(bpm) }, [bpm])
  // Backing mode/volume are volume-gated (gapless): the inactive instrument is
  // silenced but keeps running, so switching modes needs no restart.
  useEffect(() => {
    droneRef.current?.setVolume(backingMode === 'drone' ? backingVol * 0.4 : 0)
    stringsRef.current?.setVolume(backingMode === 'chords' || backingMode === 'arpeggio' ? backingVol : 0)
  }, [backingMode, backingVol])

  useEffect(() => {
    setTrainerCompleted(false)
  }, [trainerOn, trainerMode, trainerStart, trainerEnd, trainerStep, trainerMin, exercise.id])

  // Tear down audio when the view unmounts or the exercise changes
  useEffect(() => stopPlayback, [stopPlayback, exercise.id])

  const handlePick = useCallback((entry: ExerciseCatalogEntry) => {
    stopPlayback()
    recordRecentExercise(entry.id)
    setShowPicker(false)
    setBpm(entry.bpm ?? DEFAULT_BPM)
    onSelectExercise(entry)
  }, [stopPlayback, onSelectExercise])

  // Resolve #practice/<exercise-id> after the remote catalog (or cache) is
  // available. The bundled exercise can resolve immediately while loading.
  useEffect(() => {
    const sharedId = playAlongExerciseIdFromHash(window.location.hash)
    if (!sharedId) {
      setSharedLinkError(null)
      return
    }
    const linkedExercise = catalog.exercises.find(entry => entry.id === sharedId)
    if (linkedExercise) {
      setSharedLinkError(null)
      if (linkedExercise.id !== exercise.id) handlePick(linkedExercise)
    } else if (!catalog.loading) {
      setSharedLinkError('This shared exercise is not available in the current library.')
    }
  }, [catalog.exercises, catalog.loading, exercise.id, handlePick])

  useEffect(() => {
    if (!shareStatus) return
    const timeout = window.setTimeout(() => setShareStatus(''), 2500)
    return () => window.clearTimeout(timeout)
  }, [shareStatus])

  const copyShareLink = useCallback(async () => {
    const url = playAlongUrl(exercise.id)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const input = document.createElement('textarea')
      input.value = url
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setShareStatus('Copied')
  }, [exercise.id])

  // ── Chord-symbol highlight in the rendered SVG (M5) ────────────────────────
  useEffect(() => {
    const container = scoreContainerRef.current
    if (!container) return
    container.querySelectorAll<SVGTextElement>('[data-lily-chord-label]').forEach(el => {
      const active = activeChordLabel !== null && el.getAttribute('data-lily-chord-label') === activeChordLabel
      el.style.fill = active ? '#fbbf24' : ''
      el.style.fontWeight = active ? 'bold' : ''
    })
  }, [activeChordLabel])

  const handleRendered = useCallback((container: HTMLDivElement) => {
    scoreContainerRef.current = container
    // The SVG was rebuilt (font swap, resize) — the old binding holds dead
    // elements. Drop it; the note-cursor loop recreates and re-stamps it.
    noteBindingRef.current = null
    noteKeyRef.current = ''
  }, [])

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div id="play-along" className="flex flex-col gap-4">
      {/* Current exercise and primary actions stay visible even on load errors. */}
      <div id="play-along-exercise-header" className="flex flex-col gap-3 border-b border-gray-700/70 pb-4">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-1">Exercise</p>
            <h2 className="text-lg font-semibold text-gray-100 leading-tight break-words">{exercise.title}</h2>
            {exercise.subtitle && <p className="text-sm text-gray-500 mt-1">{exercise.subtitle}</p>}
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500 mt-2">
              <span>{exercise.category}</span>
              {exercise.key && <span>Key {exercise.key}</span>}
              {exercise.timeSig && <span>{exercise.timeSig}</span>}
              <span>{exercise.bars} bars</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 sm:w-auto">
            <button
              type="button"
              onClick={() => setShowPicker(s => !s)}
              aria-expanded={showPicker}
              className="h-9 flex-1 rounded-md border border-gray-700 px-3 text-xs font-semibold text-gray-300 hover:bg-gray-800 transition-colors sm:flex-none"
            >
              {showPicker ? 'Close' : 'Change'}
            </button>
            <button
              type="button"
              onClick={() => void copyShareLink()}
              aria-label={shareStatus ? 'Share link copied' : 'Copy share link'}
              title={shareStatus || 'Share'}
              className="h-9 w-9 shrink-0 rounded-md bg-amber-400 text-gray-950 hover:bg-amber-300 transition-colors flex items-center justify-center"
            >
              {shareStatus ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="m5 12.5 4.25 4.25L19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M12 3v12m0-12L8 7m4-4 4 4M6 11v8h12v-8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <span className="sr-only" aria-live="polite">{shareStatus}</span>
          </div>
        </div>
        {showPicker && (
          <ExercisePicker
            selectedId={exercise.id}
            exercises={catalog.exercises}
            loading={catalog.loading}
            error={catalog.error}
            onSelect={handlePick}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>

      {sharedLinkError && (
        <div className="text-center text-amber-300 text-sm bg-amber-950/30 rounded-md py-3 px-4">
          {sharedLinkError}
        </div>
      )}

      {loadError && (
        <div className="text-center text-red-400 text-sm bg-red-950/40 rounded-xl py-3 px-4">{loadError}</div>
      )}
      {!loadError && !source && (
        <div className="text-center text-gray-500 text-sm py-6">Loading exercise…</div>
      )}

      {source && !loadError && (
        <>
      {/* Score */}
      <div id="play-along-score" className="rounded-xl bg-gray-900 border border-gray-700 p-2 overflow-x-auto">
        <LilyScore
          source={source}
          scoreIndex={parsed?.renderScoreIndex}
          title={exercise.title}
          onRendered={handleRendered}
        />
      </div>

      {/* Chord timeline */}
      {schedule && schedule.events.length > 0 && (
        <div id="play-along-chord-timeline" className="flex gap-2 justify-center flex-wrap">
          {schedule.events.map(e => (
            <span
              key={`${e.label}-${e.startBeat}`}
              className={[
                'px-3 py-1 rounded-full text-sm font-semibold transition-colors',
                activeChordLabel === e.label
                  ? 'bg-amber-400 text-gray-900'
                  : 'bg-gray-800 text-gray-400',
              ].join(' ')}
            >
              {e.label}
            </span>
          ))}
        </div>
      )}

      {/* Transport */}
      <div id="play-along-transport" className="flex items-center gap-3">
        <button
          onClick={() => (isPlaying ? stopPlayback() : void startPlayback())}
          disabled={!schedule || schedule.totalBeats === 0}
          className={[
            'w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-colors shrink-0',
            isPlaying ? 'bg-red-500/90 text-white' : 'bg-emerald-500/90 text-white',
            !schedule ? 'opacity-40 cursor-not-allowed' : '',
          ].join(' ')}
          aria-label={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? '■' : '▶'}
        </button>

        <div className="flex-1">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Tempo</span>
            <span className="tabular-nums">
              {isCountingIn ? 'count-in…' : `♩ = ${bpm}`}
            </span>
          </div>
          <input
            type="range" min={40} max={208} step={1} value={bpm}
            onChange={e => setBpm(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
        </div>
      </div>

      {/* Options */}
      <div id="play-along-options" className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <label className="flex items-center gap-2 text-gray-400">
          <input type="checkbox" checked={countIn} onChange={e => setCountIn(e.target.checked)}
            className="accent-amber-400" />
          Count-in (1 bar)
        </label>
        <label className="flex items-center gap-2 text-gray-400">
          <input
            type="checkbox"
            checked={loop || trainerOn}
            disabled={trainerOn}
            onChange={e => setLoop(e.target.checked)}
            className="accent-amber-400" />
          Loop
        </label>

        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Metronome</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.05} value={metronomeVol}
            onChange={e => setMetronomeVol(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
        </div>
        {/* Drone volume lives in the Backing section below. */}
      </div>

      {/* Tempo Trainer — ramp the tempo per loop or over time */}
      <div id="play-along-tempo-trainer" className="rounded-xl bg-gray-800/40 p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox" checked={trainerOn}
              onChange={e => setTrainerOn(e.target.checked)}
              className="accent-amber-400"
            />
            Tempo Trainer
          </label>
          {trainerOn && (
            <div className="flex gap-1">
              {([['perLoop', 'Per loop'], ['timed', 'Timed']] as const).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setTrainerMode(m)}
                  disabled={isPlaying}
                  className={[
                    'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                    trainerMode === m ? 'bg-gray-700 text-gray-100' : 'bg-gray-800/60 text-gray-500',
                    isPlaying ? 'opacity-50' : 'hover:text-gray-300',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {trainerOn && (
          <>
            <div className="flex items-center gap-3 text-sm text-gray-400 flex-wrap">
              <label className="flex items-center gap-1.5">
                From
                <input
                  type="number" min={40} max={300} value={trainerStart} disabled={isPlaying}
                  onChange={e => setTrainerStart(Number(e.target.value))}
                  className="w-16 rounded bg-gray-900 border border-gray-700 px-2 py-1 text-gray-200 text-sm"
                />
              </label>
              <label className="flex items-center gap-1.5">
                to
                <input
                  type="number" min={40} max={300} value={trainerEnd} disabled={isPlaying}
                  onChange={e => setTrainerEnd(Number(e.target.value))}
                  className="w-16 rounded bg-gray-900 border border-gray-700 px-2 py-1 text-gray-200 text-sm"
                />
              </label>
              {trainerMode === 'perLoop' ? (
                <label className="flex items-center gap-1.5">
                  +
                  <input
                    type="number" min={1} max={40} value={trainerStep} disabled={isPlaying}
                    onChange={e => setTrainerStep(Number(e.target.value))}
                    className="w-14 rounded bg-gray-900 border border-gray-700 px-2 py-1 text-gray-200 text-sm"
                  />
                  BPM / loop
                </label>
              ) : (
                <label className="flex items-center gap-1.5">
                  over
                  <input
                    type="number" min={1} max={60} value={trainerMin} disabled={isPlaying}
                    onChange={e => setTrainerMin(Number(e.target.value))}
                    className="w-14 rounded bg-gray-900 border border-gray-700 px-2 py-1 text-gray-200 text-sm"
                  />
                  min
                </label>
              )}
            </div>

            {/* Stepped ramp viz: gray = planned, amber = reached */}
            {trainerPlan && (() => {
              const steps = plannedSteps(trainerPlan)
              const lo = Math.min(trainerStart, trainerEnd)
              const hi = Math.max(trainerStart, trainerEnd)
              const hasProgress = isPlaying || trainerCompleted
              const frac = hasProgress ? rampFraction(trainerPlan, bpm) : 0
              const reachedCount = Math.floor(frac * (steps.length - 1) + 1e-6) + (hasProgress ? 1 : 0)
              return (
                <>
                  <div className="flex items-end gap-[3px] h-12" aria-hidden>
                    {steps.map((v, i) => (
                      <div
                        key={i}
                        className={[
                          'flex-1 rounded-sm transition-colors',
                          i < reachedCount ? 'bg-amber-400' : 'bg-gray-700',
                        ].join(' ')}
                        style={{ height: `${hi === lo ? 100 : 20 + (80 * (v - lo)) / (hi - lo)}%` }}
                      />
                    ))}
                  </div>
                  {trainerCompleted && (
                    <div className="text-xs font-semibold text-emerald-400" role="status">
                      Target reached at {trainerEnd} BPM
                    </div>
                  )}
                </>
              )
            })()}
          </>
        )}
      </div>

      {/* Backing — one control: Off / Drone / Chords / Arpeggio, played by the
          sampled cello (drone) and string ensemble (chords/arpeggio) */}
      {hasChordTrack ? (
        <div id="play-along-backing" className="rounded-xl bg-gray-800/40 p-3 flex flex-col gap-3">
          <SegRow label="Backing" value={backingMode} onChange={setBackingMode} options={BACKING_MODES} />
          {backingMode !== 'off' && (
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-16 shrink-0">Volume</span>
              <input
                type="range" min={0} max={1} step={0.05} value={backingVol}
                onChange={e => setBackingVol(Number(e.target.value))}
                className="flex-1 accent-amber-400"
              />
            </label>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-600 text-center">
          No chord track in this exercise — metronome only.
        </div>
      )}
        </>
      )}
    </div>
  )
}
