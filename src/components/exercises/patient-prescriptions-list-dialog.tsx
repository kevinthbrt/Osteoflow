'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Dumbbell, Loader2, Plus, Pencil, Download, Mail, Trash2 } from 'lucide-react'
import { ExercisePrescriptionDialog } from './exercise-prescription-dialog'
import type { ExercisePrescription } from '@/types/exercise'

interface Props {
  open: boolean
  onClose: () => void
  patientId: string
  patientName: string
  consultationId?: string
  refreshKey?: number
}

export function PatientPrescriptionsListDialog({
  open,
  onClose,
  patientId,
  patientName,
  consultationId,
  refreshKey = 0,
}: Props) {
  const [prescriptions, setPrescriptions] = useState<ExercisePrescription[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editingPrescription, setEditingPrescription] = useState<ExercisePrescription | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const { toast } = useToast()

  const fetchPrescriptions = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/exercise-prescriptions?patient_id=${patientId}`)
      const data = await res.json()
      setPrescriptions(data.prescriptions || [])
    } catch {
      toast({ title: 'Impossible de charger les fiches', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [patientId, toast])

  useEffect(() => {
    if (open) fetchPrescriptions()
  }, [open, fetchPrescriptions, refreshKey])

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Supprimer la fiche "${title}" ?`)) return
    try {
      await fetch(`/api/exercise-prescriptions/${id}`, { method: 'DELETE' })
      setPrescriptions((prev) => prev.filter((p) => p.id !== id))
      toast({ title: 'Fiche supprimée' })
    } catch {
      toast({ title: 'Erreur lors de la suppression', variant: 'destructive' })
    }
  }

  async function handleDownloadPdf(id: string) {
    try {
      const res = await fetch(`/api/exercise-prescriptions/${id}/pdf`)
      if (!res.ok) throw new Error()
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
      toast({ title: 'Erreur lors du téléchargement PDF', variant: 'destructive' })
    }
  }

  async function handleEmail(id: string) {
    try {
      const res = await fetch(`/api/exercise-prescriptions/${id}/email`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Erreur lors de l'envoi email", variant: 'destructive' })
      } else {
        toast({ title: 'Fiche envoyée par email' })
      }
    } catch {
      toast({ title: "Erreur lors de l'envoi email", variant: 'destructive' })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl w-full max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-primary" />
                Fiches exercices — {patientName}
              </DialogTitle>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nouvelle fiche
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Chargement...
              </div>
            ) : prescriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                <Dumbbell className="h-10 w-10 opacity-20" />
                <p className="text-sm">Aucune fiche exercices pour ce patient</p>
              </div>
            ) : (
              prescriptions.map((p) => (
                <div key={p.id} className="rounded-lg border p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                      {p.items && p.items.length > 0 && (
                        <span className="ml-2">· {p.items.length} exercice{p.items.length > 1 ? 's' : ''}</span>
                      )}
                    </p>
                    {p.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Modifier"
                      onClick={() => setEditingPrescription(p)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Télécharger PDF"
                      onClick={() => handleDownloadPdf(p.id)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Envoyer par email"
                      onClick={() => handleEmail(p.id)}
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Supprimer"
                      onClick={() => handleDelete(p.id, p.title)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit existing prescription */}
      {editingPrescription && (
        <ExercisePrescriptionDialog
          open={!!editingPrescription}
          onClose={() => setEditingPrescription(null)}
          patientId={patientId}
          patientName={patientName}
          prescriptionId={editingPrescription.id}
          initialPrescription={editingPrescription}
          onSaved={() => {
            setEditingPrescription(null)
            fetchPrescriptions()
          }}
        />
      )}

      {/* Create new prescription */}
      <ExercisePrescriptionDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        patientId={patientId}
        patientName={patientName}
        consultationId={consultationId}
        onSaved={() => {
          setShowCreate(false)
          fetchPrescriptions()
        }}
      />
    </>
  )
}
