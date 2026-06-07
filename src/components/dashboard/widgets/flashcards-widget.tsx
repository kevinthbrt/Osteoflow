'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, ChevronRight, RotateCcw, CheckCircle2, XCircle, AlertCircle, Smile, Trophy } from 'lucide-react'

interface FlashcardDeck {
  id: string
  title: string
  description: string
  total_cards: number
  user_reviewed: number
  user_due: number
}

interface Flashcard {
  id: string
  deck_id: string
  question: string
  answer: string
  explanation: string
  module_name: string
  progress: {
    repetition: number
    next_review_at: string
    last_rating: number
    ease_factor: number
    interval_days: number
  } | null
}

const RATINGS = [
  { value: 1, label: 'Oublié', color: 'bg-red-500 hover:bg-red-600', icon: XCircle },
  { value: 2, label: 'Difficile', color: 'bg-orange-500 hover:bg-orange-600', icon: AlertCircle },
  { value: 3, label: 'Bien', color: 'bg-blue-500 hover:bg-blue-600', icon: CheckCircle2 },
  { value: 4, label: 'Facile', color: 'bg-green-500 hover:bg-green-600', icon: Smile },
]

export function FlashcardsWidget() {
  const [decks, setDecks] = useState<FlashcardDeck[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null)
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sessionDone, setSessionDone] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [loadingCards, setLoadingCards] = useState(false)

  const fetchDecks = useCallback(() => {
    setLoading(true)
    fetch('/api/osteoupgrade-flashcard-decks', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setDecks(d.decks ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchDecks() }, [fetchDecks])

  const startDeck = useCallback(async (deck: FlashcardDeck) => {
    setLoadingCards(true)
    setActiveDeck(deck)
    try {
      const res = await fetch(`/api/osteoupgrade-flashcard-cards?deck_id=${deck.id}`, { cache: 'no-store' })
      const data = await res.json()
      const all: Flashcard[] = data.cards ?? []
      const now = new Date().toISOString()
      const due = all.filter((c) => !c.progress || c.progress.next_review_at <= now)
      const toReview = due.length > 0 ? due : all.slice(0, 20)
      setSessionCards([...toReview].sort(() => Math.random() - 0.5))
      setCurrentIndex(0)
      setFlipped(false)
      setSessionDone(false)
      setRating(null)
    } finally {
      setLoadingCards(false)
    }
  }, [])

  const handleRate = useCallback(async (ratingValue: number) => {
    const card = sessionCards[currentIndex]
    if (!card) return
    setRating(ratingValue)

    await fetch('/api/osteoupgrade-flashcard-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.id, deck_id: card.deck_id, rating: ratingValue }),
    })

    setTimeout(() => {
      if (currentIndex + 1 >= sessionCards.length) {
        setSessionDone(true)
      } else {
        setCurrentIndex((i) => i + 1)
        setFlipped(false)
        setRating(null)
      }
    }, 300)
  }, [sessionCards, currentIndex])

  const exitSession = useCallback(() => {
    setActiveDeck(null)
    setSessionDone(false)
    setFlipped(false)
    setRating(null)
    fetchDecks()
  }, [fetchDecks])

  const currentCard = sessionCards[currentIndex]

  // Session view
  if (activeDeck) {
    return (
      <Card className="border-violet-200 bg-violet-50/30">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center">
                <Brain className="h-3.5 w-3.5 text-white" />
              </div>
              OsteoFlash — {activeDeck.title}
            </CardTitle>
            <button onClick={exitSession} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <RotateCcw className="h-3 w-3" /> Quitter
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loadingCards ? (
            <div className="h-32 bg-muted/40 rounded animate-pulse" />
          ) : sessionDone ? (
            <div className="flex flex-col items-center py-4 gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm font-semibold">Session terminée !</p>
              <p className="text-xs text-muted-foreground">{sessionCards.length} carte{sessionCards.length > 1 ? 's' : ''} révisée{sessionCards.length > 1 ? 's' : ''}</p>
              <button onClick={exitSession} className="text-xs text-violet-600 hover:underline">Retour aux thèmes</button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Progress */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{currentCard?.module_name}</span>
                <span>{currentIndex + 1}/{sessionCards.length}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1">
                <div className="bg-violet-500 h-1 rounded-full transition-all" style={{ width: `${(currentIndex / sessionCards.length) * 100}%` }} />
              </div>

              {/* Card front */}
              {!flipped ? (
                <div
                  onClick={() => setFlipped(true)}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 min-h-[100px] flex flex-col items-center justify-center text-center hover:border-violet-300 transition-colors"
                >
                  <p className="text-xs text-muted-foreground mb-2">Question</p>
                  <p className="text-sm font-medium leading-snug">{currentCard?.question}</p>
                  <p className="text-xs text-slate-400 mt-3">Appuyez pour révéler</p>
                </div>
              ) : (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-2">
                  <p className="text-xs text-violet-500">Réponse</p>
                  <p className="text-sm font-bold text-violet-900">{currentCard?.answer}</p>
                  {currentCard?.explanation && (
                    <p className="text-xs text-slate-600 leading-relaxed border-t border-violet-100 pt-2">{currentCard.explanation}</p>
                  )}
                </div>
              )}

              {/* Rating buttons */}
              {flipped && (
                <div className="grid grid-cols-4 gap-1.5">
                  {RATINGS.map((r) => {
                    const Icon = r.icon
                    return (
                      <button
                        key={r.value}
                        onClick={() => handleRate(r.value)}
                        disabled={rating !== null}
                        className={`flex flex-col items-center gap-1 py-2 rounded-lg text-white text-xs font-semibold transition-all ${
                          rating === r.value ? 'scale-95 opacity-100' : rating !== null ? 'opacity-40' : ''
                        } ${r.color}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {r.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Deck list view
  return (
    <Card className="border-violet-200 bg-violet-50/30">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center">
            <Brain className="h-3.5 w-3.5 text-white" />
          </div>
          OsteoFlash
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-16 bg-muted/40 rounded animate-pulse" />
            <div className="h-16 bg-muted/40 rounded animate-pulse" />
          </div>
        ) : decks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Aucun thème disponible</p>
        ) : (
          <div className="space-y-2">
            {decks.map((deck) => {
              const pct = deck.total_cards > 0
                ? Math.round((deck.user_reviewed / deck.total_cards) * 100)
                : 0
              return (
                <button
                  key={deck.id}
                  onClick={() => startDeck(deck)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-violet-300 hover:bg-violet-50 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">{deck.title}</p>
                    <div className="flex items-center gap-2">
                      {deck.user_due > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700">
                          {deck.user_due}
                        </span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-violet-600" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{deck.user_reviewed}/{deck.total_cards} cartes maîtrisées</span>
                    <span className="font-semibold text-violet-600">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
