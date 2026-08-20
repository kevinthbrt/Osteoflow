'use client'

import { ArrowRight, Check, GraduationCap, Lock } from 'lucide-react'

const OSTEOUPGRADE_URL = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://www.osteo-upgrade.fr'

const AVANTAGES = [
  'E-learning complet, chapitres et quiz notés',
  'Bibliothèque de tests orthopédiques + export PDF',
  'Module pratique en vidéo',
  'OsteoFlash — flashcards de révision',
  'Revue de littérature mensuelle',
]

/**
 * Écran affiché à la place d'une section OsteoUpgrade quand l'offre souscrite
 * ne la comprend pas.
 *
 * Sans lui, la page s'affichait quand même : le serveur ne renvoyant que les
 * contenus marqués en accès libre, l'abonné MyOsteoFlow tombait sur une grille
 * quasi vide sans la moindre explication. Une page vide ressemble à une panne,
 * pas à une limite d'offre — et se signale au support comme telle.
 */
export function OsteoUpgradeLocked({
  titre = 'Cette section fait partie d’OsteoUpgrade',
  description = 'Votre offre couvre MyOsteoFlow : les dossiers patients, la facturation, la comptabilité et l’aide au raisonnement clinique. Les formations relèvent d’OsteoUpgrade.',
}: {
  titre?: string
  description?: string
}) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
        <div className="absolute right-0 top-0 h-48 w-48 -translate-y-1/2 translate-x-1/3 rounded-full bg-white/10 blur-xl" />
        <div className="relative z-10">
          <div className="mb-1 flex items-center gap-2">
            <Lock className="h-4 w-4 text-white/70" />
            <span className="text-sm text-white/70">Non compris dans votre offre</span>
          </div>
          <h1 className="text-2xl font-bold">{titre}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50/60 p-6 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-teal-950/20">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">Ajoutez OsteoUpgrade</p>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">{description}</p>

        <ul className="mb-5 space-y-2">
          {AVANTAGES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-emerald-900/90 dark:text-emerald-200/90">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mb-5 rounded-lg border border-emerald-200 bg-white/70 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/40">
          <p className="text-sm text-emerald-900 dark:text-emerald-200">
            <strong>20 € de plus par mois</strong> pour tout OsteoUpgrade, au lieu de 29,99 € en le
            prenant séparément. Le changement est immédiat et proratisé.
          </p>
        </div>

        {/* Le gestionnaire setWindowOpenHandler d'Electron redirige les URL
            externes vers le navigateur système. */}
        <a
          href={`${OSTEOUPGRADE_URL}/settings/subscription`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
        >
          Changer d&apos;offre
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  )
}
