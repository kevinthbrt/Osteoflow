'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Sparkles, Loader2, ChevronLeft, Dumbbell, X, Download, Mail } from 'lucide-react'

interface Patient {
  id: string
  first_name: string
  last_name: string
  birth_date?: string | null
  gender?: 'M' | 'F' | null
  profession?: string | null
  sport_activity?: string | null
  trauma_history?: string | null
  medical_history?: string | null
  surgical_history?: string | null
}

interface GeneratedItem {
  exercise: {
    id: string
    name: string
    description: string | null
    region: string
    type: string
    level: number
    illustration_url?: string | null
    nerve_target?: string | null
    progression_regression?: string | null
  }
  sets?: number | null
  reps?: string | null
  hold_time?: number | null
  rest_time?: number | null
  frequency?: string | null
  notes?: string | null
}

export interface AiExerciseGenerationDialogProps {
  open: boolean
  onClose: () => void
  patientId: string
  patientName: string
  consultationId?: string
  consultationData?: {
    reason?: string
    anamnesis?: string
    examination?: string
  }
  onSaved: () => void
}

function calcAge(birthDate?: string | null): number | null {
  if (!birthDate) return null
  const d = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
  return age
}

const LEVEL_INFO = {
  1: { label: 'Niveau 1', desc: 'Mobilisation douce, activation légère' },
  2: { label: 'Niveau 2', desc: 'Stabilisation, propioception' },
  3: { label: 'Niveau 3', desc: 'Renforcement fonctionnel' },
} as const

