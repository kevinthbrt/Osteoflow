'use client'

import { Card, CardContent } from '@/components/ui/card'
import { GraduationCap, ArrowRight, Check } from 'lucide-react'

const OSTEOUPGRADE_URL = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://www.osteo-upgrade.fr'

/**
 * Encart affiché à la place des widgets OsteoUpgrade lorsque l'offre souscrite
 * ne les inclut pas (offre MyOsteoFlow seule).
 *
 * Sans lui, l'utilisateur verrait des widgets vides ou en erreur : les
 * endpoints de contenu répondent 403 pour un compte sans OsteoUpgrade.
 */
export function OsteoUpgradeUpsellWidget() {
  return (
    <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50/60 h-full flex flex-col">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-sm font-semibold text-emerald-900">Ajoutez OsteoUpgrade</p>
        </div>

        <p className="text-xs text-emerald-800/80 leading-relaxed mb-3">
          Votre offre couvre MyOsteoFlow. OsteoUpgrade ajoute la partie clinique,
          directement accessible depuis cet écran.
        </p>

        <ul className="space-y-1.5 mb-4 flex-1">
          {[
            'E-learning complet et quiz',
            'Tests orthopédiques + export PDF',
            'Module pratique en vidéo',
            'OsteoFlash — flashcards',
            'Revue de littérature mensuelle',
          ].map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs text-emerald-900/90">
              <Check className="h-3 w-3 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-lg bg-white/70 border border-emerald-200 px-3 py-2 mb-3">
          <p className="text-[11px] text-emerald-900">
            <strong>20 € de plus par mois</strong> pour tout OsteoUpgrade, au lieu de 29,99 €
            séparément.
          </p>
        </div>

        {/* Le gestionnaire setWindowOpenHandler d'Electron redirige les URL
            externes vers le navigateur système. */}
        <a
          href={`${OSTEOUPGRADE_URL}/settings/subscription`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
        >
          Changer d&apos;offre
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </CardContent>
    </Card>
  )
}
