'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Dumbbell, Download, Trash2, Plus, Mail, Eye, Sparkles, Pencil, FlaskConical } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ExercisePrescriptionDialog } from '@/components/exercises/exercise-prescription-dialog'
import { AiExerciseGenerationDialog } from '@/components/exercises/ai-exercise-generation-dialog'
import type { ExercisePrescription } from '@/types/exercise'

interface ExercisePrescriptionSectionProps {
  patientId: string
  patientName: string
  consultationId?: string
  consultationData?: {
    reason?: string
    anamnesis?: string
    examination?: string
  }
}

export function ExercisePrescriptionSection({
  patientId,
  patientName,
  consultationId,
  consultationData,
}: ExercisePrescriptionSectionProps) {
  const [prescriptions, setPrescriptions] = useState<ExercisePrescription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showAiDialog, setShowAiDialog] = useState(false)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [editingPrescription, setEditingPrescription] = useState<ExercisePrescription | null>(null)
  const [ebpPrescription, setEbpPrescription] = useState<ExercisePrescription | null>(null)
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

  async function handleDownloadPdf(id: string) {
    try {
      const res = await fetch(`/api/exercise-prescriptions/${id}/pdf`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'programme-exercices.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Erreur lors du téléchargement', variant: 'destructive' })
    }
  }

  async function handleSendEmail(id: string) {
    try {
      const res = await fetch(`/api/exercise-prescriptions/${id}/email`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Erreur lors de l'envoi", variant: 'destructive' })
      } else {
        toast({ title: 'Programme envoyé par email' })
      }
    } catch {
      toast({ title: "Erreur lors de l'envoi", variant: 'destructive' })
    }
  }

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
                  className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setViewingId(p.id)}
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
                  <div className="flex gap-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Consulter" onClick={() => setViewingId(p.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {p.clinical_notes && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-violet-600 hover:text-violet-600" title="Justification EBP" onClick={() => setEbpPrescription(p)}>
                        <FlaskConical className="h-4 w-4" />
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Modifier" onClick={() => setEditingPrescription(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Télécharger le PDF" onClick={() => handleDownloadPdf(p.id)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Envoyer par email" onClick={() => handleSendEmail(p.id)}>
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Supprimer" onClick={() => handleDelete(p.id)}
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
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        patientId={patientId}
        patientName={patientName}
        consultationId={consultationId}
        onSaved={load}
      />

      <ExercisePrescriptionDialog
        open={!!editingPrescription}
        onClose={() => setEditingPrescription(null)}
        patientId={patientId}
        patientName={patientName}
        consultationId={consultationId}
        prescriptionId={editingPrescription?.id}
        initialPrescription={editingPrescription ?? undefined}
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

      {/* EBP justification modal */}
      <Dialog open={!!ebpPrescription} onOpenChange={(o) => !o && setEbpPrescription(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-violet-600" />
              Justification EBP
            </DialogTitle>
          </DialogHeader>
          {ebpPrescription && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">{ebpPrescription.title}</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{ebpPrescription.clinical_notes}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inline PDF viewer */}
      <Dialog open={!!viewingId} onOpenChange={(o) => !o && setViewingId(null)}>
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              {prescriptions.find((p) => p.id === viewingId)?.title ?? "Programme d'exercices"}
            </DialogTitle>
          </DialogHeader>
          {viewingId && (
            <iframe
              src={`/api/exercise-prescriptions/${viewingId}/pdf`}
              className="flex-1 w-full border-0"
              title="Programme d'exercices"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
