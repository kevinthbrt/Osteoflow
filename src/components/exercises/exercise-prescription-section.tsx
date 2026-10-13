'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Dumbbell, Plus, Sparkles, Smartphone, Activity, ChevronRight, AlertTriangle } from 'lucide-react'
import { ExercisePrescriptionDialog } from '@/components/exercises/exercise-prescription-dialog'
import { AiExerciseGenerationDialog } from '@/components/exercises/ai-exercise-generation-dialog'
import { AdherenceReportDialog } from '@/components/exercises/adherence-report-dialog'
import { UsagePill } from '@/components/exercises/patient-exercises-tab'
import { copyPatientLink } from '@/components/exercises/copy-patient-link'
import { LegacyExercisePrescriptionSection, type ExercisePrescriptionSectionProps } from '@/components/exercises/legacy-exercise-prescription-section'
import { useEntitlements } from '@/hooks/use-entitlements'
import type { ProgramView } from '@/lib/exercises/programs'
import type { ExercisePrescription } from '@/types/exercise'

/**
 * Programmes par étapes pour les comptes qui y ont accès (fonction en test),
 * section habituelle pour les autres.
 */
export function ExercisePrescriptionSection(props: ExercisePrescriptionSectionProps) {
  const { features, loading } = useEntitlements()
  if (loading) return null
  return features.includes('programmes') ? <ProgramsSummarySection {...props} /> : <LegacyExercisePrescriptionSection {...props} />
}

/**
 * Résumé des programmes du patient (dossier, consultation). Le détail, les
 * étapes et le suivi sont dans l'onglet « Exercices » du dossier.
 */
function ProgramsSummarySection({
  patientId,
  patientName,
  consultationId,
  consultationData,
}: ExercisePrescriptionSectionProps) {
  const [programs, setPrograms] = useState<ProgramView[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showAiDialog, setShowAiDialog] = useState(false)
  const [reportFor, setReportFor] = useState<ExercisePrescription | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/exercise-programs?patient_id=${patientId}`)
      const data = await res.json()
      setPrograms(data.programs || [])
    } catch {
      // silent fail
    } finally {
      setIsLoading(false)
    }
  }, [patientId])

  useEffect(() => { load() }, [load])

  const active = programs.filter(p => p.status === 'active')
  const ended = programs.length - active.length
  const tabHref = `/patients/${patientId}?tab=exercices`

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Programmes d&apos;exercices
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAiDialog(true)}>
              <Sparkles className="mr-1 h-4 w-4 text-primary" />
              IA
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Nouveau
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : active.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun programme en cours</p>
          ) : (
            active.map(p => {
              const current = p.phases[p.current_phase]
              return (
                <div key={p.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`${tabHref}#programme-${p.id}`} className="min-w-0 hover:underline">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.phases.length > 1 ? `Étape ${p.current_phase + 1} sur ${p.phases.length}` : `${current?.items?.length ?? 0} exercice${(current?.items?.length ?? 0) > 1 ? 's' : ''}`}
                      </p>
                    </Link>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {current && (
                        <>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Copier le lien de l’appli patient" onClick={() => copyPatientLink(current.id, toast).then(load)}>
                            <Smartphone className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Importer le bilan du patient" onClick={() => setReportFor({ ...current, program_id: p.id })}>
                            <Activity className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Ouvrir dans l’onglet Exercices" asChild>
                        <Link href={`${tabHref}#programme-${p.id}`}><ChevronRight className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <UsagePill usage={p.usage} />
                    {p.link_out_of_date && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5" />Lien à renvoyer
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
          {!isLoading && (ended > 0 || programs.length > 0) && (
            <Link href={tabHref} className="block text-xs text-primary hover:underline pt-1">
              Ouvrir l&apos;onglet Exercices{ended > 0 ? ` (${ended} programme${ended > 1 ? 's' : ''} arrêté${ended > 1 ? 's' : ''})` : ''}
            </Link>
          )}
        </CardContent>
      </Card>

      <ExercisePrescriptionDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        patientId={patientId}
        patientName={patientName}
        consultationId={consultationId}
        onSaved={load}
      />

      <AiExerciseGenerationDialog
        open={showAiDialog}
        onClose={() => setShowAiDialog(false)}
        patientId={patientId}
        patientName={patientName}
        consultationId={consultationId}
        consultationData={consultationData}
        onSaved={load}
      />

      <AdherenceReportDialog open={!!reportFor} onClose={() => setReportFor(null)} prescription={reportFor} onSaved={load} />
    </>
  )
}
