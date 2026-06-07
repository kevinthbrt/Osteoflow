'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useToast } from '@/hooks/use-toast'
import {
  Search,
  X,
  Download,
  Save,
  Plus,
  ChevronUp,
  ChevronDown,
  Loader2,
  Dumbbell,
  BookMarked,
  FolderOpen,
  Trash2,
  Mail,
} from 'lucide-react'
import type {
  RehabExercise,
  ExercisePrescriptionItemDraft,
  ExercisePrescriptionTemplate,
  ExercisePrescription,
} from '@/types/exercise'

const TYPE_COLORS: Record<string, string> = {
  renfo: 'bg-blue-100 text-blue-800',
  étirement: 'bg-orange-100 text-orange-800',
  mobilité: 'bg-green-100 text-green-800',
  neurodynamique: 'bg-purple-100 text-purple-800',
  proprio: 'bg-yellow-100 text-yellow-800',
  'renfo doux': 'bg-teal-100 text-teal-800',
}

const FREQUENCY_OPTIONS = [
  '1x/jour',
  '2x/jour',
  '3x/semaine',
  'Quotidien',
  'Selon douleur',
]

interface ExercisePrescriptionDialogProps {
  open: boolean
  onClose: () => void
  patientId: string
  patientName: string
  consultationId?: string
  prescriptionId?: string
  initialPrescription?: ExercisePrescription
  onSaved?: () => void
}

