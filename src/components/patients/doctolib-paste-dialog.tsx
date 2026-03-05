'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ClipboardPaste } from 'lucide-react'
import { parseDoctolibPaste } from '@/lib/utils/parse-doctolib-paste'
import type { PatientFormData } from '@/lib/validations/patient'

interface DoctolibPasteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (data: Partial<PatientFormData>) => void
}

export function DoctolibPasteDialog({ open, onOpenChange, onImport }: DoctolibPasteDialogProps) {
  const [pastedText, setPastedText] = useState('')
  const [preview, setPreview] = useState<Partial<PatientFormData> | null>(null)

  const handleParse = () => {
    const parsed = parseDoctolibPaste(pastedText)
    setPreview(parsed)
  }

  const handleImport = () => {
    if (preview) {
      onImport(preview)
      handleClose()
    }
  }

  const handleClose = () => {
    setPastedText('')
    setPreview(null)
    onOpenChange(false)
  }

  const fieldLabels: Record<string, string> = {
    gender: 'Sexe',
    first_name: 'Prenom',
    last_name: 'Nom',
    birth_date: 'Date de naissance',
    phone: 'Telephone',
    email: 'Email',
    profession: 'Profession',
    primary_physician: 'Medecin traitant',
  }

  const formatValue = (key: string, value: string) => {
    if (key === 'gender') return value === 'M' ? 'Homme' : 'Femme'
    return value
  }

  const previewEntries = preview
    ? Object.entries(preview).filter(([, v]) => v !== undefined && v !== '')
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer depuis Doctolib</DialogTitle>
          <DialogDescription>
            Copiez les informations du patient depuis Doctolib et collez-les ci-dessous.
            Les champs seront remplis automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doctolib-paste">Texte copie depuis Doctolib</Label>
            <Textarea
              id="doctolib-paste"
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value)
                setPreview(null)
              }}
              placeholder={`Collez ici le texte copie depuis la fiche patient Doctolib...\n\nExemple :\nNom : Dupont\nPrenom : Jean\nDate de naissance : 15/03/1985\nSexe : Masculin\nTelephone : 06 12 34 56 78\nEmail : jean.dupont@email.fr`}
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {preview && previewEntries.length > 0 && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
              <p className="text-sm font-medium mb-2">Champs detectes :</p>
              {previewEntries.map(([key, value]) => (
                <div key={key} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground min-w-[140px]">
                    {fieldLabels[key] || key} :
                  </span>
                  <span className="font-medium">{formatValue(key, value as string)}</span>
                </div>
              ))}
            </div>
          )}

          {preview && previewEntries.length === 0 && (
            <p className="text-sm text-destructive">
              Aucun champ detecte. Verifiez le format du texte colle.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          {!preview ? (
            <Button
              type="button"
              onClick={handleParse}
              disabled={!pastedText.trim()}
            >
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Analyser
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleImport}
              disabled={previewEntries.length === 0}
            >
              Remplir les champs
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
