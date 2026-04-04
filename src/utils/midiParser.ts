// Minimal MIDI parser — extracts NoteOn events from standard MIDI files.
// Handles format 0 (single track) and format 1 (multi-track, melody on track 1).
// No dependencies. Supports running status and variable-length quantities.

export interface ExpectedNote {
  midiNote: number
  startTick: number
  durationTicks: number
}

// Read a Variable-Length Quantity starting at `offset` in `view`.
function readVlq(view: DataView, offset: number): { value: number; bytesRead: number } {
  let value = 0
  let bytesRead = 0
  let byte: number
  do {
    byte = view.getUint8(offset + bytesRead)
    value = (value << 7) | (byte & 0x7F)
    bytesRead++
  } while (byte & 0x80)
  return { value, bytesRead }
}

// Parse one MIDI track chunk starting at `trackStart` in `view`.
// Returns all NoteOn events with resolved durations, sorted by startTick.
function parseTrack(view: DataView, trackStart: number, trackLength: number): ExpectedNote[] {
  const trackEnd = trackStart + trackLength
  let pos = trackStart
  let absoluteTick = 0
  let runningStatus = 0

  // Open notes awaiting NoteOff: keyed by midiNote
  const openNotes = new Map<number, number>() // midiNote → startTick
  const notes: ExpectedNote[] = []

  while (pos < trackEnd) {
    // Delta time
    const delta = readVlq(view, pos)
    absoluteTick += delta.value
    pos += delta.bytesRead

    if (pos >= trackEnd) break

    // Status byte
    const firstByte = view.getUint8(pos)
    let statusByte: number

    if (firstByte & 0x80) {
      statusByte = firstByte
      runningStatus = firstByte
      pos++
    } else {
      // Running status — don't advance pos, data byte will be read below
      statusByte = runningStatus
    }

    const type = statusByte & 0xF0

    if (type === 0x90) {
      // NoteOn
      const note = view.getUint8(pos++)
      const velocity = view.getUint8(pos++)
      if (velocity > 0) {
        openNotes.set(note, absoluteTick)
      } else {
        // velocity=0 NoteOn is NoteOff
        const startTick = openNotes.get(note)
        if (startTick !== undefined) {
          notes.push({ midiNote: note, startTick, durationTicks: absoluteTick - startTick })
          openNotes.delete(note)
        }
      }
    } else if (type === 0x80) {
      // NoteOff
      const note = view.getUint8(pos++)
      pos++ // velocity (ignored)
      const startTick = openNotes.get(note)
      if (startTick !== undefined) {
        notes.push({ midiNote: note, startTick, durationTicks: absoluteTick - startTick })
        openNotes.delete(note)
      }
    } else if (type === 0xA0 || type === 0xB0 || type === 0xE0) {
      pos += 2 // AfterTouch, CC, PitchBend — 2 data bytes
    } else if (type === 0xC0 || type === 0xD0) {
      pos += 1 // ProgramChange, ChannelPressure — 1 data byte
    } else if (statusByte === 0xFF) {
      // Meta event
      pos++ // meta type byte (ignored)
      const metaLen = readVlq(view, pos)
      pos += metaLen.bytesRead + metaLen.value
    } else if (statusByte === 0xF0 || statusByte === 0xF7) {
      // SysEx
      const sysexLen = readVlq(view, pos)
      pos += sysexLen.bytesRead + sysexLen.value
    } else {
      // Unknown — advance one byte to avoid infinite loop
      pos++
    }
  }

  // Close any notes still open at end of track
  for (const [note, startTick] of openNotes) {
    notes.push({ midiNote: note, startTick, durationTicks: absoluteTick - startTick })
  }

  return notes.sort((a, b) => a.startTick - b.startTick)
}

export function parseMidi(buffer: ArrayBuffer): ExpectedNote[] {
  const view = new DataView(buffer)

  // Validate MThd header
  if (view.byteLength < 14) return []
  const magic = view.getUint32(0, false)
  if (magic !== 0x4D546864) return [] // 'MThd'

  const format     = view.getUint16(8, false)
  const numTracks  = view.getUint16(10, false)
  // ticksPerQuarterNote = view.getUint16(12, false) — not needed for DTW

  if (format > 1 || numTracks === 0) return []

  // Locate tracks
  let pos = 14 // after MThd (8 bytes header + 6 bytes data)
  const tracks: Array<{ start: number; length: number }> = []

  for (let t = 0; t < numTracks && pos + 8 <= view.byteLength; t++) {
    const chunkType = view.getUint32(pos, false)
    const chunkLen  = view.getUint32(pos + 4, false)
    pos += 8
    if (chunkType === 0x4D54726B) { // 'MTrk'
      tracks.push({ start: pos, length: chunkLen })
    }
    pos += chunkLen
  }

  if (tracks.length === 0) return []

  // Format 0: single track (tracks[0] is the only track).
  // Format 1: track 0 is tempo/metadata (no notes); remaining tracks carry music.
  // When there are multiple music tracks (e.g. melody + chords), the melody has
  // the most individual notes — pick the track with the highest note count.
  const candidates = format === 1 ? tracks.slice(1) : tracks
  let best = candidates[0]!
  let bestCount = parseTrack(view, best.start, best.length).length
  for (let i = 1; i < candidates.length; i++) {
    const t = candidates[i]!
    const count = parseTrack(view, t.start, t.length).length
    if (count > bestCount) { best = t; bestCount = count }
  }
  return parseTrack(view, best.start, best.length)
}