export function ExercisePrescriptionDialog({
  open,
  onClose,
  patientId,
  patientName,
  consultationId,
  prescriptionId,
  initialPrescription,
  onSaved,
}: ExercisePrescriptionDialogProps) {
  const [exercises, setExercises] = useState<RehabExercise[]>([])
  const [isLoadingExercises, setIsLoadingExercises] = useState(false)
  const [selectedItems, setSelectedItems] = useState<ExercisePrescriptionItemDraft[]>([])
  const [title, setTitle] = useState('Programme de rééducation')
  const [notes, setNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRegion, setFilterRegion] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterLevel, setFilterLevel] = useState('all')
  const [isSaving, setIsSaving] = useState(false)

  // Template state
  const [templates, setTemplates] = useState<ExercisePrescriptionTemplate[]>([])
  const [showTemplatePanel, setShowTemplatePanel] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [savingTemplateMode, setSavingTemplateMode] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    setIsLoadingExercises(true)
    fetch('/api/exercises')
      .then((r) => r.json())
      .then((data) => setExercises(data.exercises || []))
      .catch(() => toast({ title: 'Impossible de charger les exercices', variant: 'destructive' }))
      .finally(() => setIsLoadingExercises(false))

    fetch('/api/exercise-templates')
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {})
  }, [open])

  // Pre-fill when editing an existing prescription
  useEffect(() => {
    if (!open || !initialPrescription) return
    setTitle(initialPrescription.title)
    setNotes(initialPrescription.notes || '')
    const drafts: ExercisePrescriptionItemDraft[] = (initialPrescription.items || []).map((item) => ({
      exercise: {
        id: item.exercise_id,
        name: item.exercise_name,
        description: item.exercise_description,
        region: item.exercise_region,
        type: item.exercise_type,
        level: item.exercise_level as 1 | 2 | 3,
        nerve_target: item.nerve_target || null,
        progression_regression: item.progression_regression || null,
        is_active: true,
        illustration_url: item.illustration_url,
      },
      sets: item.sets,
      reps: item.reps || '',
      hold_time: item.hold_time,
      rest_time: item.rest_time,
      frequency: item.frequency || '1x/jour',
      notes: item.notes || '',
      nerve_target: item.nerve_target || '',
      progression_regression: item.progression_regression || '',
    }))
    setSelectedItems(drafts)
  }, [open, initialPrescription])

  const regions = useMemo(() => Array.from(new Set(exercises.map((e) => e.region).filter(Boolean))).sort(), [exercises])
  const types = useMemo(() => Array.from(new Set(exercises.map((e) => e.type).filter(Boolean))).sort(), [exercises])

  const filteredExercises = useMemo(() => {
    return exercises.filter((e) => {
      if (filterRegion !== 'all' && e.region !== filterRegion) return false
      if (filterType !== 'all' && e.type !== filterType) return false
      if (filterLevel !== 'all' && String(e.level) !== filterLevel) return false
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        if (!e.name.toLowerCase().includes(q) && !e.description.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [exercises, filterRegion, filterType, filterLevel, searchTerm])

  const isSelected = (id: string) => selectedItems.some((i) => i.exercise.id === id)

  function addExercise(exercise: RehabExercise) {
    if (isSelected(exercise.id)) return
    setSelectedItems((prev) => [
      ...prev,
      {
        exercise,
        sets: 3,
        reps: '10',
        hold_time: null,
        rest_time: 30,
        frequency: '1x/jour',
        notes: '',
        nerve_target: exercise.nerve_target || '',
        progression_regression: exercise.progression_regression || '',
      },
    ])
  }

  function removeExercise(id: string) {
    setSelectedItems((prev) => prev.filter((i) => i.exercise.id !== id))
  }

  function moveUp(index: number) {
    if (index === 0) return
    setSelectedItems((prev) => {
      const arr = [...prev]
      ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
      return arr
    })
  }

  function moveDown(index: number) {
    setSelectedItems((prev) => {
      if (index >= prev.length - 1) return prev
      const arr = [...prev]
      ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
      return arr
    })
  }

  function updateItem(
    exerciseId: string,
    field: keyof Omit<ExercisePrescriptionItemDraft, 'exercise'>,
    value: unknown
  ) {
    setSelectedItems((prev) =>
      prev.map((i) => (i.exercise.id === exerciseId ? { ...i, [field]: value } : i))
    )
  }

  function loadTemplate(template: ExercisePrescriptionTemplate) {
    if (!template.items || template.items.length === 0) {
      toast({ title: 'Ce modèle est vide', variant: 'destructive' })
      return
    }
    const drafts: ExercisePrescriptionItemDraft[] = template.items.map((item) => ({
      exercise: {
        id: item.exercise_id,
        name: item.exercise_name,
        description: item.exercise_description,
        region: item.exercise_region,
        type: item.exercise_type,
        level: item.exercise_level as 1 | 2 | 3,
        nerve_target: item.nerve_target || null,
        progression_regression: item.progression_regression || null,
        is_active: true,
        illustration_url: item.illustration_url,
      },
      sets: item.sets,
      reps: item.reps || '',
      hold_time: item.hold_time,
      rest_time: item.rest_time,
      frequency: item.frequency || '1x/jour',
      notes: item.notes || '',
      nerve_target: item.nerve_target || '',
      progression_regression: item.progression_regression || '',
    }))
    setSelectedItems(drafts)
    setTitle(template.name)
    setNotes(template.notes || '')
    setShowTemplatePanel(false)
    toast({ title: `Modèle "${template.name}" chargé` })
  }

  async function handleDeleteTemplate(id: string, name: string) {
    if (!confirm(`Supprimer le modèle "${name}" ?`)) return
    try {
      await fetch(`/api/exercise-templates/${id}`, { method: 'DELETE' })
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      toast({ title: 'Modèle supprimé' })
    } catch {
      toast({ title: 'Erreur lors de la suppression', variant: 'destructive' })
    }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) {
      toast({ title: 'Veuillez saisir un nom pour le modèle', variant: 'destructive' })
      return
    }
    if (selectedItems.length === 0) {
      toast({ title: 'Aucun exercice à enregistrer', variant: 'destructive' })
      return
    }
    setIsSavingTemplate(true)
    try {
      const res = await fetch('/api/exercise-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: templateName, notes: notes || null, items: selectedItems }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTemplates((prev) => [...prev, { ...data.template, items: selectedItems.map((item, i) => ({
        id: '',
        template_id: data.template.id,
        exercise_id: item.exercise.id,
        exercise_name: item.exercise.name,
        exercise_description: item.exercise.description,
        exercise_region: item.exercise.region,
        exercise_type: item.exercise.type,
        exercise_level: item.exercise.level,
        illustration_url: item.exercise.illustration_url,
        nerve_target: item.nerve_target,
        progression_regression: item.progression_regression,
        sets: item.sets,
        reps: item.reps,
        hold_time: item.hold_time,
        rest_time: item.rest_time,
        frequency: item.frequency,
        notes: item.notes,
        position: i,
        created_at: '',
      })) }].sort((a, b) => a.name.localeCompare(b.name)))
      toast({ title: `Modèle "${templateName}" enregistré` })
      setTemplateName('')
      setSavingTemplateMode(false)
    } catch {
      toast({ title: "Erreur lors de l'enregistrement du modèle", variant: 'destructive' })
    } finally {
      setIsSavingTemplate(false)
    }
  }

  async function handleSave(mode: 'save' | 'pdf' | 'email' = 'save') {
    if (!title.trim()) {
      toast({ title: 'Veuillez saisir un titre', variant: 'destructive' })
      return
    }
    if (selectedItems.length === 0) {
      toast({ title: 'Veuillez ajouter au moins un exercice', variant: 'destructive' })
      return
    }
    setIsSaving(true)
    try {
      const isEdit = !!prescriptionId
      const url = isEdit
        ? `/api/exercise-prescriptions/${prescriptionId}`
        : '/api/exercise-prescriptions'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          consultation_id: consultationId || null,
          title,
          notes: notes || null,
          items: selectedItems,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      if (mode === 'pdf' && data.prescription?.id) {
        try {
          const pdfRes = await fetch(`/api/exercise-prescriptions/${data.prescription.id}/pdf`)
          if (pdfRes.ok) {
            const blob = await pdfRes.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `programme-exercices.pdf`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }
        } catch { /* PDF failure non-blocking */ }
      }

      if (mode === 'email' && data.prescription?.id) {
        try {
          const emailRes = await fetch(`/api/exercise-prescriptions/${data.prescription.id}/email`, {
            method: 'POST',
          })
          const emailData = await emailRes.json()
          if (!emailRes.ok) {
            toast({ title: emailData.error || "Erreur lors de l'envoi email", variant: 'destructive' })
          } else {
            toast({ title: isEdit ? 'Programme modifié et envoyé par email' : 'Programme enregistré et envoyé par email' })
          }
        } catch {
          toast({ title: isEdit ? 'Programme modifié (erreur envoi email)' : "Programme enregistré (erreur envoi email)", variant: 'destructive' })
        }
        onSaved?.()
        handleClose()
        return
      }

      toast({ title: isEdit ? 'Programme modifié' : 'Programme enregistré' })
      onSaved?.()
      handleClose()
    } catch {
      toast({ title: "Erreur lors de l'enregistrement", variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  function handleClose() {
    setSelectedItems([])
    setTitle('Programme de rééducation')
    setNotes('')
    setSearchTerm('')
    setFilterRegion('all')
    setFilterType('all')
    setFilterLevel('all')
    setShowTemplatePanel(false)
    setSavingTemplateMode(false)
    setTemplateName('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-[92vw] w-full h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              {prescriptionId ? 'Modifier le programme' : 'Programme d’exercices'} — {patientName}
            </DialogTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => { setShowTemplatePanel((v) => !v); setSavingTemplateMode(false) }}
              >
                <FolderOpen className="h-4 w-4" />
                Modèles
                {templates.length > 0 && (
                  <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5">
                    {templates.length}
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => { setSavingTemplateMode((v) => !v); setShowTemplatePanel(false) }}
              >
                <BookMarked className="h-4 w-4" />
                Enregistrer comme modèle
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Save as template inline form */}
        {savingTemplateMode && (
          <div className="px-6 py-3 border-b flex-shrink-0 bg-muted/30 flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nom du modèle</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Ex: Protocole lombalgie, Épaule post-op..."
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveTemplate}
              disabled={isSavingTemplate || !templateName.trim() || selectedItems.length === 0}
            >
              {isSavingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="ml-1">Enregistrer</span>
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSavingTemplateMode(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Template panel */}
        {showTemplatePanel && (
          <div className="px-6 py-3 border-b flex-shrink-0 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2">Charger un modèle existant</p>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun modèle enregistré</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => loadTemplate(t)}
                      className="hover:text-primary transition-colors"
                    >
                      {t.name}
                      {t.items && t.items.length > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({t.items.length})
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(t.id, t.name)}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Title + Notes */}
        <div className="px-6 py-3 border-b flex-shrink-0 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="presc-title" className="text-xs">Titre du programme</Label>
            <Input
              id="presc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Programme de rééducation"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="presc-notes" className="text-xs">Notes générales (optionnel)</Label>
            <Input
              id="presc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instructions générales, remarques..."
            />
          </div>
        </div>

        {/* Split: Library | Selection */}
        <div className="flex-1 flex min-h-0">
          {/* Library */}
          <div className="w-1/2 flex flex-col border-r">
            <div className="px-4 py-3 border-b flex-shrink-0 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Rechercher un exercice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={filterRegion} onValueChange={setFilterRegion}>
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue placeholder="Région" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes régions</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous types</SelectItem>
                    {types.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="Niveau" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous niveaux</SelectItem>
                    <SelectItem value="1">Débutant</SelectItem>
                    <SelectItem value="2">Intermédiaire</SelectItem>
                    <SelectItem value="3">Avancé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoadingExercises ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Chargement...
                </div>
              ) : filteredExercises.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun exercice trouvé</p>
              ) : (
                filteredExercises.map((ex) => (
                  <div
                    key={ex.id}
                    className={`rounded-lg border p-3 flex gap-3 items-start transition-colors ${
                      isSelected(ex.id) ? 'border-primary/50 bg-primary/5' : 'hover:border-border'
                    }`}
                  >
                    {ex.illustration_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ex.illustration_url}
                        alt={ex.name}
                        className="h-12 w-12 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className={`h-12 w-12 rounded flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                          TYPE_COLORS[ex.type] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {ex.type.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight">{ex.name}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        <span className="text-xs text-muted-foreground">{ex.region}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            TYPE_COLORS[ex.type] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {ex.type}
                        </span>
                        <span className="text-xs text-muted-foreground">Niv.{ex.level}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {ex.description}
                      </p>
                      {ex.nerve_target && (
                        <p className="text-xs text-indigo-600 mt-0.5">⚡ {ex.nerve_target}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant={isSelected(ex.id) ? 'outline' : 'default'}
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => (isSelected(ex.id) ? removeExercise(ex.id) : addExercise(ex))}
                    >
                      {isSelected(ex.id) ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Selected exercises */}
          <div className="w-1/2 flex flex-col">
            <div className="px-4 py-3 border-b flex-shrink-0">
              <p className="text-sm font-medium text-muted-foreground">
                {selectedItems.length === 0
                  ? 'Aucun exercice sélectionné'
                  : `${selectedItems.length} exercice${selectedItems.length > 1 ? 's' : ''} sélectionné${selectedItems.length > 1 ? 's' : ''}`}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {selectedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <Dumbbell className="h-10 w-10 opacity-20" />
                  <p className="text-sm">Ajoutez des exercices depuis la bibliothèque</p>
                  {templates.length > 0 && (
                    <p className="text-xs">ou chargez un modèle existant</p>
                  )}
                </div>
              ) : (
                selectedItems.map((item, index) => (
                  <div key={item.exercise.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight">{item.exercise.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.exercise.region} — {item.exercise.type}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveDown(index)}
                          disabled={index === selectedItems.length - 1}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => removeExercise(item.exercise.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Séries</Label>
                        <Input
                          type="number"
                          className="h-7 text-xs"
                          min={1}
                          value={item.sets ?? ''}
                          onChange={(e) =>
                            updateItem(item.exercise.id, 'sets', e.target.value ? parseInt(e.target.value) : null)
                          }
                          placeholder="3"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Répétitions / durée</Label>
                        <Input
                          className="h-7 text-xs"
                          value={item.reps}
                          onChange={(e) => updateItem(item.exercise.id, 'reps', e.target.value)}
                          placeholder="10 ou 30s"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tenue (s)</Label>
                        <Input
                          type="number"
                          className="h-7 text-xs"
                          min={0}
                          value={item.hold_time ?? ''}
                          onChange={(e) =>
                            updateItem(item.exercise.id, 'hold_time', e.target.value ? parseInt(e.target.value) : null)
                          }
                          placeholder="—"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Repos entre séries (s)</Label>
                        <Input
                          type="number"
                          className="h-7 text-xs"
                          min={0}
                          value={item.rest_time ?? ''}
                          onChange={(e) =>
                            updateItem(item.exercise.id, 'rest_time', e.target.value ? parseInt(e.target.value) : null)
                          }
                          placeholder="30"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Fréquence</Label>
                      <Select
                        value={item.frequency || undefined}
                        onValueChange={(v) => updateItem(item.exercise.id, 'frequency', v)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Fréquence" />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCY_OPTIONS.map((f) => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Cible nerveuse</Label>
                      <Input
                        className="h-7 text-xs"
                        value={item.nerve_target}
                        onChange={(e) => updateItem(item.exercise.id, 'nerve_target', e.target.value)}
                        placeholder="ex: nerf sciatique..."
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Progression / Régression</Label>
                      <Input
                        className="h-7 text-xs"
                        value={item.progression_regression}
                        onChange={(e) => updateItem(item.exercise.id, 'progression_regression', e.target.value)}
                        placeholder="ex: ajouter poids, réduire amplitude..."
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Notes spécifiques</Label>
                      <Input
                        className="h-7 text-xs"
                        value={item.notes}
                        onChange={(e) => updateItem(item.exercise.id, 'notes', e.target.value)}
                        placeholder="Instructions particulières..."
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex-shrink-0 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave('save')}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {prescriptionId ? 'Modifier' : 'Enregistrer'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave('pdf')}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {prescriptionId ? 'Modifier & PDF' : 'Enregistrer & PDF'}
          </Button>
          <Button type="button" onClick={() => handleSave('email')} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            {prescriptionId ? 'Modifier & Envoyer' : 'Enregistrer & Envoyer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
