'use client'

import { Check, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAnamnesisView, type AnamnesisView } from '@/hooks/use-anamnesis-view'

/**
 * Choix du mode d'affichage de l'anamnèse.
 *
 * Le réglage ne touche que la mise en forme : les deux modes lisent et
 * écrivent les mêmes données. On peut donc en changer à tout moment, y compris
 * pour relire d'anciennes consultations, sans rien convertir ni rien perdre.
 */
const MODES: {
  value: AnamnesisView
  titre: string
  description: string
  apercu: React.ReactNode
}[] = [
  {
    value: 'cards',
    titre: 'Cartes',
    description:
      'Les sept rubriques toujours visibles, même vides. Sert de pense-bête pendant l’interrogatoire : ce qui reste blanc est ce qui reste à demander.',
    apercu: (
      <div className="grid grid-cols-2 gap-1">
        {['Histoire', 'Douleur', 'Modulants', 'Antécédents'].map((label) => (
          <div key={label} className="rounded border bg-muted/40 px-1.5 py-1">
            <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <div className="mt-1 h-1 w-3/4 rounded bg-muted-foreground/25" />
            <div className="mt-0.5 h-1 w-1/2 rounded bg-muted-foreground/25" />
          </div>
        ))}
      </div>
    ),
  },
  {
    value: 'summary',
    titre: 'Relevé',
    description:
      'Une ligne par rubrique renseignée, les rubriques vides masquées. Se lit d’un trait comme un compte rendu, plus dense à l’écran.',
    apercu: (
      <div className="space-y-1.5">
        {['Histoire', 'Douleur', 'Modulants'].map((label) => (
          <div key={label} className="flex items-start gap-2">
            <span className="w-12 shrink-0 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <div className="flex-1 space-y-0.5">
              <div className="h-1 w-full rounded bg-muted-foreground/25" />
              <div className="h-1 w-2/3 rounded bg-muted-foreground/25" />
            </div>
          </div>
        ))}
      </div>
    ),
  },
]

export function ConsultationDisplayTab() {
  const { view, ready, setView } = useAnamnesisView()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Affichage de l’anamnèse</CardTitle>
        <CardDescription>
          Comment l’anamnèse dictée s’affiche pendant la consultation et à la relecture. Les deux
          modes enregistrent exactement les mêmes données : changer d’avis ne perd rien, et
          s’applique aussi aux consultations déjà enregistrées.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Chargement…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {MODES.map((mode) => {
              const actif = view === mode.value
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => void setView(mode.value)}
                  aria-pressed={actif}
                  className={cn(
                    'text-left rounded-lg border p-3 transition-colors',
                    actif
                      ? 'border-primary bg-primary/[0.04]'
                      : 'border-border hover:border-foreground/25',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-semibold">{mode.titre}</span>
                    {actif && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                  <div className="rounded-md border bg-background p-2 mb-2">{mode.apercu}</div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{mode.description}</p>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
