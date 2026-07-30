'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Loader2, Pencil, Trash2, Package, TriangleAlert } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABELS,
  CAPITALISATION_THRESHOLD,
  buildDepreciationSchedule,
  getAssetCategory,
} from '@/lib/finance/depreciation'

interface AssetRow {
  id: string
  label: string
  category: string
  service_date: string
  amount_ht: number
  vat_rate: number
  vat_amount: number
  duration_years: number
  notes: string | null
}

interface FormState {
  label: string
  category: string
  service_date: string
  amount_ht: string
  vat_rate: string
  duration_years: string
}

function emptyForm(): FormState {
  return {
    label: '',
    category: 'table',
    service_date: new Date().toISOString().split('T')[0],
    amount_ht: '',
    vat_rate: '20',
    duration_years: '7',
  }
}

/**
 * Immobilisations et amortissements.
 *
 * Un bien durable ne se déduit pas l'année de l'achat : son coût s'étale sur la
 * durée d'usage. L'écran montre donc les deux faces — la dotation déductible de
 * l'exercice, et la valeur qu'il reste à amortir.
 */
export default function AssetsSection({
  year,
  onChanged,
}: {
  year: number
  onChanged?: () => void
}) {
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<AssetRow | null>(null)
  const [deleting, setDeleting] = useState<AssetRow | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const { toast } = useToast()

  const fetchAssets = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/fixed-assets')
      if (!response.ok) throw new Error('Chargement impossible')
      const data = await response.json()
      setAssets(data.assets ?? [])
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de charger les immobilisations',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  /** Dotation de l'exercice et reste à amortir, bien par bien. */
  const rows = useMemo(
    () =>
      assets.map((asset) => {
        const schedule = buildDepreciationSchedule({
          id: asset.id,
          label: asset.label,
          category: asset.category,
          serviceDate: asset.service_date,
          amountHt: asset.amount_ht,
          vatAmount: asset.vat_amount,
          durationYears: asset.duration_years,
        })
        const current = schedule.find((entry) => entry.year === year)
        const last = schedule[schedule.length - 1]
        const isFinished = last !== undefined && year > last.year

        return {
          asset,
          dotation: current?.dotation ?? 0,
          accumulated: current?.accumulated ?? (isFinished ? asset.amount_ht : 0),
          residual: current?.residual ?? 0,
          isFinished,
          lastYear: last?.year,
        }
      }),
    [assets, year],
  )

  const totals = useMemo(
    () => ({
      dotation: rows.reduce((sum, row) => sum + row.dotation, 0),
      residual: rows.reduce((sum, row) => sum + row.residual, 0),
      base: rows.reduce((sum, row) => sum + row.asset.amount_ht, 0),
    }),
    [rows],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setShowDialog(true)
  }

  const openEdit = (asset: AssetRow) => {
    setEditing(asset)
    setForm({
      label: asset.label,
      category: asset.category,
      service_date: asset.service_date,
      amount_ht: String(asset.amount_ht),
      vat_rate: String(Math.round(asset.vat_rate * 100)),
      duration_years: String(asset.duration_years),
    })
    setShowDialog(true)
  }

  /** Pré-remplit durée et TVA selon la nature du bien. */
  const handleCategoryChange = (category: string) => {
    const preset = getAssetCategory(category)
    setForm((previous) => ({
      ...previous,
      category,
      duration_years: preset ? String(preset.defaultDuration) : previous.duration_years,
      vat_rate: preset ? String(Math.round(preset.defaultVatRate * 100)) : previous.vat_rate,
    }))
  }

  const handleSave = async () => {
    const amountHt = parseFloat(form.amount_ht.replace(',', '.'))
    const duration = parseInt(form.duration_years, 10)

    if (!form.label.trim() || isNaN(amountHt) || amountHt <= 0 || isNaN(duration)) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Renseignez un libellé, un montant et une durée valides',
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(
        editing ? `/api/fixed-assets/${editing.id}` : '/api/fixed-assets',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: form.label.trim(),
            category: form.category,
            service_date: form.service_date,
            amount_ht: amountHt,
            vat_rate: (parseFloat(form.vat_rate.replace(',', '.')) || 0) / 100,
            duration_years: duration,
          }),
        },
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Enregistrement impossible')
      }

      toast({
        variant: 'success',
        title: editing ? 'Immobilisation modifiée' : 'Immobilisation ajoutée',
        description: form.label.trim(),
      })

      setShowDialog(false)
      await fetchAssets()
      onChanged?.()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Enregistrement impossible',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return

    try {
      const response = await fetch(`/api/fixed-assets/${deleting.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Suppression impossible')

      toast({
        variant: 'success',
        title: 'Immobilisation supprimée',
        description: deleting.label,
      })
      setDeleting(null)
      await fetchAssets()
      onChanged?.()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer cette immobilisation',
      })
    }
  }

  const draftAmount = parseFloat(form.amount_ht.replace(',', '.'))
  const belowThreshold =
    !isNaN(draftAmount) && draftAmount > 0 && draftAmount < CAPITALISATION_THRESHOLD

  // Aperçu du plan pour la saisie en cours, pour voir l'effet avant d'enregistrer.
  const draftSchedule =
    !isNaN(draftAmount) && draftAmount > 0 && parseInt(form.duration_years, 10) > 0
      ? buildDepreciationSchedule({
          id: 'draft',
          label: form.label,
          category: form.category,
          serviceDate: form.service_date,
          amountHt: draftAmount,
          vatAmount: 0,
          durationYears: parseInt(form.duration_years, 10),
        })
      : []

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Immobilisations et amortissements
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Les biens durables de plus de {CAPITALISATION_THRESHOLD} € HT se
              déduisent sur plusieurs années, pas en une fois.
            </p>
          </div>
          <Button variant="outline" onClick={openCreate} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un bien
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : assets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucune immobilisation. Table de soin, matériel, informatique,
            agencements : ajoutez-les pour que leur amortissement entre dans le
            calcul.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border px-3.5 py-3">
                <p className="text-xs text-muted-foreground">
                  Dotation déductible en {year}
                </p>
                <p className="mt-0.5 text-xl font-bold tabular-nums">
                  {formatCurrency(totals.dotation)}
                </p>
              </div>
              <div className="rounded-xl border border-border px-3.5 py-3">
                <p className="text-xs text-muted-foreground">Reste à amortir</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums">
                  {formatCurrency(totals.residual)}
                </p>
                <p className="text-xs text-muted-foreground">
                  sur {formatCurrency(totals.base)} immobilisés
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {rows.map(({ asset, dotation, accumulated, residual, isFinished, lastYear }) => {
                const progress =
                  asset.amount_ht > 0 ? (accumulated / asset.amount_ht) * 100 : 0
                return (
                  <div
                    key={asset.id}
                    className="rounded-xl border border-border px-3.5 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {asset.label}
                          {isFinished && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Amorti
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ASSET_CATEGORY_LABELS[asset.category] ?? asset.category} ·{' '}
                          {formatCurrency(asset.amount_ht)} HT sur {asset.duration_years}{' '}
                          ans · mis en service le {formatDate(asset.service_date)}
                        </p>
                      </div>
                      <div className="flex items-start gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {dotation > 0 ? formatCurrency(dotation) : '—'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {dotation > 0
                              ? `dotation ${year}`
                              : isFinished
                                ? `terminé en ${lastYear}`
                                : 'pas encore en service'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEdit(asset)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleting(asset)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={Math.min(100, progress)} className="h-1.5" />
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {residual > 0
                          ? `${formatCurrency(residual)} restants`
                          : 'amorti'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Modifier l’immobilisation' : 'Nouvelle immobilisation'}
            </DialogTitle>
            <DialogDescription>
              L&apos;amortissement démarre à la mise en service, et la première
              année est réduite au prorata.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Libellé</Label>
              <Input
                value={form.label}
                placeholder="Table de soin électrique"
                onChange={(event) => setForm({ ...form, label: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Nature du bien</Label>
              <Select value={form.category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORIES.map((category) => (
                    <SelectItem key={category.key} value={category.key}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getAssetCategory(form.category)?.hint && (
                <p className="text-xs text-muted-foreground">
                  {getAssetCategory(form.category)?.hint}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mise en service</Label>
                <Input
                  type="date"
                  value={form.service_date}
                  onChange={(event) =>
                    setForm({ ...form, service_date: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Durée (années)</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={form.duration_years}
                  onChange={(event) =>
                    setForm({ ...form, duration_years: event.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant HT</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount_ht}
                  onChange={(event) =>
                    setForm({ ...form, amount_ht: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>TVA (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.vat_rate}
                  onChange={(event) => setForm({ ...form, vat_rate: event.target.value })}
                />
              </div>
            </div>

            {belowThreshold && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5">
                <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Sous {CAPITALISATION_THRESHOLD} € HT, un bien se passe
                  directement en charge — c&apos;est plus avantageux, la déduction
                  étant immédiate. Saisissez-le dans « Petit matériel &amp;
                  entretien » plutôt qu&apos;ici.
                </p>
              </div>
            )}

            {draftSchedule.length > 0 && (
              <div className="rounded-xl border border-primary/40 bg-primary/5 px-3.5 py-3">
                <p className="text-xs text-muted-foreground">
                  Plan d&apos;amortissement — {draftSchedule.length} exercices
                </p>
                <div className="mt-1.5 space-y-1">
                  {draftSchedule.slice(0, 4).map((entry) => (
                    <div
                      key={entry.year}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-muted-foreground">{entry.year}</span>
                      <span className="tabular-nums font-medium">
                        {formatCurrency(entry.dotation)}
                      </span>
                    </div>
                  ))}
                  {draftSchedule.length > 4 && (
                    <p className="text-xs text-muted-foreground">
                      … jusqu&apos;en {draftSchedule[draftSchedule.length - 1].year}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette immobilisation ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleting?.label} » et tout son plan d&apos;amortissement seront
              supprimés. Vos estimations seront recalculées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
