'use client'

import { summariseSignals, type SignalId } from '@/lib/reasoning'
import type { SignalTrace } from './copilot'

interface AnamnesisSummaryProps {
  signals: Partial<Record<SignalId, boolean>>
  traces: Partial<Record<SignalId, SignalTrace>>
}

/**
 * Le relevé, plutôt que la transcription.
 *
 * Une anamnèse dictée fait vingt lignes de langage parlé, avec les hésitations
 * et les redites : illisible d'un coup d'œil pendant la consultation. Ce qui
 * est utile à l'écran, ce sont les éléments retenus. Le texte reste à une
 * bascule, et c'est lui qui part dans le dossier — l'affichage ne change rien
 * à ce qui est enregistré.
 *
 * Chaque élément porte les mots du patient qui l'ont produit, au survol : sans
 * cette vérification, on ferait confiance à une extraction sans jamais pouvoir
 * la contrôler.
 */
export function AnamnesisSummary({ signals, traces }: AnamnesisSummaryProps) {
  const summary = summariseSignals(signals)
  // « Écarté » dit ce que la consultation a démenti, pas ce que la fiche
  // contenait déjà. Lister « moins de 65 ans · moins de 70 ans · patient
  // adulte » à côté d'un vrai « pas d'irradiation dans la jambe » noie le seul
  // élément qui compte : le praticien a bien posé la question, et la réponse
  // était non.
  const absent = summary.absent.filter((item) => traces[item.id]?.source !== 'dossier')

  if (summary.present.length === 0 && absent.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground/50 leading-relaxed">
        Aucun élément relevé pour l’instant — dictez, ou basculez sur le texte pour écrire.
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
          {/* Pas de séparateur : un point médian se retrouve orphelin en fin
              de ligne dès que la liste passe à la ligne. L'espacement suffit. */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 flex-1">
            {section.items.map((item) => (
              <span
                key={item.id}
                title={traces[item.id]?.verbatim ? `« ${traces[item.id]!.verbatim} »` : undefined}
                className="text-[14px] leading-relaxed"
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
