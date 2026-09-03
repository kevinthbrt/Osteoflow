'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Ce que le praticien avait sous les yeux dans le formulaire et perdait ici :
 * qui est le patient, ce sur quoi il faut être vigilant, et ce qui a été fait la
 * dernière fois.
 *
 * La couleur a droit de cité ici, contrairement au fil central. Cette colonne
 * est du matériel de référence que l'on balaye du regard : la teinte y sert à
 * retrouver une rubrique, pas à signaler une urgence. Elle n'entre donc pas en
 * concurrence avec le rouge du drapeau, qui reste le seul signal du centre.
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

const HISTORY_STYLES: Record<
  HistoryEntry['history_type'],
  { label: string; icon: string; dot: string; text: string }
> = {
  medical:   { label: 'Médicaux',     icon: '💊', dot: 'bg-rose-400',   text: 'text-rose-600 dark:text-rose-300' },
  surgical:  { label: 'Chirurgicaux', icon: '🔪', dot: 'bg-violet-400', text: 'text-violet-600 dark:text-violet-300' },
  traumatic: { label: 'Traumatiques', icon: '🩹', dot: 'bg-orange-400', text: 'text-orange-600 dark:text-orange-300' },
  family:    { label: 'Familiaux',    icon: '👪', dot: 'bg-sky-400',    text: 'text-sky-600 dark:text-sky-300' },
}

const HISTORY_ORDER: HistoryEntry['history_type'][] = ['medical', 'surgical', 'traumatic', 'family']

/** Teinte de la pastille d'initiales, stable pour un même patient. */
const AVATAR_TINTS = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
]

function tintFor(name: string): string {
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return AVATAR_TINTS[sum % AVATAR_TINTS.length]
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string
  icon: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex w-full items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span aria-hidden="true">{icon}</span>
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
  ].filter(Boolean) as string[]

  return (
    <div className="flex min-h-full flex-col gap-6 px-5 py-5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            tintFor(patient.fullName),
          )}
          aria-hidden="true"
        >
          {initials(patient.fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{patient.fullName}</p>
          {identity.length > 0 && (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{identity.join(' · ')}</p>
          )}
        </div>
      </div>

      {(patient.profession || patient.sportActivity) && (
        <div className="flex flex-wrap gap-1.5">
          {patient.profession && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-500/20 dark:text-slate-200">
              <span aria-hidden="true">💼</span>
              {patient.profession}
            </span>
          )}
          {patient.sportActivity && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-medium text-teal-700 dark:bg-teal-500/20 dark:text-teal-200">
              <span aria-hidden="true">🏃</span>
              {patient.sportActivity}
            </span>
          )}
        </div>
      )}

      {/* La vigilance passe avant tout le reste : c'est ce qui peut changer la
          conduite de la séance, et elle ne doit pas se chercher. */}
      {vigilance.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Vigilance
          </div>
          <ul className="mt-2 list-none space-y-1.5 pl-0 text-[13px] leading-relaxed text-amber-900 dark:text-amber-100">
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
        <Section title="Antécédents" icon="📋">
          <div className="space-y-3">
            {HISTORY_ORDER.map((type) => {
              const entries = others.filter((h) => h.history_type === type)
              if (entries.length === 0) return null
              const style = HISTORY_STYLES[type]
              return (
                <div key={type}>
                  <p className={cn('flex items-center gap-1.5 text-[11px] font-medium', style.text)}>
                    <span aria-hidden="true">{style.icon}</span>
                    {style.label}
                  </p>
                  <ul className="mt-1 list-none space-y-1 pl-0 text-[13px] leading-relaxed text-foreground/90">
                    {entries.map((entry) => (
                      <li key={entry.id} className="flex gap-2">
                        <span className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} aria-hidden="true" />
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

      <Section title={`Consultations${pastConsultations.length > 0 ? ` (${pastConsultations.length})` : ''}`} icon="🗓️">
        {pastConsultations.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Première consultation.</p>
        ) : (
          <ul className="list-none space-y-2.5 pl-0">
            {pastConsultations.map((consultation) => (
              <li
                key={consultation.id}
                className="rounded-xl border border-l-[3px] border-l-primary/50 bg-card px-3.5 py-2.5"
              >
                <p className="text-[11px] font-medium tabular-nums text-primary/80">
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

      <p className="text-[11px] leading-snug text-muted-foreground/70">
        Lecture seule. Le dossier se modifie dans le formulaire, après la consultation.
      </p>
    </div>
  )
}
