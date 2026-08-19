'use client'

/**
 * Export CSV des données du cabinet.
 *
 * Le praticien coche ce qu'il veut extraire — d'abord les types de données,
 * puis colonne par colonne — filtre éventuellement sur une période, et obtient
 * un fichier CSV par type de données.
 *
 * Les colonnes contenant des données de santé (art. 9 RGPD) sont décochées par
 * défaut et signalées : un export destiné au comptable ou à un tableur de
 * suivi n'a aucune raison d'embarquer les antécédents des patients.
 */

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Download, Loader2, ShieldAlert, Table2 } from 'lucide-react'
import { CSV_BOM } from '@/lib/export/csv'
import { EXPORT_DATASETS, preselectedFieldKeys, type ExportDataset } from '@/lib/export/datasets'

interface ExportedFile {
  dataset: string
  label: string
  filename: string
  csv: string
  rowCount: number
}

export function ExportDataTab() {
  const { toast } = useToast()
  // La sélection d'un jeu de données est suivie à part de celle de ses
  // colonnes : sinon, « Tout décocher » replierait le bloc que le praticien
  // est justement en train de régler.
  const [selectedDatasetKeys, setSelectedDatasetKeys] = useState<string[]>([])
  const [selectedFields, setSelectedFields] = useState<Record<string, string[]>>({})
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const selectedDatasets = useMemo(
    () => EXPORT_DATASETS.filter((dataset) => selectedDatasetKeys.includes(dataset.key)),
    [selectedDatasetKeys],
  )

  /** Jeux de données réellement exportables : cochés et avec au moins une colonne. */
  const exportableDatasets = useMemo(
    () => selectedDatasets.filter((dataset) => (selectedFields[dataset.key]?.length ?? 0) > 0),
    [selectedDatasets, selectedFields],
  )

  const totalColumns = exportableDatasets.reduce(
    (sum, dataset) => sum + (selectedFields[dataset.key]?.length ?? 0),
    0,
  )

  const hasArchivableSelection = selectedDatasets.some((dataset) => dataset.archivedFilter)

  const includesHealthData = exportableDatasets.some((dataset) =>
    dataset.fields.some((field) => field.health && selectedFields[dataset.key]?.includes(field.key)),
  )

  // ---------------------------------------------------------------------
  // Sélection
  // ---------------------------------------------------------------------

  const toggleDataset = (dataset: ExportDataset, checked: boolean) => {
    setSelectedDatasetKeys((current) =>
      checked ? [...current, dataset.key] : current.filter((key) => key !== dataset.key),
    )
    setSelectedFields((current) => ({
      ...current,
      // Les colonnes déjà réglées survivent à un décochage / recochage ; à la
      // première sélection, on part des colonnes usuelles du jeu de données.
      [dataset.key]: checked
        ? current[dataset.key]?.length
          ? current[dataset.key]
          : preselectedFieldKeys(dataset)
        : (current[dataset.key] ?? []),
    }))
  }

  const toggleField = (dataset: ExportDataset, fieldKey: string, checked: boolean) => {
    setSelectedFields((current) => {
      const currentKeys = current[dataset.key] ?? []
      return {
        ...current,
        [dataset.key]: checked
          ? [...currentKeys, fieldKey]
          : currentKeys.filter((key) => key !== fieldKey),
      }
    })
  }

  const setAllFields = (dataset: ExportDataset, all: boolean) => {
    setSelectedFields((current) => ({
      ...current,
      [dataset.key]: all ? dataset.fields.map((field) => field.key) : [],
    }))
  }

  // ---------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------

  const downloadFile = (file: ExportedFile) => {
    // Le BOM est ajouté ici, à l'écriture du fichier : sans lui, Excel lit
    // l'UTF-8 comme du Latin-1 et les accents deviennent illisibles.
    const blob = new Blob([CSV_BOM + file.csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExport = async () => {
    if (exportableDatasets.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Rien à exporter',
        description: 'Cochez au moins un type de données et une colonne.',
      })
      return
    }

    if (startDate && endDate && startDate > endDate) {
      toast({
        variant: 'destructive',
        title: 'Période invalide',
        description: 'La date de début doit précéder la date de fin.',
      })
      return
    }

    setIsExporting(true)

    try {
      const response = await fetch('/api/export/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasets: exportableDatasets.map((dataset) => ({
            dataset: dataset.key,
            fields: selectedFields[dataset.key],
          })),
          startDate: startDate || null,
          endDate: endDate || null,
          includeArchived,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Erreur lors de la génération de l'export")
      }

      const files = payload.files as ExportedFile[]
      const emptyFiles = files.filter((file) => file.rowCount === 0)

      for (const file of files) {
        downloadFile(file)
        // Les navigateurs ignorent des téléchargements déclenchés coup sur
        // coup : on les espace pour que chaque fichier arrive bien.
        if (files.length > 1) await new Promise((resolve) => setTimeout(resolve, 200))
      }

      const totalRows = files.reduce((sum, file) => sum + file.rowCount, 0)
      toast({
        title: files.length > 1 ? `${files.length} fichiers exportés` : 'Export terminé',
        description:
          emptyFiles.length > 0
            ? `${totalRows} ligne(s) exportée(s). Aucune donnée pour : ${emptyFiles
                .map((file) => file.label)
                .join(', ')}.`
            : `${totalRows} ligne(s) exportée(s).`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export impossible',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
      })
    } finally {
      setIsExporting(false)
    }
  }

  // ---------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Table2 className="h-5 w-5" />
            Export de données (CSV)
          </CardTitle>
          <CardDescription>
            Cochez les données à extraire, puis les colonnes à inclure. Un fichier CSV est
            généré par type de données, ouvrable dans Excel, Numbers ou LibreOffice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="export-start-date">Du</Label>
              <Input
                id="export-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-end-date">Au</Label>
              <Input
                id="export-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Laissez la période vide pour tout exporter. Chaque type de données est filtré sur sa
            propre date (date de consultation, d&apos;émission de facture, de dépense…).
          </p>

          {hasArchivableSelection && (
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
              <Checkbox
                checked={includeArchived}
                onCheckedChange={(checked) => setIncludeArchived(checked === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                Inclure les patients et consultations archivés
                <span className="block text-muted-foreground">
                  Par défaut, les dossiers archivés sont exclus de l&apos;export.
                </span>
              </span>
            </label>
          )}
        </CardContent>
      </Card>

      {EXPORT_DATASETS.map((dataset) => {
        const chosen = selectedFields[dataset.key] ?? []
        const isSelected = selectedDatasetKeys.includes(dataset.key)

        return (
          <Card key={dataset.key}>
            <CardHeader className="pb-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => toggleDataset(dataset, checked === true)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{dataset.label}</span>
                  <span className="block text-sm text-muted-foreground">{dataset.description}</span>
                </span>
              </label>
            </CardHeader>

            {isSelected && (
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className={`text-sm ${chosen.length === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {chosen.length === 0
                      ? 'Aucune colonne cochée : ce type de données ne sera pas exporté'
                      : `${chosen.length} colonne(s) sur ${dataset.fields.length}${
                          dataset.dateLabel ? ` · période filtrée sur la ${dataset.dateLabel}` : ''
                        }`}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setAllFields(dataset, true)}>
                      Tout cocher
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAllFields(dataset, false)}>
                      Tout décocher
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {dataset.fields.map((field) => (
                    <label
                      key={field.key}
                      className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-accent/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={chosen.includes(field.key)}
                        onCheckedChange={(checked) => toggleField(dataset, field.key, checked === true)}
                        className="mt-0.5"
                      />
                      <span className="flex-1">
                        {field.label}
                        {field.health && (
                          <Badge variant="outline" className="ml-1.5 align-middle text-[10px] font-normal">
                            santé
                          </Badge>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      {includesHealthData && (
        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-medium">Votre export contiendra des données de santé</p>
            <p className="text-muted-foreground">
              Un CSV n&apos;est ni chiffré ni protégé par mot de passe. Conservez-le sur un support
              chiffré, ne le transmettez pas par e-mail en clair, et supprimez-le une fois utilisé.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {exportableDatasets.length === 0
            ? 'Aucune donnée sélectionnée'
            : `${exportableDatasets.length} fichier(s) · ${totalColumns} colonne(s)`}
        </p>
        <Button onClick={handleExport} disabled={isExporting || exportableDatasets.length === 0}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Exporter en CSV
        </Button>
      </div>
    </div>
  )
}
