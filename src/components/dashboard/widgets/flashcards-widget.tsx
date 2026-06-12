'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ChevronRight, RotateCcw, Zap, CheckCircle2, Eye } from 'lucide-react'

interface Deck {
  id: string
  name: string
  description: string
  total_cards: number
  user_reviewed: number
  user_due: number
}

interface Flashcard {
  id: string
  front: string
  back: string
  explanation?: string
  repetition: number
  ease: number
  interval: number
  due_date: string
}

const MAX_REQUEUE = 2

const RATINGS = [
  { rating: 1, label: 'Oublié',   emoji: '😬', className: 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950' },
  { rating: 2, label: 'Difficile', emoji: '😅', className: 'border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950' },
  { rating: 3, label: 'Bien',     emoji: '🙂', className: 'border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950' },
  { rating: 4, label: 'Facile',   emoji: '😎', className: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950' },
]

function SkeletonWidget() {
  return (
    <Card className="border-border/30 h-full flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4 shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center flex-shrink-0">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          OsteoFlash
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="h-16 bg-muted/40 rounded-lg animate-pulse" />
        <div className="h-16 bg-muted/40 rounded-lg animate-pulse" />
        <div className="h-16 bg-muted/40 rounded-lg animate-pulse" />
      </CardContent>
    </Card>
  )
}

export function FlashcardsWidget() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null)
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [requeueCount, setRequeuCount] = useState<Record<string, number>>({})

  const fetchDecks = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/osteoupgrade-flashcard-decks')
      if (res.ok) {
        const data = await res.json()
        setDecks(data.decks || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchDecks() }, [fetchDecks])

  const startSession = async (deck: Deck) => {
    setSessionLoading(true)
    setSelectedDeck(deck)
    try {
      const res = await fetch(`/api/osteoupgrade-flashcard-cards?deck_id=${deck.id}`)
      if (res.ok) {
        const data = await res.json()
        const cards: Flashcard[] = data.cards || []
        const sorted = [...cards].sort((a, b) => {
          const aDue = new Date(a.due_date) <= new Date() ? 0 : 1
          const bDue = new Date(b.due_date) <= new Date() ? 0 : 1
          if (aDue !== bDue) return aDue - bDue
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        })
        setSessionCards(sorted)
        setCurrentIndex(0)
        setIsFlipped(false)
        setRequeuCount({})
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSessionLoading(false)
    }
  }

  const submitRating = async (rating: number) => {
    const card = sessionCards[currentIndex]
    if (!card || submitting) return
    setSubmitting(true)
    try {
      await fetch('/api/osteoupgrade-flashcard-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.id, deck_id: selectedDeck!.id, rating }),
      })
      if (rating === 1) {
        const count = requeueCount[card.id] || 0
        if (count < MAX_REQUEUE) {
          setRequeuCount(prev => ({ ...prev, [card.id]: count + 1 }))
          setSessionCards(prev => [...prev, { ...card }])
        }
      }
      setCurrentIndex(prev => prev + 1)
      setIsFlipped(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading || sessionLoading) return <SkeletonWidget />

  const isDone = sessionCards.length > 0 && currentIndex >= sessionCards.length
  const currentCard = sessionCards[currentIndex]
  const isRequeued = currentCard ? (requeueCount[currentCard.id] || 0) > 0 : false
  const progress = sessionCards.length > 0 ? Math.round((currentIndex / sessionCards.length) * 100) : 0

  /* ── Deck list ── */
  if (!selectedDeck) {
    return (
      <Card className="border-border/30 h-full flex flex-col">
        <CardHeader className="pb-2 pt-4 px-4 shrink-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center flex-shrink-0">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            OsteoFlash
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {decks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Aucun thème disponible.</p>
          ) : (
            decks.map(deck => {
              const pct = deck.total_cards > 0 ? Math.round((deck.user_reviewed / deck.total_cards) * 100) : 0
              return (
                <button
                  key={deck.id}
                  onClick={() => startSession(deck)}
                  className="w-full text-left rounded-xl border border-border/50 bg-card hover:bg-accent/60 hover:border-violet-200 dark:hover:border-violet-800 transition-all duration-150 p-3 group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      {deck.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {deck.user_due > 0 && (
                        <span className="text-[10px] font-semibold bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                          {deck.user_due} à revoir
                        </span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-violet-500 transition-colors" />
                    </div>
                  </div>
                  <Progress value={pct} className="h-1 [&>div]:bg-violet-500" />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {deck.user_reviewed} / {deck.total_cards} maîtrisées · {pct}%
                  </p>
                </button>
              )
            })
          )}
        </CardContent>
      </Card>
    )
  }

  /* ── Session terminée ── */
  if (isDone) {
    return (
      <Card className="border-border/30 h-full flex flex-col">
        <CardHeader className="pb-2 pt-4 px-4 shrink-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center flex-shrink-0">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            OsteoFlash
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">Session terminée !</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sessionCards.length} cartes révisées
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-1 border-violet-200 text-violet-600 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950"
            onClick={() => { setSelectedDeck(null); fetchDecks() }}
          >
            <RotateCcw className="h-3 w-3 mr-1.5" />
            Retour aux thèmes
          </Button>
        </CardContent>
      </Card>
    )
  }

  /* ── Session active ── */
  return (
    <Card className="border-border/30 h-full flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center flex-shrink-0">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="truncate max-w-[130px]">{selectedDeck.name}</span>
          </CardTitle>
          <button
            onClick={() => { setSelectedDeck(null); fetchDecks() }}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors"
          >
            <RotateCcw className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="mt-2 space-y-1">
          <Progress value={progress} className="h-1.5 [&>div]:bg-violet-500" />
          <p className="text-[11px] text-muted-foreground">
            {currentIndex} / {sessionCards.length} cartes
          </p>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 flex flex-col gap-3">
        {/* Flashcard */}
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className={`rounded-xl border-2 cursor-pointer transition-all duration-200 p-4 flex flex-col select-none
            ${isFlipped
              ? 'border-violet-300 bg-violet-50/60 dark:border-violet-700 dark:bg-violet-950/30'
              : 'border-border/50 bg-muted/30 hover:border-violet-200 hover:bg-muted/50 dark:hover:border-violet-800'
            }`}
        >
          {/* Question — always visible */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              Question
            </span>
            <div className="flex items-center gap-1">
              {isRequeued && (
                <span className="text-[10px] bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium">
                  à revoir
                </span>
              )}
              {!isFlipped && <Eye className="h-3.5 w-3.5 text-muted-foreground/50" />}
            </div>
          </div>
          <p className={`leading-relaxed ${isFlipped ? 'text-xs text-muted-foreground' : 'text-sm'}`}>
            {currentCard?.front}
          </p>

          {/* Answer — only when flipped */}
          {isFlipped && (
            <>
              <div className="border-t border-violet-200/50 dark:border-violet-800/50 mt-3 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300">
                  Réponse
                </span>
                <p className="text-sm font-medium text-violet-900 dark:text-violet-200 mt-1 leading-relaxed">
                  {currentCard?.back}
                </p>
              </div>
              {currentCard?.explanation && (
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-violet-200/50 dark:border-violet-800/50 leading-relaxed">
                  {currentCard.explanation}
                </p>
              )}
            </>
          )}

          {!isFlipped && (
            <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
              <Eye className="h-3 w-3" /> Appuyez pour révéler
            </p>
          )}
        </div>

        {/* Rating buttons */}
        {isFlipped && (
          <div className="grid grid-cols-4 gap-1.5">
            {RATINGS.map(({ rating, label, emoji, className }) => (
              <button
                key={rating}
                disabled={submitting}
                onClick={() => submitRating(rating)}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border py-2 text-[11px] font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
              >
                <span className="text-base leading-none">{emoji}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
