// Simplified FSRS-inspired spaced repetition scheduler for music practice.
// Stores: stability (days to 90% recall), difficulty (1–10).
// Grades: 1=Again, 2=Hard, 3=Good, 4=Easy

export interface LearnCard {
  id: string
  tuneId: string          // tune_folder from catalog
  tuneTitle: string
  sectionLabel: string    // e.g. "Full tune"
  difficulty: number      // 1.0–10.0, starts at 5
  stability: number       // days until 90% recall, starts at 1
  lastReview: string | null  // ISO date "YYYY-MM-DD" or null if never reviewed
  nextReview: string         // ISO date "YYYY-MM-DD"
  reviews: Array<{ date: string; grade: 1 | 2 | 3 | 4; score: number }>
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function createCard(tuneId: string, tuneTitle: string, sectionLabel = 'Full tune'): LearnCard {
  return {
    id: crypto.randomUUID(),
    tuneId,
    tuneTitle,
    sectionLabel,
    difficulty: 5,
    stability: 1,
    lastReview: null,
    nextReview: addDays(1), // first review tomorrow
    reviews: [],
  }
}

// Grade multipliers on stability:
//   1 (Again) → reset to 1 day
//   2 (Hard)  → ×1.3,  difficulty +0.20
//   3 (Good)  → ×2.0
//   4 (Easy)  → ×2.8,  difficulty −0.15
//
// difficultyFactor: harder items reviewed slightly sooner.
// difficulty=1 → factor 1.00, difficulty=10 → factor 0.50
export function scheduleNext(card: LearnCard, grade: 1 | 2 | 3 | 4, score: number): LearnCard {
  const today = todayIso()
  let newStability: number
  let newDifficulty = card.difficulty

  switch (grade) {
    case 1:
      newStability = 1
      break
    case 2:
      newStability = Math.max(1, card.stability * 1.3)
      newDifficulty = Math.min(10, card.difficulty + 0.2)
      break
    case 3:
      newStability = Math.max(1, card.stability * 2.0)
      break
    case 4:
      newStability = Math.max(1, card.stability * 2.8)
      newDifficulty = Math.max(1, card.difficulty - 0.15)
      break
  }

  const difficultyFactor = 1.0 - (newDifficulty - 1) / 18 // 1.0 … 0.5
  const intervalDays = Math.max(1, Math.round(newStability * difficultyFactor))

  return {
    ...card,
    difficulty: newDifficulty,
    stability: newStability,
    lastReview: today,
    nextReview: addDays(intervalDays),
    reviews: [...card.reviews, { date: today, grade, score }],
  }
}

// Cards due today or overdue, sorted most-overdue first.
// New cards (never reviewed) are appended at the end.
export function getDueCards(cards: LearnCard[]): LearnCard[] {
  const today = todayIso()
  return cards
    .filter(c => c.nextReview <= today)
    .sort((a, b) => {
      if (a.lastReview === null && b.lastReview !== null) return 1
      if (a.lastReview !== null && b.lastReview === null) return -1
      return a.nextReview < b.nextReview ? -1 : a.nextReview > b.nextReview ? 1 : 0
    })
}

// Days until next review (negative = overdue)
export function daysUntilReview(card: LearnCard): number {
  const today = new Date(todayIso())
  const next = new Date(card.nextReview)
  return Math.round((next.getTime() - today.getTime()) / 86_400_000)
}
