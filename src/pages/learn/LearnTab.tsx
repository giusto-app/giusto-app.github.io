import { useEffect, useState } from 'react'
import { useLearnQueue } from '../../hooks/useLearnQueue'
import { useTuneCatalog, type TuneCatalogEntry, notesUrl, type TuneNote } from '../../hooks/useTuneCatalog'
import { type LearnCard, daysUntilReview } from '../../utils/spaceRepetition'
import QueueCard from './QueueCard'
import TuneBrowser from './TuneBrowser'
import TuneDetail from './TuneDetail'
import PracticeView from './PracticeView'

type LearnView = 'queue' | 'browse' | 'detail' | 'practice'

// URL hash for a tune detail view — mirrors the lilyJS music-viewer:
//   #tune/{genre_folder}/{tune_folder}   e.g. #tune/Classical/bach_violin_sonata_1_Presto
function tuneHash(tune: TuneCatalogEntry): string {
  return `#tune/${tune.genre_folder}/${tune.tune_folder}`
}

function tuneFromHash(hash: string, tunes: TuneCatalogEntry[]): TuneCatalogEntry | null {
  const raw = (hash.startsWith('#') ? hash.slice(1) : hash).replace(/^tune\//, '')
  if (!raw || raw === hash) return null // no leading "tune/" → not ours
  const [genre, folder] = decodeURIComponent(raw).split('/')
  if (!genre || !folder) return null
  return tunes.find(t => t.genre_folder === genre && t.tune_folder === folder) ?? null
}

export default function LearnTab() {
  const { dueCards, allCards, addTune, removeCard, submitGrade, isAdded } = useLearnQueue()
  const { tunes } = useTuneCatalog()
  const [view, setView] = useState<LearnView>('queue')
  const [selectedTune, setSelectedTune] = useState<TuneCatalogEntry | null>(null)
  const [selectedCard, setSelectedCard] = useState<LearnCard | null>(null)
  const [tuneNotes, setTuneNotes] = useState<TuneNote[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)

  // ── URL hash ↔ detail view ─────────────────────────────────────────────────
  // Opening a tune sets #tune/<genre>/<folder>; reacting to hash changes lets
  // deep links and the browser back button drive the detail view.
  useEffect(() => {
    function syncFromHash() {
      const tune = tuneFromHash(window.location.hash, tunes)
      if (tune) {
        setSelectedTune(tune)
        setView('detail')
      } else if (window.location.hash.startsWith('#tune/')) {
        // Hash points at a tune we don't have (yet) — leave the view as-is.
      } else {
        // Hash cleared (e.g. back button) — leave the detail view.
        setView(v => (v === 'detail' ? 'browse' : v))
      }
    }
    syncFromHash() // run once tunes are available for deep-link restore
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [tunes])

  function openDetail(tune: TuneCatalogEntry) {
    setSelectedTune(tune)
    setView('detail')
    if (window.location.hash !== tuneHash(tune)) window.location.hash = tuneHash(tune)
  }

  function clearTuneHash() {
    // Leaving a tune detail returns to the Learn tab's own hash (#learn),
    // not a bare URL — App.tsx routes the top-level tab off the hash.
    if (window.location.hash.startsWith('#tune/')) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#learn`)
    }
  }

  async function handleStartPractice(tune: TuneCatalogEntry, card: LearnCard) {
    setSelectedTune(tune)
    setSelectedCard(card)
    setTuneNotes([])
    setView('practice')

    setLoadingNotes(true)
    try {
      const resp = await fetch(notesUrl(tune))
      if (resp.ok) {
        const data = await resp.json() as { notes: TuneNote[] }
        setTuneNotes(data.notes ?? [])
      }
    } catch { /* network error — practice continues without reference notes */ }
    finally { setLoadingNotes(false) }
  }

  function handleGrade(grade: 1 | 2 | 3 | 4, score: number) {
    if (selectedCard) submitGrade(selectedCard, grade, score)
    setView('queue')
    setSelectedCard(null)
    setSelectedTune(null)
  }

  // ── Browse view ────────────────────────────────────────────────────────────
  if (view === 'browse') {
    return (
      <TuneBrowser
        isAdded={isAdded}
        onSelect={openDetail}
        onBack={() => setView('queue')}
      />
    )
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  if (view === 'detail' && selectedTune) {
    const existingCard = allCards.find(c => c.tuneId === selectedTune.tune_folder)
    return (
      <TuneDetail
        tune={selectedTune}
        isAdded={isAdded(selectedTune.tune_folder)}
        existingCard={existingCard}
        onBack={() => { clearTuneHash(); setView('browse') }}
        onAdd={() => addTune(selectedTune)}
        onPractice={() => {
          if (existingCard) { clearTuneHash(); handleStartPractice(selectedTune, existingCard) }
        }}
        onRemove={() => {
          if (existingCard) removeCard(existingCard.id)
          clearTuneHash()
          setView('browse')
          setSelectedTune(null)
        }}
      />
    )
  }

  // ── Practice view ──────────────────────────────────────────────────────────
  if (view === 'practice' && selectedTune && selectedCard) {
    return (
      <PracticeView
        card={selectedCard}
        tune={selectedTune}
        tuneNotes={tuneNotes}
        onGrade={handleGrade}
        onCancel={() => { setView('queue'); setSelectedCard(null); setSelectedTune(null) }}
      />
    )
  }

  // ── Queue view ─────────────────────────────────────────────────────────────
  const upcomingCards = allCards.filter(c => daysUntilReview(c) > 0)

  function handleDueCardPress(card: LearnCard) {
    const tune = tunes.find(t => t.tune_folder === card.tuneId)
    if (tune) {
      handleStartPractice(tune, card)
    } else {
      // Catalog not yet loaded — fall back to browse
      setSelectedCard(card)
      setView('browse')
    }
  }

  return (
    <div className="min-h-full flex flex-col px-4 py-6 gap-6">
      <header>
        <h1 className="text-xs font-semibold tracking-[0.2em] uppercase text-[color:var(--neu-fg2)]">
          Learn
        </h1>
      </header>

      {allCards.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-6">
          <div className="w-16 h-16 rounded-2xl neu-inset flex items-center justify-center">
            <BookOpenIcon />
          </div>
          <div>
            <p className="text-base font-bold text-[color:var(--neu-fg)] mb-1">
              No tunes in your queue
            </p>
            <p className="text-sm text-[color:var(--neu-fg2)] leading-relaxed">
              Browse the catalog and add tunes to practice. The app will schedule reviews using spaced repetition — more time on what needs work, less on what you know.
            </p>
          </div>
          <button
            onClick={() => setView('browse')}
            className="neu-btn rounded-2xl px-6 py-3 text-sm font-semibold text-[color:var(--neu-fg)]"
          >
            Browse tunes
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {dueCards.length > 0 ? (
            <section>
              <p className="text-xs font-semibold tracking-widest uppercase text-[color:var(--neu-fg2)] mb-3">
                Due today · {dueCards.length}
              </p>
              <div className="flex flex-col gap-2">
                {dueCards.map(card => (
                  <QueueCard key={card.id} card={card} onPress={handleDueCardPress} />
                ))}
              </div>
            </section>
          ) : (
            <div className="neu-surface rounded-2xl px-4 py-5 flex items-center gap-3">
              <span className="text-2xl">✓</span>
              <div>
                <p className="text-sm font-semibold text-[color:var(--neu-fg)]">All caught up!</p>
                <p className="text-xs text-[color:var(--neu-fg2)]">No reviews due today. Come back tomorrow.</p>
              </div>
            </div>
          )}

          {upcomingCards.length > 0 && (
            <section>
              <p className="text-xs font-semibold tracking-widest uppercase text-[color:var(--neu-fg2)] mb-3">
                Upcoming · {upcomingCards.length}
              </p>
              <div className="flex flex-col gap-2">
                {upcomingCards.slice(0, 5).map(card => (
                  <QueueCard key={card.id} card={card} onPress={_card => setView('browse')} />
                ))}
                {upcomingCards.length > 5 && (
                  <p className="text-xs text-[color:var(--neu-fg2)] text-center">
                    +{upcomingCards.length - 5} more
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Add more tunes */}
          <button
            onClick={() => setView('browse')}
            className="neu-btn rounded-2xl py-3 text-sm font-semibold text-[color:var(--neu-fg2)] w-full"
          >
            + Browse tunes
          </button>
        </div>
      )}

      {loadingNotes && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 neu-surface rounded-full px-4 py-2 text-xs text-[color:var(--neu-fg2)]">
          Loading score…
        </div>
      )}
    </div>
  )
}

function BookOpenIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
      stroke="var(--neu-fg2)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
