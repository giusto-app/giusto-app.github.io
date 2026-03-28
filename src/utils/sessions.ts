import type { TuningStatus } from './noteUtils'
import type { TemperamentKey } from './temperaments'
import type { ScaleKey } from './scaleDefinitions'

export interface NoteEvent {
  midiNote: number
  pitchClass: number
  noteName: string
  octave: number
  avgCents: number      // mean cents deviation over the note's duration
  absCentsAvg: number   // mean absolute cents deviation
  durationMs: number
  startTime: number     // ms from session start
  status: TuningStatus
}

export interface PracticeSession {
  id: string
  timestamp: number       // Unix ms
  durationMs: number
  scaleKey: ScaleKey
  temperamentKey: TemperamentKey
  noteEvents: NoteEvent[]
  // pre-computed summary
  totalNotes: number
  inTuneCount: number
  closeCount: number
  outOfTuneCount: number
  percentInTune: number   // 0–100
  avgAbsCents: number
}

const STORAGE_KEY = 'intonation-trainer-sessions-v1'
const MAX_SESSIONS = 50

export function loadSessions(): PracticeSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PracticeSession[]) : []
  } catch {
    return []
  }
}

export function saveSession(session: PracticeSession): void {
  const sessions = loadSessions()
  sessions.unshift(session)
  if (sessions.length > MAX_SESSIONS) sessions.length = MAX_SESSIONS
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

export function clearSessions(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function buildSession(
  noteEvents: NoteEvent[],
  scaleKey: ScaleKey,
  temperamentKey: TemperamentKey,
  durationMs: number,
): PracticeSession {
  const totalNotes = noteEvents.length
  const inTuneCount = noteEvents.filter(n => n.status === 'in-tune').length
  const closeCount = noteEvents.filter(n => n.status === 'close').length
  const outOfTuneCount = noteEvents.filter(n => n.status === 'out-of-tune').length
  const avgAbsCents = totalNotes > 0
    ? noteEvents.reduce((s, n) => s + n.absCentsAvg, 0) / totalNotes
    : 0
  const percentInTune = totalNotes > 0
    ? Math.round((inTuneCount / totalNotes) * 100)
    : 0

  const id = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return {
    id,
    timestamp: Date.now(),
    durationMs,
    scaleKey,
    temperamentKey,
    noteEvents,
    totalNotes,
    inTuneCount,
    closeCount,
    outOfTuneCount,
    percentInTune,
    avgAbsCents,
  }
}
