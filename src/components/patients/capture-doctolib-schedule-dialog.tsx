'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Camera, Loader2, AlertTriangle, Settings } from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { useToast } from '@/hooks/use-toast'
import { parseDoctolibScheduleImage, type DoctolibScheduleEntry } from '@/lib/utils/parse-doctolib-schedule-image'

interface Patient {
  id: string
  first_name: string
  last_name: string
}

interface CaptureSource {
  id: string
  name: string
  thumbnailDataUrl: string
}

interface ElectronCaptureAPI {
  listCaptureSources: () => Promise<{ needsPermission: boolean; sources: CaptureSource[] }>
  openScreenRecordingSettings: () => Promise<void>
}

interface ReviewRow {
  entry: DoctolibScheduleEntry
  included: boolean
  matchedPatientId: string | null
  gender: 'M' | 'F' | ''
  birthDate: string
  phone: string
}

interface CaptureDoctolibScheduleDialogProps {
  open: boolean
  onClose: () => void
  practitionerId: string
  date: string
  startPosition: number
  patients: Patient[]
  existingPatientIds: Set<string>
  onImported: () => void
}

function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function CaptureDoctolibScheduleDialog({
  open,
  onClose,
  practitionerId,
  date,
  startPosition,
  patients,
  existingPatientIds,
  onImported,
}: CaptureDoctolibScheduleDialogProps) {
  const [step, setStep] = useState<'sources' | 'processing' | 'review'>('sources')
  const [needsPermission, setNeedsPermission] = useState(false)
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [loadingSources, setLoadingSources] = useState(false)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [suspectedWrongView, setSuspectedWrongView] = useState(false)
  const [saving, setSaving] = useState(false)
  const db = createClient()
  const { toast } = useToast()

  const getApi = () => (window as unknown as { electronAPI?: ElectronCaptureAPI }).electronAPI

  const loadSources = async () => {
    setLoadingSources(true)
    try {
      const api = getApi()
      if (!api?.listCaptureSources) {
        toast({
          title: 'Capture indisponible',
          description: "Cette fonctionnalité nécessite l'application de bureau MyOsteoFlow.",
          variant: 'destructive',
        })
        return
      }
      const result = await api.listCaptureSources()
      setNeedsPermission(result.needsPermission)
      setSources(result.sources)
    } finally {
      setLoadingSources(false)
    }
  }

  useEffect(() => {
    if (open) {
      setStep('sources')
      setRows([])
      setSuspectedWrongView(false)
      loadSources()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleClose = () => {
    onClose()
  }

  const handleOpenSettings = async () => {
    await getApi()?.openScreenRecordingSettings?.()
  }

  const handlePickSource = async (source: CaptureSource) => {
    setStep('processing')
    try {
      const { entries, suspectedWrongView: wrongView } = await parseDoctolibScheduleImage(source.thumbnailDataUrl)
      if (entries.length === 0) {
        toast({
          title: 'Aucun rendez-vous détecté',
          description: 'Vérifiez que Doctolib est bien sur la vue Journée (pas Semaine ni Mois).',
          variant: 'destructive',
        })
        setStep('sources')
        return
      }
      setSuspectedWrongView(wrongView)
      const reviewRows: ReviewRow[] = entries.map((entry) => {
        const match = patients.find((p) =>
          normalizeName(p.first_name) === normalizeName(entry.firstName) &&
          normalizeName(p.last_name) === normalizeName(entry.lastName)
        )
        return {
          entry,
          included: !(match && existingPatientIds.has(match.id)),
          matchedPatientId: match?.id ?? null,
          gender: '',
          birthDate: '',
          phone: '',
        }
      })
      setRows(reviewRows)
      setStep('review')
    } catch (err) {
      console.error('[capture-doctolib]', err)
      toast({ title: "Erreur lors de l'analyse de l'image", variant: 'destructive' })
      setStep('sources')
    }
  }

  const updateRow = (index: number, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const includedRows = rows.filter((r) => r.included)
  const canConfirm = includedRows.length > 0 && includedRows.every(
    (r) => r.matchedPatientId || (r.gender && r.birthDate && r.phone.trim())
  )

  const handleConfirm = async () => {
    setSaving(true)
    try {
      let position = startPosition
      for (const row of rows) {
        if (!row.included) continue

        let patientId = row.matchedPatientId
        if (!patientId) {
          const { data: patient, error } = await db
            .from('patients')
            .insert({
              practitioner_id: practitionerId,
              gender: row.gender,
              first_name: row.entry.firstName,
              last_name: row.entry.lastName,
              birth_date: row.birthDate,
              phone: row.phone,
            })
            .select('id')
            .single()
          if (error || !patient) throw error ?? new Error('Création du patient échouée')
          patientId = patient.id
        }

        await db.from('daily_plan_items').insert({
          practitioner_id: practitionerId,
          patient_id: patientId,
          plan_date: date,
          position: position++,
          status: 'pending',
        })
      }
      toast({ title: `${includedRows.length} patient${includedRows.length > 1 ? 's' : ''} ajouté${includedRows.length > 1 ? 's' : ''} à la journée` })
      onImported()
      handleClose()
    } catch (err) {
      console.error('[capture-doctolib] import', err)
      toast({ title: "Erreur lors de l'import", variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer depuis une capture Doctolib</DialogTitle>
          <DialogDescription>
            Sélectionnez la fenêtre où Doctolib est affiché, en <strong>vue Journée</strong> (pas Semaine ni Mois,
            qui tronquent les noms). L&apos;analyse se fait entièrement sur cet ordinateur — rien n&apos;est envoyé
            sur internet.
          </DialogDescription>
        </DialogHeader>

        {step === 'sources' && (
          <div className="space-y-4">
            {needsPermission ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-4 space-y-3">
                <p className="text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
                  L&apos;autorisation d&apos;enregistrement d&apos;écran n&apos;est pas activée pour MyOsteoFlow.
                  Activez-la dans Réglages Système, puis relancez l&apos;application.
                </p>
                <Button variant="outline" size="sm" onClick={handleOpenSettings}>
                  <Settings className="h-4 w-4 mr-1.5" />
                  Ouvrir les réglages
                </Button>
              </div>
            ) : loadingSources ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sources.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucune fenêtre détectée. Ouvrez Doctolib puis réessayez.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                {sources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => handlePickSource(source)}
                    className="text-left rounded-lg border border-border/60 overflow-hidden hover:border-primary/50 transition-colors"
                  >
                    <img src={source.thumbnailDataUrl} alt={source.name} className="w-full h-24 object-cover bg-muted" />
                    <p className="text-xs px-2 py-1.5 truncate">{source.name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Lecture de la capture en cours…</p>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            {suspectedWrongView && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
                Cette capture ressemble à une vue Semaine ou Mois — vérifiez le résultat ci-dessous avant de valider,
                ou reprenez la capture en vue Journée.
              </div>
            )}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {rows.map((row, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-3 space-y-2">
                  <label className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={row.included}
                      onChange={(e) => updateRow(i, { included: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">{row.entry.time}</span>
                    <span className="text-sm">{row.entry.firstName} {row.entry.lastName}</span>
                    {row.matchedPatientId ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-auto">Patient existant</span>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto">Nouveau patient</span>
                    )}
                  </label>

                  {row.included && !row.matchedPatientId && (
                    <div className="grid grid-cols-3 gap-2 pl-6">
                      <Select value={row.gender} onValueChange={(v) => updateRow(i, { gender: v as 'M' | 'F' })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Sexe" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Homme</SelectItem>
                          <SelectItem value="F">Femme</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={row.birthDate}
                        onChange={(e) => updateRow(i, { birthDate: e.target.value })}
                      />
                      <Input
                        placeholder="Téléphone"
                        className="h-8 text-xs"
                        value={row.phone}
                        onChange={(e) => updateRow(i, { phone: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Annuler
          </Button>
          {step === 'review' && (
            <Button onClick={handleConfirm} disabled={!canConfirm || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Camera className="h-4 w-4 mr-1.5" />
              Ajouter {includedRows.length > 0 ? `(${includedRows.length})` : ''} à la journée
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type { Patient as CaptureDialogPatient }
