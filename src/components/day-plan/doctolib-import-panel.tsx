'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarArrowDown, Check, Copy, KeyRound, Loader2, RefreshCw, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { createClient } from '@/lib/db/client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  localDay,
  localTime,
  matchPatient,
  type DoctolibAppointment,
  type MatchablePatient,
  type PatientMatch,
} from '@/lib/doctolib/import'
import { QuickAddPatientDialog, type QuickAddedPatient } from '@/components/patients/quick-add-patient-dialog'

/**
 * Validation, dans « Ma journée », des rendez-vous envoyés par l'extension
 * Doctolib. Rien n'est ajouté sans clic : chaque rendez-vous est associé à un
 * patient du fichier (ou à créer), puis ajouté dans l'ordre de passage.
 */
interface PendingImport {
  receivedAt: string
  date: string | null
  appointments: DoctolibAppointment[]
}

const APP_HEADERS = { 'x-osteoflow-app': '1' }

function formatDay(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`))
}

export function DoctolibImportPanel({
  practitionerId,
  onImported,
}: {
  practitionerId: string | null
  /** Appelé avec le jour importé, pour afficher la journée mise à jour */
  onImported: (date: string) => void
}) {
  const { toast } = useToast()
  const [db] = useState(() => createClient())
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [patients, setPatients] = useState<MatchablePatient[]>([])
  const [inPlan, setInPlan] = useState<Set<string>>(new Set())
  /** Choix faits à la main par rendez-vous : id de patient, ou null pour ignorer */
  const [overrides, setChoices] = useState<Record<string, string | null>>({})
  const [creatingFor, setCreatingFor] = useState<DoctolibAppointment | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPairing, setShowPairing] = useState(false)
  const [code, setCode] = useState<string | null>(null)

  const loadPending = useCallback(async () => {
    try {
      const res = await fetch('/api/doctolib/import', { headers: APP_HEADERS, cache: 'no-store' })
      const data = (await res.json()) as { pending: PendingImport | null }
      setPending(data.pending && data.pending.appointments?.length ? data.pending : null)
    } catch {
      // Hors ligne : on réessaiera au prochain passage.
    }
  }, [])

  // Les rendez-vous arrivent pendant que la page est ouverte : on regarde
  // régulièrement, et dès que la fenêtre reprend le focus.
  useEffect(() => {
    loadPending()
    const timer = setInterval(loadPending, 5000)
    window.addEventListener('focus', loadPending)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', loadPending)
    }
  }, [loadPending])

  const importDate = pending ? pending.date ?? localDay(pending.appointments[0].start) : null

  const loadPatients = useCallback(async () => {
    const { data } = await db
      .from('patients')
      .select('id, first_name, last_name, birth_date')
      .is('archived_at', null)
    setPatients((data as MatchablePatient[] | null) ?? [])
  }, [db])

  useEffect(() => {
    if (pending) loadPatients()
  }, [pending, loadPatients])

  useEffect(() => {
    if (!pending || !practitionerId || !importDate) return
    db.from('daily_plan_items')
      .select('patient_id')
      .eq('practitioner_id', practitionerId)
      .eq('plan_date', importDate)
      .then(({ data }: { data: Array<{ patient_id: string }> | null }) => {
        setInPlan(new Set((data ?? []).map((row) => row.patient_id)))
      })
  }, [pending, practitionerId, importDate, db])

  const matches = useMemo(() => {
    const result: Record<string, PatientMatch> = {}
    for (const appointment of pending?.appointments ?? []) {
      result[appointment.doctolibId] = matchPatient(appointment, patients)
    }
    return result
  }, [pending, patients])

  // Le choix à la main l'emporte ; sinon, le patient trouvé automatiquement.
  // (Calculé à chaque rendu : l'association suit le chargement des patients.)
  const choices = useMemo(() => {
    const result: Record<string, string | null> = {}
    for (const appointment of pending?.appointments ?? []) {
      const id = appointment.doctolibId
      result[id] = id in overrides ? overrides[id] : matches[id]?.patientId ?? null
    }
    return result
  }, [pending, matches, overrides])

  const patientName = (id: string) => {
    const patient = patients.find((p) => p.id === id)
    return patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'
  }

  const selected = (pending?.appointments ?? []).filter((appointment) => {
    const id = choices[appointment.doctolibId]
    return id && !inPlan.has(id)
  })

  const dismiss = async () => {
    await fetch('/api/doctolib/import', { method: 'DELETE', headers: APP_HEADERS })
    setPending(null)
    setChoices({})
  }

  const addToDay = async () => {
    if (!practitionerId || !importDate || selected.length === 0) return
    setSaving(true)
    try {
      const { data: existing } = await db
        .from('daily_plan_items')
        .select('position')
        .eq('practitioner_id', practitionerId)
        .eq('plan_date', importDate)
      let position = ((existing as Array<{ position: number }> | null) ?? []).reduce((max, row) => Math.max(max, row.position + 1), 0)
      const added = new Set<string>()
      for (const appointment of selected) {
        const patientId = choices[appointment.doctolibId]!
        if (added.has(patientId)) continue
        const { error } = await db.from('daily_plan_items').insert({
          practitioner_id: practitionerId,
          patient_id: patientId,
          plan_date: importDate,
          position: position++,
          status: 'pending',
        })
        if (error) throw error
        added.add(patientId)
      }
      await dismiss()
      toast({ title: `${added.size} patient${added.size > 1 ? 's' : ''} ajouté${added.size > 1 ? 's' : ''} à la journée`, variant: 'success' })
      onImported(importDate)
    } catch {
      toast({ title: 'Erreur lors de l’ajout à la journée', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const loadCode = async (regenerate = false) => {
    const res = await fetch('/api/doctolib/pairing', { method: regenerate ? 'POST' : 'GET', headers: APP_HEADERS })
    const data = (await res.json()) as { code?: string }
    setCode(data.code ?? null)
  }

  const onPatientCreated = (patient: QuickAddedPatient) => {
    if (creatingFor) {
      setChoices((previous) => ({ ...previous, [creatingFor.doctolibId]: patient.id }))
    }
    setCreatingFor(null)
    loadPatients()
  }

  // ── Aucun envoi en attente : présentation et appairage ──
  if (!pending) {
    return (
      <section className="max-w-2xl rounded-xl border border-dashed border-border bg-card px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <CalendarArrowDown className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Importer depuis Doctolib.</span>{' '}
            Avec l’extension Osteoflow, envoyez vos rendez-vous Doctolib ici en un clic. Ils restent sur ce poste.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setShowPairing((value) => !value)
              if (!code) loadCode()
            }}
          >
            <KeyRound className="h-4 w-4" />
            Code de l’extension
          </Button>
        </div>
        {showPairing && (
          <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
            <p className="text-muted-foreground">
              Saisissez ce code une fois dans l’extension (icône Osteoflow, puis « Réglages »). Il empêche tout autre site
              d’envoyer des données à Osteoflow.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-muted px-3 py-1.5 font-mono text-base font-semibold tracking-widest">
                {code ?? '…'}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                disabled={!code}
                onClick={() => {
                  if (!code) return
                  navigator.clipboard?.writeText(code).catch(() => {})
                  toast({ title: 'Code copié' })
                }}
              >
                <Copy className="h-4 w-4" />
                Copier
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => loadCode(true)}>
                <RefreshCw className="h-4 w-4" />
                Nouveau code
              </Button>
            </div>
          </div>
        )}
      </section>
    )
  }

  // ── Rendez-vous reçus, à valider ──
  return (
    <section className="max-w-2xl rounded-xl border border-primary/30 bg-card" aria-labelledby="doctolib-import-title">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <CalendarArrowDown className="h-5 w-5 shrink-0 text-accent-foreground" />
        <div className="min-w-0 flex-1">
          <h2 id="doctolib-import-title" className="text-base font-semibold">
            Rendez-vous Doctolib
          </h2>
          <p className="text-[13px] text-muted-foreground first-letter:uppercase">
            {importDate ? formatDay(importDate) : ''} · {pending.appointments.length} rendez-vous reçus
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={dismiss}>
          <X className="h-4 w-4" />
          Ignorer
        </Button>
      </div>

      <ul className="divide-y divide-border/70">
        {pending.appointments.map((appointment) => {
          const match = matches[appointment.doctolibId]
          const choice = choices[appointment.doctolibId] ?? null
          const alreadyInPlan = !!choice && inPlan.has(choice)
          const options = match?.candidates ?? []
          return (
            <li key={appointment.doctolibId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <Checkbox
                checked={!!choice && !alreadyInPlan}
                disabled={!choice || alreadyInPlan}
                onCheckedChange={(checked) => {
                  if (!checked) setChoices((previous) => ({ ...previous, [appointment.doctolibId]: null }))
                }}
                aria-label={`Ajouter ${appointment.firstName} ${appointment.lastName}`}
              />
              <span className="w-12 text-sm font-semibold tabular-nums">{localTime(appointment.start)}</span>
              <span className="min-w-0 flex-1 basis-40">
                <span className="block truncate text-sm font-medium">
                  {appointment.firstName} {appointment.lastName}
                </span>
                {appointment.birthDate && (
                  <span className="block text-[13px] text-muted-foreground">
                    Né{appointment.gender === 'F' ? 'e' : ''} le {new Date(`${appointment.birthDate}T12:00:00`).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </span>

              <span className="flex min-w-0 basis-56 items-center justify-end gap-2 text-[13px]">
                {alreadyInPlan ? (
                  <span className="text-muted-foreground">Déjà dans la journée</span>
                ) : choice ? (
                  <>
                    <span className={cn('flex items-center gap-1 truncate', match?.status === 'exact' ? 'text-success' : 'text-foreground')}>
                      <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                      {match?.status === 'exact' ? 'Dossier trouvé' : patientName(choice)}
                    </span>
                    {options.length > 1 && (
                      <select
                        aria-label="Changer de patient"
                        value={choice}
                        onChange={(event) => setChoices((previous) => ({ ...previous, [appointment.doctolibId]: event.target.value }))}
                        className="h-8 max-w-[10rem] rounded-md border border-input bg-card px-2 text-[13px]"
                      >
                        {options.map((patient) => (
                          <option key={patient.id} value={patient.id}>
                            {patient.first_name} {patient.last_name}
                            {patient.birth_date ? ` (${new Date(`${patient.birth_date}T12:00:00`).toLocaleDateString('fr-FR')})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                ) : options.length > 0 ? (
                  <select
                    aria-label="Choisir le patient"
                    value=""
                    onChange={(event) => setChoices((previous) => ({ ...previous, [appointment.doctolibId]: event.target.value || null }))}
                    className="h-8 max-w-[12rem] rounded-md border border-warning/60 bg-warning-soft px-2 text-[13px] text-warning"
                  >
                    <option value="">
                      {options.length === 1 ? 'Même nom, autre date de naissance…' : 'Plusieurs dossiers possibles…'}
                    </option>
                    {options.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.first_name} {patient.last_name}
                        {patient.birth_date ? ` (${new Date(`${patient.birth_date}T12:00:00`).toLocaleDateString('fr-FR')})` : ''}
                      </option>
                    ))}
                  </select>
                ) : null}
                {!alreadyInPlan && (
                  <Button
                    variant={choice ? 'ghost' : 'outline'}
                    size="sm"
                    className={cn('h-8 gap-1.5', choice && 'px-2 text-muted-foreground')}
                    onClick={() => setCreatingFor(appointment)}
                    title="Créer un dossier avec les informations Doctolib"
                    aria-label={choice ? 'Créer un autre dossier' : undefined}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {!choice && 'Créer le patient'}
                  </Button>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-5 py-3">
        <p className="mr-auto text-[13px] text-muted-foreground">
          Les patients s’ajoutent dans l’ordre des rendez-vous.
        </p>
        <Button onClick={addToDay} disabled={saving || selected.length === 0} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Ajouter {selected.length} patient{selected.length > 1 ? 's' : ''} à la journée
        </Button>
      </div>

      <QuickAddPatientDialog
        open={!!creatingFor}
        onClose={() => setCreatingFor(null)}
        onCreated={onPatientCreated}
        initialValues={creatingFor ? {
          first_name: creatingFor.firstName,
          last_name: creatingFor.lastName,
          birth_date: creatingFor.birthDate ?? undefined,
          gender: creatingFor.gender ?? undefined,
          phone: creatingFor.phone ?? undefined,
          email: creatingFor.email ?? undefined,
        } : undefined}
      />
    </section>
  )
}
