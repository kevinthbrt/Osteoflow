'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

const QUOTES = [
  { text: "Le corps humain est le seul mécanisme qui fonctionne mieux avec plus d'utilisation.", author: "Inconnu" },
  { text: "La santé n'est pas tout, mais sans elle, tout n'est rien.", author: "Arthur Schopenhauer" },
  { text: "Le mouvement est la vie.", author: "Andrew Taylor Still" },
  { text: "La structure gouverne la fonction, la fonction modèle la structure.", author: "Andrew Taylor Still" },
  { text: "L'art de guérir vient de la nature, pas du médecin.", author: "Paracelse" },
  { text: "Trouver la santé doit être l'objectif du médecin. N'importe qui peut trouver la maladie.", author: "Andrew Taylor Still" },
  { text: "Le corps possède sa propre médecine. Nous, ostéopathes, permettons simplement à ce médecin intérieur de faire son travail.", author: "Inconnu" },
  { text: "Un esprit sain dans un corps sain.", author: "Juvénal" },
  { text: "La douleur est inévitable. La souffrance est optionnelle.", author: "Haruki Murakami" },
  { text: "Prendre soin des autres commence par prendre soin de soi.", author: "Inconnu" },
  { text: "L'ostéopathie, c'est écouter les murmures du corps avant qu'il ne crie.", author: "Inconnu" },
  { text: "Chaque patient a en lui le médecin qu'il cherche.", author: "Albert Schweitzer" },
  { text: "La fascia est la matrice du corps vivant.", author: "John Upledger" },
  { text: "Traiter la cause, pas le symptôme.", author: "Principe ostéopathique" },
  { text: "Le corps ne ment jamais.", author: "Martha Graham" },
]

export function QuoteWidget() {
  const today = new Date()
  const dayIndex = (today.getFullYear() * 365 + today.getMonth() * 31 + today.getDate()) % QUOTES.length
  const quote = useMemo(() => QUOTES[dayIndex], [dayIndex])

  return (
    <Card className="bg-gradient-to-br from-indigo-500/5 via-violet-500/5 to-purple-500/10 border-primary/15">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 gradient-primary mt-0.5">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Citation du jour</p>
            <blockquote className="text-sm font-medium leading-relaxed italic text-foreground/90">
              &ldquo;{quote.text}&rdquo;
            </blockquote>
            <p className="text-xs text-muted-foreground mt-2">— {quote.author}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
