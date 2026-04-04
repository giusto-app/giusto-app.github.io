import { type LearnCard } from './spaceRepetition'

const STORAGE_KEY = 'giusto-learn-v1'
const MAX_CARDS = 500

export function getCards(): LearnCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LearnCard[]) : []
  } catch {
    return []
  }
}

// Upserts by id. New cards are prepended; existing cards are updated in-place.
export function saveCard(card: LearnCard): void {
  const cards = getCards()
  const idx = cards.findIndex(c => c.id === card.id)
  if (idx >= 0) {
    cards[idx] = card
  } else {
    cards.unshift(card)
    if (cards.length > MAX_CARDS) cards.length = MAX_CARDS
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
}

export function deleteCard(id: string): void {
  const cards = getCards().filter(c => c.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
}

export function clearCards(): void {
  localStorage.removeItem(STORAGE_KEY)
}
