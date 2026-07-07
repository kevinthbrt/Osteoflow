'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  ListChecks,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Check,
  RotateCcw,
  Trash2,
  Plus,
  ChevronsUpDown,
  User,
  UserPlus,
  Camera,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createClient } from '@/lib/db/client'
import { useToast } from '@/hooks/use-toast'
import { QuickAddPatientDialog, type QuickAddedPatient } from '@/components/patients/quick-add-patient-dialog'
import { CaptureDoctolibScheduleDialog } from '@/components/patients/capture-doctolib-schedule-dialog'

interface Patient {
  id: string
  first_name: string
  last_name: string
}

interface PlanItem {
  id: string
  status: 'pending' | 'done'
  position: number
  patient: Patient | null
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

export default function DayPlanPage() {
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [date, setDate] = useState(() => toDateStr(new Date()))
  const [items, setItems] = useState<PlanItem[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [savingOrder, setSavingOrder] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)

  const db = createClient()
  const { toast } = useToast()

  const loadPlan = useCallback(async (pid: string, forDate: string) => {
    setLoading(true)
    try {
      const { data } = await db
        .from('daily_plan_items')
        .select('id, status, position, patient:patients (id, first_name, last_name)')
        .eq('practitioner_id', pid)
        .eq('plan_date', forDate)
        .order('position', { ascending: true })
      setItems((data as PlanItem[] | null) ?? [])
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const { data: practitioner } = await db.from('practitioners').select('id').single()
      if (!practitioner) return
      setPractitionerId(practitioner.id)

      const { data: patientsData } = await db
        .from('patients')
        .select('id, first_name, last_name')
        .is('archived_at', null)
        .order('last_name', { ascending: true })
      setPatients((patientsData as Patient[] | null) ?? [])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (practitionerId) loadPlan(practitionerId, date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, practitionerId])

  const patientIdsInPlan = useMemo(() => new Set(items.map((i) => i.patient?.id)), [items])

  const filteredPatients = useMemo(() => {
    const available = patients.filter((p) => !patientIdsInPlan.has(p.id))
    const q = patientSearch.trim().toLowerCase()
    if (!q) return available
    return available.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q))
  }, [patients, patientIdsInPlan, patientSearch])

  const addPatient = async (patient: Patient) => {
    if (!practitionerId) return
    setAddOpen(false)
    setPatientSearch('')
    try {
      const nextPosition = items.length
      const { data, error } = await db
        .from('daily_plan_items')
        .insert({
          practitioner_id: practitionerId,
          patient_id: patient.id,
          plan_date: date,
          position: nextPosition,
          status: 'pending',
        })
        .select('id, status, position')
        .single()
      if (error) throw error
      setItems((prev) => [...prev, { id: data.id, status: 'pending', position: nextPosition, patient }])
    } catch {
      toast({ title: "Erreur lors de l'ajout du patient", variant: 'destructive' })
    }
  }

  const handlePatientCreated = (patient: QuickAddedPatient) => {
    setPatients((prev) => [...prev, patient].sort((a, b) => a.last_name.localeCompare(b.last_name)))
    setQuickAddOpen(false)
    addPatient(patient)
  }

  const removeItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    await db.from('daily_plan_items').delete().eq('id', id)
  }

  const toggleStatus = async (item: PlanItem) => {
    const nextStatus = item.status === 'pending' ? 'done' : 'pending'
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)))
    await db.from('daily_plan_items').update({ status: nextStatus }).eq('id', item.id)
  }

  const persistOrder = async (ordered: PlanItem[]) => {
    setSavingOrder(true)
    try {
      await Promise.all(
        ordered.map((item, index) =>
          db.from('daily_plan_items').update({ position: index }).eq('id', item.id)
        )
      )
    } finally {
      setSavingOrder(false)
    }
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const arr = [...items]
    ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
    setItems(arr)
    persistOrder(arr)
  }

  const moveDown = (index: number) => {
    if (index >= items.length - 1) return
    const arr = [...items]
    ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
    setItems(arr)
    persistOrder(arr)
  }

  const isToday = date === toDateStr(new Date())
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const doneCount = items.filter((i) => i.status === 'done').length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ListChecks className="h-8 w-8" />
          Ma journée
        </h1>
        <p className="text-muted-foreground mt-1">
          Organisez l&apos;ordre de vos patients et accédez à leur fiche au fil de la journée.
        </p>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setDate((d) => addDays(d, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 min-w-[220px] justify-center">
          <span className="font-medium capitalize">{dateLabel}</span>
          {isToday && <Badge variant="secondary">Aujourd&apos;hui</Badge>}
        </div>
        <Button variant="outline" size="icon" onClick={() => setDate((d) => addDays(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isToday && (
          <Button variant="ghost" size="sm" onClick={() => setDate(toDateStr(new Date()))}>
            Revenir à aujourd&apos;hui
          </Button>
        )}
      </div>

      {/* Add patient */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setPatientSearch('') }}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={addOpen} className="justify-between w-72">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Plus className="h-4 w-4" />
                Ajouter un patient à la journée
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-2 border-b">
              <Input
                placeholder="Rechercher un patient…"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {filteredPatients.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Aucun patient trouvé.</p>
              ) : (
                filteredPatients.map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2"
                    onClick={() => addPatient(p)}
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    {p.last_name} {p.first_name}
                  </button>
                ))
              )}
            </div>
            <div className="border-t p-1">
              <button
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent flex items-center gap-2 text-primary font-medium rounded-md"
                onClick={() => { setAddOpen(false); setQuickAddOpen(true) }}
              >
                <UserPlus className="h-3.5 w-3.5 flex-shrink-0" />
                Créer un nouveau patient
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="outline" onClick={() => setCaptureOpen(true)}>
          <Camera className="h-4 w-4 mr-2" />
          Importer depuis une capture Doctolib
        </Button>
      </div>

      {practitionerId && (
        <CaptureDoctolibScheduleDialog
          open={captureOpen}
          onClose={() => setCaptureOpen(false)}
          practitionerId={practitionerId}
          date={date}
          startPosition={items.length}
          patients={patients}
          existingPatientIds={patientIdsInPlan}
          onImported={() => loadPlan(practitionerId, date)}
        />
      )}

      <QuickAddPatientDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={handlePatientCreated}
      />

      {/* List */}
      <section className="max-w-2xl">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 py-12 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              Aucun patient préparé pour cette journée. Ajoutez-en ci-dessus.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {doneCount} / {items.length} patient{items.length > 1 ? 's' : ''} vu{doneCount > 1 ? 's' : ''}
              {savingOrder && ' · enregistrement…'}
            </p>
            {items.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  item.status === 'done'
                    ? 'border-border/40 bg-muted/20'
                    : 'border-border/60 bg-card'
                }`}
              >
                <span className="w-6 text-center text-sm font-semibold text-muted-foreground flex-shrink-0">
                  {index + 1}
                </span>
                <div className="flex flex-col flex-shrink-0">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="h-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === items.length - 1}
                    className="h-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Link
                  href={`/patients/${item.patient?.id}`}
                  className={`flex-1 min-w-0 font-medium hover:underline ${
                    item.status === 'done' ? 'text-muted-foreground line-through' : ''
                  }`}
                >
                  {item.patient?.first_name} {item.patient?.last_name}
                </Link>

                <Button
                  variant={item.status === 'done' ? 'ghost' : 'outline'}
                  size="sm"
                  className="h-8 gap-1.5 flex-shrink-0"
                  onClick={() => toggleStatus(item)}
                >
                  {item.status === 'done' ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Annuler
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Vu
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
