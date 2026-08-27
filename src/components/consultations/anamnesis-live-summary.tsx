'use client'

import { summariseSignals, type SignalId, type SignalSet } from '@/lib/reasoning/signals'
import type { SignalTrace } from '@/components/consultations/use-live-signals'

interface AnamnesisLiveSummaryProps {
  signals: SignalSet
  traces: Partial<Record<SignalId, SignalTrace>>
  /** Rien n'a encore été dit : ce n'est pas le moment d'annoncer un relevé vide. */
  started: boolean
  status?: 'ok' | 'unconfigured' | 'error'
}

/**
 * Le relevé, plutôt que la transcription.
 *
 * Ce qui est utile à l'écran pendant qu'on parle, ce sont les éléments retenus,
 * pas les vingt lignes de langage parlé qui les portent. Le texte reste
 * accessible d'une bascule, et c'est lui qui part dans le dossier — l'affichage
 * ne change rien à ce qui est enregistré.
 *
 * Chaque élément porte au survol les mots du patient qui l'ont produit : sans
 * cette vérification, on ferait confiance à une extraction sans jamais pouvoir
 * la contrôler.
 */
export function AnamnesisLiveSummary({
  signals,
  traces,
  started,
  status = 'ok',
}: AnamnesisLiveSummaryProps) {
  const summary = summariseSignals(signals)
  // « Écarté » dit ce que la consultation a démenti, pas ce que la fiche
  // contenait déjà : lister « moins de 70 ans » à côté d'un vrai « pas
  // d'irradiation dans la jambe » noierait le seul élément qui compte.
  const absent = summary.absent.filter((item) => traces[item.id]?.source !== 'dossier')

  if (summary.present.length === 0 && absent.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
        {status === 'unconfigured'
          ? 'Analyse non configurée — la dictée et la transcription fonctionnent normalement.'
          : status === 'error'
            ? 'Analyse indisponible pour l’instant — la transcription continue.'
            : started
              ? 'Le relevé se remplit à mesure…'
              : 'Dictez : les éléments relevés s’afficheront ici.'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {summary.present.map((section) => (
        <div key={section.group} className="flex gap-3">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/45 w-24 shrink-0 pt-[3px]">
            {section.label}
          </span>
          {/* Pas de séparateur : un point médian se retrouve orphelin en fin de
              ligne dès que la liste passe à la ligne. L'espacement suffit. */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 flex-1">
            {section.items.map((item) => (
              <span
                key={item.id}
                title={traces[item.id]?.verbatim ? `« ${traces[item.id]!.verbatim} »` : undefined}
                className="text-[13.5px] leading-relaxed"
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ))}

      {absent.length > 0 && (
        <div className="flex gap-3 pt-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/35 w-24 shrink-0 pt-[3px]">
            Écarté
          </span>
          <p className="text-[13px] leading-relaxed text-muted-foreground/55 flex-1">
            {absent.map((item) => item.label).join(' · ')}
          </p>
        </div>
      )}
    </div>
  )
}
