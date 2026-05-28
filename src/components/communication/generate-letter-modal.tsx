'use client'

import { useState, useMemo } from 'react'
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
  const [error, setError] = useState<string | null>(null)
  const [header, setHeader] = useState('')
  const [body, setBody] = useState('')
  const [saved, setSaved] = useState(false)
  const [showOptions, setShowOptions] = useState(true)

  const patientLabel = useMemo(() => patientDisplayName(patient), [patient])

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      // Pseudonymisation : seuls genre + tranche d'âge transitent par l'API — aucun PII
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
      // [NOM_PATIENT] est remplacé localement — le vrai nom ne quitte jamais l'app
      const resolvedBody = (data.body as string).replace(/\[NOM_PATIENT\]/g, patientLabel)
      setBody(resolvedBody)
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
        }),
      })
      if (res.ok) setSaved(true)
    } catch (err) {
      console.error('[save letter]', err)
    }
  }

  const handlePrint = () => {
    const printContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Courrier</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 2.5cm; color: #000; }
    pre { font-family: inherit; white-space: pre-wrap; word-wrap: break-word; margin: 0; }
    @page { margin: 2cm; }
  </style>
</head>
<body>
  <pre>${header.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  <br/>
  <pre>${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(printContent)
      w.document.close()
      w.focus()
      w.print()
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
            Vous pouvez modifier le texte avant d'imprimer ou d'exporter en PDF.
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
                  <Button size="sm" onClick={handlePrint}>
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
