// Which slices of a tune become memorization cards.
//
// The rule is Marc's, confirmed 2026-07-15 (PLAN_PRACTICE_FEATURES.md, "Segmentation"):
// 4-bar phrases plus chained/overlapping ranges — 1–4, 5–8, 1–8, 5–12 … So you
// learn each phrase on its own, then the seams between them, then the whole tune.
// The seams are the point: a tune you can play in four-bar chunks and stall
// between is not memorized.
//
// Pure measure arithmetic — no storage, no React. Nothing wires this yet; card
// generation on add-to-queue is the next step (see TODO.md).

export interface TuneSegment {
  /** 1-based, inclusive — the same numbering LilyPond prints and `measureRange` takes. */
  startMeasure: number
  /** 1-based, inclusive. */
  endMeasure: number
  /** Card label, e.g. "Bars 1–4". A segment covering the tune is "Full tune". */
  label: string
}

const DEFAULT_PHRASE_BARS = 4

/**
 * Plan the segment cards for a tune of `totalMeasures` bars.
 *
 * Order is deliberate: every phrase, then every seam, then the whole tune —
 * shortest and most learnable first, so a new tune's queue starts easy.
 *
 * No cap on the count. A 64-bar tune yields 32 cards, which is a lot, but
 * silently dropping the tail would quietly leave part of a tune unlearned; if
 * that proves unwieldy the fix is a decision about phrase length, not a hidden
 * truncation here.
 */
export function planSegments(totalMeasures: number, phraseBars = DEFAULT_PHRASE_BARS): TuneSegment[] {
  if (!Number.isFinite(totalMeasures) || totalMeasures < 1) return []
  const total = Math.floor(totalMeasures)
  const phrase = Math.max(1, Math.floor(phraseBars))

  const ranges: Array<[number, number]> = []

  // Phrases: 1–4, 5–8, … The last one is short when the tune doesn't divide evenly.
  for (let start = 1; start <= total; start += phrase) {
    ranges.push([start, Math.min(start + phrase - 1, total)])
  }

  // Seams: double-length windows hopping one phrase at a time (1–8, 5–12, …).
  // Only worth a card when the window actually spans more than one phrase —
  // at the end of the tune it collapses onto the final phrase.
  for (let start = 1; start <= total; start += phrase) {
    const end = Math.min(start + phrase * 2 - 1, total)
    if (end > start + phrase - 1) ranges.push([start, end])
  }

  // The whole tune, if no window already covers it.
  if (!ranges.some(([s, e]) => s === 1 && e === total)) ranges.push([1, total])

  const seen = new Set<string>()
  return ranges
    .filter(([s, e]) => {
      const key = `${s}-${e}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map(([startMeasure, endMeasure]) => ({
      startMeasure,
      endMeasure,
      label: segmentLabel(startMeasure, endMeasure, total),
    }))
}

function segmentLabel(start: number, end: number, total: number): string {
  // "Full tune" keeps the label existing cards already carry, so a whole-tune
  // segment and a card added before segmentation existed read the same.
  if (start === 1 && end === total) return 'Full tune'
  if (start === end) return `Bar ${start}`
  return `Bars ${start}–${end}`
}
