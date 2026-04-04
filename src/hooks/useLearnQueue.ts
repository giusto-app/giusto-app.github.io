import { useCallback, useMemo, useState } from 'react'
import {
  type LearnCard,
  createCard,
  scheduleNext,
  getDueCards,
} from '../utils/spaceRepetition'
import { getCards, saveCard, deleteCard } from '../utils/learnStorage'
import { type TuneCatalogEntry } from './useTuneCatalog'

export interface LearnQueueResult {
  dueCards: LearnCard[]
  allCards: LearnCard[]
  addTune: (tune: TuneCatalogEntry, sectionLabel?: string) => LearnCard
  removeCard: (id: string) => void
  submitGrade: (card: LearnCard, grade: 1 | 2 | 3 | 4, score: number) => void
  isAdded: (tuneId: string) => boolean
}

export function useLearnQueue(): LearnQueueResult {
  const [allCards, setAllCards] = useState<LearnCard[]>(() => getCards())

  const dueCards = useMemo(() => getDueCards(allCards), [allCards])

  const addTune = useCallback((tune: TuneCatalogEntry, sectionLabel = 'Full tune'): LearnCard => {
    const card = createCard(tune.tune_folder, tune.title, sectionLabel)
    saveCard(card)
    setAllCards(prev => [card, ...prev])
    return card
  }, [])

  const removeCard = useCallback((id: string) => {
    deleteCard(id)
    setAllCards(prev => prev.filter(c => c.id !== id))
  }, [])

  const submitGrade = useCallback((card: LearnCard, grade: 1 | 2 | 3 | 4, score: number) => {
    const updated = scheduleNext(card, grade, score)
    saveCard(updated)
    setAllCards(prev => prev.map(c => c.id === updated.id ? updated : c))
  }, [])

  const isAdded = useCallback((tuneId: string): boolean => {
    return allCards.some(c => c.tuneId === tuneId)
  }, [allCards])

  return { dueCards, allCards, addTune, removeCard, submitGrade, isAdded }
}
