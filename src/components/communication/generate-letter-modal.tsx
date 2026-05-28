'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  FileText,
  Loader2,
  Printer,
  Save,
  Edit3,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const TEMPLATES = [
  { id: 'referral', name: "Courrier d'adressage" },
  { id: 'attestation_consultation', name: 'Attestation de consultation' },
] as const

type TemplateId = (typeof TEMPLATES)[number]['id']

interface Patient {
  id: string
  first_name: string
  last_name: string
  gender: string
  date_of_birth?: string | null
}

interface Practitioner {
  first_name: string
  last_name: string
  profession?: string | null
  address?: string | null
  city?: string | null
  postal_code?: string | null
  phone?: string | null
  email?: string | null
  rpps?: string | null
}

interface ConsultationContext {
  id: string
  date_time: string
  reason: string
  anamnesis?: string | null
  examination?: string | null
  advice?: string | null
}

export interface GenerateLetterModalProps {
  open: boolean
  onClose: () => void
  patient: Patient
  practitioner: Practitioner
  consultation?: ConsultationContext
  defaultTemplateId?: TemplateId
}

function computeAgeRange(dateOfBirth?: string | null): string {
  if (!dateOfBirth) return ''
  const birth = new Date(dateOfBirth)
  const age = new Date().getFullYear() - birth.getFullYear()
  const decade = Math.floor(age / 10) * 10
  return `${decade}-${decade + 9} ans`
}

function patientDisplayName(patient: Patient): string {
  const title = patient.gender === 'M' ? 'M.' : 'Mme'
  return `${title} ${patient.last_name.toUpperCase()} ${patient.first_name}`
}

export function GenerateLetterModal({
  open,
  onClose,
  patient,
  practitioner,
  consultation,
  defaultTemplateId = 'referral',
}: GenerateLetterModalProps) {
  const [templateId, setTemplateId] = useState<TemplateId>(defaultTemplateId)
  const [recipientName, setRecipientName] = useState('')
  const [recipientTitle, setRecipientTitle] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [header, setHeader] = useState('')
  const [body, setBody] = useState('')
  const [letterClosing, setLetterClosing] = useState('')
  const [recipientBlockText, setRecipientBlockText] = useState('')
  const [saved, setSaved] = useState(false)
  const [showOptions, setShowOptions] = useState(true)

  const patientLabel = useMemo(() => patientDisplayName(patient), [patient])

  // Sync template and reset state each time the modal opens
  useEffect(() => {
    if (open) {
      setTemplateId(defaultTemplateId)
      setHeader('')
      setBody('')
      setLetterClosing('')
      setRecipientBlockText('')
      setSaved(false)
      setShowOptions(true)
      setError(null)
      setRecipientName('')
      setRecipientTitle('')
      setCustomInstructions('')
    }
  }, [open, defaultTemplateId])

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      const ageRange = computeAgeRange(patient.date_of_birth)

      const res = await fetch('/api/communication/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          practitioner,
          patient: {
            gender: patient.gender,
            age_range: ageRange || undefined,
          },
          consultation: consultation
            ? {
                date: consultation.date_time,
                reason: consultation.reason,
                anamnesis: consultation.anamnesis,
                examination: consultation.examination,
                advice: consultation.advice,
              }
            : undefined,
          recipient_name: recipientName || undefined,
          recipient_title: recipientTitle || undefined,
          custom_instructions: customInstructions || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la génération')
      }

      const data = await res.json()
      setHeader(data.header)
      const resolvedBody = (data.body as string).replace(/\[NOM_PATIENT\]/g, patientLabel)
      setBody(resolvedBody)
      setLetterClosing(data.closing ?? '')
      setRecipientBlockText(data.recipient_block ?? '')
      setShowOptions(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const template = TEMPLATES.find((t) => t.id === templateId)
      const res = await fetch('/api/communication/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultation_id: consultation?.id ?? null,
          patient_id: patient.id,
          template_id: templateId,
          template_name: template?.name ?? templateId,
          header,
          body,
          recipient_name: recipientName || null,
          recipient_title: recipientTitle || null,
          closing: letterClosing || null,
        }),
      })
      if (res.ok) setSaved(true)
    } catch (err) {
      console.error('[save letter]', err)
    }
  }

  // Génère le PDF côté serveur et l'ouvre via un blob URL local —
  // évite window.open('', '_blank') qui déclenche shell.openExternal dans Electron.
  const handlePrint = async () => {
    if (printing) return
    setPrinting(true)
    try {
      const templateName = TEMPLATES.find((t) => t.id === templateId)?.name ?? ''
      const res = await fetch('/api/communication/letters/preview/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          header,
          recipient_block: recipientBlockText,
          body,
          closing: letterClosing,
          template_name: templateName,
        }),
      })
      if (!res.ok) throw new Error('Erreur génération PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 15000)
    } catch (err) {
      console.error('[print letter]', err)
    } finally {
      setPrinting(false)
    }
  }

  const templateName = TEMPLATES.find((t) => t.id === templateId)?.name ?? ''

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Générer un courrier — {patientLabel}
          </DialogTitle>
          <DialogDescription>
            Le courrier est rédigé à partir des données de la consultation.
            Vous pouvez modifier le texte avant d&apos;imprimer ou d&apos;exporter en PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle options */}
          {header && (
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showOptions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showOptions ? 'Masquer les options' : 'Modifier les options'}
            </button>
          )}

          {/* Options */}
          {showOptions && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-1.5">
                <Label>Type de courrier</Label>
                <Select
                  value={templateId}
                  onValueChange={(v) => setTemplateId(v as TemplateId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {templateId === 'referral' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Titre destinataire</Label>
                    <Input
                      value={recipientTitle}
                      onChange={(e) => setRecipientTitle(e.target.value)}
                      placeholder="Dr., M., Mme…"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nom destinataire</Label>
                    <Input
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Nom du destinataire"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Instructions complémentaires</Label>
                <Input
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Ex : adresser pour IRM, mentionner douleur au genou…"
                />
              </div>

              <Button onClick={handleGenerate} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Génération en cours…
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    {header ? 'Régénérer le courrier' : 'Générer le courrier'}
                  </>
                )}
              </Button>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {/* Éditeur */}
          {header && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Edit3 className="h-4 w-4" />
                  {templateName}
                </h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSave} disabled={saved}>
                    {saved ? (
                      <>
                        <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                        Sauvegardé
                      </>
                    ) : (
                      <>
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        Sauvegarder
                      </>
                    )}
                  </Button>
                  <Button size="sm" onClick={handlePrint} disabled={printing}>
                    {printing ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Printer className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Imprimer / PDF
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">En-tête</Label>
                <Textarea
                  value={header}
                  onChange={(e) => setHeader(e.target.value)}
                  rows={6}
                  className="font-mono text-sm resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Corps du courrier</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  className="font-mono text-sm"
                />
              </div>

              {letterClosing && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Clôture</Label>
                  <Textarea
                    value={letterClosing}
                    onChange={(e) => setLetterClosing(e.target.value)}
                    rows={4}
                    className="font-mono text-sm resize-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
