'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Ce que le praticien avait sous les yeux dans le formulaire et perdait ici :
 * qui est le patient, ce sur quoi il faut être vigilant, et ce qui a été fait la
 * dernière fois.
 *
 * Panneau de lecture seule. Toute modification du dossier appartient au
 * formulaire : pendant que le patient est là, on consulte, on ne saisit pas.
 */

export interface HistoryEntry {
  id: string
  history_type: 'traumatic' | 'medical' | 'surgical' | 'family'
  description: string
  is_vigilance?: boolean | number | null
  note?: string | null
}

export interface PastConsultation {
  id: string
  date_time: string
  reason: string
  anamnesis_summary?: string | null
}

export interface PatientSummary {
  fullName: string
  age: number | null
  gender: string | null
  profession?: string | null
  sportActivity?: string | null
}

const HISTORY_LABELS: Record<HistoryEntry['history_type'], string> = {
  medical: 'Médicaux',
  surgical: 'Chirurgicaux',
  traumatic: 'Traumatiques',
  family: 'Familiaux',
}

const HISTORY_ORDER: HistoryEntry['history_type'][] = ['medical', 'surgical', 'traumatic', 'family']

function formatDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1.5 flex w-full items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title}
      </button>
      {open && children}
    </section>
  )
}

interface LivePatientPanelProps {
  patient: PatientSummary
  history: HistoryEntry[]
  pastConsultations: PastConsultation[]
}

export function LivePatientPanel({ patient, history, pastConsultations }: LivePatientPanelProps) {
  const vigilance = history.filter((h) => !!h.is_vigilance)
  const others = history.filter((h) => !h.is_vigilance)

  const identity = [
    patient.age != null ? `${patient.age} ans` : null,
    patient.gender === 'F' ? 'Femme' : patient.gender === 'M' ? 'Homme' : null,
    patient.profession,
    patient.sportActivity,
  ].filter(Boolean) as string[]

  return (
    <div className="flex min-h-full flex-col gap-6 px-5 py-5">
      <div>
        <p className="text-sm font-semibold leading-tight">{patient.fullName}</p>
        {identity.length > 0 && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{identity.join(' · ')}</p>
        )}
      </div>

      {/* La vigilance passe avant tout le reste : c'est ce qui peut changer la
          conduite de la séance, et elle ne doit pas se chercher. */}
      {vigilance.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Vigilance
          </div>
          <ul className="mt-2 space-y-1.5 list-none pl-0 text-[13px] leading-relaxed text-amber-900 dark:text-amber-100">
            {vigilance.map((entry) => (
              <li key={entry.id}>
                {entry.description}
                {entry.note && <span className="block text-xs opacity-80">{entry.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {others.length > 0 && (
        <Section title="Antécédents">
          <div className="space-y-2.5">
            {HISTORY_ORDER.map((type) => {
              const entries = others.filter((h) => h.history_type === type)
              if (entries.length === 0) return null
              return (
                <div key={type}>
                  <p className="text-[11px] font-medium text-muted-foreground">{HISTORY_LABELS[type]}</p>
                  <ul className="mt-1 space-y-1 list-none pl-0 text-[13px] leading-relaxed text-foreground/90">
                    {entries.map((entry) => (
                      <li key={entry.id} className="flex gap-1.5">
                        <span className="shrink-0 opacity-40">·</span>
                        <span className="min-w-0">{entry.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      <Section title={`Consultations passées${pastConsultations.length > 0 ? ` (${pastConsultations.length})` : ''}`}>
        {pastConsultations.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Première consultation.</p>
        ) : (
          <ul className="space-y-2.5 list-none pl-0">
            {pastConsultations.map((consultation) => (
              <li key={consultation.id} className="rounded-xl border bg-card px-3.5 py-2.5">
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {formatDate(consultation.date_time)}
                </p>
                <p className="mt-0.5 text-[13px] font-medium leading-snug">{consultation.reason}</p>
                {/* La phrase de synthèse quand elle existe : sur un patient de
                    suivi, elle dit en une ligne ce qu'on cherchait à relire. */}
                {consultation.anamnesis_summary && (
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">
                    {consultation.anamnesis_summary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className={cn('text-[11px] leading-snug text-muted-foreground/70')}>
        Lecture seule. Le dossier se modifie dans le formulaire, après la consultation.
      </p>
    </div>
  )
}
