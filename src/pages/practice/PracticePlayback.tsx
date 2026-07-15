import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseSource, type MusicDocumentBlock, type ScoreLike } from 'lilyjs'
import LilyScore from './LilyScore'
import { resumeAudioContext } from '../../audio/audioContext'
import { PlaybackClock } from '../../audio/playbackClock'
import { playWoodblock } from '../../audio/woodblock'
import { ChordDrone, type ChordDroneSoundType } from '../../audio/chordDrone'
import {
  buildChordSchedule,
  chordSoundingAtBeat,
  chordsStartingInWindow,
  type ChordScheduleResult,
} from '../../audio/chordSchedule'
import type { ConcertPitchHz } from '../../utils/concertPitch'

// Practice Playback: renders a LilyPond exercise with lilyJS and plays a
// woodblock metronome plus a drone that changes on every chord change.
// One PlaybackClock owns time; the metronome and the chord drone are both
// scheduled from its beat events, so they can never drift apart.

interface PracticePlaybackProps {
  /** URL of the .ly exercise (under public/). */
  exerciseUrl?: string
  concertPitch?: ConcertPitchHz
}

const DEFAULT_EXERCISE = '/exercises/practice-arpeggios.ly'
const DEFAULT_BPM = 80

function isScoreBlock(b: MusicDocumentBlock): b is { type: 'score'; score: ScoreLike } {
  return b.type === 'score' && 'score' in b
}

const DRONE_SOUNDS: Array<{ value: ChordDroneSoundType; label: string }> = [
  { value: 'sawtooth', label: 'Synth' },
  { value: 'shruti', label: 'Shruti' },
  { value: 'cello', label: 'Cello' },
]

export default function PracticePlayback({
  exerciseUrl = DEFAULT_EXERCISE,
  concertPitch = 440,
}: PracticePlaybackProps) {
  const [source, setSource] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [countIn, setCountIn] = useState(true)
  const [loop, setLoop] = useState(false)
  const [metronomeVol, setMetronomeVol] = useState(0.6)
  const [droneVol, setDroneVol] = useState(0.35)
  const [soundType, setSoundType] = useState<ChordDroneSoundType>('sawtooth')
  const [activeChordLabel, setActiveChordLabel] = useState<string | null>(null)
  const [isCountingIn, setIsCountingIn] = useState(false)

  const clockRef = useRef<PlaybackClock | null>(null)
  const droneRef = useRef<ChordDrone | null>(null)
  const metronomeVolRef = useRef(metronomeVol)
  metronomeVolRef.current = metronomeVol
  const scoreContainerRef = useRef<HTMLDivElement | null>(null)

  // ── Load + parse the exercise ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetch(exerciseUrl)
      .then(r => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(text => { if (!cancelled) setSource(text) })
      .catch(err => { if (!cancelled) setLoadError(`Could not load exercise: ${err.message}`) })
    return () => { cancelled = true }
  }, [exerciseUrl])

  const schedule: ChordScheduleResult | null = useMemo(() => {
    if (!source) return null
    try {
      const doc = parseSource(source).document
      const block = doc?.blocks.find(isScoreBlock)
      return block ? buildChordSchedule(block.score) : null
    } catch (err) {
      console.error('exercise parse failed', err)
      return null
    }
  }, [source])

  // Score \tempo (when present) beats the UI default, once per exercise.
  useEffect(() => {
    if (schedule?.bpm) setBpm(schedule.bpm)
  }, [schedule])

  // ── Transport ───────────────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    clockRef.current?.stop()
    clockRef.current = null
    droneRef.current?.dispose()
    droneRef.current = null
    setIsPlaying(false)
    setIsCountingIn(false)
    setActiveChordLabel(null)
  }, [])

  const startPlayback = useCallback(async () => {
    if (!schedule || schedule.totalBeats === 0) return
    stopPlayback()
    const ctx = await resumeAudioContext()

    const drone = new ChordDrone(ctx, { soundType, concertPitchHz: concertPitch, volume: droneVol })
    await drone.prepare(schedule.events.map(e => e.rootPc))

    const shouldLoop = loop
    const total = schedule.totalBeats
    const clock = new PlaybackClock(ctx, {
      bpm,
      beatsPerMeasure: schedule.beatsPerBar,
      countInBeats: countIn ? schedule.beatsPerBar : 0,
      // Endless when looping; the beat index wraps below.
      totalBeats: shouldLoop ? undefined : total,
    })

    clock.onBeat(e => {
      playWoodblock(ctx, ctx.destination, e.time, e.isDownbeat, metronomeVolRef.current)
      if (e.beat < 0) return // count-in: clicks only
      const beat = shouldLoop ? e.beat % total : e.beat
      const secondsPer = 60 / clock.bpm
      for (const chord of chordsStartingInWindow(schedule.events, beat, beat + 1)) {
        drone.setChord(chord.rootPc, chord.quality, e.time + (chord.startBeat - beat) * secondsPer)
      }
      // Looping back to Gm from Bb is a real chord change; ChordDrone's
      // same-chord guard handles the non-change case automatically.
    })

    clock.onVisualBeat(rawBeat => {
      setIsCountingIn(rawBeat < 0)
      if (rawBeat < 0) return
      const beat = shouldLoop ? rawBeat % total : rawBeat
      setActiveChordLabel(chordSoundingAtBeat(schedule.events, beat)?.label ?? null)
    })

    clock.onEnded(() => {
      drone.stop()
      stopPlayback()
    })

    clockRef.current = clock
    droneRef.current = drone
    clock.start()
    setIsPlaying(true)
  }, [schedule, soundType, concertPitch, droneVol, loop, bpm, countIn, stopPlayback])

  // Live control forwarding
  useEffect(() => { clockRef.current?.setBpm(bpm) }, [bpm])
  useEffect(() => { droneRef.current?.setVolume(droneVol) }, [droneVol])

  // Tear down audio when the view unmounts
  useEffect(() => stopPlayback, [stopPlayback])

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
  }, [])

  // ── UI ──────────────────────────────────────────────────────────────────────
  if (loadError) {
    return <div className="text-center text-red-400 text-sm bg-red-950/40 rounded-xl py-3 px-4">{loadError}</div>
  }
  if (!source) {
    return <div className="text-center text-gray-500 text-sm py-6">Loading exercise…</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Score */}
      <div className="rounded-xl bg-white/95 p-2 overflow-x-auto">
        <LilyScore source={source} width={680} onRendered={handleRendered} />
      </div>

      {/* Chord timeline */}
      {schedule && schedule.events.length > 0 && (
        <div className="flex gap-2 justify-center flex-wrap">
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
      <div className="flex items-center gap-3">
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <label className="flex items-center gap-2 text-gray-400">
          <input type="checkbox" checked={countIn} onChange={e => setCountIn(e.target.checked)}
            className="accent-amber-400" />
          Count-in (1 bar)
        </label>
        <label className="flex items-center gap-2 text-gray-400">
          <input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)}
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
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Drone</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.05} value={droneVol}
            onChange={e => setDroneVol(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
        </div>
      </div>

      {/* Drone sound */}
      <div className="flex gap-2">
        {DRONE_SOUNDS.map(s => (
          <button
            key={s.value}
            onClick={() => setSoundType(s.value)}
            disabled={isPlaying}
            className={[
              'flex-1 py-2 rounded-xl text-sm font-medium transition-colors',
              soundType === s.value ? 'bg-gray-700 text-gray-100' : 'bg-gray-800/60 text-gray-500',
              isPlaying ? 'opacity-50' : 'hover:text-gray-200',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
