'use client'

/**
 * Import de données patients — 100 % local / conforme RGPD.
 *
 * Le fichier déposé par le praticien est lu et analysé entièrement dans le
 * navigateur (aucun envoi à un tiers), puis les patients et consultations sont
 * insérés directement dans SA propre base de données. Les données de santé ne
 * quittent jamais l'environnement du praticien.
 *
 * Remplace l'ancien flux « envoi du fichier au support par email » qui faisait
 * transiter des données de santé (catégorie particulière, art. 9 RGPD) en clair
 * vers une boîte mail tierce.
 */

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Download, ShieldCheck } from 'lucide-react'
import {
  parseCSV,
  autoDetectMapping,
  importRows,
  PATIENT_FIELDS,
  CONSULTATION_FIELDS,
  ALL_FIELDS,
  type MappableField,
  type ImportResult,
} from '@/lib/import/csv'

type ImportStep = 'upload' | 'mapping' | 'importing' | 'done'

export function ImportDataTab() {
  const [step, setStep] = useState<ImportStep>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [columnMapping, setColumnMapping] = useState<Record<number, MappableField>>({})
  const [isDragOver, setIsDragOver] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // -----------------------------------------------------------------------
  // File processing (read + parse entirely client-side)
  // -----------------------------------------------------------------------
  const processFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast({
          variant: 'destructive',
          title: 'Format invalide',
          description: 'Veuillez sélectionner un fichier CSV. Exportez vos données depuis votre ancien logiciel au format CSV.',
        })
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const rows = parseCSV(text)

          if (rows.length < 2) {
            toast({
              variant: 'destructive',
              title: 'Fichier vide',
              description: 'Le fichier CSV ne contient pas de données à importer.',
            })
            return
          }

          const csvHeaders = rows[0]
          const csvData = rows.slice(1)

          setHeaders(csvHeaders)
          setDataRows(csvData)
          setFileName(file.name)
          setColumnMapping(autoDetectMapping(csvHeaders))
          setStep('mapping')
        } catch {
          toast({
            variant: 'destructive',
            title: 'Erreur de lecture',
            description: 'Impossible de lire le fichier CSV. Vérifiez le format.',
          })
        }
      }
      reader.onerror = () => {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Impossible de lire le fichier.',
        })
      }
      reader.readAsText(file, 'UTF-8')
    },
    [toast],
  )

  // -----------------------------------------------------------------------
  // Drag & drop
  // -----------------------------------------------------------------------
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  // -----------------------------------------------------------------------
  // Mapping change
  // -----------------------------------------------------------------------
  const handleMappingChange = useCallback((colIndex: number, value: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev }
      if (value === '__ignore__') {
        next[colIndex] = '__ignore__'
      } else {
        for (const key of Object.keys(next)) {
          if (next[Number(key)] === value) delete next[Number(key)]
        }
        next[colIndex] = value as MappableField
      }
      return next
    })
  }, [])

  // -----------------------------------------------------------------------
  // Import (local, into the practitioner's own database)
  // -----------------------------------------------------------------------
  const handleImport = useCallback(async () => {
    const mappedFields = new Set(Object.values(columnMapping).filter((v) => v !== '__ignore__'))
    if (!mappedFields.has('last_name') && !mappedFields.has('full_name')) {
      toast({
        variant: 'destructive',
        title: 'Correspondance incomplète',
        description: 'Le champ « Nom » ou « Nom Prénom (combiné) » est obligatoire.',
      })
      return
    }

    setStep('importing')
    setImportProgress(0)

    try {
      const res = await importRows(headers, dataRows, columnMapping, setImportProgress)
      setImportResult(res)
      setStep('done')
      toast({
        variant: res.errors.length === 0 ? 'success' : 'default',
        title: 'Import terminé',
        description: `${res.patientsImported} patient(s) et ${res.consultationsImported} consultation(s) importé(s).`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Erreur inconnue lors de l\'import.',
      })
      setStep('mapping')
    }
  }, [columnMapping, headers, dataRows, toast])

  const handleReset = useCallback(() => {
    setStep('upload')
    setFileName(null)
    setHeaders([])
    setDataRows([])
    setColumnMapping({})
    setImportResult(null)
    setImportProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const previewRows = dataRows.slice(0, 5)
  const mappedFieldsSet = new Set<string>(
    Object.values(columnMapping).filter((v) => v !== '__ignore__'),
  )

  return (
    <div className="space-y-6">
      {/* RGPD reassurance banner */}
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-emerald-800 dark:text-emerald-300">Import 100 % local et confidentiel</p>
          <p className="text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
            Votre fichier est lu et analysé directement dans votre navigateur, puis les
            patients sont enregistrés dans <strong>votre</strong> base de données. Aucune donnée
            n&apos;est envoyée à un tiers ni à notre équipe — vous restez seul responsable de
            traitement, conformément au RGPD.
          </p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        <StepIndicator number={1} label="Fichier" active={step === 'upload'} completed={step !== 'upload'} />
        <div className="h-px w-8 bg-border" />
        <StepIndicator number={2} label="Correspondance" active={step === 'mapping'} completed={step === 'importing' || step === 'done'} />
        <div className="h-px w-8 bg-border" />
        <StepIndicator number={3} label="Import" active={step === 'importing'} completed={step === 'done'} />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Step 1: Upload */}
      {/* ---------------------------------------------------------------- */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Sélectionner un fichier CSV</CardTitle>
            <CardDescription>
              Exportez vos patients et consultations depuis votre ancien logiciel au format CSV,
              puis déposez le fichier ici. Les délimiteurs virgule et point-virgule sont détectés
              automatiquement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 cursor-pointer transition-colors ${
                isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary hover:bg-muted/50'
              }`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Glissez votre fichier CSV ici</p>
                <p className="text-xs text-muted-foreground mt-1">ou cliquez pour parcourir</p>
              </div>
              <Badge variant="secondary">CSV</Badge>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg space-y-3">
              <h4 className="font-medium mb-2 text-sm">Colonnes reconnues automatiquement</h4>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Patient</p>
                <div className="flex flex-wrap gap-2">
                  {PATIENT_FIELDS.map((f) => (
                    <Badge key={f.key} variant="outline" className="text-xs">{f.label}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Consultation</p>
                <div className="flex flex-wrap gap-2">
                  {CONSULTATION_FIELDS.map((f) => (
                    <Badge key={f.key} variant="outline" className="text-xs">{f.label}</Badge>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Les en-têtes courants en français et anglais sont détectés automatiquement.
                Vous pourrez ajuster la correspondance manuellement à l&apos;étape suivante.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Step 2: Mapping + preview */}
      {/* ---------------------------------------------------------------- */}
      {step === 'mapping' && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {dataRows.length} ligne{dataRows.length > 1 ? 's' : ''} détectée{dataRows.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>Changer de fichier</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Correspondance des colonnes</CardTitle>
              <CardDescription>
                Vérifiez et ajustez la correspondance entre les colonnes de votre fichier et les
                champs MyOsteoFlow. Les champs détectés automatiquement sont pré-remplis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {headers.map((header, index) => (
                  <div key={index} className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium truncate" title={header}>{header}</label>
                    <Select
                      value={columnMapping[index] || '__ignore__'}
                      onValueChange={(val) => handleMappingChange(index, val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ignore__">-- Ignorer --</SelectItem>
                        <SelectItem value="__patient_header__" disabled className="text-xs font-semibold text-muted-foreground">
                          — Patient —
                        </SelectItem>
                        {PATIENT_FIELDS.map((f) => {
                          const alreadyMapped = mappedFieldsSet.has(f.key) && columnMapping[index] !== f.key
                          return (
                            <SelectItem key={f.key} value={f.key} disabled={alreadyMapped}>
                              {f.label}{alreadyMapped ? ' (déjà assigné)' : ''}
                            </SelectItem>
                          )
                        })}
                        <SelectItem value="__consult_header__" disabled className="text-xs font-semibold text-muted-foreground">
                          — Consultation —
                        </SelectItem>
                        {CONSULTATION_FIELDS.map((f) => {
                          const alreadyMapped = mappedFieldsSet.has(f.key) && columnMapping[index] !== f.key
                          return (
                            <SelectItem key={f.key} value={f.key} disabled={alreadyMapped}>
                              {f.label}{alreadyMapped ? ' (déjà assigné)' : ''}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    {columnMapping[index] && columnMapping[index] !== '__ignore__' && (
                      <Badge variant="success" className="w-fit text-xs">Mappé</Badge>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Patient</p>
                  <div className="flex flex-wrap gap-2">
                    {PATIENT_FIELDS.map((f) => (
                      <Badge key={f.key} variant={mappedFieldsSet.has(f.key) ? 'success' : 'outline'} className="text-xs">
                        {f.label}: {mappedFieldsSet.has(f.key) ? 'OK' : 'non mappé'}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Consultation (optionnel)</p>
                  <div className="flex flex-wrap gap-2">
                    {CONSULTATION_FIELDS.map((f) => (
                      <Badge key={f.key} variant={mappedFieldsSet.has(f.key) ? 'success' : 'outline'} className="text-xs">
                        {f.label}: {mappedFieldsSet.has(f.key) ? 'OK' : 'non mappé'}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aperçu des données</CardTitle>
              <CardDescription>
                {previewRows.length} première{previewRows.length > 1 ? 's' : ''} ligne{previewRows.length > 1 ? 's' : ''} de votre fichier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">#</th>
                      {headers.map((header, i) => (
                        <th key={i} className="text-left py-2 px-3 text-xs font-medium">
                          <div>{header}</div>
                          {columnMapping[i] && columnMapping[i] !== '__ignore__' && (
                            <Badge variant="secondary" className="text-[10px] mt-0.5">
                              {ALL_FIELDS.find((f) => f.key === columnMapping[i])?.label}
                            </Badge>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b last:border-0">
                        <td className="py-2 px-3 text-xs text-muted-foreground">{rowIndex + 1}</td>
                        {headers.map((_, colIndex) => (
                          <td key={colIndex} className="py-2 px-3 max-w-[200px] truncate">{row[colIndex] || ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dataRows.length > 5 && (
                <p className="text-xs text-muted-foreground mt-3">
                  ... et {dataRows.length - 5} autre{dataRows.length - 5 > 1 ? 's' : ''} ligne{dataRows.length - 5 > 1 ? 's' : ''}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleReset}>Annuler</Button>
            <Button onClick={handleImport}>
              <Upload className="mr-2 h-4 w-4" />
              Importer {dataRows.length} ligne{dataRows.length > 1 ? 's' : ''}
            </Button>
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Step 3: Importing */}
      {/* ---------------------------------------------------------------- */}
      {step === 'importing' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-6 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-lg font-medium">Import en cours...</p>
                <p className="text-sm text-muted-foreground mt-1">Veuillez ne pas fermer cette page.</p>
              </div>
              <div className="w-full max-w-md">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-medium">{importProgress}%</span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300 ease-out" style={{ width: `${importProgress}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Step 4: Results */}
      {/* ---------------------------------------------------------------- */}
      {step === 'done' && importResult && (
        <>
          <Card className={importResult.errors.length === 0 ? 'border-green-200' : importResult.patientsImported === 0 ? 'border-red-200' : 'border-yellow-200'}>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 py-6">
                {importResult.errors.length === 0 ? (
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                ) : importResult.patientsImported === 0 ? (
                  <AlertCircle className="h-12 w-12 text-red-500" />
                ) : (
                  <AlertCircle className="h-12 w-12 text-yellow-500" />
                )}
                <div className="text-center">
                  <h2 className="text-xl font-semibold">
                    {importResult.errors.length === 0
                      ? 'Import terminé avec succès !'
                      : importResult.patientsImported === 0
                        ? 'Échec de l\'import'
                        : 'Import terminé avec des erreurs'}
                  </h2>
                </div>
                <div className="flex gap-6 mt-2">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{importResult.patientsImported}</p>
                    <p className="text-xs text-muted-foreground">patient{importResult.patientsImported > 1 ? 's' : ''}</p>
                  </div>
                  {importResult.consultationsImported > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{importResult.consultationsImported}</p>
                      <p className="text-xs text-muted-foreground">consultation{importResult.consultationsImported > 1 ? 's' : ''}</p>
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{importResult.errors.length}</p>
                      <p className="text-xs text-muted-foreground">erreur{importResult.errors.length > 1 ? 's' : ''}</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{importResult.total}</p>
                    <p className="text-xs text-muted-foreground">ligne{importResult.total > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {importResult.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Erreurs d&apos;import
                </CardTitle>
                <CardDescription>Les lignes suivantes n&apos;ont pas pu être importées</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm p-2 rounded bg-red-50 dark:bg-red-950/20">
                      <Badge variant="destructive" className="text-xs shrink-0">Ligne {err.row}</Badge>
                      <span className="text-red-700 dark:text-red-300">{err.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-4">
            <Button onClick={handleReset}>
              <Upload className="mr-2 h-4 w-4" />
              Nouvel import
            </Button>
            <Button variant="outline" asChild>
              <a href="/patients">Voir les patients</a>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number: number
  label: string
  active: boolean
  completed: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
        completed || active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {completed ? <CheckCircle2 className="h-4 w-4" /> : number}
      </div>
      <span className={`text-sm ${active || completed ? 'font-medium' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  )
}
