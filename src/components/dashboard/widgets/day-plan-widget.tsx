'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ListChecks, Check, ChevronRight, CalendarPlus, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { QuickAddPatientDialog, type QuickAddedPatient } from '@/components/patients/quick-add-patient-dialog'

const VISIBLE_CAP = 6

interface PlanItem {
  id: string
  status: 'pending' | 'done'
  patient: { id: string; first_name: string; last_name: string } | null
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DayPlanWidget() {
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const db = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: practitioner } = await db.from('practitioners').select('id').single()
      if (!practitioner) {
        setItems([])
        return
      }
      setPractitionerId(practitioner.id)
      const { data } = await db
        .from('daily_plan_items')
        .select('id, status, patient:patients (id, first_name, last_name)')
        .eq('practitioner_id', practitioner.id)
        .eq('plan_date', todayStr())
        .order('position', { ascending: true })
      setItems((data as PlanItem[] | null) ?? [])
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const toggleStatus = async (item: PlanItem) => {
    const nextStatus = item.status === 'pending' ? 'done' : 'pending'
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)))
    await db.from('daily_plan_items').update({ status: nextStatus }).eq('id', item.id)
  }

  const handlePatientCreated = async (patient: QuickAddedPatient) => {
    setQuickAddOpen(false)
    if (!practitionerId) return
    const nextPosition = items.length
    const { data, error } = await db
      .from('daily_plan_items')
      .insert({
        practitioner_id: practitionerId,
        patient_id: patient.id,
        plan_date: todayStr(),
        position: nextPosition,
        status: 'pending',
      })
      .select('id, status')
      .single()
    if (!error) {
      setItems((prev) => [...prev, { id: data.id, status: 'pending', patient }])
    }
  }

  const doneCount = items.filter((i) => i.status === 'done').length
  const nextId = items.find((i) => i.status === 'pending')?.id
  const progressPct = items.length > 0 ? (doneCount / items.length) * 100 : 0
  const visibleItems = items.slice(0, VISIBLE_CAP)
  const hiddenCount = items.length - visibleItems.length

  return (
    <Card className="border-border/30 h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <ListChecks className="h-4 w-4 text-orange-500" />
          </div>
          <span className="text-orange-600 dark:text-orange-400">Ma journée</span>
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Ajouter un nouveau patient"
            onClick={() => setQuickAddOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" asChild>
            <Link href="/day-plan">
              Organiser
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-12 bg-muted/30 rounded-lg animate-pulse" />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun patient préparé pour aujourd&apos;hui.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/day-plan">
                <CalendarPlus className="h-4 w-4 mr-1.5" />
                Préparer ma journée
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {doneCount} / {items.length} patient{items.length > 1 ? 's' : ''} vu{doneCount > 1 ? 's' : ''}
                </span>
                {!nextId && (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Journée terminée 🎉</span>
                )}
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              {visibleItems.map((item) => {
                const isNext = item.id === nextId
                const isDone = item.status === 'done'
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${
                      isNext ? 'bg-accent/40 border border-border/50' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleStatus(item)}
                      title={isDone ? 'Marquer à revoir' : 'Marquer comme vu'}
                      className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
                        isDone
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-muted-foreground/40 text-transparent hover:border-orange-400'
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <Link
                      href={`/patients/${item.patient?.id}`}
                      className={`text-sm truncate flex-1 min-w-0 hover:underline ${
                        isDone ? 'text-muted-foreground line-through' : 'font-medium'
                      }`}
                    >
                      {item.patient?.first_name} {item.patient?.last_name}
                    </Link>
                    {isNext && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400 flex-shrink-0">
                        Prochain
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {hiddenCount > 0 && (
              <Link href="/day-plan" className="block text-xs text-muted-foreground hover:underline">
                +{hiddenCount} autre{hiddenCount > 1 ? 's' : ''} patient{hiddenCount > 1 ? 's' : ''}
              </Link>
            )}
          </div>
        )}
      </CardContent>

      <QuickAddPatientDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={handlePatientCreated}
      />
    </Card>
  )
}
