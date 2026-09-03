'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, UserPen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PatientFieldsDetected } from '@/types/ai'

/**
 * Informations du dossier repérées dans la dictée, à valider une par une.
 *
 * Extrait de l'ancienne dictée pour survivre à sa disparition : c'était la seule
 * fonction qu'elle portait et que le mode consultation n'avait pas. Rien n'est
 * appliqué sans un geste du praticien, une profession mal entendue n'ayant pas à
 * s'inscrire toute seule dans le dossier.
 */

const FIELDS: {
  key: keyof PatientFieldsDetected
  label: string
  color?: string
  format?: (v: string) => string
}[] = [
  { key: 'profession', label: 'Profession' },
  { key: 'sport_activity', label: 'Activité sportive' },
  { key: 'primary_physician', label: 'Médecin traitant' },
  {
    key: 'pregnancy_due_date',
    label: 'Terme grossesse',
    format: (v) => new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
  },
  { key: 'surgical_history', label: 'Chirurgical', color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700' },
  { key: 'trauma_history', label: 'Traumatique', color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700' },
  { key: 'medical_history', label: 'Médical', color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
  { key: 'family_history', label: 'Familial', color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' },
]

interface DetectedPatientFieldsProps {
  fields: PatientFieldsDetected | null
  /** Applique les champs ; résout avec les clés en échec, qui restent affichées. */
  onApply: (fields: PatientFieldsDetected) => Promise<(keyof PatientFieldsDetected)[]> | void
  onDismiss: () => void
}

export function DetectedPatientFields({ fields, onApply, onDismiss }: DetectedPatientFieldsProps) {
  const [pending, setPending] = useState<PatientFieldsDetected | null>(fields)
  useEffect(() => { setPending(fields) }, [fields])

  const drop = useCallback((keys: (keyof PatientFieldsDetected)[]) => {
    setPending((prev) => {
      if (!prev) return null
      const next = { ...prev }
      for (const key of keys) delete next[key]
      return Object.keys(next).length > 0 ? next : null
    })
  }, [])

  const acceptField = useCallback(async (key: keyof PatientFieldsDetected) => {
    if (!pending) return
    const value = pending[key]
    if (value === undefined) return
    const failedKeys = (await onApply({ [key]: value } as PatientFieldsDetected)) || []
    // Échec : on laisse le champ affiché pour permettre de réessayer.
    if (failedKeys.includes(key)) return
    drop([key])
  }, [drop, onApply, pending])

  const acceptAll = useCallback(async () => {
    if (!pending) return
    const failedKeys = (await onApply(pending)) || []
    if (failedKeys.length === 0) { setPending(null); return }
    // On ne garde que les champs qui n'ont pas pu être appliqués.
    setPending((prev) => {
      if (!prev) return null
      const next: PatientFieldsDetected = {}
      for (const key of failedKeys) {
        const value = prev[key]
        // Écriture indexée sur une union de clés : on caste pour éviter que TS
        // n'exige l'intersection des types de valeur (string & string[]).
        if (value !== undefined) (next as Record<string, unknown>)[key] = value
      }
      return Object.keys(next).length > 0 ? next : null
    })
  }, [onApply, pending])

  if (!pending) return null
  const active = FIELDS.filter(({ key }) => pending[key] !== undefined)
  if (active.length === 0) return null

  return (
    <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 dark:border-indigo-800 dark:bg-indigo-950/30">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
        <UserPen className="h-3.5 w-3.5" />
        Informations patient détectées
      </p>
      <div className="space-y-1.5">
        {active.map(({ key, label, color, format }) => {
          const raw = pending[key]
          // Les antécédents sont des tableaux (une entrée par élément) : on les
          // joint pour l'affichage. Les champs plats restent des chaînes.
          const value = Array.isArray(raw) ? raw.join(' • ') : (raw as string)
          return (
            <div key={key} className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-1.5">
                {color && (
                  <span className={`mt-0.5 inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
                    {label}
                  </span>
                )}
                <p className="text-xs leading-relaxed text-indigo-900 dark:text-indigo-200">
                  {!color && <span className="font-medium">{label} : </span>}
                  {format ? format(value) : value}
                </p>
              </div>
              <div className="mt-0.5 flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => acceptField(key)}
                  className="flex h-5 w-5 items-center justify-center rounded text-emerald-700 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                  title="Accepter"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => drop([key])}
                  className="flex h-5 w-5 items-center justify-center rounded text-indigo-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/30"
                  title="Ignorer"
                >
                  <span className="text-[10px] font-bold leading-none">✕</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {active.length > 1 && (
        <div className="flex items-center gap-2 border-t border-indigo-100 pt-0.5 dark:border-indigo-800">
          <Button type="button" size="sm" className="h-7 bg-indigo-600 px-3 text-xs hover:bg-indigo-700" onClick={acceptAll}>
            <Check className="mr-1 h-3 w-3" />
            Valider tout
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-indigo-500"
            onClick={() => { setPending(null); onDismiss() }}
          >
            Tout ignorer
          </Button>
        </div>
      )}
    </div>
  )
}
