'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ChevronRight, RotateCcw, BookOpen } from 'lucide-react'

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

  useEffect(() => {
    fetchDecks()
  }, [fetchDecks])

  const startSession = async (deck: Deck) => {
    setSessionLoading(true)
    setSelectedDeck(deck)
    try {
      const res = await fetch(`/api/osteoupgrade-flashcard-cards?deck_id=${deck.id}`)
      if (res.ok) {
        const data = await res.json()
        const cards: Flashcard[] = data.cards || []
        // Sort: due first, then by due_date
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
        body: JSON.stringify({
          flashcard_id: card.id,
          rating,
          repetition: card.repetition,
          ease: card.ease,
          interval: card.interval,
        }),
      })

      // Re-queue Oublié (rating 1) — max MAX_REQUEUE times per card
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

  const isDone = sessionCards.length > 0 && currentIndex >= sessionCards.length
  const currentCard = sessionCards[currentIndex]
  const isRequeued = currentCard ? (requeueCount[currentCard.id] || 0) > 0 : false

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">OsteoFlash</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    )
  }

  if (!selectedDeck) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4" />
            OsteoFlash
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {decks.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun thème disponible.</p>
          )}
          {decks.map(deck => (
            <div
              key={deck.id}
              className="rounded-lg border p-3 cursor-pointer hover:bg-accent transition-colors"
              onClick={() => startSession(deck)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{deck.name}</span>
                <div className="flex items-center gap-1">
                  {deck.user_due > 0 && (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0">
                      {deck.user_due} à revoir
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <Progress
                value={deck.total_cards > 0 ? (deck.user_reviewed / deck.total_cards) * 100 : 0}
                className="h-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {deck.user_reviewed} / {deck.total_cards} cartes maîtrisées
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (sessionLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">OsteoFlash</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Préparation de la session...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            OsteoFlash — {selectedDeck.name}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setSelectedDeck(null); fetchDecks() }}
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Thèmes
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {currentIndex} / {sessionCards.length} cartes
        </p>
      </CardHeader>
      <CardContent>
        {isDone ? (
          <div className="text-center space-y-3 py-4">
            <p className="text-sm font-medium">Session terminée !</p>
            <p className="text-xs text-muted-foreground">
              {sessionCards.length} cartes révisées
            </p>
            <Button size="sm" onClick={() => { setSelectedDeck(null); fetchDecks() }}>
              Retour aux thèmes
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Card */}
            <div
              className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 cursor-pointer min-h-[120px] flex flex-col justify-between"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div className="flex justify-between items-start">
                <Badge variant="outline" className="text-xs">
                  {isFlipped ? 'Réponse' : 'Question'}
                </Badge>
                {isRequeued && (
                  <Badge variant="secondary" className="text-xs">à revoir</Badge>
                )}
              </div>
              <p className="text-sm mt-2">
                {isFlipped ? currentCard?.back : currentCard?.front}
              </p>
              {isFlipped && currentCard?.explanation && (
                <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                  {currentCard.explanation}
                </p>
              )}
              {!isFlipped && (
                <p className="text-xs text-muted-foreground mt-2">
                  Appuyez pour révéler la réponse
                </p>
              )}
            </div>

            {/* Rating buttons */}
            {isFlipped && (
              <div className="grid grid-cols-4 gap-1">
                {[
                  { rating: 1, label: 'Oublié', variant: 'destructive' as const },
                  { rating: 2, label: 'Difficile', variant: 'outline' as const },
                  { rating: 3, label: 'Bien', variant: 'outline' as const },
                  { rating: 4, label: 'Facile', variant: 'default' as const },
                ].map(({ rating, label, variant }) => (
                  <Button
                    key={rating}
                    variant={variant}
                    size="sm"
                    className="text-xs h-8"
                    disabled={submitting}
                    onClick={() => submitRating(rating)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
            {isFlipped && (
              <p className="text-xs text-muted-foreground text-center">
                Oublié = la carte revient dans cette session
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
