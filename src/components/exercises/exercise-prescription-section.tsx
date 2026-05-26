'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Dumbbell, Download, Trash2, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ExercisePrescriptionDialog } from '@/components/exercises/exercise-prescription-dialog'
import type { ExercisePrescription } from '@/types/exercise'

interface ExercisePrescriptionSectionProps {
  patientId: string
  patientName: string
}

export function ExercisePrescriptionSection({
  patientId,
  patientName,
}: ExercisePrescriptionSectionProps) {
  const [prescriptions, setPrescriptions] = useState<ExercisePrescription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/exercise-prescriptions?patient_id=${patientId}`)
      const data = await res.json()
      setPrescriptions(data.prescriptions || [])
    } catch {
      // silent fail
    } finally {
      setIsLoading(false)
    }
  }, [patientId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce programme ?')) return
    try {
      await fetch(`/api/exercise-prescriptions/${id}`, { method: 'DELETE' })
      setPrescriptions((prev) => prev.filter((p) => p.id !== id))
      toast({ title: 'Programme supprimé' })
    } catch {
      toast({ title: 'Erreur lors de la suppression', variant: 'destructive' })
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Programmes d&apos;exercices
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowDialog(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nouveau
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : prescriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun programme créé</p>
          ) : (
            <div className="space-y-2">
              {prescriptions.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.created_at)}
                      {p.items && p.items.length > 0
                        ? ` · ${p.items.length} exercice${p.items.length > 1 ? 's' : ''}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Télécharger le PDF"
                      onClick={() =>
                        window.open(`/api/exercise-prescriptions/${p.id}/pdf`, '_blank')
                      }
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Supprimer"
                      onClick={() => handleDelete(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ExercisePrescriptionDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        patientId={patientId}
        patientName={patientName}
        onSaved={load}
      />
    </>
  )
}
