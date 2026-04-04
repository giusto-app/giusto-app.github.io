// Classic Dynamic Time Warping on integer MIDI note numbers.
// Distance metric: absolute semitone difference.
// Intonation scoring uses optional cents-deviation array for matched pairs.

export interface DTWResult {
  path: Array<[number, number]> // [detected_i, expected_j] pairs
  cost: number
  matchedCount: number    // pairs where |detected - expected| <= 1 semitone
  totalExpected: number
  intonationScore: number // 0–100 (100 = perfect intonation on all matched notes)
}

export function dtw(
  detected: number[],
  expected: number[],
  detectedCents: number[] | undefined = undefined,
): DTWResult {
  const N = detected.length
  const M = expected.length

  if (N === 0 || M === 0) {
    return { path: [], cost: 0, matchedCount: 0, totalExpected: M, intonationScore: 0 }
  }

  // Cost matrix: |detected[i] - expected[j]| in semitones
  // Accumulated cost matrix D initialized to Infinity
  const D: number[][] = Array.from({ length: N }, () => new Array<number>(M).fill(Infinity))

  D[0][0] = Math.abs(detected[0] - expected[0])

  for (let i = 1; i < N; i++) D[i][0] = D[i - 1][0] + Math.abs(detected[i] - expected[0])
  for (let j = 1; j < M; j++) D[0][j] = D[0][j - 1] + Math.abs(detected[0] - expected[j])

  for (let i = 1; i < N; i++) {
    for (let j = 1; j < M; j++) {
      const cost = Math.abs(detected[i] - expected[j])
      D[i][j] = cost + Math.min(D[i - 1][j], D[i][j - 1], D[i - 1][j - 1])
    }
  }

  // Traceback from [N-1, M-1] to [0, 0]
  const path: Array<[number, number]> = []
  let i = N - 1
  let j = M - 1

  while (i > 0 || j > 0) {
    path.push([i, j])
    if (i === 0) { j--; continue }
    if (j === 0) { i--; continue }
    const diagCost = D[i - 1][j - 1]
    const leftCost = D[i][j - 1]
    const upCost   = D[i - 1][j]
    if (diagCost <= leftCost && diagCost <= upCost) { i--; j-- }
    else if (leftCost <= upCost) { j-- }
    else { i-- }
  }
  path.push([0, 0])
  path.reverse()

  // Score matched pairs (±1 semitone tolerance)
  let matchedCount = 0
  let totalAbsCents = 0
  let centsCount = 0

  for (const [di, ej] of path) {
    if (Math.abs(detected[di] - expected[ej]) <= 1) {
      matchedCount++
      if (detectedCents !== undefined) {
        totalAbsCents += Math.abs(detectedCents[di])
        centsCount++
      }
    }
  }

  const intonationScore = centsCount > 0
    ? Math.max(0, Math.round(100 - totalAbsCents / centsCount))
    : matchedCount > 0 ? 100 : 0

  return {
    path,
    cost: D[N - 1][M - 1],
    matchedCount,
    totalExpected: M,
    intonationScore,
  }
}

// Overall 0–100 score combining note match rate and intonation quality
export function computeOverallScore(result: DTWResult): number {
  if (result.totalExpected === 0) return 0
  const matchRate = result.matchedCount / result.totalExpected
  return Math.round(matchRate * 0.6 * 100 + result.intonationScore * 0.4)
}