export function AiExerciseGenerationDialog({
  open, onClose, patientId, patientName, consultationId, consultationData, onSaved,
}: AiExerciseGenerationDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<'config' | 'preview'>('config')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loadingPatient, setLoadingPatient] = useState(false)

  // Config
  const [includeAge, setIncludeAge] = useState(true)
  const [includeGender, setIncludeGender] = useState(true)
  const [includeProfession, setIncludeProfession] = useState(true)
  const [includeSport, setIncludeSport] = useState(true)
  const [includeTrauma, setIncludeTrauma] = useState(true)
  const [includeMedical, setIncludeMedical] = useState(true)
  const [includeSurgical, setIncludeSurgical] = useState(true)
  const [diagnostic, setDiagnostic] = useState('')
  const [level, setLevel] = useState<1 | 2 | 3>(2)
  const [maxDuration, setMaxDuration] = useState(30)
  const [generating, setGenerating] = useState(false)

  // Preview
  const [prescriptionTitle, setPrescriptionTitle] = useState('')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [items, setItems] = useState<GeneratedItem[]>([])
  const [actionLoading, setActionLoading] = useState<'save' | 'pdf' | 'email' | null>(null)
  const savedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) { setStep('config'); setPatient(null); savedIdRef.current = null; return }
    setLoadingPatient(true)
    fetch(`/api/patients/${patientId}`)
      .then(r => r.json())
      .then(d => setPatient(d.patient || null))
      .catch(() => {})
      .finally(() => setLoadingPatient(false))
  }, [open, patientId])

  const age = calcAge(patient?.birth_date)

  const factors = [
    { id: 'age', label: 'Âge', value: age ? `${age} ans` : null, state: includeAge, set: setIncludeAge },
    { id: 'gender', label: 'Sexe', value: patient?.gender === 'M' ? 'Homme' : patient?.gender === 'F' ? 'Femme' : null, state: includeGender, set: setIncludeGender },
    { id: 'profession', label: 'Profession', value: patient?.profession || null, state: includeProfession, set: setIncludeProfession },
    { id: 'sport', label: 'Sport / Activité', value: patient?.sport_activity || null, state: includeSport, set: setIncludeSport },
    { id: 'trauma', label: 'Antéc. traumatiques', value: patient?.trauma_history ? '✓ renseignés' : null, state: includeTrauma, set: setIncludeTrauma },
    { id: 'medical', label: 'Antéc. médicaux', value: patient?.medical_history ? '✓ renseignés' : null, state: includeMedical, set: setIncludeMedical },
    { id: 'surgical', label: 'Antéc. chirurgicaux', value: patient?.surgical_history ? '✓ renseignés' : null, state: includeSurgical, set: setIncludeSurgical },
  ]

  async function handleGenerate() {
    if (!diagnostic.trim()) {
      toast({ title: 'Saisissez un diagnostic pour guider l\'IA', variant: 'destructive' })
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/generate-exercise-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: {
            age,
            gender: patient?.gender,
            profession: patient?.profession,
            sport_activity: patient?.sport_activity,
            trauma_history: patient?.trauma_history,
            medical_history: patient?.medical_history,
            surgical_history: patient?.surgical_history,
          },
          consultation: consultationData,
          diagnostic: diagnostic.trim(),
          include_factors: {
            age: includeAge,
            gender: includeGender,
            profession: includeProfession,
            sport: includeSport,
            trauma: includeTrauma,
            medical: includeMedical,
            surgical: includeSurgical,
          },
          level,
          max_duration_minutes: maxDuration,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'Erreur lors de la génération', variant: 'destructive' })
        return
      }
      setPrescriptionTitle(data.title)
      setClinicalNotes(data.clinical_notes)
      setItems(data.items || [])
      setStep('preview')
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  async function ensureSaved(): Promise<string | null> {
    if (savedIdRef.current) return savedIdRef.current
    if (items.length === 0) {
      toast({ title: 'Aucun exercice à sauvegarder', variant: 'destructive' })
      return null
    }
    const res = await fetch('/api/exercise-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patientId,
        consultation_id: consultationId || null,
        title: prescriptionTitle,
        notes: clinicalNotes,
        items,
      }),
    })
    if (!res.ok) {
      const d = await res.json()
      toast({ title: d.error || 'Erreur lors de la sauvegarde', variant: 'destructive' })
      return null
    }
    const d = await res.json()
    const id: string = d.prescription?.id
    savedIdRef.current = id
    onSaved()
    return id
  }

  async function handleSave() {
    setActionLoading('save')
    try {
      const id = await ensureSaved()
      if (!id) return
      toast({ title: 'Programme sauvegardé' })
      onClose()
      setStep('config')
      setDiagnostic('')
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleExportPdf() {
    setActionLoading('pdf')
    try {
      const id = await ensureSaved()
      if (!id) return
      toast({ title: 'Programme sauvegardé — génération du PDF…' })
      const res = await fetch(`/api/exercise-prescriptions/${id}/pdf`)
      if (!res.ok) { toast({ title: 'Erreur PDF', variant: 'destructive' }); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'programme-exercices.pdf'
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSendEmail() {
    setActionLoading('email')
    try {
      const id = await ensureSaved()
      if (!id) return
      toast({ title: 'Programme sauvegardé — envoi par email…' })
      const res = await fetch(`/api/exercise-prescriptions/${id}/email`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) {
        toast({ title: d.error || "Erreur lors de l'envoi", variant: 'destructive' })
      } else {
        toast({ title: 'Programme envoyé par email' })
        onClose(); setStep('config'); setDiagnostic('')
      }
    } catch {
      toast({ title: 'Erreur réseau', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {step === 'config' ? "Générer un programme avec l'IA" : 'Proposition du programme IA'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{patientName}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* CONFIG STEP */}
          {step === 'config' && (
            <div className="p-6 space-y-6">
              {/* Patient factors */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Facteurs patient à prendre en compte</Label>
                {loadingPatient ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement du dossier...
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {factors.map(f => (
                      <div key={f.id} className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${!f.value ? 'opacity-50' : ''}`}>
                        <Checkbox
                          id={f.id}
                          checked={f.state && !!f.value}
                          disabled={!f.value}
                          onCheckedChange={v => f.set(!!v)}
                          className="mt-0.5 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <Label htmlFor={f.id} className="text-xs font-medium cursor-pointer leading-tight">{f.label}</Label>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {f.value || 'Non renseigné'}
                          </p>
                        </div>
                      </div>
                    ))}
                    {consultationData?.anamnesis && (
                      <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-2.5 col-span-2">
                        <Checkbox id="anamnesis" checked disabled className="mt-0.5 flex-shrink-0" />
                        <div>
                          <Label className="text-xs font-medium">Anamnèse de la consultation</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">✓ incluse automatiquement</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Diagnostic */}
              <div className="space-y-2">
                <Label htmlFor="diagnostic" className="text-sm font-medium">
                  Diagnostic du praticien <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="diagnostic"
                  placeholder="Ex : Lombalgie commune non spécifique, prédominance droite, composante musculaire paravertébrale..."
                  value={diagnostic}
                  onChange={e => setDiagnostic(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Level */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Niveau d&apos;intensité</Label>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(l)}
                      className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                        level === l
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${level === l ? 'text-primary' : ''}`}>{LEVEL_INFO[l].label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{LEVEL_INFO[l].desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex justify-between">
                  <span>Durée maximale de séance</span>
                  <span className="font-normal text-muted-foreground">{maxDuration} min</span>
                </Label>
                <input
                  type="range" min={10} max={60} step={5}
                  value={maxDuration}
                  onChange={e => setMaxDuration(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>10 min</span><span>60 min</span>
                </div>
              </div>
            </div>
          )}

          {/* PREVIEW STEP */}
          {step === 'preview' && (
            <div className="p-6 space-y-4">
              {clinicalNotes && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1.5">Justification clinique EBP</p>
                  <p className="text-sm text-foreground leading-relaxed">{clinicalNotes}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="presc-title" className="text-sm font-medium">Titre du programme</Label>
                <input
                  id="presc-title"
                  type="text"
                  value={prescriptionTitle}
                  onChange={e => setPrescriptionTitle(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {items.length} exercice{items.length > 1 ? 's' : ''} proposé{items.length > 1 ? 's' : ''}
                </Label>
                {items.map((item, i) => (
                  <div key={`${item.exercise.id}-${i}`} className="rounded-lg border p-3 flex gap-3">
                    {item.exercise.illustration_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.exercise.illustration_url}
                        alt=""
                        className="w-14 h-14 object-cover rounded-md flex-shrink-0 bg-muted"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{item.exercise.name}</p>
                        <button
                          type="button"
                          onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive flex-shrink-0 mt-0.5"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.exercise.region} · Niveau {item.exercise.level}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {item.sets != null && <span className="text-xs bg-muted rounded px-1.5 py-0.5">{item.sets} séries</span>}
                        {item.reps && <span className="text-xs bg-muted rounded px-1.5 py-0.5">{item.reps} rép.</span>}
                        {item.hold_time != null && <span className="text-xs bg-muted rounded px-1.5 py-0.5">{item.hold_time}s</span>}
                        {item.rest_time != null && <span className="text-xs bg-muted rounded px-1.5 py-0.5">Repos {item.rest_time}s</span>}
                        {item.frequency && <span className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5">{item.frequency}</span>}
                      </div>
                      {item.notes && <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t flex-shrink-0">
          {step === 'config' ? (
            <>
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleGenerate} disabled={generating || !diagnostic.trim()}>
                {generating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Génération en cours…</>  
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />Générer le programme</>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('config')} disabled={!!actionLoading}>
                <ChevronLeft className="mr-1 h-4 w-4" />Modifier
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportPdf}
                  disabled={!!actionLoading || items.length === 0}
                  title="Sauvegarder et télécharger le PDF"
                >
                  {actionLoading === 'pdf'
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Download className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSendEmail}
                  disabled={!!actionLoading || items.length === 0}
                  title="Sauvegarder et envoyer par email"
                >
                  {actionLoading === 'email'
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Mail className="h-4 w-4" />}
                </Button>
                <Button onClick={handleSave} disabled={!!actionLoading || items.length === 0}>
                  {actionLoading === 'save' ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sauvegarde…</>
                  ) : (
                    <><Dumbbell className="mr-2 h-4 w-4" />Sauvegarder</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
